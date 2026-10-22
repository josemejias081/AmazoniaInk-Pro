import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addPngPhysicalResolution,
  addPngPhysicalResolutionToBlob,
  calculateEffectiveDpi,
  calculateRasterSize
} from './printProduction.js';

const transparentPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l8sAAAAASUVORK5CYII=',
  'base64'
);

const pngCrc32 = (bytes) => {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
};

test('calculates raster dimensions from physical size and DPI', () => {
  assert.deepEqual(calculateRasterSize(10, 5, 300), { width: 3000, height: 1500 });
});

test('rejects unsafe exports instead of silently clamping dimensions', () => {
  assert.throws(() => calculateRasterSize(60, 40, 600), /límite seguro de exportación/);
  assert.throws(() => calculateRasterSize(0, 4, 300), RangeError);
});

test('reports the effective DPI from source pixels and target print size', () => {
  assert.equal(calculateEffectiveDpi(1000, 500, 10, 5), 100);
});

test('writes one PNG pHYs chunk with the requested physical density', () => {
  const png = addPngPhysicalResolution(new Uint8Array(transparentPng), 300);
  const type = Buffer.from('pHYs');
  const index = Buffer.from(png).indexOf(type);
  assert.notEqual(index, -1);
  assert.equal(new DataView(png.buffer).getUint32(index - 4), 9);
  assert.equal(new DataView(png.buffer).getUint32(index + 4), 11811);
  assert.equal(new DataView(png.buffer).getUint32(index + 8), 11811);
  assert.equal(png[index + 12], 1);
  const chunkEnd = index + 4 + 9;
  const actualCrc = new DataView(png.buffer).getUint32(chunkEnd);
  assert.equal(actualCrc, pngCrc32(png.subarray(index, chunkEnd)));
  assert.equal(Buffer.from(png).indexOf(type, index + 4), -1);
});

test('rejects non-PNG data and invalid density values', () => {
  assert.throws(() => addPngPhysicalResolution(new Uint8Array([1, 2, 3]), 300), TypeError);
  assert.throws(() => addPngPhysicalResolution(new Uint8Array(transparentPng), 0), RangeError);
});

test('adds physical resolution to a PNG Blob', async () => {
  const source = new Blob([transparentPng], { type: 'image/png' });
  const result = await addPngPhysicalResolutionToBlob(source, 150);
  assert.equal(result.type, 'image/png');
  const bytes = new Uint8Array(await result.arrayBuffer());
  const index = Buffer.from(bytes).indexOf(Buffer.from('pHYs'));
  assert.notEqual(index, -1);
  assert.equal(new DataView(bytes.buffer).getUint32(index + 4), 5906);
});
