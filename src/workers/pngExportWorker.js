import { addPngPhysicalResolutionToBlob } from '../utils/printProduction.js';

const drawRegistrationMarks = (context, width, height) => {
  const margin = Math.max(24, Math.round(Math.min(width, height) * 0.04));
  const radius = Math.max(10, Math.round(Math.min(width, height) * 0.016));
  const positions = [
    [margin, margin], [width - margin, margin], [margin, height - margin],
    [width - margin, height - margin], [width / 2, margin], [width / 2, height - margin]
  ];
  context.save();
  positions.forEach(([x, y]) => {
    const drawTarget = () => {
      context.beginPath();
      context.arc(x, y, radius * 0.6, 0, Math.PI * 2);
      context.stroke();
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.stroke();
      context.beginPath();
      context.moveTo(x - radius * 1.6, y);
      context.lineTo(x + radius * 1.6, y);
      context.moveTo(x, y - radius * 1.6);
      context.lineTo(x, y + radius * 1.6);
      context.stroke();
    };
    context.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    context.lineWidth = 4;
    drawTarget();
    context.strokeStyle = '#000000';
    context.lineWidth = 2;
    drawTarget();
  });
  context.restore();
};

self.onmessage = async ({ data }) => {
  try {
    const {
      pixels, sourceWidth, sourceHeight, originalBlob, width, height, dpi,
      mirror, sharpen, registrationMarks, background, format = 'image/png', quality = 0.92
    } = data;
    const originalBitmap = originalBlob ? await createImageBitmap(originalBlob) : null;
    const source = new OffscreenCanvas(
      originalBitmap?.width ?? sourceWidth,
      originalBitmap?.height ?? sourceHeight
    );
    const sourceContext = source.getContext('2d');
    if (!sourceContext) throw new Error('No se pudo preparar la imagen de origen.');
    if (originalBitmap) {
      sourceContext.drawImage(originalBitmap, 0, 0);
      originalBitmap.close();
    } else {
      sourceContext.putImageData(new ImageData(new Uint8ClampedArray(pixels), sourceWidth, sourceHeight), 0, 0);
    }

    const output = new OffscreenCanvas(width, height);
    const context = output.getContext('2d');
    if (!context) throw new Error('No se pudo crear el lienzo de exportación.');
    context.imageSmoothingEnabled = sharpen;
    context.imageSmoothingQuality = 'high';
    if (background) {
      context.fillStyle = background;
      context.fillRect(0, 0, width, height);
    }
    context.save();
    if (mirror) {
      context.translate(width, 0);
      context.scale(-1, 1);
    }
    context.drawImage(source, 0, 0, width, height);
    context.restore();
    if (registrationMarks) drawRegistrationMarks(context, width, height);
    const blob = await output.convertToBlob({ type: format, quality });
    const result = format === 'image/png' ? await addPngPhysicalResolutionToBlob(blob, dpi) : blob;
    self.postMessage({ blob: result });
  } catch (error) {
    self.postMessage({ error: error.message || 'Error desconocido al exportar el archivo.' });
  }
};
