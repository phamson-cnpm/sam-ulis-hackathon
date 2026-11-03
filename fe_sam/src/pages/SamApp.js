
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Bell,
  BellOff,
  BellRing,
  History,
  Building2,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  FilePlus2,
  Gauge,
  Inbox,
  KeyRound,
  ListTree,
  LayoutList,
  ListChecks,
  LockKeyhole,
  LogOut,
  Menu,
  MonitorSmartphone,
  SlidersHorizontal,
  Stamp,
  UsersRound,
  Vote,
  X,
} from 'lucide-react';
import { useAuth } from '../utils/AuthContext';
import { useToast } from '../utils/ToastContext';
import { ROLE_LABEL } from '../utils/labels';
import { metaApi, notificationsApi } from '../utils/api';
import { useApi } from '../hooks/useApi';
import { dateTimeVN, dateVN, initials } from '../utils/format';
import { TODAY, ORG_NAME } from '../config/app';
import { Button, Field, Input, Modal, Notice, cx, useConfirm } from '../components/ui';
import { disablePush, enablePush, pushState, pushSupport } from '../utils/push';
import ConfirmCodeDialog from '../components/ConfirmCodeDialog';
import { TabTitleContext } from '../utils/TabContext';
import LoginPage from './LoginPage';
import ReportPage from './ReportPage';
import MyReportsPage from './MyReportsPage';
import QueuePage from './QueuePage';
import CasePage from './CasePage';
import EstimatesPage from './EstimatesPage';
import ApprovalsPage from './ApprovalsPage';
import AssetsPage from './AssetsPage';
import AssetDetailPage from './AssetDetailPage';
import DashboardPage from './DashboardPage';
import ExceptionsPage from './ExceptionsPage';
import ThresholdsPage from './ThresholdsPage';
import UnitAssetsPage from './UnitAssetsPage';
import AccountsPage from './AccountsPage';
import ProposalsPage from './ProposalsPage';
import LightsGuidePage from './LightsGuidePage';
import HandoversPage from './HandoversPage';
import ExportLogsPage from './ExportLogsPage';
import CatalogPage from './CatalogPage';

// Menu theo vai trò (mục VII đề tài), xếp ngang trên cùng như phần mềm cũ; short: tên ngắn trên thanh menu.
// count: số việc đang chờ, hiện ô số đỏ.
// Mọi tài khoản cá nhân có quyền của cán bộ, giảng viên (báo hỏng, theo dõi phiếu của mình).
// Giải thích đèn: trong menu Bắt đầu và nút (?) trên thanh trên cùng (không chiếm chỗ trên thanh menu ngang).
// strip: 'wide' = chỉ hiện trên thanh menu ngang khi màn hình rộng.
const LIGHTS = { tab: 'lights', label: 'Giải thích đèn', Icon: CircleHelp, strip: false };
const NAV = {
  canbo: [
    { tab: 'report-new', label: 'Báo hỏng', Icon: FilePlus2 },
    { tab: 'my-reports', label: 'Phiếu của tôi', Icon: ClipboardList },
  ],
  ktv: [
    { tab: 'queue', label: 'Hàng chờ phiếu', short: 'Hàng chờ', Icon: Inbox, count: 'queue' },
    { tab: 'estimates', label: 'Dự toán', Icon: ListChecks },
    { tab: 'proposals', label: 'Đề xuất xử lý', short: 'Đề xuất', Icon: Vote, count: 'proposals' },
    { tab: 'handovers', label: 'Thu hồi tài sản hỏng', short: 'Thu hồi', Icon: ArrowLeftRight, count: 'handovers' },
    { tab: 'report-new', label: 'Lập phiếu báo hỏng', short: 'Báo hỏng', Icon: FilePlus2 },
    { tab: 'assets', label: 'Thẻ tài sản', Icon: LayoutList },
    LIGHTS,
    { tab: 'dashboard', label: 'Tổng quan', Icon: Gauge },
    { tab: 'catalog', label: 'Danh mục', Icon: ListTree },
  ],
  lanhdao_qtnl: [
    { tab: 'approvals', label: 'Chờ xác nhận', Icon: Stamp, count: 'approvals' },
    { tab: 'queue', label: 'Hàng chờ phiếu', short: 'Hàng chờ', Icon: Inbox },
    { tab: 'estimates', label: 'Dự toán', Icon: ListChecks },
    { tab: 'handovers', label: 'Thu hồi tài sản hỏng', short: 'Thu hồi', Icon: ArrowLeftRight },
    { tab: 'report-new', label: 'Lập phiếu báo hỏng', short: 'Báo hỏng', Icon: FilePlus2 },
    { tab: 'assets', label: 'Thẻ tài sản', Icon: LayoutList },
    LIGHTS,
    { tab: 'dashboard', label: 'Tổng quan', Icon: Gauge },
    { tab: 'catalog', label: 'Danh mục', Icon: ListTree },
  ],
  khtc: [
    { tab: 'dashboard', label: 'Tổng quan', Icon: Gauge },
    { tab: 'assets', label: 'Thẻ tài sản', Icon: LayoutList },
    { tab: 'proposals', label: 'Đề xuất xử lý', short: 'Đề xuất', Icon: Vote, count: 'proposals' },
    { tab: 'exceptions', label: 'Đề nghị ngoại lệ', short: 'Ngoại lệ', Icon: KeyRound, count: 'exceptions' },
    { tab: 'handovers', label: 'Thu hồi tài sản hỏng', short: 'Thu hồi', Icon: ArrowLeftRight, count: 'handovers' },
    { tab: 'queue', label: 'Hàng chờ phiếu (chỉ xem)', short: 'Phiếu báo hỏng', Icon: Inbox },
    { tab: 'estimates', label: 'Đối chiếu chi phí', short: 'Đối chiếu', Icon: ListChecks },
    { tab: 'thresholds', label: 'Ngưỡng cảnh báo', short: 'Ngưỡng', Icon: SlidersHorizontal, strip: 'wide' },
    LIGHTS,
    { tab: 'accounts', label: 'Tài khoản, mã xác nhận', short: 'Tài khoản', Icon: UsersRound },
    { tab: 'export-logs', label: 'Nhật ký xuất file', short: 'Nhật ký', Icon: History, strip: 'wide' },
  ],
  daumoi: [
    { tab: 'unit-assets', label: 'Tài sản toàn trường', short: 'Thẻ tài sản', Icon: Building2 },
    { tab: 'proposals', label: 'Đề xuất của đơn vị', short: 'Đề xuất', Icon: Vote },
    LIGHTS,
    { tab: 'report-new', label: 'Báo hỏng', Icon: FilePlus2 },
    { tab: 'my-reports', label: 'Phiếu của tôi', Icon: ClipboardList },
  ],
};

