/**
 * Motor de Vectorización Real por Contornos y Curvas de Bézier Cúbicas (Marching Edges + Douglas-Peucker + Catmull-Rom Splines).
 * Convierte mapas de etiquetas de capas de color en trazados vectoriales limpios con nodos y curvas Bézier (M, L, C, Z)
 * compatibles con Adobe Illustrator, CorelDRAW, Inkscape y plotters de corte de vinilo.
 */

// Extrae todos los contornos cerrados (exteriores e interiores/agujeros) de una capa binaria mediante aristas dirigidas
export const extractLayerContours = (labelMap, width, height, targetLayerIdx) => {
  // Representamos cada arista dirigida entre vértices de la rejilla (0..width, 0..height)
  // Un píxel (x, y) activo genera hasta 4 aristas dirigidas en sentido horario:
  // Arriba: (x,y) -> (x+1,y) si (x, y-1) no pertenece a la capa
  // Derecha: (x+1,y) -> (x+1,y+1) si (x+1, y) no pertenece a la capa
  // Abajo: (x+1,y+1) -> (x,y+1) si (x, y+1) no pertenece a la capa
  // Izquierda: (x,y+1) -> (x,y) si (x-1, y) no pertenece a la capa
  const gridW = width + 1;
  const outgoing = new Map(); // vertexKey -> array de { toX, toY, used }

  const addEdge = (x1, y1, x2, y2) => {
    const key = y1 * gridW + x1;
    let list = outgoing.get(key);
    if (!list) {
      list = [];
      outgoing.set(key, list);
    }
    list.push({ x1, y1, x2, y2, used: false });
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

  const loops = [];
  for (const [, edgeList] of outgoing) {
    for (const startEdge of edgeList) {
      if (startEdge.used) continue;
      startEdge.used = true;
      const points = [{ x: startEdge.x1, y: startEdge.y1 }];
      let currX = startEdge.x2;
      let currY = startEdge.y2;
      const startX = startEdge.x1;
      const startY = startEdge.y1;

      let safety = 0;
      const maxSteps = (width + height) * 8 + 1000;
      while ((currX !== startX || currY !== startY) && safety++ < maxSteps) {
        points.push({ x: currX, y: currY });
        const nextList = outgoing.get(currY * gridW + currX);
        if (!nextList) break;
        const nextEdge = nextList.find((e) => !e.used);
        if (!nextEdge) break;
        nextEdge.used = true;
        currX = nextEdge.x2;
        currY = nextEdge.y2;
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

// Simplifica un contorno cerrado dividiéndolo en dos arcos por sus puntos más lejanos
export const simplifyClosedContour = (points, epsilon = 0.85) => {
  if (points.length <= 4) return points;
  let farthestIdx = Math.floor(points.length / 2);
  let maxDist = -1;
  const p0 = points[0];
  for (let i = 1; i < points.length; i++) {
    const d = Math.hypot(points[i].x - p0.x, points[i].y - p0.y);
    if (d > maxDist) {
      maxDist = d;
      farthestIdx = i;
    }
  }

  const arc1 = points.slice(0, farthestIdx + 1);
  const arc2 = [...points.slice(farthestIdx), points[0]];
  const simp1 = simplifyOpenPolylineRDP(arc1, epsilon);
  const simp2 = simplifyOpenPolylineRDP(arc2, epsilon);
  const combined = [...simp1.slice(0, -1), ...simp2.slice(0, -1)];
  return combined.length >= 3 ? combined : points;
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
      const cp2y = isCorner[(i + 1) % n] ? p2.y - (p2.y - p1.y) * 0.25 : p2.y - (p3.x - p1.y) * tension;
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
  const rdpEpsilon = smoothness <= 0 ? 0.45 : smoothness === 1 ? 0.9 : 1.35;

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
 * Construye el documento SVG completo con curvas de Bézier reales (`fill-rule="evenodd"`)
 * o en modo RLE de píxel exacto si se solicita.
 */
export const buildBezierVectorSVG = (
  labelMap,
  w,
  h,
  layers,
  includeRegMarks = false,
  physicalDims = null,
  options = { smoothness: 1, mode: 'bezier' }
) => {
  const widthAttr = physicalDims ? `${physicalDims.width}${physicalDims.unit}` : `${w}`;
  const heightAttr = physicalDims ? `${physicalDims.height}${physicalDims.unit}` : `${h}`;
  const isBezier = (options?.mode ?? 'bezier') === 'bezier';
  const shapeRendering = isBezier ? 'geometricPrecision' : 'crispEdges';

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${widthAttr}" height="${heightAttr}" shape-rendering="${shapeRendering}">\n`;

  layers.forEach((layer, idx) => {
    if (!layer.visible) return;
    const safeHex = /^#[0-9a-f]{6}$/i.test(layer.hex) ? layer.hex : '#000000';

    if (isBezier) {
      const pathData = traceLayerToBezierSvgPath(labelMap, w, h, idx, options?.smoothness ?? 1);
      if (pathData.length > 0) {
        svg += `  <g id="capa-${idx + 1}-${safeHex.replace('#', '')}">\n`;
        svg += `    <path fill="${safeHex}" fill-rule="evenodd" d="${pathData}" />\n`;
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
