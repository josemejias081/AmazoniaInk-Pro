import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Upload, Eraser, Grid, Layers, Maximize2, Download, Undo2, Redo2,
  ZoomIn, ZoomOut, Shirt, Sparkles, Sliders, Check, RefreshCw, Eye,
  FlipHorizontal, Crosshair, Palette, Info, Wand2, Paintbrush,
  Scissors, FileCode, CheckCircle2, AlertCircle, SplitSquareVertical,
  Droplet, Sun, Contrast, Move, HelpCircle, FileImage
} from 'lucide-react';

// ============================================================================
// GENERADORES DE GRÁFICOS DE PRUEBA (PROCEDURAL ARTWORK)
// ============================================================================
const generateSampleArtwork = (type) => {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 800;
  const ctx = canvas.getContext('2d');

  if (type === 'tiger') {
    // Fondo oscuro sólido (para probar Quitar Fondo y Knockout DTF)
    ctx.fillStyle = '#141418';
    ctx.fillRect(0, 0, 800, 800);

    // Resplandor exterior suave (ideal para probar Semitonos DTF)
    const grad = ctx.createRadialGradient(400, 400, 120, 400, 400, 370);
    grad.addColorStop(0, 'rgba(255, 100, 0, 0.9)');
    grad.addColorStop(0.5, 'rgba(220, 38, 38, 0.45)');
    grad.addColorStop(1, 'rgba(20, 20, 24, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(400, 400, 370, 0, Math.PI * 2);
    ctx.fill();

    // Sol retro japonés en franjas
    ctx.save();
    ctx.beginPath();
    ctx.arc(400, 370, 220, 0, Math.PI * 2);
    ctx.clip();
    const sunGrad = ctx.createLinearGradient(0, 150, 0, 590);
    sunGrad.addColorStop(0, '#fde047');
    sunGrad.addColorStop(0.5, '#f97316');
    sunGrad.addColorStop(1, '#dc2626');
    ctx.fillStyle = sunGrad;
    for (let y = 140; y < 600; y += 26) {
      const h = Math.max(4, 20 - (y - 140) * 0.025);
      ctx.fillRect(150, y, 500, h);
    }
    ctx.restore();

    // Escudo geométrico de tigre / samurai
    ctx.fillStyle = '#f59e0b';
    ctx.strokeStyle = '#09090b';
    ctx.lineWidth = 14;
    ctx.lineJoin = 'round';

    // Orejas
    ctx.beginPath();
    ctx.arc(270, 230, 55, 0, Math.PI * 2);
    ctx.arc(530, 230, 55, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(270, 230, 28, 0, Math.PI * 2);
    ctx.arc(530, 230, 28, 0, Math.PI * 2);
    ctx.fill();

    // Cabeza principal
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.moveTo(250, 240);
    ctx.lineTo(550, 240);
    ctx.lineTo(610, 390);
    ctx.lineTo(520, 560);
    ctx.lineTo(400, 610);
    ctx.lineTo(280, 560);
    ctx.lineTo(190, 390);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Mejillas blancas
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(195, 390);
    ctx.lineTo(310, 420);
    ctx.lineTo(285, 555);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(605, 390);
    ctx.lineTo(490, 420);
    ctx.lineTo(515, 555);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Rayas negras
    ctx.fillStyle = '#09090b';
    const stripes = [
      [[225, 310], [310, 330], [235, 355]],
      [[575, 310], [490, 330], [565, 355]],
      [[210, 365], [290, 380], [220, 400]],
      [[590, 365], [510, 380], [580, 400]],
      [[380, 245], [420, 245], [400, 335]]
    ];
    stripes.forEach(pts => {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      ctx.lineTo(pts[1][0], pts[1][1]);
      ctx.lineTo(pts[2][0], pts[2][1]);
      ctx.closePath();
      ctx.fill();
    });

    // Ojos
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.moveTo(260, 350);
    ctx.lineTo(360, 380);
    ctx.lineTo(340, 415);
    ctx.lineTo(255, 390);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(540, 350);
    ctx.lineTo(440, 380);
    ctx.lineTo(460, 415);
    ctx.lineTo(545, 390);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Pupilas
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(312, 385, 11, 0, Math.PI * 2);
    ctx.arc(488, 385, 11, 0, Math.PI * 2);
    ctx.fill();

    // Nariz y Boca
    ctx.fillStyle = '#fb7185';
    ctx.beginPath();
    ctx.moveTo(355, 430);
    ctx.lineTo(445, 430);
    ctx.lineTo(400, 485);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Colmillos y boca abierta
    ctx.fillStyle = '#09090b';
    ctx.beginPath();
    ctx.moveTo(320, 495);
    ctx.lineTo(480, 495);
    ctx.lineTo(450, 575);
    ctx.lineTo(350, 575);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(330, 498);
    ctx.lineTo(365, 498);
    ctx.lineTo(348, 550);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(470, 498);
    ctx.lineTo(435, 498);
    ctx.lineTo(452, 550);
    ctx.closePath();
    ctx.fill();

    // Tipografía Streetwear
    ctx.font = '900 74px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#09090b';
    ctx.lineWidth = 18;
    ctx.strokeText('TOKYO TIGER', 400, 700);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('TOKYO TIGER', 400, 700);

    ctx.font = '800 28px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#facc15';
    ctx.fillText('EST. 1998 • EDICIÓN ESPECIAL DTF', 400, 748);
  } else if (type === 'sunset') {
    // Fondo Blanco Puro (ideal para probar quitar fondo blanco o sublimación)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 800, 800);

    ctx.save();
    ctx.beginPath();
    ctx.arc(400, 380, 270, 0, Math.PI * 2);
    ctx.clip();

    const bgGrad = ctx.createLinearGradient(0, 110, 0, 650);
    bgGrad.addColorStop(0, '#4c1d95');
    bgGrad.addColorStop(0.35, '#be185d');
    bgGrad.addColorStop(0.7, '#f97316');
    bgGrad.addColorStop(1, '#fde047');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(130, 110, 540, 540);

    // Sol retro blanco/amarillo
    ctx.fillStyle = '#fef9c3';
    ctx.beginPath();
    ctx.arc(400, 360, 115, 0, Math.PI * 2);
    ctx.fill();

    // Líneas de corte del sol
    ctx.fillStyle = '#be185d';
    for (let y = 370; y < 480; y += 22) {
      ctx.fillRect(260, y, 280, (y - 355) * 0.12);
    }

    // Montañas vectoriales
    ctx.fillStyle = '#1e1b4b';
    ctx.beginPath();
    ctx.moveTo(100, 530);
    ctx.lineTo(270, 380);
    ctx.lineTo(410, 490);
    ctx.lineTo(540, 355);
    ctx.lineTo(710, 530);
    ctx.closePath();
    ctx.fill();

    // Rejilla Synthwave inferior
    ctx.fillStyle = '#09090b';
    ctx.fillRect(130, 515, 540, 150);
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 3;
    for (let i = -6; i <= 6; i++) {
      ctx.beginPath();
      ctx.moveTo(400 + i * 25, 515);
      ctx.lineTo(400 + i * 110, 660);
      ctx.stroke();
    }
    for (let y = 530; y < 650; y += 24) {
      ctx.beginPath();
      ctx.moveTo(130, y);
      ctx.lineTo(670, y);
      ctx.stroke();
    }
    ctx.restore();

    // Marco circular limpio
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.arc(400, 380, 270, 0, Math.PI * 2);
    ctx.stroke();

    ctx.font = '900 58px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0f172a';
    ctx.fillText('CALIFORNIA WAVE', 400, 725);
    ctx.font = '700 24px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#db2777';
    ctx.fillText('SUBLIMACIÓN & SERIGRAFÍA RETRO', 400, 765);
  } else if (type === 'skull') {
    // Emblema de colores planos (Ideal para Vectorizar / Separación por colores en Serigrafía)
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 800, 800);

    // Rayos de fondo cian y magenta planos
    ctx.fillStyle = '#06b6d4';
    ctx.beginPath();
    ctx.arc(400, 370, 250, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ec4899';
    ctx.beginPath();
    ctx.moveTo(400, 80);
    ctx.lineTo(490, 260);
    ctx.lineTo(690, 290);
    ctx.lineTo(545, 430);
    ctx.lineTo(580, 630);
    ctx.lineTo(400, 535);
    ctx.lineTo(220, 630);
    ctx.lineTo(255, 430);
    ctx.lineTo(110, 290);
    ctx.lineTo(310, 260);
    ctx.closePath();
    ctx.fill();

    // Cráneo estilizado blanco y negro
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.arc(400, 340, 155, Math.PI * 0.85, Math.PI * 0.15, false);
    ctx.lineTo(495, 495);
    ctx.lineTo(305, 495);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Cuencas oculares
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(340, 350, 42, 0, Math.PI * 2);
    ctx.arc(460, 350, 42, 0, Math.PI * 2);
    ctx.fill();

    // Detalle amarillo en los ojos
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(340, 350, 16, 0, Math.PI * 2);
    ctx.arc(460, 350, 16, 0, Math.PI * 2);
    ctx.fill();

    // Fosa nasal
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.moveTo(400, 385);
    ctx.lineTo(378, 430);
    ctx.lineTo(422, 430);
    ctx.closePath();
    ctx.fill();

    // Dientes
    ctx.lineWidth = 10;
    for (let x = 335; x <= 465; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 455);
      ctx.lineTo(x, 495);
      ctx.stroke();
    }

    // Banner inferior amarillo
    ctx.fillStyle = '#facc15';
    ctx.fillRect(140, 635, 520, 95);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.strokeRect(140, 635, 520, 95);

    ctx.fillStyle = '#000000';
    ctx.font = '900 56px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SKULL CREW', 400, 702);
  }

  return canvas;
};

// ============================================================================
// UTILIDADES DE COLOR Y VECTORIZACIÓN (RLE SCANLINE SVG + K-MEANS)
// ============================================================================
const rgbToHex = (r, g, b) =>
  '#' + [r, g, b].map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');

const hexToRgb = (hex) => {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
};

