
// Tính màu đèn cảnh báo vòng đời cho một tài sản (SAM Alert Matrix, mục 5.3 đề tài).
// Hàm thuần. Máy chủ tính đèn bằng bản Python be_sam/services/light_service.py, so khớp với hàm này
// (be_sam/tests/test_lights_parity.py); giao diện dùng hàm này để điền biểu mẫu in.
// Tài sản chờ thanh lý (Đỏ 1.1, Đỏ 1.2) giữ đèn đỏ khi sang năm tài chính mới cho đến khi Phòng KHTC quyết định
// thanh lý (trạng thái "Đã thanh lý") hoặc loại khỏi danh sách (ngày disposalClearedAt): đèn năm nay giữ đỏ nếu đèn
// tính đến hết ngày 31/12 năm trước là đỏ.

// Phiếu "Không đồng ý" không tính vào số lần sửa và chi phí.
export const COUNTED_STATUSES = ['cho_lanh_dao', 'can_kiem_tra_lai', 'da_xac_nhan', 'da_ky_du'];

export const RED = ['do_1_1', 'do_1_2'];
// Thứ tự ưu tiên đèn (số nhỏ là nặng hơn), dùng khi giữ màu đèn của tài sản đã thu hồi về kho
const RANK = { do_1_1: 0, do_1_2: 1, cam: 2, vang_3_1: 3, vang_3_2: 4, vang_3_3: 5, xanh_la: 6, xanh_duong: 7 };
export const LOCKING = ['do_1_1', 'cam'];

export function monthsBetween(from, to) {
  const a = new Date(from.slice(0, 10) + 'T00:00:00');
  const b = new Date(to.slice(0, 10) + 'T00:00:00');
  let m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) m -= 1;
  return Math.max(m, 0);
}

/** Chi phí một phiếu được tính vào đèn: chỉ dòng nhóm "sửa chữa, thay linh kiện". */
export function countedCost(lines) {
  let cost = 0;
  let provisional = false;
  let hasRepair = false;
  for (const l of lines) {
    if (l.costGroup !== 'tinh') continue;
    hasRepair = true;
    if (l.actual === null || l.actual === undefined) {
      provisional = true;
      cost += l.estimate || 0;
    } else {
      cost += l.actual;
    }
  }
  return { cost, provisional, hasRepair };
}

/** Tài sản có dữ liệu làm đèn đỏ trước ngày end (phiếu dự toán được tính, hư hỏng toàn phần, thu hồi về kho). */
function hasHistory(asset, estimates, end, excludeEstimateId) {
  const est = estimates.some(
    (e) =>
      e.assetId === asset.id &&
      e.id !== excludeEstimateId &&
      COUNTED_STATUSES.includes(e.status) &&
      e.createdAt.slice(0, 10) <= end,
  );
  return est || ['totalLossConfirmedAt', 'recalledAt'].some((k) => !!asset[k] && asset[k].slice(0, 10) <= end);
}

