/**
 * Motor Matemático y Geométrico para Estudio de Mockups 3D / 2.5D y Fichas de Aprobación de Cliente.
 * Soporta:
 * - Escalado físico real en centímetros (diseño en cm vs. producto físico en cm)
 * - Proyección cilíndrica 3D por franjas para Tazas (contorno envolvente) y Termos con rotación interactiva
 * - Vista dedicada para Fondo Exterior (Base Inferior) de Taza cerámica
 * - Deformación parabólica de cúpula para Gorras (Trucker / Baseball)
 * - Proyección en perspectiva 2.5D con lomo y canal de encuadernación para Portadas de Libros / Agendas
 * - Fusión textil con pliegues, costuras y sombras para Camisetas (Frontal, Espalda, Logo Pecho Izq.), Sudaderas y Tote Bags
 */

export const MOCKUP_PRODUCTS = [
  {
    id: 'tshirt-front',
    name: 'Camiseta Frontal',
    category: 'Textil',
    techniqueDefault: 'DTF / Serigrafía',
    physicalWidthCm: 52,
    physicalHeightCm: 72,
    defaultColor: '#18181b',
    zones: [
      {
        id: 'left-chest',
        label: 'Logo Pecho Sup. Izquierdo',
        recommendedWidthCm: 10,
        maxWidthCm: 13,
        anchorX: 0.61, // Lado izquierdo del portador (derecha del espectador)
        anchorY: 0.31
      },
      {
        id: 'center-chest',
        label: 'Frontal Pecho (A4)',
        recommendedWidthCm: 24,
        maxWidthCm: 30,
        anchorX: 0.5,
        anchorY: 0.42
      },
      {
        id: 'full-front',
        label: 'Full Print Frontal (A3)',
        recommendedWidthCm: 30,
        maxWidthCm: 34,
        anchorX: 0.5,
        anchorY: 0.46
      }
    ]
  },
  {
    id: 'tshirt-back',
    name: 'Camiseta Espalda',
    category: 'Textil',
    techniqueDefault: 'DTF / Serigrafía',
    physicalWidthCm: 52,
    physicalHeightCm: 72,
    defaultColor: '#18181b',
    zones: [
      {
        id: 'full-back',
        label: 'Espalda Completa',
        recommendedWidthCm: 29,
        maxWidthCm: 34,
        anchorX: 0.5,
        anchorY: 0.42
      },
      {
        id: 'neck-label',
        label: 'Logo Nuca Superior',
        recommendedWidthCm: 7,
        maxWidthCm: 11,
        anchorX: 0.5,
        anchorY: 0.22
      }
    ]
  },
  {
    id: 'hoodie-front',
    name: 'Sudadera / Hoodie',
    category: 'Textil',
    techniqueDefault: 'DTF / Vinilo Textil',
    physicalWidthCm: 56,
    physicalHeightCm: 74,
    defaultColor: '#1e293b',
    zones: [
      {
        id: 'center-chest',
        label: 'Pecho Central',
        recommendedWidthCm: 24,
        maxWidthCm: 30,
        anchorX: 0.5,
        anchorY: 0.41
      },
      {
        id: 'left-chest',
        label: 'Logo Pecho Izquierdo',
        recommendedWidthCm: 10,
        maxWidthCm: 12,
        anchorX: 0.61,
        anchorY: 0.34
      }
    ]
  },
  {
    id: 'cap-front',
    name: 'Gorra (Panel Frontal)',
    category: 'Accesorios',
    techniqueDefault: 'DTF Gorras / Bordado',
    physicalWidthCm: 22,
    physicalHeightCm: 16,
    defaultColor: '#0f172a',
    zones: [
      {
        id: 'crown-center',
        label: 'Frente Central Copa',
        recommendedWidthCm: 11,
        maxWidthCm: 13.5,
        anchorX: 0.5,
        anchorY: 0.41
      },
      {
        id: 'crown-side',
        label: 'Logo Lateral Panel',
        recommendedWidthCm: 5.5,
        maxWidthCm: 7.5,
        anchorX: 0.65,
        anchorY: 0.43
      }
    ]
  },
  {
    id: 'mug-wrap',
    name: 'Taza 11oz (Contorno)',
    category: 'Sublimación',
    techniqueDefault: 'Sublimación / UV DTF',
    physicalWidthCm: 20.0, // Área máxima óptima horizontal (de 25.76 cm de circunferencia total, dejando 1.8-2.0 cm libres a cada lado del asa)
    physicalHeightCm: 9.5, // Altura física 9.5 cm (altura óptima imprimible: 8.5 - 9.0 cm)
    circumferenceCm: 25.76, // π × 8.2 cm de diámetro exterior
    handleGapEachSideCm: 1.8, // 1.8 cm de margen blanco de seguridad a cada lado del asa
    defaultColor: '#ffffff',
    zones: [
      {
        id: 'full-wrap',
        label: 'Envolvente Óptimo (20×8.8 cm · 1.8cm libre al asa)',
        recommendedWidthCm: 20.0,
        maxWidthCm: 20.8,
        anchorX: 0.5,
        anchorY: 0.5
      },
      {
        id: 'front-face',
        label: 'Cara Frontal Individual (9×8.5 cm)',
        recommendedWidthCm: 9.0,
        maxWidthCm: 10.5,
        anchorX: 0.5,
        anchorY: 0.5
      }
    ]
  },
  {
    id: 'mug-bottom',
    name: 'Taza (Fondo Exterior)',
    category: 'Sublimación',
    techniqueDefault: 'UV DTF / Tampografía / Sello',
    physicalWidthCm: 8.2,
    physicalHeightCm: 8.2,
    defaultColor: '#ffffff',
    zones: [
      {
        id: 'bottom-seal',
        label: 'Sello Circular Base Exterior',
        recommendedWidthCm: 4.8,
        maxWidthCm: 5.8,
        anchorX: 0.5,
        anchorY: 0.5
      }
    ]
  },
  {
    id: 'book-cover',
    name: 'Portada de Libro / Agenda',
    category: 'Editorial & UV DTF',
    techniqueDefault: 'Impresión Editorial / UV DTF',
    physicalWidthCm: 15.5,
    physicalHeightCm: 22.5,
    defaultColor: '#1c1917',
    zones: [
      {
        id: 'full-cover',
        label: 'Portada Completa a Sangre',
        recommendedWidthCm: 15.5,
        maxWidthCm: 16,
        anchorX: 0.5,
        anchorY: 0.5
      },
      {
        id: 'center-badge',
        label: 'Logo Corporativo Centrado (Agenda)',
        recommendedWidthCm: 8.5,
        maxWidthCm: 12,
        anchorX: 0.5,
        anchorY: 0.44
      }
    ]
  },
  {
    id: 'tote-bag',
    name: 'Tote Bag (Bolsa Lienzo)',
    category: 'Textil',
    techniqueDefault: 'DTF / Serigrafía / Sublimación',
    physicalWidthCm: 38,
    physicalHeightCm: 42,
    defaultColor: '#e7e0d3',
    zones: [
      {
        id: 'bag-center',
        label: 'Área Central Bolsa',
        recommendedWidthCm: 22,
        maxWidthCm: 28,
        anchorX: 0.5,
        anchorY: 0.65
      }
    ]
  },
  {
    id: 'thermos-bottle',
    name: 'Termo / Botella Cilíndrica',
    category: 'Sublimación',
    techniqueDefault: 'Sublimación / Grabado / UV DTF',
    physicalWidthCm: 22,
    physicalHeightCm: 16,
    defaultColor: '#f8fafc',
    zones: [
      {
        id: 'bottle-wrap',
        label: 'Cuerpo Cilíndrico Termo',
        recommendedWidthCm: 14,
        maxWidthCm: 22,
        anchorX: 0.5,
        anchorY: 0.59
      }
    ]
  }
];