// Cán bộ Phòng KHTC đăng nhập tài khoản cá nhân (vai trò quản trị) vẫn báo hỏng như mọi cán bộ;
// tài khoản quản trị hệ thống (tạo từ .env) không báo hỏng.
const navFor = (user, session) => {
  const items = NAV[user.role] || NAV.canbo;
  if (user.role === 'khtc' && session && session.accountKind === 'staff') {
    return [...items, { tab: 'report-new', label: 'Báo hỏng', Icon: FilePlus2 }, { tab: 'my-reports', label: 'Phiếu của tôi', Icon: ClipboardList }];
  }
  return items;
};

// Trang mở đầu của từng vai trò
const DEFAULT_TAB = {
  canbo: 'report-new',
  ktv: 'queue',
  lanhdao_qtnl: 'approvals',
  khtc: 'dashboard',
  daumoi: 'unit-assets',
};

// Trang chi tiết thì sáng mục menu cha
const PARENT_TAB = { case: 'queue', asset: 'assets' };

const FULL_ROLES = ['ktv', 'lanhdao_qtnl', 'khtc'];
/**
 * Liên kết của thông báo (trong chuông hoặc thông báo đẩy, dạng "tab:id") → [trang, tham số] theo vai trò.
 * Bấm thông báo mở thẳng đúng phiếu, đúng màn hình cần xử lý (mục 5.9 đề tài).
 */
export function linkTarget(link, role) {
  if (!link) return null;
  const [head, ...rest] = String(link).split(':');
  const tail = rest.join(':');
  switch (head) {
    case 'case':
      return FULL_ROLES.includes(role) ? ['case', { reportId: tail }] : ['my-reports', {}];
    case 'approvals': {
      if (role !== 'lanhdao_qtnl') return null;
      if (tail.startsWith('proposal:')) return ['approvals', { section: 'proposal', proposalId: tail.slice(9) }];
      return ['approvals', { section: tail || 'estimates' }];
    }
    case 'proposals':
      if (role === 'lanhdao_qtnl') return ['approvals', { section: 'dx', proposalId: tail || undefined }];
      if (['ktv', 'khtc', 'daumoi'].includes(role)) return ['proposals', { section: 'all', proposalId: tail || undefined }];
      return null;
    case 'asset':
      return FULL_ROLES.includes(role) ? ['asset', { assetId: tail }] : null;
    case 'my-reports':
    case 'queue':
    case 'estimates':
    case 'exceptions':
    case 'handovers':
      return [head, {}];
    default:
      return null;
  }
}

