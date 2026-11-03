
// Lãnh đạo Phòng QTNL: xác nhận hoặc trả lại dự toán; xác nhận hư hỏng toàn phần; duyệt đề xuất xử lý tài sản
// (Duyệt / Cần kỹ thuật xem xét / Không duyệt bắt buộc lý do). Mọi quyết định đều nhập mã xác nhận cá nhân.
import React, { useState } from 'react';
import FormButton from '../components/FormButton';
import { assetsApi, refs, estimatesApi, inspectionsApi, staffApi, thresholdsApi } from '../utils/api';
import { useApi } from '../hooks/useApi';
import { countedCost } from '../utils/lights';
import { dateTimeVN, dateVN, money } from '../utils/format';
import { COST_GROUP, EXCEPTION_STATUS, PROPOSAL, TARGET } from '../utils/labels';
import { useToast } from '../utils/ToastContext';
import {
  Button,
  Empty,
  Field,
  Input,
  KV,
  Modal,
  Notice,
  PageHeader,
  Pill,
  Select,
  Table,
  Tabs,
  Td,
  Textarea,
  Th,
  statusSince,
  WaitDays,
} from '../components/ui';
import { LightBadge, LightMeter } from '../components/Light';
import { Pager, usePaged } from '../components/Pager';
import { ProposalsBoard } from '../components/Proposals';
import { proposalsApi } from '../utils/api';

const RETURN_REASONS = [
  'Đơn giá cao hơn báo giá gần nhất, đề nghị kiểm tra lại',
  'Thiếu nội dung công việc hoặc nhóm chi phí chưa đúng',
  'Đề nghị khảo sát thêm trước khi sửa',
  'Lý do khác',
];

// Liên kết từ thông báo: approvals:estimates | approvals:total-loss | approvals:proposals | approvals:proposal:<id>
const SECTION_TAB = { estimates: 'dt', 'total-loss': 'hong', proposals: 'dx', proposal: 'dx', dx: 'dx' };

