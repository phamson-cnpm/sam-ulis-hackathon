
// Phiếu dự toán sửa chữa, thay thế (mục 5.3). Đèn tạm tính đổi ngay khi gõ số tiền;
// nếu tài sản rơi vào Đỏ 1.1 hoặc Cam, phiếu bị khóa và phải kèm đề nghị ngoại lệ.
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Lock, Plus, Trash2 } from 'lucide-react';
import { assetsApi, catalogApi, thresholdsApi } from '../utils/api';
import { useApi } from '../hooks/useApi';
import { money, parseMoney } from '../utils/format';
import { COST_GROUP } from '../utils/labels';
import { LIGHT_META } from '../utils/lights';
import { Button, Field, Input, Notice, Select, Textarea, cx } from './ui';
import { LightBadge, LightMeter } from './Light';

const MANUAL = '__manual';
let seq = 0;
const newLine = (group = 'tinh') => ({
  id: `l_draft${++seq}`,
  jobId: null,
  content: '',
  costGroup: group,
  estimate: 0,
  actual: null,
});

export const MoneyInput = ({ value, onChange, label, className }) => (
  <Input
    inputMode="numeric"
    value={value ? money(value) : ''}
    placeholder="0"
    aria-label={label}
    onChange={(e) => onChange(parseMoney(e.target.value))}
    className={cx('num text-right', className)}
  />
);

