// Tab "Giải thích đèn" (mục 5.10 đề tài): mỗi đèn một thẻ: ý nghĩa bằng lời dễ hiểu, điều kiện theo ngưỡng Phòng KHTC
// đang đặt (tự cập nhật khi đổi ngưỡng), phần mềm làm gì, ai nhận cảnh báo, gợi ý ở cột Đề xuất. Dành cho các vai trò
// xem được màu đèn (cán bộ đầu mối, Phòng QTNL, Phòng KHTC). Biểu tượng (?) ở cột đèn mở đúng thẻ (focus).
import React, { useEffect, useRef } from 'react';
import { thresholdsApi } from '../utils/api';
import { useApi } from '../hooks/useApi';
import { LIGHT_ORDER } from '../utils/lights';
import { PageHeader, cx } from '../components/ui';
import { LightBadge } from '../components/Light';

const cards = (t) => ({
  do_1_1: {
    plain: 'Tài sản đã hết hao mòn mà năm nay sửa tốn nhiều, hoặc đã hỏng hẳn.',
    when: `Giá trị còn lại bằng 0 và chi phí sửa trong năm từ ${t.redPct}% nguyên giá; hoặc hư hỏng toàn phần đã được lãnh đạo Phòng QTNL xác nhận.`,
    does: 'Khóa phiếu dự toán tiếp theo; đưa vào danh sách chờ thanh lý; cho phép đề nghị ngoại lệ.',
    who: 'Phòng QTNL, Phòng KHTC',
    hint: 'Đề xuất thanh lý',
  },
  do_1_2: {
    plain: 'Tài sản còn giá trị trên sổ nhưng đã hỏng hẳn.',
    when: 'Giá trị còn lại lớn hơn 0; hư hỏng toàn phần hoặc bất khả kháng đã được lãnh đạo Phòng QTNL xác nhận.',
    does: 'Đưa vào danh sách chờ thanh lý theo quy định tài sản chưa hết hao mòn.',
    who: 'Phòng QTNL, Phòng KHTC',
    hint: 'Đề xuất thanh lý',
  },
  cam: {
    plain: 'Tài sản còn mới trên sổ nhưng hỏng nhiều lần hoặc sửa tốn kém.',
    when: `Chưa hết hao mòn; sửa từ ${t.orangeCount} lần trong năm hoặc chi phí sửa trong năm trên ${t.orangePct}% nguyên giá.`,
    does: 'Tạm dừng sửa, khóa phiếu dự toán; cảnh báo chất lượng thiết bị, kiểm tra bảo hành.',
    who: 'Phòng QTNL, Phòng KHTC',
    hint: 'Kiểm tra kỹ thuật, bảo hành',
  },
  vang_3_1: {
    plain: 'Tài sản nằm kho lâu, không ai dùng.',
    when: `Ở kho ${t.warehouseMonths} tháng liên tục không cấp phát, điều chuyển, báo hỏng (kiểm kê không tính).`,
    does: 'Cảnh báo rà soát, điều chuyển; hỗ trợ kế hoạch mua sắm.',
    who: 'Phòng QTNL, Phòng KHTC',
    hint: 'Đề xuất điều chuyển',
  },
  vang_3_2: {
    plain: 'Tài sản đã hết hao mòn, năm nay có sửa nhưng chưa tốn nhiều.',
    when: `Giá trị còn lại bằng 0, có sửa trong năm, chi phí dưới ${t.redPct}% nguyên giá.`,
    does: `Nhãn Theo dõi sát; từ ${t.repeatCount} lần sửa trong năm thêm nhãn Sửa chữa lặp lại; chạm ${t.redPct}% thì chuyển Đỏ 1.1.`,
    who: 'Phòng QTNL',
    hint: 'Không có; tiếp tục theo dõi',
  },
  vang_3_3: {
    plain: 'Tài sản năm nào cũng sửa, cộng dồn nhiều năm đã tốn nhiều.',
    when: `Chi phí sửa, thay linh kiện cộng dồn từ khi dùng SAM từ ${t.cumulativePct}% nguyên giá.`,
    does: 'Nhãn Sửa chữa kéo dài; vào danh sách rà soát thay thế; không khóa phiếu.',
    who: 'Phòng QTNL, Phòng KHTC',
    hint: 'Đề xuất thay thế khi lập kế hoạch mua sắm',
  },
  xanh_la: {
    plain: 'Tài sản đã hết hao mòn nhưng vẫn chạy tốt.',
    when: `Giá trị còn lại bằng 0, năm nay không sửa (chỉ bảo dưỡng), cộng dồn dưới ${t.cumulativePct}% nguyên giá.`,
    does: 'Nhãn Tài sản vượt vòng đời; Phòng KHTC báo cáo Ban Giám hiệu.',
    who: 'Phòng KHTC',
    hint: 'Không có; tiếp tục sử dụng',
  },
  xanh_duong: {
    plain: 'Tài sản vận hành bình thường.',
    when: `Chưa hết hao mòn; chỉ bảo dưỡng hoặc sửa dưới ${t.orangeCount} lần trong năm, chi phí chưa vượt ngưỡng Cam.`,
    does: `Nhãn Vận hành bình thường; từ ${t.repeatCount} lần sửa trong năm thêm nhãn Sửa chữa lặp lại.`,
    who: 'Không gửi',
    hint: 'Không có',
  },
});

