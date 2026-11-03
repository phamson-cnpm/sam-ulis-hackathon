
import React from 'react';
import { CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

export const Toasts = ({ items, onDismiss }) => (
  <div
    className="no-print fixed right-4 bottom-4 z-[60] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2"
    aria-live="polite"
  >
    {items.map((t) => (
      <div
        key={t.id}
        className="flex items-start gap-2.5 rounded-md border border-rule bg-surface px-3.5 py-2.5 shadow-[0_6px_24px_rgba(28,36,48,0.12)]"
      >
        {t.type === 'success' && <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-l-green" />}
        {t.type === 'error' && <AlertTriangle size={18} className="mt-0.5 shrink-0 text-l-red" />}
        {t.type === 'info' && <Info size={18} className="mt-0.5 shrink-0 text-accent" />}
        <p className="flex-1 text-[13.5px] text-ink">{t.message}</p>
        <button onClick={() => onDismiss(t.id)} className="text-subtle hover:text-ink" aria-label="Đóng">
          <X size={16} />
        </button>
      </div>
    ))}
  </div>
);
