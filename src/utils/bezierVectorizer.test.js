import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildBezierVectorSVG,
  extractLayerContours,
  quantizeImageToLayers,
  traceLayerToBezierSvgPath
} from './bezierVectorizer.js';

test('extractLayerContours extracts both outer boundary and inner hole of a ring', () => {
  const w = 16;
  const h = 16;
  const labelMap = new Int16Array(w * h).fill(-1);

  for (let y = 3; y <= 12; y++) {
    for (let x = 3; x <= 12; x++) {
      const isHole = x >= 6 && x <= 9 && y >= 6 && y <= 9;
      if (!isHole) {
        labelMap[y * w + x] = 0;
      }
    }
  }

  const contours = extractLayerContours(labelMap, w, h, 0);
  assert.equal(contours.length, 2);
});

test('extractLayerContours resolves degree-4 diagonal saddle vertices into separate simple polygons', () => {
  const w = 6;
  const h = 6;
  const labelMap = new Int16Array(w * h).fill(-1);
  // Two pixels touching only at diagonal vertex (2,2): (1,1) and (2,2)
  labelMap[1 * w + 1] = 0;
  labelMap[2 * w + 2] = 0;

  const contours = extractLayerContours(labelMap, w, h, 0);
  // Right-hand turn rule separates the two diagonal pixels into 2 simple 4-vertex squares
  assert.equal(contours.length, 2);
  assert.equal(contours[0].length, 4);
  assert.equal(contours[1].length, 4);
});

test('traceLayerToBezierSvgPath fits smooth Cubic Bezier curves (C commands) on circular shapes', () => {
  const w = 32;
  const h = 32;
  const labelMap = new Int16Array(w * h).fill(-1);
  const cx = 16;
  const cy = 16;
  const r = 10;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (Math.hypot(x - cx, y - cy) <= r) {
        labelMap[y * w + x] = 0;
      }
    }
  }

  const d = traceLayerToBezierSvgPath(labelMap, w, h, 0, 1);
  assert.ok(d.startsWith('M'), 'Path should start with MoveTo (M)');
  assert.ok(d.includes('C'), 'Path should contain Cubic Bezier (C) curve segments');
  assert.ok(d.endsWith('Z'), 'Path should close with Z');
});

test('quantizeImageToLayers with K-Means++ in CIE Lab captures small 2% high-contrast accent color and preserves customPalette', () => {
  const w = 40;
  const h = 40;
  const rgba = new Uint8ClampedArray(w * h * 4);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      if (x >= 18 && x <= 22 && y >= 18 && y <= 22) {
        // 25 pixels (~1.5% of image) of pure high-contrast red accent (#ff1010)
        rgba[idx] = 255;
        rgba[idx + 1] = 16;
        rgba[idx + 2] = 16;
        rgba[idx + 3] = 255;
      } else if (x < 20) {
        // Dark slate (#101418)
        rgba[idx] = 16;
        rgba[idx + 1] = 20;
        rgba[idx + 2] = 24;
        rgba[idx + 3] = 255;
      } else {
        // Pure white (#ffffff)
        rgba[idx] = 255;
        rgba[idx + 1] = 255;
        rgba[idx + 2] = 255;
        rgba[idx + 3] = 255;
      }
    }
  }

  const result = quantizeImageToLayers(rgba, w, h, {
    numColors: 3,
    smoothness: 0,
    ignoreTransparent: true
  });

  assert.equal(result.layers.length, 3);
  // Verify one of the detected layers is the red accent (high R, low G/B)
  const hasRedAccentLayer = result.layers.some((l) => {
    const r = parseInt(l.hex.slice(1, 3), 16);
    const g = parseInt(l.hex.slice(3, 5), 16);
    return r > 200 && g < 60 && l.count > 0;
  });
  assert.ok(hasRedAccentLayer, 'K-Means++ in CIE Lab must capture the small red accent detail');

  // Verify customPalette hex & visibility are preserved when re-running with higher smoothness
  const editedPalette = result.layers.map((l, i) =>
    i === 0 ? { ...l, hex: '#10b981', visible: false } : l
  );
  const reRun = quantizeImageToLayers(rgba, w, h, {
    numColors: 3,
    smoothness: 1,
    ignoreTransparent: true,
    customPalette: editedPalette
  });
  assert.equal(reRun.layers[0].hex, '#10b981');
  assert.equal(reRun.layers[0].visible, false);
});

test('buildBezierVectorSVG generates SVG with geometricPrecision, evenodd fill-rule, trapping stroke and physical dimensions', () => {
  const w = 20;
  const h = 20;
  const labelMap = new Int16Array(w * h).fill(-1);
  for (let y = 4; y < 16; y++) {
    for (let x = 4; x < 16; x++) {
      labelMap[y * w + x] = 0;
    }
  }

  const svg = buildBezierVectorSVG(
    labelMap,
    w,
    h,
    [{ hex: '#10b981', visible: true }],
    true,
    { width: 25, height: 25, unit: 'cm' },
    { smoothness: 1, mode: 'bezier', trappingPx: 0.75 }
  );

  assert.ok(svg.includes('shape-rendering="geometricPrecision"'));
  assert.ok(svg.includes('fill-rule="evenodd"'));
  assert.ok(svg.includes('stroke="#10b981" stroke-width="0.75"'));
  assert.ok(svg.includes('width="25cm" height="25cm"'));
  assert.ok(svg.includes('id="marcas-registro"'));
});
