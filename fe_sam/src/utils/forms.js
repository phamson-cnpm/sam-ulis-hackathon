
// Dựng nội dung các biểu mẫu in, điền sẵn từ dữ liệu hồ sơ.
// Bố cục theo file "Mẫu phiếu SAM" (phiếu báo hỏng, biên bản kiểm tra, điều chuyển tạm thời, dự toán).
// Phiếu đề nghị ngoại lệ và lý lịch sửa chữa chưa có mẫu: dựng cùng kiểu.
//
// Một biểu mẫu là một đối tượng thuần, dùng chung cho bản xem trên màn hình (components/FormSheet.js)
// và file Word (utils/formDocx.js):
//   { key, kind, label, code, fileName, org, numberLabel, title, subtitle, blocks, signatures, footer }
// blocks: { t: 'section', text } | { t: 'grid', wide, rows: [[{ label, value, right }], ...] }  (wide: cột nhãn rộng hơn)
//         | { t: 'table', small, cols: [{ text, w, right, center }], rows: [[...]], foot: [{ cells: [{ text, span, right, bold }] }] }
//           (small: chữ 11pt cho bảng danh sách nhiều cột)
//         | { t: 'note', text } | { t: 'para', text, bold } | { t: 'parties', rows: [{ left, right }] }
// header: 'national' dùng tiêu đề có quốc hiệu (biên bản bàn giao), kèm placeDate

import { computeLight, countedCost, COUNTED_STATUSES, LIGHT_META } from './lights';
import { money, pct } from './format';
import {
  COST_GROUP,
  ESTIMATE_STATUS,
  EXCEPTION_STATUS,
  HANDOVER_KIND,
  PROPOSAL,
  TARGET,
  TEMP_SOURCE,
  TOTAL_LOSS,
} from './labels';
import { ASSET_BOOK_DATE, TODAY } from '../config/app';

export const FORM_FOOTER = 'Bản in từ biểu mẫu SAM · Quản lý tài sản thông minh';
const ORG_SCHOOL = ['ĐẠI HỌC QUỐC GIA HÀ NỘI', 'TRƯỜNG ĐẠI HỌC NGOẠI NGỮ'];
const ORG_QTNL = [...ORG_SCHOOL, 'PHÒNG QUẢN TRỊ NGUỒN LỰC'];
const ORG_KHTC = [...ORG_SCHOOL, 'PHÒNG KẾ HOẠCH – TÀI CHÍNH'];

// Thứ tự giấy tờ trong một hồ sơ báo hỏng
export const CASE_FORM_KINDS = [
  { kind: 'PH', label: 'Phiếu báo hỏng', hint: 'Lập khi báo hỏng.' },
  { kind: 'BB', label: 'Biên bản kiểm tra kỹ thuật', hint: 'Kỹ thuật viên lập khi kiểm tra.' },
  { kind: 'DCTT', label: 'Phiếu điều chuyển tạm thời', hint: 'Chỉ có khi cấp thiết bị tạm.' },
  { kind: 'DT', label: 'Phiếu dự toán', hint: 'Lập khi đề xuất sửa chữa, thay thế linh kiện.' },
  { kind: 'NL', label: 'Phiếu đề nghị ngoại lệ', hint: 'Chỉ có khi tài sản bị khóa (Đỏ 1.1, Cam).' },
];

// ---------------------------------------------------------------- Định dạng theo mẫu (ngày trước giờ sau)
const d2 = (s) => {
  if (!s) return '';
  const [y, m, d] = s.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};
const dt2 = (s) => (!s ? '' : s.length > 10 ? `${d2(s)} ${s.slice(11, 16)}` : d2(s));
const vnd = (n) => (n === null || n === undefined ? '' : money(n));
const ascii = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
const fileNameOf = (code, label) => `${code}_${ascii(label)}`;

const findUser = (users, id) => (id ? users.find((u) => u.id === id) : null) || null;
const nameOf = (users, id) => findUser(users, id)?.name || '';
const headOf = (users, group) =>
  users.find((u) => (u.group || u.role) === group && u.position === 'Trưởng phòng') || null;

const pair = (label, value, right) => ({ label, value: value === null || value === undefined ? '' : String(value), right });

