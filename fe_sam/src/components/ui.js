
// Các thành phần giao diện dùng chung. Bố cục, cách trang trí theo phần mềm quản lý tài sản đang dùng ở trường (để quen
// mắt): thanh công cụ nút viền xám, bảng lưới kẻ ô, tiêu đề hộp thoại màu dải tab, phông hệ thống.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Eye, Info, X } from 'lucide-react';
import { filesApi } from '../utils/api';
import { TODAY } from '../config/app';
import { daysBetween } from '../utils/format';

const cx = (...c) => c.filter(Boolean).join(' ');
export { cx };

// ---------------------------------------------------------------- Nhãn "Chỉ xem" (Phòng KHTC xem thao tác của Phòng QTNL)
export const ReadOnlyTag = ({ title = 'Phòng KHTC xem thao tác của Phòng QTNL, không sửa; riêng thu hồi tài sản hỏng thì Phòng KHTC xác nhận và nhập điều chuyển' }) => (
  <span
    className="inline-flex h-7 items-center gap-1 rounded border border-rule bg-sunken px-2 text-[12.5px] font-medium whitespace-nowrap text-ink-2"
    title={title}
  >
    <Eye size={13} /> Chỉ xem
  </span>
);

// ---------------------------------------------------------------- Nút
// Nút kiểu thanh công cụ: viền xám, nền chuyển nhẹ; "create" (Thêm, Báo hỏng...) đỏ cam như nút Thêm của phần mềm cũ.
export const Button = ({ variant = 'secondary', size = 'md', icon, className, children, ...rest }) => (
  <button
    {...rest}
    className={cx(
      'inline-flex items-center justify-center gap-1.5 rounded-[3px] border whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50',
      size === 'sm' ? 'h-7 px-2.5 text-[13px]' : 'h-8 px-3 text-[13.5px]',
      variant === 'primary' && 'border-accent-hover bg-accent text-white hover:bg-accent-hover',
      variant === 'create' && 'border-create-hover bg-create font-medium text-white hover:bg-create-hover',
      variant === 'secondary' &&
        'border-[#c5cad0] bg-gradient-to-b from-white to-[#eef0f2] text-ink shadow-[0_1px_0_rgba(0,0,0,0.04)] hover:from-[#f7f9fa] hover:to-[#e2e6ea]',
      variant === 'ghost' && 'border-transparent text-ink-2 hover:bg-rule-2',
      variant === 'danger' && 'border-[#e3b9b6] bg-surface text-l-red hover:bg-l-red-soft',
      className,
    )}
  >
    {icon}
    {children}
  </button>
);

// ---------------------------------------------------------------- Khung trang
// Đầu trang kiểu thanh công cụ: tên trang, rồi các nút thao tác xếp ngang như phần mềm cũ; lời hướng dẫn một dòng nhỏ.
export const PageHeader = ({ title, description, actions }) => (
  <div className="mb-3 rounded-[3px] border border-rule bg-surface">
    <div className="flex flex-wrap items-center gap-1.5 bg-[#f6f7f8] px-2.5 py-1.5">
      <h1 className="mr-1 text-[15px] leading-8 font-semibold text-ink">{title}</h1>
      {actions && (
        <>
          <span className="mx-1 hidden h-5 w-px bg-rule sm:block" aria-hidden="true" />
          <div className="flex flex-wrap items-center gap-1.5">{actions}</div>
        </>
      )}
    </div>
    {description && (
      <p className="flex items-start gap-1.5 border-t border-rule-2 px-3 py-1.5 text-[12.5px] leading-snug text-muted">
        <Info size={13} className="mt-[2px] shrink-0 text-accent" aria-hidden="true" />
        <span>{description}</span>
      </p>
    )}
  </div>
);

export const Panel = ({ title, aside, className, bodyClass, children }) => (
  <section className={cx('rounded-[3px] border border-rule bg-surface', className)}>
    {(title || aside) && (
      <header className="flex items-center justify-between gap-3 border-b border-rule bg-[#f3f4f6] px-3.5 py-2">
        <h2 className="text-[14px] font-semibold text-ink">{title}</h2>
        {aside}
      </header>
    )}
    <div className={cx('p-4', bodyClass)}>{children}</div>
  </section>
);

