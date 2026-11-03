// Cột Đề xuất và luồng duyệt đề xuất xử lý tài sản (mục 5.6 đề tài):
// đầu mối (tài sản đơn vị mình) hoặc kỹ thuật viên gửi đề xuất → lãnh đạo Phòng QTNL Duyệt / Cần kỹ thuật xem xét /
// Không duyệt (bắt buộc lý do) → Phòng KHTC tiếp nhận. Đề xuất không làm đổi màu đèn; mỗi tài sản một đề xuất đang xử lý.
import React, { useMemo, useState } from 'react';
import { Inbox, Send } from 'lucide-react';
import { catalogApi, proposalsApi, refs } from '../utils/api';
import { useApi } from '../hooks/useApi';
import { dateTimeVN, dateVN, money } from '../utils/format';
import {
  PROPOSAL_KIND,
  PROPOSAL_KIND_HINT,
  PROPOSAL_OPEN,
  PROPOSAL_REASONS,
  PROPOSAL_STATUS,
  PROPOSAL_TONE,
  REJECT_REASONS,
  TECH_OPINION,
} from '../utils/labels';
import { useAuth } from '../utils/AuthContext';
import { useToast } from '../utils/ToastContext';
import { Button, Empty, Field, Input, KV, Modal, Notice, Pill, Radio, Select, Table, Tabs, Td, Textarea, Th, cx } from './ui';
import { LightBadge } from './Light';
import { Pager, usePaged } from './Pager';
import { LIGHT_META } from '../utils/lights';

/** Nhãn trạng thái; đang chờ lãnh đạo nhưng đã có ý kiến kỹ thuật thì ghi rõ. */
export const proposalStatusLabel = (p) =>
  p.status === 'cho_lanh_dao' && p.techOpinion ? 'Đã có ý kiến kỹ thuật' : PROPOSAL_STATUS[p.status];
const toneOf = (p) => (p.status === 'cho_lanh_dao' && p.techOpinion ? 'blue' : PROPOSAL_TONE[p.status]);
const waitText = (p) =>
  p.waitingDays == null ? '' : p.waitingDays === 0 ? 'Chờ từ hôm nay' : `Đã chờ ${p.waitingDays} ngày`;

export const proposerText = (p) => {
  const name = refs.userById(p.createdBy)?.name || '';
  const role = p.createdRole === 'daumoi' ? `cán bộ đầu mối ${p.unit || ''}`.trim() : 'kỹ thuật viên Phòng QTNL';
  return name ? `${name}, ${role}` : role;
};

/** Ô Đề xuất ở cuối danh sách tài sản. onCreate: hiện "+ Lập đề xuất" khi tài sản chưa có đề xuất đang xử lý. */
export const ProposalCell = ({ asset, onCreate, onOpen }) => {
  const p = asset.proposal;
  const open = p && PROPOSAL_OPEN.includes(p.status);
  const hint = asset.suggestion;
  return (
    <div className="min-w-[150px] text-[13px] leading-snug">
      {p && (
        <button type="button" className="block text-left" onClick={onOpen ? () => onOpen(p) : undefined} disabled={!onOpen}>
          <span className="font-semibold text-ink">{PROPOSAL_KIND[p.kind]}</span>
          <span className="mt-0.5 block">
            <Pill tone={toneOf(p)}>{proposalStatusLabel(p)}</Pill>
          </span>
          {open && <span className="mt-0.5 block text-[12px] text-muted">{waitText(p)}</span>}
          {p.status === 'khong_duyet' && p.decisionNote && (
            <span className="mt-0.5 block text-[12px] text-l-red">Lý do: {p.decisionNote}</span>
          )}
        </button>
      )}
      {!open && hint && (
        <div className={cx('text-[12.5px] italic text-subtle', p && 'mt-1')}>Gợi ý: {hint.text.toLowerCase()}</div>
      )}
      {!open && onCreate && (
        <button type="button" onClick={() => onCreate(asset)} className="mt-0.5 text-[12.5px] font-medium text-accent hover:underline">
          + Lập đề xuất
        </button>
      )}
      {!p && !hint && !onCreate && <span className="text-subtle">—</span>}
    </div>
  );
};

