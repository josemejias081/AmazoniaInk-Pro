import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Columns,
  Download,
  FileCheck2,
  Palette,
  RotateCcw,
  Shirt,
  Undo2,
  Upload
} from 'lucide-react';
import tshirtFrontImg from './assets/mockups/tshirt_front.jpg';
import tshirtBackImg from './assets/mockups/tshirt_back.jpg';
import hoodieFrontImg from './assets/mockups/hoodie_front.jpg';
import capFrontImg from './assets/mockups/cap_front.jpg';
import toteBagImg from './assets/mockups/tote_bag.jpg';
import bookCoverImg from './assets/mockups/book_cover.jpg';
import thermosBottleImg from './assets/mockups/thermos_bottle.jpg';
import {
  buildClientApprovalSheetMetadata,
  calculateArtworkPlacementOnProduct,
  computeCapCrownStripTransforms,
  computeCylindricalStripTransforms,
  computeMugHandle3DProjection,
  getMockupProductById,
  MOCKUP_COLOR_SWATCHES,
  MOCKUP_PRODUCTS
} from './utils/mockupEngine.js';
import { hexToRgb } from './utils/backgroundRemoval.js';

const PHOTO_ASSET_URLS = {
  'tshirt-front': tshirtFrontImg,
  'tshirt-back': tshirtBackImg,
  'hoodie-front': hoodieFrontImg,
  'cap-front': capFrontImg,
  'tote-bag': toteBagImg,
  'book-cover': bookCoverImg,
  'thermos-bottle': thermosBottleImg
};

// Caché en memoria de plantillas fotográficas procesadas (máscara + mapa de pliegues/sombras + caja delimitadora)
const processedPhotoCache = new Map();

const imageDataToCanvas = (imageData) => {
  if (!imageData) return null;
  const c = document.createElement('canvas');
  c.width = imageData.width;
  c.height = imageData.height;
  const ctx = c.getContext('2d');
  if (ctx) ctx.putImageData(imageData, 0, 0);
  return c;
};

const shadeHexColor = (hex, percent) => {
  const clean = (hex || '#18181b').replace('#', '');
  const num = parseInt(clean, 16) || 0;
  const r = Math.min(255, Math.max(0, ((num >> 16) & 255) + Math.round(2.55 * percent)));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 255) + Math.round(2.55 * percent)));
  const b = Math.min(255, Math.max(0, (num & 255) + Math.round(2.55 * percent)));
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};

/**
 * Procesa una fotografía de estudio real de producto blanco sobre fondo oscuro (#111113)
 * para extraer:
 * 1. `alphaMap`: máscara suave antialias de la zona recoloreable del producto
 * 2. `lumMap`: mapa de luminancia normalizado (pliegues, costuras, textura de algodón/lona, sombras 3D)
 * 3. `bbox`: rectángulo físico real del producto dentro de la fotografía
 */
