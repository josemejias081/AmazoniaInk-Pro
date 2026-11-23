import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Check,
  Coffee,
  Columns,
  Compass,
  Download,
  FileCheck2,
  Maximize2,
  Move,
  Palette,
  RefreshCw,
  RotateCcw,
  Shirt,
  ShoppingBag,
  Sparkles,
  Undo2
} from 'lucide-react';
import {
  buildClientApprovalSheetMetadata,
  calculateArtworkPlacementOnProduct,
  computeCapCrownStripTransforms,
  computeCylindricalStripTransforms,
  getMockupProductById,
  MOCKUP_COLOR_SWATCHES,
  MOCKUP_PRODUCTS
} from './utils/mockupEngine.js';

const imageDataToCanvas = (imageData) => {
  if (!imageData) return null;
  const c = document.createElement('canvas');
  c.width = imageData.width;
  c.height = imageData.height;
  const ctx = c.getContext('2d');
  if (ctx) ctx.putImageData(imageData, 0, 0);
  return c;
};

// Ajusta el brillo de un color HEX para generar luces y sombras coherentes del producto
const shadeHexColor = (hex, percent) => {
  const clean = (hex || '#18181b').replace('#', '');
  const num = parseInt(clean, 16) || 0;
  const r = Math.min(255, Math.max(0, ((num >> 16) & 255) + Math.round(2.55 * percent)));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 255) + Math.round(2.55 * percent)));
  const b = Math.min(255, Math.max(0, (num & 255) + Math.round(2.55 * percent)));
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};

// ============================================================================
// RENDERIZADORES PROCEDURALES 2.5D / 3D EN CANVAS PARA CADA SOPORTE FÍSICO
// ============================================================================