const Chips = ({ items, onPick, active }) => (
  <div className="flex flex-wrap gap-1.5">
    {items.map((r) => (
      <button
        key={r}
        type="button"
        onClick={() => onPick(r)}
        className={cx(
          'rounded-full border px-2.5 py-[2px] text-[13px]',
          active === r ? 'border-accent bg-accent-soft font-medium text-accent' : 'border-rule text-ink-2 hover:bg-sunken',
        )}
      >
        {r}
      </button>
    ))}
  </div>
);

const CodeField = ({ value, onChange, hint }) => (
  <Field label="Mã xác nhận cá nhân" required hint={hint || 'Do Phòng KHTC cấp; khác mật khẩu đăng nhập.'}>
    <Input
      type="password"
      autoComplete="off"
      value={value}
      onChange={(e) => onChange(e.target.value.toUpperCase())}
      className="num max-w-[240px] tracking-[2px]"
      placeholder="Mã xác nhận"
    />
  </Field>
);

const reasonFromLight = (a) => {
  const code = a.light && a.light.code;
  if (!code || !LIGHT_META[code]) return '';
  return `Đèn ${LIGHT_META[code].label}: ${LIGHT_META[code].desc.toLowerCase()}`;
};

/**
 * Gửi đề xuất cho một hoặc nhiều tài sản. Đầu mối: "Gửi danh sách đề xuất thanh lý lên Phòng KHTC".
 * assets: dòng tài sản (có light.code). Mỗi tài sản một lý do; chọn nhanh lý do áp cho mọi dòng chưa nhập.
 */