/** Lưới nhãn – giá trị, giống bố cục Mẫu phiếu SAM. */
export const KV = ({ items, cols = 2 }) => (
  <dl className={cx('grid gap-x-8 gap-y-2.5', cols === 2 ? 'sm:grid-cols-2' : '')}>
    {items.map(([k, v], i) => (
      <div key={i} className="grid grid-cols-[150px_1fr] gap-3">
        <dt className="text-muted">{k}</dt>
        <dd className="min-w-0 text-ink">{v ?? '—'}</dd>
      </div>
    ))}
  </dl>
);

// ---------------------------------------------------------------- Ô nhập
export const Field = ({ label, hint, required, className, children }) => (
  <label className={cx('block', className)}>
    <span className="mb-1 block text-[13px] font-medium text-ink-2">
      {label}
      {required && <span className="ml-0.5 text-l-red">*</span>}
    </span>
    {children}
    {hint && <span className="mt-1 block text-[12.5px] text-subtle">{hint}</span>}
  </label>
);

const inputCls =
  'w-full rounded-[3px] border border-[#cdd2d7] bg-surface px-2.5 py-[6px] text-[13.5px] text-ink placeholder:text-subtle hover:border-[#b9c0c7] focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft disabled:bg-sunken disabled:text-muted';

export const Input = React.forwardRef(({ className, ...p }, ref) => (
  <input ref={ref} {...p} className={cx(inputCls, className)} />
));
Input.displayName = 'Input';

export const Textarea = ({ className, ...p }) => (
  <textarea {...p} className={cx(inputCls, 'min-h-[68px] resize-y', className)} />
);

export const Select = ({ className, children, ...p }) => (
  <select {...p} className={cx(inputCls, 'pr-8', className)}>
    {children}
  </select>
);

export const Check = ({ checked, onChange, label, hint }) => (
  <label className="flex cursor-pointer items-start gap-2.5 select-none">
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="mt-[3px] h-4 w-4 shrink-0 accent-[#2a78b8]"
    />
    <span>
      <span className="text-ink">{label}</span>
      {hint && <span className="block text-[12.5px] text-subtle">{hint}</span>}
    </span>
  </label>
);

export const Radio = ({ name, value, current, onChange, label }) => (
  <label className="flex cursor-pointer items-start gap-2.5 select-none">
    <input
      type="radio"
      name={name}
      checked={current === value}
      onChange={() => onChange(value)}
      className="mt-[3px] h-4 w-4 shrink-0 accent-[#2a78b8]"
    />
    <span className="text-ink">{label}</span>
  </label>
);

// ---------------------------------------------------------------- Nhãn trạng thái
const toneCls = {
  neutral: 'bg-l-gray-soft text-ink-2',
  accent: 'bg-accent-soft text-accent',
  red: 'bg-l-red-soft text-l-red',
  orange: 'bg-l-orange-soft text-l-orange',
  amber: 'bg-l-amber-soft text-l-amber',
  green: 'bg-l-green-soft text-l-green',
  blue: 'bg-l-blue-soft text-l-blue',
};
export const Pill = ({ tone = 'neutral', children, className }) => (
  <span
    className={cx(
      'inline-flex items-center rounded px-1.5 py-[1px] text-[12.5px] font-medium whitespace-nowrap',
      toneCls[tone],
      className,
    )}
  >
    {children}
  </span>
);

// ---------------------------------------------------------------- Bảng
// Bảng lưới kẻ ô như phần mềm cũ. scroll: bảng dài cuộn trong khung, dòng tiêu đề đứng yên.
export const Table = ({ children, className, scroll }) => (
  <div
    className={cx('overflow-x-auto', scroll && 'overflow-y-auto', className)}
    style={scroll ? { maxHeight: scroll } : undefined}
    data-grid-scroll={scroll ? '' : undefined}
  >
    <table className="w-full text-[13.5px]">{children}</table>
  </div>
);
export const Th = ({ right, className, ...p }) => (
  <th
    {...p}
    className={cx(
      'sticky top-0 z-[5] border-r border-b border-[#d3d7dc] bg-[#f1f3f5] px-2.5 py-2 text-[13px] font-semibold whitespace-nowrap text-ink-2 last:border-r-0',
      right ? 'text-right' : 'text-center',
      className,
    )}
  />
);
export const Td = ({ right, className, ...p }) => (
  <td
    {...p}
    className={cx('border-r border-b border-[#e6e8eb] px-2.5 py-2 align-top last:border-r-0', right && 'num text-right', className)}
  />
);

