
// Hàm tính đèn (cũng là bản gốc để so khớp bản Python trong be_sam). Dữ liệu mẫu cố định trong __fixtures__/seed.json.
import seed from './__fixtures__/seed.json';
import { computeLight } from './lights';

const TODAY = '2026-10-24';
const db = seed;
const byCode = (code) => {
  const a = db.assets.find((x) => x.code === code);
  if (!a) throw new Error('missing ' + code);
  return a;
};
const light = (code, draftLines, th = db.thresholds) =>
  computeLight(byCode(code), db.estimates, th, { asOf: TODAY, draftLines });

const blockLine = {
  id: 'x',
  jobId: 'j001',
  content: 'Thay block máy nén',
  costGroup: 'tinh',
  estimate: 4_500_000,
  actual: null,
};
const cleanLine = {
  id: 'y',
  jobId: 'j006',
  content: 'Vệ sinh, nạp gas',
  costGroup: 'khong_tinh',
  estimate: 800_000,
  actual: null,
};

describe('8 tài sản kịch bản', () => {
  it('H1 điều hòa Daikin: Vàng 3.2, sửa 2 lần, 10%', () => {
    const r = light('0416.2015.02011');
    expect(r.code).toBe('vang_3_2');
    expect(r.yearCount).toBe(2);
    expect(r.yearCost).toBe(3_000_000);
    expect(r.cumulativeCost).toBe(9_000_000);
    expect(r.labels).toContain('Sửa chữa lặp lại');
    expect(r.locked).toBe(false);
  });
  it('H1 khi lập dự toán thay block: Đỏ 1.1, 25%, bị khóa (như Mẫu phiếu SAM)', () => {
    const r = light('0416.2015.02011', [blockLine, cleanLine]);
    expect(r.code).toBe('do_1_1');
    expect(r.yearCount).toBe(3);
    expect(r.yearCost).toBe(7_500_000);
    expect(r.yearRatio).toBeCloseTo(0.25);
    expect(r.cumulativeCost).toBe(13_500_000);
    expect(r.locked).toBe(true);
    expect(r.provisional).toBe(true);
    expect(r.labels).toContain('Sửa chữa kéo dài');
  });
  it('H1: nâng ngưỡng đỏ lên 30% thì về Vàng 3.2', () => {
    const r = light('0416.2015.02011', [blockLine], { ...db.thresholds, redPct: 30 });
    expect(r.code).toBe('vang_3_2');
  });
  it('H2 máy chiếu Panasonic: Xanh dương', () => expect(light('0404.2024.02031').code).toBe('xanh_duong'));
  it('H3 máy in Canon: Cam, 3 lần', () => {
    const r = light('0403.2024.02041');
    expect(r.code).toBe('cam');
    expect(r.yearCount).toBe(3);
    expect(r.locked).toBe(true);
  });
  it('H4 laptop trong kho: Vàng 3.1', () => {
    const r = light('0402.2018.02051');
    expect(r.code).toBe('vang_3_1');
    expect(r.warehouseMonths).toBeGreaterThanOrEqual(12);
  });
  it('H5 photocopy Ricoh: Vàng 3.2, 5%', () => {
    const r = light('0407.2017.02061');
    expect(r.code).toBe('vang_3_2');
    expect(r.yearRatio).toBeCloseTo(0.05);
  });
  it('H6 điều hòa Panasonic: Vàng 3.3, cộng dồn 55%', () => {
    const r = light('0416.2019.02071');
    expect(r.code).toBe('vang_3_3');
    expect(r.cumulativeRatio).toBeCloseTo(0.55);
  });
  it('H7 máy chiếu Epson: Xanh lá', () => expect(light('0404.2013.02081').code).toBe('xanh_la'));
  it('H8 máy tính HP: Xanh dương', () => expect(light('0401.2025.02091').code).toBe('xanh_duong'));
  it('X1 photocopy Gestetner: Đỏ 1.1', () => expect(light('0407.2009.02101').code).toBe('do_1_1'));
  it('X2 máy chiếu Maxell: Đỏ 1.2', () => expect(light('0404.2022.02111').code).toBe('do_1_2'));
});

describe('Dữ liệu mẫu nhất quán', () => {
  it('phiếu bị khóa đã qua bước lãnh đạo đều có đề nghị ngoại lệ', () => {
    const locked = db.estimates.filter((e) => e.locked && e.status !== 'cho_lanh_dao');
    for (const e of locked) {
      const hasException = db.exceptions.some((x) => x.estimateId === e.id);
      expect({ code: e.code, hasException }).toEqual({ code: e.code, hasException: true });
    }
    expect(locked.length).toBe(3);
  });
  it('tài sản thường không chạm ngưỡng đỏ, cam', () => {
    const special = ['0407.2009.02101', '0404.2022.02111', '0403.2024.02041'];
    const bad = db.assets
      .filter((a) => !special.includes(a.code))
      .map((a) => ({ a, r: computeLight(a, db.estimates, db.thresholds, { asOf: TODAY }) }))
      .filter(({ r }) => ['do_1_1', 'do_1_2', 'cam'].includes(r.code));
    expect(bad.map(({ a, r }) => `${a.code} ${r.code}`)).toEqual([]);
  });
});

describe('Tài sản đã thu hồi về kho', () => {
  it('máy chiếu Maxell đã thu hồi: giữ Đỏ 1.2, không tính Vàng 3.1 dù nằm kho', () => {
    const a = byCode('0404.2022.02111');
    expect(a.status).toBe('thu_hoi_kho');
    const l = computeLight({ ...a, lastInteractionDate: '2024-01-01' }, db.estimates, db.thresholds, { asOf: TODAY });
    expect(l.code).toBe('do_1_2');
    expect(l.labels[0]).toBe('Hỏng, đã thu hồi về kho, chờ phương án xử lý');
    expect(l.labels.some((x) => x.startsWith('Tồn kho'))).toBe(false);
  });

  it('sang năm sau vẫn giữ màu đèn lúc thu hồi', () => {
    const a = { ...byCode('0404.2022.02111'), totalLossConfirmedAt: null, recallLight: 'do_1_1' };
    const l = computeLight(a, [], db.thresholds, { asOf: '2027-03-01' });
    expect(l.code).toBe('do_1_1');
  });
});
