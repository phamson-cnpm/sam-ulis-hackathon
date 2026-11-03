
// Hồ sơ một phiếu báo hỏng: phiếu → biên bản kiểm tra → thiết bị tạm → dự toán → chi phí thực tế.
import React, { useState } from 'react';
import FormButton from '../components/FormButton';
import { useTabTitle } from '../utils/TabContext';
import { ChevronLeft } from 'lucide-react';
import {
  refs,
  estimatesApi,
  handoversApi,
  inspectionsApi,
  noSpareApi,
  nowStamp,
  recallsApi,
  reportsApi,
  tempTransfersApi,
  thresholdsApi,
} from '../utils/api';
import { useApi } from '../hooks/useApi';
import { countedCost, LIGHT_META } from '../utils/lights';
import { dateTimeVN, dateVN, money } from '../utils/format';
import {
  COST_GROUP,
  ESTIMATE_STATUS,
  EXCEPTION_STATUS,
  ASSET_STATUS,
  PROPOSAL,
  RECALL_PLAN,
  RECALL_STATUS,
  REPORT_STATUS,
  TARGET,
  TEMP_SOURCE,
  TOTAL_LOSS,
} from '../utils/labels';
import { useAuth } from '../utils/AuthContext';
import { useToast } from '../utils/ToastContext';
import { TODAY } from '../config/app';
import {
  Button,
  Field,
  FileLink,
  FilePick,
  Input,
  KV,
  Modal,
  Notice,
  Pill,
  Radio,
  ReadOnlyTag,
  Table,
  Td,
  Textarea,
  Th,
  cx,
} from '../components/ui';
import { LightBadge, LightMeter } from '../components/Light';
import { AssetPicker } from '../components/AssetPicker';
import { EstimateEditor, LightPreviewCard, MoneyInput } from '../components/EstimateEditor';
import PeopleFields from '../components/PeopleFields';
import { CompleteModal, DecideModal } from './HandoversPage';
import { voucherKey } from '../utils/vouchers';
const Step = ({ n, title, aside, done, children }) => (
  <section className="rounded-[3px] border border-rule bg-surface">
    <header className="flex items-center justify-between gap-3 border-b border-rule-2 px-4 py-2.5">
      <h2 className="flex items-center gap-2.5 text-[15px] font-semibold">
        <span
          className={cx(
            'num inline-flex h-6 w-6 items-center justify-center rounded-full text-[12.5px]',
            done ? 'bg-accent text-white' : 'border border-rule text-muted',
          )}
        >
          {n}
        </span>
        {title}
      </h2>
      {aside}
    </header>
    <div className="p-4">{children}</div>
  </section>
);

