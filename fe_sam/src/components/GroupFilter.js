
// Bộ lọc nhóm thiết bị cho danh sách tài sản: gõ để tìm nhóm theo mã hoặc tên (gõ không dấu cũng được),
// chọn một hoặc nhiều nhóm; mỗi nhóm kèm số tài sản khớp các điều kiện lọc khác đang chọn.
import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { cx, Input } from './ui';

/** Bỏ dấu tiếng Việt, chữ thường: "Điều hòa" → "dieu hoa". */
export const fold = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();

/** Nhóm khớp từ khóa theo mã hoặc tên. */
export const groupMatches = (g, q) => {
  const s = fold(q).trim();
  return !s || fold(g.code).includes(s) || fold(g.name).includes(s);
};

export const GroupFilter = ({ groups, totals, counts, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [alignRight, setAlignRight] = useState(false);
  const box = useRef(null);
  const search = useRef(null);

  // Khung danh sách mở về phía còn chỗ, không tràn ra ngoài màn hình
  const toggleOpen = () => {
    if (!open && box.current) {
      const r = box.current.getBoundingClientRect();
      const w = Math.min(420, window.innerWidth - 32);
      setAlignRight(r.left + w > window.innerWidth - 16 && r.right - w >= 16);
    }
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => box.current && !box.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    search.current?.focus();
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Chỉ liệt kê nhóm đang có tài sản trong danh sách
  const usable = groups.filter((g) => (totals[g.code] || 0) > 0);
  const hidden = groups.length - usable.length;
  const shown = usable.filter((g) => groupMatches(g, q));
  const selected = groups.filter((g) => value.includes(g.code));

  const set = (codes) => onChange(groups.map((g) => g.code).filter((c) => codes.includes(c)));
  const toggle = (code) => set(value.includes(code) ? value.filter((c) => c !== code) : [...value, code]);

  const label =
    selected.length === 0
      ? 'Tất cả nhóm thiết bị'
      : selected.length === 1
        ? `${selected[0].code} ${selected[0].name}`
        : `${selected.length} nhóm thiết bị`;

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={toggleOpen}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={selected.length ? selected.map((g) => `${g.code} ${g.name}`).join('\n') : 'Lọc theo nhóm thiết bị'}
        className={cx(
          'inline-flex h-9 max-w-[300px] items-center gap-2 rounded-md border px-2.5 text-sm',
          selected.length
            ? 'border-accent bg-accent-soft font-medium text-accent'
            : 'border-rule bg-surface text-ink hover:border-[#c9ced6]',
        )}
      >
        <span className="truncate">{label}</span>
        <ChevronDown size={15} className={cx('shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Lọc theo nhóm thiết bị"
          className={cx(
            'absolute z-30 mt-1 w-[420px] max-w-[calc(100vw-32px)] rounded-[3px] border border-rule bg-surface shadow-lg',
            alignRight ? 'right-0' : 'left-0',
          )}
        >
          <div className="border-b border-rule-2 p-2">
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-subtle" />
              <Input
                ref={search}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Tìm nhóm theo mã hoặc tên, ví dụ: điều hòa, 0404"
                aria-label="Tìm nhóm thiết bị"
                className="pl-8"
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 px-3 pt-2 pb-1 text-[12.5px]">
            <span className="text-muted">
              {shown.length} nhóm{selected.length ? `, đã chọn ${selected.length}` : ''}
            </span>
            <span className="flex gap-3">
              {q.trim() && shown.length > 0 && (
                <button
                  type="button"
                  onClick={() => set([...value, ...shown.map((g) => g.code)])}
                  className="font-medium text-accent hover:underline"
                >
                  Chọn các nhóm đang hiện
                </button>
              )}
              {selected.length > 0 && (
                <button type="button" onClick={() => set([])} className="font-medium text-accent hover:underline">
                  Bỏ chọn
                </button>
              )}
            </span>
          </div>
          <ul className="max-h-[min(340px,45vh)] overflow-y-auto pb-1">
            {shown.map((g) => {
              const n = counts[g.code] || 0;
              const on = value.includes(g.code);
              return (
                <li key={g.code}>
                  <label
                    className={cx(
                      'flex cursor-pointer items-start gap-2.5 px-3 py-1.5 select-none',
                      on ? 'bg-accent-soft' : 'hover:bg-sunken',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(g.code)}
                      className="mt-[3px] h-4 w-4 shrink-0 accent-[#2a78b8]"
                    />
                    <span className="min-w-0 flex-1 leading-snug">
                      <span className="num mr-1.5 text-[12.5px] font-semibold text-accent">{g.code}</span>
                      <span className={n ? 'text-ink' : 'text-subtle'}>{g.name}</span>
                    </span>
                    <span
                      className={cx('num shrink-0 text-[12.5px]', n ? 'text-ink-2' : 'text-subtle')}
                      title="Số tài sản khớp các điều kiện lọc khác"
                    >
                      {n}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          {shown.length === 0 && <p className="px-3 pb-3 text-muted">Không có nhóm nào khớp “{q.trim()}”.</p>}
          {hidden > 0 && (
            <p className="border-t border-rule-2 px-3 py-2 text-[12px] text-subtle">
              {hidden} nhóm chưa có tài sản nào trong danh sách nên không hiện.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

/** Nhãn các nhóm đang lọc, bấm × để bỏ từng nhóm. */
export const GroupChips = ({ groups, value, onChange }) => {
  const selected = groups.filter((g) => value.includes(g.code));
  if (!selected.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-rule-2 px-3 py-2">
      <span className="text-[12.5px] text-muted">Đang lọc nhóm:</span>
      {selected.map((g) => (
        <button
          key={g.code}
          type="button"
          onClick={() => onChange(value.filter((c) => c !== g.code))}
          title={`Bỏ lọc ${g.code} ${g.name}`}
          className="inline-flex h-7 max-w-[300px] items-center gap-1.5 rounded-md border border-accent bg-accent-soft px-2 text-[12.5px] text-accent hover:bg-surface"
        >
          <span className="num font-semibold">{g.code}</span>
          <span className="truncate">{g.name}</span>
          <X size={13} className="shrink-0" />
        </button>
      ))}
      <button
        type="button"
        onClick={() => onChange([])}
        className="ml-1 text-[12.5px] font-medium text-accent hover:underline"
      >
        Bỏ lọc nhóm
      </button>
    </div>
  );
};

export default GroupFilter;
