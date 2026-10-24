/**
 * Motor Comercial de Cotización de Metros DTF, Descuentos por Volumen y Pasarela de Pedidos
 * (Compatible con Webhook REST/Multipart, WhatsApp Business y Albarán de Producción).
 */

export const DEFAULT_VOLUME_TIERS = [
  { minMeters: 10, discountPercent: 22, label: 'Tarifa Mayorista (+10m)' },
  { minMeters: 5, discountPercent: 15, label: 'Descuento Taller (+5m)' },
  { minMeters: 3, discountPercent: 8, label: 'Descuento Volumen (+3m)' },
  { minMeters: 0, discountPercent: 0, label: 'Tarifa Estándar' }
];

export const CURRENCY_SYMBOLS = {
  EUR: '€',
  USD: '$',
  MXN: 'MX$',
  COP: 'COP$'
};

/**
 * Calcula la cotización exacta de una plancha DTF según el ancho de bobina, largo ocupado (cm),
 * modo de facturación y tramos de descuento por volumen.
 */
export const calculateDtfPricingQuote = ({
  sheetWidthCm = 58,
  usedHeightCm = 0,
  basePricePerMeter = 12.5,
  billingMode = 'exact-cm', // 'exact-cm' (mín 0.25m) | 'half-meter' (bloques de 0.5m) | 'full-meter' (bloques de 1m)
  minBillableMeters = 0.25,
  taxRatePercent = 21,
  urgentProduction = false,
  currency = 'EUR',
  volumeTiers = DEFAULT_VOLUME_TIERS
} = {}) => {
  const safeHeightCm = Math.max(0, Number(usedHeightCm) || 0);
  const rawMeters = Number((safeHeightCm / 100).toFixed(3));

  if (safeHeightCm <= 0) {
    return {
      rawMeters: 0,
      billableMeters: 0,
      widthFactor: 1,
      basePricePerMeter: Number(basePricePerMeter) || 12.5,
      discountPercent: 0,
      tierLabel: 'Sin diseños',
      effectivePricePerMeter: Number(basePricePerMeter) || 12.5,
      subtotal: 0,
      urgentFee: 0,
      taxRatePercent: Number(taxRatePercent) || 0,
      taxAmount: 0,
      total: 0,
      currency,
      currencySymbol: CURRENCY_SYMBOLS[currency] || '€'
    };
  }

  let billableMeters = rawMeters;
  if (billingMode === 'full-meter') {
    billableMeters = Math.max(1, Math.ceil(rawMeters));
  } else if (billingMode === 'half-meter') {
    billableMeters = Math.max(0.5, Math.ceil(rawMeters * 2) / 2);
  } else {
    billableMeters = Math.max(minBillableMeters, Number(rawMeters.toFixed(2)));
  }

  // Factor proporcional si se usa bobina A3 de 30 cm en vez de 58-60 cm
  const widthFactor = sheetWidthCm <= 32 ? 0.6 : 1.0;
  const adjustedBaseRate = Number(((Number(basePricePerMeter) || 12.5) * widthFactor).toFixed(2));

  // Determinar tramo de descuento por volumen
  const sortedTiers = [...volumeTiers].sort((a, b) => b.minMeters - a.minMeters);
  const matchedTier = sortedTiers.find((t) => billableMeters >= t.minMeters) || {
    minMeters: 0,
    discountPercent: 0,
    label: 'Tarifa Estándar'
  };

  const discountPercent = matchedTier.discountPercent;
  const effectivePricePerMeter = Number(
    (adjustedBaseRate * (1 - discountPercent / 100)).toFixed(2)
  );

  const subtotal = Number((billableMeters * effectivePricePerMeter).toFixed(2));
  const urgentFee = urgentProduction ? Number((subtotal * 0.2).toFixed(2)) : 0;
  const taxableBase = subtotal + urgentFee;
  const safeTaxRate = Math.max(0, Number(taxRatePercent) || 0);
  const taxAmount = Number(((taxableBase * safeTaxRate) / 100).toFixed(2));
  const total = Number((taxableBase + taxAmount).toFixed(2));

  return {
    rawMeters,
    billableMeters,
    widthFactor,
    basePricePerMeter: adjustedBaseRate,
    discountPercent,
    tierLabel: matchedTier.label,
    effectivePricePerMeter,
    subtotal,
    urgentFee,
    taxRatePercent: safeTaxRate,
    taxAmount,
    total,
    currency,
    currencySymbol: CURRENCY_SYMBOLS[currency] || '€'
  };
};

