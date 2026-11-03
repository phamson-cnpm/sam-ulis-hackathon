
/**
 * @jest-environment node
 */
// Biểu mẫu điền sẵn: nội dung đúng hồ sơ và xuất được file Word.
// Đặt SAM_DOCX_OUT=<thư mục> khi chạy test để ghi các file .docx ra đĩa (xem bằng Word/LibreOffice).
import fs from 'fs';
import path from 'path';
import { Packer } from 'docx';
import dossiers from './__fixtures__/dossiers.json';
import { assetHistoryForm, caseForms, handoverForm } from './forms';
import { formsToDocument } from './formDocx';

// Hồ sơ mẫu cố định (__fixtures__/dossiers.json) cùng dạng dữ liệu máy chủ trả về cho biểu mẫu in
const formsApi = {
  caseDossier: async (id) => dossiers.case[id],
  handoverDossier: async (id) => dossiers.handover[id],
  assetDossier: async (id) => dossiers.asset[id],
};

const flat = (form) =>
  JSON.stringify(form.blocks) + form.signatures.map((s) => `${s.title} ${s.name}`).join(' ');

const byKind = (items, kind) => items.find((it) => it.kind === kind && it.form)?.form;

describe('Biểu mẫu hồ sơ báo hỏng', () => {
  it('hồ sơ có ngoại lệ đủ 5 loại giấy tờ, phiếu dự toán ghi đúng đèn và mã ngoại lệ', async () => {
    const d = await formsApi.caseDossier('r_0016'); // Gestetner: dự toán bị khóa, NL-0003 chờ mở khóa
    const items = caseForms(d);
    expect(items.map((it) => it.kind)).toEqual(['PH', 'BB', 'DCTT', 'DT', 'NL']);
    const dt = byKind(items, 'DT');
    expect(dt.title).toBe('PHIẾU DỰ TOÁN CHI PHÍ SỬA CHỮA, THAY THẾ');
    expect(dt.code).toBe(d.estimate.code);
    expect(flat(dt)).toContain('NL-0003');
    expect(flat(dt)).toContain('Đỏ 1.1');
    const nl = byKind(items, 'NL');
    expect(nl.code).toBe('NL-0003');
    expect(flat(nl)).toContain('(lần này)');
    expect(nl.signatures.map((s) => s.title)).toEqual([
      'Phòng Quản trị nguồn lực',
      'Phòng Kế hoạch – Tài chính',
      'Ban Giám hiệu',
    ]);
  });

  it('phiếu báo hỏng điền tên người báo, mã đợt, ô ký người báo', async () => {
    const d = await formsApi.caseDossier('r_0045'); // tem bị bong: chưa có mã tài sản
    const ph = byKind(caseForms(d), 'PH');
    expect(ph.code).toBe(d.report.code);
    expect(flat(ph)).toContain(d.report.batchCode);
    expect(ph.signatures[0].name).toBe(d.report.reporterName);
    const assetRow = ph.blocks.find((b) => b.t === 'grid' && b.rows[0][0].label === 'Mã tài sản (mã tem)');
    expect(assetRow.rows[0][0].value).toBe('');
  });

  it('biên bản hư hỏng toàn phần ghi người xác nhận', async () => {
    const d = await formsApi.caseDossier('r_0017');
    const bb = byKind(caseForms(d), 'BB');
    expect(flat(bb)).toContain('Xác nhận hư hỏng toàn phần');
    expect(flat(bb)).toContain('Đã xác nhận trên phần mềm');
  });

  it('phiếu điều chuyển tạm thời ghi thiết bị cấp tạm và người nhận', async () => {
    const d = await formsApi.caseDossier('r_0049');
    const tt = byKind(caseForms(d), 'DCTT');
    expect(tt.code).toBe('DC-TT-0001');
    expect(flat(tt)).toContain(d.replacementAssets[0].code);
    expect(tt.signatures[1].name).toBe('Nguyễn Thị Lan');
  });

  it('biên bản bàn giao theo mẫu: quốc hiệu, bên giao, bên nhận, bốn ô ký', async () => {
    const d = await formsApi.handoverDossier('bg_0001');
    const f = handoverForm(d);
    expect(f.header).toBe('national');
    expect(f.title).toBe('BIÊN BẢN BÀN GIAO TÀI SẢN');
    expect(f.signatures.map((x) => x.title)).toEqual(['ĐẠI DIỆN BÊN NHẬN', 'PHÒNG QTNL', 'PHÒNG KHTC', 'ĐẠI DIỆN BÊN GIAO']);
    const table = f.blocks.find((b) => b.t === 'table');
    expect(table.rows[0][4]).toBe(d.handoverAssets[0].code);
    // Hồ sơ máy chiếu Maxell đã thu hồi về kho: có biên bản giao nhận trong danh sách giấy tờ
    const c = await formsApi.caseDossier('r_0017');
    expect(caseForms(c).some((it) => it.kind === 'BG' && it.form)).toBe(true);
  });

  it('xuất được file Word cho từng biểu mẫu và cả hồ sơ', async () => {
    const out = process.env.SAM_DOCX_OUT;
    const bg = await formsApi.handoverDossier('bg_0001');
    const bgBuf = await Packer.toBuffer(formsToDocument([handoverForm(bg)]));
    expect(bgBuf.length).toBeGreaterThan(5000);
    if (out) fs.writeFileSync(path.join(out, 'BG-0001.docx'), bgBuf);
    const cases = ['r_0016', 'r_0049', 'r_0017', 'r_0045', 'r_0015'];
    for (const id of cases) {
      const d = await formsApi.caseDossier(id);
      const forms = caseForms(d)
        .filter((it) => it.form)
        .map((it) => it.form);
      const buf = await Packer.toBuffer(formsToDocument(forms));
      expect(buf.length).toBeGreaterThan(5000);
      if (out) fs.writeFileSync(path.join(out, `Ho-so_${d.report.code}.docx`), buf);
    }
    const a = await formsApi.assetDossier('a_0407_2009_02101');
    const ll = assetHistoryForm(a, { name: 'Lê Minh Châu' });
    const buf = await Packer.toBuffer(formsToDocument([ll]));
    expect(buf.length).toBeGreaterThan(5000);
    if (out) fs.writeFileSync(path.join(out, `${ll.fileName}.docx`), buf);
  });
});
