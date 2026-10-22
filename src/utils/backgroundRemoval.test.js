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
