
// Đèn cảnh báo: nhãn màu, thanh ngưỡng và lời giải thích vì sao tài sản mang màu đó.
import React from 'react';
import { LIGHT_META } from '../utils/lights';
import { dateVN, money, pct } from '../utils/format';
import { FISCAL_YEAR } from '../config/app';
import { cx } from './ui';

export const TONE_VAR = {
  red: { fg: 'var(--color-l-red)', soft: 'var(--color-l-red-soft)' },
  orange: { fg: 'var(--color-l-orange)', soft: 'var(--color-l-orange-soft)' },
  amber: { fg: 'var(--color-l-amber)', soft: 'var(--color-l-amber-soft)' },
  green: { fg: 'var(--color-l-green)', soft: 'var(--color-l-green-soft)' },
  blue: { fg: 'var(--color-l-blue)', soft: 'var(--color-l-blue-soft)' },
  gray: { fg: 'var(--color-l-gray)', soft: 'var(--color-l-gray-soft)' },
};
export const lightColor = (code) => TONE_VAR[LIGHT_META[code].tone];

/** Đèn: chấm tròn có quầng nhạt + tên mức đèn. */
export const LightBadge = ({ code, size = 'md', className }) => {
  const c = lightColor(code);
  const dot = size === 'lg' ? 12 : size === 'md' ? 9 : 8;
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded font-semibold whitespace-nowrap',
        size === 'lg'
          ? 'px-2.5 py-1 text-[15px]'
          : size === 'md'
            ? 'px-2 py-[2px] text-[13px]'
            : 'px-1.5 py-[1px] text-[12.5px]',
        className,
      )}
      style={{ background: c.soft, color: c.fg }}
    >
      <span
        aria-hidden
        className="inline-block shrink-0 rounded-full"
        style={{ width: dot, height: dot, background: c.fg, boxShadow: `0 0 0 2px #fff, 0 0 0 3px ${c.fg}33` }}
      />
      {LIGHT_META[code].label}
    </span>
  );
};

export const LightLabels = ({ labels, className }) => (
  <span className={cx('text-[12.5px] text-muted', className)}>{labels.join('; ')}</span>
);

/** Giải thích bằng lời vì sao tài sản đang ở mức đèn này. */
export function explainLight(asset, r, th) {
  const out = [];
  out.push(
    r.fullyDepreciated
      ? 'Đã hết hao mòn (giá trị còn lại bằng 0).'
      : `Chưa hết hao mòn (giá trị còn lại ${money(asset.residualValue)} đ).`,
  );
  if (r.yearCount === 0) out.push(`Năm ${FISCAL_YEAR} chưa có lần sửa chữa, thay linh kiện nào.`);
  else
    out.push(
      `Năm ${FISCAL_YEAR} sửa ${r.yearCount} lần, chi phí ${money(r.yearCost)} đ, bằng ${pct(r.yearRatio)} nguyên giá` +
        (r.fullyDepreciated
          ? ` (ngưỡng đỏ ${th.redPct}%).`
          : ` (ngưỡng cam ${th.orangePct}% hoặc ${th.orangeCount} lần).`),
    );
  if (r.cumulativeCost > 0)
    out.push(
      `Cộng dồn từ khi dùng SAM: ${money(r.cumulativeCost)} đ, bằng ${pct(r.cumulativeRatio)} nguyên giá (ngưỡng ${th.cumulativePct}%).`,
    );
  if (r.warehouseMonths !== null)
    out.push(
      `Đang ở kho; lần tương tác gần nhất cách đây ${r.warehouseMonths} tháng (ngưỡng ${th.warehouseMonths} tháng).`,
    );
  if (asset.totalLossConfirmedAt) out.push('Hư hỏng toàn phần đã được lãnh đạo Phòng QTNL xác nhận.');
  if (r.keptFrom)
    out.push(
      `Vào danh sách chờ thanh lý từ năm ${r.keptFrom}; giữ đèn đỏ khi sang năm mới cho đến khi Phòng KHTC quyết định thanh lý hoặc loại khỏi danh sách.`,
    );
  if (asset.disposalClearedAt)
    out.push(`Phòng KHTC đã loại khỏi danh sách chờ thanh lý ngày ${dateVN(asset.disposalClearedAt)}.`);
  if (asset.status === 'da_thanh_ly') out.push(`Đã thanh lý ngày ${dateVN(asset.disposedAt)}; thôi tính đèn.`);
  if (r.pendingTotalLoss) out.push('Có biên bản hư hỏng toàn phần đang chờ lãnh đạo Phòng QTNL xác nhận.');
  if (r.provisional) out.push('Có khoản đang tính theo dự toán; đèn sẽ tính lại khi nhập chi phí thực tế.');
  if (r.locked) out.push('Phiếu dự toán tiếp theo bị khóa; muốn sửa phải lập đề nghị ngoại lệ.');
  return out;
}

