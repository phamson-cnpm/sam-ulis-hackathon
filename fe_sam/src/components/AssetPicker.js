
// Ô nhập mã tem: gõ mã, tên hoặc phòng để tìm; chọn xong tự hiện tên và vị trí.
import React, { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { assetsApi } from '../utils/api';
import { LightBadge } from './Light';
import { cx, Input } from './ui';

export const AssetPicker = ({
  value,
  onChange,
  showLight,
  placeholder = 'Gõ mã tem, tên tài sản hoặc phòng, ví dụ 0416.2015 hoặc A5.201',
  exclude = [],
  filter,
  autoFocus,
  preferGroup,
}) => {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState([]);
  const [idx, setIdx] = useState(0);
  const box = useRef(null);

  useEffect(() => {
    let alive = true;
    assetsApi.search(q, 30).then((r) => {
      if (!alive) return;
      const list = r
        .filter((a) => !exclude.includes(a.id) && (!filter || filter(a)))
        .sort((a, b) => Number(b.groupCode === preferGroup) - Number(a.groupCode === preferGroup))
        .slice(0, 10);
      setHits(list);
      setIdx(0);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useEffect(() => {
    const h = (e) => box.current && !box.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-rule bg-sunken px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="num text-[13px] font-semibold text-accent">{value.code}</p>
          <p className="truncate text-ink">
            {value.name}
            <span className="text-muted">, {value.location}</span>
          </p>
        </div>
        {showLight && <LightBadge code={value.light.code} size="sm" />}
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-[13px] font-medium text-accent hover:underline"
        >
          Đổi
        </button>
      </div>
    );
  }

  const pick = (a) => {
    onChange(a);
    setQ('');
    setOpen(false);
  };

  return (
    <div className="relative" ref={box}>
      <Search size={16} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-subtle" />
      <Input
        autoFocus={autoFocus}
        value={q}
        placeholder={placeholder}
        className="pl-8"
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setIdx((i) => Math.min(i + 1, hits.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setIdx((i) => Math.max(i - 1, 0));
          } else if (e.key === 'Enter' && hits[idx]) {
            e.preventDefault();
            pick(hits[idx]);
          }
        }}
        aria-autocomplete="list"
      />
      {open && q.trim() && (
        <ul
          className="absolute z-20 mt-1 max-h-[300px] w-full overflow-y-auto rounded-md border border-rule bg-surface py-1 shadow-[0_8px_24px_rgba(28,36,48,0.12)]"
          role="listbox"
        >
          {hits.length === 0 && <li className="px-3 py-2.5 text-muted">Không tìm thấy tài sản khớp “{q}”.</li>}
          {hits.map((a, i) => (
            <li key={a.id} role="option" aria-selected={i === idx}>
              <button
                type="button"
                onMouseEnter={() => setIdx(i)}
                onClick={() => pick(a)}
                className={cx('flex w-full items-center gap-3 px-3 py-1.5 text-left', i === idx && 'bg-accent-soft/60')}
              >
                <span className="num w-[132px] shrink-0 text-[13px] font-medium text-accent">{a.code}</span>
                <span className="min-w-0 flex-1 truncate">{a.name}</span>
                <span className="text-[12.5px] text-muted">{a.location}</span>
                {showLight && <LightBadge code={a.light.code} size="sm" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
