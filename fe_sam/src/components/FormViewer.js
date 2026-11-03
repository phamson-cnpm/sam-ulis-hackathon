
// Khung xem biểu mẫu điền sẵn: danh sách giấy tờ của hồ sơ bên trái, trang A4 bên phải.
// Xuất theo vai trò: Phòng QTNL In và Tải Word (in để ký); Phòng KHTC In; cán bộ, đầu mối chỉ xem.
// Mọi lần In, Tải Word được ghi nhật ký theo tên tài khoản.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { FileDown, FileText, Printer, X } from 'lucide-react';
import { exportLogApi, formsApi } from '../utils/api';
import { useApi } from '../hooks/useApi';
import { assetHistoryForm, caseForms, handoverForm } from '../utils/forms';
import { useAuth } from '../utils/AuthContext';
import { useToast } from '../utils/ToastContext';
import { Button, cx } from './ui';
import FormSheet from './FormSheet';

const PAPER_PX = 794; // 210 mm ở 96 dpi

const useFitScale = (ref) => {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => setScale(Math.min(1, Math.max(0.35, (el.clientWidth - 32) / PAPER_PX)));
    update();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return scale;
};

const FormViewer = ({ source, onClose }) => {
  const { user } = useAuth();
  const toast = useToast();
  const isCase = source.type === 'case';
  const isHandover = source.type === 'handover';
  const canPrint = ['ktv', 'lanhdao_qtnl', 'khtc'].includes(user.role);
  const canWord = ['ktv', 'lanhdao_qtnl'].includes(user.role);
  const { data, error } = useApi(
    () =>
      isCase
        ? formsApi.caseDossier(source.reportId)
        : isHandover
          ? formsApi.handoverDossier(source.handoverId)
          : formsApi.assetDossier(source.assetId),
    [source.type, source.reportId, source.assetId, source.handoverId],
  );

  const items = useMemo(() => {
    if (!data) return [];
    // Cán bộ, đầu mối chỉ xem phiếu báo hỏng và phiếu cấp thiết bị tạm (không xem biên bản, chi phí).
    if (isCase && (user.role === 'canbo' || user.role === 'daumoi'))
      return caseForms(data).filter((it) => it.kind === 'PH' || (it.kind === 'DCTT' && it.form));
    if (isCase) return caseForms(data);
    if (isHandover) return [{ kind: 'BG', label: 'Biên bản bàn giao tài sản', form: handoverForm(data) }];
    return [{ kind: 'LL', label: 'Lý lịch sửa chữa tài sản', form: assetHistoryForm(data, user) }];
  }, [data, isCase, isHandover, user]);
  const ready = items.filter((it) => it.form);

  const [selected, setSelected] = useState(null);
  const current =
    ready.find((it) => it.form.key === selected) ||
    ready.find((it) => it.form.key === source.focusKey) ||
    ready.find((it) => it.kind === source.focus) ||
    ready[0] ||
    null;

  const [printForms, setPrintForms] = useState([]);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);
  const closeRef = useRef(null);
  const scale = useFitScale(scrollRef);

  // Đóng bằng Esc, khóa cuộn trang nền
  useEffect(() => {
    // Bắt Esc ở pha capture để không đóng luôn hộp thoại đang mở bên dưới
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = prev;
      document.body.classList.remove('fs-printing');
    };
  }, [onClose]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [current?.form?.key]);

  const title = !data
    ? ''
    : isCase
      ? `Hồ sơ ${data.report.code} · ${data.report.assetName}`
      : isHandover
          ? `${data.handover.code} · bố trí tại ${data.handover.place}`
          : `${data.asset.name} · ${data.asset.code}`;
  const bundleName = !data ? '' : isCase ? `Ho-so_${data.report.code}` : current?.form.fileName;

  // Mọi lần In, Tải Word đều ghi nhật ký theo tên tài khoản
  const logExport = (action, forms) => {
    const where = data && isCase ? `Hồ sơ ${data.report.code}: ` : '';
    exportLogApi.log(user, action, where + forms.map((f) => `${f.label} ${f.code}`.trim()).join('; '));
  };

  const print = (forms, name) => {
    if (!forms.length) return;
    flushSync(() => setPrintForms(forms));
    const oldTitle = document.title;
    document.title = name; // tên gợi ý khi "Lưu dưới dạng PDF"
    document.body.classList.add('fs-printing');
    const done = () => {
      document.body.classList.remove('fs-printing');
      document.title = oldTitle;
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done);
    logExport('in', forms);
    window.print();
  };

  const word = async (forms, name) => {
    if (!forms.length) return;
    setBusy(true);
    try {
      const { downloadFormsDocx } = await import('../utils/formDocx');
      await downloadFormsDocx(forms, name);
      logExport('tai_word', forms);
      toast('success', `Đã tạo file ${name}.docx.`);
    } catch (e) {
      toast('error', `Không tạo được file Word: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const allForms = ready.map((it) => it.form);
  const listTitle = 'Giấy tờ trong hồ sơ';
  const viewOnlyNote = 'Chỉ xem. Phòng QTNL in phiếu, biên bản để ký.';

  return (
    <div
      className="no-print fixed inset-0 z-[60] flex flex-col bg-[#e6e9ed]"
      role="dialog"
      aria-modal="true"
      aria-label="Biểu mẫu in"
    >
      <header className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 border-b border-rule bg-surface px-4 py-2 sm:px-5">
        <FileText size={20} className="shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">
            Biểu mẫu in{current ? `: ${current.form.label} ${current.form.code}` : ''}
          </p>
          <p className="truncate text-[12.5px] text-muted">{title}</p>
        </div>
        {!canPrint && <span className="text-[12.5px] text-muted">{viewOnlyNote}</span>}
        <div className="flex items-center gap-2">
          {canPrint && (
            <Button
              variant={canWord ? 'secondary' : 'primary'}
              icon={<Printer size={16} />}
              disabled={!current}
              title="Mở hộp thoại in của trình duyệt"
              onClick={() => print([current.form], current.form.fileName)}
              aria-label="In"
            >
              <span className="hidden sm:inline">In</span>
            </Button>
          )}
          {canWord && (
            <Button
              variant="primary"
              icon={<FileDown size={16} />}
              disabled={!current || busy}
              title="Tải file Word (.docx) để in, ký"
              onClick={() => word([current.form], current.form.fileName)}
              aria-label="Tải Word"
            >
              <span className="hidden sm:inline">{busy ? 'Đang tạo…' : 'Tải Word'}</span>
            </Button>
          )}
          <button
            ref={closeRef}
            onClick={onClose}
            className="ml-1 rounded-md p-2 text-muted hover:bg-rule-2 hover:text-ink"
            aria-label="Đóng biểu mẫu"
          >
            <X size={20} />
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {items.length > 1 && (
          <aside className="hidden w-[272px] shrink-0 flex-col border-r border-rule bg-surface md:flex">
            <p className="px-4 pt-4 pb-2 text-[12px] text-subtle">{listTitle}</p>
            <ul className="flex-1 space-y-0.5 overflow-y-auto px-2.5">
              {items.map((it, i) => {
                const active = current && it.form && it.form.key === current.form.key;
                return (
                  <li key={it.form ? it.form.key : `${it.kind}-${i}`}>
                    <button
                      disabled={!it.form}
                      onClick={() => setSelected(it.form.key)}
                      title={it.form ? undefined : it.hint}
                      className={cx(
                        'flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left',
                        active ? 'bg-accent-soft' : it.form ? 'hover:bg-rule-2' : 'cursor-default',
                      )}
                      aria-current={active ? 'true' : undefined}
                    >
                      <FileText
                        size={16}
                        className={cx('mt-0.5 shrink-0', active ? 'text-accent' : it.form ? 'text-muted' : 'text-[#c3c9d2]')}
                      />
                      <span className="min-w-0">
                        <span className={cx('block text-[13.5px] leading-snug', active ? 'font-semibold text-accent' : it.form ? 'text-ink' : 'text-subtle')}>
                          {it.label}
                        </span>
                        <span className="num block text-[12px] text-subtle">{it.form ? it.form.code : 'Chưa lập'}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {ready.length > 1 && canPrint && (
              <div className="space-y-2 border-t border-rule-2 p-4">
                <p className="text-[12px] text-subtle">
                  Cả hồ sơ: <span className="num">{ready.length}</span> biểu mẫu, mỗi biểu mẫu bắt đầu trang mới
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => print(allForms, bundleName)}>
                    In cả hồ sơ
                  </Button>
                  {canWord && (
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => word(allForms, bundleName)}
                    >
                      Tải Word cả hồ sơ
                    </Button>
                  )}
                </div>
              </div>
            )}
          </aside>
        )}

        <main ref={scrollRef} className="min-w-0 flex-1 overflow-auto px-4 py-5 sm:px-6">
          {items.length > 1 && (
            <div className="mb-4 md:hidden">
              <label htmlFor="fs-pick" className="mb-1 block text-[12px] text-muted">
                {listTitle}
              </label>
              <select
                id="fs-pick"
                value={current?.form.key || ''}
                onChange={(e) => setSelected(e.target.value)}
                className="w-full rounded-md border border-rule bg-surface px-2.5 py-[7px] text-sm"
              >
                {items.map((it, i) => (
                  <option key={it.form ? it.form.key : `${it.kind}-${i}`} value={it.form ? it.form.key : ''} disabled={!it.form}>
                    {it.label} {it.form ? it.form.code : '(chưa lập)'}
                  </option>
                ))}
              </select>
            </div>
          )}
          {error && <p className="text-l-red">{error}</p>}
          {!data && !error && <p className="text-muted">Đang tải…</p>}
          {current && (
            <div className="mx-auto w-fit bg-white shadow-[0_1px_3px_rgba(28,36,48,0.12),0_10px_30px_rgba(28,36,48,0.14)]">
              <FormSheet form={current.form} style={{ zoom: scale }} />
            </div>
          )}
        </main>
      </div>

      {createPortal(
        <div className="fs-print-root">
          {printForms.map((f) => (
            <FormSheet key={f.key} form={f} />
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
};

export default FormViewer;
