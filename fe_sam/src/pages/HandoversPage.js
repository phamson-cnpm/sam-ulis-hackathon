
// Thu hồi tài sản hỏng về kho (khác với thu hồi thiết bị tạm khi tài sản gốc sửa xong).
// Phòng KHTC: xác nhận đề nghị, nhập điều chuyển chính thức theo biên bản giao nhận do kỹ thuật viên lập.
// Mở rộng (ngoài ba vấn đề chính của đề tài): Phòng KHTC lập biên bản bàn giao khi cấp phát, điều chuyển chính thức.
// Phòng QTNL: theo dõi các đề nghị mình gửi.
import React, { useMemo, useState } from 'react';
import { ArrowLeftRight, Plus, Trash2 } from 'lucide-react';
import { assetsApi, catalogApi, refs, handoversApi, recallsApi } from '../utils/api';
import { useApi } from '../hooks/useApi';
import { dateTimeVN, dateVN } from '../utils/format';
import { ASSET_STATUS, HANDOVER_KIND, RECALL_PLAN, RECALL_STATUS } from '../utils/labels';
import { useAuth } from '../utils/AuthContext';
import { useToast } from '../utils/ToastContext';
import { TODAY } from '../config/app';
import {
  Button,
  Empty,
  Field,
  FilePick,
  Input,
  Modal,
  Notice,
  PageHeader,
  Pill,
  Radio,
  Select,
  Table,
  Tabs,
  Td,
  Textarea,
  Th,
} from '../components/ui';
import { LightBadge } from '../components/Light';
import { AssetPicker } from '../components/AssetPicker';
import FormButton from '../components/FormButton';
import PeopleFields from '../components/PeopleFields';
import { Pager, usePaged } from '../components/Pager';

const QTNL = 'Phòng Quản trị nguồn lực';
const toneOf = (s) => (s === 'hoan_thanh' ? 'green' : s === 'khong_dong_y' ? 'red' : s === 'cho_khtc' ? 'amber' : 'blue');