export const Empty = ({ title, children }) => (
  <div className="px-4 py-10 text-center">
    <p className="font-medium text-ink-2">{title}</p>
    {children && <div className="mt-1 text-muted">{children}</div>}
  </div>
);

// ---------------------------------------------------------------- Tabs
// Thẻ con trong trang: dạng tab có viền như phần mềm cũ.
export function Tabs({ value, onChange, items }) {
  return (
    <div className="mb-3 flex gap-0.5 overflow-x-auto border-b border-rule" role="tablist">
      {items.map((it) => (
        <button
          key={it.id}
          role="tab"
          aria-selected={value === it.id}
          onClick={() => onChange(it.id)}
          className={cx(
            '-mb-px flex shrink-0 items-center gap-1.5 rounded-t-[3px] border px-3 py-1.5 text-[13.5px] whitespace-nowrap',
            value === it.id
              ? 'border-rule border-b-surface bg-surface font-semibold text-accent'
              : 'border-transparent text-muted hover:bg-rule-2 hover:text-ink',
          )}
        >
          {it.label}
          {it.count !== undefined && (
            <span className={cx('num rounded px-1.5 text-[12px]', value === it.id ? 'bg-accent-soft' : 'bg-rule-2')}>
              {it.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- Hộp thoại
export const Modal = ({ open, title, onClose, width = 640, footer, children }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#1c2430]/35 px-4 py-10"
      onMouseDown={onClose}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full overflow-hidden rounded-[4px] border border-band-dark bg-surface shadow-[0_12px_40px_rgba(28,36,48,0.22)] focus:outline-none"
        style={{ maxWidth: width }}
      >
        <header className="flex items-center justify-between bg-band px-4 py-2.5 text-white">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded p-1 text-white/80 hover:bg-white/15 hover:text-white" aria-label="Đóng">
            <X size={18} />
          </button>
        </header>
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <footer className="flex justify-end gap-2 border-t border-rule bg-[#f3f4f6] px-4 py-2.5">{footer}</footer>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- Hộp xác nhận
/**
 * Hộp xác nhận ở giữa màn hình cho thao tác khó hoàn tác (đăng xuất, xóa, khóa tài khoản...). Hiện trên mọi hộp thoại
 * khác; Esc hoặc bấm ra ngoài là Hủy. tone "danger": nút xác nhận màu đỏ.
 */
export const ConfirmDialog = ({ title, children, confirmLabel = 'Xác nhận', cancelLabel = 'Hủy', tone = 'danger', busy, onConfirm, onCancel }) => {
  const okRef = useRef(null);
  useEffect(() => {
    // Bắt Esc trước hộp thoại bên dưới (nếu có) để chỉ đóng hộp xác nhận
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (!busy) onCancel();
      }
    };
    window.addEventListener('keydown', onKey, true);
    okRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey, true);
  }, [busy, onCancel]);
  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[#1c2430]/45 px-4"
      onMouseDown={(e) => {
        e.stopPropagation();
        if (!busy) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-[440px] overflow-hidden rounded-[4px] border border-band-dark bg-surface shadow-[0_16px_48px_rgba(28,36,48,0.3)]"
      >
        <header className="bg-band px-4 py-2.5 text-[15px] font-semibold text-white">{title}</header>
        <div className="flex gap-3 px-5 py-4">
          <AlertTriangle size={22} className={cx('mt-0.5 shrink-0', tone === 'danger' ? 'text-l-red' : 'text-accent')} aria-hidden="true" />
          <div className="min-w-0 text-[13.5px] leading-relaxed text-ink-2">{children}</div>
        </div>
        <footer className="flex justify-end gap-2 border-t border-rule bg-[#f3f4f6] px-4 py-2.5">
          <Button onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <button
            ref={okRef}
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={cx(
              'inline-flex h-8 items-center justify-center rounded-[3px] border px-3 text-[13.5px] font-medium text-white disabled:opacity-50',
              tone === 'danger' ? 'border-[#9c2f28] bg-l-red hover:bg-[#9c2f28]' : 'border-accent-hover bg-accent hover:bg-accent-hover',
            )}
          >
            {busy ? 'Đang xử lý…' : confirmLabel}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
};

/**
 * const [confirm, confirmEl] = useConfirm();
 * if (await confirm({ title, message, confirmLabel, tone })) { ... }   // nhớ đặt {confirmEl} trong JSX
 */
export function useConfirm() {
  const [state, setState] = useState(null);
  const confirm = useCallback((opts) => new Promise((resolve) => setState({ ...opts, resolve })), []);
  const close = useCallback(
    (ok) => {
      setState((cur) => {
        if (cur) cur.resolve(ok);
        return null;
      });
    },
    [],
  );
  const onCancel = useCallback(() => close(false), [close]);
  const el = state ? (
    <ConfirmDialog title={state.title} confirmLabel={state.confirmLabel} tone={state.tone} onConfirm={() => close(true)} onCancel={onCancel}>
      {state.message}
    </ConfirmDialog>
  ) : null;
  return [confirm, el];
}

/** Dòng thông báo trong trang (cảnh báo, lỗi, ghi chú). */
export const Notice = ({ tone = 'info', title, children, className }) => (
  <div
    className={cx(
      'rounded-md border-l-[3px] px-3.5 py-2.5',
      tone === 'info' && 'border-accent bg-accent-soft',
      tone === 'warn' && 'border-l-amber bg-l-amber-soft',
      tone === 'danger' && 'border-l-red bg-l-red-soft',
      tone === 'ok' && 'border-l-green bg-l-green-soft',
      className,
    )}
  >
    {title && <p className="font-semibold text-ink">{title}</p>}
    {children && <div className="text-ink-2">{children}</div>}
  </div>
);

/** Ô chọn tệp giả lập (bản demo chỉ lưu tên tệp). */
/** Mở tệp đã tải lên (bản quét) ở thẻ mới. */
export const FileLink = ({ id, name, empty = 'Chưa đính kèm' }) => {
  const [err, setErr] = useState(null);
  if (!name) return <span className="text-subtle">{empty}</span>;
  if (!id) return <span className="text-ink">{name}</span>;
  return (
    <span>
      <button
        type="button"
        onClick={() => filesApi.open(id).catch((e) => setErr(e.message))}
        className="text-accent hover:underline"
        title="Mở bản quét"
      >
        {name}
      </button>
      {err && <span className="ml-2 text-[13px] text-l-red">{err}</span>}
    </span>
  );
};

/** Chọn bản quét: chọn xong là tải lên máy chủ, trả về { id, name } cho onChange. */
export const FilePick = ({ value, fileId, onChange, label = 'Chọn bản quét (PDF, JPG)' }) => {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const picked = value && typeof value === 'object';
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label
        className={cx(
          'inline-flex h-9 cursor-pointer items-center rounded-md border border-dashed border-[#c3c9d2] bg-sunken px-3 text-sm text-ink-2 hover:border-accent hover:text-accent',
          busy && 'pointer-events-none opacity-60',
        )}
      >
        {busy ? 'Đang tải lên…' : label}
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="sr-only"
          disabled={busy}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            setBusy(true);
            setErr(null);
            try {
              onChange(await filesApi.upload(f));
            } catch (ex) {
              setErr(ex.message);
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      {picked ? (
        <span className="text-ink">{value.name}</span>
      ) : (
        <FileLink id={fileId} name={value} empty="Chưa có tệp" />
      )}
      {err && <span className="text-[13px] text-l-red">{err}</span>}
    </div>
  );
};

/** Số ngày phiếu đã chờ ở trạng thái hiện tại, để nhắc xử lý (mục 5.4 đề tài). */
export const WaitDays = ({ since, className }) => {
  const n = daysBetween(since, TODAY);
  if (n === null) return null;
  return (
    <span className={cx('text-[12.5px] whitespace-nowrap text-muted', className)} title="Số ngày đã chờ ở trạng thái này">
      {n === 0 ? 'Chờ từ hôm nay' : `Đã chờ ${n} ngày`}
    </span>
  );
};

/** Thời điểm phiếu dự toán chuyển sang trạng thái hiện tại: lần ghi lịch sử gần nhất. */
export const statusSince = (est) => (est.history?.length ? est.history[est.history.length - 1].at : est.createdAt);
