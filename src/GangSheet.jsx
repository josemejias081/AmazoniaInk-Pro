import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignHorizontalJustifyCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Download,
  Eye,
  FlipHorizontal,
  FlipVertical,
  Grid,
  Hand,
  Layers,
  Lock,
  Maximize2,
  MousePointer,
  Move,
  Plus,
  Redo2,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Scissors,
  Sparkles,
  Trash2,
  Undo2,
  Unlock,
  Upload,
  Wand2,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { addPngPhysicalResolutionToBlob, calculateRasterSize } from './utils/printProduction.js';
import { layoutGangSheet } from './utils/gangSheetLayout.js';

const DEFAULT_WIDTH_CM = 58; // Estándar comercial DTF (58-60 cm)
const DEFAULT_DPI = 300;
const CM_TO_PX_BASE = 11.5; // Escala visual base en pantalla (px por cm al 100% zoom)

const COMMERCIAL_ROLL_WIDTHS = [
  { value: 58, label: '58 cm (Estándar Comercial DTF)' },
  { value: 60, label: '60 cm (Bobina Completa 60 cm)' },
  { value: 56, label: '56 cm (Área útil segura en 60 cm)' },
  { value: 30, label: '30 cm (Medio Rollo / A3 DTF)' }
];

const DTF_SIZE_PRESETS = [
  { label: 'Etiqueta (5 cm)', widthCm: 5 },
  { label: 'Manga (7 cm)', widthCm: 7 },
  { label: 'Escudo Pecho (10 cm)', widthCm: 10 },
  { label: 'Frontal A4 (21 cm)', widthCm: 21 },
  { label: 'Espalda Grande (28 cm)', widthCm: 28 }
];

let fallbackIdCounter = 0;
const createId = (prefix = 'dtf') => (
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? `${prefix}-${crypto.randomUUID()}`
    : `${prefix}-${Date.now()}-${++fallbackIdCounter}`
);

const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

const imageDataToCanvas = (imageData) => {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('El navegador no pudo crear el lienzo del diseño.');
  context.putImageData(imageData, 0, 0);
  return canvas;
};

// Recorta automáticamente los píxeles transparentes sobrantes alrededor del diseño (Auto-Trim Alpha)
const trimTransparentImageData = (imageData) => {
  const { width, height, data } = imageData;
  let top = height;
  let left = width;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * width * 4;
    for (let x = 0; x < width; x++) {
      const alpha = data[rowOffset + x * 4 + 3];
      if (alpha > 10) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }

  if (right < left || bottom < top) {
    return imageData; // Completamente transparente
  }

  const trimmedW = Math.max(1, right - left + 1);
  const trimmedH = Math.max(1, bottom - top + 1);
  if (trimmedW === width && trimmedH === height) {
    return imageData;
  }

  const out = new ImageData(trimmedW, trimmedH);
  for (let y = 0; y < trimmedH; y++) {
    const srcStart = ((top + y) * width + left) * 4;
    const dstStart = y * trimmedW * 4;
    out.data.set(data.subarray(srcStart, srcStart + trimmedW * 4), dstStart);
  }
  return out;
};

export const makeGangEntry = (imageData, name, isCurrentDesign = false) => {
  const aspect = imageData.height / Math.max(1, imageData.width);
  const widthCm = 10;
  const heightCm = Number((widthCm * aspect).toFixed(2));
  return {
    id: createId('asset'),
    imageData,
    name,
    widthCm,
    heightCm,
    copies: 1,
    rotation: 0,
    isCurrentDesign
  };
};

// Calcula el DPI efectivo de un objeto colocado en la plancha según sus píxeles reales y su tamaño en cm
const computeItemEffectiveDpi = (item, asset) => {
  if (!asset?.imageData) return 300;
  const rotated = Math.abs(item.rotation || 0) % 180 === 90;
  const unrotatedWidthCm = rotated ? item.height : item.width;
  const unrotatedHeightCm = rotated ? item.width : item.height;
  const dpiX = asset.imageData.width / Math.max(0.1, unrotatedWidthCm / 2.54);
  const dpiY = asset.imageData.height / Math.max(0.1, unrotatedHeightCm / 2.54);
  return Math.round(Math.min(dpiX, dpiY));
};