const buildPhotorealisticTemplateData = (img, productId) => {
  const maxDim = 960;
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
  const w = Math.max(64, Math.round((img.naturalWidth || img.width) * scale));
  const h = Math.max(64, Math.round((img.naturalHeight || img.height) * scale));

  const baseCanvas = document.createElement('canvas');
  baseCanvas.width = w;
  baseCanvas.height = h;
  const baseCtx = baseCanvas.getContext('2d', { willReadFrequently: true });
  baseCtx.drawImage(img, 0, 0, w, h);
  const rawData = baseCtx.getImageData(0, 0, w, h).data;

  const total = w * h;
  const alphaMap = new Uint8ClampedArray(total);
  const lumMap = new Float32Array(total);

  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < h; y++) {
    const ny = y / h;
    const rowOffset = y * w;
    for (let x = 0; x < w; x++) {
      const nx = x / w;
      const p = rowOffset + x;
      const idx = p * 4;
      const r = rawData[idx];
      const g = rawData[idx + 1];
      const b = rawData[idx + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      // El fondo de estudio es gris carbón oscuro (~17..42). Cualquier píxel > 52 pertenece al producto.
      let maskAlpha = Math.max(0, Math.min(255, Math.round((lum - 46) * 5.2)));

      // En el Termo, preservar intactos el tapón negro mate y el anillo de acero inoxidable superior (ny < 0.252)
      if (productId === 'thermos-bottle' && ny < 0.252) {
        maskAlpha = 0;
      }

      // En el Libro, preservar intacto el bloque de páginas color crema del canto derecho (nx > 0.712)
      if (productId === 'book-cover' && nx > 0.712) {
        maskAlpha = 0;
      }

      alphaMap[p] = maskAlpha;
      // Normalizar luminancia respecto al blanco iluminado del estudio (~236)
      lumMap[p] = Math.max(0.08, Math.min(1.12, lum / 236));

      if (maskAlpha > 110) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX <= minX || maxY <= minY) {
    minX = Math.round(w * 0.2);
    maxX = Math.round(w * 0.8);
    minY = Math.round(h * 0.15);
    maxY = Math.round(h * 0.85);
  }

  return {
    width: w,
    height: h,
    rawData,
    alphaMap,
    lumMap,
    bbox: {
      minX,
      minY,
      maxX,
      maxY,
      width: Math.max(10, maxX - minX),
      height: Math.max(10, maxY - minY)
    }
  };
};

// Dibuja el fondo del estudio cuando se usa un soporte 3D procedural (Taza)
const drawStudioBackdrop = (ctx, w, h, studioTheme = 'dark') => {
  const grad = ctx.createRadialGradient(w * 0.5, h * 0.44, w * 0.08, w * 0.5, h * 0.5, w * 0.72);
  if (studioTheme === 'light') {
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.65, '#f1f5f9');
    grad.addColorStop(1, '#cbd5e1');
  } else if (studioTheme === 'warm') {
    grad.addColorStop(0, '#292524');
    grad.addColorStop(0.7, '#1c1917');
    grad.addColorStop(1, '#0c0a09');
  } else {
    grad.addColorStop(0, '#222226');
    grad.addColorStop(0.65, '#151518');
    grad.addColorStop(1, '#0c0c0e');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.fillStyle = studioTheme === 'light' ? 'rgba(15, 23, 42, 0.14)' : 'rgba(0, 0, 0, 0.5)';
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.88, w * 0.25, h * 0.032, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

/**
 * MOTOR FOTOGRÁFICO SMART-MOCKUP:
 * - Recolorea la fotografía real del producto a cualquier `productColor` conservando el 100% de las arrugas,
 *   costuras, textura de tela/lona, ojales de gorra, páginas del libro y cuello metálico del termo.
 * - Proyecta el diseño del usuario (`artCanvas`) con curvatura 3D (en Gorra, Termo o Portada de Libro) o plano (en Textil).
 * - Fusiona el mapa fotográfico real de pliegues y sombras POR ENCIMA del diseño estampado para lograr realismo fotográfico total.
 */
const renderPhotorealisticProductScene = (
  ctx,
  canvasW,
  canvasH,
  {
    template,
    productId,
    productColor,
    artCanvas,
    placement,
    finishMode,
    rotationDeg = 0,
    studioTheme = 'dark'
  }
) => {
  const { width: tw, height: th, rawData, alphaMap, lumMap, bbox } = template;

  // 1. Preparar el lienzo de estampado (`artLayer`) en las dimensiones nativas de la plantilla `tw × th`
  const artLayerCanvas = document.createElement('canvas');
  artLayerCanvas.width = tw;
  artLayerCanvas.height = th;
  const artCtx = artLayerCanvas.getContext('2d', { willReadFrequently: true });

  if (artCanvas && artCtx) {
    artCtx.save();
    artCtx.imageSmoothingEnabled = true;
    artCtx.imageSmoothingQuality = 'high';

    if (productId === 'thermos-bottle') {
      // Proyección Cilíndrica 3D sobre el cuerpo real del Termo fotográfico
      const cylRadius = bbox.width * 0.49;
      const cylCenterX = bbox.minX + bbox.width * 0.5;
      const wrapDeg = Math.max(50, Math.min(250, placement.widthRatio * 240));
      const strips = computeCylindricalStripTransforms({
        cylinderRadiusPx: cylRadius,
        artworkWidthPx: artCanvas.width,
        wrapAngleDeg: wrapDeg,
        rotationDeg,
        stripCount: 72
      });
      const artH = bbox.height * Math.min(0.84, placement.heightRatio * 0.78);
      const baseTopY = bbox.minY + (bbox.height - artH) * clamp01(placement.centerYRatio);

      strips.forEach((st) => {
        const curveY = (1 - st.verticalCurveOffsetRatio) * (cylRadius * 0.08);
        artCtx.drawImage(
          artCanvas,
          st.srcX,
          0,
          st.srcW,
          artCanvas.height,
          cylCenterX + st.destOffsetX,
          baseTopY + curveY,
          st.destW,
          artH
        );
      });
    } else if (productId === 'cap-front') {
      // Proyección con curvatura esférica/parabólica sobre la copa frontal de la Gorra fotográfica
      // En la foto de la gorra, la copa frontal va de bbox.minY a bbox.minY + bbox.height * 0.64 (debajo está la visera)
      const crownHeight = bbox.height * 0.62;
      const destW = bbox.width * Math.min(0.76, placement.widthRatio * 0.92);
      const destH = crownHeight * Math.min(0.75, placement.heightRatio * 0.85);
      const artCenterX = bbox.minX + bbox.width * placement.centerXRatio;
      const artCenterY = bbox.minY + crownHeight * Math.min(0.82, placement.centerYRatio * 1.15);

      // Recortar para que el diseño nunca invada la visera inferior de la gorra
      artCtx.beginPath();
      artCtx.rect(0, 0, tw, bbox.minY + crownHeight * 0.97);
      artCtx.clip();

      const strips = computeCapCrownStripTransforms({
        destWidthPx: destW,
        artworkWidthPx: artCanvas.width,
        archHeightPx: destH * 0.09,
        stripCount: 44
      });

      strips.forEach((st) => {
        const stripH = destH * st.scaleY;
        artCtx.drawImage(
          artCanvas,
          st.srcX,
          0,
          st.srcW,
          artCanvas.height,
          artCenterX + st.destOffsetX,
          artCenterY - stripH / 2 + st.archOffsetY,
          st.destW,
          stripH
        );
      });
    } else if (productId === 'book-cover') {
      // Proyección en perspectiva 2.5D alineada con el ángulo real de la portada del libro en la foto
      // En book_cover.jpg, el surco de bisagra izquierdo está en x ≈ minX + 0.08*bbox.width y el borde derecho de la tapa en maxX
      const coverLeft = bbox.minX + bbox.width * 0.075;
      const coverRight = bbox.maxX;
      const coverW = coverRight - coverLeft;
      const isFullCover = placement.zone.id === 'full-cover' && placement.widthRatio >= 0.82;

      const N = 48;
      for (let i = 0; i < N; i++) {
        const u0 = i / N;
        const u1 = (i + 1) / N;
        const uMid = (u0 + u1) * 0.5;
        // La portada real tiene una ligera perspectiva: el borde derecho es un 4.5% más alto que el borde del lomo izquierdo
        const topEdgeY = bbox.minY + bbox.height * (0.028 * (1 - uMid));
        const bottomEdgeY = bbox.maxY - bbox.height * (0.032 * (1 - uMid));
        const colCoverH = bottomEdgeY - topEdgeY;

        if (isFullCover) {
          const dx = coverLeft + u0 * coverW;
          const dw = (u1 - u0) * coverW + 0.6;
          artCtx.drawImage(
            artCanvas,
            u0 * artCanvas.width,
            0,
            (u1 - u0) * artCanvas.width,
            artCanvas.height,
            dx,
            topEdgeY,
            dw,
            colCoverH
          );
        } else {
          const drawW = coverW * Math.min(0.95, placement.widthRatio);
          const drawH = colCoverH * Math.min(0.95, placement.heightRatio);
          const cx = coverLeft + coverW * placement.centerXRatio;
          const cy = topEdgeY + colCoverH * placement.centerYRatio;
          const dx = cx - drawW / 2 + u0 * drawW;
          const dw = (u1 - u0) * drawW + 0.5;
          artCtx.drawImage(
            artCanvas,
            u0 * artCanvas.width,
            0,
            (u1 - u0) * artCanvas.width,
            artCanvas.height,
            dx,
            cy - drawH / 2,
            dw,
            drawH
          );
        }
      }
    } else {
      // Prendas Textiles (Camiseta Frontal, Camiseta Espalda, Hoodie, Tote Bag)
      // En camiseta/hoodie el ancho del torso excluye las mangas extendidas (~68% central del bbox total)
      const isGarmentWithSleeves =
        productId === 'tshirt-front' || productId === 'tshirt-back' || productId === 'hoodie-front';
      const torsoWidth = isGarmentWithSleeves ? bbox.width * 0.64 : bbox.width * 0.88;
      const torsoLeft = bbox.minX + (bbox.width - torsoWidth) * 0.5;

      // En Tote Bag las asas ocupan el 38% superior del bbox; el cuerpo de lona es el 62% inferior
      const bodyTop = productId === 'tote-bag' ? bbox.minY + bbox.height * 0.38 : bbox.minY;
      const bodyHeight = productId === 'tote-bag' ? bbox.height * 0.62 : bbox.height;

      const drawW = torsoWidth * placement.widthRatio;
      const drawH = bodyHeight * placement.heightRatio;
      const centerX = torsoLeft + torsoWidth * placement.centerXRatio;
      const centerY =
        productId === 'tote-bag'
          ? bodyTop + bodyHeight * ((placement.centerYRatio - 0.38) / 0.62)
          : bodyTop + bodyHeight * placement.centerYRatio;

      artCtx.drawImage(artCanvas, centerX - drawW / 2, centerY - drawH / 2, drawW, drawH);
    }

    artCtx.restore();
  }

  const artPixels = artCtx ? artCtx.getImageData(0, 0, tw, th).data : null;

  // 2. Fusión Fotográfica por Píxel (Recoloración del Producto + Fusión de Pliegues/Sombras Reales sobre el Diseño)
  const outCanvas = document.createElement('canvas');
  outCanvas.width = tw;
  outCanvas.height = th;
  const outCtx = outCanvas.getContext('2d');
  const outImg = outCtx.createImageData(tw, th);
  const dst = outImg.data;

  const targetRgb = hexToRgb(productColor);
  const targetLum = (0.299 * targetRgb.r + 0.587 * targetRgb.g + 0.114 * targetRgb.b) / 255;
  // En prendas oscuras (ej. Negro #141417 o Azul Marino #1e3a8a), realzamos el relieve de los pliegues iluminados
  // para que se vean todas las arrugas, costuras del cuello y textura real de la fotografía
  const darkGarmentHighlightBoost = (1 - targetLum) * 62;
  const glossBoost = finishMode === 'gloss' ? 18 : 0;

  const bgTint =
    studioTheme === 'light'
      ? { r: 232, g: 236, b: 242, replaceBg: true }
      : studioTheme === 'warm'
      ? { r: 26, g: 22, b: 20, replaceBg: true }
      : { r: 0, g: 0, b: 0, replaceBg: false };

  const totalPixels = tw * th;
  for (let p = 0; p < totalPixels; p++) {
    const idx = p * 4;
    const origR = rawData[idx];
    const origG = rawData[idx + 1];
    const origB = rawData[idx + 2];
    const maskA = alphaMap[p];

    if (maskA === 0) {
      if (bgTint.replaceBg && origR < 55 && origG < 55 && origB < 58) {
        // Adaptar suavemente el fondo del estudio conservando la sombra proyectada en el suelo
        const bgShadowFactor = Math.max(0.55, Math.min(1, (origR + 12) / 38));
        dst[idx] = Math.round(bgTint.r * bgShadowFactor);
        dst[idx + 1] = Math.round(bgTint.g * bgShadowFactor);
        dst[idx + 2] = Math.round(bgTint.b * bgShadowFactor);
      } else {
        dst[idx] = origR;
        dst[idx + 1] = origG;
        dst[idx + 2] = origB;
      }
      dst[idx + 3] = 255;
      continue;
    }

    const lum = lumMap[p]; // ~0.35 en pliegues profundos .. ~1.0 en crestas iluminadas

    // Color base de la tela/superficie en este píxel
    let baseR = targetRgb.r;
    let baseG = targetRgb.g;
    let baseB = targetRgb.b;

    // Mezclar con el diseño del usuario si cae sobre este píxel del producto
    let artAlphaNorm = 0;
    if (artPixels) {
      const aA = artPixels[idx + 3];
      if (aA > 0) {
        artAlphaNorm = aA / 255;
        baseR = baseR * (1 - artAlphaNorm) + artPixels[idx] * artAlphaNorm;
        baseG = baseG * (1 - artAlphaNorm) + artPixels[idx + 1] * artAlphaNorm;
        baseB = baseB * (1 - artAlphaNorm) + artPixels[idx + 2] * artAlphaNorm;
      }
    }

    // Aplicar sombreado fotográfico real (pliegues, costuras, textura de algodón/lona)
    // En zonas con diseño estampado, las sombras de los pliegues penetran un 82% para que el estampado siga cada arruga
    const shadowMultiplier = artAlphaNorm > 0 ? 0.18 + 0.82 * Math.min(1.06, lum) : Math.min(1.05, lum);
    const foldHighlight =
      Math.max(0, lum - 0.72) *
      (artAlphaNorm > 0 ? darkGarmentHighlightBoost * 0.45 + glossBoost : darkGarmentHighlightBoost + glossBoost);

    const shadedR = Math.min(255, Math.max(0, baseR * shadowMultiplier + foldHighlight));
    const shadedG = Math.min(255, Math.max(0, baseG * shadowMultiplier + foldHighlight));
    const shadedB = Math.min(255, Math.max(0, baseB * shadowMultiplier + foldHighlight));

    if (maskA >= 250) {
      dst[idx] = Math.round(shadedR);
      dst[idx + 1] = Math.round(shadedG);
      dst[idx + 2] = Math.round(shadedB);
    } else {
      const m = maskA / 255;
      dst[idx] = Math.round(origR * (1 - m) + shadedR * m);
      dst[idx + 1] = Math.round(origG * (1 - m) + shadedG * m);
      dst[idx + 2] = Math.round(origB * (1 - m) + shadedB * m);
    }
    dst[idx + 3] = 255;
  }

  outCtx.putImageData(outImg, 0, 0);

  // 3. Dibujar la fotografía procesada centrada y cubriendo el escenario del estudio
  ctx.fillStyle =
    studioTheme === 'light' ? '#e2e8f0' : studioTheme === 'warm' ? '#1c1917' : '#121215';
  ctx.fillRect(0, 0, canvasW, canvasH);

  const fitScale = Math.min(canvasW / tw, canvasH / th);
  const drawW = tw * fitScale;
  const drawH = th * fitScale;
  const offsetX = (canvasW - drawW) * 0.5;
  const offsetY = (canvasH - drawH) * 0.5;

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(outCanvas, offsetX, offsetY, drawW, drawH);
  ctx.restore();
};

const clamp01 = (v) => Math.max(0.05, Math.min(0.95, v));

// ============================================================================
// TAZA CERÁMICA 11 OZ 3D CON AGARRADERO (ASA) ORBITAL SINCRONIZADO CON EL CILINDRO
// ============================================================================
const renderCylindricalMug3D = (
  ctx,
  w,
  h,
  {
    productColor,
    artCanvas,
    placement,
    rotationDeg = 0,
    centerXOverride = null,
    scaleOverride = 1,
    angleBadge = null
  }
) => {
  const cx = centerXOverride !== null ? centerXOverride : w * 0.5;
  const s = scaleOverride;

  const radiusX = w * 0.165 * s;
  const bodyH = h * 0.55 * s;
  const topY = h * 0.53 - bodyH * 0.48;
  const bottomY = topY + bodyH;
  const ellipseRy = radiusX * 0.16;

  // Calcular proyección 3D exacta del agarradero (asa) solidario con `rotationDeg`
  const handleProj = computeMugHandle3DProjection({
    rotationDeg,
    cylinderRadiusPx: radiusX
  });

  // Dibuja el agarradero 3D en su posición orbital actual (detrás o delante del cilindro según depthZ)
  const drawOrbitingHandle = (isFrontPass) => {
    const attachX = cx + handleProj.attachOffsetX;
    const outerX = cx + handleProj.outerOffsetX;
    const upperJoinY = topY + bodyH * 0.18;
    const lowerJoinY = topY + bodyH * 0.78;
    const thickness = Math.max(7, 21 * s * handleProj.perspectiveThicknessScale);

    ctx.save();

    // Si el asa está en el hemisferio frontal, proyectar sombra suave del asa sobre la pared cerámica
    if (isFrontPass && handleProj.depthZ > 0.05) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(attachX, upperJoinY + 8 * s);
      ctx.bezierCurveTo(
        outerX - 6 * s,
        upperJoinY + 12 * s,
        outerX - 6 * s,
        lowerJoinY + 18 * s,
        attachX,
        lowerJoinY + 12 * s
      );
      ctx.lineWidth = thickness * 1.15;
      ctx.strokeStyle = `rgba(0, 0, 0, ${(0.22 * handleProj.depthZ).toFixed(2)})`;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();
    }

    // Bases elípticas 3D de unión cerámica donde el asa se funde con la pared cilíndrica
    if (isFrontPass) {
      const jointRx = Math.max(4, 11 * s * (0.45 + 0.55 * Math.abs(handleProj.cosT)));
      const jointRy = Math.max(7, 15 * s);
      [upperJoinY, lowerJoinY].forEach((jy) => {
        ctx.beginPath();
        ctx.ellipse(attachX, jy, jointRx, jointRy, 0, 0, Math.PI * 2);
        ctx.fillStyle = shadeHexColor(productColor, -14);
        ctx.fill();
      });
    }

    // Arco principal del agarradero 3D
    ctx.beginPath();
    ctx.moveTo(attachX, upperJoinY);
    ctx.bezierCurveTo(
      outerX,
      topY + bodyH * 0.1,
      outerX,
      topY + bodyH * 0.88,
      attachX,
      lowerJoinY
    );
    ctx.lineWidth = thickness;
    ctx.strokeStyle = shadeHexColor(productColor, handleProj.depthZ >= 0 ? -6 : -22);
    ctx.lineCap = 'round';
    ctx.stroke();

    // Brillo especular cerámico a lo largo del lomo del asa
    ctx.lineWidth = Math.max(3, thickness * 0.38);
    ctx.strokeStyle = shadeHexColor(productColor, handleProj.depthZ >= 0 ? 16 : -4);
    ctx.stroke();

    ctx.restore();
  };

  ctx.save();

  // Si el asa giró hacia la mitad trasera del cilindro, dibujarla ANTES del cuerpo para que el cilindro la ocluya
  if (!handleProj.isFrontHemisphere) {
    drawOrbitingHandle(false);
  }

  // Cuerpo cilíndrico base de la taza
  const buildCylinderPath = () => {
    ctx.beginPath();
    ctx.moveTo(cx - radiusX, topY);
    ctx.lineTo(cx - radiusX, bottomY);
    ctx.ellipse(cx, bottomY, radiusX, ellipseRy, 0, Math.PI, 0, true);
    ctx.lineTo(cx + radiusX, topY);
    ctx.ellipse(cx, topY, radiusX, ellipseRy, 0, 0, Math.PI, false);
    ctx.closePath();
  };

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.42)';
  ctx.shadowBlur = 26 * s;
  buildCylinderPath();
  const cylGrad = ctx.createLinearGradient(cx - radiusX, topY, cx + radiusX, topY);
  cylGrad.addColorStop(0, shadeHexColor(productColor, -20));
  cylGrad.addColorStop(0.28, shadeHexColor(productColor, 12));
  cylGrad.addColorStop(0.55, productColor);
  cylGrad.addColorStop(0.85, shadeHexColor(productColor, -10));
  cylGrad.addColorStop(1, shadeHexColor(productColor, -28));
  ctx.fillStyle = cylGrad;
  ctx.fill();
  ctx.restore();

  // Proyección cilíndrica 3D del diseño por micro-franjas verticales
  // Circunferencia física real de taza 11oz = 25.76 cm (360°).
  // Un diseño envolvente óptimo de 20.0 cm abarca (20.0 / 25.76) * 360° = 279.5° (±139.75°),
  // dejando ~30° (1.8 - 2.0 cm) de cerámica blanca sin estampar a AMBOS lados del asa (situada en 180°).
  if (artCanvas) {
    ctx.save();
    buildCylinderPath();
    ctx.clip();

    const mugCircumferenceCm = 25.76;
    const rawWrapDeg = (placement.effectiveWidthCm / mugCircumferenceCm) * 360;
    const wrapDeg = Math.max(35, Math.min(282, rawWrapDeg));
    const strips = computeCylindricalStripTransforms({
      cylinderRadiusPx: radiusX,
      artworkWidthPx: artCanvas.width,
      wrapAngleDeg: wrapDeg,
      rotationDeg,
      stripCount: 96
    });

    // Altura óptima vertical: máximo 8.8 cm sobre los 9.5 cm de la taza (~91%), dejando margen superior e inferior
    const artHeightPx = bodyH * Math.min(0.88, Math.max(0.22, placement.heightRatio * 0.91));
    const baseArtTopY = topY + (bodyH - artHeightPx) * placement.centerYRatio;

    strips.forEach((st) => {
      const curveY = (1 - st.verticalCurveOffsetRatio) * ellipseRy * 0.55;
      const dx = cx + st.destOffsetX;
      const dy = baseArtTopY + curveY;

      ctx.drawImage(
        artCanvas,
        st.srcX,
        0,
        st.srcW,
        artCanvas.height,
        dx,
        dy,
        st.destW,
        artHeightPx
      );

      if (st.edgeShadow > 0.01) {
        ctx.fillStyle = `rgba(0, 0, 0, ${st.edgeShadow})`;
        ctx.fillRect(dx, topY, st.destW, bodyH + ellipseRy);
      }
      if (st.specularHighlight > 0.01) {
        ctx.fillStyle = `rgba(255, 255, 255, ${st.specularHighlight})`;
        ctx.fillRect(dx, topY, st.destW, bodyH + ellipseRy);
      }
    });

    ctx.restore();
  }

  // Elipse interior de la boca de la taza cerámica
  ctx.beginPath();
  ctx.ellipse(cx, topY, radiusX, ellipseRy, 0, 0, Math.PI * 2);
  ctx.fillStyle = shadeHexColor(productColor, 6);
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(cx, topY + 2 * s, radiusX * 0.91, ellipseRy * 0.82, 0, 0, Math.PI * 2);
  const innerGrad = ctx.createLinearGradient(cx - radiusX, topY, cx + radiusX, topY);
  innerGrad.addColorStop(0, shadeHexColor(productColor, -28));
  innerGrad.addColorStop(0.6, shadeHexColor(productColor, -8));
  innerGrad.addColorStop(1, shadeHexColor(productColor, 5));
  ctx.fillStyle = innerGrad;
  ctx.fill();

  // Si el asa giró hacia el hemisferio frontal, dibujarla DESPUÉS del cilindro para que pase por delante en 3D
  if (handleProj.isFrontHemisphere) {
    drawOrbitingHandle(true);
  }

  if (angleBadge) {
    ctx.fillStyle = 'rgba(9, 9, 11, 0.85)';
    ctx.beginPath();
    ctx.roundRect(cx - 52, bottomY + ellipseRy + 12, 104, 22, 6);
    ctx.fill();
    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 11px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(angleBadge, cx, bottomY + ellipseRy + 27);
  }

  ctx.restore();
};

