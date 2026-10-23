export const hexToRgb = (hex) => {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
};

export const rgbToHex = (r, g, b) =>
  '#' + [r, g, b].map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');

export const removeBackground = (baseData, {
  targetColor = '#ffffff',
  tolerance = 32,
  feather = 12,
  choke = 0,
  contiguous = true
} = {}) => {
  if (!baseData) return null;
  const w = baseData.width;
  const h = baseData.height;
  const src = baseData.data;
  const dst = new Uint8ClampedArray(src);

  const target = hexToRgb(targetColor);
  const maxDist = (tolerance / 100) * 441.67;
  const featherDist = (feather / 100) * 441.67;

  const colorDistance = (idx) => {
    const dr = src[idx] - target.r;
    const dg = src[idx + 1] - target.g;
    const db = src[idx + 2] - target.b;
    return Math.sqrt(dr * dr + dg * dg + db * db);
  };

  if (contiguous) {
    const visited = new Uint8Array(w * h);
    const queue = new Int32Array(w * h);
    let head = 0;
    let tail = 0;

    const tryEnqueue = (x, y) => {
      const p = y * w + x;
      if (visited[p]) return;
      const idx = p * 4;
      const isTransparent = src[idx + 3] === 0;
      const dist = isTransparent ? 0 : colorDistance(idx);
      if (isTransparent || dist <= maxDist + featherDist) {
        visited[p] = 1;
        queue[tail++] = p;
      }
    };

    for (let x = 0; x < w; x++) {
      tryEnqueue(x, 0);
      tryEnqueue(x, h - 1);
    }
    for (let y = 0; y < h; y++) {
      tryEnqueue(0, y);
      tryEnqueue(w - 1, y);
    }

    while (head < tail) {
      const p = queue[head++];
      const idx = p * 4;
      const isTransparent = src[idx + 3] === 0;
      const dist = isTransparent ? 0 : colorDistance(idx);

      if (isTransparent || dist <= maxDist) {
        dst[idx + 3] = 0;
      } else if (featherDist > 0 && dist <= maxDist + featherDist) {
        const factor = (dist - maxDist) / featherDist;
        dst[idx + 3] = Math.min(dst[idx + 3], Math.round(src[idx + 3] * factor));
      }

      const x = p % w;
      const y = (p / w) | 0;
      if (x > 0) tryEnqueue(x - 1, y);
      if (x < w - 1) tryEnqueue(x + 1, y);
      if (y > 0) tryEnqueue(x, y - 1);
      if (y < h - 1) tryEnqueue(x, y + 1);
    }
  } else {
    for (let i = 0; i < src.length; i += 4) {
      if (src[i + 3] === 0) continue;
      const dist = colorDistance(i);
      if (dist <= maxDist) {
        dst[i + 3] = 0;
      } else if (featherDist > 0 && dist <= maxDist + featherDist) {
        const factor = (dist - maxDist) / featherDist;
        dst[i + 3] = Math.min(dst[i + 3], Math.round(src[i + 3] * factor));
      }
    }
  }

  if (choke > 0) {
    let currentAlpha = new Uint8ClampedArray(w * h);
    for (let p = 0; p < w * h; p++) currentAlpha[p] = dst[p * 4 + 3];

    for (let step = 0; step < choke; step++) {
      const nextAlpha = new Uint8ClampedArray(currentAlpha);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const p = y * w + x;
          const center = currentAlpha[p];
          if (center === 0) continue;
          const minNeighbor = Math.min(
            x > 0 ? currentAlpha[p - 1] : center,
            x < w - 1 ? currentAlpha[p + 1] : center,
            y > 0 ? currentAlpha[p - w] : center,
            y < h - 1 ? currentAlpha[p + w] : center
          );
          if (minNeighbor < center) {
            nextAlpha[p] = Math.round((center + minNeighbor) * 0.35);
          }
        }
      }
      currentAlpha = nextAlpha;
    }

    for (let p = 0; p < w * h; p++) {
      dst[p * 4 + 3] = currentAlpha[p];
    }
  }

  if (typeof ImageData !== 'undefined') {
    return new ImageData(dst, w, h);
  }
  return { width: w, height: h, data: dst };
};