// Genera un archivo SVG vectorial limpio y compacto usando barras horizontales unificadas por capa de color
const buildOptimizedSVG = (labelMap, w, h, layers, includeRegMarks = false) => {
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" shape-rendering="crispEdges">\n`;

  layers.forEach((layer, idx) => {
    if (!layer.visible) return;
    let d = '';
    for (let y = 0; y < h; y++) {
      let x = 0;
      const rowOffset = y * w;
      while (x < w) {
        if (labelMap[rowOffset + x] === idx) {
          const startX = x;
          while (x < w && labelMap[rowOffset + x] === idx) {
            x++;
          }
          const len = x - startX;
          d += `M${startX},${y}h${len}v1h-${len}z`;
        } else {
          x++;
        }
      }
    }
    if (d.length > 0) {
      svg += `  <g id="capa-${idx + 1}-${layer.hex.replace('#', '')}">\n`;
      svg += `    <path fill="${layer.hex}" d="${d}" />\n`;
      svg += `  </g>\n`;
    }
  });

  if (includeRegMarks) {
    const m = 24;
    const pts = [[m, m], [w - m, m], [m, h - m], [w - m, h - m]];
    svg += `  <g id="marcas-registro" stroke="#000000" stroke-width="2" fill="none">\n`;
    pts.forEach(([cx, cy]) => {
      svg += `    <circle cx="${cx}" cy="${cy}" r="10" />\n`;
      svg += `    <line x1="${cx - 16}" y1="${cy}" x2="${cx + 16}" y2="${cy}" />\n`;
      svg += `    <line x1="${cx}" y1="${cy - 16}" x2="${cx}" y2="${cy + 16}" />\n`;
    });
    svg += `  </g>\n`;
  }

  svg += `</svg>`;
  return svg;
};

