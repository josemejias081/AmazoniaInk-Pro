const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const MAX_CANVAS_DIMENSION = 16000;
const MAX_EXPORT_PIXELS = 40_000_000;

export const calculateRasterSize = (widthInches, heightInches, dpi) => {
  if (![widthInches, heightInches, dpi].every(Number.isFinite) ||
      widthInches <= 0 || heightInches <= 0 || dpi <= 0) {
    throw new RangeError('Las dimensiones y los DPI de impresión deben ser valores finitos positivos.');
  }

  const width = Math.round(widthInches * dpi);
  const height = Math.round(heightInches * dpi);
  if (width > MAX_CANVAS_DIMENSION || height > MAX_CANVAS_DIMENSION ||
      width * height > MAX_EXPORT_PIXELS) {
    throw new RangeError(
      `La salida solicitada (${width} × ${height} px) supera el límite seguro de exportación del navegador.`
    );
  }
  return { width, height };
};

export const calculateEffectiveDpi = (sourceWidth, sourceHeight, targetWidth, targetHeight) => {
  if (![sourceWidth, sourceHeight, targetWidth, targetHeight].every(Number.isFinite) ||
      sourceWidth <= 0 || sourceHeight <= 0 || targetWidth <= 0 || targetHeight <= 0) {
    throw new RangeError('Las dimensiones de imagen e impresión deben ser valores finitos positivos.');
  }
  return Math.min(sourceWidth / targetWidth, sourceHeight / targetHeight);
};

const crc32 = (bytes) => {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const readUint32 = (view, offset) => view.getUint32(offset, false);

const writeChunk = (type, data) => {
  const typeBytes = new TextEncoder().encode(type);
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length, false);
  chunk.set(typeBytes, 4);
  chunk.set(data, 8);
  view.setUint32(8 + data.length, crc32(chunk.subarray(4, 8 + data.length)), false);
  return chunk;
};

export const addPngPhysicalResolution = (pngBytes, dpi) => {
  if (!Number.isFinite(dpi) || dpi <= 0) {
    throw new RangeError('Los DPI deben ser un valor finito positivo.');
  }
  if (!(pngBytes instanceof Uint8Array) || pngBytes.length < 20 ||
      !PNG_SIGNATURE.every((byte, index) => pngBytes[index] === byte)) {
    throw new TypeError('Los datos proporcionados no son un PNG válido.');
  }

  const pixelsPerMeter = Math.round(dpi / 0.0254);
  const physicalData = new Uint8Array(9);
  const physicalView = new DataView(physicalData.buffer);
  physicalView.setUint32(0, pixelsPerMeter, false);
  physicalView.setUint32(4, pixelsPerMeter, false);
  physicalData[8] = 1;
  const resolutionChunk = writeChunk('pHYs', physicalData);

  const view = new DataView(pngBytes.buffer, pngBytes.byteOffset, pngBytes.byteLength);
  const chunks = [];
  let offset = 8;
  let inserted = false;
  while (offset + 12 <= pngBytes.length) {
    const length = readUint32(view, offset);
    const end = offset + 12 + length;
    if (end > pngBytes.length) throw new TypeError('El PNG contiene un bloque truncado.');
    const type = new TextDecoder().decode(pngBytes.subarray(offset + 4, offset + 8));
    if (type !== 'pHYs') chunks.push(pngBytes.subarray(offset, end));
    if (type === 'IHDR') {
      chunks.push(resolutionChunk);
      inserted = true;
    }
    offset = end;
    if (type === 'IEND') break;
  }
  if (!inserted || offset !== pngBytes.length) {
    throw new TypeError('El PNG tiene una estructura de bloques no válida.');
  }

  const outputLength = PNG_SIGNATURE.length + chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(outputLength);
  output.set(PNG_SIGNATURE);
  let outputOffset = PNG_SIGNATURE.length;
  for (const chunk of chunks) {
    output.set(chunk, outputOffset);
    outputOffset += chunk.length;
  }
  return output;
};

export const addPngPhysicalResolutionToBlob = async (blob, dpi) => {
  if (!(blob instanceof Blob) || blob.type !== 'image/png') {
    throw new TypeError('Se esperaba un Blob PNG generado por el lienzo.');
  }
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return new Blob([addPngPhysicalResolution(bytes, dpi)], { type: 'image/png' });
};
