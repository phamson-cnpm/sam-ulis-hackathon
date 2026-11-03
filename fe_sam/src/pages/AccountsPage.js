
// Phòng KHTC (mục VII, 5.7, 5.8 đề tài): tài khoản cá nhân cho từng cán bộ, giảng viên (tên đăng nhập là mã số cán bộ,
// mật khẩu ban đầu đổi ở lần đăng nhập đầu); vai trò trên SAM (kỹ thuật viên, lãnh đạo Phòng QTNL, quản trị; cán bộ
// đầu mối cấp ở tab Mã cán bộ đầu mối, mỗi đơn vị một người); cấp, đổi, thu hồi mã xác nhận cá nhân; nhật ký xem, xuất file.
import React, { useMemo, useState } from 'react';
import { KeyRound, LogOut, Plus, Printer, Search, Trash2, UserPlus } from 'lucide-react';
import { catalogApi, focalApi, staffApi } from '../utils/api';
import { useApi } from '../hooks/useApi';
import ImportButton from '../components/ImportButton';
import { dateTimeVN, dateVN } from '../utils/format';
import { FOCAL_ACTION, FOCAL_STATUS, SETTABLE_GROUPS, STAFF_GROUP } from '../utils/labels';
import { useAuth } from '../utils/AuthContext';
import { useToast } from '../utils/ToastContext';
import { TODAY } from '../config/app';
import { printList } from '../utils/printList';
import { Button, Empty, Field, Input, KV, Modal, Notice, PageHeader, Pill, Select, Table, Tabs, Td, Th, Textarea, useConfirm } from '../components/ui';
import { Pager, usePaged } from '../components/Pager';

const daysBefore = (iso, n) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const EXPORTS = ['xuat_excel', 'tai_pdf', 'in', 'tai_word'];
const ROLE_TONE = { canbo: 'neutral', daumoi: 'accent', ktv: 'blue', lanhdao_qtnl: 'blue', khtc: 'amber' };

const accountState = (p) =>
  !p.hasAccount
    ? ['Chưa cấp tài khoản', 'neutral']
    : !p.active
      ? ['Đã khóa', 'red']
      : p.mustChangePassword
        ? ['Chưa đăng nhập lần đầu', 'amber']
        : ['Đang hoạt động', 'green'];

/** Phiếu tên đăng nhập, mật khẩu ban đầu để in, gửi riêng từng cán bộ (mật khẩu chỉ hiện một lần). */
const printSlips = (list) =>
  printList({
    fileName: `SAM_tai-khoan-ca-nhan_${TODAY}`,
    title: 'Danh sách tài khoản cá nhân cấp mới',
    subtitle: `Phòng KHTC cấp ngày ${TODAY.split('-').reverse().join('/')}; ${list.length} tài khoản. Cắt theo dòng, gửi riêng từng cán bộ; đăng nhập lần đầu phải đổi mật khẩu.`,
    columns: [
      { header: 'STT', align: 'center', width: '34px' },
      { header: 'Họ tên' },
      { header: 'Đơn vị' },
      { header: 'Tên đăng nhập', width: '130px' },
      { header: 'Mật khẩu ban đầu', width: '140px' },
      { header: 'Ký nhận', width: '110px' },
    ],
    rows: list.map((x, i) => [i + 1, x.name, x.unit, x.username, x.password, '']),
    note: 'Địa chỉ đăng nhập: trang SAM của Nhà trường. Mật khẩu ban đầu chỉ dùng một lần; không chia sẻ tài khoản, mã xác nhận cá nhân.',
  });

