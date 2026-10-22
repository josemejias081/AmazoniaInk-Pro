import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Download, Plus, RotateCcw, Trash2, Upload } from 'lucide-react';
import { addPngPhysicalResolutionToBlob, calculateRasterSize } from './utils/printProduction.js';
import { layoutGangSheet } from './utils/gangSheetLayout.js';

const DEFAULT_WIDTH_CM = 30;
const DEFAULT_DPI = 300;
const PREVIEW_MAX_WIDTH = 900;

const imageDataToCanvas = (imageData) => {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('El navegador no pudo crear el lienzo del diseño.');
  context.putImageData(imageData, 0, 0);
  return canvas;
};

const makeEntry = (imageData, name) => ({
  id: crypto.randomUUID(),
  imageData,
  name,
  widthCm: 10,
  copies: 1,
  rotation: 0
});

const drawPlacements = (context, placements, dpi, cutLines = false) => {
  const images = new Map();
  placements.forEach(({ entry }) => {
    if (!images.has(entry.id)) images.set(entry.id, imageDataToCanvas(entry.imageData));
  });

  placements.forEach(({ entry, x, y, width, height, rotated }) => {
    const image = images.get(entry.id);
    const imageWidthCm = rotated ? height : width;
    const imageHeightCm = rotated ? width : height;
    const pxWidth = (imageWidthCm / 2.54) * dpi;
    const pxHeight = (imageHeightCm / 2.54) * dpi;

    context.save();
    context.translate((x + width / 2) / 2.54 * dpi, (y + height / 2) / 2.54 * dpi);
    if (rotated) context.rotate(Math.PI / 2);
    context.drawImage(image, -pxWidth / 2, -pxHeight / 2, pxWidth, pxHeight);
    context.restore();

    if (cutLines) {
      context.save();
      const itemLeft = (x / 2.54) * dpi;
      const itemTop = (y / 2.54) * dpi;
      const itemW = (width / 2.54) * dpi;
      const itemH = (height / 2.54) * dpi;
      context.strokeStyle = 'rgba(120, 113, 108, 0.55)';
      context.lineWidth = Math.max(1, Math.round(dpi / 150));
      context.setLineDash([Math.max(3, Math.round(dpi / 60)), Math.max(3, Math.round(dpi / 60))]);
      context.strokeRect(itemLeft, itemTop, itemW, itemH);
      context.restore();
    }
  });
};

