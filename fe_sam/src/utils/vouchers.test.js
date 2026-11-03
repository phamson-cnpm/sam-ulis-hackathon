
import { voucherGroups, voucherKey } from './vouchers';
import { daysBetween } from './format';
import { computeLight } from './lights';

const th = { redPct: 20, orangePct: 30, orangeCount: 3, repeatCount: 2, warehouseMonths: 12, cumulativePct: 40 };

test('số hóa đơn so không phân biệt hoa thường, khoảng trắng', () => {
  expect(voucherKey(' HĐ 0012345 ')).toBe(voucherKey('hđ0012345'));
});

test('hóa đơn gộp: cộng chi phí thực tế các mã cùng hóa đơn, lấy tổng hóa đơn đã nhập', () => {
  const est = (id, no, actual, total = null) => ({
    id,
    voucherNo: no,
    voucherTotal: total,
    actualEnteredAt: '2026-10-20T09:00',
    lines: [{ actual }],
  });
  const g = voucherGroups([
    est('a', 'HĐ 1', 1_200_000, 3_000_000),
    est('b', 'hđ 1', 900_000),
    est('c', 'HĐ 2', 500_000),
    { id: 'd', voucherNo: null, actualEnteredAt: null, lines: [] },
  ]);
  expect(g[voucherKey('HĐ 1')]).toEqual({ count: 2, sum: 2_100_000, total: 3_000_000 });
  expect(g[voucherKey('HĐ 2')]).toEqual({ count: 1, sum: 500_000, total: null });
});

test('số ngày đã chờ', () => {
  expect(daysBetween('2026-10-20T09:30', '2026-10-28')).toBe(8);
  expect(daysBetween('2026-10-28', '2026-10-28')).toBe(0);
  expect(daysBetween('2025-12-31', '2026-01-02')).toBe(2);
  expect(daysBetween(null, '2026-10-28')).toBeNull();
});

test('đèn đỏ năm trước giữ sang năm nay đến khi Phòng KHTC loại khỏi danh sách', () => {
  const asset = { id: 'x', originalCost: 10_000_000, residualValue: 0, location: 'A1.101', status: 'dang_su_dung' };
  const ests = [
    {
      id: 'e1',
      assetId: 'x',
      createdAt: '2025-06-10',
      status: 'da_ky_du',
      lines: [{ costGroup: 'tinh', estimate: 2_500_000, actual: 2_500_000 }],
    },
  ];
  const kept = computeLight(asset, ests, th, { asOf: '2026-10-28' });
  expect(kept.code).toBe('do_1_1');
  expect(kept.keptFrom).toBe(2025);
  expect(kept.labels.slice(0, 2)).toEqual(['Chờ thanh lý', 'Giữ từ năm 2025']);
  const cleared = computeLight({ ...asset, disposalClearedAt: '2026-03-01' }, ests, th, { asOf: '2026-10-28' });
  expect(cleared.code).toBe('xanh_la');
  const disposed = computeLight({ ...asset, status: 'da_thanh_ly' }, ests, th, { asOf: '2026-10-28' });
  expect(disposed.code).toBe('da_thanh_ly');
});
