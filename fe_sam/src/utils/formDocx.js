
// Xuất biểu mẫu (utils/forms.js) ra file Word .docx, cùng bố cục với bản xem trên màn hình.
// Nạp theo yêu cầu (import động) để không làm nặng trang lúc mở.
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  LineRuleType,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';

const MM = 56.7; // twip trên 1 mm
const PAGE = { width: 11906, height: 16838 }; // A4
const MARGIN = { top: Math.round(14 * MM), right: Math.round(14 * MM), bottom: Math.round(14 * MM), left: Math.round(18 * MM) };
const CONTENT = PAGE.width - MARGIN.left - MARGIN.right;
const FONT = 'Times New Roman';

const LINE = { style: BorderStyle.SINGLE, size: 4, color: '8D949C' };
const DARK = { style: BorderStyle.SINGLE, size: 6, color: '111111' };
const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const ALL = (b) => ({ top: b, bottom: b, left: b, right: b });
const NO_BORDERS = { ...ALL(NONE), insideHorizontal: NONE, insideVertical: NONE };
const CELL_MARGIN = { top: 28, bottom: 28, left: 100, right: 100 };

const run = (text, o = {}) => new TextRun({ text: String(text ?? ''), font: FONT, size: 24, ...o });
const para = (text, o = {}, r = {}) =>
  new Paragraph({ spacing: { before: 0, after: 0 }, ...o, children: [run(text, r)] });

const widths = (pcts) => {
  const w = pcts.map((p) => Math.round((p / 100) * CONTENT));
  w[w.length - 1] += CONTENT - w.reduce((s, x) => s + x, 0);
  return w;
};

const cell = (children, o = {}) =>
  new TableCell({
    margins: CELL_MARGIN,
    borders: ALL(LINE),
    verticalAlign: VerticalAlign.TOP,
    ...o,
    children: Array.isArray(children) ? children : [children],
  });

const table = (columnWidths, rows, o = {}) =>
  new Table({
    width: { size: CONTENT, type: WidthType.DXA },
    columnWidths,
    layout: TableLayoutType.FIXED,
    rows,
    ...o,
  });

// ---------------------------------------------------------------- Khối nội dung
function header(form) {
  const w = [Math.round(CONTENT * 0.6), Math.round(CONTENT * 0.12)];
  w.push(CONTENT - w[0] - w[1]);
  const org = form.org.map((line) => para(line, { alignment: AlignmentType.CENTER }, { bold: true }));
  return table(
    w,
    [
      new TableRow({
        children: [
          cell(org, { borders: ALL(NONE), width: { size: w[0], type: WidthType.DXA } }),
          cell(para(''), { borders: ALL(NONE), width: { size: w[1], type: WidthType.DXA } }),
          cell(
            [
              para(form.numberLabel, { alignment: AlignmentType.CENTER }, { size: 22 }),
              para(form.code, { alignment: AlignmentType.CENTER }, { bold: true }),
            ],
            {
              borders: ALL(DARK),
              verticalAlign: VerticalAlign.CENTER,
              width: { size: w[2], type: WidthType.DXA },
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
            },
          ),
        ],
      }),
    ],
    { borders: NO_BORDERS },
  );
}

/** Tiêu đề có quốc hiệu (biên bản bàn giao theo file Mẫu bàn giao tài sản). */
function nationalHeader(form) {
  const w = [Math.round(CONTENT * 0.42)];
  w.push(CONTENT - w[0]);
  const c = { alignment: AlignmentType.CENTER };
  return table(
    w,
    [
      new TableRow({
        children: [
          cell(
            [
              para(form.org[0], c),
              para(form.org[1], c, { bold: true, underline: {} }),
              para(`${form.numberLabel}: ${form.code}`, { ...c, spacing: { before: 80, after: 0 } }, { size: 22 }),
            ],
            { borders: ALL(NONE), width: { size: w[0], type: WidthType.DXA } },
          ),
          cell(
            [
              para('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', c, { bold: true }),
              para('Độc lập - Tự do - Hạnh phúc', c, { bold: true, underline: {} }),
              para(form.placeDate, { ...c, spacing: { before: 160, after: 0 } }, { italics: true }),
            ],
            { borders: ALL(NONE), width: { size: w[1], type: WidthType.DXA } },
          ),
        ],
      }),
    ],
    { borders: NO_BORDERS },
  );
}

