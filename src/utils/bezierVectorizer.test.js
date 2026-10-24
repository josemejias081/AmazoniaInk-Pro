import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBezierVectorSVG,
  extractLayerContours,
  traceLayerToBezierSvgPath
} from './bezierVectorizer.js';

test('extractLayerContours extracts both outer boundary and inner hole of a ring', () => {
  const w = 24;
  const h = 24;
  const labelMap = new Int32Array(w * h).fill(-1);

  for (let y = 4; y < 20; y++) {
    for (let x = 4; x < 20; x++) {
      // Leave an internal 6x6 hole in the center (9..15)
      if (x >= 9 && x < 15 && y >= 9 && y < 15) continue;
      labelMap[y * w + x] = 0;
    }
  }

  const contours = extractLayerContours(labelMap, w, h, 0);
  assert.equal(contours.length, 2, 'Ring must produce 2 closed contours (outer boundary + inner hole)');
});

test('traceLayerToBezierSvgPath fits smooth Cubic Bezier curves (C commands) on circular shapes', () => {
  const w = 40;
  const h = 40;
  const labelMap = new Int32Array(w * h).fill(-1);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dist = Math.hypot(x - 20, y - 20);
      if (dist <= 14) {
        labelMap[y * w + x] = 0;
      }
    }
  }

  const pathData = traceLayerToBezierSvgPath(labelMap, w, h, 0, 1);
  assert.ok(pathData.startsWith('M'), 'Path must start with MoveTo (M)');
  assert.ok(pathData.includes('C'), 'Curved shape must include Cubic Bezier (C) curve segments');
  assert.ok(pathData.endsWith('Z'), 'Closed contour path must end with Z');
});

test('buildBezierVectorSVG generates SVG with geometricPrecision, evenodd fill-rule and physical dimensions', () => {
  const w = 30;
  const h = 30;
  const labelMap = new Int32Array(w * h).fill(-1);
  for (let y = 5; y < 25; y++) {
    for (let x = 5; x < 25; x++) {
      if (Math.hypot(x - 15, y - 15) <= 9) labelMap[y * w + x] = 0;
    }
  }

  const svg = buildBezierVectorSVG(
    labelMap,
    w,
    h,
    [{ hex: '#10b981', visible: true }],
    true,
    { width: 25, height: 25, unit: 'cm' },
    { smoothness: 1, mode: 'bezier' }
  );

  assert.ok(svg.includes('shape-rendering="geometricPrecision"'));
  assert.ok(svg.includes('fill-rule="evenodd"'));
  assert.ok(svg.includes('width="25cm" height="25cm"'));
  assert.ok(svg.includes('id="marcas-registro"'));
});