const CasePage = ({ reportId, onNavigate }) => {
  const { user } = useAuth();
  const toast = useToast();
  const { data: c } = useApi(() => reportsApi.getCase(reportId), [reportId]);
  const { data: th } = useApi(() => thresholdsApi.get(), []);
  useTabTitle(c && c.report ? `Phiếu ${c.report.code}` : null);
  const [editing, setEditing] = useState(false);
  const [tempOpen, setTempOpen] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  const [actualOpen, setActualOpen] = useState(false); // 'enter' | 'correct'
  const [mergeOpen, setMergeOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [noSpareOpen, setNoSpareOpen] = useState(false);
  const [recallOpen, setRecallOpen] = useState(false);
  const [bgOpen, setBgOpen] = useState(false);
  const [khtcDecide, setKhtcDecide] = useState(false);
  const [khtcComplete, setKhtcComplete] = useState(false);
  const [draft, setDraft] = useState(null);

  if (!c || !th) return <p className="text-muted">Đang tải…</p>;
  const { report, asset, inspection, estimate, exception, temps, batch, recall, handover, noSpares, mergedInto, merged } = c;
  const isKtv = user.role === 'ktv';
  const isKhtc = user.role === 'khtc'; // chỉ xem thao tác của Phòng QTNL; riêng thu hồi tài sản hỏng thì xác nhận, nhập điều chuyển
  const recallCheck = recallsApi.eligibility(report.id);
  const showRecall = !!recall || recallCheck.ok;
  const canAct = isKtv && report.status !== 'hoan_thanh' && !report.mergedIntoId;
  // Gộp phiếu trùng một sự cố (mục 5.3 đề tài): phiếu chưa có biên bản, dự toán, thiết bị tạm
  const canMerge =
    canAct && !inspection && !estimate && temps.length === 0 && noSpares.length === 0 && merged.length === 0;
  const name = (id) => refs.userById(id)?.name ?? '—';
  const activeTemp = temps.find((t) => !t.returnedAt);
  const tempText = activeTemp
    ? `${refs.assetById(activeTemp.replacementAssetId)?.name} (${refs.assetById(activeTemp.replacementAssetId)?.code}), phiếu ${activeTemp.code}`
    : '';

  return (
    <div>
      <div className="no-print">
        <button
          onClick={() => onNavigate('queue')}
          className="mb-3 inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline"
        >
          <ChevronLeft size={16} /> Hàng chờ phiếu
        </button>
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[20px] leading-7 font-semibold">
              Hồ sơ phiếu <span className="num">{report.code}</span>
            </h1>
            <p className="text-muted">
              {report.assetName}, {report.location}. Mã đợt <span className="num">{report.batchCode}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isKhtc && <ReadOnlyTag />}
            <FormButton size="md" source={{ type: 'case', reportId: report.id }}>
              Biểu mẫu hồ sơ
            </FormButton>
            {report.urgent && <Pill tone="red">Khẩn cấp</Pill>}
            <Pill tone={report.status === 'hoan_thanh' ? 'green' : report.status === 'dang_xu_ly' ? 'blue' : 'neutral'}>
              {REPORT_STATUS[report.status]}
            </Pill>
            {mergedInto && <Pill tone="amber">Đã gộp vào {mergedInto.code}</Pill>}
            {canMerge && (
              <Button onClick={() => setMergeOpen(true)} title="Phiếu trùng cùng một sự cố với phiếu khác">
                Gộp phiếu trùng
              </Button>
            )}
            {isKtv && report.status === 'da_gui' && !report.mergedIntoId && (
              <Button
                variant="primary"
                onClick={async () => {
                  await reportsApi.accept(report.id, user.id);
                  toast('success', `Đã nhận xử lý phiếu ${report.code}.`);
                }}
              >
                Nhận xử lý
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-4">
            {/* 1. Phiếu báo hỏng */}
            <Step
              n={1}
              title="Phiếu báo hỏng"
              done
              aside={<FormButton source={{ type: 'case', reportId: report.id, focus: 'PH' }}>Xem phiếu</FormButton>}
            >
              <KV
                items={[
                  ['Người báo', `${report.reporterName}, ${report.reporterUnit}`],
                  ['Điện thoại', <span className="num">{report.phone}</span>],
                  ['Thời gian báo', <span className="num">{dateTimeVN(report.createdAt)}</span>],
                  ['Nguồn', report.source === 'qtnl' ? 'QTNL phát hiện' : 'Cán bộ báo'],
                  ['Nội dung báo hỏng', report.content],
                  ['Tình huống', report.situation || '—'],
                  ['Kỹ thuật viên', name(report.technicianId)],
                ]}
              />
              {batch.length > 0 && (
                <p className="mt-3 border-t border-rule-2 pt-3 text-[13px] text-muted">
                  Cùng đợt:{' '}
                  {batch.map((b, i) => (
                    <React.Fragment key={b.id}>
                      {i > 0 && ', '}
                      <button
                        className="num font-medium text-accent hover:underline"
                        onClick={() => onNavigate('case', { reportId: b.id })}
                      >
                        {b.code}
                      </button>{' '}
                      ({b.assetName})
                    </React.Fragment>
                  ))}
                </p>
              )}
              {mergedInto && (
                <Notice tone="warn" className="mt-3" title={`Phiếu trùng sự cố, đã gộp vào phiếu ${mergedInto.code}`}>
                  Xử lý một lần theo phiếu{' '}
                  <button
                    className="num font-medium text-accent hover:underline"
                    onClick={() => onNavigate('case', { reportId: mergedInto.id })}
                  >
                    {mergedInto.code}
                  </button>{' '}
                  ({mergedInto.reporterName}, {dateTimeVN(mergedInto.createdAt)}); không lập biên bản, dự toán riêng nên
                  không tính thêm lần sửa chữa. Gộp lúc <span className="num">{dateTimeVN(report.mergedAt)}</span> bởi{' '}
                  {name(report.mergedBy)}.
                  {isKtv && mergedInto.status !== 'hoan_thanh' && (
                    <div className="mt-2">
                      <Button
                        size="sm"
                        onClick={async () => {
                          try {
                            await reportsApi.unmerge(report.id);
                            toast('success', `Đã bỏ gộp phiếu ${report.code}; phiếu được xử lý riêng.`);
                          } catch (e) {
                            toast('error', e.message);
                          }
                        }}
                      >
                        Bỏ gộp
                      </Button>
                    </div>
                  )}
                </Notice>
              )}
              {merged.length > 0 && (
                <p className="mt-3 border-t border-rule-2 pt-3 text-[13px] text-muted">
                  Phiếu trùng đã gộp vào phiếu này:{' '}
                  {merged.map((m, i) => (
                    <React.Fragment key={m.id}>
                      {i > 0 && ', '}
                      <button
                        className="num font-medium text-accent hover:underline"
                        onClick={() => onNavigate('case', { reportId: m.id })}
                      >
                        {m.code}
                      </button>{' '}
                      ({m.reporterName})
                    </React.Fragment>
                  ))}
                </p>
              )}
            </Step>

            {/* 2. Biên bản */}
            <Step
              n={2}
              title="Biên bản kiểm tra kỹ thuật"
              done={!!inspection}
              aside={
                inspection && (
                  <span className="flex items-center gap-2.5">
                    <span className="num text-[13px] text-muted">{inspection.code}</span>
                    <FormButton source={{ type: 'case', reportId: report.id, focus: 'BB' }}>Xem biên bản</FormButton>
                  </span>
                )
              }
            >
              {inspection ? (
                <InspectionView ins={inspection} canAct={isKtv} />
              ) : canAct && report.status === 'dang_xu_ly' ? (
                <InspectionForm reportAsset={asset} reportId={report.id} />
              ) : (
                <p className="text-muted">
                  {report.mergedIntoId
                    ? `Lập biên bản theo phiếu chính ${mergedInto?.code ?? ''}.`
                    : report.status === 'da_gui'
                      ? 'Nhận xử lý phiếu để lập biên bản.'
                      : 'Chưa lập biên bản.'}
                </p>
              )}
            </Step>

            {/* 3. Thiết bị tạm */}
            <Step
              n={3}
              title="Thiết bị thay thế tạm thời (khi khẩn cấp)"
              done={temps.length > 0}
              aside={
                canAct &&
                report.urgent &&
                report.status === 'dang_xu_ly' &&
                !activeTemp && (
                  <span className="flex items-center gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setNoSpareOpen(true)}>
                      Kho không có thiết bị
                    </Button>
                    <Button size="sm" onClick={() => setTempOpen(true)}>
                      Cấp thiết bị tạm
                    </Button>
                  </span>
                )
              }
            >
              {noSpares.length > 0 && (
                <div className="mb-3 space-y-2">
                  {noSpares.map((n) => (
                    <Notice key={n.id} tone="warn" title={`Kho không có thiết bị thay thế: ${n.need}`}>
                      {n.reason}. Ghi nhận lúc <span className="num">{dateTimeVN(n.recordedAt)}</span> bởi{' '}
                      {name(n.recordedBy)}; dùng làm dữ liệu cho kế hoạch mua sắm thiết bị dự phòng.
                    </Notice>
                  ))}
                </div>
              )}
              {temps.length === 0 && report.mergedIntoId ? (
                <p className="text-muted">Theo phiếu chính {mergedInto?.code}.</p>
              ) : temps.length === 0 ? (
                noSpares.length === 0 &&
                (report.urgent ? (
                  <p className="text-muted">
                    Chưa cấp. Phiếu khẩn cấp: cấp từ kho để việc dạy, làm việc không bị gián đoạn; không làm đổi đơn vị,
                    vị trí trên sổ tài sản. Kho không có thiết bị thì ghi nhận kèm lý do.
                  </p>
                ) : (
                  <p className="text-muted">Không áp dụng: chỉ cấp thiết bị tạm khi phiếu khẩn cấp.</p>
                ))
              ) : (
                <TempList
                  reportId={report.id}
                  temps={temps}
                  canAct={isKtv}
                  repaired={!!estimate?.actualEnteredAt}
                  recalling={showRecall}
                />
              )}
            </Step>

            {/* 4. Dự toán */}
            <Step
              n={4}
              title="Dự toán sửa chữa, thay thế"
              done={!!estimate}
              aside={
                estimate && (
                  <span className="flex items-center gap-2.5">
                    <span className="num text-[13px] text-muted">{estimate.code}</span>
                    <FormButton source={{ type: 'case', reportId: report.id, focus: 'DT' }}>Xem phiếu dự toán</FormButton>
                  </span>
                )
              }
            >
              {!inspection && report.mergedIntoId ? (
                <p className="text-muted">Theo phiếu chính {mergedInto?.code}.</p>
              ) : !inspection ? (
                <p className="text-muted">Lập sau khi có biên bản kiểm tra với đề xuất sửa chữa, thay thế linh kiện.</p>
              ) : inspection.proposal === 'tai_cho' ? (
                <Notice tone="ok" title="Đã xử lý tại chỗ, hồ sơ đóng">
                  Lần này lưu vào lịch sử nhưng không tính vào số lần sửa chữa.
                </Notice>
              ) : inspection.proposal === 'hong_toan_phan' ? (
                <Notice
                  tone={inspection.totalLossStatus === 'da_xac_nhan' ? 'danger' : 'warn'}
                  title={`Hư hỏng toàn phần: ${TOTAL_LOSS[inspection.totalLossStatus ?? 'cho_xac_minh']}`}
                >
                  {inspection.totalLossStatus === 'da_xac_nhan'
                    ? `Lãnh đạo Phòng QTNL đã xác nhận lúc ${dateTimeVN(inspection.totalLossAt)}. Tài sản vào đèn đỏ, danh sách chờ thanh lý.`
                    : inspection.totalLossStatus === 'tra_lai'
                      ? `Bị trả lại: ${inspection.totalLossReturnReason}`
                      : 'Chờ lãnh đạo Phòng QTNL xác nhận trên phần mềm. Không lập dự toán sửa chữa.'}
                </Notice>
              ) : estimate && !editing ? (
                <EstimateView
                  reportId={report.id}
                  est={estimate}
                  exception={exception}
                  canAct={isKtv}
                  onResubmit={() => setEditing(true)}
                  onSign={() => setSignOpen(true)}
                  onActual={() => setActualOpen('enter')}
                  onCorrect={() => setActualOpen('correct')}
                  onReject={() => setRejectOpen(true)}
                />
              ) : canAct && asset ? (
                editing && estimate ? (
                  <EstimateEditor
                    asset={asset}
                    inlinePreview={false}
                    onPreview={setDraft}
                    target={inspection.target}
                    initialLines={estimate.lines}
                    excludeEstimateId={estimate.id}
                    tempEquipmentText={tempText}
                    submitLabel="Gửi lại lãnh đạo phòng"
                    onCancel={() => setEditing(false)}
                    onSubmit={async (lines) => {
                      await estimatesApi.resubmit(estimate.id, lines, user);
                      setEditing(false);
                      toast('success', `Đã gửi lại dự toán ${estimate.code}.`);
                    }}
                  />
                ) : (
                  <EstimateEditor
                    asset={asset}
                    inlinePreview={false}
                    onPreview={setDraft}
                    target={inspection.target}
                    tempEquipmentText={tempText}
                    onSubmit={async (lines, exc) => {
                      const res = await estimatesApi.create(
                        { assetId: asset.id, inspectionId: inspection.id, reportId: report.id, lines },
                        user,
                        exc,
                      );
                      toast(
                        'success',
                        res.exception
                          ? `Đã gửi dự toán ${res.estimate.code} kèm đề nghị ngoại lệ ${res.exception.code}.`
                          : `Đã gửi dự toán ${res.estimate.code} cho lãnh đạo phòng.`,
                      );
                    }}
                  />
                )
              ) : (
                <p className="text-muted">Chưa lập dự toán.</p>
              )}
            </Step>

            {/* 5. Thu hồi tài sản hỏng về kho: hư hỏng toàn phần, hoặc không được duyệt chi phí sửa chữa.
                Chạy song song với thiết bị tạm (bước 3), không chờ thu hồi thiết bị tạm. */}
            {showRecall && (
              <Step
                n={5}
                title="Thu hồi tài sản hỏng về kho"
                done={recall?.status === 'hoan_thanh'}
                aside={
                  recall && (
                    <span className="flex items-center gap-2.5">
                      <span className="num text-[13px] text-muted">{recall.code}</span>
                      {handover && (
                        <FormButton source={{ type: 'case', reportId: report.id, focus: 'BG' }}>
                          Xem biên bản
                        </FormButton>
                      )}
                    </span>
                  )
                }
              >
                <RecallView
                  recall={recall}
                  handover={handover}
                  check={recallCheck}
                  activeTemp={activeTemp}
                  canPropose={isKtv}
                  canHandover={isKtv}
                  isKhtc={isKhtc}
                  onPropose={() => setRecallOpen(true)}
                  onHandover={() => setBgOpen(true)}
                  onDecide={() => setKhtcDecide(true)}
                  onComplete={() => setKhtcComplete(true)}
                />
              </Step>
            )}
          </div>

          <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
            {asset && draft ? (
              <LightPreviewCard preview={draft} th={th} asset={asset} />
            ) : asset ? (
              <AssetCard asset={asset} />
            ) : (
              <Notice title="Chưa có mã tài sản">Tem mờ, rách. Kỹ thuật viên gán mã khi lập biên bản kiểm tra.</Notice>
            )}
          </aside>
        </div>
      </div>

      {tempOpen && <TempModal report={report} onClose={() => setTempOpen(false)} />}
      {signOpen && estimate && <SignModal est={estimate} onClose={() => setSignOpen(false)} />}
      {actualOpen && estimate && (
        <ActualModal est={estimate} mode={actualOpen} onClose={() => setActualOpen(false)} />
      )}
      {mergeOpen && <MergeModal report={report} onClose={() => setMergeOpen(false)} />}
      {rejectOpen && estimate && <RejectModal est={estimate} onClose={() => setRejectOpen(false)} />}
      {noSpareOpen && <NoSpareModal report={report} asset={asset} onClose={() => setNoSpareOpen(false)} />}
      {recallOpen && asset && (
        <RecallModal report={report} asset={asset} check={recallCheck} onClose={() => setRecallOpen(false)} />
      )}
      {bgOpen && recall && asset && (
        <RecallHandoverModal recall={recall} report={report} asset={asset} onClose={() => setBgOpen(false)} />
      )}
      {khtcDecide && recall && <DecideModal r={recall} onClose={() => setKhtcDecide(false)} />}
      {khtcComplete && recall && <CompleteModal r={recall} h={handover} onClose={() => setKhtcComplete(false)} />}
    </div>
  );

  function AssetCard({ asset: a }) {
    return (
      <div className="rounded-[3px] border border-rule bg-surface">
        <div className="border-b border-rule-2 px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="num text-[13px] font-semibold text-accent">{a.code}</p>
              <p className="font-semibold">{a.name}</p>
              <p className="text-[13px] text-muted">
                {a.unit}, {a.location}
              </p>
              {a.status !== 'dang_su_dung' && (
                <Pill tone="amber" className="mt-1">
                  {ASSET_STATUS[a.status]}
                </Pill>
              )}
            </div>
            <LightBadge code={a.light.code} />
          </div>
        </div>
        <div className="space-y-3 p-4">
          <KV
            cols={1}
            items={[
              ['Nguyên giá', <span className="num">{money(a.originalCost)} đ</span>],
              ['Giá trị còn lại', <span className="num">{money(a.residualValue)} đ</span>],
              ['Đưa vào sử dụng', <span className="num">{dateVN(a.inUseDate)}</span>],
            ]}
          />
          <div className="border-t border-rule-2 pt-3">
            <LightMeter before={a.light} th={th} compact />
          </div>
          <p className="text-[12.5px] text-ink-2">{a.light.labels.join('; ')}</p>
          <Button size="sm" variant="ghost" onClick={() => onNavigate('asset', { assetId: a.id })}>
            Xem lịch sử tài sản
          </Button>
        </div>
      </div>
    );
  }
};

// ---------------------------------------------------------------- Biên bản
const InspectionForm = ({ reportAsset, reportId }) => {
  const { user } = useAuth();
  const toast = useToast();
  const [asset, setAsset] = useState(reportAsset);
  const [at, setAt] = useState(nowStamp());
  const [findings, setFindings] = useState('');
  const [target, setTarget] = useState('tai_san');
  const [proposal, setProposal] = useState('sua_chua');
  const [note, setNote] = useState('');
  const [temp, setTemp] = useState('');
  const [err, setErr] = useState(null);

  const save = async () => {
    if (!asset) return setErr('Chọn mã tài sản.');
    if (!findings.trim()) return setErr('Nhập tình trạng ghi nhận khi kiểm tra.');
    try {
      const ins = await inspectionsApi.create(
        {
          reportId,
          assetId: asset.id,
          inspectedAt: at,
          findings: findings.trim(),
          target,
          proposal,
          proposalNote: note.trim(),
          tempSolution: temp.trim(),
          note: '',
        },
        user,
      );
      toast('success', `Đã lưu biên bản ${ins.code}.`);
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <div className="space-y-4">
      {!reportAsset && (
        <Field label="Mã tài sản" required hint="Phiếu báo hỏng không có mã tem: gán mã tài sản ở đây.">
          <AssetPicker value={asset} onChange={setAsset} showLight />
        </Field>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Thời gian kiểm tra" required>
          <Input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
        </Field>
        <Field label="Kỹ thuật viên kiểm tra">
          <Input value={user.name} disabled />
        </Field>
      </div>
      <Field label="Tình trạng ghi nhận" required>
        <Textarea
          value={findings}
          onChange={(e) => setFindings(e.target.value)}
          placeholder="Ví dụ: block máy nén yếu, thiếu gas, dàn nóng bám bụi"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium text-ink-2">Đối tượng hỏng</legend>
          <div className="space-y-1.5">
            {Object.keys(TARGET).map((t) => (
              <Radio
                key={t}
                name="target"
                value={t}
                current={target}
                onChange={(v) => setTarget(v)}
                label={TARGET[t]}
              />
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium text-ink-2">Đề xuất giải pháp</legend>
          <div className="space-y-1.5">
            {Object.keys(PROPOSAL).map((p) => (
              <Radio
                key={p}
                name="proposal"
                value={p}
                current={proposal}
                onChange={(v) => setProposal(v)}
                label={PROPOSAL[p]}
              />
            ))}
          </div>
        </fieldset>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nội dung đề xuất">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ví dụ: thay block máy nén, nạp gas"
          />
        </Field>
        <Field label="Giải pháp tạm thời">
          <Input
            value={temp}
            onChange={(e) => setTemp(e.target.value)}
            placeholder="Ví dụ: cấp điều hòa di động từ kho"
          />
        </Field>
      </div>
      {proposal === 'hong_toan_phan' && (
        <Notice tone="warn">
          Biên bản hư hỏng toàn phần chuyển lãnh đạo Phòng QTNL xác nhận trên phần mềm; xác nhận xong tài sản mới vào
          đèn đỏ.
        </Notice>
      )}
      {err && <p className="text-[13.5px] text-l-red">{err}</p>}
      <div className="flex justify-end">
        <Button variant="primary" onClick={save}>
          Lưu biên bản
        </Button>
      </div>
    </div>
  );
};

const InspectionView = ({ ins, canAct }) => (
  <div className="space-y-3">
    <KV
      items={[
        ['Thời gian kiểm tra', <span className="num">{dateTimeVN(ins.inspectedAt)}</span>],
        ['Kỹ thuật viên', refs.userById(ins.technicianId)?.name],
        ['Tình trạng ghi nhận', ins.findings],
        ['Đối tượng hỏng', TARGET[ins.target]],
        ['Đề xuất giải pháp', PROPOSAL[ins.proposal]],
        ['Nội dung đề xuất', ins.proposalNote || '—'],
        ['Giải pháp tạm thời', ins.tempSolution || '—'],
        [
          'Xác nhận hư hỏng',
          ins.totalLossStatus ? (
            <Pill tone={ins.totalLossStatus === 'da_xac_nhan' ? 'red' : 'amber'}>
              {TOTAL_LOSS[ins.totalLossStatus]}
            </Pill>
          ) : (
            'Không áp dụng'
          ),
        ],
      ]}
    />
    <div className="border-t border-rule-2 pt-3">
      <p className="mb-1.5 text-[13px] text-muted">Bản quét có chữ ký kỹ thuật viên và người sử dụng</p>
      {canAct ? (
        <FilePick value={ins.scanFile} fileId={ins.scanFileId} onChange={(n) => inspectionsApi.attachScan(ins.id, n)} />
      ) : (
        <FileLink id={ins.scanFileId} name={ins.scanFile} />
      )}
    </div>
  </div>
);

// ---------------------------------------------------------------- Thiết bị tạm
const TempList = ({ reportId, temps, canAct, repaired, recalling }) => {
  const toast = useToast();
  return (
    <div className="space-y-3">
      {temps.map((t) => {
        const a = refs.assetById(t.replacementAssetId);
        return (
          <div key={t.id} className="rounded-md border border-rule-2 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">
                  {a?.name} <span className="num text-[13px] font-normal text-muted">{a?.code}</span>
                </p>
                <p className="text-[13px] text-muted">
                  Phiếu <span className="num">{t.code}</span>, {TEMP_SOURCE[t.source]}, dùng tại {t.useLocation}. Người
                  nhận {t.receiverName}.
                </p>
                <p className="text-[13px] text-muted">
                  Cấp lúc <span className="num">{dateTimeVN(t.issuedAt)}</span>. Hạn thu hồi thiết bị tạm: {t.expectedReturn}.
                </p>
              </div>
              {t.returnedAt ? (
                <div className="flex items-center gap-2">
                  <Pill tone="green">Đã thu hồi thiết bị tạm {dateVN(t.returnedAt)}</Pill>
                  <FormButton source={{ type: 'case', reportId, focusKey: `DCTT:${t.id}` }}>Xem phiếu</FormButton>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Pill tone="amber">Đang sử dụng</Pill>
                  <FormButton source={{ type: 'case', reportId, focusKey: `DCTT:${t.id}` }}>Xem phiếu</FormButton>
                  {canAct && (
                    <Button
                      size="sm"
                      onClick={async () => {
                        await tempTransfersApi.markReturned(t.id);
                        toast('success', `Đã thu hồi thiết bị tạm theo phiếu ${t.code}.`);
                      }}
                    >
                      Thu hồi thiết bị tạm
                    </Button>
                  )}
                </div>
              )}
            </div>
            {!t.returnedAt && repaired && (
              <Notice tone="warn" className="mt-2">
                Tài sản gốc đã sửa xong. Nhắc thu hồi thiết bị tạm.
              </Notice>
            )}
            {!t.returnedAt && !repaired && recalling && (
              <Notice className="mt-2">
                Tài sản gốc hỏng, thu hồi về kho ở mục 5 (chạy song song). Thiết bị tạm vẫn thuộc Kho QTNL trên sổ, giữ
                ở đơn vị đến khi có thiết bị mới thì thu hồi thiết bị tạm.
              </Notice>
            )}
          </div>
        );
      })}
    </div>
  );
};

const TempModal = ({ report, onClose }) => {
  const { user } = useAuth();
  const toast = useToast();
  const [repl, setRepl] = useState(null);
  const [source, setSource] = useState('kho_qtnl');
  const [useLocation, setUseLocation] = useState(report.location);
  const [expectedReturn, setExpectedReturn] = useState('Khi sửa xong tài sản gốc');
  const [receiverName, setReceiverName] = useState(report.reporterName);
  const [receiverUnit, setReceiverUnit] = useState(report.reporterUnit);
  const [issuedAt, setIssuedAt] = useState(nowStamp());
  const [err, setErr] = useState(null);

  const save = async () => {
    if (!repl) return setErr('Chọn thiết bị cấp tạm (thiết bị nào cũng có mã tài sản).');
    const t = await tempTransfersApi.create(
      {
        reportId: report.id,
        originalAssetId: report.assetId,
        replacementAssetId: repl.id,
        source,
        useLocation,
        expectedReturn,
        receiverName,
        receiverUnit,
        issuedAt,
      },
      user,
    );
    toast('success', `Đã lập phiếu điều chuyển tạm thời ${t.code}.`);
    onClose();
  };

  return (
    <Modal
      open
      title="Phiếu điều chuyển tạm thời"
      onClose={onClose}
      width={720}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="primary" onClick={save}>
            Lập phiếu và cấp thiết bị
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {report.situation && <Notice title="Tình huống đang xảy ra">{report.situation}</Notice>}
        <Field
          label="Thiết bị cấp tạm"
          required
          hint="Gõ “KHO” để xem thiết bị đang ở kho; thiết bị cùng loại hiện trước."
        >
          <AssetPicker
            value={repl}
            onChange={setRepl}
            showLight
            exclude={report.assetId ? [report.assetId] : []}
            preferGroup={refs.assetById(report.assetId)?.groupCode}
            autoFocus
          />
        </Field>
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium text-ink-2">Nguồn cấp</legend>
          <div className="flex flex-wrap gap-5">
            {Object.keys(TEMP_SOURCE).map((s) => (
              <Radio
                key={s}
                name="src"
                value={s}
                current={source}
                onChange={(v) => setSource(v)}
                label={TEMP_SOURCE[s]}
              />
            ))}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nơi sử dụng">
            <Input value={useLocation} onChange={(e) => setUseLocation(e.target.value)} />
          </Field>
          <Field label="Thời gian cấp">
            <Input type="datetime-local" value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} />
          </Field>
          <Field label="Người nhận">
            <Input value={receiverName} onChange={(e) => setReceiverName(e.target.value)} />
          </Field>
          <Field label="Đơn vị người nhận">
            <Input value={receiverUnit} onChange={(e) => setReceiverUnit(e.target.value)} />
          </Field>
          <Field label="Hạn thu hồi thiết bị tạm (dự kiến)" className="sm:col-span-2">
            <Input value={expectedReturn} onChange={(e) => setExpectedReturn(e.target.value)} />
          </Field>
        </div>
        <p className="text-[12.5px] text-muted">
          Phiếu tạm không đổi đơn vị quản lý, vị trí trên sổ tài sản và không tính vào chi phí lũy kế. Người nhận và kỹ
          thuật viên ký trên bản in.
        </p>
        {err && <p className="text-[13.5px] text-l-red">{err}</p>}
      </div>
    </Modal>
  );
};

// ---------------------------------------------------------------- Dự toán đã lập
const EstimateView = ({ reportId, est, exception, canAct, onResubmit, onSign, onActual, onCorrect, onReject }) => {
  const total = est.lines.reduce((s, l) => s + l.estimate, 0);
  const actualTotal = est.actualEnteredAt ? est.lines.reduce((s, l) => s + (l.actual ?? 0), 0) : null;
  const counted = countedCost(est.lines);
  const actualCheck = estimatesApi.canEnterActual(est);
  const tone =
    est.status === 'da_ky_du'
      ? 'green'
      : est.status === 'khong_dong_y'
        ? 'red'
        : est.status === 'can_kiem_tra_lai'
          ? 'amber'
          : 'blue';
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <Pill tone={tone}>{ESTIMATE_STATUS[est.status]}</Pill>
        {est.actualEnteredAt && <Pill tone="green">Đã có chi phí thực tế</Pill>}
        <span className="text-[13px] text-muted">
          Lập ngày <span className="num">{dateVN(est.createdAt)}</span> bởi {refs.userById(est.createdBy)?.name}
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-[13px] text-muted">
          Đèn <LightBadge code={est.lightBefore} size="sm" /> thành <LightBadge code={est.lightAfter} size="sm" />
        </span>
      </div>

      <Table className="rounded-md border border-rule-2">
        <thead>
          <tr>
            <Th>STT</Th>
            <Th>Nội dung công việc</Th>
            <Th>Nhóm</Th>
            <Th right>Dự toán (đ)</Th>
            <Th right>Thực tế (đ)</Th>
          </tr>
        </thead>
        <tbody>
          {est.lines.map((l, i) => (
            <tr key={l.id}>
              <Td className="num text-muted">{i + 1}</Td>
              <Td>{l.content}</Td>
              <Td className={l.costGroup === 'tinh' ? '' : 'text-muted'}>{COST_GROUP[l.costGroup]}</Td>
              <Td right>{money(l.estimate)}</Td>
              <Td right>{l.actual === null ? <span className="text-subtle">—</span> : money(l.actual)}</Td>
            </tr>
          ))}
          <tr>
            <Td colSpan={3} className="text-right text-muted">
              Tổng; phần tính vào đèn {money(counted.cost)} đ{counted.provisional ? ' (tạm tính)' : ''}
            </Td>
            <Td right className="font-semibold">
              {money(total)}
            </Td>
            <Td right className="font-semibold">
              {actualTotal === null ? '—' : money(actualTotal)}
            </Td>
          </tr>
        </tbody>
      </Table>

      {est.locked && (
        <Notice
          tone={exception?.status === 'da_mo_khoa' ? 'ok' : exception?.status === 'khong_dong_y' ? 'danger' : 'warn'}
          title={`Phiếu bị khóa (đèn ${LIGHT_META[est.lightAfter].label})`}
        >
          {exception ? (
            <>
              Đề nghị ngoại lệ <span className="num">{exception.code}</span>: {EXCEPTION_STATUS[exception.status]}
              {exception.docNo && `, văn bản ${exception.docNo} ngày ${dateVN(exception.docDate)}`}. Lý do:{' '}
              {exception.reason}
              <div className="mt-2">
                <FormButton source={{ type: 'case', reportId, focus: 'NL' }}>Xem phiếu đề nghị ngoại lệ</FormButton>
              </div>
            </>
          ) : (
            'Chưa có đề nghị ngoại lệ.'
          )}
        </Notice>
      )}
      {est.status === 'can_kiem_tra_lai' && est.returnReason && (
        <Notice tone="warn" title="Lãnh đạo phòng trả lại">
          {est.returnReason}
        </Notice>
      )}
      {est.status === 'khong_dong_y' && est.returnReason && (
        <Notice tone="danger" title="Không đồng ý">
          {est.returnReason}
        </Notice>
      )}
      {est.actualEnteredAt && (
        <p className="text-[13px] text-muted">
          Chứng từ {est.voucherNo} ngày {dateVN(est.voucherDate)}
          {est.voucherTotal !== null && est.voucherTotal !== undefined && `, tổng hóa đơn ${money(est.voucherTotal)} đ`}, nhập
          lúc {dateTimeVN(est.actualEnteredAt)}.
        </p>
      )}

      <details className="text-[13px]">
        <summary className="cursor-pointer text-muted hover:text-ink">Lịch sử phiếu ({est.history.length})</summary>
        <ol className="mt-2 space-y-1 border-l border-rule pl-4">
          {est.history.map((h, i) => (
            <li key={i}>
              <span className="num text-muted">{dateTimeVN(h.at)}</span> {refs.userById(h.by)?.name}: {h.action}
              {h.note && <span className="text-muted">. {h.note}</span>}
            </li>
          ))}
        </ol>
      </details>

      {canAct && (
        <div className="flex flex-wrap justify-end gap-2 border-t border-rule-2 pt-3">
          {est.status === 'can_kiem_tra_lai' && (
            <Button variant="primary" onClick={onResubmit}>
              Sửa và gửi lại
            </Button>
          )}
          {(est.status === 'da_xac_nhan' || est.status === 'da_ky_du') && (
            <FormButton size="md" source={{ type: 'case', reportId, focus: 'DT' }}>
              In phiếu dự toán
            </FormButton>
          )}
          {est.status === 'da_xac_nhan' && (
            <>
              <Button variant="danger" onClick={onReject}>
                Ghi nhận không được ký duyệt
              </Button>
              <Button variant="primary" onClick={onSign}>
                Đính kèm bản đã ký đủ
              </Button>
            </>
          )}
          {est.status === 'da_ky_du' && !est.actualEnteredAt && (
            <>
              {!actualCheck.ok && <span className="self-center text-[13px] text-l-amber">{actualCheck.reason}</span>}
              <Button variant="primary" disabled={!actualCheck.ok} onClick={onActual}>
                Nhập chi phí thực tế
              </Button>
            </>
          )}
          {est.actualEnteredAt && (
            <Button onClick={onCorrect} title="Điều chỉnh khi nhập nhầm; phần mềm ghi người sửa, thời gian và số cũ">
              Sửa chi phí thực tế
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

const SignModal = ({ est, onClose }) => {
  const { user } = useAuth();
  const toast = useToast();
  const [file, setFile] = useState(null);
  return (
    <Modal
      open
      title={`Đính kèm bản đã ký đủ: ${est.code}`}
      onClose={onClose}
      width={560}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button
            variant="primary"
            disabled={!file}
            onClick={async () => {
              await estimatesApi.markSigned(est.id, file, user);
              toast('success', `Dự toán ${est.code} đã ký đủ, có hiệu lực chính thức.`);
              onClose();
            }}
          >
            Xác nhận đã ký đủ
          </Button>
        </>
      }
    >
      <p className="mb-3 text-ink-2">
        Bản in cần đủ chữ ký Lãnh đạo Phòng QTNL, Lãnh đạo Phòng KHTC và Ban Giám hiệu. Không dùng chữ ký điện tử.
      </p>
      <FilePick value={file} onChange={setFile} />
    </Modal>
  );
};

const RejectModal = ({ est, onClose }) => {
  const { user } = useAuth();
  const toast = useToast();
  const [reason, setReason] = useState('');
  return (
    <Modal
      open
      title={`Không được ký duyệt: ${est.code}`}
      onClose={onClose}
      width={560}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button
            variant="danger"
            disabled={!reason.trim()}
            onClick={async () => {
              await estimatesApi.markRejected(est.id, reason.trim(), user);
              toast('info', `Đã ghi nhận ${est.code} không được đồng ý. Phiếu không tính vào số lần sửa và chi phí.`);
              onClose();
            }}
          >
            Ghi nhận không đồng ý
          </Button>
        </>
      }
    >
      <Field label="Lý do (ngắn)" required>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ví dụ: Ban Giám hiệu đề nghị thay mới thay vì sửa"
        />
      </Field>
    </Modal>
  );
};

/** Nhập chi phí thực tế (mode 'enter') hoặc sửa khi nhập nhầm (mode 'correct', mục IV, 5.5 đề tài).
 * Hóa đơn gộp nhiều mã tài sản: chia chi phí cho từng mã; tổng các mã cùng số hóa đơn không vượt tổng hóa đơn. */
const ActualModal = ({ est, mode = 'enter', onClose }) => {
  const toast = useToast();
  const correcting = mode === 'correct';
  const { data: all } = useApi(() => estimatesApi.list(), []);
  const [vals, setVals] = useState(() =>
    Object.fromEntries(est.lines.map((l) => [l.id, correcting && l.actual !== null ? l.actual : l.estimate])),
  );
  const [voucherNo, setVoucherNo] = useState(correcting ? est.voucherNo || '' : '');
  const [voucherDate, setVoucherDate] = useState(correcting && est.voucherDate ? est.voucherDate : TODAY);
  const [voucherTotal, setVoucherTotal] = useState(correcting ? est.voucherTotal ?? null : null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const total = Object.values(vals).reduce((s, v) => s + v, 0);
  const estTotal = est.lines.reduce((s, l) => s + l.estimate, 0);

  // Các phiếu khác đã nhập cùng số hóa đơn
  const key = voucherKey(voucherNo);
  const same = key
    ? (all || []).filter((e) => e.id !== est.id && e.actualEnteredAt && voucherKey(e.voucherNo) === key)
    : [];
  const sameSum = same.reduce((s, e) => s + e.lines.reduce((t, l) => t + (l.actual ?? 0), 0), 0);
  const knownTotal = same.find((e) => e.voucherTotal !== null && e.voucherTotal !== undefined)?.voucherTotal ?? null;
  const invoice = voucherTotal || knownTotal;
  const over = invoice ? sameSum + total - invoice : 0;

  const save = async () => {
    setBusy(true);
    try {
      if (correcting) {
        await estimatesApi.correctActual(est.id, vals, voucherNo.trim(), voucherDate, voucherTotal || null, note.trim());
        toast('success', `Đã sửa chi phí thực tế ${est.code}. Đèn đã tính lại, lịch sử phiếu ghi số cũ và số mới.`);
      } else {
        await estimatesApi.enterActual(est.id, vals, voucherNo.trim(), voucherDate, voucherTotal || null);
        toast('success', `Đã nhập chi phí thực tế ${est.code}. Đèn đã tính lại, phiếu báo hỏng hoàn thành.`);
      }
      onClose();
    } catch (e) {
      toast('error', e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      title={`${correcting ? 'Sửa chi phí thực tế' : 'Chi phí thực tế'}: ${est.code}`}
      onClose={onClose}
      width={680}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="primary" disabled={!voucherNo.trim() || over > 0 || busy} onClick={save}>
            {correcting ? 'Lưu chi phí đã sửa' : 'Lưu chi phí thực tế'}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-ink-2">
        {correcting
          ? 'Điều chỉnh khi nhập nhầm. Phần mềm ghi người sửa, thời gian sửa, số cũ và số mới vào lịch sử phiếu; đèn tự tính lại.'
          : 'Nhập theo hóa đơn, chứng từ; số thực tế thay cho số dự toán. Hóa đơn gộp nhiều tài sản thì chia chi phí cho từng mã.'}
      </p>
      <Table className="mb-4 rounded-md border border-rule-2">
        <thead>
          <tr>
            <Th>Nội dung</Th>
            <Th right>Dự toán (đ)</Th>
            <Th right>Thực tế (đ)</Th>
          </tr>
        </thead>
        <tbody>
          {est.lines.map((l) => (
            <tr key={l.id}>
              <Td>{l.content}</Td>
              <Td right>{money(l.estimate)}</Td>
              <Td className="w-[170px]">
                <MoneyInput value={vals[l.id]} onChange={(n) => setVals({ ...vals, [l.id]: n })} />
              </Td>
            </tr>
          ))}
          <tr>
            <Td className="font-semibold">Tổng</Td>
            <Td right>{money(estTotal)}</Td>
            <Td right className="font-semibold">
              {money(total)}
            </Td>
          </tr>
        </tbody>
      </Table>
      {total > estTotal && (
        <Notice tone="warn" className="mb-3">
          Chi phí thực tế vượt dự toán đã duyệt {money(total - estTotal)} đ. Ngưỡng phải ký bổ sung do Phòng KHTC đặt
          sau.
        </Notice>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Số hóa đơn, chứng từ" required>
          <Input value={voucherNo} onChange={(e) => setVoucherNo(e.target.value)} placeholder="Ví dụ HĐ 0012345" />
        </Field>
        <Field label="Ngày chứng từ">
          <Input type="date" value={voucherDate} onChange={(e) => setVoucherDate(e.target.value)} />
        </Field>
        <Field label="Tổng tiền hóa đơn (đ)" hint="Điền khi một hóa đơn gộp nhiều mã tài sản">
          <MoneyInput
            value={voucherTotal ?? knownTotal}
            onChange={(n) => setVoucherTotal(n || null)}
            label="Tổng tiền hóa đơn"
          />
        </Field>
      </div>
      {same.length > 0 && (
        <Notice tone={over > 0 ? 'danger' : 'info'} className="mt-3" title={`Hóa đơn này đã nhập cho ${same.length} mã khác`}>
          {same.map((e) => refs.assetById(e.assetId)?.code || e.code).join(', ')}: {money(sameSum)} đ. Cộng phiếu này{' '}
          {money(sameSum + total)} đ
          {invoice
            ? over > 0
              ? `, vượt tổng hóa đơn ${money(invoice)} đ là ${money(over)} đ.`
              : `/ ${money(invoice)} đ${over < 0 ? `, còn ${money(-over)} đ chưa chia cho mã nào` : ', khớp tổng hóa đơn'}.`
            : '.'}
        </Notice>
      )}
      {!same.length && invoice > 0 && over > 0 && (
        <Notice tone="danger" className="mt-3">
          Chi phí phiếu này vượt tổng hóa đơn {money(invoice)} đ là {money(over)} đ.
        </Notice>
      )}
      {correcting && (
        <Field label="Lý do sửa" className="mt-4">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ví dụ: nhập nhầm đơn giá" />
        </Field>
      )}
    </Modal>
  );
};

/** Gộp phiếu trùng cùng một sự cố vào phiếu chính: chỉ phiếu chính lập biên bản, dự toán (mục 5.3 đề tài). */
const MergeModal = ({ report, onClose }) => {
  const toast = useToast();
  const { data: cands } = useApi(() => reportsApi.mergeCandidates(report.id), [report.id]);
  const [mainId, setMainId] = useState('');
  const [busy, setBusy] = useState(false);
  const main = (cands || []).find((x) => x.id === mainId);
  return (
    <Modal
      open
      title={`Gộp phiếu trùng: ${report.code}`}
      onClose={onClose}
      width={680}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button
            variant="primary"
            disabled={!mainId || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await reportsApi.merge(report.id, mainId);
                toast('success', `Đã gộp ${report.code} vào ${main.code}. Người báo được thông báo.`);
                onClose();
              } catch (e) {
                toast('error', e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Gộp vào phiếu đã chọn
          </Button>
        </>
      }
    >
      <p className="mb-3 text-ink-2">
        Các phiếu báo cùng một sự cố được gộp thành một lần: phiếu chính lập biên bản, dự toán; phiếu này theo trạng thái
        phiếu chính, không tính thêm lần sửa chữa. Người báo nhận thông báo khi gộp và khi phiếu chính xong.
      </p>
      {!cands ? (
        <p className="text-muted">Đang tải…</p>
      ) : cands.length === 0 ? (
        <Notice title="Không có phiếu nào để gộp">
          Chỉ gộp vào phiếu chưa xong của cùng tài sản (phiếu chưa có mã tài sản thì cùng vị trí).
        </Notice>
      ) : (
        <div className="space-y-2">
          {cands.map((x) => (
            <label
              key={x.id}
              className={cx(
                'flex cursor-pointer gap-3 rounded-md border p-3',
                mainId === x.id ? 'border-accent bg-accent-soft' : 'border-rule hover:bg-sunken',
              )}
            >
              <input
                type="radio"
                name="merge-main"
                className="mt-1"
                checked={mainId === x.id}
                onChange={() => setMainId(x.id)}
              />
              <span className="min-w-0">
                <span className="num font-medium">{x.code}</span>{' '}
                <span className="text-muted">
                  {dateTimeVN(x.createdAt)}, {x.reporterName}, {REPORT_STATUS[x.status]}
                </span>
                <span className="block text-ink-2">
                  {x.assetName}, {x.location}: {x.content}
                </span>
              </span>
            </label>
          ))}
        </div>
      )}
    </Modal>
  );
};

// ---------------------------------------------------------------- Kho không có thiết bị thay thế
const NO_SPARE_REASONS = [
  'Kho không có thiết bị cùng loại',
  'Thiết bị dự phòng đang cho mượn hết',
  'Thiết bị trong kho không đủ công suất, cấu hình',
  'Thiết bị dự phòng đang hỏng',
];

const NoSpareModal = ({ report, asset, onClose }) => {
  const { user } = useAuth();
  const toast = useToast();
  const [need, setNeed] = useState(asset ? asset.groupName : report.assetName); // theo nhóm để cộng dồn khi lập kế hoạch mua sắm
  const [reason, setReason] = useState('');
  const save = async () => {
    await noSpareApi.create({ reportId: report.id, need: need.trim(), reason: reason.trim() }, user);
    toast('success', 'Đã ghi nhận kho không có thiết bị thay thế. Phòng KHTC thấy trong dữ liệu kế hoạch mua sắm.');
    onClose();
  };
  return (
    <Modal
      open
      title="Kho không có thiết bị thay thế"
      onClose={onClose}
      width={620}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="primary" disabled={!need.trim() || !reason.trim()} onClick={save}>
            Ghi nhận
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {report.situation && <Notice title="Tình huống đang xảy ra">{report.situation}</Notice>}
        <Field label="Thiết bị cần cấp tạm" required hint="Loại thiết bị cần để thay thế, ví dụ điều hòa di động, máy chiếu.">
          <Input value={need} onChange={(e) => setNeed(e.target.value)} />
        </Field>
        <Field label="Lý do" required>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Chọn bên dưới hoặc gõ ngắn" />
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {NO_SPARE_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={cx(
                  'rounded-full border px-2.5 py-[3px] text-[12.5px]',
                  reason === r ? 'border-accent bg-accent-soft font-medium text-accent' : 'border-rule text-ink-2 hover:bg-sunken',
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </Field>
        <p className="text-[12.5px] text-muted">
          Ghi nhận này làm dữ liệu cho kế hoạch mua sắm thiết bị dự phòng; vẫn cấp thiết bị tạm được khi kho có lại.
        </p>
      </div>
    </Modal>
  );
};

// ---------------------------------------------------------------- Thu hồi tài sản hỏng về kho
const RECALL_STEPS = [
  'Phòng QTNL đề nghị thu hồi tài sản hỏng',
  'Phòng KHTC xác nhận',
  'Kỹ thuật viên lập biên bản giao nhận, ký, nộp Phòng KHTC',
  'Phòng KHTC nhập điều chuyển chính thức, vị trí về kho',
  'Đã thu hồi tài sản hỏng về kho, chờ phương án xử lý',
];

const RECALL_STAGE = { cho_khtc: 1, da_xac_nhan: 2, da_giao_nhan: 3, hoan_thanh: 5, khong_dong_y: 1 };

const RecallView = ({
  recall,
  handover,
  check,
  activeTemp,
  canPropose,
  canHandover,
  isKhtc,
  onPropose,
  onHandover,
  onDecide,
  onComplete,
}) => {
  const tempNote = activeTemp && (
    <p className="text-[13px] text-muted">
      Thiết bị tạm theo phiếu <span className="num">{activeTemp.code}</span> vẫn dùng ở đơn vị, thuộc Kho QTNL trên sổ;
      giữ đến khi đơn vị có thiết bị mới.
    </p>
  );
  const name = (id) => refs.userById(id)?.name ?? '—';
  if (!recall || recall.status === 'khong_dong_y') {
    return (
      <div className="space-y-3">
        {recall && (
          <Notice tone="danger" title={`Phòng KHTC không đồng ý đề nghị ${recall.code}`}>
            {recall.rejectReason}
          </Notice>
        )}
        <Notice tone="warn" title="Thuộc trường hợp thu hồi tài sản hỏng về kho">
          {check.note}. Đề nghị được ngay, song song với việc cấp thiết bị tạm, không cần chờ. Trong lúc chờ, tài sản hỏng
          giữ nguyên vị trí, đơn vị trên sổ; sổ chỉ đổi khi Phòng KHTC nhập điều chuyển chính thức.
        </Notice>
        {tempNote}
        {canPropose && check.ok && (
          <div className="flex justify-end">
            <Button variant="primary" onClick={onPropose}>
              Đề nghị thu hồi tài sản hỏng về kho
            </Button>
          </div>
        )}
      </div>
    );
  }
  const stage = RECALL_STAGE[recall.status];
  const when = [
    `${name(recall.proposedBy)}, ${dateTimeVN(recall.proposedAt)}`,
    recall.decidedAt ? `${name(recall.decidedBy)}, ${dateTimeVN(recall.decidedAt)}` : '',
    handover ? `Biên bản ${handover.code}, ${dateVN(handover.date)}` : '',
    recall.completedAt
      ? `${recall.transferNo ? `Văn bản ${recall.transferNo}, ` : ''}${dateVN(recall.transferDate)}`
      : '',
    recall.completedAt ? `Vị trí ${handover ? handover.place : recall.toLocation}; đèn giữ nguyên, không tính Vàng 3.1` : '',
  ];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
        <Pill tone={recall.status === 'hoan_thanh' ? 'green' : 'blue'}>{RECALL_STATUS[recall.status]}</Pill>
        <span>
          Căn cứ: {recall.basisNote}. Phương án: {RECALL_PLAN[recall.plan]}
          {recall.note ? `. ${recall.note}` : ''}
        </span>
      </div>
      <ol className="space-y-1.5">
        {RECALL_STEPS.map((t, i) => {
          const done = i < stage;
          const current = i === stage && recall.status !== 'hoan_thanh';
          return (
            <li key={t} className="flex items-start gap-2.5">
              <span
                className={cx(
                  'num mt-[1px] inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                  done ? 'bg-accent text-white' : current ? 'border border-accent text-accent' : 'border border-rule text-subtle',
                )}
              >
                {i + 1}
              </span>
              <span className={cx('text-[13.5px]', done ? 'text-ink' : current ? 'font-medium text-ink' : 'text-subtle')}>
                {t}
                {done && when[i] && <span className="block text-[12.5px] text-muted">{when[i]}</span>}
              </span>
            </li>
          );
        })}
      </ol>
      {recall.status === 'da_xac_nhan' && canHandover && (
        <div className="flex justify-end">
          <Button variant="primary" onClick={onHandover}>
            Lập biên bản giao nhận
          </Button>
        </div>
      )}
      {recall.status === 'da_giao_nhan' && (
        <p className="text-[13px] text-muted">
          In biên bản {handover?.code}, ký rồi nộp Phòng KHTC. Phòng KHTC nhập điều chuyển chính thức thì tài sản chuyển
          về kho.
        </p>
      )}
      {recall.status !== 'hoan_thanh' && tempNote}
      {isKhtc && recall.status === 'cho_khtc' && (
        <div className="flex justify-end">
          <Button variant="primary" onClick={onDecide}>
            Xem và xác nhận
          </Button>
        </div>
      )}
      {isKhtc && recall.status === 'da_giao_nhan' && (
        <div className="flex justify-end">
          <Button variant="primary" onClick={onComplete}>
            Nhập điều chuyển chính thức
          </Button>
        </div>
      )}
    </div>
  );
};

const RecallModal = ({ report, asset, check, onClose }) => {
  const { user } = useAuth();
  const toast = useToast();
  const [plan, setPlan] = useState('cho_thanh_ly');
  const [toLocation, setToLocation] = useState('KHO.TB');
  const [note, setNote] = useState('');
  const save = async () => {
    const rec = await recallsApi.propose({ reportId: report.id, plan, toLocation: toLocation.trim(), note: note.trim() }, user);
    toast('success', `Đã gửi đề nghị thu hồi tài sản hỏng ${rec.code}, chờ Phòng KHTC xác nhận.`);
    onClose();
  };
  return (
    <Modal
      open
      title={`Đề nghị thu hồi tài sản hỏng về kho: ${asset.name}`}
      onClose={onClose}
      width={620}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="primary" disabled={!toLocation.trim()} onClick={save}>
            Gửi đề nghị
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <KV
          cols={1}
          items={[
            ['Tài sản', `${asset.name} (${asset.code})`],
            ['Đơn vị, vị trí hiện tại', `${asset.unit}, ${asset.location}`],
            ['Căn cứ', check.note],
          ]}
        />
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium text-ink-2">Phương án xử lý dự kiến</legend>
          <div className="flex flex-wrap gap-5">
            {Object.keys(RECALL_PLAN).map((k) => (
              <Radio key={k} name="plan" value={k} current={plan} onChange={setPlan} label={RECALL_PLAN[k]} />
            ))}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kho nhận" required>
            <Input value={toLocation} onChange={(e) => setToLocation(e.target.value)} />
          </Field>
          <Field label="Ghi chú">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ví dụ: hãng ngừng linh kiện" />
          </Field>
        </div>
      </div>
    </Modal>
  );
};

const RecallHandoverModal = ({ recall, report, asset, onClose }) => {
  const { user } = useAuth();
  const toast = useToast();
  const [date, setDate] = useState(TODAY);
  const [givers, setGivers] = useState([
    { name: report.source === 'qtnl' ? '' : report.reporterName, unit: asset.unit },
    { name: '', unit: asset.unit },
  ]);
  const [receivers, setReceivers] = useState([
    { name: user.name, unit: user.unit },
    { name: '', unit: user.unit },
  ]);
  const [note, setNote] = useState(RECALL_PLAN[recall.plan]);
  const save = async () => {
    const h = await handoversApi.createForRecall(recall.id, { date, givers, receivers, note: note.trim() }, user);
    toast('success', `Đã lập biên bản giao nhận ${h.code}. In, ký rồi nộp Phòng KHTC.`);
    onClose();
  };
  return (
    <Modal
      open
      title="Biên bản giao nhận tài sản (thu hồi tài sản hỏng về kho)"
      onClose={onClose}
      width={760}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="primary" onClick={save}>
            Lập biên bản
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-ink-2">
          {asset.name} (<span className="num">{asset.code}</span>) từ {asset.unit}, {asset.location} về{' '}
          <span className="font-medium">{recall.toLocation}</span>. Biên bản theo mẫu bàn giao tài sản của Nhà trường.
        </p>
        <PeopleFields title="Đại diện bên giao" people={givers} setPeople={setGivers} />
        <PeopleFields title="Đại diện bên nhận (Phòng QTNL)" people={receivers} setPeople={setReceivers} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Ngày lập">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Ghi chú trên biên bản">
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
      </div>
    </Modal>
  );
};


export default CasePage;