const drawStudioBackdrop = (ctx, w, h, studioTheme = 'dark') => {
  const grad = ctx.createRadialGradient(w * 0.5, h * 0.42, w * 0.08, w * 0.5, h * 0.5, w * 0.72);
  if (studioTheme === 'light') {
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.65, '#f1f5f9');
    grad.addColorStop(1, '#cbd5e1');
  } else if (studioTheme === 'warm') {
    grad.addColorStop(0, '#292524');
    grad.addColorStop(0.7, '#1c1917');
    grad.addColorStop(1, '#0c0a09');
  } else {
    grad.addColorStop(0, '#27272a');
    grad.addColorStop(0.65, '#18181b');
    grad.addColorStop(1, '#09090b');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Sombra elíptica de apoyo en la base del estudio
  ctx.save();
  ctx.fillStyle = studioTheme === 'light' ? 'rgba(15, 23, 42, 0.14)' : 'rgba(0, 0, 0, 0.45)';
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.89, w * 0.28, h * 0.032, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

// 1. CAMISETA FRONTAL, ESPALDA Y SUDADERA (Textil con pliegues, costuras y mapa de iluminación)
const renderGarmentMockup = (ctx, w, h, { productId, productColor, artCanvas, placement, finishMode }) => {
  const isBack = productId === 'tshirt-back';
  const isHoodie = productId === 'hoodie-front';

  const bodyLeft = w * 0.24;
  const bodyRight = w * 0.76;
  const bodyTop = h * 0.15;
  const bodyBottom = h * 0.86;
  const bodyW = bodyRight - bodyLeft;
  const bodyH = bodyBottom - bodyTop;

  const buildGarmentPath = () => {
    ctx.beginPath();
    // Hombro izquierdo y manga izquierda
    ctx.moveTo(w * 0.39, bodyTop);
    ctx.lineTo(w * 0.25, h * 0.19);
    ctx.lineTo(w * 0.12, h * 0.37);
    ctx.lineTo(w * 0.21, h * 0.44);
    ctx.lineTo(bodyLeft + w * 0.02, h * 0.34);
    // Torso izquierdo
    ctx.lineTo(bodyLeft + w * 0.015, bodyBottom);
    // Bajo de la prenda
    ctx.quadraticCurveTo(w * 0.5, bodyBottom + h * 0.018, bodyRight - w * 0.015, bodyBottom);
    // Torso derecho y manga derecha
    ctx.lineTo(bodyRight - w * 0.02, h * 0.34);
    ctx.lineTo(w * 0.79, h * 0.44);
    ctx.lineTo(w * 0.88, h * 0.37);
    ctx.lineTo(w * 0.75, h * 0.19);
    ctx.lineTo(w * 0.61, bodyTop);
    // Cuello (más alto si es espalda, más escotado si es frontal)
    if (isBack) {
      ctx.quadraticCurveTo(w * 0.5, bodyTop + h * 0.025, w * 0.39, bodyTop);
    } else {
      ctx.quadraticCurveTo(w * 0.5, bodyTop + h * 0.085, w * 0.39, bodyTop);
    }
    ctx.closePath();
  };

  ctx.save();
  // Si es Hoodie, dibujar capucha trasera antes del torso
  if (isHoodie) {
    ctx.beginPath();
    ctx.ellipse(w * 0.5, bodyTop - h * 0.01, w * 0.145, h * 0.085, 0, Math.PI, 0, false);
    ctx.fillStyle = shadeHexColor(productColor, -12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Sombra exterior de la prenda
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 12;
  buildGarmentPath();
  const baseGrad = ctx.createLinearGradient(bodyLeft, bodyTop, bodyRight, bodyBottom);
  baseGrad.addColorStop(0, shadeHexColor(productColor, 8));
  baseGrad.addColorStop(0.5, productColor);
  baseGrad.addColorStop(1, shadeHexColor(productColor, -14));
  ctx.fillStyle = baseGrad;
  ctx.fill();
  ctx.restore();

  // Recortar al contorno de la prenda para dibujar interior del cuello, diseño y pliegues textiles
  buildGarmentPath();
  ctx.clip();

  // Interior del cuello y etiqueta de marca
  if (!isBack) {
    ctx.beginPath();
    ctx.moveTo(w * 0.39, bodyTop);
    ctx.quadraticCurveTo(w * 0.5, bodyTop + h * 0.085, w * 0.61, bodyTop);
    ctx.quadraticCurveTo(w * 0.5, bodyTop + h * 0.025, w * 0.39, bodyTop);
    ctx.fillStyle = shadeHexColor(productColor, -22);
    ctx.fill();

    // Etiqueta tejida interior AmazoniaInk®
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(w * 0.482, bodyTop + h * 0.018, w * 0.036, h * 0.018);
  }

  // Dibujar el diseño del usuario escalado a proporción física real en centímetros
  if (artCanvas) {
    const drawW = bodyW * placement.widthRatio;
    const drawH = bodyH * placement.heightRatio;
    const centerX = bodyLeft + bodyW * placement.centerXRatio;
    const centerY = bodyTop + bodyH * placement.centerYRatio;

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(artCanvas, centerX - drawW / 2, centerY - drawH / 2, drawW, drawH);

    // Acabado superficial del estampado (DTF ligero brillo satinado vs Serigrafía mate)
    if (finishMode === 'gloss') {
      const gloss = ctx.createLinearGradient(
        centerX - drawW / 2,
        centerY - drawH / 2,
        centerX + drawW / 2,
        centerY + drawH / 2
      );
      gloss.addColorStop(0, 'rgba(255,255,255,0.14)');
      gloss.addColorStop(0.45, 'rgba(255,255,255,0.0)');
      gloss.addColorStop(1, 'rgba(0,0,0,0.08)');
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = gloss;
      ctx.fillRect(centerX - drawW / 2, centerY - drawH / 2, drawW, drawH);
    }
    ctx.restore();
  }

  // Mapa de pliegues cilíndricos del torso y arrugas textiles (se fusiona sobre la prenda y el estampado)
  const folds = [
    { x0: 0.25, x1: 0.33, alpha: 0.16 },
    { x0: 0.43, x1: 0.48, alpha: 0.07 },
    { x0: 0.56, x1: 0.62, alpha: 0.08 },
    { x0: 0.68, x1: 0.76, alpha: 0.18 }
  ];
  folds.forEach((f) => {
    const fg = ctx.createLinearGradient(w * f.x0, bodyTop, w * f.x1, bodyBottom);
    fg.addColorStop(0, 'rgba(0,0,0,0)');
    fg.addColorStop(0.5, `rgba(0,0,0,${f.alpha})`);
    fg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = fg;
    ctx.fillRect(bodyLeft, bodyTop, bodyW, bodyH);
  });

  // Si es Sudadera / Hoodie: dibujar bolsillo canguro y cordones
  if (isHoodie) {
    ctx.beginPath();
    ctx.moveTo(w * 0.34, h * 0.62);
    ctx.lineTo(w * 0.66, h * 0.62);
    ctx.lineTo(w * 0.71, h * 0.75);
    ctx.lineTo(w * 0.68, h * 0.83);
    ctx.lineTo(w * 0.32, h * 0.83);
    ctx.lineTo(w * 0.29, h * 0.75);
    ctx.closePath();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Cordones del cuello
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w * 0.46, bodyTop + h * 0.07);
    ctx.lineTo(w * 0.455, bodyTop + h * 0.22);
    ctx.moveTo(w * 0.54, bodyTop + h * 0.07);
    ctx.lineTo(w * 0.545, bodyTop + h * 0.22);
    ctx.stroke();
  }

  // Costura del cuello (Ribbed Collar)
  ctx.beginPath();
  if (isBack) {
    ctx.moveTo(w * 0.385, bodyTop + 2);
    ctx.quadraticCurveTo(w * 0.5, bodyTop + h * 0.032, w * 0.615, bodyTop + 2);
  } else {
    ctx.moveTo(w * 0.385, bodyTop + 2);
    ctx.quadraticCurveTo(w * 0.5, bodyTop + h * 0.095, w * 0.615, bodyTop + 2);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 7;
  ctx.stroke();

  ctx.restore();
};

// 2. GORRA (TRUCKER / BASEBALL) CON DEFORMACIÓN PARABÓLICA DE CÚPULA FRONTAL
const renderCapMockup = (ctx, w, h, { productColor, artCanvas, placement }) => {
  const cx = w * 0.5;
  const crownTop = h * 0.21;
  const crownBottom = h * 0.61;
  const crownHalfW = w * 0.255;

  ctx.save();
  // Botón superior de la gorra
  ctx.fillStyle = shadeHexColor(productColor, -15);
  ctx.beginPath();
  ctx.ellipse(cx, crownTop - 3, 12, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Cúpula frontal (Crown)
  const buildCrownPath = () => {
    ctx.beginPath();
    ctx.moveTo(cx - crownHalfW, crownBottom);
    ctx.bezierCurveTo(
      cx - crownHalfW * 1.04,
      crownTop + (crownBottom - crownTop) * 0.12,
      cx - crownHalfW * 0.55,
      crownTop,
      cx,
      crownTop
    );
    ctx.bezierCurveTo(
      cx + crownHalfW * 0.55,
      crownTop,
      cx + crownHalfW * 1.04,
      crownTop + (crownBottom - crownTop) * 0.12,
      cx + crownHalfW,
      crownBottom
    );
    ctx.quadraticCurveTo(cx, crownBottom - h * 0.035, cx - crownHalfW, crownBottom);
    ctx.closePath();
  };

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 24;
  buildCrownPath();
  const crownGrad = ctx.createRadialGradient(cx - w * 0.05, crownTop + h * 0.1, 20, cx, crownBottom, crownHalfW * 1.25);
  crownGrad.addColorStop(0, shadeHexColor(productColor, 14));
  crownGrad.addColorStop(0.65, productColor);
  crownGrad.addColorStop(1, shadeHexColor(productColor, -22));
  ctx.fillStyle = crownGrad;
  ctx.fill();
  ctx.restore();

  // Recortar al panel de la copa para deformar y proyectar el diseño en cúpula
  ctx.save();
  buildCrownPath();
  ctx.clip();

  // Costuras laterales de los paneles de la gorra
  ctx.strokeStyle = 'rgba(255,255,255,0.11)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  [-0.58, 0.58].forEach((side) => {
    ctx.beginPath();
    ctx.moveTo(cx, crownTop);
    ctx.quadraticCurveTo(cx + crownHalfW * side * 0.85, (crownTop + crownBottom) * 0.5, cx + crownHalfW * side, crownBottom);
    ctx.stroke();
  });
  ctx.setLineDash([]);

  // Proyectar el diseño del usuario con curvatura de cúpula por franjas verticales
  if (artCanvas) {
    const destW = crownHalfW * 2 * Math.min(0.88, placement.widthRatio * 1.05);
    const destH = (crownBottom - crownTop) * Math.min(0.78, placement.heightRatio * 1.05);
    const artCenterX = cx + (placement.centerXRatio - 0.5) * crownHalfW * 1.5;
    const artCenterY = crownTop + (crownBottom - crownTop) * placement.centerYRatio * 1.15;

    const strips = computeCapCrownStripTransforms({
      destWidthPx: destW,
      artworkWidthPx: artCanvas.width,
      archHeightPx: 14,
      stripCount: 44
    });

    strips.forEach((st) => {
      const stripH = destH * st.scaleY;
      const dx = artCenterX + st.destOffsetX;
      const dy = artCenterY - stripH / 2 + st.archOffsetY;
      ctx.drawImage(
        artCanvas,
        st.srcX,
        0,
        st.srcW,
        artCanvas.height,
        dx,
        dy,
        st.destW,
        stripH
      );
      if (st.shadeAlpha > 0.01) {
        ctx.fillStyle = `rgba(0,0,0,${st.shadeAlpha})`;
        ctx.fillRect(dx, dy, st.destW, stripH);
      }
    });
  }
  ctx.restore();

  // Visera curva (Brim / Bill) con pespuntes concéntricos
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - crownHalfW * 0.98, crownBottom - 4);
  ctx.quadraticCurveTo(cx, crownBottom - h * 0.055, cx + crownHalfW * 0.98, crownBottom - 4);
  ctx.bezierCurveTo(
    cx + crownHalfW * 1.12,
    crownBottom + h * 0.16,
    cx + crownHalfW * 0.65,
    crownBottom + h * 0.22,
    cx,
    crownBottom + h * 0.22
  );
  ctx.bezierCurveTo(
    cx - crownHalfW * 0.65,
    crownBottom + h * 0.22,
    cx - crownHalfW * 1.12,
    crownBottom + h * 0.16,
    cx - crownHalfW * 0.98,
    crownBottom - 4
  );
  ctx.closePath();

  const visorGrad = ctx.createLinearGradient(cx, crownBottom - 10, cx, crownBottom + h * 0.22);
  visorGrad.addColorStop(0, shadeHexColor(productColor, -18));
  visorGrad.addColorStop(0.35, productColor);
  visorGrad.addColorStop(1, shadeHexColor(productColor, -12));
  ctx.fillStyle = visorGrad;
  ctx.fill();

  // Pespuntes de la visera
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1.2;
  ctx.setLineDash([4, 3]);
  [0.05, 0.1, 0.15].forEach((offset) => {
    ctx.beginPath();
    ctx.moveTo(cx - crownHalfW * 0.88, crownBottom + h * offset * 0.6);
    ctx.quadraticCurveTo(cx, crownBottom + h * offset * 1.1, cx + crownHalfW * 0.88, crownBottom + h * offset * 0.6);
    ctx.stroke();
  });
  ctx.restore();
  ctx.restore();
};

// 3. TAZA 11 OZ (CONTORNO CILÍNDRICO EXTERIOR CON ROTACIÓN 3D) Y TERMO CILÍNDRICO
const renderCylindricalMugOrThermos = (
  ctx,
  w,
  h,
  {
    productId,
    productColor,
    artCanvas,
    placement,
    rotationDeg = 0,
    centerXOverride = null,
    scaleOverride = 1,
    angleBadge = null
  }
) => {
  const isThermos = productId === 'thermos-bottle';
  const cx = centerXOverride !== null ? centerXOverride : w * 0.5;
  const s = scaleOverride;

  const radiusX = (isThermos ? w * 0.125 : w * 0.165) * s;
  const bodyTop = h * (isThermos ? 0.24 : 0.24);
  const bodyBottom = h * (isThermos ? 0.84 : 0.79);
  const bodyH = (bodyBottom - bodyTop) * s;
  const topY = h * 0.53 - bodyH * 0.48;
  const bottomY = topY + bodyH;
  const ellipseRy = radiusX * (isThermos ? 0.14 : 0.16);

  ctx.save();

  // Asa 3D de la taza cerámica (se desplaza según el ángulo de rotación)
  if (!isThermos) {
    const rotRad = (rotationDeg * Math.PI) / 180;
    // El asa está en la parte opuesta al centro de la plantilla (180°), pero para que siempre se aprecie
    // la situamos lateralmente modulada por coseno
    const handleSide = Math.cos(rotRad * 0.5) >= 0 ? 1 : -1;
    const handleExtend = radiusX * (0.58 + 0.14 * Math.abs(Math.cos(rotRad * 0.6)));
    const hx = cx + handleSide * (radiusX - 4 * s);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(hx, topY + bodyH * 0.18);
    ctx.bezierCurveTo(
      hx + handleSide * handleExtend,
      topY + bodyH * 0.12,
      hx + handleSide * handleExtend,
      topY + bodyH * 0.86,
      hx,
      topY + bodyH * 0.78
    );
    ctx.lineWidth = Math.max(8, 22 * s);
    ctx.strokeStyle = shadeHexColor(productColor, -8);
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.lineWidth = Math.max(4, 10 * s);
    ctx.strokeStyle = shadeHexColor(productColor, 14);
    ctx.stroke();
    ctx.restore();
  }

  // Cuerpo cilíndrico base
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
  ctx.shadowColor = 'rgba(0,0,0,0.38)';
  ctx.shadowBlur = 24 * s;
  buildCylinderPath();
  const cylGrad = ctx.createLinearGradient(cx - radiusX, topY, cx + radiusX, topY);
  cylGrad.addColorStop(0, shadeHexColor(productColor, -18));
  cylGrad.addColorStop(0.28, shadeHexColor(productColor, 12));
  cylGrad.addColorStop(0.55, productColor);
  cylGrad.addColorStop(0.85, shadeHexColor(productColor, -10));
  cylGrad.addColorStop(1, shadeHexColor(productColor, -26));
  ctx.fillStyle = cylGrad;
  ctx.fill();
  ctx.restore();

  // Proyección cilíndrica 3D del diseño por micro-franjas verticales
  if (artCanvas) {
    ctx.save();
    buildCylinderPath();
    ctx.clip();

    const wrapDeg = clampWrapAngle(placement.widthRatio, isThermos);
    const strips = computeCylindricalStripTransforms({
      cylinderRadiusPx: radiusX,
      artworkWidthPx: artCanvas.width,
      wrapAngleDeg: wrapDeg,
      rotationDeg,
      stripCount: 72
    });

    const artHeightPx = bodyH * Math.min(0.84, Math.max(0.22, placement.heightRatio * 0.86));
    const baseArtTopY = topY + (bodyH - artHeightPx) * placement.centerYRatio;

    strips.forEach((st) => {
      // Curvatura elíptica vertical: el centro baja ligeramente siguiendo la perspectiva de la boca de la taza
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

      // Sombra cilíndrica lateral en los bordes curvos
      if (st.edgeShadow > 0.01) {
        ctx.fillStyle = `rgba(0, 0, 0, ${st.edgeShadow})`;
        ctx.fillRect(dx, topY, st.destW, bodyH + ellipseRy);
      }
      // Reflejo especular cerámico / metálico vertical
      if (st.specularHighlight > 0.01) {
        ctx.fillStyle = `rgba(255, 255, 255, ${st.specularHighlight})`;
        ctx.fillRect(dx, topY, st.destW, bodyH + ellipseRy);
      }
    });

    ctx.restore();
  }

  // Boca superior de la taza o tapón del termo
  if (isThermos) {
    // Cuello de acero inoxidable y tapón hermético negro
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(cx - radiusX * 0.72, topY - bodyH * 0.11, radiusX * 1.44, bodyH * 0.11);
    ctx.fillStyle = '#18181b';
    ctx.beginPath();
    ctx.roundRect(cx - radiusX * 0.76, topY - bodyH * 0.22, radiusX * 1.52, bodyH * 0.12, 8 * s);
    ctx.fill();
  } else {
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
  }

  if (angleBadge) {
    ctx.fillStyle = 'rgba(9, 9, 11, 0.82)';
    ctx.beginPath();
    ctx.roundRect(cx - 48, bottomY + ellipseRy + 12, 96, 22, 6);
    ctx.fill();
    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 11px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(angleBadge, cx, bottomY + ellipseRy + 27);
  }

  ctx.restore();
};

const clampWrapAngle = (widthRatio, isThermos) => {
  const baseDeg = widthRatio * (isThermos ? 250 : 235);
  return Math.max(45, Math.min(260, baseDeg));
};

// 4. TAZA 11 OZ — FONDO EXTERIOR / BASE INFERIOR CERÁMICA (SELLO DE MARCA / QR)
const renderMugBottomExterior = (ctx, w, h, { productColor, artCanvas, placement, rotationDeg = 0 }) => {
  const cx = w * 0.5;
  const cy = h * 0.5;
  const outerRadius = Math.min(w, h) * 0.31;
  const footRingOuter = outerRadius * 0.87;
  const footRingInner = outerRadius * 0.76;
  const recessRadius = footRingInner * 0.96;

  ctx.save();

  // Asa vista desde abajo en perspectiva
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(((rotationDeg || 0) * Math.PI) / 180);
  ctx.beginPath();
  ctx.roundRect(outerRadius * 0.88, -outerRadius * 0.16, outerRadius * 0.42, outerRadius * 0.32, 18);
  ctx.fillStyle = shadeHexColor(productColor, -14);
  ctx.fill();
  ctx.restore();

  // Paredes exteriores esmaltadas de la taza vista invertida
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.48)';
  ctx.shadowBlur = 30;
  ctx.beginPath();
  ctx.arc(cx, cy, outerRadius, 0, Math.PI * 2);
  const bodyGrad = ctx.createRadialGradient(cx - outerRadius * 0.25, cy - outerRadius * 0.25, 10, cx, cy, outerRadius);
  bodyGrad.addColorStop(0, shadeHexColor(productColor, 12));
  bodyGrad.addColorStop(0.75, productColor);
  bodyGrad.addColorStop(1, shadeHexColor(productColor, -22));
  ctx.fillStyle = bodyGrad;
  ctx.fill();
  ctx.restore();

  // Anillo de apoyo cerámico sin esmaltar (bizcocho cerámico mate color hueso/arcilla clara)
  ctx.beginPath();
  ctx.arc(cx, cy, footRingOuter, 0, Math.PI * 2);
  ctx.arc(cx, cy, footRingInner, 0, Math.PI * 2, true);
  ctx.fillStyle = '#e7e2d8';
  ctx.fill();

  // Cavidad central esmaltada del fondo exterior de la taza
  ctx.beginPath();
  ctx.arc(cx, cy, footRingInner, 0, Math.PI * 2);
  const recessGrad = ctx.createRadialGradient(cx + 12, cy + 12, 8, cx, cy, footRingInner);
  recessGrad.addColorStop(0, productColor);
  recessGrad.addColorStop(0.8, shadeHexColor(productColor, -10));
  recessGrad.addColorStop(1, shadeHexColor(productColor, -26));
  ctx.fillStyle = recessGrad;
  ctx.fill();

  // Dibujar el diseño / sello de marca dentro de la cavidad circular del fondo exterior
  if (artCanvas) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, recessRadius, 0, Math.PI * 2);
    ctx.clip();

    ctx.translate(cx + (placement.centerXRatio - 0.5) * recessRadius * 1.2, cy + (placement.centerYRatio - 0.5) * recessRadius * 1.2);
    ctx.rotate(((rotationDeg || 0) * Math.PI) / 180);

    const drawW = outerRadius * 2 * Math.min(0.72, placement.widthRatio * 0.95);
    const drawH = outerRadius * 2 * Math.min(0.72, placement.heightRatio * 0.95);
    ctx.drawImage(artCanvas, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
  }

  // Etiqueta informativa sutil de la vista
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = '600 11px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('VISTA: FONDO EXTERIOR / BASE CERÁMICA DE LA TAZA', cx, cy + outerRadius + 28);

  ctx.restore();
};