// ---------------------------------------------------------------- Phiếu báo hỏng
export function reportForm(d) {
  const { report, asset, users } = d;
  const label = 'Phiếu báo hỏng';
  return {
    key: `PH:${report.id}`,
    kind: 'PH',
    label,
    code: report.code,
    fileName: fileNameOf(report.code, label),
    org: ORG_SCHOOL,
    numberLabel: 'Số phiếu',
    title: 'PHIẾU BÁO HỎNG TÀI SẢN',
    subtitle: 'Mỗi mã tài sản lập một phiếu; các tài sản báo cùng lúc chung một mã đợt báo hỏng',
    blocks: [
      { t: 'section', text: 'I. NGƯỜI BÁO HỎNG' },
      {
        t: 'grid',
        rows: [
          [pair('Họ tên, đơn vị', `${report.reporterName} – ${report.reporterUnit}`)],
          [pair('Số điện thoại', report.phone), pair('Thời gian báo', dt2(report.createdAt))],
          [
            pair('Mã đợt báo hỏng', report.batchCode),
            pair('Mức độ', report.urgent ? 'Khẩn cấp' : 'Bình thường'),
          ],
        ],
      },
      { t: 'section', text: 'II. TÀI SẢN BÁO HỎNG' },
      {
        t: 'grid',
        rows: [
          [pair('Mã tài sản (mã tem)', asset ? asset.code : ''), pair('Vị trí', report.location)],
          [pair('Tên tài sản', report.assetName)],
        ],
      },
      {
        t: 'note',
        text: 'Tem mờ, rách: để trống mã tài sản, ghi tên và vị trí tài sản; kỹ thuật viên sẽ gán mã khi kiểm tra.',
      },
      { t: 'section', text: 'III. NỘI DUNG BÁO HỎNG' },
      {
        t: 'grid',
        rows: [[pair('Nội dung báo hỏng', report.content)], [pair('Tình huống đang xảy ra', report.situation)]],
      },
      {
        t: 'note',
        text: 'Tình huống dùng để xếp thứ tự ưu tiên xử lý: nguy cơ mất an toàn, hội nghị, thi và kiểm tra được xử lý trước.',
      },
    ],
    signatures: [
      { title: report.source === 'qtnl' ? 'Người báo hỏng (QTNL phát hiện)' : 'Người báo hỏng', name: report.reporterName },
      { title: 'Phòng Quản trị nguồn lực (tiếp nhận)', name: nameOf(users, report.technicianId) },
    ],
    footer: FORM_FOOTER,
  };
}

// ---------------------------------------------------------------- Biên bản kiểm tra kỹ thuật
export function inspectionForm(d) {
  const { report, asset, inspection: ins, temps, replacementAssets, users } = d;
  const label = 'Biên bản kiểm tra kỹ thuật';
  const temp = temps[0];
  const tempAsset = temp ? replacementAssets.find((a) => a.id === temp.replacementAssetId) : null;
  const tempText =
    ins.tempSolution || (temp && tempAsset ? `Cấp thiết bị tạm: ${tempAsset.name} (phiếu ${temp.code})` : '');
  const rows = [
    [pair('Nội dung người dùng báo', report.content)],
    [pair('Tình trạng ghi nhận', ins.findings)],
    [pair('Đối tượng hỏng', TARGET[ins.target])],
    [pair('Đề xuất giải pháp', PROPOSAL[ins.proposal] + (ins.proposalNote ? `: ${ins.proposalNote}` : ''))],
  ];
  if (ins.proposal === 'hong_toan_phan') {
    const st = ins.totalLossStatus || 'cho_xac_minh';
    const text =
      st === 'da_xac_nhan'
        ? `Đã xác nhận trên phần mềm: ${nameOf(users, ins.totalLossBy)}, ${dt2(ins.totalLossAt)}`
        : st === 'tra_lai'
          ? `Bị trả lại: ${ins.totalLossReturnReason || ''}`
          : `${TOTAL_LOSS[st]} (lãnh đạo Phòng QTNL xác nhận trên phần mềm)`;
    rows.push([pair('Xác nhận hư hỏng toàn phần', text)]);
  }
  return {
    key: `BB:${ins.id}`,
    kind: 'BB',
    label,
    code: ins.code,
    fileName: fileNameOf(ins.code, label),
    org: ORG_QTNL,
    numberLabel: 'Số biên bản',
    title: 'BIÊN BẢN KIỂM TRA KỸ THUẬT',
    subtitle: `Căn cứ phiếu báo hỏng ${report.code}`,
    blocks: [
      { t: 'section', text: 'I. TÀI SẢN ĐƯỢC KIỂM TRA' },
      {
        t: 'grid',
        rows: [
          [pair('Mã tài sản (mã tem)', asset?.code), pair('Phiếu báo hỏng số', report.code)],
          [pair('Vị trí', asset?.location || report.location), pair('Thời gian kiểm tra', dt2(ins.inspectedAt))],
          [pair('Tên tài sản', asset?.name || report.assetName)],
          [pair('Kỹ thuật viên', nameOf(users, ins.technicianId)), pair('Đơn vị quản lý và sử dụng', asset?.unit)],
        ],
      },
      { t: 'section', text: 'II. KẾT QUẢ KIỂM TRA' },
      { t: 'grid', rows },
      { t: 'section', text: 'III. XỬ LÝ TẠM THỜI' },
      { t: 'grid', rows: [[pair('Giải pháp tạm thời', tempText)], [pair('Ghi chú', ins.note)]] },
      {
        t: 'note',
        text: 'Hư hỏng toàn phần chờ lãnh đạo Phòng QTNL xác nhận để vào Đèn Đỏ. Sửa chữa, thay linh kiện chuyển sang phiếu dự toán. Xử lý tại chỗ thì đóng hồ sơ, không tính vào số lần sửa chữa.',
      },
    ],
    signatures: [
      { title: 'Kỹ thuật viên', name: nameOf(users, ins.technicianId) },
      { title: 'Người sử dụng tài sản', name: report.source === 'qtnl' ? '' : report.reporterName },
    ],
    footer: FORM_FOOTER,
  };
}

