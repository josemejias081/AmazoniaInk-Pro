/**
 * Motor de Vectorización Industrial v2:
 * - Cuantización Perceptual CIE L*a*b* acelerada por Histograma 3D + Semillas K-Means++ (detecta detalles pequeños de alto contraste)
 * - Extracción Topológica de Contornos con Política de Giro a la Derecha (Right-Hand Turn Policy) en vértices de grado 4 (sin auto-intersecciones)
 * - Des-escalonado Laplaciano sensible a esquinas + Simplificación Ramer-Douglas-Peucker + Splines de Bézier Cúbicas (M, L, C, Z)
 * - Soporte de Solape / Trapping Serigráfico para eliminar costuras entre colores adyacentes.
 */
import { hexToRgb, rgbToHex, rgbToLab } from './backgroundRemoval.js';

// Extrae todos los contornos cerrados (exteriores e interiores/agujeros) de una capa binaria mediante aristas dirigidas
export const extractLayerContours = (labelMap, width, height, targetLayerIdx) => {
  // Representamos cada arista dirigida entre vértices de la rejilla (0..width, 0..height)
  // Un píxel (x, y) activo genera hasta 4 aristas dirigidas en sentido horario:
  // Arriba:    (x,y)     -> (x+1,y)   dir = (+1,  0)
  // Derecha:   (x+1,y)   -> (x+1,y+1) dir = ( 0, +1)
  // Abajo:     (x+1,y+1) -> (x,y+1)   dir = (-1,  0)
  // Izquierda: (x,y+1)   -> (x,y)     dir = ( 0, -1)
  const gridW = width + 1;
  const outgoing = new Map(); // vertexKey -> array de { x1, y1, x2, y2, dx, dy, used }

  const addEdge = (x1, y1, x2, y2) => {
    const key = y1 * gridW + x1;
    let list = outgoing.get(key);
    if (!list) {
      list = [];
      outgoing.set(key, list);
    }
    list.push({ x1, y1, x2, y2, dx: x2 - x1, dy: y2 - y1, used: false });
  };

  const isTarget = (x, y) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    return labelMap[y * width + x] === targetLayerIdx;
  };

  for (let y = 0; y < height; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      if (labelMap[rowOffset + x] !== targetLayerIdx) continue;
      if (!isTarget(x, y - 1)) addEdge(x, y, x + 1, y);
      if (!isTarget(x + 1, y)) addEdge(x + 1, y, x + 1, y + 1);
      if (!isTarget(x, y + 1)) addEdge(x + 1, y + 1, x, y + 1);
      if (!isTarget(x - 1, y)) addEdge(x, y + 1, x, y);
    }
  }

  // En vértices de grado 4 (dos píxeles que se tocan en diagonal), elegir siempre el giro a la derecha
  // respecto a la dirección entrante (inDx, inDy) para mantener cada isla como un polígono simple sin cruces en "8".
  const pickNextEdgeRightTurn = (nextList, inDx, inDy) => {
    let bestEdge = null;
    let bestScore = -Infinity;
    // Giro a la derecha en coordenadas de pantalla (Y hacia abajo): right = (-inDy, inDx)
    const rightDx = -inDy;
    const rightDy = inDx;
    for (let i = 0; i < nextList.length; i++) {
      const candidate = nextList[i];
      if (candidate.used) continue;
      let score = 0;
      if (candidate.dx === rightDx && candidate.dy === rightDy) {
        score = 3; // Prioridad 1: Giro a la derecha (abraza la esquina del píxel)
      } else if (candidate.dx === inDx && candidate.dy === inDy) {
        score = 2; // Prioridad 2: Seguir recto
      } else if (candidate.dx === -rightDx && candidate.dy === -rightDy) {
        score = 1; // Prioridad 3: Giro a la izquierda
      }
      if (score > bestScore) {
        bestScore = score;
        bestEdge = candidate;
      }
    }
    return bestEdge;
  };

  const loops = [];
  for (const [, edgeList] of outgoing) {
    for (const startEdge of edgeList) {
      if (startEdge.used) continue;
      startEdge.used = true;
      const points = [{ x: startEdge.x1, y: startEdge.y1 }];
      let currX = startEdge.x2;
      let currY = startEdge.y2;
      let inDx = startEdge.dx;
      let inDy = startEdge.dy;
      const startX = startEdge.x1;
      const startY = startEdge.y1;

      let safety = 0;
      const maxSteps = (width + height) * 12 + 2000;
      while ((currX !== startX || currY !== startY) && safety++ < maxSteps) {
        points.push({ x: currX, y: currY });
        const nextList = outgoing.get(currY * gridW + currX);
        if (!nextList) break;
        const nextEdge = pickNextEdgeRightTurn(nextList, inDx, inDy);
        if (!nextEdge) break;
        nextEdge.used = true;
        currX = nextEdge.x2;
        currY = nextEdge.y2;
        inDx = nextEdge.dx;
        inDy = nextEdge.dy;
      }

      if (points.length >= 4) {
        loops.push(removeCollinearVertices(points));
      }
    }
  }

  return loops;
};

