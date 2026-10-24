import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addPngPhysicalResolution,
  addPngPhysicalResolutionToBlob,
  calculateEffectiveDpi,
  calculateMeterSegments,
  calculateRasterSize,
  encodeBandedRgbaToPngBlob
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

test('calculates raster dimensions from physical size and DPI including 1m and 2m 300 DPI commercial rolls', () => {
  assert.deepEqual(calculateRasterSize(10, 5, 300), { width: 3000, height: 1500 });
  // 58 cm x 100 cm (1 metro comercial DTF) a 300 DPI = 6850 x 11811 px (~80.9 MPx)
  const oneMeter = calculateRasterSize(58 / 2.54, 100 / 2.54, 300);
  assert.equal(oneMeter.width, 6850);
  assert.equal(oneMeter.height, 11811);
  // 58 cm x 200 cm (2 metros comerciales DTF) a 300 DPI = 6850 x 23622 px (~161.8 MPx)
  const twoMeters = calculateRasterSize(58 / 2.54, 200 / 2.54, 300);
  assert.equal(twoMeters.width, 6850);
  assert.equal(twoMeters.height, 23622);
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

test('encodes multi-band RGBA strips into a valid PNG Blob with 300 DPI pHYs metadata', async () => {
  const blob = await encodeBandedRgbaToPngBlob({
    width: 16,
    height: 40,
    dpi: 300,
    bandHeight: 12,
    renderBandRgba: (bandY, bandH) => {
      const buf = new Uint8ClampedArray(16 * bandH * 4);
      for (let i = 0; i < buf.length; i += 4) {
        buf[i] = 16;
        buf[i + 1] = 185;
        buf[i + 2] = 129;
        buf[i + 3] = 255;
      }
      return buf;
    }
  });
  assert.equal(blob.type, 'image/png');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.notEqual(Buffer.from(bytes).indexOf(Buffer.from('IHDR')), -1);
  assert.notEqual(Buffer.from(bytes).indexOf(Buffer.from('pHYs')), -1);
  assert.notEqual(Buffer.from(bytes).indexOf(Buffer.from('IDAT')), -1);
  assert.notEqual(Buffer.from(bytes).indexOf(Buffer.from('IEND')), -1);
});

test('splits long gang sheets into 1-meter (100cm) segments', () => {
  const segments = calculateMeterSegments(235, 100);
  assert.equal(segments.length, 3);
  assert.deepEqual(segments[0], { index: 1, startCm: 0, endCm: 100, heightCm: 100 });
  assert.deepEqual(segments[1], { index: 2, startCm: 100, endCm: 200, heightCm: 100 });
  assert.deepEqual(segments[2], { index: 3, startCm: 200, endCm: 235, heightCm: 35 });
});