// ---------------------------------------------------------------- Phiếu điều chuyển tạm thời
export function tempForm(d, t) {
  const { report, asset, replacementAssets, users } = d;
  const label = 'Phiếu điều chuyển tạm thời';
  const repl = replacementAssets.find((a) => a.id === t.replacementAssetId);
  const head = headOf(users, 'lanhdao_qtnl');
  return {
    key: `DCTT:${t.id}`,
    kind: 'DCTT',
    label,
    code: t.code,
    fileName: fileNameOf(t.code, label),
    org: ORG_QTNL,
    numberLabel: 'Số phiếu',
    title: 'PHIẾU ĐIỀU CHUYỂN TẠM THỜI',
    subtitle: `Căn cứ phiếu báo hỏng ${report.code}`,
    blocks: [
      { t: 'section', text: 'I. TÀI SẢN GỐC BỊ HỎNG' },
      {
        t: 'grid',
        rows: [
          [pair('Mã tài sản (mã tem)', asset?.code), pair('Phiếu báo hỏng số', report.code)],
          [pair('Vị trí', report.location), pair('Tình huống đang xảy ra', report.situation)],
          [pair('Tên tài sản', asset?.name || report.assetName)],
        ],
      },
      { t: 'section', text: 'II. THIẾT BỊ THAY THẾ' },
      {
        t: 'grid',
        rows: [
          [pair('Thiết bị cấp tạm', repl ? `${repl.name} (mã ${repl.code})` : '')],
          [pair('Nguồn cấp', TEMP_SOURCE[t.source])],
          [pair('Nơi sử dụng', t.useLocation), pair('Hạn thu hồi thiết bị tạm (dự kiến)', t.expectedReturn)],
        ],
      },
      { t: 'section', text: 'III. NGƯỜI NHẬN' },
      {
        t: 'grid',
        rows: [
          [pair('Họ tên người nhận', t.receiverName), pair('Khoa, phòng của người nhận', t.receiverUnit)],
          [pair('Người lập (kỹ thuật viên)', nameOf(users, t.createdBy)), pair('Thời gian cấp', dt2(t.issuedAt))],
          [pair('Thu hồi thiết bị tạm lúc', dt2(t.returnedAt)), pair('Trạng thái', t.returnedAt ? 'Đã thu hồi thiết bị tạm' : 'Đang sử dụng')],
        ],
      },
      {
        t: 'note',
        text: 'Phiếu điều chuyển tạm thời không làm thay đổi đơn vị quản lý, sử dụng và vị trí trên sổ tài sản; phiếu điều chuyển chính thức (nếu có) do Phòng KHTC lập. Thiết bị cấp tạm không tính là báo hỏng và không tính vào chi phí lũy kế.',
      },
    ],
    signatures: [
      { title: 'Người giao', name: nameOf(users, t.createdBy) },
      { title: 'Người nhận', name: t.receiverName },
      { title: 'Trưởng phòng QTNL', name: head?.name || '' },
    ],
    footer: FORM_FOOTER,
  };
}