// Fusiona vértices colineales consecutivos a lo largo de rectas horizontales o verticales
const removeCollinearVertices = (points) => {
  if (points.length <= 4) return points;
  const out = [];
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const curr = points[i];
    const next = points[(i + 1) % n];
    const dx1 = curr.x - prev.x;
    const dy1 = curr.y - prev.y;
    const dx2 = next.x - curr.x;
    const dy2 = next.y - curr.y;
    const cross = dx1 * dy2 - dy1 * dx2;
    if (Math.abs(cross) > 1e-6) {
      out.push(curr);
    }
  }
  return out.length >= 3 ? out : points;
};

// Suavizado de escalones diagonales de píxel (Des-escalonado / Corner-Aware Laplacian Smoothing)
const smoothPixelStaircase = (points, iterations = 2) => {
  if (points.length < 5 || iterations <= 0) return points;
  let current = points;

  for (let iter = 0; iter < iterations; iter++) {
    const n = current.length;
    const nextPts = [];
    for (let i = 0; i < n; i++) {
      const prev = current[(i - 1 + n) % n];
      const curr = current[i];
      const next = current[(i + 1) % n];

      const seg1 = Math.hypot(curr.x - prev.x, curr.y - prev.y);
      const seg2 = Math.hypot(next.x - curr.x, next.y - curr.y);

      // Si son tramos largos rectos (ej. marco o tipografía geométrica grande), preservar la esquina exacta
      if (seg1 > 6 && seg2 > 6) {
        nextPts.push(curr);
      } else {
        nextPts.push({
          x: curr.x * 0.5 + (prev.x + next.x) * 0.25,
          y: curr.y * 0.5 + (prev.y + next.y) * 0.25
        });
      }
    }
    current = nextPts;
  }
  return current;
};

// Distancia perpendicular de un punto P al segmento AB
const pointToSegmentDistance = (p, a, b) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
};

