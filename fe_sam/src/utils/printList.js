// Bản PDF của danh sách (cán bộ đầu mối tải về lưu hồ sơ đơn vị): mở trang in riêng theo mẫu văn bản, trình duyệt
// "Lưu dưới dạng PDF" (Save as PDF). Không cần thư viện tạo PDF, giữ đúng phông tiếng Việt của máy.
import { ORG_NAME } from '../config/app';

const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const stamp = () =>
  new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date());

/**
 * columns: [{ header, align?: 'right'|'center', width? }]; rows: mảng giá trị đã định dạng.
 * Trả false nếu trình duyệt chặn cửa sổ mới.
 */
export function printList({ fileName, unit, title, subtitle, columns, rows, note }) {
  const win = window.open('', '_blank');
  if (!win) return false;
  const head = columns.map((c) => `<th${c.width ? ` style="width:${c.width}"` : ''}>${esc(c.header)}</th>`).join('');
  const body = rows
    .map(
      (r) =>
        `<tr>${r.map((v, i) => `<td class="${columns[i].align || ''}">${esc(v)}</td>`).join('')}</tr>`,
    )
    .join('');
  win.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${esc(fileName || title)}</title>
<style>
  @page { size: A4 landscape; margin: 12mm 10mm; }
  body { font-family: 'Times New Roman', 'Liberation Serif', serif; color: #111; font-size: 12.5px; line-height: 1.35; margin: 0; padding: 16px; }
  .top { display: flex; justify-content: space-between; font-size: 12.5px; }
  .org { text-align: center; } .org b { display: block; }
  .meta { text-align: right; font-style: italic; }
  h1 { text-align: center; font-size: 16px; margin: 14px 0 2px; text-transform: uppercase; }
  .sub { text-align: center; font-style: italic; margin: 0 0 8px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #444; padding: 3px 5px; vertical-align: top; }
  th { background: #e9eef3; font-weight: bold; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  .right { text-align: right; white-space: nowrap; } .center { text-align: center; }
  .note { font-style: italic; font-size: 12px; margin-top: 8px; }
  .sign { display: flex; justify-content: flex-end; margin-top: 18px; text-align: center; }
  .sign div { width: 280px; } .sign i { display: block; } .sign b { display: block; margin-bottom: 64px; }
  @media screen { body { max-width: 1100px; margin: 0 auto; } .hint { background: #fff8e0; border: 1px solid #e6c766; padding: 6px 10px; margin-bottom: 10px; font-family: system-ui, sans-serif; font-size: 13px; } }
  @media print { .hint { display: none; } }
</style></head><body>
<p class="hint">Chọn máy in "Lưu dưới dạng PDF" (Save as PDF) để tải bản PDF.</p>
<div class="top"><div class="org">ĐẠI HỌC QUỐC GIA HÀ NỘI<b>${esc(ORG_NAME.replace(', ĐHQGHN', '').toUpperCase())}</b>${unit ? `<b>${esc(unit.toUpperCase())}</b>` : ''}</div>
<div class="meta">Bản tải từ phần mềm SAM, ${esc(stamp())}</div></div>
<h1>${esc(title)}</h1>${subtitle ? `<p class="sub">${esc(subtitle)}</p>` : ''}
<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
${note ? `<p class="note">${esc(note)}</p>` : ''}
<div class="sign"><div><i>Ngày ..... tháng ..... năm .........</i><b>NGƯỜI LẬP</b></div></div>
<script>window.onload = function () { setTimeout(function () { window.print(); }, 250); };</script>
</body></html>`);
  win.document.close();
  return true;
}
