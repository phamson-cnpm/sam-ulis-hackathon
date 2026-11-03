
// Phân trang danh sách: 50 dòng một trang (bảng dài cuộn trong khung như phần mềm cũ).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { money } from '../utils/format';
import { cx } from './ui';

export const PAGE_SIZE = 50;

/**
 * rows: cả danh sách (đã lọc, sắp xếp). resetKey: giá trị bộ lọc; đổi bộ lọc thì về trang 1.
 * Danh sách ngắn lại (vừa xử lý xong một dòng) thì giữ trang, chỉ lùi khi trang không còn.
 */
export function usePaged(rows, resetKey, pageSize = PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const total = rows ? rows.length : 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const key = JSON.stringify(resetKey ?? null);
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    setPage(1);
  }, [key]);
  const current = Math.min(page, pageCount);
  const start = (current - 1) * pageSize;
  const pageRows = useMemo(() => (rows || []).slice(start, start + pageSize), [rows, start, pageSize]);
  return {
    page: current,
    setPage,
    pageCount,
    total,
    pageSize,
    start,
    pageRows,
    /** Dòng thứ i (trong cả danh sách) có thuộc trang đang xem không: dùng khi in cần hiện đủ mọi dòng. */
    inPage: (i) => i >= start && i < start + pageSize,
  };
}

const PageBtn = ({ active, className, ...p }) => (
  <button
    type="button"
    className={cx(
      'num inline-flex h-7 min-w-[28px] items-center justify-center rounded-[3px] border px-1.5 text-[13px] disabled:cursor-default disabled:opacity-40',
      active ? 'border-accent bg-accent-soft font-semibold text-accent' : 'border-[#c5cad0] bg-surface text-ink-2 hover:bg-sunken',
      className,
    )}
    {...p}
  />
);

/** Thanh chuyển trang dưới bảng, kiểu phần mềm cũ: ⏮ ◀ Trang [n] / N ▶ ⏭ … "1 - 50 trong 4.639 bản ghi". */
export const Pager = ({ pager, className }) => {
  const nav = useRef(null);
  const { page, setPage, pageCount, total, pageSize } = pager;
  const [draft, setDraft] = useState(String(page));
  useEffect(() => setDraft(String(page)), [page]);
  if (!total) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const go = (p) => {
    const n = Math.min(Math.max(1, p), pageCount);
    setPage(n);
    setDraft(String(n));
    // Đang ở cuối bảng thì cuộn lên đầu bảng để xem trang mới từ dòng đầu
    const box = nav.current?.parentElement;
    if (box && box.getBoundingClientRect().top < 0) {
      window.scrollBy({ top: box.getBoundingClientRect().top - 90 });
    }
    const grid = box?.querySelector('[data-grid-scroll]');
    if (grid) grid.scrollTop = 0;
  };
  const one = pageCount <= 1;
  return (
    <nav
      ref={nav}
      aria-label="Phân trang"
      className={cx(
        'no-print flex flex-wrap items-center justify-between gap-2 border-t border-rule bg-[#f6f7f8] px-2.5 py-1.5 text-[13px]',
        className,
      )}
    >
      <div className="flex items-center gap-1">
        <PageBtn disabled={one || page === 1} onClick={() => go(1)} aria-label="Trang đầu" title="Trang đầu">
          <ChevronsLeft size={15} />
        </PageBtn>
        <PageBtn disabled={one || page === 1} onClick={() => go(page - 1)} aria-label="Trang trước" title="Trang trước">
          <ChevronLeft size={15} />
        </PageBtn>
        <span className="ml-1 text-muted">Trang</span>
        <input
          aria-label="Số trang"
          value={draft}
          disabled={one}
          inputMode="numeric"
          onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
          onBlur={() => go(Number(draft) || page)}
          onKeyDown={(e) => e.key === 'Enter' && go(Number(draft) || page)}
          className="num h-7 w-12 rounded-[3px] border border-[#cdd2d7] bg-surface px-1.5 text-center disabled:bg-sunken"
        />
        <span className="num text-muted">/ {pageCount}</span>
        <PageBtn disabled={one || page === pageCount} onClick={() => go(page + 1)} aria-label="Trang sau" title="Trang sau">
          <ChevronRight size={15} />
        </PageBtn>
        <PageBtn disabled={one || page === pageCount} onClick={() => go(pageCount)} aria-label="Trang cuối" title="Trang cuối">
          <ChevronsRight size={15} />
        </PageBtn>
      </div>
      <span className="text-muted">
        <span className="num">
          {money(from)} - {money(to)}
        </span>{' '}
        trong <span className="num">{money(total)}</span> bản ghi
      </span>
    </nav>
  );
};