// Algoritmo Ramer-Douglas-Peucker sobre una polilínea abierta
const simplifyOpenPolylineRDP = (pts, epsilon) => {
  if (pts.length <= 2) return pts;
  let maxDist = 0;
  let splitIdx = 0;
  const first = pts[0];
  const last = pts[pts.length - 1];

  for (let i = 1; i < pts.length - 1; i++) {
    const d = pointToSegmentDistance(pts[i], first, last);
    if (d > maxDist) {
      maxDist = d;
      splitIdx = i;
    }
  }

  if (maxDist > epsilon) {
    const left = simplifyOpenPolylineRDP(pts.slice(0, splitIdx + 1), epsilon);
    const right = simplifyOpenPolylineRDP(pts.slice(splitIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [first, last];
};

// Simplifica un contorno cerrado de manera determinista (anclando el punto lexicográficamente menor en X,Y)
export const simplifyClosedContour = (points, epsilon = 0.85) => {
  if (points.length <= 4) return points;

  // Rotar el contorno para que siempre empiece en el vértice canónico (menor Y, luego menor X)
  // garantizando que dos capas adyacentes compartan anclajes deterministas
  let startIdx = 0;
  for (let i = 1; i < points.length; i++) {
    if (
      points[i].y < points[startIdx].y ||
      (points[i].y === points[startIdx].y && points[i].x < points[startIdx].x)
    ) {
      startIdx = i;
    }
  }
  const ordered =
    startIdx === 0 ? points : [...points.slice(startIdx), ...points.slice(0, startIdx)];

  let farthestIdx = Math.floor(ordered.length / 2);
  let maxDist = -1;
  const p0 = ordered[0];
  for (let i = 1; i < ordered.length; i++) {
    const d = Math.hypot(ordered[i].x - p0.x, ordered[i].y - p0.y);
    if (d > maxDist) {
      maxDist = d;
      farthestIdx = i;
    }
  }

  const arc1 = ordered.slice(0, farthestIdx + 1);
  const arc2 = [...ordered.slice(farthestIdx), ordered[0]];
  const simp1 = simplifyOpenPolylineRDP(arc1, epsilon);
  const simp2 = simplifyOpenPolylineRDP(arc2, epsilon);
  const combined = [...simp1.slice(0, -1), ...simp2.slice(0, -1)];
  return combined.length >= 3 ? combined : ordered;
};

const fmt = (num) => Number(num.toFixed(2));

/**
 * Convierte un contorno cerrado de puntos en un sub-trazado SVG con curvas de Bézier cúbicas (C)
 * para vértices suaves y líneas rectas (L) para esquinas pronunciadas.
 */
export const contourToBezierSubpath = (points, tension = 0.22) => {
  const n = points.length;
  if (n < 3) return '';

  // Si es un rectángulo exacto de 4 vértices alineados a los ejes, emitir M/L/Z directo y limpio
  if (n === 4) {
    const isAxisAligned = points.every((pt, i) => {
      const next = points[(i + 1) % 4];
      return Math.abs(pt.x - next.x) < 0.05 || Math.abs(pt.y - next.y) < 0.05;
    });
    if (isAxisAligned) {
      return (
        `M${fmt(points[0].x)},${fmt(points[0].y)}` +
        `L${fmt(points[1].x)},${fmt(points[1].y)}` +
        `L${fmt(points[2].x)},${fmt(points[2].y)}` +
        `L${fmt(points[3].x)},${fmt(points[3].y)}Z`
      );
    }
  }

  let d = `M${fmt(points[0].x)},${fmt(points[0].y)}`;

  // Determinar si cada vértice es esquina aguda (ángulo interior < 115°) o nodo suave
  const isCorner = new Array(n).fill(false);
  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const curr = points[i];
    const next = points[(i + 1) % n];
    const v1x = prev.x - curr.x;
    const v1y = prev.y - curr.y;
    const v2x = next.x - curr.x;
    const v2y = next.y - curr.y;
    const len1 = Math.hypot(v1x, v1y);
    const len2 = Math.hypot(v2x, v2y);
    if (len1 < 1e-4 || len2 < 1e-4) {
      isCorner[i] = true;
      continue;
    }
    const cosAngle = (v1x * v2x + v1y * v2y) / (len1 * len2);
    // cos(115°) ≈ -0.4226: si cosAngle > -0.42, el giro es pronunciado -> preservar esquina
    if (cosAngle > -0.42 || len1 > 18 || len2 > 18) {
      isCorner[i] = true;
    }
  }

  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];

    if (isCorner[i] && isCorner[(i + 1) % n]) {
      d += `L${fmt(p2.x)},${fmt(p2.y)}`;
    } else {
      // Puntos de control de Catmull-Rom convertidos a Bézier cúbica
      const cp1x = isCorner[i] ? p1.x + (p2.x - p1.x) * 0.25 : p1.x + (p2.x - p0.x) * tension;
      const cp1y = isCorner[i] ? p1.y + (p2.y - p1.y) * 0.25 : p1.y + (p2.y - p0.y) * tension;
      const cp2x = isCorner[(i + 1) % n] ? p2.x - (p2.x - p1.x) * 0.25 : p2.x - (p3.x - p1.x) * tension;
      const cp2y = isCorner[(i + 1) % n] ? p2.y - (p2.y - p1.y) * 0.25 : p2.y - (p3.y - p1.y) * tension;
      d += `C${fmt(cp1x)},${fmt(cp1y)} ${fmt(cp2x)},${fmt(cp2y)} ${fmt(p2.x)},${fmt(p2.y)}`;
    }
  }

  d += 'Z';
  return d;
};