const HandoversPage = ({ onNavigate }) => {
  const { user } = useAuth();
  const isKhtc = user.role === 'khtc';
  const { data: recalls } = useApi(() => recallsApi.list(), []);
  const { data: handovers } = useApi(() => handoversApi.list(), []);
  const [tab, setTab] = useState('thu_hoi');
  const [decide, setDecide] = useState(null);
  const [complete, setComplete] = useState(null);
  const [attach, setAttach] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);

  const pending = recalls ? recallsApi.pending() : [];
  const waiting = (recalls || []).filter((r) => (isKhtc ? ['cho_khtc', 'da_giao_nhan'] : ['da_xac_nhan']).includes(r.status));
  const name = (id) => refs.userById(id)?.name ?? '—';
  const asset = (id) => refs.assetById(id);
  const hById = (id) => (handovers || []).find((h) => h.id === id);
  const recallPager = usePaged(recalls);
  const handoverPager = usePaged(handovers);

  return (
    <div>
      <PageHeader
        title="Thu hồi tài sản hỏng về kho"
        description={
          isKhtc
            ? 'Xác nhận đề nghị thu hồi tài sản hỏng của Phòng QTNL; nhập điều chuyển chính thức theo biên bản giao nhận kỹ thuật viên đã lập, ký và nộp. Sổ tài sản chỉ đổi đơn vị, vị trí khi Phòng KHTC nhập điều chuyển.'
            : 'Tài sản hư hỏng toàn phần đã xác nhận hoặc không được duyệt chi phí sửa: đề nghị thu hồi về kho ngay, chạy song song với việc cấp thiết bị tạm. Khi Phòng KHTC xác nhận, mở hồ sơ để lập biên bản giao nhận.'
        }
      />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'thu_hoi', label: 'Đề nghị thu hồi tài sản hỏng', count: waiting.length + (isKhtc ? 0 : pending.length) },
          { id: 'bien_ban', label: 'Biên bản giao nhận, bàn giao', count: handovers ? handovers.length : 0 },
        ]}
      />

      {tab === 'thu_hoi' && !isKhtc && pending.length > 0 && (
        <Notice tone="warn" title={`${pending.length} tài sản hỏng đủ căn cứ, chưa đề nghị thu hồi về kho`} className="mb-4">
          <ul className="mt-1 space-y-1.5">
            {pending.map(({ report, asset: a, check }) => (
              <li key={report.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {a?.name} <span className="num text-muted">{a?.code}</span>, {a?.unit}. {check.note}.
                </span>
                <Button size="sm" onClick={() => onNavigate('case', { reportId: report.id })}>
                  Mở hồ sơ
                </Button>
              </li>
            ))}
          </ul>
        </Notice>
      )}
      {tab === 'thu_hoi' ? (
        <div className="rounded-[3px] border border-rule bg-surface">
          {recalls && recalls.length === 0 ? (
            <Empty title="Chưa có đề nghị thu hồi tài sản hỏng nào.">
              Phòng QTNL đề nghị từ hồ sơ phiếu khi tài sản hư hỏng toàn phần hoặc không được duyệt chi phí sửa chữa.
            </Empty>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Đề nghị</Th>
                  <Th>Tài sản</Th>
                  <Th>Căn cứ, phương án</Th>
                  <Th>Người đề nghị</Th>
                  <Th>Trạng thái</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {recallPager.pageRows.map((r) => {
                  const a = asset(r.assetId);
                  const h = r.handoverId ? hById(r.handoverId) : null;
                  return (
                    <tr key={r.id} className="hover:bg-sunken">
                      <Td className="num font-medium whitespace-nowrap">
                        {r.code}
                        <div className="text-[12px] font-normal text-muted">{dateTimeVN(r.proposedAt)}</div>
                      </Td>
                      <Td className="min-w-[190px]">
                        {a?.name}
                        <div className="num text-[12.5px] text-muted">
                          {a?.code}, {a?.unit}
                        </div>
                      </Td>
                      <Td className="min-w-[200px] text-ink-2">
                        {r.basisNote}
                        <div className="text-[12.5px] text-muted">
                          {RECALL_PLAN[r.plan]}, về {r.toLocation}
                        </div>
                      </Td>
                      <Td className="whitespace-nowrap">{name(r.proposedBy)}</Td>
                      <Td className="whitespace-nowrap">
                        <Pill tone={toneOf(r.status)}>{RECALL_STATUS[r.status]}</Pill>
                        {r.status === 'khong_dong_y' && r.rejectReason && (
                          <div className="mt-1 max-w-[220px] text-[12px] whitespace-normal text-muted">{r.rejectReason}</div>
                        )}
                        {r.transferNo && <div className="num mt-0.5 text-[12px] text-muted">{r.transferNo}</div>}
                        {r.status === 'hoan_thanh' && h && !h.scanFile && (
                          <div className="mt-1">
                            <Pill tone="amber">Chưa có bản quét</Pill>
                          </div>
                        )}
                      </Td>
                      <Td right>
                        <div className="flex items-center justify-end gap-2">
                          {h && <FormButton source={{ type: 'handover', handoverId: h.id }}>{h.code}</FormButton>}
                          {r.reportId && (
                            <Button size="sm" onClick={() => onNavigate('case', { reportId: r.reportId })}>
                              Mở hồ sơ
                            </Button>
                          )}
                          {isKhtc && r.status === 'cho_khtc' && (
                            <Button size="sm" variant="primary" onClick={() => setDecide(r)}>
                              Xem và xác nhận
                            </Button>
                          )}
                          {isKhtc && r.status === 'da_giao_nhan' && (
                            <Button size="sm" variant="primary" onClick={() => setComplete(r)}>
                              Nhập điều chuyển
                            </Button>
                          )}
                          {isKhtc && r.status === 'hoan_thanh' && h && (!h.scanFile || !r.transferNo) && (
                            <Button size="sm" onClick={() => setAttach(r)}>
                              Đính kèm chứng từ
                            </Button>
                          )}
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
          <Pager pager={recallPager} />
        </div>
      ) : (
        <div className="rounded-[3px] border border-rule bg-surface">
          {isKhtc && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule-2 px-4 py-3">
              <p className="max-w-[760px] text-[13px] text-muted">
                <Pill tone="neutral" className="mr-1.5">
                  Mở rộng
                </Pill>
                Biên bản bàn giao khi cấp phát, điều chuyển chính thức do Phòng KHTC lập; phần này ngoài ba vấn đề chính
                của đề tài. Biên bản giao nhận khi thu hồi tài sản hỏng do kỹ thuật viên lập từ hồ sơ phiếu.
              </p>
              <Button variant="create" icon={<Plus size={16} />} onClick={() => setCreateOpen(true)}>
                Lập biên bản cấp phát, điều chuyển
              </Button>
            </div>
          )}
          {handovers && handovers.length === 0 ? (
            <Empty title="Chưa có biên bản bàn giao nào." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Số biên bản</Th>
                  <Th>Loại</Th>
                  <Th>Bên giao</Th>
                  <Th>Bên nhận, nơi bố trí</Th>
                  <Th>Tài sản</Th>
                  <Th>Sổ tài sản</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {handoverPager.pageRows.map((h) => (
                  <tr key={h.id} className="hover:bg-sunken">
                    <Td className="num font-medium whitespace-nowrap">
                      {h.code}
                      <div className="text-[12px] font-normal text-muted">{dateVN(h.date)}</div>
                    </Td>
                    <Td className="whitespace-nowrap">{HANDOVER_KIND[h.kind]}</Td>
                    <Td className="min-w-[160px]">{h.giverUnit}</Td>
                    <Td className="min-w-[180px]">
                      {h.receiverUnit}
                      <div className="text-[12.5px] text-muted">{h.place}</div>
                    </Td>
                    <Td className="min-w-[200px]">
                      {h.items.map((it) => {
                        const a = asset(it.assetId);
                        return (
                          <div key={it.assetId}>
                            {a?.name} <span className="num text-[12.5px] text-muted">{a?.code}</span>
                          </div>
                        );
                      })}
                    </Td>
                    <Td className="whitespace-nowrap">
                      {h.applied ? (
                        <Pill tone="green">Đã cập nhật</Pill>
                      ) : (
                        <Pill tone="amber">Chờ nhập điều chuyển</Pill>
                      )}
                      {h.transferNo && <div className="num mt-0.5 text-[12px] text-muted">{h.transferNo}</div>}
                    </Td>
                    <Td right>
                      <FormButton source={{ type: 'handover', handoverId: h.id }}>Xem biên bản</FormButton>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          <Pager pager={handoverPager} />
        </div>
      )}

      {decide && <DecideModal r={decide} onClose={() => setDecide(null)} />}
      {complete && <CompleteModal r={complete} h={hById(complete.handoverId)} onClose={() => setComplete(null)} />}
      {attach && <AttachDocsModal r={attach} h={hById(attach.handoverId)} onClose={() => setAttach(null)} />}
      {createOpen && <CreateHandoverModal onClose={() => setCreateOpen(false)} />}
    </div>
  );
};

// ---------------------------------------------------------------- Bước 2: Phòng KHTC xác nhận đề nghị thu hồi tài sản hỏng
export const DecideModal = ({ r, onClose }) => {
  const { user } = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState('view');
  const [reason, setReason] = useState('');
  const a = refs.assetById(r.assetId);
  const { data: view } = useApi(() => assetsApi.get(r.assetId), [r.assetId]);
  return (
    <Modal
      open
      title={`Đề nghị thu hồi tài sản hỏng ${r.code}`}
      onClose={onClose}
      width={640}
      footer={
        mode === 'view' ? (
          <>
            {r.reportId && (
              <FormButton size="md" className="mr-auto" source={{ type: 'case', reportId: r.reportId }}>
                Hồ sơ phiếu
              </FormButton>
            )}
            <Button onClick={() => setMode('reject')}>Không đồng ý</Button>
            <Button
              variant="primary"
              onClick={async () => {
                await recallsApi.decide(r.id, user, true);
                toast('success', `Đã xác nhận ${r.code}. Kỹ thuật viên được thông báo lập biên bản giao nhận.`);
                onClose();
              }}
            >
              Xác nhận thu hồi về kho
            </Button>
          </>
        ) : (
          <>
            <Button onClick={() => setMode('view')}>Quay lại</Button>
            <Button
              variant="danger"
              disabled={!reason.trim()}
              onClick={async () => {
                await recallsApi.decide(r.id, user, false, reason.trim());
                toast('info', `Đã ghi nhận không đồng ý ${r.code}.`);
                onClose();
              }}
            >
              Không đồng ý
            </Button>
          </>
        )
      }
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold">{a?.name}</p>
            <p className="num text-[13px] text-muted">
              {a?.code}, {a?.unit}, {a?.location}
            </p>
          </div>
          {view && <LightBadge code={view.light.code} />}
        </div>
        <Notice title="Căn cứ">{r.basisNote}</Notice>
        <p className="text-ink-2">
          Phương án dự kiến: <span className="font-medium text-ink">{RECALL_PLAN[r.plan]}</span>. Về{' '}
          <span className="font-medium text-ink">{r.toLocation}</span>.{r.note ? ` ${r.note}.` : ''}
        </p>
        <p className="text-[13px] text-muted">
          Xác nhận xong, kỹ thuật viên lập biên bản giao nhận, ký rồi nộp Phòng KHTC. Trong lúc chờ, tài sản hỏng giữ
          nguyên vị trí, đơn vị trên sổ; thiết bị tạm (nếu có) vẫn thuộc Kho QTNL. Sổ chỉ đổi khi Phòng KHTC nhập điều
          chuyển chính thức.
        </p>
        {mode === 'reject' && (
          <Field label="Lý do không đồng ý" required>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        )}
      </div>
    </Modal>
  );
};

// ---------------------------------------------------------------- Bước 4: nhập điều chuyển chính thức
export const CompleteModal = ({ r, h, onClose }) => {
  const { user } = useAuth();
  const toast = useToast();
  const [no, setNo] = useState('');
  const [date, setDate] = useState(TODAY);
  const [file, setFile] = useState(null);
  const a = refs.assetById(r.assetId);
  return (
    <Modal
      open
      title={`Nhập điều chuyển chính thức: ${r.code}`}
      onClose={onClose}
      width={620}
      footer={
        <>
          {h && (
            <FormButton size="md" className="mr-auto" source={{ type: 'handover', handoverId: h.id }}>
              Xem biên bản {h.code}
            </FormButton>
          )}
          <Button onClick={onClose}>Hủy</Button>
          <Button
            variant="primary"
            onClick={async () => {
              await recallsApi.complete(r.id, user, no.trim(), date, file);
              toast('success', `${a?.name} đã chuyển về ${h?.place}, trạng thái chờ phương án xử lý.`);
              onClose();
            }}
          >
            Nhập điều chuyển, chuyển về kho
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-ink-2">
          {a?.name} (<span className="num">{a?.code}</span>): {a?.unit}, {a?.location} → {QTNL}, {h?.place}. Sau khi
          nhập, tài sản có trạng thái “{ASSET_STATUS.thu_hoi_kho}”, giữ màu đèn, không tính thêm Vàng 3.1. Thiết bị tạm
          đang dùng ở đơn vị (nếu có) giữ nguyên theo phiếu điều chuyển tạm thời đến khi đơn vị có thiết bị mới.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Số văn bản, quyết định điều chuyển" hint="Có thể đính kèm sau">
            <Input value={no} onChange={(e) => setNo(e.target.value)} placeholder="Ví dụ 451/ĐHNN-KHTC" />
          </Field>
          <Field label="Ngày điều chuyển">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <Field label="Bản quét biên bản giao nhận đã ký" hint="Có thể đính kèm sau">
          <FilePick value={file} onChange={setFile} />
        </Field>
      </div>
    </Modal>
  );
};

// ---------------------------------------------------------------- Đính kèm sau: số văn bản, bản quét
const AttachDocsModal = ({ r, h, onClose }) => {
  const { user } = useAuth();
  const toast = useToast();
  const [no, setNo] = useState(r.transferNo || '');
  const [file, setFile] = useState(h?.scanFile || null);
  const changed = (no.trim() && no.trim() !== (r.transferNo || '')) || (file && file !== h?.scanFile);
  return (
    <Modal
      open
      title={`Đính kèm chứng từ: ${r.code}`}
      onClose={onClose}
      width={560}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button
            variant="primary"
            disabled={!changed}
            onClick={async () => {
              await recallsApi.attachDocs(r.id, user, no.trim(), file);
              toast('success', `Đã đính kèm chứng từ cho ${r.code}.`);
              onClose();
            }}
          >
            Lưu
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Số văn bản, quyết định điều chuyển">
          <Input value={no} onChange={(e) => setNo(e.target.value)} placeholder="Ví dụ 451/ĐHNN-KHTC" />
        </Field>
        <Field label="Bản quét biên bản giao nhận đã ký">
          <FilePick value={file} onChange={setFile} />
        </Field>
      </div>
    </Modal>
  );
};

// ---------------------------------------------------------------- Cấp phát, điều chuyển chính thức
const emptyPeople = (unit = '') => [
  { name: '', unit },
  { name: '', unit },
];

const CreateHandoverModal = ({ onClose }) => {
  const { user } = useAuth();
  const toast = useToast();
  const { data: units } = useApi(() => catalogApi.units(), []);
  const [kind, setKind] = useState('cap_phat');
  const [date, setDate] = useState(TODAY);
  const [giverUnit, setGiverUnit] = useState(QTNL);
  const [givers, setGivers] = useState(emptyPeople(QTNL));
  const [receiverUnit, setReceiverUnit] = useState('');
  const [receivers, setReceivers] = useState(emptyPeople());
  const [place, setPlace] = useState('');
  const [items, setItems] = useState([]);
  const [picker, setPicker] = useState(null);
  const [transferNo, setTransferNo] = useState('');
  const [file, setFile] = useState(null);
  const [err, setErr] = useState(null);

  const sameUnit = useMemo(() => {
    const us = [...new Set(items.map((it) => it.asset.unit))];
    return us.length === 1 ? us[0] : null;
  }, [items]);

  const addAsset = (a) => {
    if (!a || items.some((it) => it.asset.id === a.id)) return;
    const next = [...items, { asset: a, uom: 'Cái', qty: 1, note: '' }];
    setItems(next);
    setPicker(null);
    if (kind === 'dieu_chuyen' && next.length === 1) {
      setGiverUnit(a.unit);
      setGivers(emptyPeople(a.unit));
    }
  };

  const save = async () => {
    if (!items.length) return setErr('Chọn ít nhất một tài sản.');
    if (!receiverUnit) return setErr('Chọn đơn vị nhận.');
    if (!place.trim()) return setErr('Nhập nơi bố trí tài sản.');
    if (!givers[0].name.trim() || !receivers[0].name.trim()) return setErr('Nhập ít nhất một người đại diện mỗi bên.');
    try {
      const h = await handoversApi.create(
        {
          kind,
          date,
          giverUnit,
          givers,
          receiverUnit,
          receivers,
          place: place.trim(),
          items: items.map((it) => ({ assetId: it.asset.id, uom: it.uom, qty: it.qty, note: it.note })),
          transferNo: transferNo.trim(),
          scanFile: file,
        },
        user,
      );
      toast('success', `Đã lưu biên bản ${h.code}; sổ tài sản đã cập nhật đơn vị, vị trí.`);
      onClose();
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <Modal
      open
      title="Biên bản bàn giao tài sản (cấp phát, điều chuyển chính thức)"
      onClose={onClose}
      width={860}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="primary" icon={<ArrowLeftRight size={16} />} onClick={save}>
            Lưu và cập nhật sổ tài sản
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-6">
          {['cap_phat', 'dieu_chuyen'].map((k) => (
            <Radio key={k} name="kind" value={k} current={kind} onChange={setKind} label={HANDOVER_KIND[k]} />
          ))}
          <Field label="Ngày lập" className="ml-auto w-[170px]">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>

        <div className="rounded-md border border-rule-2">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule-2 px-3 py-2">
            <p className="text-[13px] font-medium text-ink-2">Tài sản bàn giao</p>
            {picker === null && (
              <Button size="sm" icon={<Plus size={14} />} onClick={() => setPicker('')}>
                Thêm tài sản
              </Button>
            )}
          </div>
          {picker !== null && (
            <div className="border-b border-rule-2 p-3">
              <AssetPicker
                value={null}
                onChange={addAsset}
                showLight
                autoFocus
                exclude={items.map((it) => it.asset.id)}
              />
              <p className="mt-1 text-[12px] text-muted">
                {kind === 'cap_phat' ? 'Cấp phát: gõ “KHO” để xem tài sản đang ở kho.' : 'Điều chuyển: gõ mã tem hoặc phòng.'}
              </p>
            </div>
          )}
          {items.length === 0 ? (
            <p className="px-3 py-3 text-[13px] text-subtle">Chưa chọn tài sản.</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Tài sản</Th>
                  <Th>Đang ở</Th>
                  <Th>Đơn vị tính</Th>
                  <Th>Ghi chú</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={it.asset.id}>
                    <Td className="min-w-[200px]">
                      {it.asset.name}
                      <div className="num text-[12.5px] text-muted">{it.asset.code}</div>
                    </Td>
                    <Td className="text-[13px] text-ink-2">
                      {it.asset.unit}
                      <div className="text-muted">{it.asset.location}</div>
                    </Td>
                    <Td className="w-[90px]">
                      <Input
                        value={it.uom}
                        onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, uom: e.target.value } : x)))}
                      />
                    </Td>
                    <Td>
                      <Input
                        value={it.note}
                        onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))}
                      />
                    </Td>
                    <Td>
                      <button
                        onClick={() => setItems(items.filter((x) => x.asset.id !== it.asset.id))}
                        className="text-subtle hover:text-l-red"
                        aria-label="Bỏ tài sản"
                      >
                        <Trash2 size={15} />
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          {kind === 'dieu_chuyen' && items.length > 1 && !sameUnit && (
            <p className="px-3 pb-2 text-[12.5px] text-l-amber">Các tài sản đang ở nhiều đơn vị khác nhau; nên lập mỗi đơn vị giao một biên bản.</p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Đơn vị giao">
            <Select value={giverUnit} onChange={(e) => setGiverUnit(e.target.value)}>
              {(units || []).map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Đơn vị nhận" required>
            <Select
              value={receiverUnit}
              onChange={(e) => {
                setReceiverUnit(e.target.value);
                setReceivers(receivers.map((p) => ({ ...p, unit: p.unit || e.target.value })));
              }}
            >
              <option value="">Chọn đơn vị</option>
              {(units || []).map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <PeopleFields title="I. Đại diện bên giao tài sản" people={givers} setPeople={setGivers} />
        <PeopleFields title="II. Đại diện bên nhận tài sản" people={receivers} setPeople={setReceivers} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Nơi bố trí" required hint="Phòng đặt tài sản, ví dụ A5.208.">
            <Input value={place} onChange={(e) => setPlace(e.target.value)} />
          </Field>
          <Field label="Số văn bản, quyết định (nếu có)">
            <Input value={transferNo} onChange={(e) => setTransferNo(e.target.value)} />
          </Field>
          <Field label="Bản quét đã ký (có thể đính kèm sau)">
            <FilePick value={file} onChange={setFile} label="Chọn tệp" />
          </Field>
        </div>
        {err && <p className="text-[13.5px] text-l-red">{err}</p>}
      </div>
    </Modal>
  );
};

export default HandoversPage;
