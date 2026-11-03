
// Nội dung các file Excel (.xlsx) tải về. Mỗi hàm trả về danh sách trang tính cho utils/xlsx.js.
// Cán bộ đầu mối: chỉ các cột màu đèn, mã, tên, phòng ban, vị trí, nguyên giá, Đề xuất (API cũng chỉ trả các trường này).
import { LIGHT_META, LIGHT_ORDER, countedCost } from './lights';
import { dateVN } from './format';
import { TODAY } from '../config/app';
import { ESTIMATE_STATUS, PROPOSAL_KIND, PROPOSAL_STATUS } from './labels';

const lightLabel = (code) => LIGHT_META[code]?.label || '';
const byLightThenCode = (a, b) =>
  (LIGHT_META[a.light.code]?.rank ?? 9) - (LIGHT_META[b.light.code]?.rank ?? 9) || a.code.localeCompare(b.code);

/** Cán bộ đầu mối: tài sản theo màu đèn (chỉ các cột được xem), có cột Kiểm kê (0 chưa kiểm, 1 đã thấy), Ghi chú để điền. */
export function unitAssetsSheets(assets, { unit, filterNote }) {
  const list = [...assets].sort(byLightThenCode);
  return [
    {
      name: 'Tài sản theo màu đèn',
      title: `DANH SÁCH TÀI SẢN THEO MÀU ĐÈN – ${unit.toUpperCase()}`,
      note: `Số liệu đến ngày ${dateVN(TODAY)}${filterNote ? `; lọc: ${filterNote}` : ''}. Cột Kiểm kê: 0 chưa kiểm, đánh 1 khi thấy tài sản thực tế. Màu đèn chỉ là căn cứ đề xuất.`,
      columns: [
        { header: 'STT', width: 6 },
        { header: 'Màu đèn', width: 12 },
        { header: 'Mã tài sản', width: 20 },
        { header: 'Tên tài sản', width: 36 },
        { header: 'Phòng ban', width: 28 },
        { header: 'Vị trí', width: 12 },
        { header: 'Nguyên giá (đ)', width: 16 },
        { header: 'Đề xuất', width: 30 },
        { header: 'Kiểm kê', width: 10 },
        { header: 'Ghi chú', width: 24 },
      ],
      rows: list.map((a, i) => [
        i + 1,
        lightLabel(a.light.code),
        a.code,
        a.name,
        a.unit,
        a.location,
        a.originalCost,
        proposalText(a),
        0,
        '',
      ]),
    },
  ];
}

/** Nội dung ô Đề xuất khi xuất file: đề xuất gần nhất (trạng thái, lý do không duyệt) hoặc gợi ý theo màu đèn. */
export function proposalText(a) {
  const p = a.proposal;
  if (p) {
    const base = `${PROPOSAL_KIND[p.kind]}: ${PROPOSAL_STATUS[p.status]}`;
    return p.status === 'khong_duyet' && p.decisionNote ? `${base} (${p.decisionNote})` : base;
  }
  return a.suggestion ? `Gợi ý: ${a.suggestion.text.toLowerCase()}` : '';
}

/** Danh sách đề xuất xử lý tài sản (lưu hồ sơ đơn vị, Phòng KHTC tổng hợp). */
export function proposalsSheets(list, { nameOf }) {
  return [
    {
      name: 'Đề xuất xử lý tài sản',
      title: 'DANH SÁCH ĐỀ XUẤT XỬ LÝ TÀI SẢN',
      note: `Lập ngày ${dateVN(TODAY)} từ phần mềm SAM, ${list.length} đề xuất. Quyết định thanh lý thực hiện theo quy định hiện hành.`,
      columns: [
        { header: 'STT', width: 6 },
        { header: 'Số đề xuất', width: 12 },
        { header: 'Loại', width: 12 },
        { header: 'Mã tài sản', width: 20 },
        { header: 'Tên tài sản', width: 34 },
        { header: 'Phòng ban', width: 26 },
        { header: 'Vị trí', width: 12 },
        { header: 'Nguyên giá (đ)', width: 16 },
        { header: 'Màu đèn', width: 12 },
        { header: 'Lý do đề xuất', width: 40 },
        { header: 'Người đề xuất', width: 24 },
        { header: 'Ngày đề xuất', width: 14 },
        { header: 'Trạng thái', width: 22 },
        { header: 'Lý do không duyệt, ghi chú', width: 36 },
      ],
      rows: list.map((p, i) => [
        i + 1,
        p.code,
        PROPOSAL_KIND[p.kind],
        p.asset?.code || '',
        p.asset?.name || '',
        p.asset?.unit || '',
        p.asset?.location || '',
        p.asset?.originalCost || 0,
        p.asset?.light ? lightLabel(p.asset.light.code) : '',
        p.reason,
        nameOf(p.createdBy),
        dateVN(p.createdAt.slice(0, 10)),
        PROPOSAL_STATUS[p.status],
        p.decisionNote || '',
      ]),
    },
  ];
}