// Dibuja marcas de registro profesionales para serigrafía en un Canvas
const drawRegistrationMarksOnCanvas = (ctx, width, height, color = '#000000') => {
  const margin = Math.max(24, Math.round(Math.min(width, height) * 0.04));
  const r = Math.max(10, Math.round(Math.min(width, height) * 0.016));
  const positions = [
    [margin, margin],
    [width - margin, margin],
    [margin, height - margin],
    [width - margin, height - margin],
    [width / 2, margin],
    [width / 2, height - margin]
  ];

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;

  positions.forEach(([cx, cy]) => {
    // Fondo blanco circular para asegurar contraste
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.6, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx - r * 1.6, cy);
    ctx.lineTo(cx + r * 1.6, cy);
    ctx.moveTo(cx, cy - r * 1.6);
    ctx.lineTo(cx, cy + r * 1.6);
    ctx.stroke();
  });
  ctx.restore();
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================
export default function App() {
  // Navegación de módulos
  const [activeTab, setActiveTab] = useState('bg'); // 'bg' | 'halftone' | 'vector' | 'scale' | 'export'

  // Estado de la imagen maestra y pila de historial (Undo/Redo)
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [imageSize, setImageSize] = useState({ width: 800, height: 800 });
  const [activePresetName, setActivePresetName] = useState('Tigre Retro DTF');

  // Vista del Lienzo y Simulación de Prenda
  const [zoom, setZoom] = useState(0.75);
  const [bgPreviewMode, setBgPreviewMode] = useState('checker'); // 'checker' | 'shirt-black' | 'shirt-white' | 'shirt-gray' | 'shirt-custom'
  const [customShirtColor, setCustomShirtColor] = useState('#1e3a8a');
  const [compareSplit, setCompareSplit] = useState(false);
  const [splitPos, setSplitPos] = useState(50);
  const [notification, setNotification] = useState(null);

  // --------------------------------------------------------------------------
  // 1. ESTADO: QUITAR FONDO Y KNOCKOUT DTF
  // --------------------------------------------------------------------------
  const [bgTargetColor, setBgTargetColor] = useState('#141418');
  const [bgTolerance, setBgTolerance] = useState(32);
  const [bgFeather, setBgFeather] = useState(12);
  const [bgChoke, setBgChoke] = useState(1); // Contracción de bordes (0 a 4 px)
  const [bgContiguous, setBgContiguous] = useState(true); // Solo bordes exteriores vs Knockout en toda la imagen
  const [bgInteractionMode, setBgInteractionMode] = useState('picker'); // 'picker' | 'eraser' | 'restore'
  const [brushSize, setBrushSize] = useState(28);
  const isDrawingBrushRef = useRef(false);

  // --------------------------------------------------------------------------
  // 2. ESTADO: SEMITONOS (HALFTONE DTF & SERIGRAFÍA)
  // --------------------------------------------------------------------------
  const [htMode, setHtMode] = useState('dtf-knockout'); // 'dtf-knockout' | 'mono' | 'cmyk'
  const [htDotSize, setHtDotSize] = useState(10); // Tamaño de celda en px (equivale a LPI)
  const [htAngle, setHtAngle] = useState(22.5); // 22.5° o 45° clásico en serigrafía/DTF
  const [htShape, setHtShape] = useState('circle'); // 'circle' | 'diamond' | 'line' | 'cross'
  const [htContrast, setHtContrast] = useState(25);
  const [htThreshold, setHtThreshold] = useState(48); // Sensibilidad del knockout de sombra DTF
  const [htInvert, setHtInvert] = useState(false);

  // --------------------------------------------------------------------------
  // 3. ESTADO: VECTORIZAR Y SEPARACIÓN DE COLORES
  // --------------------------------------------------------------------------
  const [vecNumColors, setVecNumColors] = useState(5);
  const [vecSmoothness, setVecSmoothness] = useState(1); // 0 = nítido, 1 = suave, 2 = ultra limpio
  const [vecIgnoreTransparent, setVecIgnoreTransparent] = useState(true);
  const [vecLayers, setVecLayers] = useState([]); // [{ hex, originalHex, visible, count, percentage }]
  const [vecSvgString, setVecSvgString] = useState('');
  const [vecRegMarks, setVecRegMarks] = useState(false);
  const vecDataRef = useRef(null); // Guarda { labelMap, width, height }

  // --------------------------------------------------------------------------
  // 4. ESTADO: ESCALAR, DPI Y ESPEJO (SUBLIMACIÓN / DTF)
  // --------------------------------------------------------------------------
  const [printUnit, setPrintUnit] = useState('cm'); // 'cm' | 'in'
  const [printDpi, setPrintDpi] = useState(300);
  const [printWidthCm, setPrintWidthCm] = useState(25);
  const [printHeightCm, setPrintHeightCm] = useState(25);
  const [lockAspect, setLockAspect] = useState(true);
  const [mirrorMode, setMirrorMode] = useState(false); // Espejo para Sublimación/DTF
  const [sharpenFilter, setSharpenFilter] = useState(true);
  const [exportRegMarks, setExportRegMarks] = useState(false);

  // Referencias de Canvas
  const displayCanvasRef = useRef(null);
  const origOverlayCanvasRef = useRef(null); // Para el comparador Antes/Después
  const previewBufferRef = useRef(null); // Imagen procesada en tiempo real antes de "Aplicar"

  // Mostrar mensaje flotante temporal
  const showToast = useCallback((msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => {
      setNotification(prev => (prev?.msg === msg ? null : prev));
    }, 3400);
  }, []);

  // Guardar estado en el historial
  const pushToHistory = useCallback((imageData, label = 'Edición') => {
    setHistory(prev => {
      const sliced = prev.slice(0, historyIndex + 1);
      const clone = new ImageData(
        new Uint8ClampedArray(imageData.data),
        imageData.width,
        imageData.height
      );
      const next = [...sliced, { imageData: clone, label }];
      setHistoryIndex(next.length - 1);
      return next;
    });
    setImageSize({ width: imageData.width, height: imageData.height });
  }, [historyIndex]);

  // Cargar imagen de ejemplo al iniciar
  const loadSamplePreset = useCallback((type, title) => {
    const sampleCanvas = generateSampleArtwork(type);
    const ctx = sampleCanvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height);

    // Detectar automáticamente el color de la esquina superior izquierda para Quitar Fondo
    const r = imgData.data[0];
    const g = imgData.data[1];
    const b = imgData.data[2];
    setBgTargetColor(rgbToHex(r, g, b));

    const clone = new ImageData(new Uint8ClampedArray(imgData.data), imgData.width, imgData.height);
    setHistory([{ imageData: clone, label: `Original: ${title}` }]);
    setHistoryIndex(0);
    setImageSize({ width: imgData.width, height: imgData.height });
    setActivePresetName(title);
    setPrintWidthCm(25);
    setPrintHeightCm(25);

    if (type === 'tiger') setBgPreviewMode('shirt-black');
    else if (type === 'sunset') setBgPreviewMode('checker');
    else setBgPreviewMode('shirt-gray');

    showToast(`Diseño "${title}" cargado correctamente`);
  }, [showToast]);

  useEffect(() => {
    loadSamplePreset('tiger', 'Tigre Retro DTF');
  }, []);

  // Imagen base actual desde el historial
  const currentBaseImageData = history[historyIndex]?.imageData || null;
  const originalFirstImageData = history[0]?.imageData || null;

  // Subida de archivos por el usuario
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        // Limitar lado máximo de trabajo en memoria a 1200px para fluidez en tiempo real
        const maxDim = 1100;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const imgData = ctx.getImageData(0, 0, w, h);

        // Detectar color de esquina si es opaco
        if (imgData.data[3] > 200) {
          setBgTargetColor(rgbToHex(imgData.data[0], imgData.data[1], imgData.data[2]));
        }

        setHistory([{ imageData: imgData, label: file.name }]);
        setHistoryIndex(0);
        setImageSize({ width: w, height: h });
        setActivePresetName(file.name);
        const ratio = h / w;
        setPrintWidthCm(25);
        setPrintHeightCm(Number((25 * ratio).toFixed(1)));
        showToast(`Imagen "${file.name}" cargada (${w}x${h} px)`);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };

  // ==========================================================================
  // MOTOR 1: ALGORITMO DE QUITAR FONDO (FLOOD FILL / KNOCKOUT + CHOKE DTF)
  // ==========================================================================
  const computeBackgroundRemoval = useCallback((baseData) => {
    if (!baseData) return null;
    const w = baseData.width;
    const h = baseData.height;
    const src = baseData.data;
    const out = new ImageData(new Uint8ClampedArray(src), w, h);
    const dst = out.data;

    const target = hexToRgb(bgTargetColor);
    const maxDist = (bgTolerance / 100) * 441.67; // 441.67 es la distancia máxima en RGB
    const featherDist = (bgFeather / 100) * 441.67;

    const colorDistance = (idx) => {
      const dr = src[idx] - target.r;
      const dg = src[idx + 1] - target.g;
      const db = src[idx + 2] - target.b;
      return Math.sqrt(dr * dr + dg * dg + db * db);
    };

    if (bgContiguous) {
      // Flood Fill inteligente desde los 4 bordes exteriores del lienzo
      const visited = new Uint8Array(w * h);
      const queue = new Int32Array(w * h);
      let head = 0;
      let tail = 0;

      const tryEnqueue = (x, y) => {
        const p = y * w + x;
        if (visited[p]) return;
        const dist = colorDistance(p * 4);
        if (dist <= maxDist + featherDist) {
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
        const dist = colorDistance(idx);

        if (dist <= maxDist) {
          dst[idx + 3] = 0;
        } else if (featherDist > 0 && dist <= maxDist + featherDist) {
          const factor = (dist - maxDist) / featherDist;
          dst[idx + 3] = Math.min(dst[idx + 3], Math.round(src[idx + 3] * factor));
        }

        // Expandir solo si está dentro del umbral principal
        if (dist <= maxDist) {
          const x = p % w;
          const y = (p / w) | 0;
          if (x > 0) tryEnqueue(x - 1, y);
          if (x < w - 1) tryEnqueue(x + 1, y);
          if (y > 0) tryEnqueue(x, y - 1);
          if (y < h - 1) tryEnqueue(x, y + 1);
        }
      }
    } else {
      // Knockout Global en toda la imagen (Ideal para eliminar el negro o blanco interno en DTF)
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

    // Contracción de bordes (Choke) para evitar halos blancos en impresión DTF
    if (bgChoke > 0) {
      let currentAlpha = new Uint8ClampedArray(w * h);
      for (let p = 0; p < w * h; p++) currentAlpha[p] = dst[p * 4 + 3];

      for (let step = 0; step < bgChoke; step++) {
        const nextAlpha = new Uint8ClampedArray(currentAlpha);
        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            const p = y * w + x;
            if (currentAlpha[p] === 0) continue;
            const minNeighbor = Math.min(
              currentAlpha[p - 1],
              currentAlpha[p + 1],
              currentAlpha[p - w],
              currentAlpha[p + w]
            );
            if (minNeighbor < currentAlpha[p]) {
              nextAlpha[p] = Math.round((currentAlpha[p] + minNeighbor) * 0.35);
            }
          }
        }
        currentAlpha = nextAlpha;
      }

      for (let p = 0; p < w * h; p++) {
        dst[p * 4 + 3] = currentAlpha[p];
      }
    }

    return out;
  }, [bgTargetColor, bgTolerance, bgFeather, bgChoke, bgContiguous]);

  // ==========================================================================
  // MOTOR 2: GENERADOR DE SEMITONOS (HALFTONE DTF, SERIGRAFÍA Y CMYK)
  // ==========================================================================
  const computeHalftone = useCallback((baseData) => {
    if (!baseData) return null;
    const w = baseData.width;
    const h = baseData.height;
    const src = baseData.data;
    const out = new ImageData(w, h);
    const dst = out.data;

    const cellSize = Math.max(4, htDotSize);
    const rad = (htAngle * Math.PI) / 180;
    const cosA = Math.cos(rad);
    const sinA = Math.sin(rad);
    const contrastFactor = (259 * (htContrast + 255)) / (255 * (259 - htContrast));

    // Función matemática de forma de trama (Spot Function)
    const evaluateSpot = (u, v, radiusRatio) => {
      // u, v están normalizados entre -1 y 1 dentro de la celda de semitono
      if (htShape === 'circle') {
        const dist = Math.sqrt(u * u + v * v);
        return dist <= radiusRatio * 1.35;
      } else if (htShape === 'diamond') {
        const dist = Math.abs(u) + Math.abs(v);
        return dist <= radiusRatio * 1.65;
      } else if (htShape === 'line') {
        return Math.abs(v) <= radiusRatio;
      } else {
        // Cruz serigráfica
        return Math.abs(u) <= radiusRatio * 0.65 || Math.abs(v) <= radiusRatio * 0.65;
      }
    };

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const alpha = src[idx + 3];
        if (alpha < 15) continue;

        let r = src[idx];
        let g = src[idx + 1];
        let b = src[idx + 2];

        // Aplicar ajuste de contraste
        r = Math.max(0, Math.min(255, contrastFactor * (r - 128) + 128));
        g = Math.max(0, Math.min(255, contrastFactor * (g - 128) + 128));
        b = Math.max(0, Math.min(255, contrastFactor * (b - 128) + 128));

        const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255; // 0 (negro) a 1 (blanco)

        // Coordenadas rotadas en la rejilla de semitono
        const rx = x * cosA - y * sinA;
        const ry = x * sinA + y * cosA;
        const cellU = (((rx % cellSize) + cellSize) % cellSize) / cellSize * 2 - 1;
        const cellV = (((ry % cellSize) + cellSize) % cellSize) / cellSize * 2 - 1;

        if (htMode === 'dtf-knockout') {
          // MODO KNOCKOUT DE SOMBRA DTF:
          // Las zonas claras/vivas se mantienen intactas o con punto sólido;
          // las sombras oscuras y degradados se convierten en puntos de semitono transparentes
          // para usar el color de la camiseta negra como sombra y ahorrar tinta DTF.
          const cutoff = (htThreshold / 100);
          const effectiveLum = htInvert ? 1 - lum : lum;
          const alphaNorm = alpha / 255;
          const combined = effectiveLum * alphaNorm;

          if (combined > cutoff + 0.35) {
            // Color vivo sólido
            dst[idx] = src[idx];
            dst[idx + 1] = src[idx + 1];
            dst[idx + 2] = src[idx + 2];
            dst[idx + 3] = 255;
          } else {
            // Zona de transición a sombra -> Semitono transparente
            const dotCoverage = Math.max(0, Math.min(1, combined / (cutoff + 0.35)));
            if (evaluateSpot(cellU, cellV, dotCoverage)) {
              dst[idx] = src[idx];
              dst[idx + 1] = src[idx + 1];
              dst[idx + 2] = src[idx + 2];
              dst[idx + 3] = 255;
            } else {
              dst[idx + 3] = 0; // El color de la prenda respira aquí
            }
          }
        } else if (htMode === 'mono') {
          // MODO FOTOLITO MONOCROMO PARA SERIGRAFÍA
          const darkness = htInvert ? lum : 1 - lum;
          const isInk = evaluateSpot(cellU, cellV, darkness * (alpha / 255));
          if (isInk) {
            dst[idx] = 15;
            dst[idx + 1] = 15;
            dst[idx + 2] = 18;
            dst[idx + 3] = 255;
          } else {
            dst[idx + 3] = 0;
          }
        } else {
          // MODO CMYK COLOR HALFTONE (Ángulos separados C:15°, M:75°, Y:0°, K:45°)
          const rn = r / 255;
          const gn = g / 255;
          const bn = b / 255;
          const k = 1 - Math.max(rn, gn, bn);
          const c = k < 1 ? (1 - rn - k) / (1 - k) : 0;
          const m = k < 1 ? (1 - gn - k) / (1 - k) : 0;
          const yVal = k < 1 ? (1 - bn - k) / (1 - k) : 0;

          const checkChannel = (val, deg) => {
            const a = (deg * Math.PI) / 180;
            const crx = x * Math.cos(a) - y * Math.sin(a);
            const cry = x * Math.sin(a) + y * Math.cos(a);
            const cu = (((crx % cellSize) + cellSize) % cellSize) / cellSize * 2 - 1;
            const cv = (((cry % cellSize) + cellSize) % cellSize) / cellSize * 2 - 1;
            return evaluateSpot(cu, cv, val);
          };

          const cOn = checkChannel(c, 15);
          const mOn = checkChannel(m, 75);
          const yOn = checkChannel(yVal, 0);
          const kOn = checkChannel(k, 45);

          if (!cOn && !mOn && !yOn && !kOn) {
            dst[idx] = 255;
            dst[idx + 1] = 255;
            dst[idx + 2] = 255;
            dst[idx + 3] = htInvert ? 0 : 255;
          } else {
            dst[idx] = kOn ? 20 : cOn ? 0 : 255;
            dst[idx + 1] = kOn ? 20 : mOn ? 0 : 255;
            dst[idx + 2] = kOn ? 20 : yOn ? 0 : 255;
            dst[idx + 3] = 255;
          }
        }
      }
    }
    return out;
  }, [htMode, htDotSize, htAngle, htShape, htContrast, htThreshold, htInvert]);

  // ==========================================================================
  // MOTOR 3: VECTORIZADOR Y SEPARACIÓN DE COLORES PLANOS (K-MEANS + SVG)
  // ==========================================================================
  const runVectorization = useCallback((baseData, customPalette = null) => {
    if (!baseData) return null;

    // Reducimos a una rejilla de vectorización limpia (~360px) para obtener bordes definidos y SVG ligero
    const maxVecDim = 360;
    const scale = Math.min(1, maxVecDim / Math.max(baseData.width, baseData.height));
    const vw = Math.max(16, Math.round(baseData.width * scale));
    const vh = Math.max(16, Math.round(baseData.height * scale));

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = vw;
    tempCanvas.height = vh;
    const tCtx = tempCanvas.getContext('2d');

    const origCanvas = document.createElement('canvas');
    origCanvas.width = baseData.width;
    origCanvas.height = baseData.height;
    origCanvas.getContext('2d').putImageData(baseData, 0, 0);
    tCtx.drawImage(origCanvas, 0, 0, vw, vh);

    const smallData = tCtx.getImageData(0, 0, vw, vh).data;
    const k = vecNumColors;

    // Inicializar centroides de color con muestras distribuidas de píxeles opacos
    let centroids = [];
    if (customPalette && customPalette.length === k) {
      centroids = customPalette.map(layer => {
        const rgb = hexToRgb(layer.hex);
        return [rgb.r, rgb.g, rgb.b];
      });
    } else {
      const opaqueSamples = [];
      for (let i = 0; i < smallData.length; i += 16) {
        if (smallData[i + 3] > 128) {
          opaqueSamples.push([smallData[i], smallData[i + 1], smallData[i + 2]]);
        }
      }
      if (opaqueSamples.length === 0) opaqueSamples.push([0, 0, 0]);
      for (let c = 0; c < k; c++) {
        const pick = opaqueSamples[Math.floor((c / k) * opaqueSamples.length)];
        centroids.push([...pick]);
      }

      // 6 iteraciones rápidas de K-Means para encontrar los colores dominantes exactos
      for (let iter = 0; iter < 6; iter++) {
        const sums = Array.from({ length: k }, () => [0, 0, 0, 0]);
        for (let i = 0; i < smallData.length; i += 8) {
          if (smallData[i + 3] <= 128) continue;
          const r = smallData[i], g = smallData[i + 1], b = smallData[i + 2];
          let bestIdx = 0;
          let bestDist = Infinity;
          for (let c = 0; c < k; c++) {
            const dr = r - centroids[c][0];
            const dg = g - centroids[c][1];
            const db = b - centroids[c][2];
            const d = dr * dr + dg * dg + db * db;
            if (d < bestDist) {
              bestDist = d;
              bestIdx = c;
            }
          }
          sums[bestIdx][0] += r;
          sums[bestIdx][1] += g;
          sums[bestIdx][2] += b;
          sums[bestIdx][3] += 1;
        }
        for (let c = 0; c < k; c++) {
          if (sums[c][3] > 0) {
            centroids[c][0] = Math.round(sums[c][0] / sums[c][3]);
            centroids[c][1] = Math.round(sums[c][1] / sums[c][3]);
            centroids[c][2] = Math.round(sums[c][2] / sums[c][3]);
          }
        }
      }
    }

    // Asignar cada píxel a su capa de color plano
    let labelMap = new Int16Array(vw * vh).fill(-1);
    for (let p = 0; p < vw * vh; p++) {
      const idx = p * 4;
      if (vecIgnoreTransparent && smallData[idx + 3] <= 128) {
        labelMap[p] = -1;
        continue;
      }
      const r = smallData[idx], g = smallData[idx + 1], b = smallData[idx + 2];
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let c = 0; c < k; c++) {
        const dr = r - centroids[c][0];
        const dg = g - centroids[c][1];
        const db = b - centroids[c][2];
        const d = dr * dr + dg * dg + db * db;
        if (d < bestDist) {
          bestDist = d;
          bestIdx = c;
        }
      }
      labelMap[p] = bestIdx;
    }

    // Filtro de suavizado de motas (Majority Vote Filter) para bordes limpios de serigrafía
    for (let pass = 0; pass < vecSmoothness; pass++) {
      const smoothed = new Int16Array(labelMap);
      for (let y = 1; y < vh - 1; y++) {
        for (let x = 1; x < vw - 1; x++) {
          const p = y * vw + x;
          const counts = {};
          let maxCount = 0;
          let winner = labelMap[p];
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const lbl = labelMap[(y + dy) * vw + (x + dx)];
              counts[lbl] = (counts[lbl] || 0) + 1;
              if (counts[lbl] > maxCount) {
                maxCount = counts[lbl];
                winner = lbl;
              }
            }
          }
          smoothed[p] = winner;
        }
      }
      labelMap = smoothed;
    }

    // Contabilizar cobertura de cada tinta
    const counts = new Array(k).fill(0);
    let totalOpaque = 0;
    for (let p = 0; p < vw * vh; p++) {
      if (labelMap[p] >= 0) {
        counts[labelMap[p]]++;
        totalOpaque++;
      }
    }

    const updatedLayers = centroids.map((c, idx) => ({
      hex: customPalette?.[idx]?.hex || rgbToHex(c[0], c[1], c[2]),
      visible: customPalette?.[idx]?.visible ?? true,
      count: counts[idx],
      percentage: totalOpaque > 0 ? Math.round((counts[idx] / totalOpaque) * 100) : 0
    }));

    vecDataRef.current = { labelMap, width: vw, height: vh };
    setVecLayers(updatedLayers);

    const svgStr = buildOptimizedSVG(labelMap, vw, vh, updatedLayers, vecRegMarks);
    setVecSvgString(svgStr);
  }, [vecNumColors, vecSmoothness, vecIgnoreTransparent, vecRegMarks]);

  // Renderizar las capas vectorizadas de vuelta al tamaño de imagen actual
  const renderVectorPreviewToImageData = useCallback((baseData, layers) => {
    if (!baseData || !vecDataRef.current) return baseData;
    const { labelMap, width: vw, height: vh } = vecDataRef.current;
    const w = baseData.width;
    const h = baseData.height;
    const out = new ImageData(w, h);
    const dst = out.data;

    const rgbLayers = layers.map(l => ({ ...hexToRgb(l.hex), visible: l.visible }));

    for (let y = 0; y < h; y++) {
      const sy = Math.min(vh - 1, Math.floor((y / h) * vh));
      for (let x = 0; x < w; x++) {
        const sx = Math.min(vw - 1, Math.floor((x / w) * vw));
        const lbl = labelMap[sy * vw + sx];
        if (lbl >= 0 && rgbLayers[lbl]?.visible) {
          const idx = (y * w + x) * 4;
          dst[idx] = rgbLayers[lbl].r;
          dst[idx + 1] = rgbLayers[lbl].g;
          dst[idx + 2] = rgbLayers[lbl].b;
          dst[idx + 3] = 255;
        }
      }
    }
    return out;
  }, []);

  // Re-calcular vectorización cuando se entra en la pestaña o cambian sus controles
  useEffect(() => {
    if (activeTab === 'vector' && currentBaseImageData) {
      runVectorization(currentBaseImageData);
    }
  }, [activeTab, vecNumColors, vecSmoothness, vecIgnoreTransparent, vecRegMarks, currentBaseImageData, runVectorization]);

  // ==========================================================================
  // RENDERIZADO DEL LIENZO EN TIEMPO REAL
  // ==========================================================================
  useEffect(() => {
    if (!currentBaseImageData || !displayCanvasRef.current) return;

    let previewData = currentBaseImageData;
    if (activeTab === 'bg' && bgInteractionMode === 'picker') {
      previewData = computeBackgroundRemoval(currentBaseImageData);
    } else if (activeTab === 'halftone') {
      previewData = computeHalftone(currentBaseImageData);
    } else if (activeTab === 'vector' && vecLayers.length > 0) {
      previewData = renderVectorPreviewToImageData(currentBaseImageData, vecLayers);
    }

    previewBufferRef.current = previewData;

    const canvas = displayCanvasRef.current;
    canvas.width = previewData.width;
    canvas.height = previewData.height;
    const ctx = canvas.getContext('2d');

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Aplicar Espejo si está activo
    if (mirrorMode) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    const temp = document.createElement('canvas');
    temp.width = previewData.width;
    temp.height = previewData.height;
    temp.getContext('2d').putImageData(previewData, 0, 0);
    ctx.drawImage(temp, 0, 0);
    ctx.restore();

    // Si están activadas las marcas de registro en Vector o Exportar
    if ((activeTab === 'vector' && vecRegMarks) || (activeTab === 'export' && exportRegMarks)) {
      drawRegistrationMarksOnCanvas(
        ctx,
        canvas.width,
        canvas.height,
        bgPreviewMode === 'shirt-black' ? '#22d3ee' : '#09090b'
      );
    }

    // Lienzo de superposición "Original" para el modo Comparar Antes/Después
    if (compareSplit && origOverlayCanvasRef.current && originalFirstImageData) {
      const oCanvas = origOverlayCanvasRef.current;
      oCanvas.width = originalFirstImageData.width;
      oCanvas.height = originalFirstImageData.height;
      oCanvas.getContext('2d').putImageData(originalFirstImageData, 0, 0);
    }
  }, [
    currentBaseImageData,
    originalFirstImageData,
    activeTab,
    bgInteractionMode,
    computeBackgroundRemoval,
    computeHalftone,
    renderVectorPreviewToImageData,
    vecLayers,
    vecRegMarks,
    exportRegMarks,
    mirrorMode,
    compareSplit,
    bgPreviewMode
  ]);

  // ==========================================================================
  // INTERACCIÓN SOBRE EL LIENZO (CUENTAGOTAS Y PINCEL BORRADOR/RESTAURADOR)
  // ==========================================================================
  const getCanvasCoords = (e) => {
    const canvas = displayCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = Math.floor(((clientX - rect.left) / rect.width) * canvas.width);
    const y = Math.floor(((clientY - rect.top) / rect.height) * canvas.height);
    return { x, y };
  };

  const applyManualBrushAt = (x, y) => {
    if (!currentBaseImageData || !originalFirstImageData) return;
    const w = currentBaseImageData.width;
    const h = currentBaseImageData.height;
    const data = currentBaseImageData.data;
    const orig = originalFirstImageData.data;
    const r = brushSize;

    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r * r) {
          const px = x + dx;
          const py = y + dy;
          if (px >= 0 && px < w && py >= 0 && py < h) {
            const idx = (py * w + px) * 4;
            if (bgInteractionMode === 'eraser') {
              data[idx + 3] = 0;
            } else if (bgInteractionMode === 'restore' && orig.length === data.length) {
              data[idx] = orig[idx];
              data[idx + 1] = orig[idx + 1];
              data[idx + 2] = orig[idx + 2];
              data[idx + 3] = orig[idx + 3];
            }
          }
        }
      }
    }

    const canvas = displayCanvasRef.current;
    if (canvas) {
      canvas.getContext('2d').putImageData(currentBaseImageData, 0, 0);
    }
  };

  const handleCanvasPointerDown = (e) => {
    if (activeTab !== 'bg' || !currentBaseImageData) return;
    const coords = getCanvasCoords(e);
    if (!coords) return;

    if (bgInteractionMode === 'picker') {
      const { x, y } = coords;
      if (x >= 0 && x < currentBaseImageData.width && y >= 0 && y < currentBaseImageData.height) {
        const idx = (y * currentBaseImageData.width + x) * 4;
        const hex = rgbToHex(
          currentBaseImageData.data[idx],
          currentBaseImageData.data[idx + 1],
          currentBaseImageData.data[idx + 2]
        );
        setBgTargetColor(hex);
        showToast(`Color de fondo seleccionado: ${hex.toUpperCase()}`);
      }
    } else {
      isDrawingBrushRef.current = true;
      applyManualBrushAt(coords.x, coords.y);
    }
  };

  const handleCanvasPointerMove = (e) => {
    if (!isDrawingBrushRef.current || activeTab !== 'bg') return;
    const coords = getCanvasCoords(e);
    if (coords) applyManualBrushAt(coords.x, coords.y);
  };

  const handleCanvasPointerUp = () => {
    if (isDrawingBrushRef.current && currentBaseImageData) {
      isDrawingBrushRef.current = false;
      pushToHistory(currentBaseImageData, bgInteractionMode === 'eraser' ? 'Borrador manual' : 'Restaurar manual');
    }
  };

  // ==========================================================================
  // APLICAR CAMBIOS DE CADA HERRAMIENTA AL HISTORIAL
  // ==========================================================================
  const applyCurrentToolChanges = (label) => {
    if (!previewBufferRef.current) return;
    pushToHistory(previewBufferRef.current, label);
    showToast(`¡${label} aplicado al diseño! Puedes seguir editando en otros pasos.`);
  };

  // ==========================================================================
  // EXPORTACIÓN PROFESIONAL (PNG 300 DPI, SVG VECTORIAL, SEPARACIONES)
  // ==========================================================================
  const downloadHighResPNG = () => {
    const sourceData = previewBufferRef.current || currentBaseImageData;
    if (!sourceData) return;

    // Calcular dimensiones físicas reales según centímetros y DPI seleccionados
    const inchesW = printUnit === 'cm' ? printWidthCm / 2.54 : printWidthCm;
    const inchesH = printUnit === 'cm' ? printHeightCm / 2.54 : printHeightCm;
    // Limitamos el canvas de exportación a máx 4500px para máxima compatibilidad de memoria en navegadores
    const targetPxW = Math.min(4500, Math.max(400, Math.round(inchesW * printDpi)));
    const targetPxH = Math.min(4500, Math.max(400, Math.round(inchesH * printDpi)));

    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = sourceData.width;
    srcCanvas.height = sourceData.height;
    srcCanvas.getContext('2d').putImageData(sourceData, 0, 0);

    const outCanvas = document.createElement('canvas');
    outCanvas.width = targetPxW;
    outCanvas.height = targetPxH;
    const ctx = outCanvas.getContext('2d');

    ctx.imageSmoothingEnabled = sharpenFilter;
    ctx.imageSmoothingQuality = 'high';

    ctx.save();
    if (mirrorMode) {
      ctx.translate(targetPxW, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(srcCanvas, 0, 0, targetPxW, targetPxH);
    ctx.restore();

    if (exportRegMarks) {
      drawRegistrationMarksOnCanvas(ctx, targetPxW, targetPxH, '#000000');
    }

    const link = document.createElement('a');
    const cleanName = activePresetName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    link.download = `${cleanName}_${printWidthCm}${printUnit}_${printDpi}DPI${mirrorMode ? '_ESPEJO' : ''}.png`;
    link.href = outCanvas.toDataURL('image/png');
    link.click();
    showToast(`PNG exportado a ${targetPxW}x${targetPxH} px (${printDpi} DPI)`);
  };

  const downloadVectorSVG = () => {
    if (!vecDataRef.current) {
      runVectorization(currentBaseImageData);
    }
    const { labelMap, width, height } = vecDataRef.current || {};
    if (!labelMap) return;

    const svgContent = buildOptimizedSVG(labelMap, width, height, vecLayers, vecRegMarks);
    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vector_serigrafia_${vecLayers.length}_colores.svg`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Archivo vectorial .SVG descargado correctamente');
  };

  // Descargar fotolito individual (negro opaco + marcas de registro) de un color para quemar pantalla de serigrafía
  const downloadSingleColorPositive = (layerIndex, hexColor) => {
    if (!vecDataRef.current || !currentBaseImageData) return;
    const { labelMap, width: vw, height: vh } = vecDataRef.current;
    const w = currentBaseImageData.width;
    const h = currentBaseImageData.height;

    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    const imgData = ctx.createImageData(w, h);
    const dst = imgData.data;

    for (let y = 0; y < h; y++) {
      const sy = Math.min(vh - 1, Math.floor((y / h) * vh));
      for (let x = 0; x < w; x++) {
        const sx = Math.min(vw - 1, Math.floor((x / w) * vw));
        if (labelMap[sy * vw + sx] === layerIndex) {
          const idx = (y * w + x) * 4;
          // Fotolito en negro puro al 100% de densidad para insolación serigráfica
          dst[idx] = 0;
          dst[idx + 1] = 0;
          dst[idx + 2] = 0;
          dst[idx + 3] = 255;
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
    drawRegistrationMarksOnCanvas(ctx, w, h, '#000000');

    // Etiqueta técnica de la pantalla en el borde superior
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(`PANTALLA #${layerIndex + 1} - COLOR SPOT: ${hexColor.toUpperCase()}`, 65, 28);

    const link = document.createElement('a');
    link.download = `fotolito_pantalla_${layerIndex + 1}_${hexColor.replace('#', '')}.png`;
    link.href = c.toDataURL('image/png');
    link.click();
    showToast(`Fotolito para Pantalla #${layerIndex + 1} (${hexColor}) descargado con marcas de registro`);
  };

  // Cálculo de dimensiones en píxeles objetivo para la pestaña de Escalado
  const targetPixelsWidth = Math.round(
    (printUnit === 'cm' ? printWidthCm / 2.54 : printWidthCm) * printDpi
  );
  const targetPixelsHeight = Math.round(
    (printUnit === 'cm' ? printHeightCm / 2.54 : printHeightCm) * printDpi
  );

  // Estilo de fondo del área de trabajo (Cuadrícula transparente o Camiseta)
  const getWorkspaceBackgroundStyle = () => {
    if (bgPreviewMode === 'checker') {
      return {
        backgroundImage: `
          linear-gradient(45deg, #27272a 25%, transparent 25%),
          linear-gradient(-45deg, #27272a 25%, transparent 25%),
          linear-gradient(45deg, transparent 75%, #27272a 75%),
          linear-gradient(-45deg, transparent 75%, #27272a 75%)
        `,
        backgroundSize: '24px 24px',
        backgroundPosition: '0 0, 0 12px, 12px -12px, -12px 0',
        backgroundColor: '#18181b'
      };
    }
    const colorMap = {
      'shirt-black': '#0f0f12',
      'shirt-white': '#f8fafc',
      'shirt-gray': '#52525b',
      'shirt-custom': customShirtColor
    };
    return {
      backgroundColor: colorMap[bgPreviewMode] || '#0f0f12',
      backgroundImage:
        'radial-gradient(circle at 50% 35%, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0.28) 100%)'
    };
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans select-none overflow-x-hidden">
      {/* ====================================================================
          BARRA SUPERIOR (HEADER)
      ==================================================================== */}
      <header className="h-16 bg-zinc-900/90 border-b border-zinc-800 px-4 lg:px-6 flex items-center justify-between gap-3 z-20 backdrop-blur-md">
        {/* Marca */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 via-blue-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base lg:text-lg tracking-tight text-white">
                AmazoniaInk <span className="text-cyan-400">Pro</span>
              </h1>
              <span className="hidden sm:inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                DTF • Sublimación • Serigrafía
              </span>
            </div>
            <p className="text-xs text-zinc-400 hidden md:block">
              Laboratorio de preimpresión, semitonos, vectorización y corte de fondos
            </p>
          </div>
        </div>

        {/* Presets rápidos de prueba + Subida de archivo */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="hidden xl:flex items-center gap-1.5 bg-zinc-800/80 p-1 rounded-lg border border-zinc-700/60">
            <span className="text-[11px] text-zinc-400 px-2 font-medium">Ejemplos:</span>
            <button
              onClick={() => loadSamplePreset('tiger', 'Tigre Retro DTF')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                activePresetName === 'Tigre Retro DTF'
                  ? 'bg-cyan-500 text-zinc-950 font-semibold'
                  : 'text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              🐯 Tigre DTF
            </button>
            <button
              onClick={() => loadSamplePreset('sunset', 'Atardecer Retro')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                activePresetName === 'Atardecer Retro'
                  ? 'bg-cyan-500 text-zinc-950 font-semibold'
                  : 'text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              🌅 Atardecer (Fondo Blanco)
            </button>
            <button
              onClick={() => loadSamplePreset('skull', 'Emblema Serigrafía')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                activePresetName === 'Emblema Serigrafía'
                  ? 'bg-cyan-500 text-zinc-950 font-semibold'
                  : 'text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              💀 Skull (Colores Planos)
            </button>
          </div>

          <label className="cursor-pointer bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition">
            <Upload className="w-4 h-4 text-cyan-400" />
            <span>Subir Imagen</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          {/* Undo / Redo */}
          <div className="flex items-center bg-zinc-800/90 rounded-lg border border-zinc-700 p-0.5">
            <button
              onClick={() => setHistoryIndex(i => Math.max(0, i - 1))}
              disabled={historyIndex <= 0}
              title="Deshacer"
              className="p-1.5 rounded-md hover:bg-zinc-700 disabled:opacity-30 transition"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <span className="text-[11px] text-zinc-400 px-2 font-mono">
              {historyIndex + 1}/{history.length}
            </span>
            <button
              onClick={() => setHistoryIndex(i => Math.min(history.length - 1, i + 1))}
              disabled={historyIndex >= history.length - 1}
              title="Rehacer"
              className="p-1.5 rounded-md hover:bg-zinc-700 disabled:opacity-30 transition"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={downloadHighResPNG}
            className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-zinc-950 font-bold px-3.5 py-2 rounded-lg text-xs flex items-center gap-1.5 shadow-lg shadow-cyan-500/20 transition"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Descargar PNG</span>
          </button>
        </div>
      </header>

      {/* Notificación Toast */}
      {notification && (
        <div className="fixed bottom-5 right-5 z-50 bg-zinc-900/95 border border-cyan-500/50 text-zinc-100 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
          <span className="text-xs font-medium">{notification.msg}</span>
        </div>
      )}

      {/* ====================================================================
          CUERPO PRINCIPAL (3 COLUMNAS EN DESKTOP, ADAPTABLE EN MÓVIL)
      ==================================================================== */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* ------------------------------------------------------------------
            1. MENÚ LATERAL IZQUIERDO (MÓDULOS DE TRABAJO)
        ------------------------------------------------------------------ */}
        <aside className="w-full lg:w-64 bg-zinc-900 border-b lg:border-b-0 lg:border-r border-zinc-800 p-3 flex lg:flex-col justify-between gap-2 overflow-x-auto shrink-0">
          <div className="flex lg:flex-col gap-1.5 w-full">
            <div className="hidden lg:block text-[11px] font-bold uppercase tracking-wider text-zinc-500 px-3 py-1.5">
              Flujo de Trabajo
            </div>

            {[
              {
                id: 'bg',
                title: '1. Quitar Fondo',
                subtitle: 'Knockout & Contracción DTF',
                icon: Eraser,
                badge: 'DTF / Serigrafía'
              },
              {
                id: 'halftone',
                title: '2. Semitonos',
                subtitle: 'Tramas DTF y Fotolitos',
                icon: Grid,
                badge: 'Tacto Cero'
              },
              {
                id: 'vector',
                title: '3. Vectorizar / Colores',
                subtitle: 'Separación SVG y Pantallas',
                icon: Layers,
                badge: 'SVG / Spot'
              },
              {
                id: 'scale',
                title: '4. Escalar y Espejo',
                subtitle: 'Medidas en cm, 300 DPI',
                icon: Maximize2,
                badge: 'Sublimación'
              },
              {
                id: 'export',
                title: '5. Centro de Exportación',
                subtitle: 'PNG 300 DPI, SVG y Fotolitos',
                icon: Download,
                badge: 'Listo'
              }
            ].map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition shrink-0 lg:w-full border ${
                    active
                      ? 'bg-gradient-to-r from-cyan-500/20 to-blue-600/10 border-cyan-500/50 text-white shadow-sm'
                      : 'border-transparent text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-200'
                  }`}
                >
                  <div
                    className={`p-2 rounded-lg ${
                      active ? 'bg-cyan-500 text-zinc-950' : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold truncate">{item.title}</div>
                    <div className="text-[11px] text-zinc-400 truncate hidden sm:block">
                      {item.subtitle}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Tarjeta informativa del estado actual del archivo */}
          <div className="hidden lg:flex flex-col gap-2 bg-zinc-950/80 border border-zinc-800/90 rounded-xl p-3 text-xs">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="font-semibold text-zinc-300">Archivo Activo</span>
              <span className="text-[10px] bg-zinc-800 px-2 py-0.5 rounded text-cyan-400 font-mono">
                {imageSize.width}×{imageSize.height}px
              </span>
            </div>
            <div className="text-[11px] text-zinc-400 truncate">{activePresetName}</div>
            <div className="pt-1 border-t border-zinc-800 flex items-center justify-between text-[11px]">
              <span className="text-zinc-400">Salida física:</span>
              <span className="text-emerald-400 font-mono font-semibold">
                {printWidthCm}×{printHeightCm} {printUnit} ({printDpi} DPI)
              </span>
            </div>
            {mirrorMode && (
              <div className="bg-amber-500/15 border border-amber-500/30 text-amber-300 px-2 py-1 rounded text-[11px] flex items-center gap-1.5 font-medium">
                <FlipHorizontal className="w-3.5 h-3.5" />
                Modo Espejo Activado
              </div>
            )}
          </div>
        </aside>

        {/* ------------------------------------------------------------------
            2. LIENZO CENTRAL INTERACTIVO Y SIMULADOR DE CAMISETA
        ------------------------------------------------------------------ */}
        <main className="flex-1 flex flex-col bg-zinc-950 relative overflow-hidden min-h-[420px]">
          {/* Barra flotante superior: Simulador de Prenda y Comparador */}
          <div className="bg-zinc-900/80 border-b border-zinc-800 px-4 py-2 flex flex-wrap items-center justify-between gap-2 z-10">
            {/* Selector de fondo / Prenda */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-zinc-400 flex items-center gap-1 mr-1">
                <Shirt className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">Simular Prenda:</span>
              </span>

              <button
                onClick={() => setBgPreviewMode('checker')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium border transition ${
                  bgPreviewMode === 'checker'
                    ? 'bg-zinc-800 border-cyan-500 text-cyan-300'
                    : 'border-zinc-700 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Transparente
              </button>
              <button
                onClick={() => setBgPreviewMode('shirt-black')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium border flex items-center gap-1.5 transition ${
                  bgPreviewMode === 'shirt-black'
                    ? 'bg-zinc-800 border-cyan-500 text-white'
                    : 'border-zinc-700 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-black border border-zinc-500" />
                Camiseta Negra
              </button>
              <button
                onClick={() => setBgPreviewMode('shirt-white')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium border flex items-center gap-1.5 transition ${
                  bgPreviewMode === 'shirt-white'
                    ? 'bg-zinc-800 border-cyan-500 text-white'
                    : 'border-zinc-700 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-white border border-zinc-400" />
                Blanca
              </button>
              <button
                onClick={() => setBgPreviewMode('shirt-gray')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium border flex items-center gap-1.5 transition ${
                  bgPreviewMode === 'shirt-gray'
                    ? 'bg-zinc-800 border-cyan-500 text-white'
                    : 'border-zinc-700 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-zinc-500" />
                Gris Jaspe
              </button>
              <label className="flex items-center gap-1 px-2 py-0.5 rounded-md border border-zinc-700 bg-zinc-800/60 text-xs cursor-pointer">
                <input
                  type="color"
                  value={customShirtColor}
                  onChange={(e) => {
                    setCustomShirtColor(e.target.value);
                    setBgPreviewMode('shirt-custom');
                  }}
                  className="w-4 h-4 bg-transparent border-0 cursor-pointer"
                />
                <span className="text-[11px] text-zinc-300">Color Textil</span>
              </label>
            </div>

            {/* Controles de Comparación Antes/Después y Zoom */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCompareSplit(!compareSplit)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium border flex items-center gap-1.5 transition ${
                  compareSplit
                    ? 'bg-fuchsia-500/20 border-fuchsia-500 text-fuchsia-300'
                    : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                <SplitSquareVertical className="w-3.5 h-3.5" />
                <span>Antes / Después</span>
              </button>

              <div className="flex items-center bg-zinc-800 rounded-md border border-zinc-700">
                <button
                  onClick={() => setZoom(z => Math.max(0.25, +(z - 0.15).toFixed(2)))}
                  className="p-1.5 hover:bg-zinc-700 text-zinc-300"
                  title="Alejar"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs font-mono px-2 text-zinc-300">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={() => setZoom(z => Math.min(2.2, +(z + 0.15).toFixed(2)))}
                  className="p-1.5 hover:bg-zinc-700 text-zinc-300"
                  title="Acercar"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Área del Lienzo */}
          <div className="flex-1 overflow-auto flex items-center justify-center p-6 relative">
            <div
              className="relative rounded-xl shadow-2xl border border-zinc-700/80 transition-all duration-150 overflow-hidden"
              style={{
                width: `${Math.round(imageSize.width * zoom)}px`,
                height: `${Math.round(imageSize.height * zoom)}px`,
                ...getWorkspaceBackgroundStyle()
              }}
            >
              {/* Etiqueta indicadora de prenda */}
              {bgPreviewMode !== 'checker' && (
                <div className="absolute top-2.5 left-2.5 z-10 bg-black/65 backdrop-blur-sm text-[10px] text-zinc-200 px-2.5 py-1 rounded-full border border-white/15 pointer-events-none flex items-center gap-1.5">
                  <Shirt className="w-3 h-3 text-cyan-400" />
                  <span>Vista previa sobre prenda textil</span>
                </div>
              )}

              {/* Canvas Principal Procesado */}
              <canvas
                ref={displayCanvasRef}
                onMouseDown={handleCanvasPointerDown}
                onMouseMove={handleCanvasPointerMove}
                onMouseUp={handleCanvasPointerUp}
                onMouseLeave={handleCanvasPointerUp}
                onTouchStart={handleCanvasPointerDown}
                onTouchMove={handleCanvasPointerMove}
                onTouchEnd={handleCanvasPointerUp}
                className={`w-full h-full block ${
                  activeTab === 'bg' && bgInteractionMode === 'picker'
                    ? 'cursor-crosshair'
                    : activeTab === 'bg'
                    ? 'cursor-cell'
                    : 'cursor-default'
                }`}
              />

              {/* Superposición para Comparar Antes / Después */}
              {compareSplit && (
                <>
                  <div
                    className="absolute inset-y-0 left-0 overflow-hidden pointer-events-none border-r-2 border-fuchsia-400"
                    style={{ width: `${splitPos}%` }}
                  >
                    <canvas
                      ref={origOverlayCanvasRef}
                      style={{
                        width: `${Math.round(imageSize.width * zoom)}px`,
                        height: `${Math.round(imageSize.height * zoom)}px`
                      }}
                      className="block max-w-none"
                    />
                    <span className="absolute bottom-3 left-3 bg-black/80 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                      ORIGINAL
                    </span>
                  </div>
                  <span className="absolute bottom-3 right-3 bg-cyan-500 text-zinc-950 text-[10px] font-bold px-2 py-0.5 rounded pointer-events-none">
                    PROCESADO
                  </span>
                  <input
                    type="range"
                    min="5"
                    max="95"
                    value={splitPos}
                    onChange={(e) => setSplitPos(Number(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-20"
                  />
                </>
              )}
            </div>
          </div>

          {/* Barra inferior de ayuda contextual */}
          <div className="bg-zinc-900/90 border-t border-zinc-800 px-4 py-2 text-xs text-zinc-400 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              {activeTab === 'bg' && (
                <span>
                  <strong>Consejo DTF:</strong> Haz clic directamente sobre el fondo del lienzo para capturar su color. Usa{' '}
                  <em>Contracción de bordes (Choke)</em> para evitar filos blancos.
                </span>
              )}
              {activeTab === 'halftone' && (
                <span>
                  <strong>Consejo Tacto Cero (Halftone DTF):</strong> El modo <em>Knockout de Sombra</em> convierte los negros y degradados en puntos para que la camiseta negra respire.
                </span>
              )}
              {activeTab === 'vector' && (
                <span>
                  <strong>Consejo Serigrafía:</strong> Separa tu diseño por colores planos, oculta o cambia tintas y descarga los fotolitos individuales con marcas de registro.
                </span>
              )}
              {activeTab === 'scale' && (
                <span>
                  <strong>Consejo Sublimación y DTF:</strong> Activa siempre el <em>Modo Espejo</em> antes de imprimir tus hojas de transferencia.
                </span>
              )}
              {activeTab === 'export' && (
                <span>
                  <strong>Listo para Producción:</strong> Descarga tu arte en PNG transparente de alta resolución (300 DPI) o como trazado vectorial SVG.
                </span>
              )}
            </div>
            <div className="text-[11px] text-zinc-500 font-mono">
              Formato actual: {printWidthCm} × {printHeightCm} {printUnit} @ {printDpi} DPI
            </div>
          </div>
        </main>

        {/* ------------------------------------------------------------------
            3. PANEL LATERAL DERECHO (CONTROLES DE CADA MÓDULO)
        ------------------------------------------------------------------ */}
        <aside className="w-full lg:w-96 bg-zinc-900 border-t lg:border-t-0 lg:border-l border-zinc-800 p-5 overflow-y-auto shrink-0 flex flex-col justify-between gap-6">
          {/* ================================================================
              PANEL 1: QUITAR FONDO Y KNOCKOUT DE COLOR
          ================================================================ */}
          {activeTab === 'bg' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Eraser className="w-4 h-4 text-cyan-400" />
                  Quitar Fondo y Knockout DTF
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Elimina fondos sólidos o haz un vaciado del color negro/blanco para estampación textil.
                </p>
              </div>

              {/* Modo de herramienta sobre el lienzo */}
              <div className="grid grid-cols-3 gap-1.5 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                <button
                  onClick={() => setBgInteractionMode('picker')}
                  className={`py-2 px-2 rounded-lg text-xs font-semibold flex flex-col items-center gap-1 transition ${
                    bgInteractionMode === 'picker'
                      ? 'bg-cyan-500 text-zinc-950'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Crosshair className="w-4 h-4" />
                  <span>Cuentagotas</span>
                </button>
                <button
                  onClick={() => setBgInteractionMode('eraser')}
                  className={`py-2 px-2 rounded-lg text-xs font-semibold flex flex-col items-center gap-1 transition ${
                    bgInteractionMode === 'eraser'
                      ? 'bg-cyan-500 text-zinc-950'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Eraser className="w-4 h-4" />
                  <span>Borrador</span>
                </button>
                <button
                  onClick={() => setBgInteractionMode('restore')}
                  className={`py-2 px-2 rounded-lg text-xs font-semibold flex flex-col items-center gap-1 transition ${
                    bgInteractionMode === 'restore'
                      ? 'bg-cyan-500 text-zinc-950'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Paintbrush className="w-4 h-4" />
                  <span>Restaurar</span>
                </button>
              </div>

              {bgInteractionMode === 'picker' ? (
                <>
                  {/* Color objetivo a eliminar */}
                  <div className="bg-zinc-950/90 border border-zinc-800 rounded-xl p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-300">
                        Color a Eliminar (Clic en lienzo)
                      </span>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={bgTargetColor}
                          onChange={(e) => setBgTargetColor(e.target.value)}
                          className="w-7 h-7 rounded cursor-pointer bg-transparent border-0"
                        />
                        <span className="text-xs font-mono text-cyan-400 uppercase">
                          {bgTargetColor}
                        </span>
                      </div>
                    </div>

                    {/* Botones rápidos de color típico */}
                    <div className="flex items-center gap-1.5 pt-1">
                      <button
                        onClick={() => setBgTargetColor('#ffffff')}
                        className="flex-1 py-1.5 px-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[11px] font-medium text-zinc-200 flex items-center justify-center gap-1.5"
                      >
                        <span className="w-3 h-3 rounded-full bg-white border border-zinc-400" />
                        Fondo Blanco
                      </button>
                      <button
                        onClick={() => setBgTargetColor('#000000')}
                        className="flex-1 py-1.5 px-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[11px] font-medium text-zinc-200 flex items-center justify-center gap-1.5"
                      >
                        <span className="w-3 h-3 rounded-full bg-black border border-zinc-600" />
                        Negro (Knockout)
                      </button>
                    </div>
                  </div>

                  {/* Modo Contiguo vs Global Knockout */}
                  <div className="bg-zinc-950/90 border border-zinc-800 rounded-xl p-3.5 space-y-2">
                    <label className="text-xs font-semibold text-zinc-300 block">
                      Método de Extracción
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setBgContiguous(true)}
                        className={`p-2.5 rounded-lg border text-left transition ${
                          bgContiguous
                            ? 'bg-cyan-500/15 border-cyan-500 text-white'
                            : 'border-zinc-800 text-zinc-400 hover:bg-zinc-800/50'
                        }`}
                      >
                        <div className="text-xs font-bold">Solo Exterior</div>
                        <div className="text-[10px] text-zinc-400 mt-0.5">
                          Protege colores iguales dentro del dibujo
                        </div>
                      </button>
                      <button
                        onClick={() => setBgContiguous(false)}
                        className={`p-2.5 rounded-lg border text-left transition ${
                          !bgContiguous
                            ? 'bg-cyan-500/15 border-cyan-500 text-white'
                            : 'border-zinc-800 text-zinc-400 hover:bg-zinc-800/50'
                        }`}
                      >
                        <div className="text-xs font-bold">Knockout Total</div>
                        <div className="text-[10px] text-zinc-400 mt-0.5">
                          Borra el color en todo el diseño (DTF)
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Deslizadores de Tolerancia, Suavizado y Contracción */}
                  <div className="space-y-4 bg-zinc-950/90 border border-zinc-800 rounded-xl p-3.5">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-zinc-300 font-medium">Tolerancia de Color</span>
                        <span className="text-cyan-400 font-mono">{bgTolerance}%</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="85"
                        value={bgTolerance}
                        onChange={(e) => setBgTolerance(Number(e.target.value))}
                        className="w-full accent-cyan-400"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-zinc-300 font-medium">Suavizado de Bordes (Antialias)</span>
                        <span className="text-cyan-400 font-mono">{bgFeather}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="50"
                        value={bgFeather}
                        onChange={(e) => setBgFeather(Number(e.target.value))}
                        className="w-full accent-cyan-400"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-zinc-300 font-medium">
                          Contracción de Borde (Choke DTF)
                        </span>
                        <span className="text-cyan-400 font-mono">{bgChoke} px</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="4"
                        value={bgChoke}
                        onChange={(e) => setBgChoke(Number(e.target.value))}
                        className="w-full accent-cyan-400"
                      />
                      <p className="text-[11px] text-zinc-500 mt-1">
                        Contrae ligeramente el borde para evitar que asome un halo del fondo al imprimir base blanca en DTF.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => applyCurrentToolChanges('Recorte de Fondo')}
                    className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition"
                  >
                    <Check className="w-4 h-4" />
                    <span>Aplicar Recorte de Fondo al Diseño</span>
                  </button>
                </>
              ) : (
                /* Controles de Pincel Manual */
                <div className="bg-zinc-950/90 border border-zinc-800 rounded-xl p-4 space-y-4">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-300 font-medium">Tamaño del Pincel</span>
                    <span className="text-cyan-400 font-mono">{brushSize} px</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="90"
                    value={brushSize}
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                  <p className="text-xs text-zinc-400">
                    Arrastra el cursor directamente sobre el lienzo para{' '}
                    {bgInteractionMode === 'eraser'
                      ? 'borrar zonas manualmente.'
                      : 'restaurar zonas de la imagen original.'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ================================================================
              PANEL 2: GENERADOR DE SEMITONOS (HALFTONE DTF & SERIGRAFÍA)
          ================================================================ */}
          {activeTab === 'halftone' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Grid className="w-4 h-4 text-cyan-400" />
                  Semitonos (Halftone DTF y Serigrafía)
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Crea tramas transpirables con tacto suave para DTF o fotolitos de alto contraste para insolar pantallas.
                </p>
              </div>

              {/* Selector de Modo de Semitono */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-300 block">
                  Modo de Trama
                </label>
                {[
                  {
                    id: 'dtf-knockout',
                    name: 'Knockout de Sombra DTF (Color + Transparencia)',
                    desc: 'Mantiene los colores vivos y convierte sombras/degradados en puntos para usar el negro de la prenda.'
                  },
                  {
                    id: 'mono',
                    name: 'Fotolito Monocromo (Serigrafía 1 Tinta)',
                    desc: 'Puntos negros de alta densidad al 100% sobre fondo transparente para quemar pantallas.'
                  },
                  {
                    id: 'cmyk',
                    name: 'Cuatricromía CMYK Simulada',
                    desc: 'Trama clásica de revista con ángulos separados (C:15°, M:75°, Y:0°, K:45°).'
                  }
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setHtMode(m.id)}
                    className={`w-full p-3 rounded-xl border text-left transition ${
                      htMode === m.id
                        ? 'bg-cyan-500/15 border-cyan-500 text-white'
                        : 'bg-zinc-950/70 border-zinc-800 text-zinc-400 hover:bg-zinc-800/50'
                    }`}
                  >
                    <div className="text-xs font-bold">{m.name}</div>
                    <div className="text-[11px] text-zinc-400 mt-0.5">{m.desc}</div>
                  </button>
                ))}
              </div>

              {/* Parámetros de Punto, Ángulo y Forma */}
              <div className="bg-zinc-950/90 border border-zinc-800 rounded-xl p-3.5 space-y-4">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-300 font-medium">
                      Tamaño de Punto (Simulación LPI)
                    </span>
                    <span className="text-cyan-400 font-mono">
                      {htDotSize} px (~{Math.round(300 / htDotSize)} LPI)
                    </span>
                  </div>
                  <input
                    type="range"
                    min="4"
                    max="28"
                    value={htDotSize}
                    onChange={(e) => setHtDotSize(Number(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                  <div className="flex justify-between text-[10px] text-zinc-500 mt-0.5">
                    <span>Fino (Alta definición)</span>
                    <span>Grueso (Efecto Vintage)</span>
                  </div>
                </div>

                {/* Ángulo de trama con accesos rápidos serigráficos */}
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-zinc-300 font-medium">Ángulo de Trama</span>
                    <span className="text-cyan-400 font-mono">{htAngle}°</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 mb-2">
                    {[15, 22.5, 45, 75].map((ang) => (
                      <button
                        key={ang}
                        onClick={() => setHtAngle(ang)}
                        className={`py-1 rounded text-xs font-mono border ${
                          htAngle === ang
                            ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-bold'
                            : 'border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                        }`}
                      >
                        {ang}°
                      </button>
                    ))}
                  </div>
                </div>

                {/* Forma geométrica del punto */}
                <div>
                  <label className="text-xs font-medium text-zinc-300 block mb-1.5">
                    Geometría del Punto
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { id: 'circle', label: 'Círculo' },
                      { id: 'diamond', label: 'Diamante' },
                      { id: 'line', label: 'Línea' },
                      { id: 'cross', label: 'Cruz' }
                    ].map((sh) => (
                      <button
                        key={sh.id}
                        onClick={() => setHtShape(sh.id)}
                        className={`py-1.5 rounded-lg text-xs font-medium border ${
                          htShape === sh.id
                            ? 'bg-cyan-500 text-zinc-950 border-cyan-400 font-bold'
                            : 'border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                        }`}
                      >
                        {sh.label}
                      </button>
                    ))}
                  </div>
                </div>

                {htMode === 'dtf-knockout' && (
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-300 font-medium">
                        Profundidad de Knockout en Sombra
                      </span>
                      <span className="text-cyan-400 font-mono">{htThreshold}%</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="90"
                      value={htThreshold}
                      onChange={(e) => setHtThreshold(Number(e.target.value))}
                      className="w-full accent-cyan-400"
                    />
                  </div>
                )}

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-300 font-medium">Contraste de Trama</span>
                    <span className="text-cyan-400 font-mono">{htContrast}</span>
                  </div>
                  <input
                    type="range"
                    min="-50"
                    max="100"
                    value={htContrast}
                    onChange={(e) => setHtContrast(Number(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                </div>

                <label className="flex items-center justify-between pt-1 cursor-pointer">
                  <span className="text-xs text-zinc-300 font-medium">
                    Invertir Trama (Negativo / Prenda Clara)
                  </span>
                  <input
                    type="checkbox"
                    checked={htInvert}
                    onChange={(e) => setHtInvert(e.target.checked)}
                    className="w-4 h-4 accent-cyan-400 rounded"
                  />
                </label>
              </div>

              <button
                onClick={() => applyCurrentToolChanges('Efecto Semitono')}
                className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition"
              >
                <Check className="w-4 h-4" />
                <span>Aplicar Semitono al Diseño</span>
              </button>
            </div>
          )}

          {/* ================================================================
              PANEL 3: VECTORIZAR Y SEPARACIÓN DE COLORES (SERIGRAFÍA / SVG)
          ================================================================ */}
          {activeTab === 'vector' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  Vectorizar y Separación de Colores
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Reduce la imagen a tintas planas para serigrafía, edita cada capa y exporta trazados SVG o fotolitos.
                </p>
              </div>

              <div className="bg-zinc-950/90 border border-zinc-800 rounded-xl p-3.5 space-y-4">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-300 font-medium">
                      Número de Colores (Pantallas)
                    </span>
                    <span className="text-cyan-400 font-mono font-bold">
                      {vecNumColors} tintas
                    </span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="10"
                    value={vecNumColors}
                    onChange={(e) => setVecNumColors(Number(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-300 font-medium">
                      Limpieza de Ruido / Suavizado
                    </span>
                    <span className="text-cyan-400 font-mono">Nivel {vecSmoothness}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="3"
                    value={vecSmoothness}
                    onChange={(e) => setVecSmoothness(Number(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                </div>

                <label className="flex items-center justify-between text-xs text-zinc-300 cursor-pointer">
                  <span>Incluir Marcas de Registro Serigráficas</span>
                  <input
                    type="checkbox"
                    checked={vecRegMarks}
                    onChange={(e) => setVecRegMarks(e.target.checked)}
                    className="w-4 h-4 accent-cyan-400"
                  />
                </label>
              </div>

              {/* Lista interactiva de capas / pantallas de color */}
              <div className="bg-zinc-950/90 border border-zinc-800 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-200">
                    Capas de Tinta Detectadas ({vecLayers.length})
                  </span>
                  <span className="text-[10px] text-zinc-400">
                    Clic en color para editarlo
                  </span>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {vecLayers.map((layer, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-2 bg-zinc-900 border border-zinc-800 px-2.5 py-2 rounded-lg"
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="color"
                          value={layer.hex}
                          onChange={(e) => {
                            const updated = [...vecLayers];
                            updated[idx] = { ...updated[idx], hex: e.target.value };
                            setVecLayers(updated);
                          }}
                          className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                        />
                        <div>
                          <div className="text-xs font-mono font-bold text-zinc-200 uppercase">
                            Pantalla #{idx + 1} • {layer.hex}
                          </div>
                          <div className="text-[10px] text-zinc-400">
                            Cobertura: {layer.percentage}% del área
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            const updated = [...vecLayers];
                            updated[idx] = { ...updated[idx], visible: !updated[idx].visible };
                            setVecLayers(updated);
                          }}
                          title={layer.visible ? 'Ocultar capa' : 'Mostrar capa'}
                          className={`p-1.5 rounded-md border text-xs transition ${
                            layer.visible
                              ? 'bg-zinc-800 border-zinc-700 text-cyan-400'
                              : 'bg-zinc-950 border-zinc-800 text-zinc-600'
                          }`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => downloadSingleColorPositive(idx, layer.hex)}
                          title="Descargar fotolito negro para quemar esta pantalla"
                          className="px-2 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-[10px] font-semibold text-zinc-200 border border-zinc-700"
                        >
                          Fotolito
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => applyCurrentToolChanges('Posterizado Vectorial')}
                  className="py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 border border-zinc-700 transition"
                >
                  <Check className="w-4 h-4 text-cyan-400" />
                  <span>Fijar en Lienzo</span>
                </button>
                <button
                  onClick={downloadVectorSVG}
                  className="py-2.5 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-500/20 transition"
                >
                  <FileCode className="w-4 h-4" />
                  <span>Descargar .SVG</span>
                </button>
              </div>
            </div>
          )}

          {/* ================================================================
              PANEL 4: ESCALAR, RESOLUCIÓN DPI Y MODO ESPEJO
          ================================================================ */}
          {activeTab === 'scale' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Maximize2 className="w-4 h-4 text-cyan-400" />
                  Tamaño de Impresión, DPI y Espejo
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Configura las medidas físicas exactas en centímetros o pulgadas a 300 DPI para tu plóter DTF o impresora de sublimación.
                </p>
              </div>

              {/* Formatos Estándar Rápidos */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-300 block">
                  Formatos Textiles y Hojas Estándar
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { name: 'Logo Pecho Izq.', w: 10, h: 10 },
                    { name: 'Frente Estándar A4', w: 21, h: 29.7 },
                    { name: 'Espalda Grande A3', w: 29.7, h: 42 },
                    { name: 'Full Print A3+', w: 32, h: 48 },
                    { name: 'Rollo DTF 30 cm', w: 28, h: 35 },
                    { name: 'Rollo DTF 60 cm', w: 56, h: 40 }
                  ].map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => {
                        setPrintUnit('cm');
                        setPrintWidthCm(preset.w);
                        setPrintHeightCm(preset.h);
                      }}
                      className="p-2 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-left transition"
                    >
                      <div className="text-xs font-bold text-zinc-200">{preset.name}</div>
                      <div className="text-[10px] text-cyan-400 font-mono">
                        {preset.w} × {preset.h} cm
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Calculadora física de Dimensiones y DPI */}
              <div className="bg-zinc-950/90 border border-zinc-800 rounded-xl p-3.5 space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-300">Unidad de Medida</span>
                  <div className="flex bg-zinc-900 p-0.5 rounded-lg border border-zinc-800">
                    <button
                      onClick={() => setPrintUnit('cm')}
                      className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                        printUnit === 'cm' ? 'bg-cyan-500 text-zinc-950' : 'text-zinc-400'
                      }`}
                    >
                      cm
                    </button>
                    <button
                      onClick={() => setPrintUnit('in')}
                      className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                        printUnit === 'in' ? 'bg-cyan-500 text-zinc-950' : 'text-zinc-400'
                      }`}
                    >
                      pulgadas
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-zinc-400 block mb-1">
                      Ancho ({printUnit})
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      max="200"
                      value={printWidthCm}
                      onChange={(e) => {
                        const val = Math.max(1, Number(e.target.value));
                        setPrintWidthCm(val);
                        if (lockAspect) {
                          const ratio = imageSize.height / imageSize.width;
                          setPrintHeightCm(Number((val * ratio).toFixed(1)));
                        }
                      }}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm font-mono text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-zinc-400 block mb-1">
                      Alto ({printUnit})
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      max="200"
                      value={printHeightCm}
                      onChange={(e) => {
                        const val = Math.max(1, Number(e.target.value));
                        setPrintHeightCm(val);
                        if (lockAspect) {
                          const ratio = imageSize.width / imageSize.height;
                          setPrintWidthCm(Number((val * ratio).toFixed(1)));
                        }
                      }}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm font-mono text-white"
                    />
                  </div>
                </div>

                <label className="flex items-center justify-between text-xs text-zinc-300 cursor-pointer">
                  <span>Mantener proporción original</span>
                  <input
                    type="checkbox"
                    checked={lockAspect}
                    onChange={(e) => setLockAspect(e.target.checked)}
                    className="w-4 h-4 accent-cyan-400"
                  />
                </label>

                <div>
                  <label className="text-xs font-medium text-zinc-300 block mb-1.5">
                    Resolución de Salida (PPP / DPI)
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[150, 300, 600].map((dpi) => (
                      <button
                        key={dpi}
                        onClick={() => setPrintDpi(dpi)}
                        className={`py-1.5 rounded-lg text-xs font-mono border ${
                          printDpi === dpi
                            ? 'bg-cyan-500 text-zinc-950 font-bold border-cyan-400'
                            : 'border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                        }`}
                      >
                        {dpi} DPI
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-zinc-900/90 border border-zinc-800 rounded-lg p-2.5 text-xs flex items-center justify-between">
                  <span className="text-zinc-400">Resolución final en píxeles:</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {targetPixelsWidth} × {targetPixelsHeight} px
                  </span>
                </div>
              </div>

              {/* Modo Espejo para Sublimación y DTF */}
              <div className="bg-zinc-950/90 border border-zinc-800 rounded-xl p-3.5 space-y-3">
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-2.5">
                    <FlipHorizontal className="w-4 h-4 text-amber-400" />
                    <div>
                      <div className="text-xs font-bold text-white">
                        Voltear en Modo Espejo
                      </div>
                      <div className="text-[11px] text-zinc-400">
                        Indispensable para Sublimación y film DTF
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={mirrorMode}
                    onChange={(e) => setMirrorMode(e.target.checked)}
                    className="w-4 h-4 accent-amber-400"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-zinc-800">
                  <div>
                    <div className="text-xs font-bold text-white">
                      Suavizado Bicúbico de Alta Nitidez
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      Evita bordes pixelados al ampliar el diseño
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={sharpenFilter}
                    onChange={(e) => setSharpenFilter(e.target.checked)}
                    className="w-4 h-4 accent-cyan-400"
                  />
                </label>
              </div>
            </div>
          )}

          {/* ================================================================
              PANEL 5: CENTRO DE EXPORTACIÓN
          ================================================================ */}
          {activeTab === 'export' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Download className="w-4 h-4 text-cyan-400" />
                  Centro de Exportación para Producción
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Descarga tus archivos finales listos para RIP de impresión DTF, impresora de sublimación o filmadora de fotolitos.
                </p>
              </div>

              {/* Resumen de Especificaciones */}
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-2.5 text-xs">
                <div className="font-bold text-zinc-200 border-b border-zinc-800 pb-2">
                  Ficha Técnica de Salida
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Tamaño físico:</span>
                  <span className="font-mono text-white font-semibold">
                    {printWidthCm} × {printHeightCm} {printUnit}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Resolución:</span>
                  <span className="font-mono text-cyan-400 font-semibold">
                    {printDpi} PPP / DPI ({targetPixelsWidth}×{targetPixelsHeight} px)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Orientación:</span>
                  <span className="font-semibold text-amber-300">
                    {mirrorMode ? 'En Espejo (Sublimación / DTF)' : 'Normal (Lectura Directa)'}
                  </span>
                </div>

                <div className="pt-2 border-t border-zinc-800 space-y-2">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-zinc-300">Activar Modo Espejo</span>
                    <input
                      type="checkbox"
                      checked={mirrorMode}
                      onChange={(e) => setMirrorMode(e.target.checked)}
                      className="w-4 h-4 accent-cyan-400"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-zinc-300">Añadir Marcas de Registro (Serigrafía)</span>
                    <input
                      type="checkbox"
                      checked={exportRegMarks}
                      onChange={(e) => setExportRegMarks(e.target.checked)}
                      className="w-4 h-4 accent-cyan-400"
                    />
                  </label>
                </div>
              </div>

              {/* Botones de Descarga Directa */}
              <div className="space-y-2.5">
                <button
                  onClick={downloadHighResPNG}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-zinc-950 font-bold text-xs flex items-center justify-between shadow-lg shadow-cyan-500/20 transition"
                >
                  <div className="flex items-center gap-2.5">
                    <FileImage className="w-5 h-5" />
                    <div className="text-left">
                      <div>Descargar PNG Transparente (300 DPI)</div>
                      <div className="text-[10px] opacity-80 font-medium">
                        Ideal para RIP DTF (Cadlink, AcroRIP), Sublimación y DTG
                      </div>
                    </div>
                  </div>
                  <Download className="w-4 h-4" />
                </button>

                <button
                  onClick={downloadVectorSVG}
                  className="w-full py-3.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs flex items-center justify-between border border-zinc-700 transition"
                >
                  <div className="flex items-center gap-2.5">
                    <FileCode className="w-5 h-5 text-fuchsia-400" />
                    <div className="text-left">
                      <div>Descargar Vector .SVG por Capas</div>
                      <div className="text-[10px] text-zinc-400 font-normal">
                        Ideal para Illustrator, CorelDRAW, Vinilo Textil y Serigrafía
                      </div>
                    </div>
                  </div>
                  <Download className="w-4 h-4 text-zinc-400" />
                </button>
              </div>
            </div>
          )}

          {/* Pie de panel derecho: Guía rápida profesional */}
          <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3.5 text-[11px] text-zinc-400 space-y-1.5">
            <div className="font-bold text-zinc-200 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-cyan-400" />
              <span>Recomendación de Taller</span>
            </div>
            <p className="leading-relaxed">
              Para <strong>DTF sobre camiseta negra</strong>, elimina primero el fondo negro en el paso 1 y aplica un{' '}
              <em>Semitono Knockout DTF</em> de 10px a 22.5° en el paso 2. Obtendrás un estampado transpirable, ligero y que no se cuartea con los lavados.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}