export function computeLight(asset, estimates, th, opts) {
  const asOf = opts.asOf.slice(0, 10);
  const year = asOf.slice(0, 4);
  const fully = asset.residualValue <= 0;

  let yearCount = 0;
  let yearCost = 0;
  let cumulativeCost = 0;
  let provisional = false;

  const relevant = estimates.filter(
    (e) =>
      e.assetId === asset.id &&
      e.id !== opts.excludeEstimateId &&
      COUNTED_STATUSES.includes(e.status) &&
      e.createdAt.slice(0, 10) <= asOf,
  );
  const items = relevant.map((e) => ({ date: e.createdAt.slice(0, 10), ...countedCost(e.lines) }));
  if (opts.draftLines && opts.draftLines.length) {
    items.push({ date: asOf, ...countedCost(opts.draftLines) });
  }
  for (const it of items) {
    if (!it.hasRepair) continue;
    cumulativeCost += it.cost;
    if (it.date.slice(0, 4) === year) {
      yearCount += 1;
      yearCost += it.cost;
      if (it.provisional) provisional = true;
    }
  }

  const base = asset.originalCost > 0 ? asset.originalCost : 0;
  const yearRatio = base ? yearCost / base : 0;
  const cumulativeRatio = base ? cumulativeCost / base : 0;
  // Tài sản đã thu hồi về kho chờ phương án xử lý: không tính đèn Vàng 3.1 (nằm kho), giữ màu đèn lúc thu hồi.
  const recalledAt = (asset.recalledAt || '').slice(0, 10);
  const recalled = asset.status === 'thu_hoi_kho' && (!recalledAt || recalledAt <= asOf);
  const inWarehouse = !recalled && (asset.location || '').toUpperCase().startsWith('KHO');
  const whMonths = inWarehouse && asset.lastInteractionDate ? monthsBetween(asset.lastInteractionDate, asOf) : null;
  const cleared = (asset.disposalClearedAt || '').slice(0, 10);
  // Phòng KHTC đã loại tài sản khỏi danh sách chờ thanh lý sau ngày d (ngày bắt đầu giữ đèn đỏ)
  const clearedSince = (d) => !!cleared && d <= cleared && cleared <= asOf;
  const tl = (asset.totalLossConfirmedAt || '').slice(0, 10);
  const totalLoss = !!tl && tl <= asOf && !clearedSince(tl);
  let keptRed = null;
  let keptFrom = null;

  const result = (code, labels) => ({
    code,
    labels,
    locked: LOCKING.includes(code),
    provisional,
    fullyDepreciated: fully,
    yearCount,
    yearCost,
    yearRatio,
    cumulativeCost,
    cumulativeRatio,
    warehouseMonths: whMonths,
    pendingTotalLoss: !!opts.pendingTotalLoss,
    keptFrom,
  });

  if (asset.status === 'da_thanh_ly') return result('da_thanh_ly', ['Đã thanh lý']);

  // Đèn đỏ năm trước giữ sang năm nay, trừ khi Phòng KHTC đã loại khỏi danh sách chờ thanh lý trong năm nay
  const prevEnd = `${Number(year) - 1}-12-31`;
  if (!clearedSince(`${year}-01-01`) && hasHistory(asset, estimates, prevEnd, opts.excludeEstimateId)) {
    const prev = computeLight(asset, estimates, th, { asOf: prevEnd, excludeEstimateId: opts.excludeEstimateId });
    if (RED.includes(prev.code)) {
      keptRed = prev.code;
      keptFrom = prev.keptFrom || Number(year) - 1;
    }
  }

  const isWarehouseIdle = whMonths !== null && whMonths >= th.warehouseMonths;
  const isLongRepair = cumulativeRatio >= th.cumulativePct / 100;

  let code;
  let labels;
  if (totalLoss) {
    code = fully ? 'do_1_1' : 'do_1_2';
    labels = ['Hư hỏng toàn phần', 'Chờ thanh lý'];
  } else if (keptRed) {
    code = keptRed;
    labels = ['Chờ thanh lý', `Giữ từ năm ${keptFrom}`];
  } else if (fully && yearCount > 0 && yearRatio >= th.redPct / 100) {
    code = 'do_1_1';
    labels = ['Khóa phiếu dự toán', 'Chờ thanh lý'];
  } else if (!fully && (yearCount >= th.orangeCount || yearRatio > th.orangePct / 100)) {
    code = 'cam';
    labels = ['Tạm dừng sửa chữa', 'Kiểm tra kỹ thuật'];
  } else if (isWarehouseIdle) {
    code = 'vang_3_1';
    labels = [`Tồn kho ${whMonths} tháng`];
  } else if (fully && yearCount > 0) {
    code = 'vang_3_2';
    labels = ['Theo dõi sát'];
  } else if (isLongRepair) {
    code = 'vang_3_3';
    labels = ['Sửa chữa kéo dài'];
  } else if (fully) {
    code = 'xanh_la';
    labels = ['Tài sản vượt vòng đời'];
  } else {
    code = 'xanh_duong';
    labels = ['Vận hành bình thường'];
  }

  if (recalled) {
    let kept = asset.recallLight;
    if (RED.includes(kept) && clearedSince(recalledAt)) kept = null;
    if (kept && RANK[kept] !== undefined && RANK[kept] < RANK[code]) {
      code = kept;
      labels = RED.includes(kept) ? ['Chờ thanh lý'] : [];
    }
    labels = ['Hỏng, đã thu hồi về kho, chờ phương án xử lý', ...labels];
  }

  // Nhãn phụ
  if (yearCount >= th.repeatCount && !RED.includes(code) && code !== 'cam') labels.push('Sửa chữa lặp lại');
  if (isLongRepair && code !== 'vang_3_3') labels.push('Sửa chữa kéo dài');
  if (isWarehouseIdle && code !== 'vang_3_1') labels.push(`Tồn kho ${whMonths} tháng`);
  if (opts.pendingTotalLoss) labels.push('Chờ xác minh');
  if (provisional) labels.push('Tạm tính');

  return result(code, labels);
}

// ---------------------------------------------------------------- Hiển thị
export const LIGHT_META = {
  do_1_1: {
    label: 'Đỏ 1.1',
    short: 'Đỏ',
    tone: 'red',
    rank: 0,
    desc: 'Đã hết hao mòn, chi phí sửa trong năm chạm ngưỡng hoặc hư hỏng toàn phần',
  },
  do_1_2: {
    label: 'Đỏ 1.2',
    short: 'Đỏ',
    tone: 'red',
    rank: 1,
    desc: 'Chưa hết hao mòn, hư hỏng toàn phần đã xác nhận',
  },
  cam: {
    label: 'Cam',
    short: 'Cam',
    tone: 'orange',
    rank: 2,
    desc: 'Chưa hết hao mòn, sửa nhiều lần hoặc chi phí vượt ngưỡng trong năm',
  },
  vang_3_1: { label: 'Vàng 3.1', short: 'Vàng', tone: 'amber', rank: 3, desc: 'Nằm kho lâu, không có tương tác' },
  vang_3_2: {
    label: 'Vàng 3.2',
    short: 'Vàng',
    tone: 'amber',
    rank: 4,
    desc: 'Đã hết hao mòn, có sửa trong năm, chưa chạm ngưỡng',
  },
  vang_3_3: { label: 'Vàng 3.3', short: 'Vàng', tone: 'amber', rank: 5, desc: 'Chi phí sửa cộng dồn nhiều năm cao' },
  xanh_la: { label: 'Xanh lá', short: 'Xanh lá', tone: 'green', rank: 6, desc: 'Đã hết hao mòn, năm nay không sửa' },
  xanh_duong: { label: 'Xanh dương', short: 'Xanh dương', tone: 'blue', rank: 7, desc: 'Vận hành bình thường' },
  da_thanh_ly: { label: 'Đã thanh lý', short: 'Đã thanh lý', tone: 'gray', rank: 8, desc: 'Thôi tính đèn' },
};

export const LIGHT_ORDER = ['do_1_1', 'do_1_2', 'cam', 'vang_3_1', 'vang_3_2', 'vang_3_3', 'xanh_la', 'xanh_duong'];