/**
 * Genera el atributo `d` completo de una capa de color combinando todos sus contornos exteriores y agujeros
 * mediante curvas de Bézier suaves.
 */
export const traceLayerToBezierSvgPath = (labelMap, width, height, layerIdx, smoothness = 1) => {
  const rawLoops = extractLayerContours(labelMap, width, height, layerIdx);
  if (!rawLoops.length) return '';

  const smoothIterations = smoothness <= 0 ? 0 : smoothness === 1 ? 2 : 3;
  const rdpEpsilon = smoothness <= 0 ? 0.45 : smoothness === 1 ? 0.85 : 1.25;

  const subpaths = [];
  for (const loop of rawLoops) {
    // Descartar motas de 1 solo píxel aislado si el suavizado es >= 2
    if (smoothness >= 2 && loop.length <= 4) {
      const minX = Math.min(...loop.map((p) => p.x));
      const maxX = Math.max(...loop.map((p) => p.x));
      const minY = Math.min(...loop.map((p) => p.y));
      const maxY = Math.max(...loop.map((p) => p.y));
      if (maxX - minX <= 1 && maxY - minY <= 1) continue;
    }

    const smoothed = smoothPixelStaircase(loop, smoothIterations);
    const simplified = simplifyClosedContour(smoothed, rdpEpsilon);
    const sub = contourToBezierSubpath(simplified, smoothness <= 0 ? 0.14 : 0.22);
    if (sub) subpaths.push(sub);
  }

  return subpaths.join(' ');
};

/**
 * Cuantiza una imagen RGBA en `numColors` capas de tintas planas usando un Histograma 3D +
 * inicialización determinista K-Means++ en espacio perceptual CIE L*a*b* + filtrado morfológico.
 */