export const ProposalCreateDialog = ({ assets, defaultKind = 'thanh_ly', title, onClose, onDone }) => {
  const toast = useToast();
  const [kind, setKind] = useState(defaultKind);
  const [reasons, setReasons] = useState(() => Object.fromEntries(assets.map((a) => [a.id, ''])));
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const quick = (r) =>
    setReasons((cur) =>
      Object.fromEntries(
        assets.map((a) => [a.id, cur[a.id] && cur[a.id] !== '' ? cur[a.id] : r === 'Theo màu đèn' ? reasonFromLight(a) : r]),
      ),
    );

  const submit = async () => {
    const missing = assets.filter((a) => !String(reasons[a.id] || '').trim());
    if (missing.length) return setErr(`Nhập lý do đề xuất cho ${missing.map((a) => a.code).join(', ')}.`);
    if (!code.trim()) return setErr('Nhập mã xác nhận cá nhân.');
    setBusy(true);
    setErr(null);
    try {
      const res = await proposalsApi.create(
        kind,
        assets.map((a) => ({ assetId: a.id, reason: reasons[a.id].trim() })),
        code,
      );
      toast('success', `Đã gửi ${res.proposals.length} đề xuất. Lãnh đạo Phòng QTNL được thông báo để duyệt.`);
      if (onDone) onDone(res);
      onClose();
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      title={title || (assets.length > 1 ? `Gửi danh sách ${assets.length} đề xuất` : 'Lập đề xuất xử lý tài sản')}
      onClose={onClose}
      width={820}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="primary" icon={<Send size={15} />} onClick={submit} disabled={busy}>
            {busy ? 'Đang gửi...' : `Gửi ${assets.length} đề xuất`}
          </Button>
        </>
      }
    >
      <div className="space-y-3.5">
        <Notice>
          Lãnh đạo Phòng QTNL duyệt (có thể giao kỹ thuật viên kiểm tra thực tế), rồi chuyển Phòng KHTC tổng hợp trình
          Ban Giám hiệu. Bạn nhận thông báo kết quả, kể cả lý do nếu không duyệt. Đề xuất không làm đổi màu đèn.
        </Notice>
        <Field label="Loại đề xuất" required hint={PROPOSAL_KIND_HINT[kind]}>
          <Select value={kind} onChange={(e) => setKind(e.target.value)} className="max-w-[260px]">
            {Object.entries(PROPOSAL_KIND).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <div className="rounded-md border border-rule">
          <Table>
            <thead>
              <tr>
                <Th>Tài sản</Th>
                <Th>Đèn</Th>
                <Th className="w-[46%]">Lý do đề xuất</Th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => (
                <tr key={a.id}>
                  <Td className="min-w-[200px]">
                    {a.name}
                    <div className="num text-[12.5px] font-medium text-accent">
                      {a.code} · {a.location}
                    </div>
                  </Td>
                  <Td>{a.light && LIGHT_META[a.light.code] ? <LightBadge code={a.light.code} size="sm" /> : null}</Td>
                  <Td>
                    <Textarea
                      value={reasons[a.id]}
                      onChange={(e) => setReasons((r) => ({ ...r, [a.id]: e.target.value }))}
                      className="min-h-[40px]"
                      aria-label={`Lý do đề xuất ${a.code}`}
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
          Chọn nhanh lý do (điền vào các dòng còn trống): <Chips items={PROPOSAL_REASONS} onPick={quick} />
        </div>
        <CodeField value={code} onChange={setCode} />
        {err && <Notice tone="danger">{err}</Notice>}
      </div>
    </Modal>
  );
};

const History = ({ p }) =>
  p.history && p.history.length ? (
    <p className="text-[13px] text-muted">
      {p.history
        .map((h) => `${dateVN(h.at.slice(0, 10)).slice(0, 5)} ${refs.userById(h.by)?.name || ''}: ${h.action}${h.note ? ` (${h.note})` : ''}`)
        .join('. ')}
      .
    </p>
  ) : null;

const AssetHead = ({ p }) => {
  const a = p.asset || {};
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="num font-medium text-accent">{a.code}</p>
        <p className="text-[15px] font-semibold">{a.name}</p>
        <p className="text-muted">
          {a.unit}, {a.location}. Nguyên giá {money(a.originalCost)} đ{a.inUseDate ? `, đưa vào sử dụng ${dateVN(a.inUseDate)}` : ''}.
        </p>
      </div>
      {a.light && LIGHT_META[a.light.code] && <LightBadge code={a.light.code} />}
    </div>
  );
};

const TechNotice = ({ p }) =>
  p.techOpinion ? (
    <Notice title={`Ý kiến kỹ thuật: ${refs.userById(p.techId)?.name || ''}, ${dateTimeVN(p.techAt)}`}>
      <b>{TECH_OPINION[p.techOpinion]}</b>
      {p.techNote ? `. ${p.techNote}` : ''}
    </Notice>
  ) : null;

/** Xem đề xuất (mọi vai trò được xem). */
export const ProposalView = ({ p, onClose }) => (
  <Modal open title={`Đề xuất ${p.code}: ${PROPOSAL_KIND[p.kind]}`} onClose={onClose} width={760}>
    <div className="space-y-3.5">
      <AssetHead p={p} />
      <KV
        cols={1}
        items={[
          ['Người đề xuất', `${proposerText(p)}, ${dateVN(p.createdAt.slice(0, 10))}`],
          ['Lý do đề xuất', p.reason],
          ['Trạng thái', `${proposalStatusLabel(p)}${waitText(p) ? ` (${waitText(p).toLowerCase()})` : ''}`],
          ...(p.decisionNote ? [[p.status === 'khong_duyet' ? 'Lý do không duyệt' : 'Ghi chú', p.decisionNote]] : []),
        ]}
      />
      <TechNotice p={p} />
      <History p={p} />
    </div>
  </Modal>
);

/** Lãnh đạo Phòng QTNL quyết định: Duyệt, chuyển Phòng KHTC / Cần kỹ thuật xem xét / Không duyệt (bắt buộc lý do). */
export const ProposalDecideDialog = ({ p, onClose }) => {
  const toast = useToast();
  const { user } = useAuth();
  const { data: people } = useApi(() => catalogApi.users(), []);
  const techs = (people || []).filter((u) => u.role === 'ktv');
  const [action, setAction] = useState(p.status === 'cho_ky_thuat' ? 'ky_thuat' : '');
  const [techId, setTechId] = useState(p.techId || '');
  const [reason, setReason] = useState('');
  const [preset, setPreset] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const own = p.createdBy === user.id;

  const submit = async () => {
    if (!action) return setErr('Chọn Duyệt, Cần kỹ thuật xem xét hoặc Không duyệt.');
    if (action === 'khong_duyet' && !reason.trim()) return setErr('Nhập lý do không duyệt.');
    if (action === 'ky_thuat' && !techId) return setErr('Chọn kỹ thuật viên xem xét.');
    if (!code.trim()) return setErr('Nhập mã xác nhận cá nhân.');
    setBusy(true);
    setErr(null);
    try {
      await proposalsApi.decide(p.id, { action, techId: techId || undefined, reason: reason.trim(), note: reason.trim() }, code);
      toast(
        action === 'khong_duyet' ? 'info' : 'success',
        action === 'duyet'
          ? `Đã duyệt đề xuất ${p.code}, chuyển Phòng KHTC.`
          : action === 'ky_thuat'
            ? `Đã giao kỹ thuật viên xem xét đề xuất ${p.code}.`
            : `Không duyệt đề xuất ${p.code}; lý do đã gửi người đề xuất.`,
      );
      onClose();
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  };

  const label =
    action === 'duyet' ? 'Duyệt, chuyển Phòng KHTC' : action === 'ky_thuat' ? 'Giao kỹ thuật xem xét' : action === 'khong_duyet' ? 'Không duyệt, gửi lý do' : 'Xác nhận';
  return (
    <Modal
      open
      title={`Đề xuất ${p.code}: ${PROPOSAL_KIND[p.kind]}`}
      onClose={onClose}
      width={860}
      footer={
        <>
          <Button onClick={onClose}>Quay lại</Button>
          <Button variant={action === 'khong_duyet' ? 'danger' : 'primary'} onClick={submit} disabled={busy || own}>
            {busy ? 'Đang lưu...' : label}
          </Button>
        </>
      }
    >
      <div className="space-y-3.5">
        <AssetHead p={p} />
        <KV
          cols={1}
          items={[
            ['Người đề xuất', `${proposerText(p)}, ${dateVN(p.createdAt.slice(0, 10))}`],
            ['Lý do đề xuất', p.reason],
          ]}
        />
        <TechNotice p={p} />
        <History p={p} />
        {own && <Notice tone="warn">Đề xuất do chính bạn lập: lãnh đạo không tự duyệt đề xuất của mình.</Notice>}
        <div className="rounded-md border border-rule p-4">
          <p className="mb-2.5 font-semibold">Quyết định của lãnh đạo Phòng QTNL</p>
          <div className="mb-3 flex flex-wrap gap-6">
            <Radio name="pdec" value="duyet" current={action} onChange={setAction} label="Duyệt, chuyển Phòng KHTC" />
            <Radio name="pdec" value="ky_thuat" current={action} onChange={setAction} label="Cần kỹ thuật xem xét" />
            <Radio name="pdec" value="khong_duyet" current={action} onChange={setAction} label="Không duyệt" />
          </div>
          {action === 'ky_thuat' && (
            <Field label="Kỹ thuật viên xem xét" required hint="Kiểm tra thực tế, ghi ý kiến kỹ thuật rồi trả về lãnh đạo quyết định.">
              <Select value={techId} onChange={(e) => setTechId(e.target.value)} className="max-w-[320px]">
                <option value="">Chọn kỹ thuật viên</option>
                {techs.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {action === 'khong_duyet' && (
            <Field label="Lý do không duyệt" required hint="Bắt buộc. Lý do hiện ở cột Đề xuất và gửi kèm thông báo cho người đề xuất.">
              <div className="mb-2">
                <Chips
                  items={REJECT_REASONS}
                  active={preset}
                  onPick={(r) => {
                    setPreset(r);
                    setReason((cur) => (cur.trim() ? cur : r));
                  }}
                />
              </div>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-[64px]" />
            </Field>
          )}
          {action === 'duyet' && (
            <Field label="Ghi chú (không bắt buộc)">
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-[40px]" />
            </Field>
          )}
          <div className="mt-3">
            <CodeField value={code} onChange={setCode} hint="Do Phòng KHTC cấp. Lãnh đạo không tự duyệt đề xuất do chính mình lập." />
          </div>
        </div>
        {err && <Notice tone="danger">{err}</Notice>}
      </div>
    </Modal>
  );
};

/** Kỹ thuật viên được giao: kiểm tra thực tế, ghi ý kiến kỹ thuật rồi trả về lãnh đạo. */
export const TechOpinionDialog = ({ p, onClose }) => {
  const toast = useToast();
  const [opinion, setOpinion] = useState('');
  const [note, setNote] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const submit = async () => {
    if (!opinion) return setErr('Chọn ý kiến kỹ thuật.');
    if (opinion !== 'dong_y' && !note.trim()) return setErr('Nhập nhận xét kỹ thuật.');
    if (!code.trim()) return setErr('Nhập mã xác nhận cá nhân.');
    setBusy(true);
    setErr(null);
    try {
      await proposalsApi.tech(p.id, opinion, note.trim(), code);
      toast('success', `Đã gửi ý kiến kỹ thuật cho đề xuất ${p.code}. Lãnh đạo được thông báo.`);
      onClose();
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      title={`Ý kiến kỹ thuật: đề xuất ${p.code}`}
      onClose={onClose}
      width={760}
      footer={
        <>
          <Button onClick={onClose}>Quay lại</Button>
          <Button variant="primary" onClick={submit} disabled={busy}>
            {busy ? 'Đang gửi...' : 'Gửi ý kiến, trả về lãnh đạo'}
          </Button>
        </>
      }
    >
      <div className="space-y-3.5">
        <AssetHead p={p} />
        <KV cols={1} items={[['Người đề xuất', proposerText(p)], ['Loại, lý do', `${PROPOSAL_KIND[p.kind]}: ${p.reason}`]]} />
        <History p={p} />
        <div className="flex flex-wrap gap-6">
          {Object.entries(TECH_OPINION).map(([k, v]) => (
            <Radio key={k} name="tech" value={k} current={opinion} onChange={setOpinion} label={v} />
          ))}
        </div>
        <Field label="Nhận xét kỹ thuật" required={opinion !== 'dong_y'} hint="Kết quả kiểm tra thực tế, đề xuất xử lý khác nếu có.">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} className="min-h-[64px]" />
        </Field>
        <CodeField value={code} onChange={setCode} />
        {err && <Notice tone="danger">{err}</Notice>}
      </div>
    </Modal>
  );
};

/** Phòng KHTC: tiếp nhận đề xuất đã duyệt; hoặc ghi Không duyệt (Ban Giám hiệu không đồng ý), bắt buộc lý do. */
export const KhtcProposalDialog = ({ list, action, onClose }) => {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const reject = action === 'khong_duyet';
  const submit = async () => {
    if (reject && !reason.trim()) return setErr('Nhập lý do không duyệt.');
    setBusy(true);
    try {
      await proposalsApi.khtc(action, list.map((p) => p.id), reason.trim());
      toast(reject ? 'info' : 'success', reject ? 'Đã ghi Không duyệt, người đề xuất nhận lý do.' : `Đã tiếp nhận ${list.length} đề xuất.`);
      onClose();
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      title={reject ? 'Không duyệt (Ban Giám hiệu không đồng ý)' : `Tiếp nhận ${list.length} đề xuất đã duyệt`}
      onClose={onClose}
      width={640}
      footer={
        <>
          <Button onClick={onClose}>Quay lại</Button>
          <Button variant={reject ? 'danger' : 'primary'} onClick={submit} disabled={busy}>
            {reject ? 'Không duyệt, gửi lý do' : 'Tiếp nhận'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <ul className="list-disc pl-5 text-[13.5px]">
          {list.map((p) => (
            <li key={p.id}>
              <span className="num font-medium">{p.code}</span> {PROPOSAL_KIND[p.kind].toLowerCase()} {p.asset?.name} ({p.asset?.code})
            </li>
          ))}
        </ul>
        {reject ? (
          <Field label="Lý do không duyệt" required hint="Gửi kèm thông báo cho người đề xuất, hiện ở cột Đề xuất.">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-[64px]" />
          </Field>
        ) : (
          <Notice>
            Tiếp nhận để tổng hợp trình Ban Giám hiệu: thanh lý vào danh sách đề xuất thanh lý; điều chuyển để lập
            điều chuyển chính thức; thay thế vào kế hoạch mua sắm năm sau. Quyết định thanh lý vẫn theo quy định hiện hành.
          </Notice>
        )}
        {err && <Notice tone="danger">{err}</Notice>}
      </div>
    </Modal>
  );
};

const STATUS_TABS = [
  { id: 'open', label: 'Đang xử lý', match: (p) => PROPOSAL_OPEN.includes(p.status) },
  { id: 'cho_lanh_dao', label: 'Chờ lãnh đạo duyệt', match: (p) => p.status === 'cho_lanh_dao' },
  { id: 'cho_ky_thuat', label: 'Chờ kỹ thuật xem xét', match: (p) => p.status === 'cho_ky_thuat' },
  { id: 'da_duyet', label: 'Đã duyệt', match: (p) => p.status === 'da_duyet' },
  { id: 'done', label: 'Đã xong', match: (p) => ['khong_duyet', 'khtc_tiep_nhan'].includes(p.status) },
  { id: 'all', label: 'Tất cả', match: () => true },
];

/**
 * Danh sách đề xuất theo vai trò: lãnh đạo quyết định; kỹ thuật viên ghi ý kiến khi được giao; Phòng KHTC tiếp nhận;
 * cán bộ đầu mối theo dõi đề xuất của đơn vị mình. initialTab, openId: mở từ thông báo.
 */
export const ProposalsBoard = ({ initialTab, openId, onExport }) => {
  const { user } = useAuth();
  const { data: list, error } = useApi(() => proposalsApi.list(), []);
  const defaultTab =
    initialTab || (user.role === 'lanhdao_qtnl' ? 'cho_lanh_dao' : user.role === 'khtc' ? 'da_duyet' : user.role === 'ktv' ? 'cho_ky_thuat' : 'open');
  const [tab, setTab] = useState(defaultTab);
  const [dialog, setDialog] = useState(null); // { kind: 'decide'|'tech'|'view'|'khtc', p, list, action }
  const [picked, setPicked] = useState([]);
  const [openedFromLink, setOpenedFromLink] = useState(false);

  const counts = useMemo(
    () => Object.fromEntries(STATUS_TABS.map((t) => [t.id, (list || []).filter(t.match).length])),
    [list],
  );
  const rows = useMemo(() => {
    const t = STATUS_TABS.find((x) => x.id === tab) || STATUS_TABS[0];
    return (list || []).filter(t.match);
  }, [list, tab]);
  const pager = usePaged(rows, [tab]);

  // Mở thẳng đề xuất khi bấm thông báo
  if (openId && list && !openedFromLink) {
    const p = list.find((x) => x.id === openId);
    setOpenedFromLink(true);
    if (p) setDialog({ kind: actionKind(p, user) || 'view', p });
  }

  const receivable = rows.filter((p) => p.status === 'da_duyet');
  return (
    <div>
      <Tabs
        value={tab}
        onChange={(t) => {
          setTab(t);
          setPicked([]);
        }}
        items={STATUS_TABS.map((t) => ({ id: t.id, label: t.label, count: counts[t.id] }))}
      />
      {user.role === 'khtc' && tab === 'da_duyet' && receivable.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-[13px] text-muted">
            Đã chọn <span className="num font-semibold">{picked.length}</span> đề xuất
          </span>
          <Button size="sm" onClick={() => setPicked(receivable.map((p) => p.id))}>
            Chọn tất cả
          </Button>
          <Button
            size="sm"
            variant="primary"
            icon={<Inbox size={14} />}
            disabled={!picked.length}
            onClick={() => setDialog({ kind: 'khtc', action: 'tiep_nhan', list: receivable.filter((p) => picked.includes(p.id)) })}
          >
            Tiếp nhận đề xuất đã chọn
          </Button>
        </div>
      )}
      <div className="rounded-[3px] border border-rule bg-surface">
        {error && <p className="p-4 text-l-red">{error}</p>}
        {list && rows.length === 0 ? (
          <Empty title="Không có đề xuất nào." />
        ) : (
          <Table>
            <thead>
              <tr>
                {user.role === 'khtc' && tab === 'da_duyet' && <Th className="w-[36px]" />}
                <Th>Đề xuất</Th>
                <Th>Tài sản</Th>
                <Th>Đèn</Th>
                <Th>Người đề xuất</Th>
                <Th>Lý do</Th>
                <Th>Trạng thái</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {pager.pageRows.map((p) => {
                const act = actionKind(p, user);
                return (
                  <tr key={p.id} className="hover:bg-sunken">
                    {user.role === 'khtc' && tab === 'da_duyet' && (
                      <Td>
                        <input
                          type="checkbox"
                          aria-label={`Chọn ${p.code}`}
                          checked={picked.includes(p.id)}
                          onChange={() => setPicked((x) => (x.includes(p.id) ? x.filter((i) => i !== p.id) : [...x, p.id]))}
                          className="h-4 w-4 accent-[#2a78b8]"
                        />
                      </Td>
                    )}
                    <Td className="whitespace-nowrap">
                      <span className="num font-semibold">{p.code}</span>
                      <div className="text-[12.5px] text-muted">{PROPOSAL_KIND[p.kind]}</div>
                    </Td>
                    <Td className="min-w-[200px]">
                      {p.asset?.name}
                      <div className="num text-[12.5px] font-medium text-accent">{p.asset?.code}</div>
                      <div className="text-[12px] text-muted">
                        {p.asset?.unit}, {p.asset?.location}
                      </div>
                    </Td>
                    <Td>{p.asset?.light && LIGHT_META[p.asset.light.code] ? <LightBadge code={p.asset.light.code} size="sm" /> : null}</Td>
                    <Td className="min-w-[170px]">
                      {refs.userById(p.createdBy)?.name}
                      <div className="text-[12.5px] text-muted">
                        {p.createdRole === 'daumoi' ? `Cán bộ đầu mối, ${p.unit}` : 'Kỹ thuật viên Phòng QTNL'}
                      </div>
                    </Td>
                    <Td className="min-w-[200px] max-w-[320px] text-ink-2">{p.reason}</Td>
                    <Td className="min-w-[150px]">
                      <Pill tone={toneOf(p)}>{proposalStatusLabel(p)}</Pill>
                      {waitText(p) && <div className="mt-0.5 text-[12.5px] text-muted">{waitText(p)}</div>}
                      {p.status === 'cho_ky_thuat' && (
                        <div className="text-[12.5px] text-muted">Giao {refs.userById(p.techId)?.name}</div>
                      )}
                      {p.status === 'khong_duyet' && p.decisionNote && (
                        <div className="mt-0.5 text-[12.5px] text-l-red">Lý do: {p.decisionNote}</div>
                      )}
                    </Td>
                    <Td right>
                      <div className="flex items-center justify-end gap-2">
                        {user.role === 'khtc' && ['da_duyet', 'khtc_tiep_nhan'].includes(p.status) && (
                          <Button size="sm" variant="danger" onClick={() => setDialog({ kind: 'khtc', action: 'khong_duyet', list: [p] })}>
                            Không duyệt
                          </Button>
                        )}
                        {act === 'decide' && (
                          <Button size="sm" variant="primary" onClick={() => setDialog({ kind: 'decide', p })}>
                            Xem, quyết định
                          </Button>
                        )}
                        {act === 'tech' && (
                          <Button size="sm" variant="primary" onClick={() => setDialog({ kind: 'tech', p })}>
                            Ghi ý kiến kỹ thuật
                          </Button>
                        )}
                        {act === 'khtc' && (
                          <Button size="sm" variant="primary" onClick={() => setDialog({ kind: 'khtc', action: 'tiep_nhan', list: [p] })}>
                            Tiếp nhận
                          </Button>
                        )}
                        {!act && (
                          <Button size="sm" onClick={() => setDialog({ kind: 'view', p })}>
                            Xem
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
        <Pager pager={pager} />
        {onExport && rows.length > 0 && (
          <div className="flex justify-end gap-2 border-t border-rule-2 px-3 py-2">{onExport(rows)}</div>
        )}
      </div>
      {dialog && dialog.kind === 'decide' && <ProposalDecideDialog p={dialog.p} onClose={() => setDialog(null)} />}
      {dialog && dialog.kind === 'tech' && <TechOpinionDialog p={dialog.p} onClose={() => setDialog(null)} />}
      {dialog && dialog.kind === 'view' && <ProposalView p={dialog.p} onClose={() => setDialog(null)} />}
      {dialog && dialog.kind === 'khtc' && (
        <KhtcProposalDialog
          list={dialog.list}
          action={dialog.action}
          onClose={() => {
            setDialog(null);
            setPicked([]);
          }}
        />
      )}
    </div>
  );
};

/** Việc người đang đăng nhập làm được với đề xuất này. */
export function actionKind(p, user) {
  if (user.role === 'lanhdao_qtnl' && p.status === 'cho_lanh_dao') return 'decide';
  if (user.role === 'ktv' && p.status === 'cho_ky_thuat' && p.techId === user.id) return 'tech';
  if (user.role === 'khtc' && p.status === 'da_duyet') return 'khtc';
  return null;
}