/**
 * Construye el objeto estructurado de un pedido de producción DTF con ID único trazable.
 */
export const buildDtfOrderPayload = ({
  customer = {},
  quote,
  sheetWidthCm = 58,
  usedHeightCm = 0,
  dpi = 300,
  utilizationPercent = 0,
  canvasItems = []
}) => {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const orderId = `ORD-DTF-${datePart}-${randomSuffix}`;

  // Agrupar resumen de diseños por nombre y dimensiones
  const groupedMap = new Map();
  canvasItems.forEach((item) => {
    const key = `${item.name}|${item.width}x${item.height}`;
    const existing = groupedMap.get(key);
    if (existing) {
      existing.copies += 1;
    } else {
      groupedMap.set(key, {
        name: item.name,
        widthCm: item.width,
        heightCm: item.height,
        copies: 1
      });
    }
  });

  return {
    orderId,
    createdAt: new Date().toISOString(),
    customer: {
      name: (customer.name || '').trim() || 'Cliente Taller',
      email: (customer.email || '').trim(),
      phone: (customer.phone || '').trim(),
      notes: (customer.notes || '').trim(),
      deliveryMethod: customer.deliveryMethod || 'pickup'
    },
    productionSpec: {
      sheetWidthCm,
      usedHeightCm: Number(usedHeightCm.toFixed(2)),
      dpi,
      totalPieces: canvasItems.length,
      utilizationPercent: Number((utilizationPercent || 0).toFixed(1)),
      fileName: `plancha_DTF_${orderId}_${sheetWidthCm}x${usedHeightCm.toFixed(1)}cm_${dpi}DPI.png`
    },
    itemsSummary: Array.from(groupedMap.values()),
    pricing: quote
  };
};

/**
 * Genera el enlace directo para enviar la orden de producción por WhatsApp al taller.
 */
export const buildWhatsAppOrderUrl = (workshopPhone, orderPayload) => {
  const cleanPhone = (workshopPhone || '').replace(/[^\d+]/g, '');
  const { orderId, customer, productionSpec, pricing } = orderPayload;
  const sym = pricing.currencySymbol || '€';

  const lines = [
    `✅ *NUEVO PEDIDO PLANCHA DTF — ${orderId}*`,
    `👤 *Cliente:* ${customer.name} ${customer.phone ? `(${customer.phone})` : ''}`,
    `📏 *Formato Bobina:* ${productionSpec.sheetWidthCm} cm × ${productionSpec.usedHeightCm} cm (${pricing.billableMeters} m facturables)`,
    `🎯 *Calidad:* ${productionSpec.dpi} DPI · ${productionSpec.totalPieces} piezas (${productionSpec.utilizationPercent}% aprovechamiento)`,
    `💰 *Total Pedido:* ${pricing.total.toFixed(2)} ${sym} (IVA incl.)`,
    `📎 *Archivo de máquina:* ${productionSpec.fileName}`,
    customer.notes ? `📝 *Notas:* ${customer.notes}` : ''
  ].filter(Boolean);

  const encoded = encodeURIComponent(lines.join('\n'));
  return `https://wa.me/${cleanPhone}?text=${encoded}`;
};

/**
 * Envía el pedido DTF y el archivo PNG 300 DPI a un Webhook / API externa (Shopify, WooCommerce, Make, n8n o backend propio).
 */
export const submitOrderToWebhook = async (webhookUrl, orderPayload, pngBlob = null) => {
  if (!webhookUrl || !/^https?:\/\//i.test(webhookUrl.trim())) {
    throw new Error('Introduce una URL de Webhook válida (https://...).');
  }

  const formData = new FormData();
  formData.append('orderId', orderPayload.orderId);
  formData.append('orderJson', JSON.stringify(orderPayload));
  if (pngBlob instanceof Blob) {
    formData.append('gangSheetPng', pngBlob, orderPayload.productionSpec.fileName);
  }

  const response = await fetch(webhookUrl.trim(), {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    throw new Error(`El servidor de pedidos respondió con estado ${response.status}.`);
  }
  return response;
};