// FONDO EXTERIOR / BASE INFERIOR DE LA TAZA CERÁMICA
const renderMugBottomExterior = (ctx, w, h, { productColor, artCanvas, placement, rotationDeg = 0 }) => {
  const cx = w * 0.5;
  const cy = h * 0.5;
  const outerRadius = Math.min(w, h) * 0.31;
  const footRingOuter = outerRadius * 0.87;
  const footRingInner = outerRadius * 0.76;
  const recessRadius = footRingInner * 0.96;

  ctx.save();

  // Asa vista desde abajo girando solidariamente con `rotationDeg`
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(((rotationDeg || 0) * Math.PI) / 180);
  ctx.beginPath();
  ctx.roundRect(outerRadius * 0.88, -outerRadius * 0.16, outerRadius * 0.42, outerRadius * 0.32, 18);
  ctx.fillStyle = shadeHexColor(productColor, -14);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.48)';
  ctx.shadowBlur = 30;
  ctx.beginPath();
  ctx.arc(cx, cy, outerRadius, 0, Math.PI * 2);
  const bodyGrad = ctx.createRadialGradient(
    cx - outerRadius * 0.25,
    cy - outerRadius * 0.25,
    10,
    cx,
    cy,
    outerRadius
  );
  bodyGrad.addColorStop(0, shadeHexColor(productColor, 12));
  bodyGrad.addColorStop(0.75, productColor);
  bodyGrad.addColorStop(1, shadeHexColor(productColor, -22));
  ctx.fillStyle = bodyGrad;
  ctx.fill();
  ctx.restore();

  // Anillo cerámico de apoyo sin esmaltar (bizcocho cerámico)
  ctx.beginPath();
  ctx.arc(cx, cy, footRingOuter, 0, Math.PI * 2);
  ctx.arc(cx, cy, footRingInner, 0, Math.PI * 2, true);
  ctx.fillStyle = '#e7e2d8';
  ctx.fill();

  // Cavidad central esmaltada del fondo exterior
  ctx.beginPath();
  ctx.arc(cx, cy, footRingInner, 0, Math.PI * 2);
  const recessGrad = ctx.createRadialGradient(cx + 12, cy + 12, 8, cx, cy, footRingInner);
  recessGrad.addColorStop(0, productColor);
  recessGrad.addColorStop(0.8, shadeHexColor(productColor, -10));
  recessGrad.addColorStop(1, shadeHexColor(productColor, -26));
  ctx.fillStyle = recessGrad;
  ctx.fill();

  if (artCanvas) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, recessRadius, 0, Math.PI * 2);
    ctx.clip();

    ctx.translate(
      cx + (placement.centerXRatio - 0.5) * recessRadius * 1.2,
      cy + (placement.centerYRatio - 0.5) * recessRadius * 1.2
    );
    ctx.rotate(((rotationDeg || 0) * Math.PI) / 180);

    const drawW = outerRadius * 2 * Math.min(0.72, placement.widthRatio * 0.95);
    const drawH = outerRadius * 2 * Math.min(0.72, placement.heightRatio * 0.95);
    ctx.drawImage(artCanvas, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
  }

  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = '600 11px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('VISTA: FONDO EXTERIOR / BASE CERÁMICA DE LA TAZA', cx, cy + outerRadius + 28);

  ctx.restore();
};

