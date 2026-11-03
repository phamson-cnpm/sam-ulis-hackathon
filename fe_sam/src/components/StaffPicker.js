
// Ô chọn người báo hỏng từ dữ liệu cán bộ (Phòng KHTC nhập): gõ tên để tìm, chọn xong tự hiện đơn vị.
import React, { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { staffApi } from '../utils/api';
import { cx, Input } from './ui';

const StaffPicker = ({ value, onChange, id, search = staffApi.search }) => {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const box = useRef(null);
  const [hits, setHits] = useState([]);

  // Tìm trong danh bạ đã tải (Phòng QTNL lập phiếu thay người báo qua điện thoại)
  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      Promise.resolve(search(q, 8))
        .then((r) => alive && setHits(r || []))
        .catch(() => alive && setHits([]));
    }, 150);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, search]);

  useEffect(() => {
    const h = (e) => box.current && !box.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-rule bg-sunken px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-ink">{value.name}</p>
          <p className="truncate text-[13px] text-muted">
            {value.unit}
            {value.position ? `, ${value.position}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            onChange(null);
            setQ('');
          }}
          className="text-[13px] font-medium text-accent hover:underline"
          aria-label="Đổi người báo"
        >
          Đổi
        </button>
      </div>
    );
  }

  const pick = (p) => {
    onChange(p);
    setOpen(false);
  };

  return (
    <div ref={box} className="relative">
      <Search size={16} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-subtle" />
      <Input
        id={id}
        value={q}
        autoFocus
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setIdx(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setIdx((i) => Math.min(i + 1, hits.length - 1));
          if (e.key === 'ArrowUp') setIdx((i) => Math.max(i - 1, 0));
          if (e.key === 'Enter' && hits[idx]) {
            e.preventDefault();
            pick(hits[idx]);
          }
        }}
        placeholder="Gõ họ tên để tìm trong dữ liệu cán bộ"
        className="pl-8"
        role="combobox"
        aria-label="Họ tên người báo"
        aria-expanded={open && hits.length > 0}
        aria-autocomplete="list"
      />
      {open && hits.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 max-h-[280px] w-full overflow-auto rounded-md border border-rule bg-surface py-1 shadow-[0_8px_24px_rgba(28,36,48,0.12)]"
        >
          {hits.map((p, i) => (
            <li key={p.id} role="option" aria-selected={i === idx}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(p)}
                className={cx('w-full px-3 py-1.5 text-left', i === idx ? 'bg-accent-soft' : 'hover:bg-sunken')}
              >
                <span className="block text-[13.5px] text-ink">{p.name}</span>
                <span className="block text-[12px] text-muted">
                  {p.unit}
                  {p.position ? `, ${p.position}` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default StaffPicker;