export const EstimateEditor = ({
  asset,
  target,
  initialLines,
  excludeEstimateId,
  tempEquipmentText = '',
  submitLabel,
  onSubmit,
  onCancel,
  onPreview,
  inlinePreview = true,
}) => {
  const { data: jobs } = useApi(() => catalogApi.repairJobs(), []);
  const { data: th } = useApi(() => thresholdsApi.get(), []);
  const [lines, setLines] = useState(() =>
    initialLines?.length
      ? initialLines.map((l) => ({ ...l }))
      : [newLine(target === 'phu_kien' ? 'khong_tinh' : 'tinh')],
  );
  const [manual, setManual] = useState(() =>
    Object.fromEntries((initialLines || []).filter((l) => !l.jobId).map((l) => [l.id, true])),
  );
  const [preview, setPreview] = useState(null);
  const [exc, setExc] = useState({ reason: '', extraTime: '', tempEquipment: tempEquipmentText });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  useEffect(() => {
    if (tempEquipmentText) setExc((e) => (e.tempEquipment ? e : { ...e, tempEquipment: tempEquipmentText }));
  }, [tempEquipmentText]);

  const myJobs = useMemo(
    () => (jobs || []).filter((j) => j.groupCodes.length === 0 || j.groupCodes.includes(asset.groupCode)),
    [jobs, asset.groupCode],
  );
  const valid = lines.filter((l) => l.content.trim() && l.estimate > 0);

  useEffect(() => () => onPreview?.(null), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let alive = true;
    assetsApi.previewLight(asset.id, valid, excludeEstimateId).then((p) => {
      if (!alive) return;
      setPreview(p);
      onPreview?.(p);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(valid), asset.id, excludeEstimateId]);

  const set = (id, patch) => setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const pickJob = (l, value) => {
    if (value === MANUAL) {
      setManual((m) => ({ ...m, [l.id]: true }));
      set(l.id, { jobId: null, content: '', costGroup: target === 'phu_kien' ? 'khong_tinh' : 'tinh' });
    } else {
      const j = myJobs.find((x) => x.id === value);
      setManual((m) => ({ ...m, [l.id]: false }));
      if (j) set(l.id, { jobId: j.id, content: j.name, costGroup: target === 'phu_kien' ? 'khong_tinh' : j.costGroup });
    }
  };

  const total = valid.reduce((s, l) => s + l.estimate, 0);
  const counted = valid.filter((l) => l.costGroup === 'tinh').reduce((s, l) => s + l.estimate, 0);
  const locked = !!preview?.after.locked;

  const submit = async () => {
    setErr(null);
    if (!valid.length) return setErr('Nhập ít nhất một nội dung công việc có chi phí dự toán.');
    if (lines.some((l) => (l.content.trim() || l.estimate) && !(l.content.trim() && l.estimate > 0)))
      return setErr('Có dòng thiếu nội dung hoặc chi phí. Điền đủ hoặc bỏ dòng đó.');
    if (locked && (!exc.reason.trim() || !exc.extraTime.trim()))
      return setErr('Tài sản bị khóa: nhập lý do cấp thiết và thời gian dự kiến dùng thêm.');
    setBusy(true);
    try {
      await onSubmit(valid, locked ? exc : undefined);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cx('grid gap-5', inlinePreview && 'xl:grid-cols-[minmax(0,1fr)_380px]')}>
      <div className="min-w-0">
        {target === 'phu_kien' && (
          <Notice className="mb-3" title="Hỏng vật tư, phụ kiện đi kèm">
            Biên bản ghi hỏng phụ kiện không thuộc tài sản, nên các dòng mặc định thuộc nhóm không tính vào số lần sửa
            và chi phí lũy kế.
          </Notice>
        )}
        <div className="overflow-x-auto rounded-md border border-rule">
          <table className="w-full text-[13.5px]">
            <thead>
              <tr className="bg-sunken text-left text-[12.5px] text-muted">
                <th className="w-9 border-b border-rule px-2 py-2 text-center font-medium">STT</th>
                <th className="min-w-[220px] border-b border-rule px-2 py-2 font-medium">Nội dung công việc</th>
                <th className="w-[200px] border-b border-rule px-2 py-2 font-medium">Nhóm</th>
                <th className="w-[140px] border-b border-rule px-2 py-2 text-right font-medium">Dự toán (đ)</th>
                <th className="w-9 border-b border-rule" />
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={l.id} className="align-top">
                  <td className="num border-b border-rule-2 px-2 py-2 pt-3.5 text-center text-muted">{i + 1}</td>
                  <td className="border-b border-rule-2 px-2 py-2">
                    <Select
                      value={manual[l.id] ? MANUAL : (l.jobId ?? '')}
                      onChange={(e) => pickJob(l, e.target.value)}
                      aria-label={`Nội dung dòng ${i + 1}`}
                    >
                      <option value="" disabled>
                        Chọn việc sửa chữa
                      </option>
                      {myJobs.map((j) => (
                        <option key={j.id} value={j.id}>
                          {j.name}
                        </option>
                      ))}
                      <option value={MANUAL}>Việc khác (gõ tay)</option>
                    </Select>
                    {manual[l.id] && (
                      <Input
                        className="mt-1.5"
                        value={l.content}
                        placeholder="Mô tả việc sửa chữa"
                        onChange={(e) => set(l.id, { content: e.target.value })}
                      />
                    )}
                  </td>
                  <td className="border-b border-rule-2 px-2 py-2">
                    {manual[l.id] ? (
                      <Select
                        value={l.costGroup}
                        onChange={(e) => set(l.id, { costGroup: e.target.value })}
                        aria-label="Nhóm chi phí"
                      >
                        <option value="tinh">{COST_GROUP.tinh}</option>
                        <option value="khong_tinh">{COST_GROUP.khong_tinh}</option>
                      </Select>
                    ) : l.jobId ? (
                      <div className="pt-2">
                        <span
                          className={cx('text-[13px]', l.costGroup === 'tinh' ? 'font-medium text-ink' : 'text-muted')}
                        >
                          {COST_GROUP[l.costGroup]}
                        </span>
                        <span className="block text-[12px] text-subtle">
                          {l.costGroup === 'tinh' ? 'Tính vào đèn' : 'Không tính vào đèn'}
                        </span>
                      </div>
                    ) : (
                      <span className="block pt-2 text-subtle">—</span>
                    )}
                  </td>
                  <td className="border-b border-rule-2 px-2 py-2">
                    <MoneyInput
                      value={l.estimate}
                      onChange={(n) => set(l.id, { estimate: n })}
                      label={`Dự toán dòng ${i + 1}`}
                    />
                  </td>
                  <td className="border-b border-rule-2 px-1 py-2 pt-2.5">
                    {lines.length > 1 && (
                      <button
                        onClick={() => setLines((ls) => ls.filter((x) => x.id !== l.id))}
                        className="rounded p-1 text-subtle hover:bg-rule-2 hover:text-l-red"
                        aria-label="Bỏ dòng"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="px-3 pt-2.5 text-right text-muted">
                  Tổng dự toán
                </td>
                <td className="num px-2 pt-2.5 text-right font-semibold">{money(total)}</td>
                <td />
              </tr>
              <tr>
                <td colSpan={3} className="px-3 pb-2.5 text-right text-muted">
                  Trong đó tính vào số lần và chi phí sửa chữa
                </td>
                <td className="num px-2 pb-2.5 text-right font-semibold text-accent">{money(counted)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        <Button
          className="mt-2"
          icon={<Plus size={16} />}
          onClick={() => setLines((ls) => [...ls, newLine(target === 'phu_kien' ? 'khong_tinh' : 'tinh')])}
        >
          Thêm dòng
        </Button>

        {locked && (
          <div className="mt-5 rounded-[3px] border border-l-red/40 bg-surface">
            <div className="flex items-start gap-2.5 border-b border-rule-2 bg-l-red-soft px-4 py-3">
              <Lock size={18} className="mt-0.5 shrink-0 text-l-red" />
              <div>
                <p className="font-semibold text-ink">Phiếu dự toán bị khóa</p>
                <p className="text-[13.5px] text-ink-2">
                  Với khoản này, tài sản vào đèn {preview && LIGHT_META[preview.after.code].label}. Muốn sửa phải lập đề
                  nghị ngoại lệ, trình ký Lãnh đạo Phòng QTNL, Phòng KHTC và Ban Giám hiệu; chỉ sửa sau khi Phòng KHTC
                  mở khóa. Việc cấp thiết bị tạm vẫn làm bình thường.
                </p>
              </div>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <Field label="Lý do cấp thiết" required className="sm:col-span-2">
                <Textarea
                  value={exc.reason}
                  onChange={(e) => setExc({ ...exc, reason: e.target.value })}
                  placeholder="Ví dụ: phòng thi, không có thiết bị thay thế đủ công suất"
                />
              </Field>
              <Field label="Thời gian dự kiến dùng thêm" required>
                <Input
                  value={exc.extraTime}
                  onChange={(e) => setExc({ ...exc, extraTime: e.target.value })}
                  placeholder="Ví dụ: đến hết học kỳ I"
                />
              </Field>
              <Field label="Thiết bị thay thế tạm thời">
                <Input
                  value={exc.tempEquipment}
                  onChange={(e) => setExc({ ...exc, tempEquipment: e.target.value })}
                  placeholder="Không có"
                />
              </Field>
            </div>
          </div>
        )}

        {err && <p className="mt-3 text-[13.5px] text-l-red">{err}</p>}
        <div className="mt-4 flex justify-end gap-2">
          {onCancel && <Button onClick={onCancel}>Hủy</Button>}
          <Button variant="primary" disabled={busy} onClick={submit}>
            {submitLabel ?? (locked ? 'Gửi dự toán kèm đề nghị ngoại lệ' : 'Gửi lãnh đạo phòng xác nhận')}
          </Button>
        </div>
      </div>

      {inlinePreview && (
        <aside className="xl:sticky xl:top-20 xl:self-start">
          <LightPreviewCard preview={preview} th={th ?? null} />
        </aside>
      )}
    </div>
  );
};

/** Ô "Đèn tạm tính": đèn trước và sau khoản dự toán, thanh ngưỡng. */
export const LightPreviewCard = ({ preview, th, asset }) => (
  <div className="rounded-[3px] border border-rule bg-surface">
    <div className="border-b border-rule-2 px-4 py-2.5">
      <p className="text-[15px] font-semibold">Đèn tạm tính</p>
      <p className="text-[12.5px] text-muted">Tính ngay khi nhập, gồm cả khoản dự toán này.</p>
    </div>
    {asset && (
      <div className="border-b border-rule-2 px-4 py-2.5">
        <p className="num text-[13px] font-semibold text-accent">{asset.code}</p>
        <p className="font-medium">{asset.name}</p>
        <p className="num text-[12.5px] text-muted">
          Nguyên giá {money(asset.originalCost)} đ, GTCL {money(asset.residualValue)} đ
        </p>
      </div>
    )}
    {!preview || !th ? (
      <p className="p-4 text-muted">Đang tính…</p>
    ) : (
      <div className="p-4">
        <div className="mb-4 flex items-center gap-2.5">
          <LightBadge code={preview.before.code} />
          <ArrowRight size={16} className="text-subtle" />
          <LightBadge code={preview.after.code} size="lg" />
        </div>
        <LightMeter before={preview.before} after={preview.after} th={th} />
        <p className="mt-3 text-[12.5px] text-ink-2">{preview.after.labels.join('; ')}</p>
        {preview.before.code !== preview.after.code && (
          <p className="mt-2 text-[13px] font-medium text-ink">
            Khoản này làm tài sản đổi từ {LIGHT_META[preview.before.code].label} sang{' '}
            {LIGHT_META[preview.after.code].label}.
          </p>
        )}
      </div>
    )}
  </div>
);