// 5. PORTADA DE LIBRO / AGENDA CORPORATIVA EN PERSPECTIVA 2.5D
const renderBookCoverMockup = (ctx, w, h, { productColor, artCanvas, placement, finishMode }) => {
  const spineW = w * 0.048;
  const coverW = w * 0.36;
  const coverH = h * 0.66;
  const leftX = w * 0.5 - (coverW + spineW) * 0.48;
  const topY = (h - coverH) * 0.5;
  const coverLeft = leftX + spineW;

  ctx.save();

  // Canto de hojas de papel a la derecha y abajo (efecto bloque de páginas 3D)
  const pageDepth = 16;
  ctx.fillStyle = '#f5f5f4';
  ctx.beginPath();
  ctx.moveTo(coverLeft + coverW, topY + 6);
  ctx.lineTo(coverLeft + coverW + pageDepth, topY + 14);
  ctx.lineTo(coverLeft + coverW + pageDepth, topY + coverH + 8);
  ctx.lineTo(coverLeft + coverW, topY + coverH);
  ctx.closePath();
  ctx.fill();

  // Lomo tridimensional del libro (Spine)
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 26;
  ctx.beginPath();
  ctx.moveTo(leftX, topY + 10);
  ctx.quadraticCurveTo(leftX + spineW * 0.4, topY, coverLeft, topY);
  ctx.lineTo(coverLeft, topY + coverH);
  ctx.quadraticCurveTo(leftX + spineW * 0.4, topY + coverH, leftX, topY + coverH - 8);
  ctx.closePath();
  const spineGrad = ctx.createLinearGradient(leftX, topY, coverLeft, topY);
  spineGrad.addColorStop(0, shadeHexColor(productColor, -28));
  spineGrad.addColorStop(0.45, shadeHexColor(productColor, 10));
  spineGrad.addColorStop(0.85, shadeHexColor(productColor, -15));
  spineGrad.addColorStop(1, shadeHexColor(productColor, -35));
  ctx.fillStyle = spineGrad;
  ctx.fill();
  ctx.restore();

  // Cubierta frontal (Tapa dura)
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(coverLeft, topY, coverW, coverH, [0, 6, 6, 0]);
  const coverGrad = ctx.createLinearGradient(coverLeft, topY, coverLeft + coverW, topY + coverH);
  coverGrad.addColorStop(0, shadeHexColor(productColor, 8));
  coverGrad.addColorStop(1, shadeHexColor(productColor, -10));
  ctx.fillStyle = coverGrad;
  ctx.fill();
  ctx.clip();

  // Dibujar el diseño del usuario (Portada Completa a Sangre o Logo UV DTF centrado)
  if (artCanvas) {
    const isFullCover = placement.zone.id === 'full-cover' && placement.widthRatio >= 0.85;
    if (isFullCover) {
      ctx.drawImage(artCanvas, coverLeft, topY, coverW, coverH);
    } else {
      const drawW = coverW * Math.min(1.05, placement.widthRatio);
      const drawH = coverH * Math.min(1.05, placement.heightRatio);
      const cx = coverLeft + coverW * placement.centerXRatio;
      const cy = topY + coverH * placement.centerYRatio;
      ctx.drawImage(artCanvas, cx - drawW / 2, cy - drawH / 2, drawW, drawH);
    }
  }

  // Surco de bisagra editorial (Hinge Groove) junto al lomo
  const grooveX = coverLeft + 12;
  const grooveGrad = ctx.createLinearGradient(grooveX - 5, topY, grooveX + 6, topY);
  grooveGrad.addColorStop(0, 'rgba(0,0,0,0.38)');
  grooveGrad.addColorStop(0.5, 'rgba(255,255,255,0.12)');
  grooveGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grooveGrad;
  ctx.fillRect(grooveX - 5, topY, 12, coverH);

  // Acabado Laminado Brillante o Mate Sedoso
  if (finishMode === 'gloss') {
    const sheen = ctx.createLinearGradient(coverLeft, topY, coverLeft + coverW, topY + coverH * 0.7);
    sheen.addColorStop(0, 'rgba(255,255,255,0.22)');
    sheen.addColorStop(0.45, 'rgba(255,255,255,0.03)');
    sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(coverLeft, topY, coverW, coverH);
  }
  ctx.restore();

  ctx.restore();
};

