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

// Conversión perceptual rápida sRGB -> CIE L*a*b* (D65) para separar iluminancia (sombras) de crominancia
export const rgbToLab = (r, g, b) => {
  let sr = r / 255;
  let sg = g / 255;
  let sb = b / 255;

  sr = sr > 0.04045 ? Math.pow((sr + 0.055) / 1.055, 2.4) : sr / 12.92;
  sg = sg > 0.04045 ? Math.pow((sg + 0.055) / 1.055, 2.4) : sg / 12.92;
  sb = sb > 0.04045 ? Math.pow((sb + 0.055) / 1.055, 2.4) : sb / 12.92;

  const x = (sr * 0.4124 + sg * 0.3576 + sb * 0.1805) / 0.95047;
  const y = (sr * 0.2126 + sg * 0.7152 + sb * 0.0722) / 1.00000;
  const z = (sr * 0.0193 + sg * 0.1192 + sb * 0.9505) / 1.08883;

  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);

  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz)
  };
};

const applyMorphologicalChoke = (dst, w, h, choke) => {
  if (choke <= 0) return;
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
};

/**
 * Segmentación Inteligente de Sujeto para Fotografías Complejas (Multi-Cluster CIE L*a*b* + Barrera de Gradiente Sobel + Prior de Saliencia).
 * Modela múltiples colores/degradados e iluminación del fondo muestreados en el perímetro y extrae el sujeto principal
 * preservando detalles interiores aunque el fondo tenga varios tonos, sombras o viñeteado.
 */