export const quantizeImageToLayers = (
  smallData,
  vw,
  vh,
  {
    numColors = 5,
    smoothness = 1,
    ignoreTransparent = true,
    customPalette = null
  } = {}
) => {
  const k = Math.max(2, Math.min(16, Number(numColors) || 5));
  const totalPixels = vw * vh;

  // 1. Construir histograma 3D compacto (32x32x32 = 32768 celdas) de píxeles opacos
  const BIN_COUNT = 32768;
  const binCounts = new Uint32Array(BIN_COUNT);
  const binSumR = new Float64Array(BIN_COUNT);
  const binSumG = new Float64Array(BIN_COUNT);
  const binSumB = new Float64Array(BIN_COUNT);

  for (let p = 0; p < totalPixels; p++) {
    const idx = p * 4;
    if (ignoreTransparent && smallData[idx + 3] <= 128) continue;
    const r = smallData[idx];
    const g = smallData[idx + 1];
    const b = smallData[idx + 2];
    const bin = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    binCounts[bin]++;
    binSumR[bin] += r;
    binSumG[bin] += g;
    binSumB[bin] += b;
  }

  const activeBins = [];
  for (let bin = 0; bin < BIN_COUNT; bin++) {
    const count = binCounts[bin];
    if (count === 0) continue;
    const r = Math.round(binSumR[bin] / count);
    const g = Math.round(binSumG[bin] / count);
    const b = Math.round(binSumB[bin] / count);
    const lab = rgbToLab(r, g, b);
    activeBins.push({ r, g, b, l: lab.L, a: lab.a, bLab: lab.b, count });
  }

  if (activeBins.length === 0) {
    activeBins.push({ r: 0, g: 0, b: 0, l: 0, a: 0, bLab: 0, count: 1 });
  }

  // 2. Inicializar centroides en espacio perceptual CIE L*a*b* (o respetar paleta personalizada si coincide en longitud)
  let centroids = [];
  const hasMatchingCustomPalette = Array.isArray(customPalette) && customPalette.length === k;

  if (hasMatchingCustomPalette) {
    centroids = customPalette.map((layer) => {
      const rgb = hexToRgb(layer.originalHex || layer.hex);
      const lab = rgbToLab(rgb.r, rgb.g, rgb.b);
      return { r: rgb.r, g: rgb.g, b: rgb.b, l: lab.L, a: lab.a, bLab: lab.b };
    });
  } else {
    // Semilla 0: el color con mayor presencia en el diseño
    let firstSeed = activeBins[0];
    for (let i = 1; i < activeBins.length; i++) {
      if (activeBins[i].count > firstSeed.count) {
        firstSeed = activeBins[i];
      }
    }
    centroids.push({ ...firstSeed });

    // Semillas 1..k-1: K-Means++ determinista ponderado por distancia perceptual CIE L*a*b* y raíz cúbica de frecuencia
    // (permite capturar detalles pequeños de alto contraste como acentos rojos o dorados sin caer en ruido de 1 píxel)
    while (centroids.length < k) {
      let bestBin = activeBins[0];
      let bestScore = -1;

      for (let i = 0; i < activeBins.length; i++) {
        const candidate = activeBins[i];
        let minDistSq = Infinity;
        for (let c = 0; c < centroids.length; c++) {
          const dl = candidate.l - centroids[c].l;
          const da = candidate.a - centroids[c].a;
          const db = candidate.bLab - centroids[c].bLab;
          const dSq = dl * dl + da * da + db * db;
          if (dSq < minDistSq) minDistSq = dSq;
        }
        const weight = Math.pow(candidate.count, 0.35);
        const score = minDistSq * weight;
        if (score > bestScore) {
          bestScore = score;
          bestBin = candidate;
        }
      }
      centroids.push({ ...bestBin });
    }

    // 8 iteraciones de refinamiento K-Means sobre el histograma compacto en CIE L*a*b*
    for (let iter = 0; iter < 8; iter++) {
      const sums = Array.from({ length: k }, () => ({
        r: 0,
        g: 0,
        b: 0,
        l: 0,
        a: 0,
        bLab: 0,
        weight: 0
      }));

      for (let i = 0; i < activeBins.length; i++) {
        const bin = activeBins[i];
        let bestIdx = 0;
        let bestDist = Infinity;
        for (let c = 0; c < k; c++) {
          const dl = bin.l - centroids[c].l;
          const da = bin.a - centroids[c].a;
          const db = bin.bLab - centroids[c].bLab;
          const d = dl * dl + da * da + db * db;
          if (d < bestDist) {
            bestDist = d;
            bestIdx = c;
          }
        }
        const w = bin.count;
        sums[bestIdx].r += bin.r * w;
        sums[bestIdx].g += bin.g * w;
        sums[bestIdx].b += bin.b * w;
        sums[bestIdx].l += bin.l * w;
        sums[bestIdx].a += bin.a * w;
        sums[bestIdx].bLab += bin.bLab * w;
        sums[bestIdx].weight += w;
      }

      for (let c = 0; c < k; c++) {
        if (sums[c].weight > 0) {
          const w = sums[c].weight;
          centroids[c] = {
            r: Math.round(sums[c].r / w),
            g: Math.round(sums[c].g / w),
            b: Math.round(sums[c].b / w),
            l: sums[c].l / w,
            a: sums[c].a / w,
            bLab: sums[c].bLab / w
          };
        }
      }
    }
  }

  // 3. Construir tabla rápida de asignación bin -> cluster (LUT de 32768 entradas)
  const binToCluster = new Int16Array(BIN_COUNT).fill(-1);
  for (let bin = 0; bin < BIN_COUNT; bin++) {
    if (binCounts[bin] === 0) continue;
    const count = binCounts[bin];
    const r = Math.round(binSumR[bin] / count);
    const g = Math.round(binSumG[bin] / count);
    const b = Math.round(binSumB[bin] / count);
    const lab = rgbToLab(r, g, b);

    let bestIdx = 0;
    let bestDist = Infinity;
    for (let c = 0; c < k; c++) {
      const dl = lab.L - centroids[c].l;
      const da = lab.a - centroids[c].a;
      const db = lab.b - centroids[c].bLab;
      const d = dl * dl + da * da + db * db;
      if (d < bestDist) {
        bestDist = d;
        bestIdx = c;
      }
    }
    binToCluster[bin] = bestIdx;
  }

  // 4. Asignar cada píxel a su capa mediante la LUT O(1)
  let labelMap = new Int16Array(totalPixels).fill(-1);
  for (let p = 0; p < totalPixels; p++) {
    const idx = p * 4;
    if (ignoreTransparent && smallData[idx + 3] <= 128) continue;
    const r = smallData[idx];
    const g = smallData[idx + 1];
    const b = smallData[idx + 2];
    const bin = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    labelMap[p] = binToCluster[bin];
  }

  // 5. Filtrado morfológico de voto mayoritario (Majority Vote) que preserva líneas finas
  const voteCounts = new Int32Array(k + 1);
  for (let pass = 0; pass < smoothness; pass++) {
    const smoothed = new Int16Array(labelMap);
    for (let y = 1; y < vh - 1; y++) {
      const rowOffset = y * vw;
      for (let x = 1; x < vw - 1; x++) {
        const p = rowOffset + x;
        const centerLabel = labelMap[p];
        voteCounts.fill(0);
        let maxCount = 0;
        let winner = centerLabel;

        for (let dy = -1; dy <= 1; dy++) {
          const nRow = (y + dy) * vw;
          for (let dx = -1; dx <= 1; dx++) {
            const lbl = labelMap[nRow + (x + dx)];
            const slot = lbl + 1; // -1 -> 0, 0..k-1 -> 1..k
            const nextCount = ++voteCounts[slot];
            if (nextCount > maxCount) {
              maxCount = nextCount;
              winner = lbl;
            }
          }
        }
        // Solo reemplazar el píxel central si el ganador tiene mayoría clara (>= 5 de 9 vecinos)
        if (maxCount >= 5) {
          smoothed[p] = winner;
        }
      }
    }
    labelMap = smoothed;
  }

  // 6. Contabilizar cobertura y pre-trazar el path de Curvas Bézier de cada capa
  const counts = new Array(k).fill(0);
  let totalOpaque = 0;
  for (let p = 0; p < totalPixels; p++) {
    if (labelMap[p] >= 0) {
      counts[labelMap[p]]++;
      totalOpaque++;
    }
  }

  const layers = centroids.map((c, idx) => {
    const detectedHex = rgbToHex(c.r, c.g, c.b);
    const customLayer = hasMatchingCustomPalette ? customPalette[idx] : null;
    const pathData =
      counts[idx] > 0 ? traceLayerToBezierSvgPath(labelMap, vw, vh, idx, smoothness) : '';
    return {
      hex: customLayer?.hex || detectedHex,
      originalHex: customLayer?.originalHex || detectedHex,
      visible: customLayer?.visible ?? true,
      count: counts[idx],
      percentage: totalOpaque > 0 ? Math.round((counts[idx] / totalOpaque) * 100) : 0,
      pathData
    };
  });

  return { labelMap, width: vw, height: vh, layers };
};

