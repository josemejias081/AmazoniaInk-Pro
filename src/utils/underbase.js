export const createWhiteUnderbasePreview = (imageData, chokePixels = 0, alphaThreshold = 32) => {
  if (!imageData || !Number.isInteger(chokePixels) || chokePixels < 0 || chokePixels > 12) {
    throw new RangeError('A valid image and choke value from 0 to 12 pixels are required.');
  }
  const { width, height, data } = imageData;
  const mask = new Uint8Array(width * height);
  for (let pixel = 0; pixel < mask.length; pixel++) {
    mask[pixel] = data[pixel * 4 + 3] > alphaThreshold ? 1 : 0;
  }

  let current = mask;
  if (chokePixels > 0) {
    let srcBuffer = mask;
    let dstBuffer = new Uint8Array(width * height);
    const tempHorizontal = new Uint8Array(width * height);

    for (let step = 0; step < chokePixels; step++) {
      for (let y = 0; y < height; y++) {
        const rowOffset = y * width;
        for (let x = 0; x < width; x++) {
          tempHorizontal[rowOffset + x] = (x > 0 && x + 1 < width &&
            srcBuffer[rowOffset + x - 1] && srcBuffer[rowOffset + x] && srcBuffer[rowOffset + x + 1])
            ? 1 : 0;
        }
      }
      for (let y = 0; y < height; y++) {
        const rowOffset = y * width;
        const prevRow = (y - 1) * width;
        const nextRow = (y + 1) * width;
        for (let x = 0; x < width; x++) {
          dstBuffer[rowOffset + x] = (y > 0 && y + 1 < height &&
            tempHorizontal[prevRow + x] && tempHorizontal[rowOffset + x] && tempHorizontal[nextRow + x])
            ? 1 : 0;
        }
      }
      // Reutilizar búferes mediante intercambio (ping-pong)
      const temp = srcBuffer;
      srcBuffer = dstBuffer;
      dstBuffer = temp;
    }
    current = srcBuffer;
  }

  const output = new ImageData(width, height);
  for (let pixel = 0; pixel < current.length; pixel++) {
    const offset = pixel * 4;
    output.data[offset] = 255;
    output.data[offset + 1] = 255;
    output.data[offset + 2] = 255;
    output.data[offset + 3] = current[pixel] ? 255 : 0;
  }
  return output;
};