const useClickOutside = (ref, onOutside) => {
  useEffect(() => {
    const handle = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onOutside();
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [ref, onOutside]);
};

const Avatar = ({ user, size = 30 }) => (
  <span
    className="inline-flex shrink-0 items-center justify-center rounded-full bg-white font-semibold text-band"
    style={{ width: size, height: size, fontSize: size * 0.38 }}
  >
    {initials(user.name)}
  </span>
);

// Tải lại định kỳ (người khác thao tác trên máy khác) và khi quay lại cửa sổ
const usePoll = (ms) => {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), ms);
    const onFocus = () => setTick((t) => t + 1);
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, [ms]);
  return tick;
};

// Số việc chờ trên menu: tải lại mỗi phút, khi chuyển tab; cũng là lần kiểm tra phiên (tài khoản bị khóa thì đăng xuất)
const useCounts = (activeTab, userId) => {
  const tick = usePoll(60000);
  const { data } = useApi(() => (userId ? metaApi.counts() : null), [tick, activeTab, userId]);
  return data || {};
};

const Badge = ({ n }) =>
  n > 0 ? (
    <span className="num min-w-[17px] rounded-full bg-[#e5393b] px-1 text-center text-[10.5px] leading-[17px] font-semibold text-white">
      {n}
    </span>
  ) : null;

/** Menu đầy đủ (nút "Bắt đầu" trên máy tính, ngăn kéo trên điện thoại). */
const FullMenu = ({ user, items, counts, current, onNavigate }) => (
  <div>
    <div className="bg-band px-4 py-3 text-white">
      <p className="text-[18px] leading-none font-bold tracking-tight">SAM</p>
      <p className="mt-1 text-[12.5px] text-white/85">Quản lý tài sản thông minh</p>
      <p className="mt-1.5 text-[12px] text-white/75">
        {ROLE_LABEL[user.role]}
        {user.role === 'daumoi' && user.focalUnit ? `, ${user.focalUnit}` : ''}
      </p>
      <p className="mt-0.5 text-[12px] text-white/75">
        Ngày làm việc <span className="num font-semibold text-white">{dateVN(TODAY)}</span>
      </p>
    </div>
    <nav className="flex flex-col py-1" aria-label="Chức năng">
      {items.map(({ tab, label, Icon, count }) => {
        const active = current === tab;
        return (
          <button
            key={tab}
            onClick={() => onNavigate(tab)}
            className={cx(
              'flex h-9 items-center gap-2.5 px-4 text-left text-[13.5px]',
              active ? 'bg-accent-soft font-semibold text-accent' : 'text-ink-2 hover:bg-sunken',
            )}
          >
            <Icon size={16} className={active ? 'text-accent' : 'text-muted'} />
            <span className="flex-1">{label}</span>
            <Badge n={count ? counts[count] || 0 : 0} />
          </button>
        );
      })}
    </nav>
    <p className="border-t border-rule-2 px-4 py-2 text-[12px] text-subtle">{ORG_NAME}</p>
  </div>
);

