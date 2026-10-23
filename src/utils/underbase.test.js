import test from 'node:test';
import assert from 'node:assert/strict';
import { createWhiteUnderbasePreview } from './underbase.js';

const withImageData = (callback) => {
  const NativeImageData = globalThis.ImageData;
  globalThis.ImageData = class {
    constructor(width, height) {
      this.width = width;
      this.height = height;
      this.data = new Uint8ClampedArray(width * height * 4);
    }
  };
  try {
    callback();
  } finally {
    globalThis.ImageData = NativeImageData;
  }
};

test('creates opaque white pixels only where the source is opaque', () => withImageData(() => {
  const input = { width: 3, height: 1, data: new Uint8ClampedArray([4, 5, 6, 255, 0, 0, 0, 0, 7, 8, 9, 128]) };
  const output = createWhiteUnderbasePreview(input);
  assert.deepEqual([...output.data], [255, 255, 255, 255, 255, 255, 255, 0, 255, 255, 255, 255]);
}));

test('choke contracts the mask and removes edge pixels', () => withImageData(() => {
  const input = { width: 3, height: 3, data: new Uint8ClampedArray(3 * 3 * 4) };
  for (let pixel = 0; pixel < 9; pixel++) input.data[pixel * 4 + 3] = 255;
  const output = createWhiteUnderbasePreview(input, 1);
  assert.deepEqual([...Array(9)].map((_, pixel) => output.data[pixel * 4 + 3]), [0, 0, 0, 0, 255, 0, 0, 0, 0]);
}));

test('rejects unsupported choke values', () => {
  assert.throws(() => createWhiteUnderbasePreview({ width: 1, height: 1, data: new Uint8ClampedArray(4) }, 13), RangeError);
});

test('ignores faint anti-aliased fringe pixels below alpha threshold to prevent white DTF halos', () => withImageData(() => {
  const input = { width: 2, height: 1, data: new Uint8ClampedArray([255, 255, 255, 16, 255, 255, 255, 180]) };
  const output = createWhiteUnderbasePreview(input, 0);
  assert.equal(output.data[3], 0, 'Faint fringe alpha (16) should not receive solid white underbase');
  assert.equal(output.data[7], 255, 'Solid/semi-opaque pixel (180) should receive underbase');
}));
