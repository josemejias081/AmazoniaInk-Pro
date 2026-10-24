import test from 'node:test';
import assert from 'node:assert/strict';
import { removeBackground, hexToRgb, rgbToHex } from './backgroundRemoval.js';

test('hexToRgb and rgbToHex conversion', () => {
  assert.deepEqual(hexToRgb('#ffffff'), { r: 255, g: 255, b: 255 });
  assert.deepEqual(hexToRgb('#000000'), { r: 0, g: 0, b: 0 });
  assert.equal(rgbToHex(255, 255, 255), '#ffffff');
  assert.equal(rgbToHex(0, 0, 0), '#000000');
});

test('removeBackground removes contiguous background from borders', () => {
  const w = 50;
  const h = 50;
  const data = new Uint8ClampedArray(w * h * 4);

  // Background is white
  data.fill(255);

  // Center 20x20 is dark green (#008000)
  for (let y = 15; y < 35; y++) {
    for (let x = 15; x < 35; x++) {
      const idx = (y * w + x) * 4;
      data[idx] = 0;
      data[idx + 1] = 128;
      data[idx + 2] = 0;
      data[idx + 3] = 255;
    }
  }

  const result = removeBackground({ width: w, height: h, data }, {
    targetColor: '#ffffff',
    tolerance: 30,
    feather: 0,
    choke: 0,
    contiguous: true
  });

  // Border should be transparent
  assert.equal(result.data[3], 0, 'Top-left pixel must be transparent');
  assert.equal(result.data[(w - 1) * 4 + 3], 0, 'Top-right pixel must be transparent');

  // Center artwork must remain fully opaque
  const centerIdx = (25 * w + 25) * 4;
  assert.equal(result.data[centerIdx + 3], 255, 'Artwork center must remain opaque');
  assert.equal(result.data[centerIdx + 1], 128, 'Artwork color must be preserved');
});

test('removeBackground contiguous mode protects internal white areas', () => {
  const w = 60;
  const h = 60;
  const data = new Uint8ClampedArray(w * h * 4);

  // Outer background: white
  data.fill(255);

  // Black box ring: 10..50
  for (let y = 10; y < 50; y++) {
    for (let x = 10; x < 50; x++) {
      const idx = (y * w + x) * 4;
      data[idx] = 0;
      data[idx + 1] = 0;
      data[idx + 2] = 0;
      data[idx + 3] = 255;
    }
  }

  // Inside ring is white (e.g. text or eye): 20..40
  for (let y = 20; y < 40; y++) {
    for (let x = 20; x < 40; x++) {
      const idx = (y * w + x) * 4;
      data[idx] = 255;
      data[idx + 1] = 255;
      data[idx + 2] = 255;
      data[idx + 3] = 255;
    }
  }

  const contiguousResult = removeBackground({ width: w, height: h, data }, {
    targetColor: '#ffffff',
    tolerance: 20,
    feather: 0,
    contiguous: true
  });

  // Outer border is transparent
  assert.equal(contiguousResult.data[3], 0, 'Outer border removed');

  // Inner white is protected!
  const innerIdx = (30 * w + 30) * 4;
  assert.equal(contiguousResult.data[innerIdx + 3], 255, 'Inner white area must be protected in contiguous mode');

  // Knockout global mode deletes inner white as well
  const knockoutResult = removeBackground({ width: w, height: h, data }, {
    targetColor: '#ffffff',
    tolerance: 20,
    feather: 0,
    contiguous: false
  });
  assert.equal(knockoutResult.data[innerIdx + 3], 0, 'Inner white area removed in global knockout mode');
});

test('removeBackground contiguous mode traverses already-transparent border margins and chokes border pixels', () => {
  const w = 10;
  const h = 10;
  const data = new Uint8ClampedArray(w * h * 4);

  // Outer 1px border is already transparent with RGB (0,0,0), while interior background (1..8) is white
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;
      data[idx] = 255;
      data[idx + 1] = 255;
      data[idx + 2] = 255;
      data[idx + 3] = 255;
    }
  }

  // Opaque red pixel at top border (x=5, y=0) next to transparent border pixels
  const topEdgeIdx = 5 * 4;
  data[topEdgeIdx] = 220;
  data[topEdgeIdx + 1] = 20;
  data[topEdgeIdx + 2] = 20;
  data[topEdgeIdx + 3] = 255;

  const result = removeBackground({ width: w, height: h, data }, {
    targetColor: '#ffffff',
    tolerance: 20,
    feather: 0,
    choke: 1,
    contiguous: true
  });

  // Interior white background connected to transparent margin must be removed
  const innerWhiteIdx = (5 * w + 5) * 4;
  assert.equal(result.data[innerWhiteIdx + 3], 0);

  // Opaque red pixel on top border (y=0) touching transparent neighbors must be choked
  assert.ok(result.data[topEdgeIdx + 3] < 255, 'Border pixel adjacent to transparency should be choked');
});

test('removeBackground ai-subject mode removes multi-tone gradient backgrounds while preserving central subject', () => {
  const w = 60;
  const h = 60;
  const data = new Uint8ClampedArray(w * h * 4);

  // Multi-colored background: top half is sky blue, bottom half is grass green
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      if (y < 30) {
        data[idx] = 120;
        data[idx + 1] = 180;
        data[idx + 2] = 240;
      } else {
        data[idx] = 60;
        data[idx + 1] = 150;
        data[idx + 2] = 75;
      }
      data[idx + 3] = 255;
    }
  }

  // Central subject (20..40, 20..40) in warm crimson/orange (#e11d48)
  for (let y = 20; y < 40; y++) {
    for (let x = 20; x < 40; x++) {
      const idx = (y * w + x) * 4;
      data[idx] = 225;
      data[idx + 1] = 29;
      data[idx + 2] = 72;
      data[idx + 3] = 255;
    }
  }

  const result = removeBackground({ width: w, height: h, data }, {
    mode: 'ai-subject',
    tolerance: 35,
    feather: 5,
    choke: 0
  });

  // Both top sky background and bottom grass background should be removed without picking a single targetColor!
  const skyIdx = (5 * w + 5) * 4;
  const grassIdx = (55 * w + 55) * 4;
  const subjectIdx = (30 * w + 30) * 4;
  assert.equal(result.data[skyIdx + 3], 0, 'Top sky background must be removed');
  assert.equal(result.data[grassIdx + 3], 0, 'Bottom grass background must be removed');
  assert.equal(result.data[subjectIdx + 3], 255, 'Central subject must remain opaque');
});