// ---------------------------------------------------------------- Thanh ngưỡng
const Hatch = (color) =>
  `repeating-linear-gradient(135deg, ${color} 0 4px, color-mix(in srgb, ${color} 45%, white) 4px 7px)`;

/**
 * Thanh chi phí so với nguyên giá, có vạch ngưỡng.
 * Khi có `after` (dự toán đang soạn), phần tăng thêm hiện bằng sọc chéo, đèn đổi màu ngay.
 */
export const LightMeter = ({ before, after, th, compact }) => {
  const cur = after ?? before;
  const fully = cur.fullyDepreciated;
  const limit = fully ? th.redPct : th.orangePct;
  const scaleMax = Math.max(0.5, cur.yearRatio * 1.15, (limit / 100) * 1.4);
  const w = (r) => `${Math.min((r / scaleMax) * 100, 100)}%`;
  const baseColor = lightColor(before.code).fg;
  const newColor = lightColor(cur.code).fg;
  const delta = after ? Math.max(after.yearRatio - before.yearRatio, 0) : 0;

  const cumMax = Math.max(0.6, cur.cumulativeRatio * 1.15);
  const cw = (r) => `${Math.min((r / cumMax) * 100, 100)}%`;

  const pips = Math.max(th.orangeCount, cur.yearCount);
  return (
    <div className={cx('space-y-4', compact && 'space-y-3')}>
      {/* Chi phí trong năm */}
      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <span className="text-[13px] text-muted">Chi phí sửa năm {FISCAL_YEAR}</span>
          <span className="num text-[13px] font-semibold text-ink">
            {money(cur.yearCost)} đ <span className="font-normal text-muted">({pct(cur.yearRatio)})</span>
          </span>
        </div>
        <div
          className="relative h-3 rounded-[3px] bg-rule-2"
          role="img"
          aria-label={`Chi phí năm bằng ${pct(cur.yearRatio)} nguyên giá, ngưỡng ${limit}%`}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-l-[3px]"
            style={{ width: w(before.yearRatio), background: after ? baseColor : newColor }}
          />
          {after && delta > 0 && (
            <div
              className="absolute inset-y-0 transition-[width] duration-300"
              style={{ left: w(before.yearRatio), width: w(delta), background: Hatch(newColor) }}
            />
          )}
          <div className="absolute -top-1 -bottom-1 w-[2px] bg-ink" style={{ left: w(limit / 100) }} />
        </div>
        <div className="relative mt-1 h-4 text-[12px] text-muted">
          <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: w(limit / 100) }}>
            {fully ? `Ngưỡng đỏ ${limit}%` : `Ngưỡng cam ${limit}%`}
          </span>
        </div>
      </div>

      {/* Số lần sửa */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[13px] text-muted">Số lần sửa trong năm</span>
        <span className="flex items-center gap-1.5">
          {Array.from({ length: pips }).map((_, i) => {
            const filled = i < cur.yearCount;
            const isNew = after && i >= before.yearCount && i < after.yearCount;
            const overLimit = !fully && i + 1 >= th.orangeCount;
            return (
              <span
                key={i}
                className={cx('inline-block h-3.5 w-3.5 rounded-[3px] border', overLimit && !filled && 'border-dashed')}
                style={{
                  borderColor: filled ? (isNew ? newColor : baseColor) : 'var(--color-rule)',
                  background: filled ? (isNew ? Hatch(newColor) : after ? baseColor : newColor) : 'transparent',
                }}
                title={!fully && i + 1 === th.orangeCount ? `Lần thứ ${th.orangeCount}: đèn Cam` : undefined}
              />
            );
          })}
          <span className="num ml-1 text-[13px] font-semibold">{cur.yearCount}</span>
          {!fully && <span className="text-[12px] text-muted">/ {th.orangeCount} lần là Cam</span>}
        </span>
      </div>

      {/* Cộng dồn */}
      {!compact && (
        <div>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="text-[13px] text-muted">Cộng dồn từ khi dùng SAM</span>
            <span className="num text-[13px] font-semibold text-ink">
              {money(cur.cumulativeCost)} đ <span className="font-normal text-muted">({pct(cur.cumulativeRatio)})</span>
            </span>
          </div>
          <div className="relative h-2 rounded-[3px] bg-rule-2">
            <div
              className="absolute inset-y-0 left-0 rounded-l-[3px] bg-ink-2/70"
              style={{ width: cw(cur.cumulativeRatio) }}
            />
            <div className="absolute -top-1 -bottom-1 w-[2px] bg-ink" style={{ left: cw(th.cumulativePct / 100) }} />
          </div>
          <div className="relative mt-1 h-4 text-[12px] text-muted">
            <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: cw(th.cumulativePct / 100) }}>
              Ngưỡng {th.cumulativePct}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
