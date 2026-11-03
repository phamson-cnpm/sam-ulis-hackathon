
// Đề nghị ngoại lệ (mục 5.4): Phòng KHTC mở khóa một lần theo văn bản phê duyệt có đủ chữ ký.
import React, { useMemo, useState } from 'react';
import FormButton from '../components/FormButton';
import { assetsApi, refs, estimatesApi, exceptionsApi } from '../utils/api';
import { useApi } from '../hooks/useApi';
import { countedCost } from '../utils/lights';
import { dateTimeVN, dateVN, money, pct } from '../utils/format';
import { ESTIMATE_STATUS, EXCEPTION_STATUS } from '../utils/labels';
import { useAuth } from '../utils/AuthContext';
import { useToast } from '../utils/ToastContext';
import { TODAY } from '../config/app';
import {
  Button,
  Empty,
  Field,
  FileLink,
  FilePick,
  Input,
  KV,
  Modal,
  Notice,
  PageHeader,
  Pill,
  Radio,
  Table,
  Tabs,
  Td,
  Textarea,
  Th,
  WaitDays,
} from '../components/ui';
import { LightBadge } from '../components/Light';
import { Pager, usePaged } from '../components/Pager';

const ExceptionsPage = ({ onNavigate }) => {
  const { data: list } = useApi(() => exceptionsApi.list(), []);
  const { data: estimates } = useApi(() => estimatesApi.list(), []);
  const [tab, setTab] = useState('cho');
  const [open, setOpen] = useState(null);

  // Chờ mở khóa: phiếu có tình huống gấp lên đầu (mục 5.4 đề tài), rồi phiếu chờ lâu nhất
  const rows = useMemo(
    () =>
      (list || [])
        .filter((x) => (tab === 'cho' ? x.status === 'cho_mo_khoa' : x.status !== 'cho_mo_khoa'))
        .sort((p, q) =>
          tab === 'cho' ? Number(!!q.urgent) - Number(!!p.urgent) || p.createdAt.localeCompare(q.createdAt) : 0,
        ),
    [list, tab],
  );
  const pending = (list || []).filter((x) => x.status === 'cho_mo_khoa').length;
  const pager = usePaged(rows, tab);

  return (
    <div>
      <PageHeader
        title="Đề nghị ngoại lệ"
        description="Tài sản ở đèn Đỏ 1.1 hoặc Cam bị khóa phiếu dự toán. Chỉ mở khóa khi dự toán và đề nghị ngoại lệ đã có đủ chữ ký; mỗi lần mở khóa áp dụng cho đúng một phiếu."
      />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'cho', label: 'Chờ mở khóa', count: pending },
          { id: 'xong', label: 'Đã xử lý', count: (list || []).length - pending },
        ]}
      />
      <div className="rounded-[3px] border border-rule bg-surface">
        {rows.length === 0 ? (
          <Empty title={tab === 'cho' ? 'Không có đề nghị nào đang chờ.' : 'Chưa có đề nghị nào được xử lý.'} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Số phiếu</Th>
                <Th>Tài sản</Th>
                <Th>Dự toán</Th>
                <Th>Lý do cấp thiết</Th>
                <Th>Đèn</Th>
                <Th>Trạng thái</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {pager.pageRows.map((x) => {
                const a = refs.assetById(x.assetId);
                const e = (estimates || []).find((y) => y.id === x.estimateId);
                return (
                  <tr key={x.id} className="hover:bg-sunken">
                    <Td className="num font-medium whitespace-nowrap">
                      {x.code}
                      <div className="text-[12px] font-normal text-muted">{dateVN(x.createdAt)}</div>
                      {x.status === 'cho_mo_khoa' && <WaitDays since={x.createdAt} className="font-normal" />}
                      {x.urgent && (
                        <div className="mt-0.5">
                          <Pill tone="red">Khẩn cấp</Pill>
                        </div>
                      )}
                    </Td>
                    <Td className="min-w-[200px]">
                      {a?.name}
                      <div className="num text-[12.5px] text-muted">
                        {a?.code}, {a?.unit}
                      </div>
                    </Td>
                    <Td className="whitespace-nowrap">
                      <span className="num">{e?.code}</span>
                      <div className="text-[12.5px] text-muted">{e ? ESTIMATE_STATUS[e.status] : ''}</div>
                    </Td>
                    <Td className="min-w-[240px] text-ink-2">{x.reason}</Td>
                    <Td>{e && <LightBadge code={e.lightAfter} size="sm" />}</Td>
                    <Td>
                      <Pill tone={x.status === 'cho_mo_khoa' ? 'amber' : x.status === 'da_mo_khoa' ? 'green' : 'red'}>
                        {EXCEPTION_STATUS[x.status]}
                      </Pill>
                      {x.docNo && <div className="num mt-0.5 text-[12px] text-muted">{x.docNo}</div>}
                    </Td>
                    <Td right>
                      <div className="flex items-center justify-end gap-2">
                        {e?.reportId && (
                          <FormButton source={{ type: 'case', reportId: e.reportId, focus: 'NL' }}>Biểu mẫu</FormButton>
                        )}
                        <Button
                          size="sm"
                          variant={x.status === 'cho_mo_khoa' ? 'primary' : 'secondary'}
                          onClick={() => setOpen(x)}
                        >
                          {x.status === 'cho_mo_khoa' ? 'Xem và mở khóa' : 'Xem hồ sơ'}
                        </Button>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
        <Pager pager={pager} />
      </div>
      {open && <ExceptionModal x={open} onClose={() => setOpen(null)} />}
    </div>
  );
};

/** Hồ sơ trình ký một trang + phần mở khóa của Phòng KHTC. */
export const ExceptionModal = ({ x, onClose }) => {
  const { user } = useAuth();
  const toast = useToast();
  const { data: a } = useApi(() => assetsApi.get(x.assetId), [x.assetId]);
  const { data: h } = useApi(() => assetsApi.history(x.assetId), [x.assetId]);
  const est = h?.estimates.find((e) => e.id === x.estimateId);
  const [approve, setApprove] = useState('yes');
  const [docNo, setDocNo] = useState('');
  const [docDate, setDocDate] = useState(TODAY);
  const APPROVE_TEXT = 'Đồng ý sửa chữa một lần trong hạn mức dự toán đã duyệt.';
  const [conclusion, setConclusion] = useState(APPROVE_TEXT);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const report = est?.reportId ? h?.reports.find((r) => r.id === est.reportId) : null;

  const canDecide = user.role === 'khtc' && x.status === 'cho_mo_khoa';
  const signed = est?.status === 'da_ky_du';
  const submit = async () => {
    if (!docNo.trim() || !file) return toast('error', 'Nhập số văn bản và đính kèm bản quét có đủ chữ ký.');
    if (approve === 'no' && !conclusion.trim()) return toast('error', 'Nhập lý do không đồng ý.');
    setBusy(true);
    try {
      await exceptionsApi.decide(x.id, user, approve === 'yes', docNo.trim(), docDate, conclusion.trim(), file);
      toast(
        'success',
        approve === 'yes'
          ? `Đã mở khóa ${est?.code} theo văn bản ${docNo}.`
          : `Đã ghi nhận không đồng ý cho ${x.code}.`,
      );
      onClose();
    } catch (e) {
      toast('error', e.message);
    } finally {
      setBusy(false);
    }
  };

  const yearEst = (h?.estimates || [])
    .filter((e) => e.createdAt.startsWith(TODAY.slice(0, 4)) && e.status !== 'khong_dong_y')
    .sort((p, q) => p.createdAt.localeCompare(q.createdAt));

  return (
    <Modal
      open
      title={`Đề nghị ngoại lệ ${x.code}`}
      onClose={onClose}
      width={820}
      footer={
        canDecide ? (
          <>
            {est?.reportId && (
              <FormButton size="md" className="mr-auto" source={{ type: 'case', reportId: est.reportId, focus: 'NL' }}>
                Xem phiếu đề nghị
              </FormButton>
            )}
            <Button onClick={onClose}>Đóng</Button>
            <Button variant="primary" disabled={busy || !signed} onClick={submit}>
              {approve === 'yes' ? 'Mở khóa phiếu' : 'Ghi nhận không đồng ý'}
            </Button>
          </>
        ) : (
          <>
            {est?.reportId && (
              <FormButton size="md" className="mr-auto" source={{ type: 'case', reportId: est.reportId, focus: 'NL' }}>
                Xem phiếu đề nghị
              </FormButton>
            )}
            <Button onClick={onClose}>Đóng</Button>
          </>
        )
      }
    >
      {!a || !est ? (
        <p className="text-muted">Đang tải…</p>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="num text-[13px] font-semibold text-accent">{a.code}</p>
              <p className="text-[16px] font-semibold">{a.name}</p>
              <p className="text-muted">
                {a.unit}, {a.location}
              </p>
            </div>
            <LightBadge code={a.light.code} size="md" />
          </div>
          <KV
            items={[
              ['Nguyên giá', <span className="num">{money(a.originalCost)} đ</span>],
              ['Giá trị còn lại', <span className="num">{money(a.residualValue)} đ</span>],
              ['Tình huống đang xảy ra', report?.situation || '—'],
              ['Lý do cấp thiết', x.reason],
              ['Thời gian dự kiến dùng thêm', x.extraTime],
              ['Thiết bị thay thế tạm', x.tempEquipment || 'Không có'],
              ['Người đề nghị', refs.userById(x.createdBy)?.name],
            ]}
          />
          <div>
            <p className="mb-2 font-semibold">Các lần sửa chữa trong năm</p>
            <Table className="rounded-md border border-rule-2">
              <thead>
                <tr>
                  <Th>Ngày lập</Th>
                  <Th>Số phiếu</Th>
                  <Th>Nội dung</Th>
                  <Th right>Chi phí tính vào đèn (đ)</Th>
                </tr>
              </thead>
              <tbody>
                {yearEst.map((e) => {
                  const c = countedCost(e.lines);
                  return (
                    <tr key={e.id} className={e.id === est.id ? 'bg-l-amber-soft/50' : ''}>
                      <Td className="num">{dateVN(e.createdAt)}</Td>
                      <Td className="num">{e.code}</Td>
                      <Td>
                        {e.lines
                          .filter((l) => l.costGroup === 'tinh')
                          .map((l) => l.content)
                          .join('; ')}
                        {e.id === est.id && <span className="text-muted"> (lần này, dự toán)</span>}
                      </Td>
                      <Td right>{money(c.cost)}</Td>
                    </tr>
                  );
                })}
                <tr>
                  <Td colSpan={3} className="font-semibold">
                    Lũy kế trong năm, gồm lần này
                  </Td>
                  <Td right className="font-semibold">
                    {money(a.light.yearCost)} ({pct(a.light.yearRatio)})
                  </Td>
                </tr>
              </tbody>
            </Table>
          </div>

          {x.status !== 'cho_mo_khoa' ? (
            <Notice tone={x.status === 'da_mo_khoa' ? 'ok' : 'danger'} title={EXCEPTION_STATUS[x.status]}>
              Văn bản {x.docNo} ngày {dateVN(x.docDate)}: {x.status === 'khong_dong_y' ? 'Lý do không đồng ý: ' : ''}{x.conclusion}. Ghi nhận lúc {dateTimeVN(x.decidedAt)} bởi{' '}
              {refs.userById(x.decidedBy)?.name}.
              {x.scanFile && (
                <span className="mt-1 block">
                  Bản quét: <FileLink id={x.scanFileId} name={x.scanFile} />
                </span>
              )}
            </Notice>
          ) : canDecide ? (
            <div className="rounded-md border border-rule p-4">
              <p className="mb-3 font-semibold">Kết quả phê duyệt</p>
              {!signed && (
                <Notice tone="warn" className="mb-3" title="Dự toán chưa có đủ chữ ký">
                  Dự toán {est.code} đang ở trạng thái “{ESTIMATE_STATUS[est.status]}”. Kỹ thuật viên cần đính kèm bản
                  đã ký đủ trước khi mở khóa.
                </Notice>
              )}
              <div className="mb-3 flex flex-wrap gap-5">
                <Radio
                  name="ap"
                  value="yes"
                  current={approve}
                  onChange={setApprove}
                  label="Đồng ý, mở khóa phiếu này"
                />
                <Radio
                  name="ap"
                  value="no"
                  current={approve}
                  onChange={(v) => {
                    setApprove(v);
                    if (conclusion === APPROVE_TEXT) setConclusion('');
                  }}
                  label="Không đồng ý"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Số văn bản" required>
                  <Input value={docNo} onChange={(e) => setDocNo(e.target.value)} placeholder="Ví dụ 412/ĐHNN-KHTC" />
                </Field>
                <Field label="Ngày văn bản" required>
                  <Input type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} />
                </Field>
                {approve === 'no' ? (
                  <Field
                    label="Lý do không đồng ý"
                    required
                    hint="Bắt buộc khi không đồng ý. Lý do hiện trên phiếu và gửi kèm thông báo cho kỹ thuật viên."
                    className="sm:col-span-2"
                  >
                    <Textarea value={conclusion} onChange={(e) => setConclusion(e.target.value)} />
                  </Field>
                ) : (
                  <Field label="Kết luận" className="sm:col-span-2">
                    <Textarea value={conclusion} onChange={(e) => setConclusion(e.target.value)} />
                  </Field>
                )}
                <Field label="Bản quét có đủ chữ ký" required className="sm:col-span-2">
                  <FilePick value={file} onChange={setFile} />
                </Field>
              </div>
            </div>
          ) : (
            <Notice title="Đang chờ Phòng KHTC mở khóa" />
          )}
        </div>
      )}
    </Modal>
  );
};

export default ExceptionsPage;
