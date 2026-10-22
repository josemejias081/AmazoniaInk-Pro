export const layoutGangSheet = (entries, sheetWidthCm, gapCm) => {
  const placements = [];
  let x = gapCm;
  let y = gapCm;
  let rowHeight = 0;
  let artworkAreaCm2 = 0;

  for (const entry of entries) {
    const sourceRatio = entry.imageData.height / entry.imageData.width;
    const unrotatedWidth = entry.widthCm;
    const unrotatedHeight = entry.widthCm * sourceRatio;
    const rotated = entry.rotation % 180 !== 0;
    const itemWidth = rotated ? unrotatedHeight : unrotatedWidth;
    const itemHeight = rotated ? unrotatedWidth : unrotatedHeight;
    if (itemWidth + gapCm * 2 > sheetWidthCm) {
      throw new RangeError(`${entry.name} es más ancho que el rollo seleccionado.`);
    }

    for (let copy = 0; copy < entry.copies; copy++) {
      if (placements.length >= 300) {
        throw new RangeError('La plancha no puede superar 300 diseños. Reduce la cantidad de copias.');
      }
      if (x + itemWidth + gapCm > sheetWidthCm) {
        x = gapCm;
        y += rowHeight + gapCm;
        rowHeight = 0;
      }
      placements.push({ entry, x, y, width: itemWidth, height: itemHeight, rotated });
      artworkAreaCm2 += itemWidth * itemHeight;
      x += itemWidth + gapCm;
      rowHeight = Math.max(rowHeight, itemHeight);
    }
  }
  const heightCm = Math.max(gapCm, y + rowHeight + gapCm);
  return {
    placements,
    heightCm,
    artworkAreaCm2,
    utilizationPercent: heightCm > 0 ? artworkAreaCm2 / (sheetWidthCm * heightCm) * 100 : 0
  };
};