export const MOCKUP_COLOR_SWATCHES = [
  { name: 'Negro Azabache', hex: '#141417' },
  { name: 'Blanco Puro', hex: '#f8fafc' },
  { name: 'Gris Jaspeado', hex: '#94a3b8' },
  { name: 'Azul Marino', hex: '#1e3a8a' },
  { name: 'Verde Bosque', hex: '#065f46' },
  { name: 'Rojo Carmesí', hex: '#991b1b' },
  { name: 'Arena / Crudo Tote', hex: '#e7e0d3' },
  { name: 'Mostaza / Oro', hex: '#d97706' }
];

const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

export const getMockupProductById = (productId) =>
  MOCKUP_PRODUCTS.find((p) => p.id === productId) || MOCKUP_PRODUCTS[0];

/**
 * Calcula la proporción y coordenadas normalizadas del diseño sobre el soporte físico
 * respetando la relación real entre los centímetros del diseño y los centímetros del producto.
 */
export const calculateArtworkPlacementOnProduct = ({
  productId = 'tshirt-front',
  zoneId = null,
  artworkWidthCm = 10,
  artworkHeightCm = 10,
  offsetXPercent = 0,
  offsetYPercent = 0,
  scaleMultiplier = 1,
  useZoneRecommendedSize = false
} = {}) => {
  const product = getMockupProductById(productId);
  const zone = product.zones.find((z) => z.id === zoneId) || product.zones[0];

  const aspect = Math.max(0.05, Number(artworkHeightCm) || 10) / Math.max(0.05, Number(artworkWidthCm) || 10);
  const baseWidthCm = useZoneRecommendedSize
    ? zone.recommendedWidthCm
    : clamp(Number(artworkWidthCm) || zone.recommendedWidthCm, 1.5, product.physicalWidthCm * 1.15);

  const effectiveWidthCm = clamp(
    baseWidthCm * clamp(Number(scaleMultiplier) || 1, 0.25, 2.5),
    1,
    product.physicalWidthCm * 1.25
  );
  const effectiveHeightCm = Number((effectiveWidthCm * aspect).toFixed(2));

  const widthRatio = effectiveWidthCm / product.physicalWidthCm;
  const heightRatio = effectiveHeightCm / product.physicalHeightCm;

  const centerXRatio = clamp(zone.anchorX + (Number(offsetXPercent) || 0) / 100, 0.1, 0.9);
  const centerYRatio = clamp(zone.anchorY + (Number(offsetYPercent) || 0) / 100, 0.1, 0.9);

  return {
    product,
    zone,
    effectiveWidthCm: Number(effectiveWidthCm.toFixed(2)),
    effectiveHeightCm,
    widthRatio,
    heightRatio,
    centerXRatio,
    centerYRatio,
    exceedsRecommendedZone: effectiveWidthCm > zone.maxWidthCm + 0.2
  };
};