// ---------------------------------------------------------------- Phiếu dự toán
/** Số liệu mục III: trước phiếu (không gồm phiếu này) và sau phiếu, tính tại ngày lập phiếu. */
export function estimateStats(asset, assetEstimates, thresholds, est) {
  const opts = { asOf: est.createdAt, excludeEstimateId: est.id };
  const before = computeLight(asset, assetEstimates, thresholds, opts);
  const after = computeLight(asset, assetEstimates, thresholds, { ...opts, draftLines: est.lines });
  return { before, after };
}

export function estimateForm(d) {
  const { report, asset, inspection, estimate: est, exception, assetEstimates, thresholds, users } = d;
  const label = 'Phiếu dự toán';
  const hasActual = !!est.actualEnteredAt;
  const total = est.lines.reduce((s, l) => s + l.estimate, 0);
  const counted = est.lines.filter((l) => l.costGroup === 'tinh').reduce((s, l) => s + l.estimate, 0);
  const actualTotal = est.lines.reduce((s, l) => s + (l.actual || 0), 0);
  const actualCounted = est.lines.filter((l) => l.costGroup === 'tinh').reduce((s, l) => s + (l.actual || 0), 0);
  const { before, after } = estimateStats(asset, assetEstimates, thresholds, est);
  const lightBefore = est.lightBefore || before.code;
  const lightAfter = est.lightAfter || after.code;

  const cols = [
    { text: 'STT', w: 7, center: true },
    { text: 'Nội dung công việc', w: hasActual ? 37 : 47 },
    { text: 'Nhóm', w: hasActual ? 26 : 28 },
    { text: 'Dự toán (đ)', w: hasActual ? 15 : 18, right: true },
  ];
  if (hasActual) cols.push({ text: 'Thực tế (đ)', w: 15, right: true });
  const rows = est.lines.map((l, i) => {
    const r = [String(i + 1), l.content, COST_GROUP[l.costGroup], vnd(l.estimate)];
    if (hasActual) r.push(vnd(l.actual));
    return r;
  });
  const foot = [
    {
      cells: [
        { text: 'Tổng dự toán (đ)', span: 3, right: true, bold: true },
        { text: vnd(total), right: true, bold: true },
        ...(hasActual ? [{ text: vnd(actualTotal), right: true, bold: true }] : []),
      ],
    },
    {
      cells: [
        {
          text: 'Trong đó tính vào số lần và chi phí sửa chữa (nhóm Sửa chữa, thay linh kiện) (đ)',
          span: 3,
          right: true,
          bold: true,
        },
        { text: vnd(counted), right: true, bold: true },
        ...(hasActual ? [{ text: vnd(actualCounted), right: true, bold: true }] : []),
      ],
    },
  ];

  const statusLines = [];
  statusLines.push(`Trạng thái phiếu: ${ESTIMATE_STATUS[est.status]}.`);
  if (est.confirmedBy) statusLines.push(`Lãnh đạo Phòng QTNL xác nhận trên phần mềm: ${nameOf(users, est.confirmedBy)}, ${dt2(est.confirmedAt)}.`);
  if (est.locked)
    statusLines.push(
      `Tài sản bị khóa phiếu dự toán (đèn ${LIGHT_META[lightAfter]?.label}): kèm phiếu đề nghị ngoại lệ ${exception ? exception.code : ''}${
        exception?.docNo ? `, mở khóa theo văn bản ${exception.docNo} ngày ${d2(exception.docDate)}` : ''
      }.`,
    );
  if (est.status === 'khong_dong_y' && est.returnReason) statusLines.push(`Không đồng ý: ${est.returnReason}.`);
  if (hasActual) statusLines.push(`Chi phí thực tế theo chứng từ ${est.voucherNo} ngày ${d2(est.voucherDate)}.`);

  const khtcHead = headOf(users, 'khtc');
  return {
    key: `DT:${est.id}`,
    kind: 'DT',
    label,
    code: est.code,
    fileName: fileNameOf(est.code, label),
    org: ORG_QTNL,
    numberLabel: 'Số phiếu',
    title: 'PHIẾU DỰ TOÁN CHI PHÍ SỬA CHỮA, THAY THẾ',
    subtitle: 'Căn cứ biên bản kiểm tra kỹ thuật và phiếu báo hỏng',
    blocks: [
      { t: 'section', text: 'I. TÀI SẢN' },
      {
        t: 'grid',
        rows: [
          [pair('Mã tài sản (mã tem)', asset.code), pair('Ngày lập phiếu', d2(est.createdAt))],
          [pair('Vị trí', asset.location), pair('Đơn vị quản lý và sử dụng', asset.unit)],
          [pair('Tên tài sản', asset.name)],
          [pair('Nguyên giá (đ)', vnd(asset.originalCost), true), pair('Giá trị còn lại (đ)', vnd(asset.residualValue), true)],
          [
            pair('Người lập dự toán (kỹ thuật viên)', nameOf(users, est.createdBy)),
            pair('Căn cứ (số biên bản, phiếu báo hỏng)', [inspection?.code, report.code].filter(Boolean).join(' · ')),
          ],
        ],
      },
      { t: 'section', text: 'II. NỘI DUNG DỰ TOÁN' },
      { t: 'table', cols, rows, foot },
      { t: 'section', text: 'III. ĐÈN CẢNH BÁO (TẠM TÍNH)' },
      {
        t: 'grid',
        wide: true,
        rows: [
          [
            pair('Màu đèn trước khi lập phiếu', LIGHT_META[lightBefore]?.label),
            pair('Màu đèn tạm tính sau phiếu này', LIGHT_META[lightAfter]?.label),
          ],
          [
            pair('Số lần sửa chữa trong năm (gồm lần này)', after.yearCount, true),
            pair('Chi phí sửa chữa trong năm, chưa gồm lần này (đ)', vnd(before.yearCost), true),
          ],
          [
            pair('Chi phí sửa chữa trong năm, gồm lần này (đ)', vnd(after.yearCost), true),
            pair('Tỷ lệ so với nguyên giá', pct(after.yearRatio), true),
          ],
          [
            pair('Chi phí sửa chữa cộng dồn từ khi dùng SAM, chưa gồm lần này (đ)', vnd(before.cumulativeCost), true),
            pair('Cộng dồn gồm lần này (đ) · tỷ lệ', `${vnd(after.cumulativeCost)} (${pct(after.cumulativeRatio)})`, true),
          ],
        ],
      },
      { t: 'para', text: statusLines.join(' ') },
      {
        t: 'note',
        text: 'Dự toán đã gửi lãnh đạo không sửa trực tiếp; muốn đổi phải được trả lại. Phiếu của tài sản bị khóa (Đỏ 1.1, Cam) kèm phiếu đề nghị ngoại lệ.',
      },
    ],
    signatures: [
      { title: 'Phòng Quản trị nguồn lực', name: nameOf(users, est.confirmedBy) },
      { title: 'Phòng Kế hoạch – Tài chính', name: khtcHead?.name || '' },
      { title: 'Ban Giám hiệu', name: '' },
    ],
    footer: FORM_FOOTER,
  };
}