/** Dòng "1. Ông (Bà): ...   Đơn vị: ..." không viền. */
function parties(rows) {
  const w = [Math.round(CONTENT * 0.58)];
  w.push(CONTENT - w[0]);
  return table(
    w,
    rows.map(
      (r) =>
        new TableRow({
          children: [
            cell(para(r.left), { borders: ALL(NONE), width: { size: w[0], type: WidthType.DXA } }),
            cell(para(r.right), { borders: ALL(NONE), width: { size: w[1], type: WidthType.DXA } }),
          ],
        }),
    ),
    { borders: NO_BORDERS },
  );
}

function section(text) {
  return table(
    [CONTENT],
    [
      new TableRow({
        cantSplit: true,
        children: [
          cell(para(text, {}, { bold: true }), {
            shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'D9EAEE' },
            width: { size: CONTENT, type: WidthType.DXA },
          }),
        ],
      }),
    ],
  );
}

const GRID_W = widths([19, 33, 22, 26]);
const GRID_W_WIDE = widths([29, 21, 29, 21]);

function grid(rows, wide) {
  const W = wide ? GRID_W_WIDE : GRID_W;
  const label = (t) => cell(para(t, {}, { size: 22, color: '444444' }));
  const value = (p, span, w) =>
    cell(para(p.value, { alignment: p.right ? AlignmentType.RIGHT : AlignmentType.LEFT }, { bold: true }), {
      columnSpan: span,
      width: { size: w, type: WidthType.DXA },
    });
  return table(
    W,
    rows.map(
      (row) =>
        new TableRow({
          cantSplit: true,
          children:
            row.length === 1
              ? [label(row[0].label), value(row[0], 3, W[1] + W[2] + W[3])]
              : row.flatMap((p, j) => [label(p.label), value(p, 1, W[j * 2 + 1])]),
        }),
    ),
  );
}

function dataTable(b) {
  const w = widths(b.cols.map((c) => c.w));
  const sz = b.small ? { size: 22 } : {};
  const small = b.small ? { margins: { top: 28, bottom: 28, left: 68, right: 68 } } : {};
  const align = (c) => (c?.right ? AlignmentType.RIGHT : c?.center ? AlignmentType.CENTER : AlignmentType.LEFT);
  const grey = { type: ShadingType.CLEAR, color: 'auto', fill: 'E6E6E6' };
  const head = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: b.cols.map((c) =>
      cell(para(c.text, { alignment: AlignmentType.CENTER }, { bold: true, ...sz }), { shading: grey, ...small }),
    ),
  });
  const body = b.rows.map(
    (r) =>
      new TableRow({
        cantSplit: true,
        children: r.map((v, j) => cell(para(v, { alignment: align(b.cols[j]) }, sz), small)),
      }),
  );
  let col = 0;
  const foot = (b.foot || []).map((f) => {
    col = 0;
    return new TableRow({
      cantSplit: true,
      children: f.cells.map((c) => {
        const span = c.span || 1;
        const width = w.slice(col, col + span).reduce((s, x) => s + x, 0);
        col += span;
        return cell(para(c.text, { alignment: align(c) }, { bold: !!c.bold, ...sz }), {
          ...small,
          columnSpan: span,
          shading: grey,
          width: { size: width, type: WidthType.DXA },
        });
      }),
    });
  });
  return table(w, [head, ...body, ...foot]);
}