// Normaliza cualquier ángulo en radianes al rango [-PI, +PI]
const normalizeAngleRad = (rad) => Math.atan2(Math.sin(rad), Math.cos(rad));

/**
 * Calcula las franjas verticales de proyección cilíndrica 3D para envolver un diseño plano
 * alrededor de una Taza (circunferencia 25.76 cm = 360°) o Termo con rotación completa (-180° a +180°).
 *
 * Geometría real de sublimación en Taza 11 oz:
 * - El centro del diseño (u = 0.5) está en 0° (exactamente opuesto al asa, que está en 180°).
 * - El arco máximo imprimible se limita a 290° (±145°), dejando siempre un margen mínimo de 35°
 *   (~1.8 - 2.0 cm libres de cerámica sin estampar) a AMBOS lados del asa (180°).
 */
export const computeCylindricalStripTransforms = ({
  cylinderRadiusPx = 140,
  artworkWidthPx = 600,
  wrapAngleDeg = 280, // 20 cm sobre 25.76 cm de circunferencia = 279.5° (deja ~40° = 2.0 cm libres a cada lado del asa en 180°)
  rotationDeg = 0, // Giro interactivo del usuario (-180° a +180°)
  stripCount = 84
} = {}) => {
  const R = Math.max(10, Number(cylinderRadiusPx) || 140);
  const N = clamp(Math.round(Number(stripCount) || 84), 8, 180);
  // Tope físico de 290° para respetar siempre el margen de seguridad de 1.5-2.0 cm a ambos lados del asa (en 180°)
  const totalWrapRad = (clamp(Number(wrapAngleDeg) || 280, 25, 290) * Math.PI) / 180;
  const rotRad = ((Number(rotationDeg) || 0) * Math.PI) / 180;
  const halfWrap = totalWrapRad / 2;
  const halfStepRad = totalWrapRad / (2 * N);

  const strips = [];
  const maxVisibleAngle = Math.PI * 0.488; // ~88° a izquierda y derecha de la cara frontal

  for (let i = 0; i < N; i++) {
    const u0 = i / N;
    const u1 = (i + 1) / N;
    const uMid = (u0 + u1) * 0.5;

    // Ángulo local de la franja sobre el cilindro (-halfWrap .. +halfWrap) más rotación de cámara,
    // normalizado a [-PI, +PI] para que al girar más de 90° aparezcan ambos extremos de la imagen a cada lado del asa
    const phiMid = (uMid - 0.5) * totalWrapRad;
    const thetaMid = normalizeAngleRad(phiMid + rotRad);
    const theta0 = thetaMid - halfStepRad;
    const theta1 = thetaMid + halfStepRad;

    if (theta1 <= -maxVisibleAngle || theta0 >= maxVisibleAngle) {
      continue;
    }

    const clampedT0 = clamp(theta0, -maxVisibleAngle, maxVisibleAngle);
    const clampedT1 = clamp(theta1, -maxVisibleAngle, maxVisibleAngle);
    if (clampedT1 <= clampedT0) continue;

    // Proyección ortográfica sobre el eje X de pantalla: x = R * sin(theta)
    const x0 = R * Math.sin(clampedT0);
    const x1 = R * Math.sin(clampedT1);
    const destW = Math.max(0.5, x1 - x0);

    // Desplazamiento vertical de perspectiva elíptica (curvatura de la boca y base de la taza)
    const cosMid = Math.cos(clamp(thetaMid, -maxVisibleAngle, maxVisibleAngle));
    const verticalCurveOffsetRatio = 1 - cosMid; // 0 en el centro, ~1 en los bordes laterales

    // Sombreado Lambertiano + brillo especular cerámico en torno a -22°
    const specularAngle = thetaMid + 0.38;
    const specularHighlight = Math.exp(-(specularAngle * specularAngle) / 0.045) * 0.34;
    const edgeShadow = Math.pow(1 - cosMid, 1.45) * 0.48;

    strips.push({
      index: i,
      srcX: u0 * artworkWidthPx,
      srcW: Math.max(1, (u1 - u0) * artworkWidthPx),
      destOffsetX: x0,
      destW: destW + 0.6, // Solape sub-píxel para evitar grietas
      cosDepth: cosMid,
      verticalCurveOffsetRatio,
      edgeShadow,
      specularHighlight,
      halfWrap
    });
  }

  return strips;
};