// Código de color de resolución idéntico a Taker.es / DripApps:
// >= 300: Verde (#22c55e), >= 250: Amarillo (#eab308), >= 200: Rojo (#ef4444), < 200: Negro (#171717)
const getResolutionColorInfo = (dpi) => {
  if (dpi >= 300) return { color: '#22c55e', label: 'Óptima (>= 300 DPI)', badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' };
  if (dpi >= 250) return { color: '#eab308', label: 'Buena (>= 250 DPI)', badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40' };
  if (dpi >= 200) return { color: '#ef4444', label: 'Baja (>= 200 DPI)', badgeClass: 'bg-red-500/20 text-red-300 border-red-500/40' };
  return { color: '#111827', label: 'Deficiente (< 200 DPI)', badgeClass: 'bg-stone-900 text-red-400 border-red-700' };
};

// Empaquetado automático inteligente (Shelf + Best Fit ordenado por altura) para rollos comerciales de 58-60 cm
const autoPackItemsOnRoll = (items, sheetWidthCm, marginCm = 0.5, edgeMarginCm = 0.2) => {
  if (!items.length) return [];

  // Ordenar por altura descendente para optimizar el aprovechamiento del metro DTF (conservar orden estable por índice)
  const indexed = items.map((item, idx) => ({ ...item, _origIdx: idx }));
  indexed.sort((a, b) => b.height - a.height || b.width - a.width || a._origIdx - b._origIdx);

  const usableRight = Math.max(edgeMarginCm + 0.5, sheetWidthCm - edgeMarginCm);
  let cursorX = edgeMarginCm;
  let cursorY = edgeMarginCm;
  let rowHeight = 0;

  const packed = indexed.map((item) => {
    const w = Math.min(item.width, sheetWidthCm - edgeMarginCm * 2);
    const ratio = item.height / Math.max(0.1, item.width);
    const h = w !== item.width ? Number((w * ratio).toFixed(2)) : item.height;

    if (cursorX + w > usableRight + 0.001 && cursorX > edgeMarginCm) {
      cursorX = edgeMarginCm;
      cursorY = Number((cursorY + rowHeight + marginCm).toFixed(2));
      rowHeight = 0;
    }

    const placed = {
      ...item,
      x: Number(cursorX.toFixed(2)),
      y: Number(cursorY.toFixed(2)),
      width: Number(w.toFixed(2)),
      height: Number(h.toFixed(2))
    };
    delete placed._origIdx;

    cursorX = Number((cursorX + w + marginCm).toFixed(2));
    rowHeight = Math.max(rowHeight, h);
    return placed;
  });

  return packed;
};

// Convierte entradas clásicas (entries con copies) en objetos posicionados sobre el lienzo si aún no existen
const buildInitialCanvasItemsFromEntries = (entries, sheetWidthCm, marginCm = 0.5, edgeMarginCm = 0.2) => {
  const rawItems = [];
  entries.forEach((entry) => {
    const aspect = entry.imageData.height / Math.max(1, entry.imageData.width);
    const baseW = clamp(entry.widthCm || 10, 1, Math.max(1, sheetWidthCm - edgeMarginCm * 2));
    const baseH = Number((baseW * aspect).toFixed(2));
    const rotated = Math.abs(entry.rotation || 0) % 180 === 90;
    const width = rotated ? baseH : baseW;
    const height = rotated ? baseW : baseH;
    const count = clamp(entry.copies || 1, 1, 200);
    for (let i = 0; i < count; i++) {
      rawItems.push({
        id: createId('item'),
        assetId: entry.id,
        name: entry.name,
        x: edgeMarginCm,
        y: edgeMarginCm,
        width,
        height,
        rotation: entry.rotation || 0,
        flipX: false,
        flipY: false,
        keepAspect: true
      });
    }
  });
  return autoPackItemsOnRoll(rawItems, sheetWidthCm, marginCm, edgeMarginCm);
};

// Dibuja todos los objetos colocados en un canvas 2D para exportación PNG a tamaño físico real (DPI)
const renderItemsToExportCanvas = (context, items, assetsMap, dpi, exportCutLines = false) => {
  const caches = new Map();
  items.forEach((item) => {
    const asset = assetsMap.get(item.assetId);
    if (asset && !caches.has(asset.id)) {
      caches.set(asset.id, imageDataToCanvas(asset.imageData));
    }
  });

  items.forEach((item) => {
    const asset = assetsMap.get(item.assetId);
    const imgCanvas = asset ? caches.get(asset.id) : null;
    if (!imgCanvas) return;

    const rotated = Math.abs(item.rotation || 0) % 180 === 90;
    const drawWidthCm = rotated ? item.height : item.width;
    const drawHeightCm = rotated ? item.width : item.height;
    const pxWidth = (drawWidthCm / 2.54) * dpi;
    const pxHeight = (drawHeightCm / 2.54) * dpi;
    const centerX = ((item.x + item.width / 2) / 2.54) * dpi;
    const centerY = ((item.y + item.height / 2) / 2.54) * dpi;

    context.save();
    context.translate(centerX, centerY);
    if (item.rotation) {
      context.rotate((item.rotation * Math.PI) / 180);
    }
    if (item.flipX || item.flipY) {
      context.scale(item.flipX ? -1 : 1, item.flipY ? -1 : 1);
    }
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(imgCanvas, -pxWidth / 2, -pxHeight / 2, pxWidth, pxHeight);
    context.restore();

    if (exportCutLines) {
      context.save();
      const leftPx = (item.x / 2.54) * dpi;
      const topPx = (item.y / 2.54) * dpi;
      const wPx = (item.width / 2.54) * dpi;
      const hPx = (item.height / 2.54) * dpi;
      context.strokeStyle = 'rgba(120, 113, 108, 0.65)';
      context.lineWidth = Math.max(1.5, Math.round(dpi / 120));
      context.setLineDash([Math.max(4, Math.round(dpi / 45)), Math.max(4, Math.round(dpi / 45))]);
      context.strokeRect(leftPx, topPx, wPx, hPx);
      context.restore();
    }
  });
};

// Vista previa rápida compatible hacia atrás si algún componente externo invoca GangSheetPreview
export function GangSheetPreview({ persistedState }) {
  const sheetWidthCm = persistedState?.sheetWidthCm ?? DEFAULT_WIDTH_CM;
  const entries = persistedState?.entries ?? [];
  const gapMm = persistedState?.gapMm ?? 5;
  const layout = useMemo(() => {
    if (!entries.length) return { placements: [], heightCm: 0 };
    try {
      return layoutGangSheet(entries, sheetWidthCm, gapMm / 10);
    } catch {
      return { placements: [], heightCm: 0 };
    }
  }, [entries, sheetWidthCm, gapMm]);

  return (
    <div className="p-4 text-xs text-stone-300">
      Rollo comercial: {sheetWidthCm} cm × {layout.heightCm.toFixed(1)} cm ({layout.placements.length} piezas)
    </div>
  );
}

// Miniatura reutilizable para cada diseño en la galería lateral
function AssetThumbnail({ asset, usageCount, onAddClick, onRemoveAsset, onTrimAsset }) {
  const [dataUrl, setDataUrl] = useState('');

  useEffect(() => {
    if (!asset?.imageData) return;
    const canvas = imageDataToCanvas(asset.imageData);
    setDataUrl(canvas.toDataURL('image/png'));
  }, [asset?.imageData]);

  return (
    <div
      className="group relative rounded-lg border border-stone-700/80 bg-stone-900/90 hover:border-emerald-400 transition overflow-hidden flex flex-col"
      title={`${asset.name} (${asset.imageData.width}×${asset.imageData.height} px) — Clic para añadir a la plancha`}
    >
      <button
        type="button"
        onClick={() => onAddClick(asset)}
        className="relative aspect-square w-full flex items-center justify-center p-1.5 cursor-pointer"
        style={{
          backgroundImage:
            'linear-gradient(45deg, #292524 25%, transparent 25%), linear-gradient(-45deg, #292524 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #292524 75%), linear-gradient(-45deg, transparent 75%, #292524 75%)',
          backgroundSize: '12px 12px',
          backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0'
        }}
      >
        {dataUrl && (
          <img
            src={dataUrl}
            alt={asset.name}
            className="max-w-full max-h-full object-contain pointer-events-none select-none transition-transform group-hover:scale-105"
          />
        )}
        {/* Contador de copias colocadas en la plancha (estilo Taker.es) */}
        <span
          className={`absolute bottom-1 right-1 min-w-[20px] h-5 px-1 rounded-full text-[10px] font-mono font-bold flex items-center justify-center shadow ${
            usageCount > 0
              ? 'bg-emerald-500 text-stone-950'
              : 'bg-stone-800/90 text-stone-300 border border-stone-600'
          }`}
        >
          {usageCount}
        </span>

        {asset.isCurrentDesign && (
          <span className="absolute top-1 left-1 rounded bg-emerald-500/90 px-1 py-0.5 text-[8px] font-bold uppercase text-stone-950">
            Estudio
          </span>
        )}
      </button>

      {/* Acciones rápidas al pasar el ratón */}
      <div className="absolute top-1 right-1 hidden group-hover:flex items-center gap-0.5 bg-stone-950/90 rounded p-0.5 border border-stone-700">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onTrimAsset(asset.id);
          }}
          title="Recortar bordes transparentes vacíos"
          className="p-1 text-stone-300 hover:text-emerald-400"
        >
          <Scissors className="w-3 h-3" />
        </button>
        {!asset.isCurrentDesign && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemoveAsset(asset.id);
            }}
            title="Eliminar imagen de la galería"
            className="p-1 text-stone-300 hover:text-red-400"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// CREADOR INTERACTIVO DE METROS DTF (CLON FUNCIONAL DE TAKER.ES / DRIPAPPS)
// ============================================================================
export default function GangSheet({
  currentImageData,
  activeDesignName = 'Diseño actual',
  showToast = () => {},
  persistedState,
  onStateChange,
  onExitGangSheet
}) {
  const isControlled = Boolean(persistedState && onStateChange);

  const [localState, setLocalState] = useState({
    sheetWidthCm: DEFAULT_WIDTH_CM,
    dpi: DEFAULT_DPI,
    gapMm: 5,
    edgeMarginMm: 2,
    cutLines: true,
    exportCutLines: false,
    entries: [],
    canvasItems: [],
    initialized: false
  });

  const state = isControlled ? persistedState : localState;
  const updateState = useCallback(
    (updater) => {
      if (isControlled) {
        onStateChange((prev) => {
          const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
          return next;
        });
      } else {
        setLocalState((prev) => (typeof updater === 'function' ? updater(prev) : { ...prev, ...updater }));
      }
    },
    [isControlled, onStateChange]
  );

  // Asegurar que el ancho comercial por defecto sea 58 cm (58-60 cm formato comercial DTF)
  const sheetWidthCm = state.sheetWidthCm || DEFAULT_WIDTH_CM;
  const dpi = state.dpi || DEFAULT_DPI;
  const marginCm = Number(((state.gapMm ?? 5) / 10).toFixed(2));
  const edgeMarginCm = Number(((state.edgeMarginMm ?? 2) / 10).toFixed(2));
  const exportCutLines = Boolean(state.exportCutLines);
  const assets = state.entries || [];
  const canvasItems = state.canvasItems || [];

  // Historial Undo/Redo de posiciones en la plancha
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  const [selectedItemId, setSelectedItemId] = useState(null);
  const [zoom, setZoom] = useState(0.88);
  const [panMode, setPanMode] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [artboardBg, setArtboardBg] = useState('checker'); // 'checker' | 'dark' | 'white' | 'film'
  const [showOverlappingLines, setShowOverlappingLines] = useState(true);
  const [showResolutionLines, setShowResolutionLines] = useState(true);
  const [applyMarginOnDuplicate, setApplyMarginOnDuplicate] = useState(true);
  const [duplicateQty, setDuplicateQty] = useState(1);
  const [autoTrimOnUpload, setAutoTrimOnUpload] = useState(true);
  const [isDraggingUpload, setIsDraggingUpload] = useState(false);
  const [showAutoBuildModal, setShowAutoBuildModal] = useState(false);
  const [autoBuildDraft, setAutoBuildDraft] = useState([]);
  const [contextMenu, setContextMenu] = useState(null); // { x, y, itemId }
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const artboardScrollRef = useRef(null);
  const artboardSurfaceRef = useRef(null);
  const interactionRef = useRef(null);
  const initializedRef = useRef(false);

  // Mapa rápido assetId -> asset y caché de DataURLs para renderizar los elementos en el lienzo interactivo
  const assetsMap = useMemo(() => {
    const map = new Map();
    assets.forEach((a) => map.set(a.id, a));
    return map;
  }, [assets]);

  const [assetUrls, setAssetUrls] = useState({});
  useEffect(() => {
    const nextUrls = {};
    assets.forEach((asset) => {
      if (asset?.imageData) {
        const c = imageDataToCanvas(asset.imageData);
        nextUrls[asset.id] = c.toDataURL('image/png');
      }
    });
    setAssetUrls(nextUrls);
  }, [assets]);

  // Inicialización con el diseño activo del estudio si la plancha aún no se ha inicializado
  useEffect(() => {
    const alreadyInit = state.initialized || initializedRef.current;
    if (alreadyInit || !currentImageData) return;
    initializedRef.current = true;
    const trimmed = autoTrimOnUpload ? trimTransparentImageData(currentImageData) : currentImageData;
    const initialAsset = makeGangEntry(trimmed, activeDesignName || 'Diseño actual', true);
    const initialItems = buildInitialCanvasItemsFromEntries([initialAsset], sheetWidthCm, marginCm, edgeMarginCm);
    updateState((prev) => ({
      ...prev,
      sheetWidthCm: prev.sheetWidthCm === 30 ? 58 : (prev.sheetWidthCm || 58),
      initialized: true,
      entries: [initialAsset],
      canvasItems: initialItems
    }));
    if (initialItems[0]) {
      setSelectedItemId(initialItems[0].id);
    }
  }, [currentImageData, activeDesignName, state.initialized, sheetWidthCm, marginCm, edgeMarginCm, autoTrimOnUpload, updateState]);

  // Si venimos de un estado guardado que tenía entries pero aún no tenía canvasItems, los generamos
  useEffect(() => {
    if (assets.length > 0 && (!state.canvasItems || state.canvasItems.length === 0) && !initializedRef.current) {
      initializedRef.current = true;
      const generated = buildInitialCanvasItemsFromEntries(assets, sheetWidthCm, marginCm, edgeMarginCm);
      updateState((prev) => ({
        ...prev,
        sheetWidthCm: prev.sheetWidthCm === 30 ? 58 : (prev.sheetWidthCm || 58),
        canvasItems: generated
      }));
      if (generated[0]) setSelectedItemId(generated[0].id);
    }
  }, [assets, state.canvasItems, sheetWidthCm, marginCm, edgeMarginCm, updateState]);

  const commitCanvasItems = useCallback(
    (nextItemsOrUpdater, recordUndo = true) => {
      updateState((prev) => {
        const currentItems = prev.canvasItems || [];
        const nextItems =
          typeof nextItemsOrUpdater === 'function' ? nextItemsOrUpdater(currentItems) : nextItemsOrUpdater;
        if (recordUndo) {
          setUndoStack((u) => [...u.slice(-29), currentItems]);
          setRedoStack([]);
        }
        return {
          ...prev,
          initialized: true,
          canvasItems: nextItems
        };
      });
    },
    [updateState]
  );

  const handleUndo = useCallback(() => {
    if (!undoStack.length) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((u) => u.slice(0, -1));
    setRedoStack((r) => [...r, canvasItems]);
    updateState((prev) => ({ ...prev, canvasItems: previous }));
  }, [undoStack, canvasItems, updateState]);

  const handleRedo = useCallback(() => {
    if (!redoStack.length) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((r) => r.slice(0, -1));
    setUndoStack((u) => [...u, canvasItems]);
    updateState((prev) => ({ ...prev, canvasItems: next }));
  }, [redoStack, canvasItems, updateState]);

  // Elemento actualmente seleccionado
  const selectedItem = useMemo(
    () => canvasItems.find((item) => item.id === selectedItemId) || null,
    [canvasItems, selectedItemId]
  );

  const selectedAsset = useMemo(
    () => (selectedItem ? assetsMap.get(selectedItem.assetId) || null : null),
    [selectedItem, assetsMap]
  );

  // Largo dinámico de la plancha definido estrictamente por la cantidad y posición de los elementos colocados
  const usedHeightCm = useMemo(() => {
    if (!canvasItems.length) return 0;
    let maxBottom = 0;
    canvasItems.forEach((item) => {
      const bottom = (item.y || 0) + (item.height || 0);
      if (bottom > maxBottom) maxBottom = bottom;
    });
    return Number((maxBottom + edgeMarginCm).toFixed(2));
  }, [canvasItems, edgeMarginCm]);

  // Altura visible del rollo interactivo (crece automáticamente conforme bajas elementos para poder arrastrar sin límite)
  const visibleArtboardHeightCm = useMemo(() => {
    return Math.max(80, Math.ceil((usedHeightCm + 35) / 10) * 10);
  }, [usedHeightCm]);

  // Estadísticas de aprovechamiento del metro DTF
  const utilizationStats = useMemo(() => {
    if (!canvasItems.length || usedHeightCm <= 0) {
      return { artworkAreaCm2: 0, sheetAreaCm2: 0, utilizationPercent: 0 };
    }
    const artworkAreaCm2 = canvasItems.reduce((sum, item) => sum + item.width * item.height, 0);
    const sheetAreaCm2 = sheetWidthCm * usedHeightCm;
    return {
      artworkAreaCm2,
      sheetAreaCm2,
      utilizationPercent: Math.min(100, (artworkAreaCm2 / Math.max(1, sheetAreaCm2)) * 100)
    };
  }, [canvasItems, sheetWidthCm, usedHeightCm]);

  // Detección en tiempo real de elementos superpuestos (Overlapping) y elementos fuera de los 58-60 cm del rollo (Off-boarding)
  const { overlappingIds, offboardIds } = useMemo(() => {
    const overlapSet = new Set();
    const offSet = new Set();
    const eps = 0.05; // 0.5 mm de tolerancia

    for (let i = 0; i < canvasItems.length; i++) {
      const a = canvasItems[i];
      if (
        a.x < -eps ||
        a.y < -eps ||
        a.x + a.width > sheetWidthCm + eps
      ) {
        offSet.add(a.id);
      }
      for (let j = i + 1; j < canvasItems.length; j++) {
        const b = canvasItems[j];
        const intersects =
          a.x < b.x + b.width - eps &&
          a.x + a.width > b.x + eps &&
          a.y < b.y + b.height - eps &&
          a.y + a.height > b.y + eps;
        if (intersects) {
          overlapSet.add(a.id);
          overlapSet.add(b.id);
        }
      }
    }
    return { overlappingIds: overlapSet, offboardIds: offSet };
  }, [canvasItems, sheetWidthCm]);

  // Contador de copias por recurso en la galería
  const usageCounts = useMemo(() => {
    const counts = {};
    canvasItems.forEach((item) => {
      counts[item.assetId] = (counts[item.assetId] || 0) + 1;
    });
    return counts;
  }, [canvasItems]);

  // Escala en pantalla (px por cm)
  const pxPerCm = CM_TO_PX_BASE * zoom;
  const artboardWidthPx = Math.round(sheetWidthCm * pxPerCm);
  const artboardHeightPx = Math.round(visibleArtboardHeightCm * pxPerCm);
  const usedHeightPx = Math.round(usedHeightCm * pxPerCm);

  // Encontrar la posición óptima para insertar un nuevo diseño sin pisar los existentes
  const findNextPlacementPosition = useCallback(
    (itemW, itemH, existingItems) => {
      if (!existingItems.length) {
        return { x: edgeMarginCm, y: edgeMarginCm };
      }
      // Intentar colocar a la derecha del último elemento si cabe en la misma fila
      const last = existingItems[existingItems.length - 1];
      const gap = applyMarginOnDuplicate ? marginCm : 0;
      const candidateX = Number((last.x + last.width + gap).toFixed(2));
      if (candidateX + itemW <= sheetWidthCm - edgeMarginCm + 0.01) {
        return { x: candidateX, y: Number(last.y.toFixed(2)) };
      }
      // Si no cabe en la fila actual, colocar al inicio de una nueva fila debajo del punto más bajo
      const maxBottom = existingItems.reduce((max, it) => Math.max(max, it.y + it.height), 0);
      return {
        x: edgeMarginCm,
        y: Number((maxBottom + gap).toFixed(2))
      };
    },
    [edgeMarginCm, applyMarginOnDuplicate, marginCm, sheetWidthCm]
  );

  // Añadir una instancia de una imagen de la galería a la plancha
  const addAssetInstanceToSheet = useCallback(
    (asset, customWidthCm = null, copiesToAdd = 1) => {
      if (!asset?.imageData) return;
      const aspect = asset.imageData.height / Math.max(1, asset.imageData.width);
      const maxAllowedWidth = Math.max(1, Number((sheetWidthCm - edgeMarginCm * 2).toFixed(2)));
      const width = clamp(customWidthCm || asset.widthCm || 10, 1, maxAllowedWidth);
      const height = Number((width * aspect).toFixed(2));

      let createdLastId = null;
      commitCanvasItems((current) => {
        const nextList = [...current];
        for (let i = 0; i < copiesToAdd; i++) {
          const pos = findNextPlacementPosition(width, height, nextList);
          const newItem = {
            id: createId('item'),
            assetId: asset.id,
            name: asset.name,
            x: pos.x,
            y: pos.y,
            width,
            height,
            rotation: 0,
            flipX: false,
            flipY: false,
            keepAspect: true
          };
          createdLastId = newItem.id;
          nextList.push(newItem);
        }
        return nextList;
      });

      if (createdLastId) {
        setSelectedItemId(createdLastId);
      }
    },
    [sheetWidthCm, edgeMarginCm, commitCanvasItems, findNextPlacementPosition]
  );

  // Subir varios archivos desde el ordenador a la galería y añadirlos a la plancha
  const handleUploadFiles = async (fileList) => {
    setError('');
    const files = Array.from(fileList || []);
    if (!files.length) return;

    const accepted = files.filter((file) => {
      const validType = ['image/png', 'image/jpeg', 'image/webp'].includes(file.type);
      const validExtension = /\.(png|jpe?g|webp)$/i.test(file.name || '');
      return validType || validExtension;
    });

    if (accepted.length !== files.length) {
      setError('Solo se admiten archivos PNG, JPEG o WebP.');
    }
    if (!accepted.length) return;

    try {
      const loadedAssets = await Promise.all(
        accepted.map(async (file) => {
          const bitmap = await createImageBitmap(file);
          if (bitmap.width > 16000 || bitmap.height > 16000 || bitmap.width * bitmap.height > 40_000_000) {
            bitmap.close();
            throw new RangeError(`${file.name} supera el límite de 40 megapíxeles.`);
          }
          const canvas = document.createElement('canvas');
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) {
            bitmap.close();
            throw new Error(`No se pudo procesar ${file.name}.`);
          }
          ctx.drawImage(bitmap, 0, 0);
          bitmap.close();
          const rawImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const finalImageData = autoTrimOnUpload ? trimTransparentImageData(rawImageData) : rawImageData;
          return makeGangEntry(finalImageData, file.name, false);
        })
      );

      updateState((prev) => {
        const nextAssets = [...(prev.entries || []), ...loadedAssets];
        const nextCanvasItems = [...(prev.canvasItems || [])];
        loadedAssets.forEach((asset) => {
          const aspect = asset.imageData.height / Math.max(1, asset.imageData.width);
          const w = clamp(10, 1, Math.max(1, sheetWidthCm - edgeMarginCm * 2));
          const h = Number((w * aspect).toFixed(2));
          const pos = findNextPlacementPosition(w, h, nextCanvasItems);
          nextCanvasItems.push({
            id: createId('item'),
            assetId: asset.id,
            name: asset.name,
            x: pos.x,
            y: pos.y,
            width: w,
            height: h,
            rotation: 0,
            flipX: false,
            flipY: false,
            keepAspect: true
          });
        });
        return {
          ...prev,
          initialized: true,
          entries: nextAssets,
          canvasItems: nextCanvasItems
        };
      });

      showToast(`${loadedAssets.length} ${loadedAssets.length === 1 ? 'imagen añadida' : 'imágenes añadidas'} al creador de metros DTF.`);
    } catch (uploadErr) {
      setError(`Error al subir imágenes: ${uploadErr.message}`);
    }
  };

  // Sincronizar o importar el diseño actualmente abierto en el estudio de AmazoniaInk
  const syncStudioDesign = () => {
    if (!currentImageData) return;
    const trimmed = autoTrimOnUpload ? trimTransparentImageData(currentImageData) : currentImageData;
    const aspect = trimmed.height / Math.max(1, trimmed.width);

    updateState((prev) => {
      const existingStudioAsset = (prev.entries || []).find((e) => e.isCurrentDesign);
      if (!existingStudioAsset) {
        const newAsset = makeGangEntry(trimmed, activeDesignName || 'Diseño del Estudio', true);
        const w = clamp(10, 1, sheetWidthCm - edgeMarginCm * 2);
        const h = Number((w * aspect).toFixed(2));
        const pos = findNextPlacementPosition(w, h, prev.canvasItems || []);
        const newItem = {
          id: createId('item'),
          assetId: newAsset.id,
          name: newAsset.name,
          x: pos.x,
          y: pos.y,
          width: w,
          height: h,
          rotation: 0,
          flipX: false,
          flipY: false,
          keepAspect: true
        };
        setSelectedItemId(newItem.id);
        return {
          ...prev,
          initialized: true,
          entries: [newAsset, ...(prev.entries || [])],
          canvasItems: [...(prev.canvasItems || []), newItem]
        };
      }

      // Actualizar imagen y ajustar proporción de las copias existentes
      const updatedEntries = (prev.entries || []).map((e) =>
        e.isCurrentDesign ? { ...e, imageData: trimmed, name: activeDesignName || e.name } : e
      );
      const updatedItems = (prev.canvasItems || []).map((item) => {
        if (item.assetId !== existingStudioAsset.id) return item;
        const rotated = Math.abs(item.rotation || 0) % 180 === 90;
        const nextHeight = rotated
          ? Number((item.width / aspect).toFixed(2))
          : Number((item.width * aspect).toFixed(2));
        return {
          ...item,
          name: activeDesignName || item.name,
          height: nextHeight
        };
      });

      return {
        ...prev,
        entries: updatedEntries,
        canvasItems: updatedItems
      };
    });

    showToast('Diseño del estudio sincronizado con la plancha DTF.');
  };

  // Recortar bordes transparentes de un recurso ya cargado
  const handleTrimAsset = (assetId) => {
    const targetAsset = assetsMap.get(assetId);
    if (!targetAsset) return;
    const trimmed = trimTransparentImageData(targetAsset.imageData);
    const newAspect = trimmed.height / Math.max(1, trimmed.width);

    updateState((prev) => ({
      ...prev,
      entries: (prev.entries || []).map((e) => (e.id === assetId ? { ...e, imageData: trimmed } : e)),
      canvasItems: (prev.canvasItems || []).map((item) => {
        if (item.assetId !== assetId) return item;
        const rotated = Math.abs(item.rotation || 0) % 180 === 90;
        return {
          ...item,
          height: rotated
            ? Number((item.width / newAspect).toFixed(2))
            : Number((item.width * newAspect).toFixed(2))
        };
      })
    }));
    showToast('Bordes transparentes recortados automáticamente.');
  };

  // Eliminar una imagen de la galería y sus instancias en el lienzo
  const handleRemoveAsset = (assetId) => {
    updateState((prev) => ({
      ...prev,
      entries: (prev.entries || []).filter((e) => e.id !== assetId),
      canvasItems: (prev.canvasItems || []).filter((item) => item.assetId !== assetId)
    }));
    if (selectedItem?.assetId === assetId) {
      setSelectedItemId(null);
    }
  };

  // Actualizar propiedades del objeto seleccionado
  const updateSelectedItem = useCallback(
    (patchOrFn, recordUndo = true) => {
      if (!selectedItemId) return;
      commitCanvasItems(
        (items) =>
          items.map((item) => {
            if (item.id !== selectedItemId) return item;
            const patch = typeof patchOrFn === 'function' ? patchOrFn(item) : patchOrFn;
            return { ...item, ...patch };
          }),
        recordUndo
      );
    },
    [selectedItemId, commitCanvasItems]
  );

  // Cambiar ancho o alto manteniendo o no la relación de aspecto
  const handleResizeSelectedCm = (dimension, rawValue) => {
    if (!selectedItem) return;
    const value = clamp(Number(rawValue) || 0.5, 0.5, 300);
    const aspect = selectedItem.height / Math.max(0.1, selectedItem.width);

    if (dimension === 'width') {
      const nextWidth = Number(value.toFixed(2));
      const nextHeight = selectedItem.keepAspect
        ? Number(Math.max(0.5, nextWidth * aspect).toFixed(2))
        : selectedItem.height;
      updateSelectedItem({ width: nextWidth, height: nextHeight });
    } else {
      const nextHeight = Number(value.toFixed(2));
      const nextWidth = selectedItem.keepAspect
        ? Number(Math.max(0.5, nextHeight / aspect).toFixed(2))
        : selectedItem.width;
      updateSelectedItem({ width: nextWidth, height: nextHeight });
    }
  };

  // Rotar el elemento seleccionado 90 grados intercambiando su caja delimitadora (width <-> height)
  const handleRotateSelected = (deltaDegrees) => {
    if (!selectedItem) return;
    const nextRotation = (selectedItem.rotation + deltaDegrees + 360) % 360;
    const swapDims = Math.abs(deltaDegrees) % 180 === 90;
    updateSelectedItem({
      rotation: nextRotation,
      width: swapDims ? selectedItem.height : selectedItem.width,
      height: swapDims ? selectedItem.width : selectedItem.height,
      x: clamp(selectedItem.x, 0, Math.max(0, sheetWidthCm - (swapDims ? selectedItem.height : selectedItem.width)))
    });
  };

  // Duplicar el elemento seleccionado N veces respetando el margen configurado
  const handleDuplicateSelected = useCallback(
    (count = 1) => {
      if (!selectedItem) return;
      const copies = clamp(Number(count) || 1, 1, 100);
      let lastCreatedId = null;

      commitCanvasItems((current) => {
        const nextList = [...current];
        for (let i = 0; i < copies; i++) {
          const pos = findNextPlacementPosition(selectedItem.width, selectedItem.height, nextList);
          const clone = {
            ...selectedItem,
            id: createId('item'),
            x: pos.x,
            y: pos.y
          };
          lastCreatedId = clone.id;
          nextList.push(clone);
        }
        return nextList;
      });

      if (lastCreatedId) setSelectedItemId(lastCreatedId);
    },
    [selectedItem, commitCanvasItems, findNextPlacementPosition]
  );

  // Rellenar toda la fila horizontal de la bobina de 58-60 cm con el diseño seleccionado (Auto-Fill Row)
  const handleFillRowWithSelected = () => {
    if (!selectedItem) return;
    const gap = applyMarginOnDuplicate ? marginCm : 0;
    const availableWidth = sheetWidthCm - edgeMarginCm * 2;
    const perRow = Math.floor((availableWidth + gap) / (selectedItem.width + gap));
    if (perRow <= 1) {
      showToast('El diseño ya ocupa todo el ancho disponible de la fila.', 'info');
      return;
    }

    commitCanvasItems((current) => {
      const rowY = selectedItem.y;
      // Eliminar otros elementos idénticos que estén exactamente en esta misma fila para rellenarla limpia
      const others = current.filter((it) => it.id !== selectedItem.id);
      const rowItems = [];
      for (let i = 0; i < perRow; i++) {
        const xPos = Number((edgeMarginCm + i * (selectedItem.width + gap)).toFixed(2));
        rowItems.push({
          ...selectedItem,
          id: i === 0 ? selectedItem.id : createId('item'),
          x: xPos,
          y: rowY
        });
      }
      return [...others, ...rowItems];
    });

    showToast(`Fila rellenada automáticamente con ${perRow} copias en ${sheetWidthCm} cm.`);
  };

  // Eliminar objeto seleccionado
  const handleDeleteSelected = useCallback(() => {
    if (!selectedItemId) return;
    commitCanvasItems((items) => items.filter((it) => it.id !== selectedItemId));
    setSelectedItemId(null);
  }, [selectedItemId, commitCanvasItems]);

  // Alinear objeto seleccionado respecto al rollo de 58-60 cm
  const handleAlignSelected = (mode) => {
    if (!selectedItem) return;
    if (mode === 'left') {
      updateSelectedItem({ x: edgeMarginCm });
    } else if (mode === 'center-h') {
      updateSelectedItem({ x: Number(((sheetWidthCm - selectedItem.width) / 2).toFixed(2)) });
    } else if (mode === 'right') {
      updateSelectedItem({ x: Number(Math.max(0, sheetWidthCm - edgeMarginCm - selectedItem.width).toFixed(2)) });
    } else if (mode === 'top') {
      updateSelectedItem({ y: edgeMarginCm });
    } else if (mode === 'fit-width') {
      const maxW = Number(Math.max(1, sheetWidthCm - edgeMarginCm * 2).toFixed(2));
      const aspect = selectedItem.height / Math.max(0.1, selectedItem.width);
      updateSelectedItem({
        x: edgeMarginCm,
        width: maxW,
        height: Number((maxW * aspect).toFixed(2))
      });
    } else if (mode === 'front') {
      commitCanvasItems((items) => {
        const target = items.find((i) => i.id === selectedItemId);
        if (!target) return items;
        return [...items.filter((i) => i.id !== selectedItemId), target];
      });
    } else if (mode === 'back') {
      commitCanvasItems((items) => {
        const target = items.find((i) => i.id === selectedItemId);
        if (!target) return items;
        return [target, ...items.filter((i) => i.id !== selectedItemId)];
      });
    }
  };

  // Empaquetado Automático Inteligente (Auto Nest / Auto Agrupar toda la plancha)
  const handleAutoNestAll = () => {
    if (!canvasItems.length) return;
    const packed = autoPackItemsOnRoll(canvasItems, sheetWidthCm, marginCm, edgeMarginCm);
    commitCanvasItems(packed);
    showToast(`Auto-agrupado completado en bobina de ${sheetWidthCm} cm.`);
  };

  // Abrir el asistente "Creación Automática (Auto Build)" por lotes (igual que Taker.es)
  const openAutoBuildModal = () => {
    const draft = assets.map((asset) => {
      const existingForAsset = canvasItems.filter((i) => i.assetId === asset.id);
      const sample = existingForAsset[0];
      const aspect = asset.imageData.height / Math.max(1, asset.imageData.width);
      const widthCm = sample ? sample.width : asset.widthCm || 10;
      return {
        assetId: asset.id,
        name: asset.name,
        aspect,
        widthCm: Number(widthCm.toFixed(2)),
        heightCm: Number((widthCm * aspect).toFixed(2)),
        quantity: Math.max(1, existingForAsset.length || 1)
      };
    });
    setAutoBuildDraft(draft);
    setShowAutoBuildModal(true);
  };

  const applyAutoBuildModal = () => {
    const generatedRaw = [];
    autoBuildDraft.forEach((row) => {
      const asset = assetsMap.get(row.assetId);
      if (!asset || row.quantity <= 0) return;
      const w = clamp(Number(row.widthCm) || 10, 1, sheetWidthCm - edgeMarginCm * 2);
      const h = Number((w * row.aspect).toFixed(2));
      const qty = clamp(Number(row.quantity) || 1, 0, 200);
      for (let i = 0; i < qty; i++) {
        generatedRaw.push({
          id: createId('item'),
          assetId: asset.id,
          name: asset.name,
          x: edgeMarginCm,
          y: edgeMarginCm,
          width: w,
          height: h,
          rotation: 0,
          flipX: false,
          flipY: false,
          keepAspect: true
        });
      }
    });

    const packed = autoPackItemsOnRoll(generatedRaw, sheetWidthCm, marginCm, edgeMarginCm);
    commitCanvasItems(packed);
    setShowAutoBuildModal(false);
    if (packed[0]) setSelectedItemId(packed[0].id);
    showToast(`Plancha generada automáticamente: ${packed.length} piezas en ${sheetWidthCm} cm de ancho.`);
  };

  // Interacción con ratón en el lienzo: Mover (Drag), Redimensionar desde esquinas (Resize) y Rotar
  const startItemInteraction = (event, item, mode, handleCorner = null) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    setContextMenu(null);

    if (panMode) return;
    setSelectedItemId(item.id);

    // Guardar copia para Undo antes de empezar a arrastrar
    const snapshotBeforeDrag = [...canvasItems];

    interactionRef.current = {
      mode, // 'move' | 'resize'
      handleCorner, // 'nw' | 'ne' | 'sw' | 'se' | 'e' | 's'
      itemId: item.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      initialX: item.x,
      initialY: item.y,
      initialWidth: item.width,
      initialHeight: item.height,
      aspect: item.height / Math.max(0.1, item.width),
      keepAspect: item.keepAspect !== false,
      hasMoved: false,
      snapshotBeforeDrag
    };
  };

  useEffect(() => {
    const handleWindowMouseMove = (event) => {
      const active = interactionRef.current;
      if (!active) return;

      const deltaCmX = (event.clientX - active.startClientX) / pxPerCm;
      const deltaCmY = (event.clientY - active.startClientY) / pxPerCm;

      if (Math.abs(deltaCmX) > 0.03 || Math.abs(deltaCmY) > 0.03) {
        active.hasMoved = true;
      }

      if (active.mode === 'move') {
        let nextX = active.initialX + deltaCmX;
        let nextY = Math.max(0, active.initialY + deltaCmY);

        // Imán suave a los márgenes laterales y al centro del rollo (Snap)
        const snapThreshold = 0.25;
        if (Math.abs(nextX - edgeMarginCm) < snapThreshold) nextX = edgeMarginCm;
        const rightEdgeX = sheetWidthCm - edgeMarginCm - active.initialWidth;
        if (Math.abs(nextX - rightEdgeX) < snapThreshold) nextX = rightEdgeX;
        const centerX = (sheetWidthCm - active.initialWidth) / 2;
        if (Math.abs(nextX - centerX) < snapThreshold) nextX = centerX;
        if (Math.abs(nextY - edgeMarginCm) < snapThreshold) nextY = edgeMarginCm;

        updateState((prev) => ({
          ...prev,
          canvasItems: (prev.canvasItems || []).map((it) =>
            it.id === active.itemId
              ? {
                  ...it,
                  x: Number(nextX.toFixed(2)),
                  y: Number(nextY.toFixed(2))
                }
              : it
          )
        }));
      } else if (active.mode === 'resize') {
        let nextW = active.initialWidth;
        let nextH = active.initialHeight;
        let nextX = active.initialX;
        let nextY = active.initialY;

        const corner = active.handleCorner;
        if (corner.includes('e')) {
          nextW = Math.max(0.8, active.initialWidth + deltaCmX);
        }
        if (corner.includes('w')) {
          const proposedW = Math.max(0.8, active.initialWidth - deltaCmX);
          nextX = active.initialX + (active.initialWidth - proposedW);
          nextW = proposedW;
        }
        if (corner.includes('s')) {
          nextH = Math.max(0.8, active.initialHeight + deltaCmY);
        }
        if (corner.includes('n')) {
          const proposedH = Math.max(0.8, active.initialHeight - deltaCmY);
          nextY = Math.max(0, active.initialY + (active.initialHeight - proposedH));
          nextH = proposedH;
        }

        if (active.keepAspect && (corner.length === 2 || corner === 'e')) {
          nextH = Number((nextW * active.aspect).toFixed(2));
        } else if (active.keepAspect && corner === 's') {
          nextW = Number((nextH / active.aspect).toFixed(2));
        }

        updateState((prev) => ({
          ...prev,
          canvasItems: (prev.canvasItems || []).map((it) =>
            it.id === active.itemId
              ? {
                  ...it,
                  x: Number(nextX.toFixed(2)),
                  y: Number(nextY.toFixed(2)),
                  width: Number(nextW.toFixed(2)),
                  height: Number(nextH.toFixed(2))
                }
              : it
          )
        }));
      }
    };

    const handleWindowMouseUp = () => {
      const active = interactionRef.current;
      if (!active) return;
      if (active.hasMoved && active.snapshotBeforeDrag) {
        setUndoStack((u) => [...u.slice(-29), active.snapshotBeforeDrag]);
        setRedoStack([]);
      }
      interactionRef.current = null;
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [pxPerCm, edgeMarginCm, sheetWidthCm, updateState]);

  // Atajos de teclado estilo Taker.es (Supr/Backspace = Eliminar, Ctrl+D = Duplicar, Ctrl+Z = Deshacer, Flechas = Mover fino)
  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }
      if (!selectedItemId) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDeleteSelected();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handleDuplicateSelected(1);
      } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 1 : 0.1;
        updateSelectedItem((item) => ({
          x:
            e.key === 'ArrowLeft'
              ? Number(Math.max(0, item.x - step).toFixed(2))
              : e.key === 'ArrowRight'
              ? Number((item.x + step).toFixed(2))
              : item.x,
          y:
            e.key === 'ArrowUp'
              ? Number(Math.max(0, item.y - step).toFixed(2))
              : e.key === 'ArrowDown'
              ? Number((item.y + step).toFixed(2))
              : item.y
        }));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedItemId, handleUndo, handleRedo, handleDeleteSelected, handleDuplicateSelected, updateSelectedItem]);

  // Exportar la plancha final PNG a tamaño exacto (Ancho comercial 58-60 cm × Largo ocupado por los elementos)
  const exportGangSheetPng = async () => {
    if (!canvasItems.length || usedHeightCm <= 0) return;
    setBusy(true);
    setError('');
    try {
      const { width, height } = calculateRasterSize(sheetWidthCm / 2.54, usedHeightCm / 2.54, dpi);
      const output = document.createElement('canvas');
      output.width = width;
      output.height = height;
      const context = output.getContext('2d');
      if (!context) throw new Error('No se pudo inicializar el lienzo de exportación.');
      context.clearRect(0, 0, width, height);

      renderItemsToExportCanvas(context, canvasItems, assetsMap, dpi, exportCutLines);

      const blob = await new Promise((resolve, reject) => {
        output.toBlob(
          (val) => (val ? resolve(val) : reject(new Error('Falló la codificación PNG de la plancha.'))),
          'image/png'
        );
      });
      const physicalPng = await addPngPhysicalResolutionToBlob(blob, dpi);
      const url = URL.createObjectURL(physicalPng);
      const link = document.createElement('a');
      link.href = url;
      link.download = `plancha_DTF_${sheetWidthCm}x${usedHeightCm.toFixed(1)}cm_${dpi}DPI.png`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast(
        `Plancha DTF exportada: ${sheetWidthCm} cm × ${usedHeightCm.toFixed(1)} cm (${(usedHeightCm / 100).toFixed(2)} m) a ${dpi} DPI.`
      );
    } catch (exportErr) {
      setError(`No se pudo exportar la plancha: ${exportErr.message}`);
    } finally {
      setBusy(false);
    }
  };

  // Cálculos de memoria de exportación
  const estimatedPxW = Math.round((sheetWidthCm / 2.54) * dpi);
  const estimatedPxH = Math.round((usedHeightCm / 2.54) * dpi);
  const estimatedMegapixels = (estimatedPxW * estimatedPxH) / 1_000_000;
  const exceedsMemoryLimit =
    usedHeightCm > 0 && (estimatedMegapixels > 40 || estimatedPxW > 16000 || estimatedPxH > 16000);

  // Reglas graduadas en cm (Horizontal: 0..sheetWidthCm, Vertical: 0..visibleArtboardHeightCm)
  const horizontalTicks = useMemo(() => {
    const ticks = [];
    for (let cm = 0; cm <= sheetWidthCm; cm += 2) {
      ticks.push(cm);
    }
    if (ticks[ticks.length - 1] !== sheetWidthCm) ticks.push(sheetWidthCm);
    return ticks;
  }, [sheetWidthCm]);

  const verticalTicks = useMemo(() => {
    const ticks = [];
    const step = 5;
    for (let cm = 0; cm <= visibleArtboardHeightCm; cm += step) {
      ticks.push(cm);
    }
    return ticks;
  }, [visibleArtboardHeightCm]);

  // Marcas divisorias de cada Metro lineal (100 cm = 1 Metro, 200 cm = 2 Metros...)
  const meterMarkers = useMemo(() => {
    const markers = [];
    for (let cm = 100; cm < visibleArtboardHeightCm; cm += 100) {
      markers.push(cm);
    }
    return markers;
  }, [visibleArtboardHeightCm]);

  const selectedEffectiveDpi = useMemo(
    () => (selectedItem ? computeItemEffectiveDpi(selectedItem, selectedAsset) : null),
    [selectedItem, selectedAsset]
  );

  const getArtboardSurfaceStyle = () => {
    if (artboardBg === 'dark') {
      return { backgroundColor: '#141417' };
    }
    if (artboardBg === 'white') {
      return { backgroundColor: '#f5f5f4' };
    }
    if (artboardBg === 'film') {
      return {
        backgroundColor: '#cbd5e1',
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.35) 1px, transparent 0)',
        backgroundSize: '12px 12px'
      };
    }
    // Cuadrícula de transparencia clara estilo Taker/DripApps
    return {
      backgroundColor: '#e7e5e4',
      backgroundImage:
        'linear-gradient(45deg, #d6d3d1 25%, transparent 25%), linear-gradient(-45deg, #d6d3d1 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #d6d3d1 75%), linear-gradient(-45deg, transparent 75%, #d6d3d1 75%)',
      backgroundSize: '20px 20px',
      backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0'
    };
  };

  return (
    <section
      className="flex-1 flex flex-col bg-stone-950 text-stone-100 overflow-hidden select-none relative"
      aria-label="Creador de Metros y Planchas DTF"
      onClick={() => setContextMenu(null)}
    >
      {/* ====================================================================
          1. BARRA DE HERRAMIENTAS SUPERIOR (CLON DE TAKER.ES / DRIPAPPS)
      ==================================================================== */}
      <div className="min-h-[50px] bg-stone-900 border-b border-stone-800 px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 z-20 shrink-0">
        {/* Bloque Izquierdo: Botón Volver al Estudio + Formato Comercial (58-60 cm) + Largo Dinámico + Historial */}
        <div className="flex flex-wrap items-center gap-2">
          {onExitGangSheet && (
            <button
              type="button"
              onClick={onExitGangSheet}
              className="px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 text-xs font-semibold text-emerald-300 flex items-center gap-1.5 transition cursor-pointer"
              title="Salir del creador de metros y volver a las herramientas de edición de imagen"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>← Estudio</span>
            </button>
          )}
          <div className="flex items-center gap-1.5 bg-stone-950 border border-stone-700 rounded-lg px-2.5 py-1">
            <Layers className="w-4 h-4 text-emerald-400 shrink-0" />
            <label className="text-[11px] text-stone-400 font-medium flex items-center gap-1.5">
              <span>Bobina:</span>
              <select
                aria-label="Ancho de rollo (cm)"
                value={sheetWidthCm}
                onChange={(e) => {
                  const nextW = Number(e.target.value);
                  updateState((prev) => ({ ...prev, sheetWidthCm: nextW }));
                }}
                className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
              >
                {COMMERCIAL_ROLL_WIDTHS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-stone-900 text-white">
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <span className="text-stone-700">|</span>
            <span className="text-xs font-mono text-emerald-300 font-bold" title="El largo se ajusta automáticamente según las imágenes colocadas">
              Largo: {usedHeightCm.toFixed(1)} cm ({(usedHeightCm / 100).toFixed(2)} m)
            </span>
          </div>

          {/* Deshacer / Rehacer / Vaciar */}
          <div className="flex items-center bg-stone-950 border border-stone-800 rounded-lg p-0.5">
            <button
              type="button"
              onClick={handleUndo}
              disabled={!undoStack.length}
              title="Deshacer (Ctrl+Z)"
              className="p-1.5 rounded text-stone-300 hover:bg-stone-800 disabled:opacity-30"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={!redoStack.length}
              title="Rehacer (Ctrl+Y)"
              className="p-1.5 rounded text-stone-300 hover:bg-stone-800 disabled:opacity-30"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={!canvasItems.length}
              onClick={() => {
                commitCanvasItems([]);
                setSelectedItemId(null);
              }}
              title="Vaciar toda la plancha"
              className="p-1.5 rounded text-red-400 hover:bg-red-950/50 disabled:opacity-30"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Margen de separación entre imágenes (cm) */}
          <div className="flex items-center gap-1.5 bg-stone-950 border border-stone-800 rounded-lg px-2.5 py-1 text-xs">
            <label className="flex items-center gap-1 text-stone-300 cursor-pointer" title="Separación automática entre diseños">
              <input
                type="checkbox"
                checked={applyMarginOnDuplicate}
                onChange={(e) => setApplyMarginOnDuplicate(e.target.checked)}
                className="w-3.5 h-3.5 accent-emerald-400 rounded"
              />
              <span>Margen:</span>
            </label>
            <input
              type="number"
              min="0"
              max="5"
              step="0.1"
              value={marginCm}
              onChange={(e) => {
                const cmVal = clamp(Number(e.target.value) || 0, 0, 5);
                updateState((prev) => ({ ...prev, gapMm: Math.round(cmVal * 10) }));
              }}
              className="w-12 bg-stone-900 border border-stone-700 rounded px-1.5 py-0.5 text-center font-mono text-xs text-white"
            />
            <span className="text-[11px] text-stone-400">cm</span>
          </div>
        </div>

        {/* Bloque Central: Herramientas Contextuales del Objeto Seleccionado (Rotar, Espejo, Alinear, Capas, Duplicar) */}
        <div className="flex items-center gap-1 bg-stone-950 border border-stone-800 rounded-lg p-1">
          <button
            type="button"
            disabled={!selectedItem}
            onClick={() => handleRotateSelected(-90)}
            title="Rotar -90°"
            className="p-1.5 rounded text-stone-300 hover:bg-stone-800 hover:text-white disabled:opacity-30"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={!selectedItem}
            onClick={() => handleRotateSelected(90)}
            title="Rotar +90°"
            className="p-1.5 rounded text-stone-300 hover:bg-stone-800 hover:text-white disabled:opacity-30"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={!selectedItem}
            onClick={() => updateSelectedItem({ flipX: !selectedItem?.flipX })}
            title="Voltear horizontalmente (Espejo H)"
            className={`p-1.5 rounded hover:bg-stone-800 disabled:opacity-30 ${
              selectedItem?.flipX ? 'bg-emerald-500/20 text-emerald-300' : 'text-stone-300'
            }`}
          >
            <FlipHorizontal className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={!selectedItem}
            onClick={() => updateSelectedItem({ flipY: !selectedItem?.flipY })}
            title="Voltear verticalmente (Espejo V)"
            className={`p-1.5 rounded hover:bg-stone-800 disabled:opacity-30 ${
              selectedItem?.flipY ? 'bg-emerald-500/20 text-emerald-300' : 'text-stone-300'
            }`}
          >
            <FlipVertical className="w-3.5 h-3.5" />
          </button>

          <span className="h-4 w-px bg-stone-800 mx-0.5" />

          <button
            type="button"
            disabled={!selectedItem}
            onClick={() => handleAlignSelected('left')}
            title="Alinear al borde izquierdo del rollo"
            className="p-1.5 rounded text-stone-300 hover:bg-stone-800 hover:text-white disabled:opacity-30"
          >
            <AlignStartVertical className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={!selectedItem}
            onClick={() => handleAlignSelected('center-h')}
            title="Centrar horizontalmente en el rollo"
            className="p-1.5 rounded text-stone-300 hover:bg-stone-800 hover:text-white disabled:opacity-30"
          >
            <AlignHorizontalJustifyCenter className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={!selectedItem}
            onClick={() => handleAlignSelected('right')}
            title="Alinear al borde derecho del rollo"
            className="p-1.5 rounded text-stone-300 hover:bg-stone-800 hover:text-white disabled:opacity-30"
          >
            <AlignEndHorizontal className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={!selectedItem}
            onClick={() => handleAlignSelected('top')}
            title="Llevar al inicio superior del rollo"
            className="p-1.5 rounded text-stone-300 hover:bg-stone-800 hover:text-white disabled:opacity-30"
          >
            <AlignStartHorizontal className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={!selectedItem}
            onClick={() => handleAlignSelected('fit-width')}
            title={`Escalar al ancho total útil (${sheetWidthCm} cm)`}
            className="p-1.5 rounded text-stone-300 hover:bg-stone-800 hover:text-white disabled:opacity-30"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          <span className="h-4 w-px bg-stone-800 mx-0.5" />

          <button
            type="button"
            disabled={!selectedItem}
            onClick={() => handleDuplicateSelected(1)}
            title="Duplicar objeto seleccionado (Ctrl+D)"
            className="p-1.5 rounded text-emerald-300 hover:bg-stone-800 disabled:opacity-30"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={!selectedItem}
            onClick={handleFillRowWithSelected}
            title="Rellenar toda la fila horizontal con este diseño"
            className="px-2 py-1 rounded text-[11px] font-semibold text-emerald-300 hover:bg-stone-800 disabled:opacity-30"
          >
            Rellenar fila
          </button>
          <button
            type="button"
            disabled={!selectedItem}
            onClick={handleDeleteSelected}
            title="Eliminar objeto seleccionado (Supr)"
            className="p-1.5 rounded text-red-400 hover:bg-stone-800 disabled:opacity-30"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Bloque Derecho: Auto-Agrupar (Auto Nest) + Exportar Plancha DTF */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!canvasItems.length}
            onClick={handleAutoNestAll}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold text-xs flex items-center gap-1.5 shadow transition cursor-pointer"
            title="Compacta automáticamente todas las imágenes para gastar el mínimo de metros posibles"
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>Auto-Compactar ({sheetWidthCm} cm)</span>
          </button>

          <select
            aria-label="Resolución"
            value={dpi}
            onChange={(e) => updateState((prev) => ({ ...prev, dpi: Number(e.target.value) }))}
            className="bg-stone-950 border border-stone-700 rounded-lg px-2 py-1.5 text-xs font-mono text-stone-200"
            title="Resolución física de salida del archivo PNG"
          >
            {[150, 200, 300, 600].map((val) => (
              <option key={val} value={val}>
                {val} DPI
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={!canvasItems.length || busy || exceedsMemoryLimit}
            onClick={exportGangSheetPng}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:bg-stone-800 disabled:text-stone-500 text-stone-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/15 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>
              {busy
                ? 'Generando PNG...'
                : exceedsMemoryLimit
                ? `Bajar a ${dpi > 200 ? '200' : '150'} DPI`
                : `Descargar Plancha (${sheetWidthCm}×${usedHeightCm.toFixed(0)}cm)`}
            </span>
          </button>
        </div>
      </div>

      {/* ====================================================================
          2. CUERPO PRINCIPAL: SIDEBAR IZQUIERDO (GALERÍA + INSPECTOR) + MESA CENTRAL
      ==================================================================== */}
      <div className="flex-1 flex overflow-hidden">
        {/* ------------------------------------------------------------------
            SIDEBAR IZQUIERDO (~340px): SUBIDA + GALERÍA + INSPECTOR DE OBJETO
        ------------------------------------------------------------------ */}
        <aside className="w-80 xl:w-[350px] bg-stone-900 border-r border-stone-800 flex flex-col overflow-y-auto shrink-0">
          {/* Bloque 1: Subida Drag & Drop + Galería de Imágenes */}
          <div className="p-3.5 border-b border-stone-800 space-y-3">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingUpload(true);
              }}
              onDragLeave={() => setIsDraggingUpload(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingUpload(false);
                handleUploadFiles(e.dataTransfer?.files);
              }}
              className={`rounded-xl border-2 border-dashed p-3 text-center transition ${
                isDraggingUpload
                  ? 'border-emerald-400 bg-emerald-500/10'
                  : 'border-stone-700 bg-stone-950/70 hover:border-emerald-500/60'
              }`}
            >
              <label className="cursor-pointer flex flex-col items-center gap-1.5">
                <div className="w-8 h-8 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                  <Upload className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-stone-200">
                  Arrastra tus diseños aquí o haz clic para subir
                </span>
                <span className="text-[10px] text-stone-400">
                  PNG transparente (recomendado 300 DPI), WebP o JPG
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  className="sr-only"
                  onChange={(e) => {
                    handleUploadFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>

            {/* Botones rápidos de importación y recorte automático */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={syncStudioDesign}
                className="flex-1 py-1.5 px-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 text-xs font-semibold text-emerald-300 flex items-center justify-center gap-1.5 transition"
                title="Trae o actualiza el diseño que estás editando en el estudio principal"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Traer diseño del Estudio</span>
              </button>
              <button
                type="button"
                onClick={openAutoBuildModal}
                disabled={!assets.length}
                className="py-1.5 px-2.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-xs font-semibold text-indigo-300 flex items-center gap-1 transition disabled:opacity-40"
                title="Definir cantidades y tamaños en lote para armar la plancha automáticamente"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Auto-Build</span>
              </button>
            </div>

            <label className="flex items-center justify-between text-[11px] text-stone-400 cursor-pointer pt-0.5">
              <span>Recortar bordes transparentes al subir</span>
              <input
                type="checkbox"
                checked={autoTrimOnUpload}
                onChange={(e) => setAutoTrimOnUpload(e.target.checked)}
                className="w-3.5 h-3.5 accent-emerald-400 rounded"
              />
            </label>

            {/* Cuadrícula de imágenes subidas (estilo Taker.es: clic para insertar en la plancha) */}
            <div>
              <div className="flex items-center justify-between text-[11px] text-stone-400 mb-1.5">
                <span className="font-semibold text-stone-300">
                  Mis Imágenes ({assets.length})
                </span>
                <span>Clic en miniatura = +1 copia</span>
              </div>
              {assets.length === 0 ? (
                <p className="text-center py-4 text-xs text-stone-500">
                  Sube una o varias imágenes para empezar a armar tus metros DTF.
                </p>
              ) : (
                <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto pr-1">
                  {assets.map((asset) => (
                    <AssetThumbnail
                      key={asset.id}
                      asset={asset}
                      usageCount={usageCounts[asset.id] || 0}
                      onAddClick={(a) => addAssetInstanceToSheet(a, null, 1)}
                      onRemoveAsset={handleRemoveAsset}
                      onTrimAsset={handleTrimAsset}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Bloque 2: Inspector del Objeto Seleccionado (Clonado de SettingPanel de Taker.es) */}
          <div className="flex-1 p-3.5 flex flex-col justify-between gap-4">
            {!selectedItem ? (
              <div className="my-auto py-8 px-4 text-center rounded-xl border border-stone-800/80 bg-stone-950/50 space-y-2">
                <MousePointer className="w-8 h-8 text-stone-500 mx-auto" />
                <p className="text-xs font-semibold text-stone-300">
                  Selecciona un objeto en la plancha para editar
                </p>
                <p className="text-[11px] text-stone-500 leading-relaxed">
                  Haz clic sobre cualquier diseño colocado en el rollo central para ajustar sus centímetros exactos, multiplicarlo por cantidad o rellenar filas.
                </p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {/* Encabezado del objeto seleccionado y su resolución en vivo */}
                <div className="flex items-start justify-between gap-2 border-b border-stone-800 pb-2.5">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate" title={selectedItem.name}>
                      {selectedItem.name}
                    </div>
                    <div className="text-[10px] text-stone-400 font-mono mt-0.5">
                      Posición: X {selectedItem.x.toFixed(1)} cm · Y {selectedItem.y.toFixed(1)} cm
                    </div>
                  </div>
                  {selectedEffectiveDpi !== null && (
                    <span
                      className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                        getResolutionColorInfo(selectedEffectiveDpi).badgeClass
                      }`}
                    >
                      {selectedEffectiveDpi} DPI
                    </span>
                  )}
                </div>

                {/* Dimensiones Físicas (Ancho cm / Alto cm + Candado de Proporción) */}
                <div className="bg-stone-950 border border-stone-800 rounded-xl p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-stone-200">Dimensiones del Diseño</span>
                    <button
                      type="button"
                      onClick={() => updateSelectedItem({ keepAspect: !selectedItem.keepAspect })}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 border transition ${
                        selectedItem.keepAspect
                          ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                          : 'border-stone-700 text-stone-400'
                      }`}
                      title="Mantener relación de aspecto al cambiar ancho o alto"
                    >
                      {selectedItem.keepAspect ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                      <span>{selectedItem.keepAspect ? 'Proporción fija' : 'Libre'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[11px] text-stone-400">
                      Ancho (cm)
                      <input
                        type="number"
                        min="0.5"
                        max={sheetWidthCm}
                        step="0.5"
                        value={selectedItem.width}
                        onChange={(e) => handleResizeSelectedCm('width', e.target.value)}
                        className="mt-1 w-full rounded-lg bg-stone-900 border border-stone-700 px-2.5 py-1.5 text-xs font-mono text-white"
                      />
                    </label>
                    <label className="text-[11px] text-stone-400">
                      Alto (cm)
                      <input
                        type="number"
                        min="0.5"
                        max="300"
                        step="0.5"
                        value={selectedItem.height}
                        onChange={(e) => handleResizeSelectedCm('height', e.target.value)}
                        className="mt-1 w-full rounded-lg bg-stone-900 border border-stone-700 px-2.5 py-1.5 text-xs font-mono text-white"
                      />
                    </label>
                  </div>

                  {/* Presets comerciales rápidos (Pecho, Espalda, Manga...) */}
                  <div className="pt-1">
                    <span className="text-[10px] text-stone-400 block mb-1">Medidas rápidas DTF:</span>
                    <div className="flex flex-wrap gap-1">
                      {DTF_SIZE_PRESETS.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => handleResizeSelectedCm('width', preset.widthCm)}
                          className="px-2 py-0.5 rounded bg-stone-900 hover:bg-stone-800 border border-stone-700 text-[10px] text-stone-300 transition"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Bloque de Multiplicación / Auto-Duplicado con Margen (Clon de Taker.es) */}
                <div className="bg-stone-950 border border-stone-800 rounded-xl p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-stone-200">
                      Multiplicar / Repetir Imagen
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400">
                      En plancha: {usageCounts[selectedItem.assetId] || 1} uds
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 items-end">
                    <label className="text-[11px] text-stone-400">
                      Copias a añadir
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={duplicateQty}
                        onChange={(e) => setDuplicateQty(clamp(Number(e.target.value) || 1, 1, 100))}
                        className="mt-1 w-full rounded-lg bg-stone-900 border border-stone-700 px-2.5 py-1.5 text-xs font-mono text-white"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => handleDuplicateSelected(duplicateQty)}
                      className="py-1.5 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Añadir {duplicateQty}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={handleFillRowWithSelected}
                      className="py-1.5 px-2 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-700 text-[11px] font-semibold text-emerald-300 flex items-center justify-center gap-1 transition"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Rellenar fila ({sheetWidthCm}cm)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => selectedAsset && handleTrimAsset(selectedAsset.id)}
                      className="py-1.5 px-2 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-700 text-[11px] font-semibold text-stone-200 flex items-center justify-center gap-1 transition"
                    >
                      <Scissors className="w-3 h-3" />
                      <span>Recortar borde vacío</span>
                    </button>
                  </div>
                </div>

                {/* Capas y Eliminación */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleAlignSelected('front')}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-stone-950 hover:bg-stone-800 border border-stone-800 text-[11px] text-stone-300 flex items-center justify-center gap-1"
                  >
                    <ArrowUp className="w-3 h-3" /> Traer al frente
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAlignSelected('back')}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-stone-950 hover:bg-stone-800 border border-stone-800 text-[11px] text-stone-300 flex items-center justify-center gap-1"
                  >
                    <ArrowDown className="w-3 h-3" /> Enviar atrás
                  </button>
                </div>
              </div>
            )}

            {/* Resumen de la Bobina Comercial en la base del sidebar */}
            <div className="rounded-xl border border-stone-800 bg-stone-950 p-3 space-y-1.5 text-xs">
              <div className="flex items-center justify-between font-bold text-stone-200">
                <span>Resumen del Rollo DTF</span>
                <span className="text-emerald-400 font-mono">
                  {sheetWidthCm} × {usedHeightCm.toFixed(1)} cm
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-stone-400">
                <span>Metros lineales requeridos:</span>
                <span className="font-mono text-stone-200 font-semibold">
                  {(usedHeightCm / 100).toFixed(2)} m ({canvasItems.length} piezas)
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-stone-400">
                <span>Aprovechamiento de superficie:</span>
                <span className="font-mono text-emerald-300">
                  {utilizationStats.utilizationPercent.toFixed(1)}%
                </span>
              </div>

              {(overlappingIds.size > 0 || offboardIds.size > 0) && (
                <div className="mt-1.5 rounded-lg border border-amber-500/50 bg-amber-950/40 p-2 text-[11px] text-amber-200 flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    {offboardIds.size > 0 && (
                      <div>• {offboardIds.size} diseño(s) sobresalen del ancho de {sheetWidthCm} cm.</div>
                    )}
                    {overlappingIds.size > 0 && (
                      <div>• {overlappingIds.size} diseño(s) se solapan entre sí. Pulsa <strong>Auto-Compactar</strong>.</div>
                    )}
                  </div>
                </div>
              )}

              {error && (
                <p role="alert" className="rounded border border-red-800 bg-red-950/50 p-2 text-[11px] text-red-200">
                  {error}
                </p>
              )}
            </div>
          </div>
        </aside>

        {/* ------------------------------------------------------------------
            3. LIENZO CENTRAL INTERACTIVO (BOBINA VERTICAL 58-60 CM + REGLAS + CONTROLES FLOTANTES)
        ------------------------------------------------------------------ */}
        <div className="flex-1 relative flex flex-col overflow-hidden bg-stone-950">
          {/* PANEL FLOTANTE SUPERIOR IZQUIERDO: Líneas de Resolución y Líneas Superpuestas (Clonado de Taker.es) */}
          <div className="absolute top-3 left-3 z-20 w-64 rounded-xl border border-stone-700/90 bg-stone-900/95 backdrop-blur-md p-3 shadow-2xl space-y-2 text-xs">
            <label className="flex items-center gap-2 cursor-pointer font-medium text-stone-200">
              <input
                type="checkbox"
                checked={showOverlappingLines}
                onChange={(e) => setShowOverlappingLines(e.target.checked)}
                className="w-3.5 h-3.5 accent-emerald-400 rounded"
              />
              <span>Mostrar líneas superpuestas</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer font-medium text-stone-200">
              <input
                type="checkbox"
                checked={showResolutionLines}
                onChange={(e) => setShowResolutionLines(e.target.checked)}
                className="w-3.5 h-3.5 accent-emerald-400 rounded"
              />
              <span>Mostrar líneas de resolución</span>
            </label>

            {showResolutionLines && (
              <div className="pl-2 pt-1 space-y-1 text-[11px] text-stone-300 border-t border-stone-800">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                  <span>Resolución óptima &gt;= 300 DPI</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                  <span>Buena resolución &gt;= 250 DPI</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
                  <span>Baja resolución &gt;= 200 DPI</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-stone-950 border border-stone-500 inline-block" />
                  <span>Resolución deficiente &lt; 200 DPI</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                  <span>Imágenes superpuestas</span>
                </div>
              </div>
            )}

            {selectedItem && (
              <div className="pt-2 border-t border-stone-800 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px] text-stone-300 font-mono">
                <div>Izquierda: {selectedItem.x.toFixed(1)} cm</div>
                <div>Arriba: {selectedItem.y.toFixed(1)} cm</div>
                <div>Ancho: {selectedItem.width.toFixed(1)} cm</div>
                <div>Alto: {selectedItem.height.toFixed(1)} cm</div>
                <div className="col-span-2 text-emerald-400 font-bold pt-0.5">
                  Resolución: {selectedEffectiveDpi} DPI
                </div>
              </div>
            )}
          </div>

          {/* BARRA FLOTANTE SUPERIOR DERECHA: Zoom y Fondo de Previsualización */}
          <div className="absolute top-3 right-5 z-20 flex items-center gap-2">
            {/* Selector de color de mesa / film */}
            <div className="flex items-center bg-stone-900/95 border border-stone-700 rounded-xl p-1 shadow-xl text-[11px]">
              {[
                { id: 'checker', label: 'Transp.' },
                { id: 'film', label: 'Film DTF' },
                { id: 'dark', label: 'Negro' },
                { id: 'white', label: 'Blanco' }
              ].map((bg) => (
                <button
                  key={bg.id}
                  type="button"
                  onClick={() => setArtboardBg(bg.id)}
                  className={`px-2 py-1 rounded-lg font-medium transition ${
                    artboardBg === bg.id
                      ? 'bg-emerald-500 text-stone-950 font-bold'
                      : 'text-stone-300 hover:text-white'
                  }`}
                >
                  {bg.label}
                </button>
              ))}
            </div>

            {/* Controles de Zoom */}
            <div className="flex items-center bg-stone-900/95 border border-stone-700 rounded-xl p-1 shadow-xl">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.35, Number((z - 0.12).toFixed(2))))}
                className="p-1.5 text-stone-300 hover:text-white"
                title="Alejar vista"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setZoom(0.88)}
                className="px-2 text-xs font-mono text-stone-200 hover:text-emerald-400"
                title="Restablecer ajuste de pantalla"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(2.2, Number((z + 0.12).toFixed(2))))}
                className="p-1.5 text-stone-300 hover:text-white"
                title="Acercar vista"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ÁREA DESPLAZABLE DEL ROLLO VERTICAL DTF (58-60 CM DE ANCHO × LARGO DINÁMICO) */}
          <div
            ref={artboardScrollRef}
            onMouseDown={(e) => {
              if (e.target === artboardScrollRef.current || e.target === artboardSurfaceRef.current) {
                setSelectedItemId(null);
              }
            }}
            className="flex-1 overflow-auto flex flex-col items-center justify-start pt-6 pb-20 px-8"
          >
            <div className="inline-flex flex-col items-start shadow-2xl">
              {/* REGLA HORIZONTAL SUPERIOR (0 cm ... 58/60 cm) */}
              <div className="flex items-end sticky top-0 z-10 shadow">
                <div className="w-9 h-7 bg-stone-900 border-t border-l border-stone-700 rounded-tl-lg flex items-center justify-center text-[10px] font-mono text-emerald-400 font-bold">
                  cm
                </div>
                <div
                  className="relative h-7 bg-stone-900 border-t border-r border-b border-stone-700 rounded-tr-lg overflow-hidden"
                  style={{ width: `${artboardWidthPx}px` }}
                >
                  {horizontalTicks.map((cm) => {
                    const leftPx = cm * pxPerCm;
                    const isMajor = cm % 10 === 0 || cm === sheetWidthCm;
                    return (
                      <div
                        key={cm}
                        className="absolute bottom-0 flex flex-col items-center"
                        style={{ left: `${leftPx}px`, transform: 'translateX(-50%)' }}
                      >
                        {isMajor && (
                          <span className="text-[10px] font-mono text-stone-200 mb-0.5 leading-none">
                            {cm}
                          </span>
                        )}
                        <div className={`w-px ${isMajor ? 'h-2.5 bg-emerald-400' : 'h-1.5 bg-stone-500'}`} />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* CUERPO DEL ROLLO VERTICAL: REGLA IZQUIERDA + SUPERFICIE INTERACTIVA */}
              <div className="flex items-stretch">
                {/* Regla Vertical Izquierda (Largo en cm) */}
                <div
                  className="relative w-9 bg-stone-900 border-l border-b border-r border-stone-700 rounded-bl-lg overflow-hidden shrink-0"
                  style={{ height: `${artboardHeightPx}px` }}
                >
                  {verticalTicks.map((cm) => {
                    const topPx = cm * pxPerCm;
                    const isMeter = cm > 0 && cm % 100 === 0;
                    return (
                      <div
                        key={cm}
                        className="absolute right-0 flex items-center gap-1"
                        style={{ top: `${topPx}px`, transform: 'translateY(-50%)' }}
                      >
                        <span
                          className={`text-[9px] font-mono leading-none ${
                            isMeter ? 'text-emerald-400 font-bold' : 'text-stone-400'
                          }`}
                        >
                          {cm}
                        </span>
                        <div className={`h-px ${isMeter ? 'w-3 bg-emerald-400' : 'w-1.5 bg-stone-500'}`} />
                      </div>
                    );
                  })}
                </div>

                {/* MESA DE MONTAJE DEL ROLLO DTF (58-60 CM DE ANCHO) */}
                <div
                  ref={artboardSurfaceRef}
                  onMouseDown={(e) => {
                    if (e.target === artboardSurfaceRef.current) {
                      setSelectedItemId(null);
                    }
                  }}
                  className={`relative border-r-2 border-b-2 transition-colors ${
                    offboardIds.size > 0 ? 'border-red-500' : 'border-stone-600'
                  }`}
                  style={{
                    width: `${artboardWidthPx}px`,
                    height: `${artboardHeightPx}px`,
                    ...getArtboardSurfaceStyle()
                  }}
                >
                  {/* Cuadrícula milimetrada / centimetrada opcional */}
                  {showGrid && (
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        backgroundImage:
                          'linear-gradient(to right, rgba(24,24,27,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(24,24,27,0.12) 1px, transparent 1px)',
                        backgroundSize: `${pxPerCm * 2}px ${pxPerCm * 2}px`
                      }}
                    />
                  )}

                  {/* Marcas horizontales de cada Metro Lineal (100 cm = 1 Metro, 200 cm = 2 Metros) */}
                  {meterMarkers.map((cm) => (
                    <div
                      key={cm}
                      className="absolute inset-x-0 border-t border-dashed border-indigo-500/70 pointer-events-none flex justify-end pr-2"
                      style={{ top: `${cm * pxPerCm}px` }}
                    >
                      <span className="-mt-2.5 bg-indigo-600 text-white text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shadow">
                        {cm / 100} {cm === 100 ? 'METRO' : 'METROS'} ({cm} cm)
                      </span>
                    </div>
                  ))}

                  {/* ELEMENTOS INTERACTIVOS COLOCADOS EN LA PLANCHA */}
                  {canvasItems.map((item) => {
                    const isSelected = item.id === selectedItemId;
                    const isOverlapping = overlappingIds.has(item.id);
                    const isOffboard = offboardIds.has(item.id);
                    const asset = assetsMap.get(item.assetId);
                    const itemDpi = computeItemEffectiveDpi(item, asset);
                    const resInfo = getResolutionColorInfo(itemDpi);

                    // Determinar el color del borde según el modo de inspección de Taker.es
                    let borderColor = 'transparent';
                    if (showOverlappingLines && (isOverlapping || isOffboard)) {
                      borderColor = isOffboard ? '#ef4444' : '#3b82f6'; // Rojo si sale del rollo, Azul si se pisa
                    } else if (showResolutionLines) {
                      borderColor = resInfo.color;
                    }

                    const leftPx = item.x * pxPerCm;
                    const topPx = item.y * pxPerCm;
                    const widthPx = item.width * pxPerCm;
                    const heightPx = item.height * pxPerCm;
                    const imgSrc = assetUrls[item.assetId];

                    return (
                      <div
                        key={item.id}
                        onMouseDown={(e) => startItemInteraction(e, item, 'move')}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setSelectedItemId(item.id);
                          handleDuplicateSelected(1);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSelectedItemId(item.id);
                          setContextMenu({
                            x: e.clientX,
                            y: e.clientY,
                            itemId: item.id
                          });
                        }}
                        style={{
                          left: `${leftPx}px`,
                          top: `${topPx}px`,
                          width: `${widthPx}px`,
                          height: `${heightPx}px`,
                          outline: isSelected
                            ? '2px solid #10b981'
                            : borderColor !== 'transparent'
                            ? `2px solid ${borderColor}`
                            : '1px dashed rgba(120,113,108,0.4)'
                        }}
                        className={`absolute group select-none ${
                          panMode ? 'cursor-grab' : 'cursor-move'
                        } ${isSelected ? 'z-10 shadow-xl' : 'z-0'}`}
                      >
                        {/* Imagen renderizada con su rotación y espejo */}
                        <div className="w-full h-full overflow-hidden flex items-center justify-center pointer-events-none">
                          {imgSrc && (
                            <img
                              src={imgSrc}
                              alt={item.name}
                              draggable={false}
                              style={{
                                width:
                                  Math.abs(item.rotation || 0) % 180 === 90
                                    ? `${heightPx}px`
                                    : `${widthPx}px`,
                                height:
                                  Math.abs(item.rotation || 0) % 180 === 90
                                    ? `${widthPx}px`
                                    : `${heightPx}px`,
                                maxWidth: 'none',
                                maxHeight: 'none',
                                transform: `rotate(${item.rotation || 0}deg) scale(${
                                  item.flipX ? -1 : 1
                                }, ${item.flipY ? -1 : 1})`
                              }}
                              className="object-fill select-none"
                            />
                          )}
                        </div>

                        {/* Etiqueta flotante con medidas reales en cm sobre la pieza seleccionada */}
                        {isSelected && (
                          <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-stone-950/95 border border-emerald-500/60 px-1.5 py-0.5 text-[10px] font-mono text-emerald-300 shadow-lg pointer-events-none">
                            {item.width.toFixed(1)} × {item.height.toFixed(1)} cm · {itemDpi} DPI
                          </div>
                        )}

                        {/* Tiradores de redimensionado (Resize Handles) en las 4 esquinas y laterales */}
                        {isSelected && (
                          <>
                            <div
                              onMouseDown={(e) => startItemInteraction(e, item, 'resize', 'nw')}
                              className="absolute -top-1.5 -left-1.5 w-3 h-3 rounded-full bg-white border-2 border-emerald-500 cursor-nwse-resize shadow"
                            />
                            <div
                              onMouseDown={(e) => startItemInteraction(e, item, 'resize', 'ne')}
                              className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-white border-2 border-emerald-500 cursor-nesw-resize shadow"
                            />
                            <div
                              onMouseDown={(e) => startItemInteraction(e, item, 'resize', 'sw')}
                              className="absolute -bottom-1.5 -left-1.5 w-3 h-3 rounded-full bg-white border-2 border-emerald-500 cursor-nesw-resize shadow"
                            />
                            <div
                              onMouseDown={(e) => startItemInteraction(e, item, 'resize', 'se')}
                              className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-stone-950 cursor-nwse-resize shadow"
                              title="Arrastrar para cambiar tamaño en cm"
                            />
                            <div
                              onMouseDown={(e) => startItemInteraction(e, item, 'resize', 'e')}
                              className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-2.5 h-5 rounded bg-white border border-emerald-500 cursor-ew-resize shadow"
                            />
                            <div
                              onMouseDown={(e) => startItemInteraction(e, item, 'resize', 's')}
                              className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-2.5 rounded bg-white border border-emerald-500 cursor-ns-resize shadow"
                            />
                          </>
                        )}
                      </div>
                    );
                  })}

                  {/* LÍNEA DINÁMICA DE CORTE / FIN DE IMPRESIÓN (DEFINIDA POR EL LARGO DE LOS ELEMENTOS) */}
                  {usedHeightCm > 0 && (
                    <div
                      className="absolute inset-x-0 border-t-2 border-dashed border-amber-500 pointer-events-none flex items-center justify-between px-3 py-1 bg-stone-950/85 text-[11px] font-mono text-amber-300 shadow-lg"
                      style={{ top: `${usedHeightPx}px` }}
                    >
                      <span className="flex items-center gap-1.5 font-bold">
                        <Scissors className="w-3.5 h-3.5 text-amber-400" />
                        Línea de corte (Largo ocupado: {usedHeightCm.toFixed(1)} cm / {(usedHeightCm / 100).toFixed(2)} m)
                      </span>
                      <span className="text-[10px] text-stone-300">
                        Archivo final: {sheetWidthCm} × {usedHeightCm.toFixed(1)} cm @ {dpi} DPI
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ====================================================================
          MENÚ CONTEXTUAL DE CLIC DERECHO SOBRE UN DISEÑO (ESTILO TAKER.ES)
      ==================================================================== */}
      {contextMenu && (
        <div
          style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
          className="fixed z-50 w-52 rounded-xl border border-stone-700 bg-stone-900/95 backdrop-blur-md p-1.5 shadow-2xl text-xs text-stone-200"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              handleDuplicateSelected(1);
              setContextMenu(null);
            }}
            className="w-full px-2.5 py-1.5 rounded-lg hover:bg-stone-800 flex items-center gap-2 text-left"
          >
            <Copy className="w-3.5 h-3.5 text-emerald-400" />
            <span>Duplicar diseño (Ctrl+D)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              handleFillRowWithSelected();
              setContextMenu(null);
            }}
            className="w-full px-2.5 py-1.5 rounded-lg hover:bg-stone-800 flex items-center gap-2 text-left"
          >
            <Wand2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Rellenar fila ({sheetWidthCm} cm)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              handleRotateSelected(90);
              setContextMenu(null);
            }}
            className="w-full px-2.5 py-1.5 rounded-lg hover:bg-stone-800 flex items-center gap-2 text-left"
          >
            <RotateCw className="w-3.5 h-3.5 text-stone-400" />
            <span>Girar 90°</span>
          </button>
          <button
            type="button"
            onClick={() => {
              handleAlignSelected('center-h');
              setContextMenu(null);
            }}
            className="w-full px-2.5 py-1.5 rounded-lg hover:bg-stone-800 flex items-center gap-2 text-left"
          >
            <AlignHorizontalJustifyCenter className="w-3.5 h-3.5 text-stone-400" />
            <span>Centrar en el rollo</span>
          </button>
          <div className="my-1 border-t border-stone-800" />
          <button
            type="button"
            onClick={() => {
              handleDeleteSelected();
              setContextMenu(null);
            }}
            className="w-full px-2.5 py-1.5 rounded-lg hover:bg-red-950/50 text-red-400 flex items-center gap-2 text-left"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Eliminar de la plancha</span>
          </button>
        </div>
      )}

      {/* ====================================================================
          MODAL "CREACIÓN AUTOMÁTICA (AUTO BUILD)" POR LOTES (CLON DE TAKER.ES)
      ==================================================================== */}
      {showAutoBuildModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-2xl border border-stone-700 bg-stone-900 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  Creación Automática de Metros DTF ({sheetWidthCm} cm de ancho)
                </h3>
                <p className="text-xs text-stone-400 mt-0.5">
                  Indica el ancho y la cantidad total de copias de cada diseño para empaquetar toda la plancha automáticamente.
                </p>
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {autoBuildDraft.map((row, index) => (
                <div
                  key={row.assetId}
                  className="grid grid-cols-12 items-center gap-2 rounded-xl border border-stone-800 bg-stone-950 p-2.5 text-xs"
                >
                  <div className="col-span-5 flex items-center gap-2 min-w-0">
                    {assetUrls[row.assetId] && (
                      <img
                        src={assetUrls[row.assetId]}
                        alt={row.name}
                        className="w-9 h-9 rounded bg-stone-800 object-contain p-0.5 shrink-0"
                      />
                    )}
                    <span className="truncate font-semibold text-stone-200">{row.name}</span>
                  </div>
                  <div className="col-span-4">
                    <label className="text-[10px] text-stone-400 block">Ancho (cm)</label>
                    <input
                      type="number"
                      min="1"
                      max={sheetWidthCm}
                      step="0.5"
                      value={row.widthCm}
                      onChange={(e) => {
                        const w = clamp(Number(e.target.value) || 1, 1, sheetWidthCm);
                        setAutoBuildDraft((prev) =>
                          prev.map((r, i) =>
                            i === index
                              ? { ...r, widthCm: w, heightCm: Number((w * r.aspect).toFixed(2)) }
                              : r
                          )
                        );
                      }}
                      className="w-full rounded bg-stone-900 border border-stone-700 px-2 py-1 font-mono text-white"
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="text-[10px] text-stone-400 block">Cantidad</label>
                    <input
                      type="number"
                      min="0"
                      max="200"
                      value={row.quantity}
                      onChange={(e) => {
                        const q = clamp(Number(e.target.value) || 0, 0, 200);
                        setAutoBuildDraft((prev) =>
                          prev.map((r, i) => (i === index ? { ...r, quantity: q } : r))
                        );
                      }}
                      className="w-full rounded bg-stone-900 border border-stone-700 px-2 py-1 font-mono text-white"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-800">
              <button
                type="button"
                onClick={() => setShowAutoBuildModal(false)}
                className="px-4 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-xs font-semibold text-stone-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={applyAutoBuildModal}
                className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-xs font-bold text-stone-950 flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Generar y Compactar Plancha</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