/** Phòng QTNL, Phòng KHTC: danh sách tài sản theo bộ lọc, có chi phí sửa chữa. */
export function assetsSheets(assets, { filterNote, year }) {
  return [
    {
      name: 'Danh sách tài sản',
      title: 'DANH SÁCH TÀI SẢN THEO MÀU ĐÈN',
      note: `Số liệu đến ngày ${dateVN(TODAY)}${filterNote ? `; lọc: ${filterNote}` : ''}. Chi phí chỉ tính nhóm Sửa chữa, thay linh kiện.`,
      columns: [
        { header: 'Đèn', width: 12 },
        { header: 'Mã tài sản (mã tem)', width: 20 },
        { header: 'Tên tài sản', width: 34 },
        { header: 'Nhóm', width: 22 },
        { header: 'Đơn vị quản lý, sử dụng', width: 28 },
        { header: 'Vị trí', width: 11 },
        { header: 'Ngày đưa vào sử dụng', width: 14 },
        { header: 'Nguyên giá (đ)', width: 15 },
        { header: 'Giá trị còn lại (đ)', width: 15 },
        { header: `Số lần sửa năm ${year}`, width: 11 },
        { header: `Chi phí sửa năm ${year} (đ)`, width: 15 },
        { header: 'Chi phí sửa cộng dồn (đ)', width: 15 },
        { header: 'Nhãn cảnh báo', width: 34 },
        { header: 'Đề xuất', width: 34 },
      ],
      rows: assets.map((a) => [
        lightLabel(a.light.code),
        a.code,
        a.name,
        `${a.groupCode} ${a.groupName}`,
        a.unit,
        a.location,
        dateVN(a.inUseDate),
        a.originalCost,
        a.residualValue,
        a.light.yearCount ?? '',
        a.light.yearCost ?? '',
        a.light.cumulativeCost ?? '',
        a.light.labels.join('; '),
        proposalText(a),
      ]),
    },
  ];
}

/** Phòng QTNL: danh sách phiếu dự toán; Phòng KHTC: đối chiếu chi phí với chứng từ. */
export function estimatesSheets(list, { assetOf, nameOf, tabLabel }) {
  return [
    {
      name: 'Phiếu dự toán',
      title: 'DANH SÁCH PHIẾU DỰ TOÁN SỬA CHỮA, THAY THẾ',
      note: `Số liệu đến ngày ${dateVN(TODAY)}; ${tabLabel}.`,
      columns: [
        { header: 'Số phiếu', width: 11 },
        { header: 'Ngày lập', width: 12 },
        { header: 'Mã tài sản', width: 20 },
        { header: 'Tên tài sản', width: 32 },
        { header: 'Dự toán (đ)', width: 14 },
        { header: 'Tính vào đèn (đ)', width: 14 },
        { header: 'Thực tế (đ)', width: 14 },
        { header: 'Chứng từ', width: 16 },
        { header: 'Đèn sau phiếu', width: 12 },
        { header: 'Trạng thái', width: 22 },
        { header: 'Người lập', width: 20 },
      ],
      rows: list.map((e) => {
        const a = assetOf(e.assetId);
        return [
          e.code,
          dateVN(e.createdAt),
          a?.code || '',
          a?.name || '',
          e.lines.reduce((s, l) => s + l.estimate, 0),
          countedCost(e.lines).cost,
          e.actualEnteredAt ? e.lines.reduce((s, l) => s + (l.actual ?? 0), 0) : '',
          e.voucherNo || '',
          lightLabel(e.lightAfter),
          ESTIMATE_STATUS[e.status] || e.status,
          nameOf(e.createdBy),
        ];
      }),
    },
  ];
}

