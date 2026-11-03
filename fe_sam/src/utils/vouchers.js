
// Hóa đơn, chứng từ của chi phí thực tế.

/** Số hóa đơn so không phân biệt hoa thường, khoảng trắng (giống máy chủ). */
export const voucherKey = (no) => String(no || '').replace(/\s+/g, '').toLowerCase();

/** Hóa đơn gộp nhiều mã tài sản: tổng chi phí thực tế các mã so với tổng tiền hóa đơn (mục 5.5 đề tài). */
export const voucherGroups = (estimates) => {
  const g = {};
  for (const e of estimates || []) {
    if (!e.actualEnteredAt || !e.voucherNo) continue;
    const k = voucherKey(e.voucherNo);
    const x = g[k] || (g[k] = { count: 0, sum: 0, total: null });
    x.count += 1;
    x.sum += e.lines.reduce((s, l) => s + (l.actual ?? 0), 0);
    if (e.voucherTotal !== null && e.voucherTotal !== undefined) x.total = e.voucherTotal;
  }
  return g;
};