function signatures(list) {
  const items = list.length === 1 ? [null, list[0]] : list;
  const w = widths(items.map(() => 100 / items.length));
  // Hai dòng: chức danh và họ tên tách riêng để họ tên các cột thẳng hàng khi chức danh xuống dòng
  return table(
    w,
    [
      new TableRow({
        cantSplit: true,
        children: items.map((s) =>
          cell(
            s
              ? [
                  para(s.title, { alignment: AlignmentType.CENTER }, { bold: true }),
                  para('(Ký, ghi rõ họ tên)', { alignment: AlignmentType.CENTER }, { italics: true }),
                ]
              : [para('')],
            { borders: ALL(NONE) },
          ),
        ),
      }),
      new TableRow({
        cantSplit: true,
        children: items.map((s) =>
          cell([para(s ? s.name || '' : '', { alignment: AlignmentType.CENTER, spacing: { before: 800 } }, { bold: true })], {
            borders: ALL(NONE),
          }),
        ),
      }),
    ],
    { borders: NO_BORDERS },
  );
}

// Word gộp hai bảng liền nhau thành một: chèn một dòng trống rất thấp ở giữa.
const spacer = () =>
  new Paragraph({ spacing: { before: 0, after: 0, line: 20, lineRule: LineRuleType.EXACT }, children: [run('', { size: 2 })] });

const gap = (before) =>
  new Paragraph({ spacing: { before, after: 0, line: 40, lineRule: LineRuleType.EXACT }, children: [run('', { size: 2 })] });

function formChildren(form) {
  const out = [
    form.header === 'national' ? nationalHeader(form) : header(form),
    para(form.title, { alignment: AlignmentType.CENTER, spacing: { before: 280, after: 0 } }, { bold: true, size: 28 }),
  ];
  if (form.subtitle) out.push(para(form.subtitle, { alignment: AlignmentType.CENTER, spacing: { before: 20, after: 120 } }, { italics: true }));
  for (const b of form.blocks) {
    switch (b.t) {
      case 'section':
        if (b.plain) out.push(para(b.text, { spacing: { before: 160, after: 40 }, keepNext: true }, { bold: true }));
        else out.push(gap(50), section(b.text));
        break;
      case 'parties':
        out.push(parties(b.rows));
        break;
      case 'grid':
        out.push(grid(b.rows, b.wide));
        break;
      case 'table':
        out.push(dataTable(b));
        break;
      case 'note':
        out.push(para(b.text, { spacing: { before: 60, after: 0 } }, { italics: true, size: 22 }));
        break;
      case 'para':
        out.push(para(b.text, { spacing: { before: 80, after: 0 } }, { bold: !!b.bold }));
        break;
      default:
        break;
    }
  }
  out.push(gap(240), signatures(form.signatures));
  const res = [];
  out.forEach((node, i) => {
    res.push(node);
    if (node instanceof Table && out[i + 1] instanceof Table) res.push(spacer());
  });
  return res;
}

/** Tài liệu Word cho một hoặc nhiều biểu mẫu (mỗi biểu mẫu bắt đầu trang mới). */
export function formsToDocument(forms) {
  return new Document({
    creator: 'SAM – Quản lý tài sản thông minh',
    title: forms.map((f) => `${f.label} ${f.code}`).join('; '),
    styles: { default: { document: { run: { font: FONT, size: 24 } } } },
    sections: forms.map((f) => ({
      properties: { page: { size: PAGE, margin: { ...MARGIN, footer: Math.round(6 * MM) } } },
      footers: {
        default: new Footer({ children: [para(f.footer, {}, { italics: true, size: 18, color: '666666' })] }),
      },
      children: formChildren(f),
    })),
  });
}

export async function formsToDocxBlob(forms) {
  return Packer.toBlob(formsToDocument(forms));
}

export async function downloadFormsDocx(forms, fileName) {
  const blob = await formsToDocxBlob(forms);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