const DEFAULT_TH = { redPct: 20, orangePct: 30, orangeCount: 3, repeatCount: 2, warehouseMonths: 12, cumulativePct: 40 };

const LightsGuidePage = ({ params = {} }) => {
  const { data: th } = useApi(() => thresholdsApi.get(), []);
  const t = th || DEFAULT_TH;
  const c = cards(t);
  const focus = params.focus;
  const refs = useRef({});

  useEffect(() => {
    if (focus && refs.current[focus]) refs.current[focus].scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focus, th]);

  return (
    <div>
      <PageHeader
        title="Giải thích đèn cảnh báo"
        description="Màu đèn do phần mềm tự tính cho từng tài sản từ dữ liệu hao mòn trên sổ và các lần sửa chữa. Ngưỡng hiện hành do Phòng KHTC đặt, tự cập nhật ở đây khi đổi ngưỡng."
      />
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-[3px] border border-rule bg-surface px-4 py-2.5 text-[13px]">
        <span className="font-semibold">Thứ tự ưu tiên</span>
        {['do_1_1', 'cam', 'vang_3_1', 'xanh_la', 'xanh_duong'].map((code, i) => (
          <React.Fragment key={code}>
            {i > 0 && <span className="text-subtle">›</span>}
            <LightBadge code={code} size="sm" />
          </React.Fragment>
        ))}
        <span className="ml-auto text-muted">
          Ngưỡng: <b className="num text-ink">{t.redPct}%</b> · <b className="num text-ink">{t.orangePct}%</b> ·{' '}
          <b className="num text-ink">{t.orangeCount} lần</b> · <b className="num text-ink">{t.repeatCount} lần</b> ·{' '}
          <b className="num text-ink">{t.warehouseMonths} tháng</b> · <b className="num text-ink">{t.cumulativePct}%</b>
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {LIGHT_ORDER.map((code) => (
          <section
            key={code}
            id={`den-${code}`}
            ref={(el) => {
              refs.current[code] = el;
            }}
            className={cx('rounded-[3px] border border-rule bg-surface p-3.5', focus === code && 'ring-2 ring-accent-line')}
          >
            <div className="mb-2">
              <LightBadge code={code} />
            </div>
            <p className="text-[13.5px] leading-snug font-medium text-ink">{c[code].plain}</p>
            <dl className="mt-2 space-y-1.5 text-[12.5px] leading-snug">
              <div>
                <dt className="font-semibold text-muted">Khi nào</dt>
                <dd className="text-ink-2">{c[code].when}</dd>
              </div>
              <div>
                <dt className="font-semibold text-muted">Phần mềm làm gì</dt>
                <dd className="text-ink-2">{c[code].does}</dd>
              </div>
              <div>
                <dt className="font-semibold text-muted">Nhận cảnh báo</dt>
                <dd className="text-ink-2">{c[code].who}</dd>
              </div>
            </dl>
            <p className="mt-2 rounded bg-accent-soft px-2 py-1 text-[12.5px] text-accent">
              <span className="font-semibold">Gợi ý ở cột Đề xuất:</span> {c[code].hint}
            </p>
          </section>
        ))}
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-[3px] border border-rule bg-surface p-3.5 text-[12.5px] leading-snug">
          <p className="mb-1.5 text-[13.5px] font-semibold">Nhãn phụ dưới ô đèn</p>
          <p>
            <b>Tạm tính</b>: đang tính theo dự toán, tính lại khi có chi phí thực tế. <b>Theo dõi sát</b>: Vàng 3.2.{' '}
            <b>Chờ thanh lý</b>: Đỏ 1.1, Đỏ 1.2. <b>Giữ từ năm …</b>: đèn đỏ giữ sang năm mới đến khi Phòng KHTC quyết định.{' '}
            <b>Sửa chữa lặp lại</b>: từ {t.repeatCount} lần trong năm. <b>Sửa chữa kéo dài</b>: Vàng 3.3.{' '}
            <LightBadge code="da_thanh_ly" size="sm" /> thôi tính đèn, vẫn lưu lịch sử.
          </p>
        </section>
        <section className="rounded-[3px] border border-rule bg-surface p-3.5 text-[12.5px] leading-snug">
          <p className="mb-1.5 text-[13.5px] font-semibold">Cách đếm lần sửa</p>
          <p>
            Chỉ lần sửa chữa, thay linh kiện của chính tài sản. Xử lý tại chỗ, bảo dưỡng, vật tư, phụ kiện đi kèm không
            tính; phiếu trùng gộp thành một lần. Đề xuất ở cột Đề xuất không làm đổi màu đèn.
          </p>
        </section>
      </div>
    </div>
  );
};

export default LightsGuidePage;