// 6. TOTE BAG (BOLSA ECOLÓGICA DE LIENZO CON ASAS)
const renderToteBagMockup = (ctx, w, h, { productColor, artCanvas, placement }) => {
  const bagW = w * 0.42;
  const bagH = h * 0.56;
  const bagLeft = (w - bagW) * 0.5;
  const bagTop = h * 0.31;

  ctx.save();
  // Asas de lona
  ctx.beginPath();
  ctx.moveTo(bagLeft + bagW * 0.24, bagTop + 6);
  ctx.quadraticCurveTo(bagLeft + bagW * 0.24, h * 0.08, w * 0.5, h * 0.08);
  ctx.quadraticCurveTo(bagLeft + bagW * 0.76, h * 0.08, bagLeft + bagW * 0.76, bagTop + 6);
  ctx.lineWidth = 18;
  ctx.strokeStyle = shadeHexColor(productColor, -10);
  ctx.stroke();

  // Cuerpo de la bolsa Tote
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.42)';
  ctx.shadowBlur = 24;
  ctx.beginPath();
  ctx.roundRect(bagLeft, bagTop, bagW, bagH, [3, 3, 10, 10]);
  const bagGrad = ctx.createLinearGradient(bagLeft, bagTop, bagLeft + bagW, bagTop + bagH);
  bagGrad.addColorStop(0, shadeHexColor(productColor, 6));
  bagGrad.addColorStop(1, shadeHexColor(productColor, -12));
  ctx.fillStyle = bagGrad;
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(bagLeft, bagTop, bagW, bagH, [3, 3, 10, 10]);
  ctx.clip();

  if (artCanvas) {
    const drawW = bagW * placement.widthRatio;
    const drawH = bagH * placement.heightRatio;
    const cx = bagLeft + bagW * placement.centerXRatio;
    const cy = bagTop + bagH * (placement.centerYRatio - 0.08);
    ctx.drawImage(artCanvas, cx - drawW / 2, cy - drawH / 2, drawW, drawH);
  }

  // Costura superior reforzada de la bolsa
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.setLineDash([4, 3]);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(bagLeft, bagTop + 14);
  ctx.lineTo(bagLeft + bagW, bagTop + 14);
  ctx.stroke();
  ctx.restore();

  ctx.restore();
};

