import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDtfOrderPayload,
  buildWhatsAppOrderUrl,
  calculateDtfPricingQuote
} from './dtfOrderManager.js';

test('calculateDtfPricingQuote computes exact meters, volume discount and tax', () => {
  // 1 metro (100 cm) a 12.00 €/m + 21% IVA -> 14.52 €
  const q1 = calculateDtfPricingQuote({
    sheetWidthCm: 58,
    usedHeightCm: 100,
    basePricePerMeter: 12,
    billingMode: 'exact-cm',
    taxRatePercent: 21
  });
  assert.equal(q1.billableMeters, 1);
  assert.equal(q1.discountPercent, 0);
  assert.equal(q1.subtotal, 12);
  assert.equal(q1.taxAmount, 2.52);
  assert.equal(q1.total, 14.52);

  // 5 metros (500 cm) aplica 15% de descuento por volumen
  const q5 = calculateDtfPricingQuote({
    sheetWidthCm: 58,
    usedHeightCm: 500,
    basePricePerMeter: 10,
    billingMode: 'exact-cm',
    taxRatePercent: 0
  });
  assert.equal(q5.billableMeters, 5);
  assert.equal(q5.discountPercent, 15);
  assert.equal(q5.effectivePricePerMeter, 8.5);
  assert.equal(q5.total, 42.5);
});

test('buildDtfOrderPayload and buildWhatsAppOrderUrl create structured production order', () => {
  const quote = calculateDtfPricingQuote({
    sheetWidthCm: 58,
    usedHeightCm: 120,
    basePricePerMeter: 10,
    taxRatePercent: 21
  });
  const payload = buildDtfOrderPayload({
    customer: { name: 'Estampaciones Norte', phone: '+34600112233' },
    quote,
    sheetWidthCm: 58,
    usedHeightCm: 120,
    dpi: 300,
    utilizationPercent: 78.4,
    canvasItems: [
      { name: 'Logo.png', width: 10, height: 10 },
      { name: 'Logo.png', width: 10, height: 10 }
    ]
  });

  assert.ok(payload.orderId.startsWith('ORD-DTF-'));
  assert.equal(payload.itemsSummary.length, 1);
  assert.equal(payload.itemsSummary[0].copies, 2);

  const waUrl = buildWhatsAppOrderUrl('+34 699 00 11 22', payload);
  assert.ok(waUrl.startsWith('https://wa.me/+34699001122?text='));
  assert.ok(decodeURIComponent(waUrl).includes(payload.orderId));
});