// ---------------------------------------------------------------- Phiếu đề nghị ngoại lệ
export function exceptionForm(d) {
  const { report, asset, estimate: est, exception: x, assetEstimates, users } = d;
  const label = 'Phiếu đề nghị ngoại lệ';
  const year = est.createdAt.slice(0, 4);
  const total = est.lines.reduce((s, l) => s + l.estimate, 0);
  const thisCounted = countedCost(est.lines).cost;

  // Hồ sơ trình ký: chi phí từng lần sửa (tính vào đèn) đến phiếu này
  const prior = assetEstimates
    .filter(
      (e) =>
        e.id !== est.id &&
        COUNTED_STATUSES.includes(e.status) &&
        e.createdAt.slice(0, 10) <= est.createdAt.slice(0, 10) &&
        countedCost(e.lines).hasRepair,
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  let cumulative = 0;
  let yearCount = 0;
  let yearCost = 0;
  const rows = prior.map((e, i) => {
    const c = countedCost(e.lines).cost;
    cumulative += c;
    if (e.createdAt.slice(0, 4) === year) {
      yearCount += 1;
      yearCost += c;
    }
    return [
      String(i + 1),
      d2(e.createdAt),
      e.code,
      e.lines.filter((l) => l.costGroup === 'tinh').map((l) => l.content).join('; '),
      vnd(c),
    ];
  });
  cumulative += thisCounted;
  yearCount += 1;
  yearCost += thisCounted;
  rows.push([
    String(prior.length + 1),
    d2(est.createdAt),
    `${est.code} (lần này)`,
    est.lines.filter((l) => l.costGroup === 'tinh').map((l) => l.content).join('; '),
    vnd(thisCounted),
  ]);
  const base = asset.originalCost || 0;
  const ratio = (n) => (base ? pct(n / base) : '');

  const khtcHead = headOf(users, 'khtc');
  const qtnlHead = headOf(users, 'lanhdao_qtnl');
  return {
    key: `NL:${x.id}`,
    kind: 'NL',
    label,
    code: x.code,
    fileName: fileNameOf(x.code, label),
    org: ORG_QTNL,
    numberLabel: 'Số phiếu',
    title: 'PHIẾU ĐỀ NGHỊ NGOẠI LỆ SỬA CHỮA TÀI SẢN',
    subtitle: `Tài sản bị khóa phiếu dự toán (đèn ${LIGHT_META[est.lightAfter]?.label || ''}); kèm phiếu dự toán ${est.code}`,
    blocks: [
      { t: 'section', text: 'I. TÀI SẢN' },
      {
        t: 'grid',
        rows: [
          [pair('Mã tài sản (mã tem)', asset.code), pair('Ngày lập phiếu', d2(x.createdAt))],
          [pair('Tên tài sản', asset.name)],
          [pair('Vị trí', asset.location), pair('Đơn vị quản lý và sử dụng', asset.unit)],
          [pair('Đưa vào sử dụng', d2(asset.inUseDate)), pair('Thời gian hao mòn', `${asset.depreciationMonths} tháng`)],
          [pair('Nguyên giá (đ)', vnd(asset.originalCost), true), pair('Giá trị còn lại (đ)', vnd(asset.residualValue), true)],
        ],
      },
      { t: 'section', text: 'II. NỘI DUNG ĐỀ NGHỊ' },
      {
        t: 'grid',
        rows: [
          [pair('Phiếu dự toán số', est.code), pair('Dự toán lần này (đ)', vnd(total), true)],
          [pair('Phiếu báo hỏng số', report.code), pair('Người đề nghị', nameOf(users, x.createdBy))],
          [pair('Tình huống đang xảy ra', report.situation)],
          [pair('Lý do cấp thiết', x.reason)],
          [pair('Thời gian dự kiến dùng thêm', x.extraTime)],
          [pair('Thiết bị cấp tạm', x.tempEquipment)],
        ],
      },
      { t: 'section', text: 'III. CHI PHÍ SỬA CHỮA CÁC LẦN (TÍNH VÀO ĐÈN)' },
      {
        t: 'table',
        cols: [
          { text: 'STT', w: 7, center: true },
          { text: 'Ngày lập', w: 15, center: true },
          { text: 'Số phiếu', w: 20 },
          { text: 'Nội dung sửa chữa, thay linh kiện', w: 40 },
          { text: 'Chi phí (đ)', w: 18, right: true },
        ],
        rows,
        foot: [
          {
            cells: [
              { text: `Trong năm ${year}: ${yearCount} lần, tỷ lệ ${ratio(yearCost)} nguyên giá`, span: 4, right: true, bold: true },
              { text: vnd(yearCost), right: true, bold: true },
            ],
          },
          {
            cells: [
              { text: `Cộng dồn từ khi dùng SAM, tỷ lệ ${ratio(cumulative)} nguyên giá`, span: 4, right: true, bold: true },
              { text: vnd(cumulative), right: true, bold: true },
            ],
          },
        ],
      },
      { t: 'section', text: 'IV. PHÊ DUYỆT (PHÒNG KHTC GHI)' },
      {
        t: 'grid',
        rows: [
          [
            pair('Văn bản phê duyệt', x.docNo ? `${x.docNo} ngày ${d2(x.docDate)}` : ''),
            pair('Kết quả', x.status === 'cho_mo_khoa' ? '' : EXCEPTION_STATUS[x.status]),
          ],
          [pair('Kết luận', x.conclusion)],
        ],
      },
    ],
    signatures: [
      { title: 'Phòng Quản trị nguồn lực', name: qtnlHead?.name || '' },
      { title: 'Phòng Kế hoạch – Tài chính', name: nameOf(users, x.decidedBy) || khtcHead?.name || '' },
      { title: 'Ban Giám hiệu', name: '' },
    ],
    footer: FORM_FOOTER,
  };
}

// ---------------------------------------------------------------- Danh sách biểu mẫu của một hồ sơ
/** Trả về các mục theo thứ tự hồ sơ; mục chưa lập có form = null. */
export function caseForms(d) {
  const items = [];
  items.push({ ...CASE_FORM_KINDS[0], form: reportForm(d) });
  items.push({ ...CASE_FORM_KINDS[1], form: d.inspection ? inspectionForm(d) : null });
  if (d.temps.length) d.temps.forEach((t) => items.push({ ...CASE_FORM_KINDS[2], form: tempForm(d, t) }));
  else items.push({ ...CASE_FORM_KINDS[2], form: null });
  items.push({ ...CASE_FORM_KINDS[3], form: d.estimate && d.asset ? estimateForm(d) : null });
  items.push({ ...CASE_FORM_KINDS[4], form: d.exception && d.estimate && d.asset ? exceptionForm(d) : null });
  // Hồ sơ có thu hồi tài sản hỏng về kho: thêm biên bản giao nhận
  if (d.handover) items.push({ kind: 'BG', label: 'Biên bản giao nhận (thu hồi tài sản hỏng)', form: handoverForm(d) });
  return items;
}

// ---------------------------------------------------------------- Biên bản bàn giao tài sản (theo file Mẫu bàn giao tài sản)
const DOTS = '…………………………………………';
const DOTS_SHORT = '……………………………';

/** Cấp phát, điều chuyển chính thức, hoặc giao nhận khi thu hồi về kho. d = { handover, handoverAssets, recall? } */
export function handoverForm(d) {
  const { handover: h, handoverAssets } = d;
  const label = h.kind === 'thu_hoi' ? 'Biên bản giao nhận (thu hồi tài sản hỏng)' : 'Biên bản bàn giao';
  const [y, m, dd] = h.date.split('-');
  const person = (p, i) => ({
    left: `${i + 1}. Ông (Bà): ${p && p.name ? p.name : DOTS}`,
    right: `Đơn vị: ${p && p.unit ? p.unit : DOTS_SHORT}`,
  });
  const pad2 = (list) => [0, 1].map((i) => person(list[i], i));
  const rows = h.items.map((it, i) => {
    const a = handoverAssets.find((x) => x.id === it.assetId);
    return [String(i + 1), a ? a.name : '', it.uom || 'Cái', String(it.qty || 1), a ? a.code : '', it.note || ''];
  });
  const sub =
    h.kind === 'thu_hoi'
      ? `Thu hồi tài sản hỏng về kho${d.recall ? ` theo đề nghị ${d.recall.code}` : ''}`
      : HANDOVER_KIND[h.kind];
  return {
    key: `BG:${h.id}`,
    kind: 'BG',
    label,
    code: h.code,
    fileName: fileNameOf(h.code, 'Bien ban ban giao'),
    header: 'national',
    org: ['ĐẠI HỌC QUỐC GIA HÀ NỘI', 'TRƯỜNG ĐẠI HỌC NGOẠI NGỮ'],
    numberLabel: 'Số',
    placeDate: `Hà Nội, ngày ${dd} tháng ${m} năm ${y}`,
    title: 'BIÊN BẢN BÀN GIAO TÀI SẢN',
    subtitle: sub,
    blocks: [
      { t: 'section', plain: true, text: 'I. ĐẠI DIỆN BÊN GIAO TÀI SẢN' },
      { t: 'parties', rows: pad2(h.givers) },
      { t: 'section', plain: true, text: 'II. ĐẠI DIỆN BÊN NHẬN TÀI SẢN' },
      { t: 'parties', rows: pad2(h.receivers) },
      {
        t: 'para',
        bold: true,
        text: `Hai bên nhất trí tiến hành bàn giao số tài sản được bố trí tại: ${h.place} bao gồm:`,
      },
      {
        t: 'table',
        cols: [
          { text: 'STT', w: 7, center: true },
          { text: 'TÊN TÀI SẢN', w: 29 },
          { text: 'ĐƠN VỊ TÍNH', w: 11, center: true },
          { text: 'SỐ LƯỢNG', w: 12, center: true },
          { text: 'MÃ TÀI SẢN', w: 19 },
          { text: 'GHI CHÚ', w: 22 },
        ],
        rows,
      },
      ...(h.transferNo ? [{ t: 'note', text: `Phòng KHTC đã nhập điều chuyển chính thức theo văn bản ${h.transferNo}.` }] : []),
      { t: 'para', text: 'Biên bản được lập thành: 04 bản. Mỗi bên giữ 01 bản có giá trị pháp lý như nhau./.' },
    ],
    signatures: [
      { title: 'ĐẠI DIỆN BÊN NHẬN', name: h.receivers[0]?.name || '' },
      { title: 'PHÒNG QTNL', name: '' },
      { title: 'PHÒNG KHTC', name: '' },
      { title: 'ĐẠI DIỆN BÊN GIAO', name: h.givers[0]?.name || '' },
    ],
    footer: FORM_FOOTER,
  };
}

// ---------------------------------------------------------------- Lý lịch sửa chữa tài sản
export function assetHistoryForm(d, preparedBy) {
  const { asset, history, users } = d;
  const label = 'Ly lich sua chua tai san';
  const year = TODAY.slice(0, 4);
  const L = asset.light;
  const ests = [...history.estimates].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const estRows = ests.map((e, i) => {
    const c = countedCost(e.lines);
    const counts = COUNTED_STATUSES.includes(e.status) && c.hasRepair;
    return [
      String(i + 1),
      d2(e.createdAt),
      e.code,
      e.lines.map((l) => l.content).join('; '),
      counts ? vnd(c.cost) : '0',
      ESTIMATE_STATUS[e.status],
    ];
  });
  const reports = [...history.reports].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const repRows = reports.map((r, i) => {
    const ins = history.inspections.find((x) => x.reportId === r.id);
    return [String(i + 1), d2(r.createdAt), r.code, r.content, ins ? PROPOSAL[ins.proposal] : 'Chưa kiểm tra'];
  });
  return {
    key: `LL:${asset.id}`,
    kind: 'LL',
    label: 'Lý lịch sửa chữa tài sản',
    code: asset.code,
    fileName: fileNameOf(asset.code, label),
    org: ORG_KHTC,
    numberLabel: 'Mã tài sản',
    title: 'LÝ LỊCH SỬA CHỮA TÀI SẢN',
    subtitle: `Số liệu đến ngày ${d2(TODAY)}${ASSET_BOOK_DATE ? `; giá trị còn lại theo sổ đến ${ASSET_BOOK_DATE}` : ''}`,
    blocks: [
      { t: 'section', text: 'I. THÔNG TIN TÀI SẢN' },
      {
        t: 'grid',
        rows: [
          [pair('Tên tài sản', asset.name)],
          [pair('Nhóm tài sản', `${asset.groupCode} ${asset.groupName}`)],
          [pair('Vị trí', asset.location), pair('Đơn vị quản lý và sử dụng', asset.unit)],
          [pair('Đưa vào sử dụng', d2(asset.inUseDate)), pair('Thời gian hao mòn', `${asset.depreciationMonths} tháng`)],
          [pair('Nguyên giá (đ)', vnd(asset.originalCost), true), pair('Giá trị còn lại (đ)', vnd(asset.residualValue), true)],
        ],
      },
      { t: 'section', text: 'II. ĐÈN CẢNH BÁO HIỆN TẠI' },
      {
        t: 'grid',
        wide: true,
        rows: [
          [pair('Màu đèn', LIGHT_META[L.code]?.label), pair(`Số lần sửa chữa năm ${year}`, L.yearCount, true)],
          [pair('Nhãn', L.labels.join('; '))],
          [
            pair(`Chi phí sửa năm ${year} (đ) · tỷ lệ`, `${vnd(L.yearCost)} (${pct(L.yearRatio)})`, true),
            pair('Chi phí sửa cộng dồn từ khi dùng SAM (đ) · tỷ lệ', `${vnd(L.cumulativeCost)} (${pct(L.cumulativeRatio)})`, true),
          ],
        ],
      },
      { t: 'section', text: 'III. CÁC LẦN SỬA CHỮA, THAY THẾ' },
      estRows.length
        ? {
            t: 'table',
            cols: [
              { text: 'STT', w: 7, center: true },
              { text: 'Ngày lập', w: 15, center: true },
              { text: 'Phiếu dự toán', w: 13 },
              { text: 'Nội dung', w: 31 },
              { text: 'Tính vào đèn (đ)', w: 15, right: true },
              { text: 'Trạng thái', w: 19 },
            ],
            rows: estRows,
          }
        : { t: 'para', text: 'Chưa có lần sửa chữa, thay thế nào được ghi nhận trên SAM.' },
      { t: 'section', text: 'IV. CÁC LẦN BÁO HỎNG' },
      repRows.length
        ? {
            t: 'table',
            cols: [
              { text: 'STT', w: 7, center: true },
              { text: 'Ngày báo', w: 15, center: true },
              { text: 'Số phiếu', w: 17 },
              { text: 'Nội dung báo hỏng', w: 33 },
              { text: 'Kết quả kiểm tra', w: 28 },
            ],
            rows: repRows,
          }
        : { t: 'para', text: 'Chưa có phiếu báo hỏng nào.' },
      {
        t: 'note',
        text: 'Chỉ phiếu dự toán có nhóm Sửa chữa, thay linh kiện và không bị “Không đồng ý” mới tính vào số lần và chi phí sửa chữa.',
      },
    ],
    signatures: [{ title: 'Người lập biểu', name: preparedBy?.name || nameOf(users, null) }],
    footer: FORM_FOOTER,
  };
}