/** Ô "Menu": gõ tên chức năng để mở nhanh, như ô Menu của phần mềm cũ. */
const MenuSearch = ({ items, onNavigate }) => {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false));
  const norm = (x) =>
    String(x)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .toLowerCase();
  const hits = q.trim() ? items.filter((it) => norm(it.label).includes(norm(q.trim()))) : items;
  const go = (it) => {
    onNavigate(it.tab);
    setQ('');
    setOpen(false);
  };
  return (
    <div className="relative hidden xl:block" ref={ref}>
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && hits[0]) go(hits[0]);
          if (e.key === 'Escape') setOpen(false);
        }}
        placeholder="Menu"
        aria-label="Tìm chức năng"
        className="h-8 w-[150px] rounded-[3px] border border-[#cdd2d7] bg-surface px-2.5 text-[13px] text-ink placeholder:text-subtle focus:border-accent focus:outline-none"
      />
      {open && hits.length > 0 && (
        <ul className="absolute right-0 z-50 mt-1 max-h-[320px] w-[240px] overflow-y-auto rounded-[3px] border border-rule bg-surface py-1 shadow-[0_8px_24px_rgba(28,36,48,0.16)]">
          {hits.map((it) => (
            <li key={it.tab}>
              <button onClick={() => go(it)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-sunken">
                <it.Icon size={15} className="text-muted" /> {it.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/** Thanh menu trên cùng kiểu phần mềm cũ: ☰ Bắt đầu ▾, các chức năng xếp ngang; bên phải ô Menu, trợ giúp, chuông, tài khoản. */
const TopBar = ({ user, items, counts, current, onNavigate, onOpenDrawer }) => {
  const [start, setStart] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setStart(false));
  const hasLights = items.some((it) => it.tab === 'lights');
  return (
    <header className="no-print sticky top-0 z-30 flex h-[46px] items-stretch border-b border-[#cfd4d9] bg-gradient-to-b from-white to-[#f1f3f5]">
      <button
        className="flex items-center px-3 text-ink-2 hover:bg-rule-2 lg:hidden"
        onClick={onOpenDrawer}
        aria-label="Mở menu"
      >
        <Menu size={20} />
      </button>
      <div className="relative hidden lg:flex" ref={ref}>
        <button
          onClick={() => setStart((o) => !o)}
          className={cx('flex items-center gap-1.5 border-r border-rule px-3 text-[13.5px] text-ink hover:bg-rule-2', start && 'bg-rule-2')}
          aria-expanded={start}
        >
          <Menu size={17} /> Bắt đầu <ChevronDown size={14} className="text-muted" />
        </button>
        {start && (
          <div className="absolute top-full left-0 z-50 mt-px w-[280px] overflow-hidden rounded-b-[3px] border border-rule bg-surface shadow-[0_12px_32px_rgba(28,36,48,0.18)]">
            <FullMenu
              user={user}
              items={items}
              counts={counts}
              current={current}
              onNavigate={(t) => {
                setStart(false);
                onNavigate(t);
              }}
            />
          </div>
        )}
      </div>
      <span className="flex items-center px-3 text-[17px] font-bold tracking-tight text-band lg:hidden">SAM</span>
      <nav className="hidden min-w-0 flex-1 items-stretch overflow-x-auto lg:flex [&::-webkit-scrollbar]:hidden" aria-label="Chức năng">
        {items.filter((it) => it.strip !== false).map(({ tab, label, short, Icon, count, strip }) => {
          const active = current === tab;
          return (
            <button
              key={tab}
              onClick={() => onNavigate(tab)}
              title={label}
              className={cx(
                'relative shrink-0 items-center gap-1.5 px-2.5 text-[13.5px] whitespace-nowrap',
                // Mục ít dùng chỉ hiện trên màn hình rộng; luôn có trong menu Bắt đầu và ô Menu
                strip === 'wide' && !active ? 'hidden 2xl:flex' : 'flex',
                active ? 'bg-white font-semibold text-band' : 'text-ink-2 hover:bg-rule-2 hover:text-ink',
              )}
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={16} className={active ? 'text-band' : 'text-[#56606b]'} />
              {short || label}
              <Badge n={count ? counts[count] || 0 : 0} />
              {active && <span className="absolute inset-x-2 bottom-0 h-[3px] rounded-t bg-band" />}
            </button>
          );
        })}
      </nav>
      <div className="ml-auto flex shrink-0 items-center gap-1.5 bg-band px-2.5 sm:gap-2 lg:rounded-bl-[3px]">
        <span className="hidden text-[12.5px] whitespace-nowrap text-white/80 2xl:inline" title="Ngày làm việc theo máy chủ">
          Ngày làm việc <span className="num font-semibold text-white">{dateVN(TODAY)}</span>
        </span>
        <MenuSearch items={items} onNavigate={onNavigate} />
        {hasLights && (
          <button
            onClick={() => onNavigate('lights')}
            className="hidden rounded p-1.5 text-white/90 hover:bg-white/15 sm:block"
            title="Giải thích đèn"
            aria-label="Giải thích đèn"
          >
            <CircleHelp size={18} />
          </button>
        )}
        <NotificationBell user={user} onNavigate={onNavigate} />
        <AccountMenu user={user} />
      </div>
    </header>
  );
};

/** Dải tab màu xanh lam đậm dưới thanh menu: mỗi chức năng, hồ sơ đang mở là một tab, bấm × để đóng. */
const TabBand = ({ tabs, activeId, titleOf, onSelect, onClose }) => (
  <div className="no-print sticky top-[46px] z-20 flex h-[34px] items-end gap-0.5 overflow-x-auto bg-band px-2 [&::-webkit-scrollbar]:hidden">
    {tabs.map((t) => {
      const active = t.id === activeId;
      return (
        <div
          key={t.id}
          className={cx(
            'flex h-[28px] shrink-0 items-center gap-1 rounded-t-[3px] pr-1 pl-3 text-[13px] whitespace-nowrap',
            active ? 'bg-paper font-semibold text-ink' : 'bg-band-light/50 text-white/90 hover:bg-band-light',
          )}
        >
          <button onClick={() => onSelect(t.id)} className="max-w-[220px] truncate" title={titleOf(t)}>
            {titleOf(t)}
          </button>
          <button
            onClick={() => onClose(t.id)}
            className={cx('ml-1 rounded p-0.5', active ? 'text-muted hover:bg-rule-2 hover:text-ink' : 'text-white/75 hover:bg-white/15 hover:text-white')}
            aria-label={`Đóng tab ${titleOf(t)}`}
            title="Đóng"
          >
            <X size={14} />
          </button>
        </div>
      );
    })}
  </div>
);

/** Bật, tắt "Thông báo về máy này" (Web Push). Trình duyệt chỉ hỏi quyền sau một lần bấm. */
const PushToggle = ({ user }) => {
  const toast = useToast();
  const [st, setSt] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    pushState().then((x) => alive && setSt(x));
    return () => {
      alive = false;
    };
  }, [user.id]);

  const support = st ? st.support : pushSupport();
  const on = !!(st && st.on);
  const toggle = async () => {
    setBusy(true);
    try {
      if (on) {
        await disablePush();
        toast('info', 'Đã tắt thông báo về máy này. Danh sách thông báo trong chuông vẫn giữ.');
      } else {
        await enablePush();
        toast('success', 'Đã bật thông báo về máy này.');
      }
      setSt(await pushState());
    } catch (e) {
      toast('error', e.message);
      setSt(await pushState().catch(() => st));
    } finally {
      setBusy(false);
    }
  };

  let note = null;
  if (!support.ok) note = support.message;
  else if (st && !st.serverEnabled) note = 'Máy chủ SAM chưa bật thông báo đẩy.';
  else if (st && st.permission === 'denied') note = 'Bạn đã chặn thông báo của SAM: bật lại trong cài đặt trang web của trình duyệt.';

  return (
    <div className="border-b border-rule-2 px-4 py-2.5">
      <div className="flex items-center gap-3">
        {on ? <BellRing size={18} className="text-accent" /> : <MonitorSmartphone size={18} className="text-muted" />}
        <div className="flex-1">
          <p className="text-[13.5px] font-medium">Thông báo về máy này</p>
          <p className="text-[12px] text-muted">{on ? 'Đang bật: nhận thông báo đẩy kể cả khi không mở SAM.' : 'Bật để nhận thông báo đẩy về điện thoại, máy tính này.'}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Thông báo về máy này"
          disabled={busy || !support.ok || (st && !st.serverEnabled)}
          onClick={toggle}
          className={cx(
            'relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40',
            on ? 'bg-accent' : 'bg-[#c9cfd6]',
          )}
        >
          <span className={cx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', on ? 'left-[22px]' : 'left-0.5')} />
        </button>
      </div>
      {note && <p className="mt-1.5 text-[12px] text-l-amber">{note}</p>}
    </div>
  );
};

const NotificationBell = ({ user, onNavigate }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false));
  const tick = usePoll(60000);
  const { data: notes } = useApi(() => notificationsApi.list(), [user.id, tick]);
  const unread = (notes || []).filter((n) => !n.read).length;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          setOpen((o) => !o);
          if (!open && unread) notificationsApi.markAllRead();
        }}
        className="relative rounded p-1.5 text-white/90 hover:bg-white/15"
        aria-label={`Thông báo${unread ? `, ${unread} chưa đọc` : ''}`}
      >
        <Bell size={19} />
        {unread > 0 && (
          <span className="num absolute -top-0.5 -right-0.5 min-w-[16px] rounded-full bg-[#e5393b] px-1 text-center text-[10.5px] font-semibold leading-4 text-white ring-2 ring-band">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[380px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[3px] border border-rule bg-surface text-ink shadow-[0_12px_32px_rgba(28,36,48,0.18)]">
          <p className="bg-band px-4 py-2 font-semibold text-white">Thông báo</p>
          <PushToggle user={user} />
          <ul className="max-h-[360px] overflow-y-auto">
            {(notes || []).length === 0 && <li className="px-4 py-6 text-center text-muted">Chưa có thông báo.</li>}
            {(notes || []).slice(0, 20).map((n) => {
              const target = linkTarget(n.link, user.role);
              return (
                <li key={n.id} className={cx('border-b border-rule-2 last:border-0', !n.read && 'bg-accent-soft/50')}>
                  <button
                    type="button"
                    disabled={!target}
                    onClick={() => {
                      setOpen(false);
                      onNavigate(target[0], target[1]);
                    }}
                    className={cx('block w-full px-4 py-2.5 text-left', target && 'hover:bg-sunken')}
                  >
                    <p className="text-[13.5px] text-ink">{n.text}</p>
                    <p className="num mt-0.5 text-[12px] text-subtle">{dateTimeVN(n.at)}</p>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

/** Đổi mật khẩu khi đang làm việc: các thiết bị khác bị đăng xuất. */
const PasswordModal = ({ user, onClose }) => {
  const { changePassword } = useAuth();
  const toast = useToast();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    if (e) e.preventDefault();
    if (next.length < 8) return setErr('Mật khẩu mới cần ít nhất 8 ký tự.');
    if (next !== again) return setErr('Hai lần nhập mật khẩu mới chưa khớp.');
    setBusy(true);
    try {
      await changePassword(cur, next);
      toast('success', 'Đã đổi mật khẩu. Các thiết bị khác đã được đăng xuất.');
      onClose();
    } catch (ex) {
      setErr(ex.message);
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      title="Đổi mật khẩu"
      onClose={onClose}
      width={460}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="primary" onClick={submit} disabled={busy || !cur || !next}>
            Đổi mật khẩu
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-3" method="post">
        <input type="text" name="username" autoComplete="username" value={user.username || ''} readOnly hidden />
        <Field label="Mật khẩu hiện tại" required>
          <Input type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} />
        </Field>
        <Field label="Mật khẩu mới" required hint="Ít nhất 8 ký tự.">
          <Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </Field>
        <Field label="Nhập lại mật khẩu mới" required>
          <Input type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
        </Field>
        {err && <Notice tone="danger">{err}</Notice>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
};

const AccountMenu = ({ user }) => {
  const { session, logout, logoutAll } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState(false);
  const [confirm, confirmEl] = useConfirm();
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false));
  const personal = session && session.accountKind === 'staff';

  const askLogout = async () => {
    setOpen(false);
    const ok = await confirm({
      title: 'Đăng xuất',
      message: 'Đăng xuất khỏi SAM trên máy này? Lần sau mở SAM phải nhập lại tên đăng nhập, mật khẩu; thông báo đẩy về máy này cũng tắt.',
      confirmLabel: 'Đăng xuất',
    });
    if (ok) await logout();
  };
  const askLogoutAll = async () => {
    setOpen(false);
    const ok = await confirm({
      title: 'Đăng xuất trên mọi thiết bị',
      message:
        'Mọi máy tính, điện thoại đang đăng nhập tài khoản này (kể cả máy này) sẽ phải đăng nhập lại và thôi nhận thông báo đẩy. Dùng khi mất điện thoại hoặc đã đăng nhập trên máy dùng chung.',
      confirmLabel: 'Đăng xuất tất cả',
    });
    if (!ok) return;
    try {
      await logoutAll();
    } catch (e) {
      toast('error', e.message);
    }
  };
  const sub =
    user.role === 'khtc' && !personal
      ? 'Tài khoản quản trị hệ thống'
      : [user.position, (user.unit || '').replace('Phòng ', 'P. ')].filter(Boolean).join(', ');

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded py-1 pr-1 pl-1 text-white hover:bg-white/15"
        title={sub}
      >
        <Avatar user={user} size={26} />
        <span className="hidden max-w-[160px] truncate text-[13px] font-medium md:block">{user.username || user.name}</span>
        <ChevronDown size={15} className="text-white/80" />
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[300px] max-w-[calc(100vw-2rem)] rounded-[3px] border border-rule bg-surface py-1.5 text-ink shadow-[0_12px_32px_rgba(28,36,48,0.18)]">
          <div className="px-4 pt-1 pb-2">
            <p className="text-[13.5px] font-medium text-ink">{user.name}</p>
            <p className="text-[12px] text-muted">{sub}</p>
            <p className="text-[12px] text-muted">
              {ROLE_LABEL[user.role]}
              {user.role === 'daumoi' && user.focalUnit ? `, ${user.focalUnit}` : ''}
            </p>
            {user.username && <p className="num text-[12px] text-subtle">Tên đăng nhập: {user.username}</p>}
          </div>
          <div className="border-t border-rule-2 pt-1">
            {personal && (
              <button
                onClick={() => {
                  setOpen(false);
                  setPw(true);
                }}
                className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-[13.5px] hover:bg-sunken"
              >
                <LockKeyhole size={16} className="text-muted" /> Đổi mật khẩu
              </button>
            )}
            <button onClick={askLogoutAll} className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-[13.5px] hover:bg-sunken">
              <BellOff size={16} className="text-muted" /> Đăng xuất trên mọi thiết bị
            </button>
            <button onClick={askLogout} className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-[13.5px] hover:bg-sunken">
              <LogOut size={16} className="text-muted" /> Đăng xuất
            </button>
          </div>
        </div>
      )}
      {pw && <PasswordModal user={user} onClose={() => setPw(false)} />}
      {confirmEl}
    </div>
  );
};

const MAX_TABS = 8;
// Mỗi hồ sơ phiếu, mỗi lý lịch tài sản là một tab riêng; các chức năng khác mỗi chức năng một tab
const tabIdOf = (tab, params) =>
  tab === 'case' ? `case:${params.reportId}` : tab === 'asset' ? `asset:${params.assetId}` : tab;
const hasParams = (p) => p && Object.values(p).some((v) => v !== undefined && v !== null && v !== '');

const SamApp = () => {
  const { user, ready, session } = useAuth();
  const [tabs, setTabs] = useState([]); // [{ id, tab, params, ver }]
  const [activeId, setActiveId] = useState(null);
  const [titles, setTitles] = useState({});
  const [navOpen, setNavOpen] = useState(false);
  const userId = user ? user.id : null;
  const role = user ? user.role : null;

  // Đổi tài khoản thì đóng mọi tab, mở trang đầu của vai trò mới
  useEffect(() => {
    if (!role) {
      setTabs([]);
      setActiveId(null);
      return;
    }
    const first = DEFAULT_TAB[role];
    setTabs([{ id: first, tab: first, params: {}, ver: 0 }]);
    setActiveId(first);
    setTitles({});
  }, [userId, role]);

  /** Mở chức năng: đã có tab thì chuyển sang; mở kèm tham số (từ thông báo, từ trang khác) thì nạp lại tab đó. */
  const onNavigate = useCallback((nextTab, nextParams = {}) => {
    const id = tabIdOf(nextTab, nextParams);
    setTabs((cur) => {
      const i = cur.findIndex((t) => t.id === id);
      if (i >= 0) {
        if (!hasParams(nextParams) || JSON.stringify(cur[i].params) === JSON.stringify(nextParams)) return cur;
        const next = [...cur];
        next[i] = { ...cur[i], params: nextParams, ver: cur[i].ver + 1 };
        return next;
      }
      const next = [...cur, { id, tab: nextTab, params: nextParams, ver: 0 }];
      return next.length > MAX_TABS ? next.slice(next.length - MAX_TABS) : next;
    });
    setActiveId(id);
    setNavOpen(false);
    window.scrollTo(0, 0);
  }, []);

  const closeTab = (id) => {
    const i = tabs.findIndex((t) => t.id === id);
    const rest = tabs.filter((t) => t.id !== id);
    if (!rest.length) {
      const first = DEFAULT_TAB[role];
      setTabs([{ id: first, tab: first, params: {}, ver: 0 }]);
      setActiveId(first);
      return;
    }
    setTabs(rest);
    if (id === activeId) setActiveId((rest[i] || rest[i - 1]).id);
  };

  // Mở từ thông báo đẩy: địa chỉ ?go=<liên kết> (mở mới) hoặc tin nhắn từ service worker (SAM đang mở)
  useEffect(() => {
    if (!userId || !role) return undefined;
    const go = (link) => {
      const t = linkTarget(link, role);
      if (t) onNavigate(t[0], t[1]);
    };
    const url = new URL(window.location.href);
    const pending = url.searchParams.get('go');
    if (pending) {
      url.searchParams.delete('go');
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
      go(pending);
    }
    const onMessage = (e) => {
      if (e.data && e.data.type === 'sam-navigate') {
        try {
          const link = new URL(e.data.url).searchParams.get('go');
          if (link) go(link);
        } catch {
          // địa chỉ không đúng: bỏ qua
        }
      }
    };
    const sw = typeof navigator !== 'undefined' && navigator.serviceWorker;
    if (sw) sw.addEventListener('message', onMessage);
    return () => {
      if (sw) sw.removeEventListener('message', onMessage);
    };
  }, [userId, role, onNavigate]);

  const active = tabs.find((t) => t.id === activeId) || tabs[0];
  const counts = useCounts(active ? active.id : null, user && !session?.mustChangePassword ? userId : null);

  if (!ready) return null;
  if (!user) return <LoginPage />;

  const items = navFor(user, session);
  const current = active ? PARENT_TAB[active.tab] || active.tab : null;
  const labelOf = (tab) => (items.find((it) => it.tab === tab) || {}).label;
  const titleOf = (t) =>
    titles[t.id] || (t.tab === 'case' ? 'Hồ sơ phiếu' : t.tab === 'asset' ? 'Lý lịch tài sản' : labelOf(t.tab) || 'SAM');

  const renderPage = (t) => {
    const params = t.params || {};
    const k = `${t.id}:${t.ver}`;
    switch (t.tab) {
      case 'report-new':
        return <ReportPage key={k} onNavigate={onNavigate} initialAssetIds={params.assetIds} />;
      case 'my-reports':
        return <MyReportsPage key={k} onNavigate={onNavigate} />;
      case 'queue':
        return <QueuePage key={k} onNavigate={onNavigate} />;
      case 'case':
        return <CasePage key={k} reportId={params.reportId} onNavigate={onNavigate} />;
      case 'estimates':
        return <EstimatesPage key={k} onNavigate={onNavigate} />;
      case 'approvals':
        return <ApprovalsPage key={k} onNavigate={onNavigate} params={params} />;
      case 'proposals':
        return <ProposalsPage key={k} onNavigate={onNavigate} params={params} />;
      case 'lights':
        return <LightsGuidePage key={k} params={params} />;
      case 'assets':
        return <AssetsPage key={k} onNavigate={onNavigate} />;
      case 'asset':
        return <AssetDetailPage key={k} assetId={params.assetId} onNavigate={onNavigate} />;
      case 'dashboard':
        return <DashboardPage key={k} onNavigate={onNavigate} />;
      case 'exceptions':
        return <ExceptionsPage key={k} onNavigate={onNavigate} />;
      case 'thresholds':
        return <ThresholdsPage key={k} onNavigate={onNavigate} />;
      case 'unit-assets':
        return <UnitAssetsPage key={k} onNavigate={onNavigate} />;
      case 'accounts':
        return <AccountsPage key={k} onNavigate={onNavigate} />;
      case 'handovers':
        return <HandoversPage key={k} onNavigate={onNavigate} />;
      case 'export-logs':
        return <ExportLogsPage key={k} />;
      case 'catalog':
        return <CatalogPage key={k} />;
      default:
        return <ReportPage key={k} onNavigate={onNavigate} />;
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar
        user={user}
        items={items}
        counts={counts}
        current={current}
        onNavigate={onNavigate}
        onOpenDrawer={() => setNavOpen(true)}
      />
      <TabBand tabs={tabs} activeId={active ? active.id : null} titleOf={titleOf} onSelect={setActiveId} onClose={closeTab} />
      {navOpen && (
        <div className="fixed inset-0 z-40 bg-[#1c2430]/30 lg:hidden" onClick={() => setNavOpen(false)}>
          <aside className="h-full w-[270px] overflow-y-auto bg-surface shadow-xl" onClick={(e) => e.stopPropagation()}>
            <FullMenu user={user} items={items} counts={counts} current={current} onNavigate={onNavigate} />
          </aside>
        </div>
      )}
      <main className="min-w-0 flex-1 px-2.5 py-3 sm:px-3">
        {tabs.map((t) => (
          <TabPane key={t.id} id={t.id} hidden={!active || t.id !== active.id} setTitles={setTitles}>
            {renderPage(t)}
          </TabPane>
        ))}
      </main>
      <ConfirmCodeDialog />
    </div>
  );
};

/** Một tab đang mở: giữ nguyên trạng thái khi chuyển sang tab khác (như phần mềm cũ). */
const TabPane = ({ id, hidden, setTitles, children }) => {
  const setTitle = useCallback((title) => setTitles((x) => (x[id] === title ? x : { ...x, [id]: title })), [id, setTitles]);
  return (
    <TabTitleContext.Provider value={setTitle}>
      <div hidden={hidden}>{children}</div>
    </TabTitleContext.Provider>
  );
};

export default SamApp;