// ============================================================================
// COMPONENTE PRINCIPAL: ESTUDIO DE MOCKUPS 3D/2.5D & FICHAS DE APROBACIÓN
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
  const [rotationDeg, setRotationDeg] = useState(0); // Giro 3D para Taza y Termo
  const [mugTripleView, setMugTripleView] = useState(false); // Vista Triple (Izquierda / Centro / Derecha) en Taza

  // Datos para la Ficha de Aprobación de Cliente
  const [clientName, setClientName] = useState('');
  const [customNotes, setCustomNotes] = useState('');

  const canvasRef = useRef(null);
  const dragRef = useRef(null);

  // Sincronizar zona y color por defecto al cambiar de producto
  const handleSelectProduct = (nextProdId) => {
    const nextProd = getMockupProductById(nextProdId);
    setSelectedProductId(nextProdId);
    setSelectedZoneId(nextProd.zones[0].id);
    setProductColor(nextProd.defaultColor);
    setOffsetXPercent(0);
    setOffsetYPercent(0);
    setScaleMultiplier(1);
    setRotationDeg(0);
    if (nextProdId === 'mug-wrap' || nextProdId === 'mug-bottom' || nextProdId === 'book-cover') {
      setFinishMode('gloss');
    } else {
      setFinishMode('matte');
    }
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

  // Función que dibuja la escena completa en cualquier Canvas (tanto vista en vivo como exportación HD)
  const renderMockupScene = useCallback(
    (ctx, w, h) => {
      drawStudioBackdrop(ctx, w, h, studioTheme);

      if (
        (selectedProductId === 'mug-wrap' || selectedProductId === 'thermos-bottle') &&
        mugTripleView
      ) {
        // Modo Vista Panorámica Triple: Izquierda (-55°) · Centro (0°) · Derecha (+55°)
        const views = [
          { angle: -55, x: w * 0.21, label: 'Lado Izq. (-55°)' },
          { angle: 0, x: w * 0.5, label: 'Frente (0°)' },
          { angle: 55, x: w * 0.79, label: 'Lado Der. (+55°)' }
        ];
        views.forEach((v) => {
          renderCylindricalMugOrThermos(ctx, w, h, {
            productId: selectedProductId,
            productColor,
            artCanvas,
            placement,
            rotationDeg: v.angle,
            centerXOverride: v.x,
            scaleOverride: 0.66,
            angleBadge: v.label
          });
        });
        return;
      }

      if (
        selectedProductId === 'tshirt-front' ||
        selectedProductId === 'tshirt-back' ||
        selectedProductId === 'hoodie-front'
      ) {
        renderGarmentMockup(ctx, w, h, {
          productId: selectedProductId,
          productColor,
          artCanvas,
          placement,
          finishMode
        });
      } else if (selectedProductId === 'cap-front') {
        renderCapMockup(ctx, w, h, {
          productColor,
          artCanvas,
          placement
        });
      } else if (selectedProductId === 'mug-wrap' || selectedProductId === 'thermos-bottle') {
        renderCylindricalMugOrThermos(ctx, w, h, {
          productId: selectedProductId,
          productColor,
          artCanvas,
          placement,
          rotationDeg
        });
      } else if (selectedProductId === 'mug-bottom') {
        renderMugBottomExterior(ctx, w, h, {
          productColor,
          artCanvas,
          placement,
          rotationDeg
        });
      } else if (selectedProductId === 'book-cover') {
        renderBookCoverMockup(ctx, w, h, {
          productColor,
          artCanvas,
          placement,
          finishMode
        });
      } else if (selectedProductId === 'tote-bag') {
        renderToteBagMockup(ctx, w, h, {
          productColor,
          artCanvas,
          placement
        });
      }
    },
    [
      studioTheme,
      selectedProductId,
      mugTripleView,
      productColor,
      artCanvas,
      placement,
      finishMode,
      rotationDeg
    ]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    renderMockupScene(ctx, canvas.width, canvas.height);
  }, [renderMockupScene]);

  // Arrastrar sobre el lienzo: en Tazas/Termos gira el cilindro 3D; en Textil/Gorra/Libro reposiciona el diseño
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
      const nextRot = Math.max(-110, Math.min(110, Math.round(active.initialRotation + dx * 0.45)));
      setRotationDeg(nextRot);
    } else {
      setOffsetXPercent(Math.max(-32, Math.min(32, Number((active.initialOffsetX + dx * 0.08).toFixed(1)))));
      setOffsetYPercent(Math.max(-32, Math.min(32, Number((active.initialOffsetY + dy * 0.08).toFixed(1)))));
    }
  };

  const handlePointerUp = () => {
    dragRef.current = null;
  };

  // Descargar Mockup Limpio en Alta Resolución (1600×1200 px)
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
    showToast(`Mockup HD exportado (${product.name} · ${placement.effectiveWidthCm}×${placement.effectiveHeightCm} cm)`);
  };

  // Descargar "Ficha Técnica de Aprobación para Cliente" (Lámina Comercial 1800×1200 px)
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

    // Fondo corporativo oscuro de la lámina
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, 1800, 1200);

    // 1. Área izquierda (1160×1080): Renderizado del Mockup 3D
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

    // Encabezado Superior
    ctx.fillStyle = '#10b981';
    ctx.font = '800 26px system-ui, sans-serif';
    ctx.fillText('AMAZONIAINK® PRO • FICHA DE APROBACIÓN DE PREIMPRESIÓN', 44, 62);
    ctx.fillStyle = '#a1a1aa';
    ctx.font = '600 18px ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`CÓDIGO: ${meta.approvalCode} • FECHA: ${new Date().toLocaleDateString('es-ES')}`, 1756, 62);
    ctx.textAlign = 'left';

    // 2. Columna Derecha (Panel de Especificaciones Técnicas + Miniatura del Arte)
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

    // Muestra de color del producto
    ctx.fillStyle = productColor;
    ctx.beginPath();
    ctx.arc(panelX + 495, 220 + 7 * 54 - 6, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // Miniatura del diseño plano original
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

    // Notas y recuadro de conformidad
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
      aria-label="Estudio de Mockups 3D y Fichas de Aprobación"
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

          {/* Selector rápido de familia de Soportes */}
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

      {/* CUERPO PRINCIPAL: PANEL IZQUIERDO DE CONFIGURACIÓN + ESCENARIO 3D CENTRAL */}
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
                Color del Soporte
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
                  <span className="text-stone-300">Giro 3D de la Taza / Termo:</span>
                  <span className="text-amber-300 font-mono font-bold">{rotationDeg}°</span>
                </div>
                <input
                  type="range"
                  min="-110"
                  max="110"
                  step="1"
                  value={rotationDeg}
                  onChange={(e) => setRotationDeg(Number(e.target.value))}
                  className="w-full accent-amber-400"
                />
                {(selectedProductId === 'mug-wrap' || selectedProductId === 'thermos-bottle') && (
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

          {/* 4. Datos Personalizados para la Ficha de Aprobación de Cliente */}
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

          {/* Lienzo 2.5D / 3D Interactivo */}
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
                  ? 'Arrastra horizontalmente para girar 3D'
                  : 'Arrastra sobre la prenda para mover posición'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