export default function GangSheet({ currentImageData, showToast }) {
  const [sheetWidthCm, setSheetWidthCm] = useState(DEFAULT_WIDTH_CM);
  const [dpi, setDpi] = useState(DEFAULT_DPI);
  const [gapMm, setGapMm] = useState(5);
  const [cutLines, setCutLines] = useState(true);
  const [entries, setEntries] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef(null);
  const initializedRef = useRef(false);

  const layout = useMemo(() => {
    if (!entries.length) return { placements: [], heightCm: 0 };
    try {
      return layoutGangSheet(entries, sheetWidthCm, gapMm / 10);
    } catch (layoutError) {
      return { placements: [], heightCm: 0, error: layoutError.message };
    }
  }, [entries, sheetWidthCm, gapMm]);

  useEffect(() => {
    if (initializedRef.current || !currentImageData) return;
    initializedRef.current = true;
    setEntries([makeEntry(currentImageData, 'Diseño actual')]);
  }, [currentImageData]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !layout.placements.length || layout.error) return;
    try {
      const previewScale = Math.min(
        1,
        PREVIEW_MAX_WIDTH / sheetWidthCm,
        Math.sqrt(8_000_000 / (sheetWidthCm * layout.heightCm))
      );
      canvas.width = Math.round(sheetWidthCm * previewScale);
      canvas.height = Math.max(1, Math.round(layout.heightCm * previewScale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('No se pudo actualizar la vista previa.');
      context.fillStyle = '#1c1917';
      context.fillRect(0, 0, canvas.width, canvas.height);
      drawPlacements(context, layout.placements, 2.54 * previewScale, cutLines);
      setError('');
    } catch (renderError) {
      setError(renderError.message);
    }
  }, [layout, sheetWidthCm, cutLines]);

  const updateEntry = (id, patch) => {
    setEntries(current => current.map(entry => entry.id === id ? { ...entry, ...patch } : entry));
  };

  const addFiles = async (files) => {
    setError('');
    const accepted = Array.from(files).filter(file => {
      const validType = ['image/png', 'image/jpeg', 'image/webp'].includes(file.type);
      const validExtension = /\.(png|jpe?g|webp)$/i.test(file.name || '');
      return validType || validExtension;
    });
    if (accepted.length !== files.length) {
      setError('Solo se admiten imágenes PNG, JPEG o WebP.');
      return;
    }
    try {
      const loaded = await Promise.all(accepted.map(async file => {
        const bitmap = await createImageBitmap(file);
        if (bitmap.width > 16000 || bitmap.height > 16000 || bitmap.width * bitmap.height > 40_000_000) {
          bitmap.close();
          throw new RangeError(`${file.name} supera el límite seguro de 40 megapíxeles por diseño.`);
        }
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) throw new Error(`No se pudo leer ${file.name}.`);
        context.drawImage(bitmap, 0, 0);
        bitmap.close();
        return makeEntry(context.getImageData(0, 0, canvas.width, canvas.height), file.name);
      }));
      setEntries(current => [...current, ...loaded]);
    } catch (loadError) {
      setError(`No se pudieron cargar las imágenes: ${loadError.message}`);
    }
  };

  const exportSheet = async () => {
    if (!layout.placements.length || layout.error) return;
    setBusy(true);
    setError('');
    try {
      const { width, height } = calculateRasterSize(sheetWidthCm / 2.54, layout.heightCm / 2.54, dpi);
      const output = document.createElement('canvas');
      output.width = width;
      output.height = height;
      const context = output.getContext('2d');
      if (!context) throw new Error('No se pudo crear el lienzo final.');
      context.clearRect(0, 0, width, height);
      drawPlacements(context, layout.placements, dpi, cutLines);
      const blob = await new Promise((resolve, reject) => {
        output.toBlob(value => value ? resolve(value) : reject(new Error('Falló la codificación PNG.')), 'image/png');
      });
      const physicalPng = await addPngPhysicalResolutionToBlob(blob, dpi);
      const url = URL.createObjectURL(physicalPng);
      const link = document.createElement('a');
      link.href = url;
      link.download = `plancha_DTF_${sheetWidthCm}x${layout.heightCm.toFixed(1)}cm_${dpi}DPI.png`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast(`Plancha DTF ${sheetWidthCm}×${layout.heightCm.toFixed(1)} cm exportada con metadatos de ${dpi} DPI.`);
    } catch (exportError) {
      setError(`No se pudo exportar la plancha: ${exportError.message}`);
    } finally {
      setBusy(false);
    }
  };

  const moveEntry = (index, direction) => {
    const destination = index + direction;
    if (destination < 0 || destination >= entries.length) return;
    setEntries(current => {
      const reordered = [...current];
      [reordered[index], reordered[destination]] = [reordered[destination], reordered[index]];
      return reordered;
    });
  };

  const estimatedPxW = Math.round((sheetWidthCm / 2.54) * dpi);
  const estimatedPxH = Math.round((layout.heightCm / 2.54) * dpi);
  const estimatedMegapixels = (estimatedPxW * estimatedPxH) / 1_000_000;
  const exceedsMemoryLimit = layout.heightCm > 0 && (estimatedMegapixels > 40 || estimatedPxW > 16000 || estimatedPxH > 16000);

  return (
    <section className="space-y-4" aria-label="Montador de planchas DTF">
      <header>
        <h2 className="text-base font-bold text-white">Montador de planchas DTF</h2>
        <p className="mt-1 text-xs text-stone-400">
          Acomoda varios diseños en una plancha transparente. Revisa el ancho compatible con tu rollo y RIP.
        </p>
      </header>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-stone-300">
          Ancho de rollo (cm)
          <select className="mt-1 w-full rounded bg-stone-900 border border-stone-700 p-2" value={sheetWidthCm} onChange={event => setSheetWidthCm(Number(event.target.value))}>
            {[30, 40, 58, 60].map(value => <option key={value} value={value}>{value} cm</option>)}
          </select>
        </label>
        <label className="text-xs text-stone-300">
          Separación (mm)
          <input className="mt-1 w-full rounded bg-stone-900 border border-stone-700 p-2" type="number" min="0" max="50" value={gapMm} onChange={event => setGapMm(Math.max(0, Math.min(50, Number(event.target.value) || 0)))} />
        </label>
        <label className="text-xs text-stone-300">
          Resolución
          <select className="mt-1 w-full rounded bg-stone-900 border border-stone-700 p-2" value={dpi} onChange={event => setDpi(Number(event.target.value))}>
            {[150, 200, 300, 600].map(value => <option key={value} value={value}>{value} DPI</option>)}
          </select>
        </label>
        <label className="text-xs text-stone-300">
          Añadir diseños
          <span className="mt-1 flex cursor-pointer items-center justify-center gap-2 rounded border border-stone-700 bg-stone-900 p-2 hover:bg-stone-800">
            <Upload size={14} /> Subir imágenes
            <input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={event => { addFiles(Array.from(event.target.files || [])); event.target.value = ''; }} />
          </span>
        </label>
        <label className="flex items-center justify-between text-xs text-stone-300 col-span-2 rounded border border-stone-800 bg-stone-900/60 p-2.5">
          <div>
            <span className="font-semibold block text-stone-200">Guías / Líneas de corte</span>
            <span className="text-[10px] text-stone-400">Dibuja marcas perimetrales para facilitar el corte manual con tijera o cúter</span>
          </div>
          <input
            type="checkbox"
            checked={cutLines}
            onChange={event => setCutLines(event.target.checked)}
            className="w-4 h-4 accent-emerald-400"
          />
        </label>
      </div>
      <div className="space-y-2">
        {entries.map(entry => (
          <div key={entry.id} className="grid grid-cols-[1fr_5rem_5rem_auto_auto_auto_auto] items-center gap-2 rounded-lg border border-stone-800 bg-stone-950 p-2">
            <span className="truncate text-xs text-stone-200" title={entry.name}>{entry.name}</span>
            <label className="text-[10px] text-stone-400">Ancho cm<input className="mt-1 w-full rounded bg-stone-900 p-1 text-xs text-white" type="number" min="1" max={sheetWidthCm} value={entry.widthCm} onChange={event => updateEntry(entry.id, { widthCm: Math.max(1, Number(event.target.value) || 1) })} /></label>
            <label className="text-[10px] text-stone-400">Copias<input className="mt-1 w-full rounded bg-stone-900 p-1 text-xs text-white" type="number" min="1" max="100" value={entry.copies} onChange={event => updateEntry(entry.id, { copies: Math.max(1, Math.min(100, Number(event.target.value) || 1)) })} /></label>
            <button type="button" title="Mover diseño arriba en el orden de planchado" disabled={entries[entries.indexOf(entry) - 1] === undefined} className="rounded p-2 text-stone-300 hover:bg-stone-800 disabled:opacity-30" onClick={() => moveEntry(entries.indexOf(entry), -1)}><ArrowUp size={15} /></button>
            <button type="button" title="Mover diseño abajo en el orden de planchado" disabled={entries[entries.indexOf(entry) + 1] === undefined} className="rounded p-2 text-stone-300 hover:bg-stone-800 disabled:opacity-30" onClick={() => moveEntry(entries.indexOf(entry), 1)}><ArrowDown size={15} /></button>
            <button type="button" title="Rotar 90 grados" className="rounded p-2 text-stone-300 hover:bg-stone-800" onClick={() => updateEntry(entry.id, { rotation: (entry.rotation + 90) % 360 })}><RotateCcw size={15} /></button>
            <button type="button" title="Eliminar diseño" className="rounded p-2 text-red-300 hover:bg-stone-800" onClick={() => setEntries(current => current.filter(item => item.id !== entry.id))}><Trash2 size={15} /></button>
          </div>
        ))}
        <button type="button" className="flex items-center gap-2 text-xs text-emerald-300" onClick={() => currentImageData && setEntries(current => [...current, makeEntry(currentImageData, `Diseño actual ${current.length + 1}`)])}>
          <Plus size={14} /> Añadir otra copia del diseño actual
        </button>
      </div>
      {layout.error && <p role="alert" className="rounded border border-red-800 bg-red-950/40 p-2 text-xs text-red-200">{layout.error}</p>}
      {error && <p role="alert" className="rounded border border-red-800 bg-red-950/40 p-2 text-xs text-red-200">{error}</p>}
      <div className="max-h-[65vh] overflow-auto rounded-lg border border-stone-700 bg-stone-900 p-3">
        {layout.placements.length
          ? <canvas ref={canvasRef} className="mx-auto max-w-full border border-stone-600" aria-label="Vista previa de la plancha DTF" />
          : <p className="p-8 text-center text-xs text-stone-400">Carga una imagen o añade el diseño actual para empezar.</p>}
      </div>
      <p className="text-xs text-stone-300">
        Plancha: {sheetWidthCm} × {layout.heightCm.toFixed(1)} cm · {layout.placements.length} diseños · {dpi} DPI · PNG transparente
      </p>
      <p className="text-xs text-stone-400">
        Utilización estimada: {layout.utilizationPercent?.toFixed(1) ?? '0.0'}% · Film: {(layout.heightCm / 100).toFixed(2)} m.
        Este cálculo no estima tinta ni incluye márgenes técnicos que pueda exigir tu RIP.
      </p>
      {exceedsMemoryLimit && (
        <div className="rounded-lg border border-amber-600/60 bg-amber-950/40 p-3 text-xs text-amber-200 space-y-1">
          <p className="font-semibold flex items-center gap-1.5">
            ⚠️ Plancha extensa ({estimatedMegapixels.toFixed(1)} MPx a {dpi} DPI)
          </p>
          <p className="text-[11px] text-amber-300/80 leading-relaxed">
            Esta plancha mide {(layout.heightCm / 100).toFixed(2)} m de largo y supera el límite de seguridad del navegador (40 MPx).
            Para imprimir rollos largos sin error de memoria, selecciona <strong>200 DPI</strong> o <strong>150 DPI</strong> (resolución recomendada para tiradas continuas en RIPs DTF).
          </p>
        </div>
      )}
      <button
        type="button"
        disabled={!layout.placements.length || !!layout.error || busy || exceedsMemoryLimit}
        onClick={exportSheet}
        className="flex w-full items-center justify-between rounded-lg bg-emerald-500 px-4 py-3 text-xs font-bold text-stone-950 disabled:cursor-not-allowed disabled:bg-stone-700 disabled:text-stone-400"
      >
        <span>{busy ? 'Preparando PNG…' : exceedsMemoryLimit ? `Supera 40 MPx (selecciona ${dpi > 200 ? '200 o 150' : '150'} DPI)` : 'Exportar plancha DTF'}</span>
        <Download size={16} />
      </button>
    </section>
  );
}