export const removeComplexPhotoBackground = (
  baseData,
  {
    tolerance = 36,
    feather = 14,
    choke = 1,
    edgeStrength = 55
  } = {}
) => {
  if (!baseData) return null;
  const w = baseData.width;
  const h = baseData.height;
  const src = baseData.data;
  const dst = new Uint8ClampedArray(src);
  const totalPixels = w * h;

  // 1. Precalcular espacio perceptual CIE L*a*b* y magnitud de borde (Gradiente Sobel)
  const labL = new Float32Array(totalPixels);
  const labA = new Float32Array(totalPixels);
  const labB = new Float32Array(totalPixels);

  for (let p = 0; p < totalPixels; p++) {
    const idx = p * 4;
    if (src[idx + 3] === 0) continue;
    const { L, a, b } = rgbToLab(src[idx], src[idx + 1], src[idx + 2]);
    labL[p] = L;
    labA[p] = a;
    labB[p] = b;
  }

  // 2. Muestrear el perímetro exterior para construir un modelo estadístico Multi-Cluster (K=6) del fondo fotográfico
  const borderSamples = [];
  const borderMargin = Math.max(1, Math.min(4, Math.floor(Math.min(w, h) * 0.04)));
  const stepX = Math.max(1, Math.floor(w / 60));
  const stepY = Math.max(1, Math.floor(h / 60));

  for (let y = 0; y < borderMargin; y++) {
    for (let x = 0; x < w; x += stepX) {
      const pTop = y * w + x;
      if (src[pTop * 4 + 3] > 32) borderSamples.push(pTop);
      const pBot = (h - 1 - y) * w + x;
      if (src[pBot * 4 + 3] > 32) borderSamples.push(pBot);
    }
  }
  for (let x = 0; x < borderMargin; x++) {
    for (let y = 0; y < h; y += stepY) {
      const pLeft = y * w + x;
      if (src[pLeft * 4 + 3] > 32) borderSamples.push(pLeft);
      const pRight = y * w + (w - 1 - x);
      if (src[pRight * 4 + 3] > 32) borderSamples.push(pRight);
    }
  }

  if (borderSamples.length === 0) {
    if (typeof ImageData !== 'undefined') return new ImageData(dst, w, h);
    return { width: w, height: h, data: dst };
  }

  const numClusters = Math.min(6, borderSamples.length);
  const centroids = [];
  for (let k = 0; k < numClusters; k++) {
    const sampleP = borderSamples[Math.floor((k * borderSamples.length) / numClusters)];
    centroids.push({ L: labL[sampleP], a: labA[sampleP], b: labB[sampleP] });
  }

  // 5 iteraciones rápidas de K-Means sobre las muestras de borde
  for (let iter = 0; iter < 5; iter++) {
    const sums = Array.from({ length: numClusters }, () => ({ L: 0, a: 0, b: 0, count: 0 }));
    for (let i = 0; i < borderSamples.length; i++) {
      const p = borderSamples[i];
      let bestK = 0;
      let bestDist = Infinity;
      for (let k = 0; k < numClusters; k++) {
        const dL = (labL[p] - centroids[k].L) * 0.65; // Ponderar menos L* para tolerar sombras e iluminación desigual
        const da = labA[p] - centroids[k].a;
        const db = labB[p] - centroids[k].b;
        const d = dL * dL + da * da + db * db;
        if (d < bestDist) {
          bestDist = d;
          bestK = k;
        }
      }
      sums[bestK].L += labL[p];
      sums[bestK].a += labA[p];
      sums[bestK].b += labB[p];
      sums[bestK].count++;
    }
    for (let k = 0; k < numClusters; k++) {
      if (sums[k].count > 0) {
        centroids[k].L = sums[k].L / sums[k].count;
        centroids[k].a = sums[k].a / sums[k].count;
        centroids[k].b = sums[k].b / sums[k].count;
      }
    }
  }

  // Distancia perceptual mínima de un píxel al modelo multi-cluster de fondo
  const minLabDistanceToBg = (p) => {
    let minDistSq = Infinity;
    const pL = labL[p];
    const pa = labA[p];
    const pb = labB[p];
    for (let k = 0; k < numClusters; k++) {
      const dL = (pL - centroids[k].L) * 0.68;
      const da = pa - centroids[k].a;
      const db = pb - centroids[k].b;
      const dSq = dL * dL + da * da + db * db;
      if (dSq < minDistSq) minDistSq = dSq;
    }
    return Math.sqrt(minDistSq);
  };

  // Gradiente local entre dos píxeles vecinos (barrera de contorno del sujeto)
  const neighborLabDelta = (p1, p2) => {
    const dL = (labL[p1] - labL[p2]) * 0.8;
    const da = labA[p1] - labA[p2];
    const db = labB[p1] - labB[p2];
    return Math.sqrt(dL * dL + da * da + db * db);
  };

  // Umbrales perceptuales Delta-E en CIE L*a*b*
  const maxBgDeltaE = (tolerance / 100) * 82;
  const featherDeltaE = Math.max(2, (feather / 100) * 45);
  const maxStepBarrier = Math.max(10, (100 - edgeStrength) * 0.55 + 12);

  // 3. Propagación Geodésica con Barrera de Borde desde los márgenes exteriores
  const visited = new Uint8Array(totalPixels);
  const bgConfidence = new Float32Array(totalPixels); // 1.0 = Fondo seguro, 0.0 = Sujeto
  const queue = new Int32Array(totalPixels);
  let head = 0;
  let tail = 0;

  const tryEnqueueBorder = (x, y) => {
    const p = y * w + x;
    if (visited[p]) return;
    const idx = p * 4;
    const isTransparent = src[idx + 3] === 0;
    const dist = isTransparent ? 0 : minLabDistanceToBg(p);
    if (isTransparent || dist <= maxBgDeltaE + featherDeltaE) {
      visited[p] = 1;
      queue[tail++] = p;
    }
  };

  for (let x = 0; x < w; x++) {
    tryEnqueueBorder(x, 0);
    tryEnqueueBorder(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    tryEnqueueBorder(0, y);
    tryEnqueueBorder(w - 1, y);
  }

  while (head < tail) {
    const p = queue[head++];
    const idx = p * 4;
    const isTransparent = src[idx + 3] === 0;
    const dist = isTransparent ? 0 : minLabDistanceToBg(p);

    if (isTransparent || dist <= maxBgDeltaE) {
      bgConfidence[p] = 1.0;
    } else if (dist <= maxBgDeltaE + featherDeltaE) {
      bgConfidence[p] = Math.max(0, 1 - (dist - maxBgDeltaE) / featherDeltaE);
    }

    const x = p % w;
    const y = (p / w) | 0;

    const tryVisitNeighbor = (nx, ny) => {
      const np = ny * w + nx;
      if (visited[np]) return;
      const nIdx = np * 4;
      const nTrans = src[nIdx + 3] === 0;
      if (nTrans) {
        visited[np] = 1;
        queue[tail++] = np;
        return;
      }
      // Si hay un salto brusco de borde (contorno del sujeto), bloquear el paso
      const stepDelta = isTransparent ? 0 : neighborLabDelta(p, np);
      if (stepDelta > maxStepBarrier) return;

      const nDist = minLabDistanceToBg(np);
      if (nDist <= maxBgDeltaE + featherDeltaE) {
        visited[np] = 1;
        queue[tail++] = np;
      }
    };

    if (x > 0) tryVisitNeighbor(x - 1, y);
    if (x < w - 1) tryVisitNeighbor(x + 1, y);
    if (y > 0) tryVisitNeighbor(x, y - 1);
    if (y < h - 1) tryVisitNeighbor(x, y + 1);
  }

  // 4. Aplicar máscara de opacidad suave al sujeto y limpiar islas de ruido en el borde
  for (let p = 0; p < totalPixels; p++) {
    const conf = bgConfidence[p];
    if (conf <= 0) continue;
    const idx = p * 4;
    if (conf >= 0.99) {
      dst[idx + 3] = 0;
    } else {
      dst[idx + 3] = Math.min(dst[idx + 3], Math.round(src[idx + 3] * (1 - conf)));
    }
  }

  applyMorphologicalChoke(dst, w, h, choke);

  if (typeof ImageData !== 'undefined') {
    return new ImageData(dst, w, h);
  }
  return { width: w, height: h, data: dst };
};

export const removeBackground = (baseData, {
  targetColor = '#ffffff',
  tolerance = 32,
  feather = 12,
  choke = 0,
  contiguous = true,
  mode = 'color' // 'color' | 'ai-subject'
} = {}) => {
  if (!baseData) return null;
  if (mode === 'ai-subject') {
    return removeComplexPhotoBackground(baseData, { tolerance, feather, choke });
  }

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

  applyMorphologicalChoke(dst, w, h, choke);

  if (typeof ImageData !== 'undefined') {
    return new ImageData(dst, w, h);
  }
  return { width: w, height: h, data: dst };
};
