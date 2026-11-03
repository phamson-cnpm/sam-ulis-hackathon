
// Định dạng số tiền, ngày giờ kiểu Việt Nam.
export const money = (n) =>
  n === null || n === undefined ? '—' : new Intl.NumberFormat('vi-VN').format(Math.round(n));

export const pct = (r, digits = 1) =>
  `${(r * 100).toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: digits })}%`;

export const dateVN = (s) => {
  if (!s) return '—';
  const [y, m, d] = s.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};

export const dateTimeVN = (s) => {
  if (!s) return '—';
  const t = s.length > 10 ? s.slice(11, 16) : '';
  return t ? `${t} ${dateVN(s)}` : dateVN(s);
};

export const parseMoney = (s) => {
  const n = Number(String(s).replace(/[^\d]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

export const initials = (name) => {
  const parts = name.trim().split(/\s+/);
  return (
    parts.length > 1 ? parts[parts.length - 2][0] + parts[parts.length - 1][0] : parts[0].slice(0, 2)
  ).toUpperCase();
};

/** Số ngày từ ngày s (2026-10-20 hoặc 2026-10-20T09:30) đến ngày today. */
export const daysBetween = (s, today) => {
  if (!s || !today) return null;
  const a = Date.UTC(...s.slice(0, 10).split('-').map((x, i) => Number(x) - (i === 1 ? 1 : 0)));
  const b = Date.UTC(...today.slice(0, 10).split('-').map((x, i) => Number(x) - (i === 1 ? 1 : 0)));
  return Math.max(0, Math.round((b - a) / 86400000));
};