const AccountsPage = () => {
  const { data: list } = useApi(() => focalApi.list(), []);
  const { data: logs } = useApi(() => focalApi.logs(), []);
  const { data: staff } = useApi(() => staffApi.list(), []);
  const [tab, setTab] = useState('canbo');
  const [unitFilter, setUnitFilter] = useState('all');
  const [showOld, setShowOld] = useState(false);
  const [reissue, setReissue] = useState(null);
  const [revoke, setRevoke] = useState(null);

  const active = (list || []).filter((f) => f.status === 'dang_dung');
  const units = useMemo(() => [...new Set((list || []).map((f) => f.unit))], [list]);
  const unitsWithoutCode = units.filter((u) => !active.some((f) => f.unit === u));
  const shown = (list || []).filter((f) => showOld || f.status === 'dang_dung' || unitsWithoutCode.includes(f.unit));
  const shownLogs = (logs || []).filter((l) => unitFilter === 'all' || l.unit === unitFilter);
  const since = daysBefore(TODAY, 30);
  const last30 = (logs || []).filter((l) => l.at >= since && EXPORTS.includes(l.action));
  const codePager = usePaged(shown, showOld);
  const logPager = usePaged(shownLogs, unitFilter);
  const people = staff || [];
  const accounts = people.filter((p) => p.hasAccount && p.active);
  const firstLogin = accounts.filter((p) => p.mustChangePassword).length;
  const qtnlCodes = people.filter((p) => ['ktv', 'lanhdao_qtnl'].includes(p.group) && p.personalCode);

  return (
    <div>
      <PageHeader
        title="Tài khoản, mã xác nhận"
        description="Phòng KHTC cấp tài khoản cá nhân cho từng cán bộ, giảng viên từ dữ liệu cán bộ; thiết lập vai trò và cấp mã xác nhận cho cán bộ đầu mối, kỹ thuật viên, lãnh đạo Phòng QTNL. Nhật ký ghi theo tài khoản."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[3px] border border-rule bg-surface px-4 py-3">
          <p className="text-[13px] text-muted">Tài khoản đang hoạt động</p>
          <p className="num text-[24px] font-semibold">
            {accounts.length}
            <span className="text-[14px] font-normal text-muted">
              {' '}
              / {people.length} cán bộ{firstLogin ? `; ${firstLogin} chưa đăng nhập lần đầu` : ''}
            </span>
          </p>
        </div>
        <div className="rounded-[3px] border border-rule bg-surface px-4 py-3">
          <p className="text-[13px] text-muted">Mã xác nhận đang dùng</p>
          <p className="num text-[24px] font-semibold">
            {active.length + qtnlCodes.length}
            <span className="text-[14px] font-normal text-muted">
              {' '}
              {active.length} đầu mối, {qtnlCodes.filter((p) => p.group === 'ktv').length} kỹ thuật viên,{' '}
              {qtnlCodes.filter((p) => p.group === 'lanhdao_qtnl').length} lãnh đạo
            </span>
          </p>
        </div>
        <div className="rounded-[3px] border border-rule bg-surface px-4 py-3">
          <p className="text-[13px] text-muted">Đơn vị chưa có cán bộ đầu mối · lượt tải file 30 ngày</p>
          <p className="num text-[24px] font-semibold">
            {unitsWithoutCode.length}
            <span className="text-[14px] font-normal text-muted"> · {last30.length} lượt</span>
          </p>
        </div>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'canbo', label: 'Tài khoản cán bộ', count: people.length },
          { id: 'ma', label: 'Mã cán bộ đầu mối', count: active.length },
          { id: 'log', label: 'Nhật ký xem, xuất file', count: logs ? logs.length : 0 },
        ]}
      />

      {tab === 'canbo' ? (
        <StaffTab staff={people} />
      ) : tab === 'ma' ? (
        <div className="rounded-[3px] border border-rule bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rule-2 px-3 py-2.5">
            <p className="text-[13px] text-muted">
              Mỗi đơn vị một cán bộ đầu mối, chọn từ dữ liệu cán bộ (đăng nhập bằng tài khoản cá nhân). Đổi người hoặc thu
              hồi: mã cũ hết hiệu lực ngay, người cũ trở lại vai trò cán bộ, giảng viên.
            </p>
            <label className="flex items-center gap-2 text-[13px] text-ink-2">
              <input type="checkbox" checked={showOld} onChange={(e) => setShowOld(e.target.checked)} className="h-4 w-4 accent-[#2a78b8]" />
              Hiện cả mã đã thu hồi
            </label>
          </div>
          <Table>
            <thead>
              <tr>
                <Th>Đơn vị</Th>
                <Th>Cán bộ đầu mối</Th>
                <Th>Mã xác nhận</Th>
                <Th>Cấp ngày</Th>
                <Th>Truy cập gần nhất</Th>
                <Th>Trạng thái</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {codePager.pageRows.map((f) => (
                <tr key={f.id} className={f.status === 'da_thu_hoi' ? 'text-muted' : 'hover:bg-sunken'}>
                  <Td className="min-w-[200px]">{f.unit}</Td>
                  <Td className="min-w-[170px]">
                    {f.name}
                    <div className="text-[12.5px] text-muted">
                      {f.position}
                      {f.phone ? `, ${f.phone}` : ''}
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap">
                    <span className={f.status === 'dang_dung' ? 'num font-semibold tracking-wide text-ink' : 'num line-through'}>
                      {f.code}
                    </span>
                  </Td>
                  <Td className="num whitespace-nowrap">{dateVN(f.issuedAt)}</Td>
                  <Td className="num whitespace-nowrap">
                    {f.lastAccess ? dateTimeVN(f.lastAccess) : <span className="text-subtle">Chưa dùng</span>}
                  </Td>
                  <Td className="whitespace-nowrap">
                    <Pill tone={f.status === 'dang_dung' ? 'green' : f.status === 'chua_cap' ? 'amber' : 'neutral'}>{FOCAL_STATUS[f.status]}</Pill>
                    {f.revokedAt && (
                      <div className="mt-1 text-[12px] text-muted">
                        {dateVN(f.revokedAt)}: {f.revokeReason}
                      </div>
                    )}
                  </Td>
                  <Td right className="whitespace-nowrap">
                    {f.status === 'dang_dung' ? (
                      <div className="flex justify-end gap-2">
                        <Button size="sm" onClick={() => setReissue(f)}>
                          Đổi người, cấp mã mới
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => setRevoke(f)}>
                          Thu hồi
                        </Button>
                      </div>
                    ) : (
                      unitsWithoutCode.includes(f.unit) &&
                      !shown.some((x) => x.unit === f.unit && x.issuedAt > f.issuedAt) && (
                        <Button size="sm" variant="primary" onClick={() => setReissue(f)}>
                          Cấp mã
                        </Button>
                      )
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pager pager={codePager} />
        </div>
      ) : (
        <div className="rounded-[3px] border border-rule bg-surface">
          <div className="flex flex-wrap items-center gap-2 border-b border-rule-2 p-3">
            <Select value={unitFilter} onChange={(e) => setUnitFilter(e.target.value)} className="w-auto max-w-[340px]" aria-label="Đơn vị">
              <option value="all">Tất cả đơn vị</option>
              {units.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Select>
            <p className="text-[13px] text-muted">Ghi lại mọi lần xem danh sách, in và tải file của cán bộ đầu mối, theo tài khoản và mã của đơn vị.</p>
          </div>
          {shownLogs.length === 0 ? (
            <Empty title="Chưa có lượt truy cập nào." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Thời gian</Th>
                  <Th>Đơn vị</Th>
                  <Th>Mã</Th>
                  <Th>Người thao tác</Th>
                  <Th>Thao tác</Th>
                  <Th>Nội dung</Th>
                </tr>
              </thead>
              <tbody>
                {logPager.pageRows.map((l) => {
                  const f = (list || []).find((x) => x.id === l.focalId);
                  return (
                    <tr key={l.id}>
                      <Td className="num whitespace-nowrap">{dateTimeVN(l.at)}</Td>
                      <Td className="min-w-[180px]">{l.unit}</Td>
                      <Td className="num whitespace-nowrap">{l.code}</Td>
                      <Td className="whitespace-nowrap">{l.name || (f ? f.name : '—')}</Td>
                      <Td className="whitespace-nowrap">
                        <Pill tone={EXPORTS.includes(l.action) ? 'blue' : 'neutral'}>{FOCAL_ACTION[l.action] || l.action}</Pill>
                      </Td>
                      <Td className="min-w-[200px] text-ink-2">{l.detail || '—'}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
          <Pager pager={logPager} />
        </div>
      )}

      {reissue && <ReissueModal f={reissue} onClose={() => setReissue(null)} />}
      {revoke && <RevokeModal f={revoke} onClose={() => setRevoke(null)} />}
    </div>
  );
};

const ReissueModal = ({ f, onClose }) => {
  const { user } = useAuth();
  const toast = useToast();
  const { data: staff } = useApi(() => staffApi.list(), []);
  // Cán bộ đầu mối đăng nhập bằng tài khoản cá nhân: chọn người của đơn vị, chưa có vai trò Phòng QTNL, quản trị
  const people = (staff || []).filter((p) => p.unit === f.unit && ['canbo', 'daumoi'].includes(p.group));
  const [staffId, setStaffId] = useState(f.staffId || '');
  const [done, setDone] = useState(null);
  const picked = people.find((p) => p.id === staffId);
  const changed = picked && picked.id !== f.staffId;

  const submit = async () => {
    if (!picked) return;
    try {
      const rec = await focalApi.reissue(f.unit, { staffId: picked.id }, user);
      setDone(rec);
      toast('success', `Đã cấp mã ${rec.code} cho ${f.unit}.`);
    } catch (e) {
      toast('error', e.message);
    }
  };

  return (
    <Modal
      open
      title={done ? 'Đã cấp mã mới' : `Cấp mã đầu mối: ${f.unit}`}
      onClose={onClose}
      width={600}
      footer={
        done ? (
          <Button variant="primary" onClick={onClose}>
            Xong
          </Button>
        ) : (
          <>
            <Button onClick={onClose}>Hủy</Button>
            <Button variant="primary" icon={<KeyRound size={16} />} disabled={!picked} onClick={submit}>
              Cấp mã mới
            </Button>
          </>
        )
      }
    >
      {done ? (
        <div className="space-y-3">
          <p className="text-ink-2">
            Gửi riêng mã này cho {done.name}, {done.unit}. Cán bộ đầu mối đăng nhập bằng tài khoản cá nhân như thường lệ và
            nhập mã khi gửi danh sách đề xuất, hoàn thành kiểm kê.
          </p>
          <p className="num rounded-md border border-accent-line bg-accent-soft px-4 py-3 text-center text-[24px] font-semibold tracking-widest text-accent">
            {done.code}
          </p>
          {f.status === 'dang_dung' && <p className="text-[13px] text-muted">Mã cũ {f.code} đã hết hiệu lực.</p>}
        </div>
      ) : (
        <div className="space-y-4">
          {f.status === 'dang_dung' && (
            <Notice tone="warn">
              Mã đang dùng <span className="num font-semibold">{f.code}</span> sẽ bị thu hồi ngay khi cấp mã mới.
            </Notice>
          )}
          <Field
            label="Cán bộ đầu mối (chọn từ dữ liệu cán bộ)"
            required
            hint={changed ? 'Đổi người: mã cũ hết hiệu lực; lịch sử truy cập của người cũ vẫn giữ theo mã cũ.' : 'Giữ người, chỉ đổi mã.'}
          >
            <Select value={staffId} onChange={(e) => setStaffId(e.target.value)}>
              <option value="">Chọn cán bộ của đơn vị</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.position ? ` (${p.position})` : ''}
                </option>
              ))}
            </Select>
          </Field>
          {picked && (
            <p className="text-[13px] text-muted">
              {picked.position || 'Chưa ghi chức vụ'}; điện thoại {picked.phone || 'chưa có'}.{' '}
              {picked.hasAccount ? `Tên đăng nhập ${picked.username}.` : 'Chưa có tài khoản cá nhân: cấp ở tab Tài khoản cán bộ.'}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
};

// ---------------------------------------------------------------- Tài khoản cán bộ
/** Xóa cán bộ khỏi danh sách (kèm tài khoản): hỏi xác nhận giữa màn hình rồi gọi máy chủ. */
const useDeleteStaff = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [confirm, confirmEl] = useConfirm();
  const ask = async (p) => {
    if (p.id === user.id) {
      toast('error', 'Không tự xóa chính mình.');
      return false;
    }
    const ok = await confirm({
      title: 'Xóa cán bộ',
      confirmLabel: 'Xóa cán bộ',
      message: (
        <>
          Xóa <b className="text-ink">{p.name}</b>
          {p.username || p.staffCode ? <> (<span className="num">{p.username || p.staffCode}</span>)</> : null}, {p.unit} khỏi danh sách cán bộ?
          <span className="mt-1.5 block">
            {p.hasAccount ? 'Tài khoản đăng nhập bị xóa, mọi thiết bị đăng xuất ngay. ' : ''}
            {p.focalUnit ? `Đang là cán bộ đầu mối ${p.focalUnit}: mã đầu mối bị thu hồi. ` : ''}
            Phiếu, nhật ký đã có vẫn giữ tên người này.
          </span>
        </>
      ),
    });
    if (!ok) return false;
    try {
      const r = await staffApi.remove(p.id);
      toast(
        'success',
        r && r.mode === 'hidden'
          ? `Đã xóa ${p.name} khỏi danh sách; tên vẫn hiện trong phiếu, nhật ký đã có.`
          : `Đã xóa ${p.name}.`,
      );
      return true;
    } catch (e) {
      toast('error', e.message);
      return false;
    }
  };
  return [ask, confirmEl];
};

const StaffTab = ({ staff }) => {
  const [q, setQ] = useState('');
  const [unit, setUnit] = useState('all');
  const [group, setGroup] = useState('all');
  const [acc, setAcc] = useState('all');
  const [edit, setEdit] = useState(null);
  const [issueAll, setIssueAll] = useState(false);
  const { user } = useAuth();
  const [askDelete, deleteEl] = useDeleteStaff();
  const units = useMemo(() => [...new Set(staff.map((p) => p.unit))].sort((a, b) => a.localeCompare(b, 'vi')), [staff]);
  const s = q.trim().toLowerCase();
  const rows = staff.filter(
    (p) =>
      (unit === 'all' || p.unit === unit) &&
      (group === 'all' || p.group === group) &&
      (acc === 'all' || accountState(p)[0] === acc) &&
      (!s ||
        p.name.toLowerCase().includes(s) ||
        (p.phone || '').includes(s) ||
        (p.staffCode || '').toLowerCase().includes(s) ||
        (p.username || '').toLowerCase().includes(s)),
  );
  const pager = usePaged(rows, [q, unit, group, acc]);
  return (
    <div className="rounded-[3px] border border-rule bg-surface">
      <div className="flex flex-wrap items-center gap-2 border-b border-rule-2 p-3">
        <div className="relative w-full sm:w-[240px]">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-subtle" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo họ tên, mã cán bộ" className="pl-8" />
        </div>
        <Select value={unit} onChange={(e) => setUnit(e.target.value)} className="w-auto max-w-[240px]" aria-label="Đơn vị">
          <option value="all">Tất cả đơn vị</option>
          {units.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </Select>
        <Select value={group} onChange={(e) => setGroup(e.target.value)} className="w-auto max-w-[200px]" aria-label="Vai trò">
          <option value="all">Tất cả vai trò</option>
          {Object.keys(STAFF_GROUP).map((g) => (
            <option key={g} value={g}>
              {STAFF_GROUP[g]}
            </option>
          ))}
        </Select>
        <Select value={acc} onChange={(e) => setAcc(e.target.value)} className="w-auto max-w-[200px]" aria-label="Tài khoản">
          <option value="all">Mọi trạng thái tài khoản</option>
          {['Chưa cấp tài khoản', 'Chưa đăng nhập lần đầu', 'Đang hoạt động', 'Đã khóa'].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </Select>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <Button icon={<UserPlus size={16} />} onClick={() => setIssueAll(true)} title="Cấp tài khoản cho mọi cán bộ chưa có (theo đơn vị đang lọc)">
            Cấp tài khoản hàng loạt
          </Button>
          <ImportButton label="Nhập Excel" hint="Danh sách cán bộ: Mã số hiệu CBCCVC, Họ tên, Đơn vị, Chức vụ hiện tại (.xlsx)" />
          <Button variant="create" icon={<Plus size={16} />} onClick={() => setEdit({})}>
            Thêm cán bộ
          </Button>
        </div>
      </div>
      <Table>
        <thead>
          <tr>
            <Th>Họ tên, tên đăng nhập</Th>
            <Th>Đơn vị</Th>
            <Th>Chức vụ</Th>
            <Th>Vai trò trên SAM</Th>
            <Th>Tài khoản</Th>
            <Th>Mã xác nhận</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {pager.pageRows.map((p) => {
            const [st, tone] = accountState(p);
            return (
              <tr key={p.id} className="hover:bg-sunken">
                <Td className="min-w-[180px]">
                  {p.name}
                  <div className="num text-[12.5px] text-muted">{p.username || p.staffCode || 'Chưa có mã số cán bộ'}</div>
                </Td>
                <Td className="min-w-[170px]">{p.unit}</Td>
                <Td className="whitespace-nowrap">{p.position || <span className="text-subtle">—</span>}</Td>
                <Td className="whitespace-nowrap">
                  <Pill tone={ROLE_TONE[p.group] || 'neutral'}>{STAFF_GROUP[p.group] || p.group}</Pill>
                </Td>
                <Td className="whitespace-nowrap">
                  <Pill tone={tone}>{st}</Pill>
                  {p.lastLoginAt && <div className="num mt-0.5 text-[12px] text-muted">Đăng nhập {dateTimeVN(p.lastLoginAt)}</div>}
                </Td>
                <Td className="whitespace-nowrap">
                  {p.personalCode ? (
                    <span className="num font-semibold tracking-wide text-ink">{p.personalCode}</span>
                  ) : (
                    <span className="text-subtle">—</span>
                  )}
                </Td>
                <Td right className="whitespace-nowrap">
                  <span className="inline-flex gap-1.5">
                    <Button size="sm" onClick={() => setEdit(p)}>
                      Sửa
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      icon={<Trash2 size={14} />}
                      disabled={p.id === user.id}
                      title={p.id === user.id ? 'Không tự xóa chính mình' : 'Xóa cán bộ khỏi danh sách (kèm tài khoản)'}
                      onClick={() => askDelete(p)}
                    >
                      Xóa
                    </Button>
                  </span>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      <Pager pager={pager} />
      {rows.length === 0 && <Empty title="Không có cán bộ nào khớp bộ lọc." />}
      <p className="border-t border-rule-2 px-3 py-2 text-[12.5px] text-muted">
        Mọi tài khoản có quyền của cán bộ, giảng viên (báo hỏng, theo dõi phiếu của mình). Tên đăng nhập mặc định là mã số
        cán bộ; mật khẩu ban đầu chỉ hiện một lần khi cấp. Khóa tài khoản hoặc đặt lại mật khẩu thì mọi thiết bị đăng xuất
        ngay. Xóa: bỏ cán bộ khỏi danh sách cùng tài khoản; phiếu, nhật ký đã có vẫn giữ tên người đó.
      </p>
      {deleteEl}
      {edit && <StaffModal p={edit} onClose={() => setEdit(null)} />}
      {issueAll && <IssueAllModal unit={unit === 'all' ? '' : unit} onClose={() => setIssueAll(false)} />}
    </div>
  );
};

/** Mật khẩu ban đầu vừa cấp: hiện một lần để in hoặc gửi riêng. */
const SlipBox = ({ slip }) => (
  <div className="rounded-md border border-accent-line bg-accent-soft p-3.5">
    <KV
      items={[
        ['Tên đăng nhập', <span className="num font-semibold">{slip.username}</span>],
        ['Mật khẩu ban đầu', <span className="num text-[16px] font-semibold tracking-wider text-accent">{slip.password}</span>],
      ]}
    />
    <p className="mt-2 text-[12.5px] text-muted">
      Mật khẩu chỉ hiện lần này. Gửi riêng cho {slip.name}; đăng nhập lần đầu phải đổi mật khẩu.
    </p>
    <Button size="sm" className="mt-2" icon={<Printer size={14} />} onClick={() => printSlips([slip])}>
      In phiếu tài khoản
    </Button>
  </div>
);

const StaffModal = ({ p, onClose }) => {
  const { user } = useAuth();
  const toast = useToast();
  const { data: units } = useApi(() => catalogApi.units(), []);
  const isNew = !p.id;
  const [v, setV] = useState({
    name: p.name || '',
    staffCode: p.staffCode || '',
    unit: p.unit || '',
    position: p.position || '',
    phone: p.phone || '',
    email: p.email || '',
    group: p.group || 'canbo',
  });
  const [cur, setCur] = useState(p); // bản mới nhất sau mỗi thao tác tài khoản
  const [slip, setSlip] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirm, confirmEl] = useConfirm();
  const [askDelete, deleteEl] = useDeleteStaff();
  const self = cur.id === user.id;
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });

  const run = async (fn, ok) => {
    setBusy(true);
    try {
      const res = await fn();
      if (ok) toast('success', ok(res));
      return res;
    } catch (e) {
      toast('error', e.message);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!v.name.trim() || !v.unit) return;
    if (isNew) {
      const rec = await run(() => staffApi.create(v, user));
      if (!rec) return;
      toast('success', rec.code ? `Đã thêm ${rec.name}, mã xác nhận ${rec.code}.` : `Đã thêm ${rec.name}. Cấp tài khoản ở nút Sửa.`);
      onClose();
    } else {
      const patch = { ...v, group: v.group === p.group || p.group === 'daumoi' ? undefined : v.group };
      if (await run(() => staffApi.update(p.id, patch), () => `Đã lưu ${v.name}.`)) onClose();
    }
  };

  const issue = async () => {
    if (
      cur.hasAccount &&
      !(await confirm({
        title: 'Đặt lại mật khẩu',
        message: `Đặt lại mật khẩu cho ${cur.name}? Mật khẩu cũ hết hiệu lực, mọi thiết bị đang đăng nhập bị đăng xuất; ${cur.name} đăng nhập bằng mật khẩu mới rồi tự đổi.`,
        confirmLabel: 'Đặt lại mật khẩu',
        tone: 'primary',
      }))
    )
      return;
    const res = await run(() => staffApi.issueAccount(cur.id), (r) => `${cur.hasAccount ? 'Đã đặt lại mật khẩu' : 'Đã cấp tài khoản'} cho ${r.name}.`);
    if (res) {
      setSlip(res);
      setCur({ ...cur, hasAccount: true, username: res.username, active: true, mustChangePassword: true });
    }
  };

  return (
    <Modal
      open
      title={isNew ? 'Thêm cán bộ' : `Sửa: ${p.name}`}
      onClose={onClose}
      width={720}
      footer={
        <>
          {!isNew && (
            <Button
              variant="danger"
              icon={<Trash2 size={16} />}
              className="mr-auto"
              disabled={busy || self}
              title={self ? 'Không tự xóa chính mình' : 'Xóa cán bộ khỏi danh sách (kèm tài khoản)'}
              onClick={async () => {
                if (await askDelete(cur)) onClose();
              }}
            >
              Xóa cán bộ
            </Button>
          )}
          <Button onClick={onClose}>{slip ? 'Đóng' : 'Hủy'}</Button>
          <Button variant="primary" disabled={!v.name.trim() || !v.unit || busy} onClick={save}>
            Lưu
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Họ tên" required>
            <Input value={v.name} onChange={set('name')} />
          </Field>
          <Field label="Mã số cán bộ" hint="Dùng làm tên đăng nhập.">
            <Input value={v.staffCode} onChange={set('staffCode')} className="num" disabled={!isNew && !!p.username} />
          </Field>
          <Field label="Đơn vị" required>
            <Select value={v.unit} onChange={set('unit')}>
              <option value="">Chọn đơn vị</option>
              {(units || []).map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Chức vụ" hint="Chỉ để in trên biểu mẫu; không phải vai trò trên SAM.">
            <Input value={v.position} onChange={set('position')} />
          </Field>
          <Field label="Số điện thoại">
            <Input value={v.phone} onChange={set('phone')} />
          </Field>
          <Field label="Email">
            <Input value={v.email} onChange={set('email')} type="email" />
          </Field>
          <Field
            label="Vai trò trên SAM"
            className="sm:col-span-2"
            hint={
              p.group === 'daumoi'
                ? 'Đang là cán bộ đầu mối: đổi người hoặc thu hồi ở tab Mã cán bộ đầu mối.'
                : 'Mọi tài khoản đều báo hỏng, theo dõi phiếu của mình như cán bộ, giảng viên. Kỹ thuật viên, lãnh đạo Phòng QTNL được cấp mã xác nhận cá nhân khi lưu.'
            }
          >
            {p.group === 'daumoi' ? (
              <Input value={STAFF_GROUP.daumoi} disabled />
            ) : (
              <Select value={v.group} onChange={set('group')} className="max-w-[320px]">
                {SETTABLE_GROUPS.map((g) => (
                  <option key={g} value={g}>
                    {STAFF_GROUP[g]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        {!isNew && (
          <div className="rounded-md border border-rule p-3.5">
            <p className="mb-2 font-semibold">Tài khoản cá nhân</p>
            <KV
              items={[
                ['Tên đăng nhập', cur.username || 'Chưa cấp'],
                ['Trạng thái', accountState(cur)[0]],
                ['Đăng nhập gần nhất', cur.lastLoginAt ? dateTimeVN(cur.lastLoginAt) : '—'],
                ['Mã xác nhận', cur.personalCode || '—'],
              ]}
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant={cur.hasAccount ? 'secondary' : 'primary'} icon={<KeyRound size={14} />} disabled={busy} onClick={issue}>
                {cur.hasAccount ? 'Đặt lại mật khẩu' : 'Cấp tài khoản'}
              </Button>
              {cur.hasAccount && (
                <Button
                  size="sm"
                  variant={cur.active ? 'danger' : 'secondary'}
                  disabled={busy || cur.id === user.id}
                  onClick={async () => {
                    if (
                      cur.active &&
                      !(await confirm({
                        title: 'Khóa tài khoản',
                        message: `Khóa tài khoản của ${cur.name}? Mọi thiết bị đăng xuất ngay, không đăng nhập được cho đến khi mở khóa.`,
                        confirmLabel: 'Khóa tài khoản',
                      }))
                    )
                      return;
                    const r = await run(() => staffApi.setActive(cur.id, !cur.active), (x) => (x.active ? 'Đã mở khóa tài khoản.' : 'Đã khóa tài khoản; mọi thiết bị đã đăng xuất.'));
                    if (r) setCur({ ...cur, ...r });
                  }}
                >
                  {cur.active ? 'Khóa tài khoản' : 'Mở khóa'}
                </Button>
              )}
              {cur.hasAccount && cur.active && (
                <Button
                  size="sm"
                  variant="danger"
                  icon={<LogOut size={14} />}
                  disabled={busy}
                  onClick={async () => {
                    const ok = await confirm({
                      title: 'Đăng xuất mọi thiết bị',
                      message: `Đăng xuất ${cur.name} trên mọi máy tính, điện thoại đang đăng nhập? Người đó phải đăng nhập lại và thôi nhận thông báo đẩy cho đến khi bật lại.`,
                      confirmLabel: 'Đăng xuất tất cả',
                    });
                    if (ok) await run(() => staffApi.logoutAll(cur.id), (r) => `Đã đăng xuất ${r.revoked} phiên trên các thiết bị.`);
                  }}
                >
                  Đăng xuất mọi thiết bị
                </Button>
              )}
              {cur.hasAccount && (
                <Button
                  size="sm"
                  variant="danger"
                  icon={<Trash2 size={14} />}
                  disabled={busy || self}
                  title={self ? 'Không tự xóa tài khoản của chính mình' : 'Xóa tên đăng nhập, mật khẩu; giữ dữ liệu cán bộ và lịch sử'}
                  onClick={async () => {
                    const ok = await confirm({
                      title: 'Xóa tài khoản',
                      message: (
                        <>
                          Xóa tài khoản đăng nhập của <b className="text-ink">{cur.name}</b>
                          {cur.username ? <> (tên đăng nhập <span className="num font-semibold text-ink">{cur.username}</span>)</> : null}?
                          <span className="mt-1.5 block">
                            Người này không đăng nhập được nữa, mọi thiết bị đăng xuất ngay. Dữ liệu cán bộ, vai trò và lịch sử phiếu vẫn
                            giữ; cần thì bấm Cấp tài khoản để cấp lại.
                          </span>
                        </>
                      ),
                      confirmLabel: 'Xóa tài khoản',
                    });
                    if (!ok) return;
                    const r = await run(() => staffApi.deleteAccount(cur.id), () => `Đã xóa tài khoản của ${cur.name}.`);
                    if (r) {
                      setSlip(null);
                      setCur({ ...cur, ...r });
                    }
                  }}
                >
                  Xóa tài khoản
                </Button>
              )}
              {['ktv', 'lanhdao_qtnl'].includes(cur.group) && (
                <Button
                  size="sm"
                  icon={<KeyRound size={14} />}
                  disabled={busy}
                  onClick={async () => {
                    const r = await run(() => staffApi.reissueCode(cur.id), (x) => `Mã xác nhận mới: ${x.code}. Mã cũ hết hiệu lực.`);
                    if (r) setCur({ ...cur, ...r, personalCode: r.code });
                  }}
                >
                  Đổi mã xác nhận
                </Button>
              )}
            </div>
            {slip && <div className="mt-3"><SlipBox slip={slip} /></div>}
          </div>
        )}
      </div>
      {confirmEl}
      {deleteEl}
    </Modal>
  );
};

const IssueAllModal = ({ unit, onClose }) => {
  const toast = useToast();
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      open
      title="Cấp tài khoản hàng loạt"
      onClose={onClose}
      width={760}
      footer={
        res ? (
          <>
            {res.issued.length > 0 && (
              <Button icon={<Printer size={16} />} onClick={() => printSlips(res.issued)}>
                In danh sách tài khoản
              </Button>
            )}
            <Button variant="primary" onClick={onClose}>
              Xong
            </Button>
          </>
        ) : (
          <>
            <Button onClick={onClose}>Hủy</Button>
            <Button
              variant="primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const r = await staffApi.issueAll(unit);
                  setRes(r);
                  toast('success', `Đã cấp ${r.issued.length} tài khoản.`);
                } catch (e) {
                  toast('error', e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Cấp tài khoản
            </Button>
          </>
        )
      }
    >
      {!res ? (
        <Notice>
          Cấp tài khoản cho mọi cán bộ chưa có {unit ? `của ${unit}` : 'trong dữ liệu cán bộ'}: tên đăng nhập là mã số cán bộ,
          mật khẩu ban đầu ngẫu nhiên (chỉ hiện một lần để in, gửi riêng). Cán bộ chưa có mã số cán bộ được bỏ qua.
        </Notice>
      ) : (
        <div className="space-y-3">
          {res.issued.length > 0 && (
            <Table>
              <thead>
                <tr>
                  <Th>Họ tên</Th>
                  <Th>Đơn vị</Th>
                  <Th>Tên đăng nhập</Th>
                  <Th>Mật khẩu ban đầu</Th>
                </tr>
              </thead>
              <tbody>
                {res.issued.map((x) => (
                  <tr key={x.staffId}>
                    <Td>{x.name}</Td>
                    <Td>{x.unit}</Td>
                    <Td className="num">{x.username}</Td>
                    <Td className="num font-semibold text-accent">{x.password}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          {res.skipped.length > 0 && (
            <Notice tone="warn" title={`Bỏ qua ${res.skipped.length} cán bộ`}>
              {res.skipped.map((x) => `${x.name} (${x.reason})`).join('; ')}.
            </Notice>
          )}
          <p className="text-[12.5px] text-muted">Mật khẩu chỉ hiện lần này. In danh sách để gửi riêng từng cán bộ.</p>
        </div>
      )}
    </Modal>
  );
};

const RevokeModal = ({ f, onClose }) => {
  const { user } = useAuth();
  const toast = useToast();
  const [reason, setReason] = useState('');
  return (
    <Modal
      open
      title={`Thu hồi mã ${f.code}`}
      onClose={onClose}
      width={560}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button
            variant="danger"
            disabled={!reason.trim()}
            onClick={async () => {
              try {
                await focalApi.revoke(f.id, reason.trim(), user);
                toast('info', `Đã thu hồi mã của ${f.unit}. ${f.name} trở lại vai trò cán bộ, giảng viên.`);
                onClose();
              } catch (e) {
                toast('error', e.message);
              }
            }}
          >
            Thu hồi mã
          </Button>
        </>
      }
    >
      <p className="mb-3 text-ink-2">
        {f.unit}, cán bộ đầu mối {f.name}. Thu hồi có hiệu lực ngay: người này thôi vai trò cán bộ đầu mối (tài khoản cá
        nhân vẫn dùng để báo hỏng như cán bộ, giảng viên); lịch sử truy cập vẫn giữ.
      </p>
      <Field label="Lý do" required>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ví dụ: cán bộ đầu mối nghỉ hưu, đơn vị chưa cử người thay" />
      </Field>
    </Modal>
  );
};

export default AccountsPage;