/**
 * Construye el documento SVG completo con curvas de Bézier reales (`fill-rule="evenodd"`)
 * o en modo RLE de píxel exacto si se solicita. Incluye soporte para Trapping Serigráfico (`trappingPx`).
 */
export const buildBezierVectorSVG = (
  labelMap,
  w,
  h,
  layers,
  includeRegMarks = false,
  physicalDims = null,
  options = { smoothness: 1, mode: 'bezier', trappingPx: 0 }
) => {
  const widthAttr = physicalDims ? `${physicalDims.width}${physicalDims.unit}` : `${w}`;
  const heightAttr = physicalDims ? `${physicalDims.height}${physicalDims.unit}` : `${h}`;
  const isBezier = (options?.mode ?? 'bezier') === 'bezier';
  const trappingPx = Math.max(0, Number(options?.trappingPx) || 0);
  const shapeRendering = isBezier ? 'geometricPrecision' : 'crispEdges';

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${widthAttr}" height="${heightAttr}" shape-rendering="${shapeRendering}">\n`;

  layers.forEach((layer, idx) => {
    if (!layer.visible) return;
    const safeHex = /^#[0-9a-f]{6}$/i.test(layer.hex) ? layer.hex : '#000000';

    if (isBezier) {
      const pathData =
        layer.pathData || traceLayerToBezierSvgPath(labelMap, w, h, idx, options?.smoothness ?? 1);
      if (pathData.length > 0) {
        const trapAttr =
          trappingPx > 0
            ? ` stroke="${safeHex}" stroke-width="${fmt(trappingPx)}" stroke-linejoin="round"`
            : '';
        svg += `  <g id="capa-${idx + 1}-${safeHex.replace('#', '')}">\n`;
        svg += `    <path fill="${safeHex}" fill-rule="evenodd"${trapAttr} d="${pathData}" />\n`;
        svg += `  </g>\n`;
      }
    } else {
      // Modo alternativo RLE (barrido de píxeles exactos)
      let d = '';
      for (let y = 0; y < h; y++) {
        let x = 0;
        const rowOffset = y * w;
        while (x < w) {
          if (labelMap[rowOffset + x] === idx) {
            const startX = x;
            while (x < w && labelMap[rowOffset + x] === idx) x++;
            const len = x - startX;
            d += `M${startX},${y}h${len}v1h-${len}z`;
          } else {
            x++;
          }
        }
      }
      if (d.length > 0) {
        svg += `  <g id="capa-${idx + 1}-${safeHex.replace('#', '')}">\n`;
        svg += `    <path fill="${safeHex}" d="${d}" />\n`;
        svg += `  </g>\n`;
      }
    }
  });

  if (includeRegMarks) {
    const margin = Math.max(24, Math.round(Math.min(w, h) * 0.04));
    const r = Math.max(10, Math.round(Math.min(w, h) * 0.016));
    const pts = [
      [margin, margin],
      [w - margin, margin],
      [margin, h - margin],
      [w - margin, h - margin],
      [Math.round(w / 2), margin],
      [Math.round(w / 2), h - margin]
    ];
    svg += `  <g id="marcas-registro" stroke="#000000" stroke-width="2" fill="none">\n`;
    pts.forEach(([cx, cy]) => {
      svg += `    <circle cx="${cx}" cy="${cy}" r="${Math.round(r * 0.6)}" />\n`;
      svg += `    <circle cx="${cx}" cy="${cy}" r="${r}" />\n`;
      svg += `    <line x1="${cx - Math.round(r * 1.6)}" y1="${cy}" x2="${cx + Math.round(r * 1.6)}" y2="${cy}" />\n`;
      svg += `    <line x1="${cx}" y1="${cy - Math.round(r * 1.6)}" x2="${cx}" y2="${cy + Math.round(r * 1.6)}" />\n`;
    });
    svg += `  </g>\n`;
  }

  svg += `</svg>`;
  return svg;
};