/**
 * Calcula la proyección 3D exacta del agarradero (asa) de la taza situada en 180°
 * (exactamente en el lado opuesto al centro de la plantilla 0°), girando solidariamente
 * con el cilindro según `rotationDeg` (-180° a +180°).
 *
 * Como la plantilla máxima abarca ±140° (20 cm de los 25.76 cm de circunferencia) y el asa
 * está en 180° (ocupando ±10°), quedan siempre ~30° (1.8 - 2.0 cm) de cerámica libre sin imagen
 * a AMBOS lados del asa.
 */
export const computeMugHandle3DProjection = ({
  rotationDeg = 0,
  cylinderRadiusPx = 140
} = {}) => {
  const R = Math.max(10, Number(cylinderRadiusPx) || 140);
  // En cualquier taza real de sublimación, el asa está a 180° del centro del diseño (0°)
  const handleBaseAngleDeg = 180;
  const thetaRad = normalizeAngleRad(((handleBaseAngleDeg + Number(rotationDeg || 0)) * Math.PI) / 180);

  const sinT = Math.sin(thetaRad);
  const cosT = Math.cos(thetaRad);

  // Coordenada X donde los anclajes superior e inferior del asa se unen a la pared de la taza
  const attachOffsetX = R * sinT;
  // Coordenada X del arco exterior del asa (se extiende radialmente desde el cilindro)
  const radialExtension = R * 0.62;
  const outerOffsetX = (R + radialExtension) * sinT;

  // Profundidad Z normalizada (-1 detrás del cilindro .. +1 frente a la cámara)
  const depthZ = cosT;
  const isFrontHemisphere = depthZ >= -0.05;

  // Grosor aparente y apertura del lazo en perspectiva según el ángulo
  const perspectiveThicknessScale = 0.72 + 0.28 * Math.abs(sinT);
  const loopVisibility = Math.abs(sinT); // 1 de perfil (±90°), 0 cuando el asa apunta directo a cámara (0° o 180°)

  return {
    thetaDeg: Number(((thetaRad * 180) / Math.PI).toFixed(2)),
    attachOffsetX,
    outerOffsetX,
    depthZ,
    isFrontHemisphere,
    perspectiveThicknessScale,
    loopVisibility,
    sinT,
    cosT,
    blankMarginEachSideCm: 1.85
  };
};