/** Phòng KHTC: số liệu trang Tổng quan, mỗi bảng một trang tính. */
export function dashboardSheets({ assets, stats, noSpares, year }) {
  const assetRows = (list, extra) =>
    list.map((a, i) => [i + 1, lightLabel(a.light.code), a.code, a.name, a.unit, a.location, a.originalCost, ...extra(a)]);
  const baseCols = [
    { header: 'STT', width: 6 },
    { header: 'Đèn', width: 12 },
    { header: 'Mã tài sản', width: 20 },
    { header: 'Tên tài sản', width: 34 },
    { header: 'Đơn vị', width: 28 },
    { header: 'Vị trí', width: 11 },
    { header: 'Nguyên giá (đ)', width: 15 },
  ];
  const groups = {};
  noSpares.forEach((n) => {
    const g = groups[n.need] || (groups[n.need] = { need: n.need, count: 0, last: n.recordedAt, reasons: new Set() });
    g.count += 1;
    g.reasons.add(n.reason);
    if (n.recordedAt > g.last) g.last = n.recordedAt;
  });
  return [
    {
      name: 'Theo màu đèn',
      title: `TỔNG QUAN TÀI SẢN – SỐ LIỆU ĐẾN NGÀY ${dateVN(TODAY)}`,
      note: `Sửa chữa, thay linh kiện năm ${year} (phần tính vào đèn): ${stats.yearRepair.toLocaleString('vi-VN')} đ; tổng chi phí năm cả bảo dưỡng, vật tư: ${stats.yearAll.toLocaleString('vi-VN')} đ.`,
      columns: [
        { header: 'Đèn', width: 14 },
        { header: 'Ý nghĩa', width: 70 },
        { header: 'Số tài sản', width: 12 },
        { header: 'Nguyên giá (đ)', width: 18 },
      ],
      rows: LIGHT_ORDER.map((c) => {
        const l = stats.by[c] || [];
        return [LIGHT_META[c].label, LIGHT_META[c].desc, l.length, l.reduce((s, a) => s + a.originalCost, 0)];
      }),
    },
    {
      name: 'Theo đơn vị',
      title: 'SỐ TÀI SẢN THEO ĐƠN VỊ VÀ MÀU ĐÈN',
      columns: [
        { header: 'Đơn vị quản lý, sử dụng', width: 40 },
        { header: 'Tổng', width: 9 },
        { header: 'Đỏ', width: 9 },
        { header: 'Cam', width: 9 },
        { header: 'Vàng', width: 9 },
        { header: 'Xanh lá', width: 9 },
        { header: 'Xanh dương', width: 11 },
      ],
      rows: stats.units.map((u) => [u.unit, u.total, ...u.cols]),
    },
    {
      name: 'Theo nhóm tài sản',
      title: 'SỐ TÀI SẢN THEO NHÓM TÀI SẢN VÀ MÀU ĐÈN',
      columns: [
        { header: 'Mã nhóm', width: 10 },
        { header: 'Nhóm tài sản', width: 36 },
        { header: 'Tổng', width: 9 },
        { header: 'Đỏ', width: 9 },
        { header: 'Cam', width: 9 },
        { header: 'Vàng', width: 9 },
        { header: 'Xanh lá', width: 9 },
        { header: 'Xanh dương', width: 11 },
      ],
      rows: stats.groups.map((g) => [g.code, g.name, g.total, ...g.cols]),
    },
    {
      name: 'Chờ thanh lý',
      title: 'TÀI SẢN CHỜ THANH LÝ (ĐÈN ĐỎ)',
      columns: [...baseCols, { header: 'Nhãn', width: 40 }],
      rows: assetRows(stats.red, (a) => [a.light.labels.join('; ')]),
    },
    {
      name: 'Sửa chữa kéo dài',
      title: 'TÀI SẢN SỬA CHỮA KÉO DÀI (VÀNG 3.3) – RÀ SOÁT THAY THẾ KHI LẬP KẾ HOẠCH MUA SẮM',
      columns: [...baseCols, { header: 'Chi phí sửa cộng dồn (đ)', width: 16 }, { header: 'Tỷ lệ nguyên giá', width: 12 }],
      rows: assetRows(stats.longRepair, (a) => [a.light.cumulativeCost, Math.round(a.light.cumulativeRatio * 1000) / 10 + '%']),
    },
    {
      name: 'Tồn kho cần rà soát',
      title: 'TÀI SẢN NẰM KHO CẦN RÀ SOÁT, ĐIỀU CHUYỂN (VÀNG 3.1)',
      columns: [...baseCols, { header: 'Số tháng nằm kho', width: 12 }],
      rows: assetRows(stats.idle, (a) => [a.light.warehouseMonths ?? '']),
    },
    {
      name: 'Kho không có thiết bị',
      title: 'KHO KHÔNG CÓ THIẾT BỊ THAY THẾ – DỮ LIỆU KẾ HOẠCH MUA SẮM',
      columns: [
        { header: 'Thiết bị cần cấp tạm', width: 28 },
        { header: 'Số lần thiếu', width: 12 },
        { header: 'Gần nhất', width: 12 },
        { header: 'Lý do', width: 70 },
      ],
      rows: Object.values(groups)
        .sort((a, b) => b.count - a.count)
        .map((g) => [g.need, g.count, dateVN(g.last), [...g.reasons].join('; ')]),
    },
    {
      name: 'Tất cả tài sản',
      title: 'DANH SÁCH TÀI SẢN',
      columns: [...baseCols, { header: 'Giá trị còn lại (đ)', width: 15 }, { header: 'Nhãn', width: 40 }],
      rows: assetRows(assets, (a) => [a.residualValue, a.light.labels.join('; ')]),
    },
  ];
}
