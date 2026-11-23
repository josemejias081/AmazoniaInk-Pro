import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildClientApprovalSheetMetadata,
  calculateArtworkPlacementOnProduct,
  computeCapCrownStripTransforms,
  computeCylindricalStripTransforms,
  computeMugHandle3DProjection,
  getMockupProductById,
  MOCKUP_PRODUCTS
} from './mockupEngine.js';

test('MOCKUP_PRODUCTS catalog includes t-shirt front/back, cap, mug wrap, mug bottom, book cover, tote bag and thermos', () => {
  const ids = MOCKUP_PRODUCTS.map((p) => p.id);
  assert.ok(ids.includes('tshirt-front'));
  assert.ok(ids.includes('tshirt-back'));
  assert.ok(ids.includes('cap-front'));
  assert.ok(ids.includes('mug-wrap'));
  assert.ok(ids.includes('mug-bottom'));
  assert.ok(ids.includes('book-cover'));
  assert.ok(ids.includes('tote-bag'));
  assert.ok(ids.includes('thermos-bottle'));

  const tshirtFront = getMockupProductById('tshirt-front');
  const zoneIds = tshirtFront.zones.map((z) => z.id);
  assert.ok(zoneIds.includes('left-chest'));
  assert.ok(zoneIds.includes('center-chest'));
});

test('calculateArtworkPlacementOnProduct computes physical ratio and left-chest coordinates', () => {
  const placement = calculateArtworkPlacementOnProduct({
    productId: 'tshirt-front',
    zoneId: 'left-chest',
    artworkWidthCm: 10,
    artworkHeightCm: 10,
    useZoneRecommendedSize: true
  });

  assert.equal(placement.effectiveWidthCm, 10);
  assert.equal(placement.effectiveHeightCm, 10);
  // 10 cm on a 52 cm chest width is ~19.23%
  assert.ok(Math.abs(placement.widthRatio - 10 / 52) < 0.001);
  assert.ok(placement.centerXRatio > 0.55, 'Left chest on garment is positioned on viewer right (>0.55)');
  assert.equal(placement.exceedsRecommendedZone, false);
});

test('computeCylindricalStripTransforms projects front-facing strips with horizontal compression at cylinder edges', () => {
  const strips = computeCylindricalStripTransforms({
    cylinderRadiusPx: 140,
    artworkWidthPx: 600,
    wrapAngleDeg: 220,
    rotationDeg: 0,
    stripCount: 60
  });

  assert.ok(strips.length > 20 && strips.length < 60, 'Only front-facing cylinder strips are visible');
  const firstStrip = strips[0];
  const centerStrip = strips[Math.floor(strips.length / 2)];
  assert.ok(
    centerStrip.destW > firstStrip.destW,
    'Center strip on cylinder must be wider than compressed edge strip'
  );
  assert.ok(firstStrip.edgeShadow > centerStrip.edgeShadow, 'Cylinder edge has stronger Lambertian shadow');
});

test('computeCapCrownStripTransforms and buildClientApprovalSheetMetadata produce valid output', () => {
  const capStrips = computeCapCrownStripTransforms({
    destWidthPx: 220,
    artworkWidthPx: 500,
    archHeightPx: 16,
    stripCount: 32
  });
  assert.equal(capStrips.length, 32);

  const approval = buildClientApprovalSheetMetadata({
    projectName: 'Colección Verano',
    productId: 'mug-bottom',
    artworkWidthCm: 4.8,
    artworkHeightCm: 4.8,
    dpi: 300,
    productColorHex: '#ffffff',
    clientName: 'Cafetería Central'
  });

  assert.ok(approval.approvalCode.startsWith('APR-'));
  assert.equal(approval.clientName, 'Cafetería Central');
  assert.equal(approval.productName, 'Taza (Fondo Exterior)');

  // Verify 3D mug handle orbits with cylinder rotation
  const handleAtZero = computeMugHandle3DProjection({ rotationDeg: 0, cylinderRadiusPx: 140 });
  const handleTurnedFront = computeMugHandle3DProjection({ rotationDeg: 55, cylinderRadiusPx: 140 });
  const handleTurnedBack = computeMugHandle3DProjection({ rotationDeg: -60, cylinderRadiusPx: 140 });

  assert.ok(handleAtZero.outerOffsetX > handleAtZero.attachOffsetX);
  assert.equal(handleTurnedFront.isFrontHemisphere, true);
  assert.equal(handleTurnedBack.isFrontHemisphere, false, 'Handle rotates behind cylinder when turned past 90 deg');
});