/**
 * Calcula las franjas verticales con curvatura de cúpula para el panel frontal de una Gorra.
 */
export const computeCapCrownStripTransforms = ({
  destWidthPx = 200,
  artworkWidthPx = 400,
  archHeightPx = 18,
  stripCount = 40
} = {}) => {
  const N = clamp(Math.round(Number(stripCount) || 40), 8, 120);
  const strips = [];
  for (let i = 0; i < N; i++) {
    const u0 = i / N;
    const u1 = (i + 1) / N;
    const uMid = (u0 + u1) * 0.5;
    const normX = (uMid - 0.5) * 2; // -1 .. +1

    // Compresión lateral suave hacia las sienes de la gorra y arco parabólico superior
    const destX = (u0 - 0.5) * destWidthPx;
    const destW = (u1 - u0) * destWidthPx + 0.5;
    const archOffsetY = (normX * normX - 0.3) * archHeightPx;
    const scaleY = 1 - Math.abs(normX) * 0.07;
    const shadeAlpha = Math.pow(Math.abs(normX), 1.6) * 0.32;

    strips.push({
      index: i,
      srcX: u0 * artworkWidthPx,
      srcW: Math.max(1, (u1 - u0) * artworkWidthPx),
      destOffsetX: destX,
      destW,
      archOffsetY,
      scaleY,
      shadeAlpha
    });
  }
  return strips;
};

/**
 * Genera los metadatos estructurados de la Ficha Técnica de Aprobación de Cliente.
 */
export const buildClientApprovalSheetMetadata = ({
  projectName = 'Diseño Personalizado',
  productId = 'tshirt-front',
  zoneId = null,
  artworkWidthCm = 10,
  artworkHeightCm = 10,
  dpi = 300,
  productColorHex = '#141417',
  technique = '',
  clientName = '',
  notes = ''
} = {}) => {
  const placement = calculateArtworkPlacementOnProduct({
    productId,
    zoneId,
    artworkWidthCm,
    artworkHeightCm
  });

  const approvalCode = `APR-${Date.now().toString(36).toUpperCase().slice(-6)}`;
  return {
    approvalCode,
    createdAtIso: new Date().toISOString(),
    projectName: projectName.trim() || 'Diseño Personalizado',
    clientName: clientName.trim() || 'Cliente / Taller',
    productName: placement.product.name,
    category: placement.product.category,
    zoneLabel: placement.zone.label,
    technique: technique.trim() || placement.product.techniqueDefault,
    artworkDimensionsCm: `${placement.effectiveWidthCm} × ${placement.effectiveHeightCm} cm`,
    productDimensionsCm: `${placement.product.physicalWidthCm} × ${placement.product.physicalHeightCm} cm`,
    resolutionDpi: `${dpi} DPI`,
    productColorHex: productColorHex.toUpperCase(),
    notes: notes.trim() || 'Verifique medidas, posición y colores antes de confirmar la producción.'
  };
};
