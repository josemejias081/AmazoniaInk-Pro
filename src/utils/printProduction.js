const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
export const MAX_CANVAS_DIMENSION = 30000; // Hasta ~254 cm (2.54 m) de largo continuo a 300 DPI
export const MAX_EXPORT_PIXELS = 220_000_000; // 220 MPx (cubre bobinas de 60 cm × 250 cm a 300 DPI)

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
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const readUint32 = (view, offset) => view.getUint32(offset, false);

export const writePngChunk = (type, data) => {
  const typeBytes = new TextEncoder().encode(type);
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length, false);
  chunk.set(typeBytes, 4);
  chunk.set(data, 8);
  view.setUint32(8 + data.length, crc32(chunk.subarray(4, 8 + data.length)), false);
  return chunk;
};

export const buildPhysicalResolutionChunk = (dpi) => {
  const pixelsPerMeter = Math.round(dpi / 0.0254);
  const physicalData = new Uint8Array(9);
  const physicalView = new DataView(physicalData.buffer);
  physicalView.setUint32(0, pixelsPerMeter, false);
  physicalView.setUint32(4, pixelsPerMeter, false);
  physicalData[8] = 1; // unidad = metro
  return writePngChunk('pHYs', physicalData);
};

export const addPngPhysicalResolution = (pngBytes, dpi) => {
  if (!Number.isFinite(dpi) || dpi <= 0) {
    throw new RangeError('Los DPI deben ser un valor finito positivo.');
  }
  if (!(pngBytes instanceof Uint8Array) || pngBytes.length < 20 ||
      !PNG_SIGNATURE.every((byte, index) => pngBytes[index] === byte)) {
    throw new TypeError('Los datos proporcionados no son un PNG válido.');
  }

  const resolutionChunk = buildPhysicalResolutionChunk(dpi);

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

/**
 * Codificador PNG por franjas horizontales (Banded / Streaming PNG Encoder).
 * Permite exportar planchas DTF gigantes (1m, 2m, 2.5m a 300 DPI = hasta 220 MPx)
 * renderizando franjas de `bandHeightPx` (ej. 1024 px de alto) sin agotar la memoria GPU/RAM del navegador.
 *
 * @param {object} options
 * @param {number} options.width - Ancho total en píxeles
 * @param {number} options.height - Alto total en píxeles
 * @param {number} options.dpi - Resolución física en DPI para el bloque pHYs
 * @param {number} [options.bandHeight=1024] - Altura de cada franja en píxeles
 * @param {(bandY: number, bandH: number) => Uint8ClampedArray | Uint8Array} options.renderBandRgba
 * @param {(progress: number) => void} [options.onProgress]
 * @returns {Promise<Blob>} Blob PNG válido con cabecera pHYs
 */
export const encodeBandedRgbaToPngBlob = async ({
  width,
  height,
  dpi = 300,
  bandHeight = 1024,
  renderBandRgba,
  onProgress
}) => {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new RangeError('Dimensiones inválidas para el codificador PNG por franjas.');
  }
  if (typeof CompressionStream === 'undefined') {
    throw new Error('CompressionStream no está disponible en este entorno.');
  }

  // 1. Construir bloque IHDR (13 bytes: width, height, bitDepth=8, colorType=6 RGBA, comp=0, filter=0, interlace=0)
  const ihdrData = new Uint8Array(13);
  const ihdrView = new DataView(ihdrData.buffer);
  ihdrView.setUint32(0, width, false);
  ihdrView.setUint32(4, height, false);
  ihdrData[8] = 8; // 8 bits por canal
  ihdrData[9] = 6; // Color type 6: Truecolor con alfa (RGBA)
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdrChunk = writePngChunk('IHDR', ihdrData);

  // 2. Construir bloque pHYs con la densidad física (ej. 300 DPI = 11811 px/m)
  const physChunk = buildPhysicalResolutionChunk(dpi);

  // 3. Comprimir por streaming zlib ('deflate') cada franja de scanlines PNG (1 byte de filtro 0 + width*4 bytes por fila)
  const compressionStream = new CompressionStream('deflate');
  const writer = compressionStream.writable.getWriter();
  const reader = compressionStream.readable.getReader();

  const compressedChunks = [];
  const readPromise = (async () => {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value && value.byteLength > 0) {
        compressedChunks.push(value);
      }
    }
  })();

  const rowStride = width * 4 + 1;
  for (let bandY = 0; bandY < height; bandY += bandHeight) {
    const currentBandH = Math.min(bandHeight, height - bandY);
    const rgba = renderBandRgba(bandY, currentBandH);
    const expectedLen = width * currentBandH * 4;
    if (!rgba || rgba.length < expectedLen) {
      throw new Error(`La franja renderizada en Y=${bandY} no devolvió los bytes RGBA esperados.`);
    }

    // Empaquetar las filas de la franja anteponiendo el byte de filtro PNG (0 = None, o 1 = Sub para mejor compresión)
    const bandRawScanlines = new Uint8Array(rowStride * currentBandH);
    for (let row = 0; row < currentBandH; row++) {
      const srcRowOffset = row * width * 4;
      const dstRowOffset = row * rowStride;
      bandRawScanlines[dstRowOffset] = 0; // Filtro 0 (None): ultra-rápido e impecable para áreas transparentes DTF
      bandRawScanlines.set(
        rgba.subarray(srcRowOffset, srcRowOffset + width * 4),
        dstRowOffset + 1
      );
    }

    await writer.write(bandRawScanlines);
    if (typeof onProgress === 'function') {
      onProgress(Math.min(1, (bandY + currentBandH) / height));
    }
  }

  await writer.close();
  await readPromise;

  // 4. Unificar datos zlib en bloques IDAT y cerrar con IEND
  const totalCompressedLen = compressedChunks.reduce((acc, c) => acc + c.byteLength, 0);
  const fullCompressed = new Uint8Array(totalCompressedLen);
  let copyOffset = 0;
  for (const part of compressedChunks) {
    fullCompressed.set(part, copyOffset);
    copyOffset += part.byteLength;
  }

  const idatChunk = writePngChunk('IDAT', fullCompressed);
  const iendChunk = writePngChunk('IEND', new Uint8Array(0));

  return new Blob([PNG_SIGNATURE, ihdrChunk, physChunk, idatChunk, iendChunk], {
    type: 'image/png'
  });
};

/**
 * Divide una plancha de largo arbitrario en tramos de `segmentLengthCm` (por defecto 100 cm = 1 Metro lineal).
 * Devuelve los rangos `[startCm, endCm]` de cada tramo para exportación multipágina / por rollos.
 */
export const calculateMeterSegments = (totalHeightCm, segmentLengthCm = 100) => {
  if (!Number.isFinite(totalHeightCm) || totalHeightCm <= 0) return [];
  const safeSegment = Math.max(10, Number(segmentLengthCm) || 100);
  const segments = [];
  let cursor = 0;
  let index = 1;
  while (cursor < totalHeightCm - 0.01) {
    const end = Math.min(totalHeightCm, Number((cursor + safeSegment).toFixed(2)));
    segments.push({
      index,
      startCm: Number(cursor.toFixed(2)),
      endCm: end,
      heightCm: Number((end - cursor).toFixed(2))
    });
    cursor = end;
    index++;
  }
  return segments;
};
