import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutGangSheet } from './gangSheetLayout.js';

const entry = (widthCm, width = 100, height = 100, copies = 1, rotation = 0) => ({
  name: 'art.png',
  imageData: { width, height },
  widthCm,
  copies,
  rotation
});

test('places multiple copies on rows within the selected roll width', () => {
  const result = layoutGangSheet([entry(10, 100, 100, 3)], 23, 1);
  assert.equal(result.placements.length, 3);
  assert.deepEqual(result.placements.map(item => [item.x, item.y]), [[1, 1], [12, 1], [1, 12]]);
  assert.equal(result.heightCm, 23);
  assert.equal(result.utilizationPercent, (300 / (23 * 23)) * 100);
});

test('accounts for aspect ratio and 90 degree rotation', () => {
  const result = layoutGangSheet([entry(10, 100, 200, 1, 90)], 22, 1);
  assert.equal(result.placements[0].width, 20);
  assert.equal(result.placements[0].height, 10);
  assert.equal(result.heightCm, 12);
});

test('rejects artwork wider than the chosen roll', () => {
  assert.throws(() => layoutGangSheet([entry(25)], 22, 1), /más ancho que el rollo/);
});

test('caps sheet design count at 300', () => {
  assert.throws(() => layoutGangSheet([entry(1, 100, 100, 301)], 30, 0), /300 diseños/);
});

test('handles commercial roll widths like 58cm and 40cm', () => {
  const result = layoutGangSheet([entry(28, 100, 100, 2)], 58, 0.5);
  assert.equal(result.placements.length, 2);
  assert.equal(result.placements[1].x, 29);
  assert.equal(result.heightCm, 29);
});