const ApprovalsPage = ({ onNavigate, params = {} }) => {
  const { data: estimates } = useApi(() => estimatesApi.list(), []);
  const { data: losses } = useApi(() => inspectionsApi.pendingTotalLoss(), []);
  const { data: proposals } = useApi(() => proposalsApi.list('cho_lanh_dao'), []);
  const [tab, setTab] = useState(SECTION_TAB[params.section] || 'dt');
  const [openEst, setOpenEst] = useState(null);
  const [openLoss, setOpenLoss] = useState(null);
  const pending = (estimates || [])
    .filter((e) => e.status === 'cho_lanh_dao')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const estPager = usePaged(pending, tab);
  const lossPager = usePaged(losses, tab);

  return (
    <div>
      <PageHeader
        title="Chờ xác nhận"
        description="Dự toán, hư hỏng toàn phần và đề xuất xử lý tài sản chờ lãnh đạo Phòng QTNL. Xác nhận, duyệt đều nhập mã xác nhận cá nhân; trả lại, không duyệt phải ghi lý do."
      />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'dt', label: 'Dự toán', count: pending.length },
          { id: 'hong', label: 'Hư hỏng toàn phần', count: losses?.length ?? 0 },
          { id: 'dx', label: 'Đề xuất xử lý tài sản', count: proposals?.length ?? 0 },
        ]}
      />
      {tab === 'dx' ? (
        <ProposalsBoard initialTab="cho_lanh_dao" openId={params.proposalId} />
      ) : (
      <div className="rounded-[3px] border border-rule bg-surface">
        {tab === 'dt' ? (
          pending.length === 0 ? (
            <Empty title="Không có dự toán nào chờ xác nhận." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Số phiếu</Th>
                  <Th>Tài sản</Th>
                  <Th right>Tổng dự toán (đ)</Th>
                  <Th>Đèn</Th>
                  <Th>Người lập</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {estPager.pageRows.map((e) => {
                  const a = refs.assetById(e.assetId);
                  return (
                    <tr key={e.id} className="hover:bg-sunken">
                      <Td className="num font-medium whitespace-nowrap">
                        {e.code}
                        <div className="text-[12px] font-normal text-muted">{dateVN(e.createdAt)}</div>
                        <WaitDays since={statusSince(e)} className="font-normal" />
                      </Td>
                      <Td className="min-w-[220px]">
                        {a?.name}
                        <div className="num text-[12.5px] text-muted">
                          {a?.code}, {a?.unit}
                        </div>
                      </Td>
                      <Td right>{money(e.lines.reduce((s, l) => s + l.estimate, 0))}</Td>
                      <Td className="whitespace-nowrap">
                        <span className="flex items-center gap-1.5">
                          <LightBadge code={e.lightBefore} size="sm" />
                          {e.lightAfter !== e.lightBefore && (
                            <>
                              <span className="text-subtle">thành</span>
                              <LightBadge code={e.lightAfter} size="sm" />
                            </>
                          )}
                        </span>
                        {e.locked && (
                          <div className="mt-1">
                            <Pill tone="red">Bị khóa, có đề nghị ngoại lệ</Pill>
                          </div>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap">{refs.userById(e.createdBy)?.name}</Td>
                      <Td right>
                        <div className="flex items-center justify-end gap-2">
                          {e.reportId && (
                            <FormButton source={{ type: 'case', reportId: e.reportId, focus: 'DT' }}>Biểu mẫu</FormButton>
                          )}
                          <Button size="sm" variant="primary" onClick={() => setOpenEst(e)}>
                            Xem và xác nhận
                          </Button>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )
        ) : null}
        {tab === 'dt' && <Pager pager={estPager} />}
        {tab === 'dt' ? null : !losses || losses.length === 0 ? (
          <Empty title="Không có biên bản hư hỏng toàn phần nào chờ xác nhận." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Biên bản</Th>
                <Th>Tài sản</Th>
                <Th>Tình trạng ghi nhận</Th>
                <Th>Kỹ thuật viên</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {lossPager.pageRows.map((i) => {
                const a = refs.assetById(i.assetId);
                return (
                  <tr key={i.id} className="hover:bg-sunken">
                    <Td className="num font-medium whitespace-nowrap">
                      {i.code}
                      <div className="text-[12px] font-normal text-muted">{dateTimeVN(i.inspectedAt)}</div>
                      <WaitDays since={i.inspectedAt} className="font-normal" />
                    </Td>
                    <Td className="min-w-[200px]">
                      {a?.name}
                      <div className="num text-[12.5px] text-muted">
                        {a?.code}, {a?.location}
                      </div>
                    </Td>
                    <Td className="min-w-[240px]">{i.findings}</Td>
                    <Td className="whitespace-nowrap">{refs.userById(i.technicianId)?.name}</Td>
                    <Td right>
                      <div className="flex items-center justify-end gap-2">
                        <FormButton source={{ type: 'case', reportId: i.reportId, focus: 'BB' }}>Biểu mẫu</FormButton>
                        <Button size="sm" variant="primary" onClick={() => setOpenLoss(i)}>
                          Xem và xác nhận
                        </Button>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
        {tab !== 'dt' && <Pager pager={lossPager} />}
      </div>
      )}
      {openEst && <EstimateDecision est={openEst} onClose={() => setOpenEst(null)} />}
      {openLoss && <LossDecision ins={openLoss} onClose={() => setOpenLoss(null)} />}
    </div>
  );
};

const ReturnBox = ({ reason, setReason, preset, setPreset }) => (
  <div className="grid gap-3 rounded-md border border-rule p-3 sm:grid-cols-2">
    <Field label="Lý do trả lại" required>
      <Select
        value={preset}
        onChange={(e) => {
          setPreset(e.target.value);
          if (e.target.value !== 'Lý do khác') setReason(e.target.value);
          else setReason('');
        }}
      >
        <option value="">Chọn lý do</option>
        {RETURN_REASONS.map((r) => (
          <option key={r}>{r}</option>
        ))}
      </Select>
    </Field>
    <Field label="Ghi chú cho kỹ thuật viên">
      <Textarea value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-[38px]" />
    </Field>
  </div>
);

/** Bước nhập mã xác nhận cá nhân của lãnh đạo khi bấm xác nhận (tài khoản được giữ đăng nhập lâu dài trên thiết bị). */
const LeaderCode = ({ code, setCode, err }) => (
  <div className="rounded-md border border-accent-line bg-accent-soft/50 p-3.5">
    <Field
      label="Mã xác nhận cá nhân"
      required
      hint="Do Phòng KHTC cấp, khác mật khẩu đăng nhập. Lãnh đạo không xác nhận phiếu do chính mình lập."
    >
      <Input
        autoFocus
        type="password"
        autoComplete="off"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="QT-XXXX"
        className="num max-w-[220px] tracking-wide"
      />
    </Field>
    {err && <p className="mt-1.5 text-[13px] text-l-red">{err}</p>}
  </div>
);

const EstimateDecision = ({ est, onClose }) => {
  const toast = useToast();
  const { data: a } = useApi(() => assetsApi.get(est.assetId), [est.assetId]);
  const { data: th } = useApi(() => thresholdsApi.get(), []);
  const { data: before } = useApi(() => assetsApi.previewLight(est.assetId, [], est.id), [est.id]);
  const [mode, setMode] = useState('view');
  const [reason, setReason] = useState('');
  const [preset, setPreset] = useState('');
  const [code, setCode] = useState('');
  const [codeErr, setCodeErr] = useState(null);
  const x = est.exception;
  const total = est.lines.reduce((s, l) => s + l.estimate, 0);

  const confirm = async () => {
    let leader;
    try {
      leader = staffApi.leaderByCode(code);
    } catch (e) {
      return setCodeErr(e.message);
    }
    try {
      await estimatesApi.confirm(est.id, leader);
      toast('success', `Đã xác nhận dự toán ${est.code}. Kỹ thuật viên được thông báo để in và trình ký.`);
      onClose();
    } catch (e) {
      toast('error', e.message);
    }
  };
  const doReturn = async () => {
    if (!reason.trim()) return toast('error', 'Nhập lý do trả lại.');
    try {
      // Trả lại cũng nhập mã xác nhận cá nhân: máy chủ trả 428 thì hộp nhập mã hiện ra
      await estimatesApi.returnBack(est.id, null, reason.trim());
      toast('info', `Đã trả lại dự toán ${est.code}.`);
      onClose();
    } catch (e) {
      if (e.reason !== 'cancelled') toast('error', e.message);
    }
  };

  return (
    <Modal
      open
      title={`Dự toán ${est.code}`}
      onClose={onClose}
      width={860}
      footer={
        mode === 'view' ? (
          <>
            {est.reportId && (
              <FormButton size="md" className="mr-auto" source={{ type: 'case', reportId: est.reportId, focus: 'DT' }}>
                Xem phiếu dự toán
              </FormButton>
            )}
            <Button onClick={() => setMode('return')}>Trả lại</Button>
            <Button variant="primary" onClick={() => setMode('code')}>
              Xác nhận dự toán
            </Button>
          </>
        ) : mode === 'code' ? (
          <>
            <Button onClick={() => setMode('view')}>Quay lại</Button>
            <Button variant="primary" disabled={!code.trim()} onClick={confirm}>
              Nhập mã, xác nhận dự toán
            </Button>
          </>
        ) : (
          <>
            <Button onClick={() => setMode('view')}>Quay lại</Button>
            <Button variant="danger" onClick={doReturn}>
              Trả lại kỹ thuật viên
            </Button>
          </>
        )
      }
    >
      {!a || !th || !before ? (
        <p className="text-muted">Đang tải…</p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
          <div className="min-w-0 space-y-4">
            <div>
              <p className="num text-[13px] font-semibold text-accent">{a.code}</p>
              <p className="font-semibold">{a.name}</p>
              <p className="text-[13px] text-muted">
                {a.unit}, {a.location}. Nguyên giá {money(a.originalCost)} đ, GTCL {money(a.residualValue)} đ.
              </p>
            </div>
            <Table className="rounded-md border border-rule-2">
              <thead>
                <tr>
                  <Th>Nội dung công việc</Th>
                  <Th>Nhóm</Th>
                  <Th right>Dự toán (đ)</Th>
                </tr>
              </thead>
              <tbody>
                {est.lines.map((l) => (
                  <tr key={l.id}>
                    <Td>{l.content}</Td>
                    <Td className={l.costGroup === 'tinh' ? '' : 'text-muted'}>{COST_GROUP[l.costGroup]}</Td>
                    <Td right>{money(l.estimate)}</Td>
                  </tr>
                ))}
                <tr>
                  <Td className="font-semibold">Tổng</Td>
                  <Td className="text-muted">Tính vào đèn {money(countedCost(est.lines).cost)} đ</Td>
                  <Td right className="font-semibold">
                    {money(total)}
                  </Td>
                </tr>
              </tbody>
            </Table>
            {x && (
              <Notice
                tone="warn"
                title={`Phiếu bị khóa, kèm đề nghị ngoại lệ ${x.code} (${EXCEPTION_STATUS[x.status]})`}
              >
                Lý do cấp thiết: {x.reason}. Dùng thêm: {x.extraTime}. Thiết bị tạm: {x.tempEquipment || 'không có'}.
                Xác nhận dự toán không mở khóa; Phòng KHTC mở khóa sau khi có đủ chữ ký.
              </Notice>
            )}
            {est.history.length > 1 && (
              <p className="text-[13px] text-muted">
                {est.history
                  .map(
                    (h) =>
                      `${dateTimeVN(h.at)} ${refs.userById(h.by)?.name}: ${h.action}${h.note ? ` (${h.note})` : ''}`,
                  )
                  .join('. ')}
              </p>
            )}
            {mode === 'return' && (
              <ReturnBox reason={reason} setReason={setReason} preset={preset} setPreset={setPreset} />
            )}
            {mode === 'code' && (
              <LeaderCode
                code={code}
                setCode={(v) => {
                  setCode(v);
                  setCodeErr(null);
                }}
                err={codeErr}
              />
            )}
          </div>
          <div className="rounded-md border border-rule-2 p-3.5">
            <p className="mb-3 flex items-center gap-2 text-[13px] text-muted">
              Đèn <LightBadge code={est.lightBefore} size="sm" /> thành <LightBadge code={est.lightAfter} size="sm" />
            </p>
            <LightMeter before={before.before} after={a.light} th={th} />
          </div>
        </div>
      )}
    </Modal>
  );
};

const LossDecision = ({ ins, onClose }) => {
  const toast = useToast();
  const a = refs.assetById(ins.assetId);
  const [mode, setMode] = useState('view');
  const [reason, setReason] = useState('');
  const [preset, setPreset] = useState('');
  const [code, setCode] = useState('');
  const [codeErr, setCodeErr] = useState(null);
  const fully = (a?.residualValue ?? 0) <= 0;
  return (
    <Modal
      open
      title={`Hư hỏng toàn phần: biên bản ${ins.code}`}
      onClose={onClose}
      width={680}
      footer={
        mode === 'view' ? (
          <>
            <FormButton size="md" className="mr-auto" source={{ type: 'case', reportId: ins.reportId, focus: 'BB' }}>
              Xem biên bản
            </FormButton>
            <Button onClick={() => setMode('return')}>Trả lại</Button>
            <Button variant="primary" onClick={() => setMode('code')}>
              Xác nhận hư hỏng toàn phần
            </Button>
          </>
        ) : mode === 'code' ? (
          <>
            <Button onClick={() => setMode('view')}>Quay lại</Button>
            <Button
              variant="primary"
              disabled={!code.trim()}
              onClick={async () => {
                let leader;
                try {
                  leader = staffApi.leaderByCode(code);
                } catch (e) {
                  return setCodeErr(e.message);
                }
                try {
                  await inspectionsApi.decideTotalLoss(ins.id, leader, true);
                  toast(
                    'success',
                    `Đã xác nhận hư hỏng toàn phần. ${a?.name} vào đèn ${fully ? 'Đỏ 1.1' : 'Đỏ 1.2'}, chờ thanh lý.`,
                  );
                  onClose();
                } catch (e) {
                  setCodeErr(e.message);
                }
              }}
            >
              Nhập mã, xác nhận hư hỏng toàn phần
            </Button>
          </>
        ) : (
          <>
            <Button onClick={() => setMode('view')}>Quay lại</Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (!reason.trim()) return toast('error', 'Nhập lý do trả lại.');
                try {
                  await inspectionsApi.decideTotalLoss(ins.id, null, false, reason.trim());
                  toast('info', `Đã trả lại biên bản ${ins.code}.`);
                  onClose();
                } catch (e) {
                  if (e.reason !== 'cancelled') toast('error', e.message);
                }
              }}
            >
              Trả lại kỹ thuật viên
            </Button>
          </>
        )
      }
    >
      <div className="space-y-4">
        <KV
          items={[
            ['Tài sản', `${a?.name} (${a?.code})`],
            ['Đơn vị, vị trí', `${a?.unit}, ${a?.location}`],
            ['Giá trị còn lại', `${money(a?.residualValue)} đ`],
            ['Kỹ thuật viên', refs.userById(ins.technicianId)?.name],
            ['Tình trạng ghi nhận', ins.findings],
            ['Đối tượng hỏng', TARGET[ins.target]],
            ['Đề xuất', `${PROPOSAL[ins.proposal]}${ins.proposalNote ? `. ${ins.proposalNote}` : ''}`],
          ]}
        />
        <Notice tone="warn">
          Xác nhận xong, tài sản vào đèn {fully ? 'Đỏ 1.1 (đã hết hao mòn)' : 'Đỏ 1.2 (chưa hết hao mòn)'} và danh sách
          chờ thanh lý; giữ màu đỏ khi sang năm tài chính mới.
        </Notice>
        {mode === 'return' && <ReturnBox reason={reason} setReason={setReason} preset={preset} setPreset={setPreset} />}
        {mode === 'code' && (
          <LeaderCode
            code={code}
            setCode={(v) => {
              setCode(v);
              setCodeErr(null);
            }}
            err={codeErr}
          />
        )}
      </div>
    </Modal>
  );
};

export default ApprovalsPage;