// ============================================================================
// COMPONENTE PRINCIPAL: ESTUDIO DE MOCKUPS FOTORREALISTAS 3D & FICHAS
// ============================================================================
export default function MockupStudio({
  currentImageData,
  activeDesignName = 'Diseño actual',
  printWidthCm = 20,
  printHeightCm = 20,
  printDpi = 300,
  showToast = () => {},
  onExitMockups
}) {
  const [selectedProductId, setSelectedProductId] = useState('tshirt-front');
  const product = useMemo(() => getMockupProductById(selectedProductId), [selectedProductId]);

  const [selectedZoneId, setSelectedZoneId] = useState(product.zones[0].id);
  const [productColor, setProductColor] = useState(product.defaultColor);
  const [studioTheme, setStudioTheme] = useState('dark'); // 'dark' | 'warm' | 'light'
  const [finishMode, setFinishMode] = useState('matte'); // 'matte' | 'gloss'
  const [useZoneRecommendedSize, setUseZoneRecommendedSize] = useState(true);
  const [scaleMultiplier, setScaleMultiplier] = useState(1);
  const [offsetXPercent, setOffsetXPercent] = useState(0);
  const [offsetYPercent, setOffsetYPercent] = useState(0);
  const [rotationDeg, setRotationDeg] = useState(0);
  const [mugTripleView, setMugTripleView] = useState(false);

  // Plantilla fotográfica cargada para el producto actual (o foto propia subida por el taller)
  const [photoTemplate, setPhotoTemplate] = useState(null);
  const [customPhotoUrl, setCustomPhotoUrl] = useState(null);

  const [clientName, setClientName] = useState('');
  const [customNotes, setCustomNotes] = useState('');

  const canvasRef = useRef(null);
  const dragRef = useRef(null);

  const handleSelectProduct = (nextProdId) => {
    const nextProd = getMockupProductById(nextProdId);
    setSelectedProductId(nextProdId);
    setSelectedZoneId(nextProd.zones[0].id);
    setProductColor(nextProd.defaultColor);
    setCustomPhotoUrl(null);
    setOffsetXPercent(0);
    setOffsetYPercent(0);
    setScaleMultiplier(1);
    // En la taza 11oz iniciamos en vista 3/4 (-75°) donde se aprecia el diseño frontal, el margen libre de 1.8 cm y el asa a la derecha
    setRotationDeg(nextProdId === 'mug-wrap' ? -75 : 0);
    if (
      nextProdId === 'mug-wrap' ||
      nextProdId === 'mug-bottom' ||
      nextProdId === 'book-cover' ||
      nextProdId === 'thermos-bottle'
    ) {
      setFinishMode('gloss');
    } else {
      setFinishMode('matte');
    }
  };

  // Cargar y procesar la fotografía real de estudio para el soporte seleccionado
  useEffect(() => {
    const assetUrl = customPhotoUrl || PHOTO_ASSET_URLS[selectedProductId];
    if (!assetUrl) {
      setPhotoTemplate(null);
      return;
    }

    const cacheKey = `${selectedProductId}::${assetUrl}`;
    if (processedPhotoCache.has(cacheKey)) {
      setPhotoTemplate(processedPhotoCache.get(cacheKey));
      return;
    }

    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      const tpl = buildPhotorealisticTemplateData(img, selectedProductId);
      processedPhotoCache.set(cacheKey, tpl);
      setPhotoTemplate(tpl);
    };
    img.src = assetUrl;

    return () => {
      cancelled = true;
    };
  }, [selectedProductId, customPhotoUrl]);

  // Permitir al usuario subir una foto real de su propio producto (camiseta/gorra/sudadera de su taller)
  const handleUploadCustomProductPhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCustomPhotoUrl(reader.result);
        showToast('Fotografía de producto propia cargada en el motor Smart-Mockup.');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const placement = useMemo(
    () =>
      calculateArtworkPlacementOnProduct({
        productId: selectedProductId,
        zoneId: selectedZoneId,
        artworkWidthCm: printWidthCm,
        artworkHeightCm: printHeightCm,
        offsetXPercent,
        offsetYPercent,
        scaleMultiplier,
        useZoneRecommendedSize
      }),
    [
      selectedProductId,
      selectedZoneId,
      printWidthCm,
      printHeightCm,
      offsetXPercent,
      offsetYPercent,
      scaleMultiplier,
      useZoneRecommendedSize
    ]
  );

  const artCanvas = useMemo(() => imageDataToCanvas(currentImageData), [currentImageData]);

  // Renderizado unificado de la escena (Fotografía Real de Estudio o Taza 3D con Asa Orbital)
  const renderMockupScene = useCallback(
    (ctx, w, h) => {
      if (selectedProductId === 'mug-wrap') {
        drawStudioBackdrop(ctx, w, h, studioTheme);
        if (mugTripleView) {
          const views = [
            { angle: 75, x: w * 0.21, label: 'Lado Izq. (+75°)' },
            { angle: 0, x: w * 0.5, label: 'Centro (0°)' },
            { angle: -75, x: w * 0.79, label: 'Lado Der. + Asa (-75°)' }
          ];
          views.forEach((v) => {
            renderCylindricalMug3D(ctx, w, h, {
              productColor,
              artCanvas,
              placement,
              rotationDeg: v.angle,
              centerXOverride: v.x,
              scaleOverride: 0.66,
              angleBadge: v.label
            });
          });
        } else {
          renderCylindricalMug3D(ctx, w, h, {
            productColor,
            artCanvas,
            placement,
            rotationDeg
          });
        }
        return;
      }

      if (selectedProductId === 'mug-bottom') {
        drawStudioBackdrop(ctx, w, h, studioTheme);
        renderMugBottomExterior(ctx, w, h, {
          productColor,
          artCanvas,
          placement,
          rotationDeg
        });
        return;
      }

      if (photoTemplate) {
        renderPhotorealisticProductScene(ctx, w, h, {
          template: photoTemplate,
          productId: selectedProductId,
          productColor,
          artCanvas,
          placement,
          finishMode,
          rotationDeg,
          studioTheme
        });
      } else {
        drawStudioBackdrop(ctx, w, h, studioTheme);
      }
    },
    [
      selectedProductId,
      studioTheme,
      mugTripleView,
      productColor,
      artCanvas,
      placement,
      rotationDeg,
      photoTemplate,
      finishMode
    ]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    renderMockupScene(ctx, canvas.width, canvas.height);
  }, [renderMockupScene]);

  const handlePointerDown = (e) => {
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialOffsetX: offsetXPercent,
      initialOffsetY: offsetYPercent,
      initialRotation: rotationDeg
    };
  };

  const handlePointerMove = (e) => {
    const active = dragRef.current;
    if (!active) return;
    const dx = e.clientX - active.startX;
    const dy = e.clientY - active.startY;

    if (
      selectedProductId === 'mug-wrap' ||
      selectedProductId === 'thermos-bottle' ||
      selectedProductId === 'mug-bottom'
    ) {
      let nextRot = Math.round(active.initialRotation + dx * 0.55);
      // Permitir rotación continua de 360° (-180° a +180°) para poder ver tanto el frente como ambos márgenes junto al asa en 180°
      if (nextRot > 180) nextRot -= 360;
      if (nextRot < -180) nextRot += 360;
      setRotationDeg(nextRot);
    } else {
      setOffsetXPercent(
        Math.max(-32, Math.min(32, Number((active.initialOffsetX + dx * 0.08).toFixed(1))))
      );
      setOffsetYPercent(
        Math.max(-32, Math.min(32, Number((active.initialOffsetY + dy * 0.08).toFixed(1))))
      );
    }
  };

  const handlePointerUp = () => {
    dragRef.current = null;
  };

  const handleDownloadMockupPng = () => {
    const out = document.createElement('canvas');
    out.width = 1600;
    out.height = 1200;
    const ctx = out.getContext('2d');
    if (!ctx) return;
    renderMockupScene(ctx, out.width, out.height);

    const url = out.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = url;
    link.download = `mockup_${selectedProductId}_${activeDesignName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.png`;
    link.click();
    showToast(
      `Mockup Fotorrealista HD exportado (${product.name} · ${placement.effectiveWidthCm}×${placement.effectiveHeightCm} cm)`
    );
  };

  const handleDownloadApprovalSheet = () => {
    const meta = buildClientApprovalSheetMetadata({
      projectName: activeDesignName,
      productId: selectedProductId,
      zoneId: selectedZoneId,
      artworkWidthCm: placement.effectiveWidthCm,
      artworkHeightCm: placement.effectiveHeightCm,
      dpi: printDpi,
      productColorHex: productColor,
      clientName,
      notes: customNotes
    });

    const sheet = document.createElement('canvas');
    sheet.width = 1800;
    sheet.height = 1200;
    const ctx = sheet.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, 1800, 1200);

    const mockupTemp = document.createElement('canvas');
    mockupTemp.width = 1140;
    mockupTemp.height = 1040;
    renderMockupScene(mockupTemp.getContext('2d'), 1140, 1040);

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(40, 110, 1140, 1040, 20);
    ctx.clip();
    ctx.drawImage(mockupTemp, 40, 110);
    ctx.restore();

    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(40, 110, 1140, 1040, 20);
    ctx.stroke();

    ctx.fillStyle = '#10b981';
    ctx.font = '800 26px system-ui, sans-serif';
    ctx.fillText('AMAZONIAINK® PRO • FICHA DE APROBACIÓN DE PREIMPRESIÓN', 44, 62);
    ctx.fillStyle = '#a1a1aa';
    ctx.font = '600 18px ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(
      `CÓDIGO: ${meta.approvalCode} • FECHA: ${new Date().toLocaleDateString('es-ES')}`,
      1756,
      62
    );
    ctx.textAlign = 'left';

    const panelX = 1210;
    ctx.fillStyle = '#18181b';
    ctx.beginPath();
    ctx.roundRect(panelX, 110, 550, 1040, 20);
    ctx.fill();
    ctx.strokeStyle = '#27272a';
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 22px system-ui, sans-serif';
    ctx.fillText('ESPECIFICACIONES DEL PEDIDO', panelX + 32, 162);

    const rows = [
      ['Trabajo / Diseño:', meta.projectName],
      ['Cliente / Taller:', meta.clientName],
      ['Soporte / Producto:', meta.productName],
      ['Ubicación / Zona:', meta.zoneLabel],
      ['Técnica sugerida:', meta.technique],
      ['Medida Impresión:', meta.artworkDimensionsCm],
      ['Resolución Archivo:', meta.resolutionDpi],
      ['Color de Soporte:', meta.productColorHex]
    ];

    rows.forEach(([label, val], idx) => {
      const y = 220 + idx * 54;
      ctx.fillStyle = '#a1a1aa';
      ctx.font = '500 16px system-ui, sans-serif';
      ctx.fillText(label, panelX + 32, y);

      ctx.fillStyle = '#34d399';
      ctx.font = '700 17px ui-monospace, monospace';
      ctx.fillText(String(val).slice(0, 28), panelX + 225, y);

      ctx.strokeStyle = '#27272a';
      ctx.beginPath();
      ctx.moveTo(panelX + 32, y + 16);
      ctx.lineTo(panelX + 518, y + 16);
      ctx.stroke();
    });

    ctx.fillStyle = productColor;
    ctx.beginPath();
    ctx.arc(panelX + 495, 220 + 7 * 54 - 6, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    ctx.fillStyle = '#e4e4e7';
    ctx.font = '700 16px system-ui, sans-serif';
    ctx.fillText('ARTE PLANO A IMPRIMIR:', panelX + 32, 685);

    ctx.fillStyle = '#09090b';
    ctx.beginPath();
    ctx.roundRect(panelX + 32, 705, 486, 220, 14);
    ctx.fill();
    ctx.strokeStyle = '#27272a';
    ctx.stroke();

    if (artCanvas) {
      const scale = Math.min(440 / artCanvas.width, 190 / artCanvas.height);
      const dw = artCanvas.width * scale;
      const dh = artCanvas.height * scale;
      ctx.drawImage(artCanvas, panelX + 32 + (486 - dw) / 2, 705 + (220 - dh) / 2, dw, dh);
    }

    ctx.fillStyle = '#a1a1aa';
    ctx.font = '500 14px system-ui, sans-serif';
    ctx.fillText(`Notas: ${meta.notes.slice(0, 58)}`, panelX + 32, 965);

    ctx.fillStyle = '#052e16';
    ctx.beginPath();
    ctx.roundRect(panelX + 32, 995, 486, 120, 14);
    ctx.fill();
    ctx.strokeStyle = '#10b981';
    ctx.stroke();

    ctx.fillStyle = '#6ee7b7';
    ctx.font = '700 16px system-ui, sans-serif';
    ctx.fillText('CONFORMIDAD DEL CLIENTE PARA PRODUCCIÓN', panelX + 54, 1032);
    ctx.fillStyle = '#d1fae5';
    ctx.font = '400 13px system-ui, sans-serif';
    ctx.fillText('Verifique ortografía, colores y medidas en cm. Una vez aprobada', panelX + 54, 1062);
    ctx.fillText('esta ficha, el diseño entra directamente en cola de impresión.', panelX + 54, 1084);

    const url = sheet.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = url;
    link.download = `ficha_aprobacion_${meta.approvalCode}_${selectedProductId}.png`;
    link.click();
    showToast(`Ficha de Aprobación ${meta.approvalCode} descargada lista para enviar por WhatsApp.`);
  };

  const isCylindrical =
    selectedProductId === 'mug-wrap' ||
    selectedProductId === 'thermos-bottle' ||
    selectedProductId === 'mug-bottom';

  return (
    <section
      className="flex-1 flex flex-col bg-stone-950 text-stone-100 overflow-hidden select-none"
      aria-label="Estudio de Mockups Fotorrealistas 3D y Fichas de Aprobación"
    >
      {/* BARRA SUPERIOR DEL ESTUDIO DE MOCKUPS */}
      <div className="min-h-[50px] bg-stone-900 border-b border-stone-800 px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 z-20 shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          {onExitMockups && (
            <button
              type="button"
              onClick={onExitMockups}
              className="px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 text-xs font-semibold text-emerald-300 flex items-center gap-1.5 transition cursor-pointer"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>← Estudio</span>
            </button>
          )}

          {/* Selector rápido de familia de Soportes Fotorrealistas */}
          <div className="flex flex-wrap items-center gap-1 bg-stone-950 border border-stone-800 rounded-xl p-1">
            {MOCKUP_PRODUCTS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectProduct(item.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  selectedProductId === item.id
                    ? 'bg-emerald-500 text-stone-950 font-bold shadow'
                    : 'text-stone-300 hover:bg-stone-800 hover:text-white'
                }`}
              >
                {item.name}
              </button>
            ))}
          </div>
        </div>

        {/* Acciones de Exportación (Mockup Limpio + Ficha de Aprobación para Cliente) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadMockupPng}
            className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-100 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Descargar Mockup HD</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadApprovalSheet}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-extrabold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition cursor-pointer"
          >
            <FileCheck2 className="w-3.5 h-3.5" />
            <span>Ficha de Aprobación Cliente (.PNG)</span>
          </button>
        </div>
      </div>

      {/* CUERPO PRINCIPAL: PANEL IZQUIERDO DE CONFIGURACIÓN + ESCENARIO FOTORREALISTA CENTRAL */}
      <div className="flex-1 flex overflow-hidden">
        {/* SIDEBAR IZQUIERDO DE CONTROLES DEL MOCKUP */}
        <aside className="w-80 xl:w-[350px] bg-stone-900 border-r border-stone-800 p-4 overflow-y-auto space-y-4 shrink-0">
          {/* 1. Ubicación / Zona Precalibrada sobre el Soporte */}
          <div className="bg-stone-950 border border-stone-800 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-200">
                Ubicación en {product.name}
              </span>
              <span className="text-[10px] font-mono text-emerald-400">
                {product.physicalWidthCm}×{product.physicalHeightCm} cm
              </span>
            </div>

            <div className="grid grid-cols-1 gap-1.5">
              {product.zones.map((z) => (
                <button
                  key={z.id}
                  type="button"
                  onClick={() => {
                    setSelectedZoneId(z.id);
                    setOffsetXPercent(0);
                    setOffsetYPercent(0);
                    setScaleMultiplier(1);
                  }}
                  className={`p-2.5 rounded-lg border text-left transition cursor-pointer ${
                    selectedZoneId === z.id
                      ? 'bg-emerald-500/15 border-emerald-500 text-white'
                      : 'border-stone-800 text-stone-400 hover:bg-stone-800/50'
                  }`}
                >
                  <div className="text-xs font-bold flex items-center justify-between">
                    <span>{z.label}</span>
                    <span className="text-[10px] font-mono text-emerald-300">
                      ~{z.recommendedWidthCm} cm
                    </span>
                  </div>
                </button>
              ))}
            </div>

            <label className="flex items-center justify-between text-[11px] text-stone-300 pt-1 cursor-pointer">
              <span>Usar tamaño estándar de esta zona</span>
              <input
                type="checkbox"
                checked={useZoneRecommendedSize}
                onChange={(e) => setUseZoneRecommendedSize(e.target.checked)}
                className="w-3.5 h-3.5 accent-emerald-400 rounded"
              />
            </label>
          </div>

          {/* 2. Color del Producto / Prenda / Taza / Libro */}
          <div className="bg-stone-950 border border-stone-800 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-200 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-emerald-400" />
                Color Fotorrealista del Soporte
              </span>
              <input
                type="color"
                value={productColor}
                onChange={(e) => setProductColor(e.target.value)}
                className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
              />
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {MOCKUP_COLOR_SWATCHES.map((sw) => (
                <button
                  key={sw.hex}
                  type="button"
                  onClick={() => setProductColor(sw.hex)}
                  title={sw.name}
                  className={`py-1.5 px-2 rounded-lg border text-[10px] font-medium flex items-center gap-1.5 transition cursor-pointer ${
                    productColor.toLowerCase() === sw.hex.toLowerCase()
                      ? 'border-emerald-400 bg-stone-800 text-white'
                      : 'border-stone-800 bg-stone-900 text-stone-300 hover:bg-stone-800'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full border border-stone-500 shrink-0"
                    style={{ backgroundColor: sw.hex }}
                  />
                  <span className="truncate">{sw.name.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 3. Escala Física, Posición y Rotación Cilíndrica 3D */}
          <div className="bg-stone-950 border border-stone-800 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-200">
                Ajuste Físico y Perspectiva
              </span>
              <button
                type="button"
                onClick={() => {
                  setScaleMultiplier(1);
                  setOffsetXPercent(0);
                  setOffsetYPercent(0);
                  setRotationDeg(0);
                }}
                className="text-[10px] text-emerald-400 hover:underline flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> Restablecer
              </button>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-stone-300">Medida real en soporte:</span>
                <span className="text-emerald-400 font-mono font-bold">
                  {placement.effectiveWidthCm} × {placement.effectiveHeightCm} cm
                </span>
              </div>
              <input
                type="range"
                min="0.35"
                max="1.85"
                step="0.05"
                value={scaleMultiplier}
                onChange={(e) => setScaleMultiplier(Number(e.target.value))}
                className="w-full accent-emerald-400"
              />
            </div>

            {isCylindrical ? (
              <div className="space-y-2 pt-1 border-t border-stone-800">
                <div className="flex justify-between text-xs">
                  <span className="text-stone-300">
                    {selectedProductId === 'mug-wrap'
                      ? 'Giro 360° (Cilindro + Asa en 180°):'
                      : 'Giro 3D del Soporte:'}
                  </span>
                  <span className="text-amber-300 font-mono font-bold">{rotationDeg}°</span>
                </div>
                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="1"
                  value={rotationDeg}
                  onChange={(e) => setRotationDeg(Number(e.target.value))}
                  className="w-full accent-amber-400"
                />
                {selectedProductId === 'mug-wrap' && (
                  <>
                    <div className="grid grid-cols-4 gap-1 text-[10px]">
                      {[
                        { label: 'Frente 0°', deg: 0 },
                        { label: 'Der+Asa', deg: -75 },
                        { label: 'Izq+Asa', deg: 75 },
                        { label: 'Asa 180°', deg: 180 }
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => {
                            setMugTripleView(false);
                            setRotationDeg(preset.deg);
                          }}
                          className={`py-1 px-1.5 rounded border font-semibold transition cursor-pointer ${
                            rotationDeg === preset.deg && !mugTripleView
                              ? 'bg-amber-400/20 border-amber-400 text-amber-300'
                              : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-white'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-stone-400 leading-tight">
                      Estándar 11oz (Ø 8.2cm · 25.76cm circunf.): plantilla óptima de <strong>20.0 × 8.8 cm</strong> con <strong>1.8 cm libres</strong> sin tinta a cada lado del asa.
                    </p>
                    <button
                      type="button"
                      onClick={() => setMugTripleView((v) => !v)}
                      className={`w-full py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        mugTripleView
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                          : 'bg-stone-900 border-stone-700 text-stone-300 hover:bg-stone-800'
                      }`}
                    >
                      <Columns className="w-3.5 h-3.5" />
                      <span>
                        {mugTripleView
                          ? 'Vista Triple Activa (Izq · Centro · Der)'
                          : 'Ver Taza Completa en 3 Ángulos'}
                      </span>
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-stone-800">
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-stone-400">Desplaz. X</span>
                    <span className="text-stone-200 font-mono">{offsetXPercent}%</span>
                  </div>
                  <input
                    type="range"
                    min="-30"
                    max="30"
                    step="0.5"
                    value={offsetXPercent}
                    onChange={(e) => setOffsetXPercent(Number(e.target.value))}
                    className="w-full accent-emerald-400"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-stone-400">Desplaz. Y</span>
                    <span className="text-stone-200 font-mono">{offsetYPercent}%</span>
                  </div>
                  <input
                    type="range"
                    min="-30"
                    max="30"
                    step="0.5"
                    value={offsetYPercent}
                    onChange={(e) => setOffsetYPercent(Number(e.target.value))}
                    className="w-full accent-emerald-400"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 4. Subir Fotografía de Producto Propia del Taller (Smart-Mockup Custom) */}
          {selectedProductId !== 'mug-wrap' && selectedProductId !== 'mug-bottom' && (
            <div className="bg-stone-950 border border-stone-800 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-200">
                  Fotografía Base de Estudio
                </span>
                {customPhotoUrl && (
                  <button
                    type="button"
                    onClick={() => setCustomPhotoUrl(null)}
                    className="text-[10px] text-emerald-400 hover:underline"
                  >
                    Usar foto oficial
                  </button>
                )}
              </div>
              <label className="w-full py-2 px-3 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-700 text-xs font-semibold text-stone-200 flex items-center justify-center gap-2 cursor-pointer transition">
                <Upload className="w-3.5 h-3.5 text-emerald-400" />
                <span>Subir Foto de Tu Propio Producto</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleUploadCustomProductPhoto}
                  className="sr-only"
                />
              </label>
              <p className="text-[10px] text-stone-500 leading-tight">
                Sube una foto de una prenda o artículo blanco sobre fondo oscuro y el motor fusionará sus arrugas reales con tu diseño.
              </p>
            </div>
          )}

          {/* 5. Datos Personalizados para la Ficha de Aprobación de Cliente */}
          <div className="bg-stone-950 border border-stone-800 rounded-xl p-3.5 space-y-2.5">
            <span className="text-xs font-bold text-stone-200 block">
              Datos para Ficha de Aprobación
            </span>
            <input
              type="text"
              placeholder="Nombre del Cliente / Empresa"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full rounded-lg bg-stone-900 border border-stone-800 px-2.5 py-1.5 text-xs text-white placeholder:text-stone-500"
            />
            <input
              type="text"
              placeholder="Nota (ej. Poliamida negra / Taza AAA)"
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
              className="w-full rounded-lg bg-stone-900 border border-stone-800 px-2.5 py-1.5 text-xs text-white placeholder:text-stone-500"
            />
          </div>
        </aside>

        {/* ESCENARIO CENTRAL INTERACTIVO DEL MOCKUP */}
        <div className="flex-1 relative flex flex-col items-center justify-center p-6 bg-stone-950 overflow-hidden">
          {/* Controles flotantes de Iluminación de Estudio y Acabado */}
          <div className="absolute top-4 right-5 z-10 flex items-center gap-2">
            <div className="flex items-center bg-stone-900/95 border border-stone-700 rounded-xl p-1 text-[11px] shadow-xl">
              {[
                { id: 'dark', label: 'Estudio Oscuro' },
                { id: 'warm', label: 'Taller Cálido' },
                { id: 'light', label: 'Catálogo Claro' }
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setStudioTheme(t.id)}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                    studioTheme === t.id
                      ? 'bg-emerald-500 text-stone-950'
                      : 'text-stone-300 hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex items-center bg-stone-900/95 border border-stone-700 rounded-xl p-1 text-[11px] shadow-xl">
              {[
                { id: 'matte', label: 'Acabado Mate' },
                { id: 'gloss', label: 'Satinado / Brillo' }
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFinishMode(f.id)}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                    finishMode === f.id
                      ? 'bg-amber-400 text-stone-950'
                      : 'text-stone-300 hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Lienzo Fotorrealista 2.5D / 3D Interactivo */}
          <div className="relative w-full max-w-4xl aspect-[4/3] rounded-2xl border border-stone-800 shadow-2xl overflow-hidden bg-stone-900 flex items-center justify-center">
            <canvas
              ref={canvasRef}
              width={1120}
              height={840}
              onMouseDown={handlePointerDown}
              onMouseMove={handlePointerMove}
              onMouseUp={handlePointerUp}
              onMouseLeave={handlePointerUp}
              className="w-full h-full object-contain cursor-grab active:cursor-grabbing"
            />

            {/* Leyenda inferior interactiva sobre el lienzo */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-stone-950/90 border border-stone-700/80 px-4 py-1.5 text-xs text-stone-200 flex items-center gap-3 shadow-xl pointer-events-none">
              <span className="font-bold text-emerald-400">{product.name}</span>
              <span className="text-stone-600">•</span>
              <span>Zona: {placement.zone.label}</span>
              <span className="text-stone-600">•</span>
              <span className="font-mono text-amber-300">
                Estampado: {placement.effectiveWidthCm} × {placement.effectiveHeightCm} cm
              </span>
              <span className="text-stone-600">•</span>
              <span className="text-stone-400 text-[11px]">
                {isCylindrical
                  ? 'Arrastra horizontalmente para girar cilindro y asa en 3D'
                  : 'Arrastra sobre la fotografía para mover posición'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
