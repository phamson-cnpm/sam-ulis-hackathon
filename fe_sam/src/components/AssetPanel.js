// Khung thông tin tài sản bên phải danh sách, bố cục theo màn hình "Thẻ tài sản" của phần mềm quản lý tài sản đang
// dùng (để quen mắt): ô Barcode xanh, các trường nhãn – giá trị có biểu tượng nhỏ, thẻ Thông tin / Sửa chữa / Đề xuất,
// hàng nút ở chân khung. Màn hình hẹp thì mở thành hộp thoại.
// mode "focal": cán bộ đầu mối chỉ thấy các trường máy chủ trả (màu đèn, mã, tên, phòng ban, vị trí, nguyên giá, Đề xuất).
import React, { useEffect, useState } from 'react';
import {
  Banknote,
  Barcode,
  Building2,
  CalendarDays,
  FilePlus2,
  Hourglass,
  Info,
  Landmark,
  Layers,
  Lightbulb,
  MapPin,
  Network,
  ScrollText,
  Send,
  Tags,
  Timer,
  Wallet,
  Wrench,
} from 'lucide-react';
import { assetsApi } from '../utils/api';
import { useApi } from '../hooks/useApi';
import { ASSET_STATUS, ESTIMATE_STATUS, PROPOSAL_KIND, PROPOSAL_STATUS } from '../utils/labels';
import { dateVN, money, pct } from '../utils/format';
import { ORG_NAME } from '../config/app';
import { LIGHT_META, countedCost } from '../utils/lights';
import { Button, Modal, Pill, cx } from './ui';
import { LightBadge } from './Light';
import { ProposalCell, proposalStatusLabel } from './Proposals';

/** Màn hình rộng (≥ 1280px): khung bên phải; hẹp hơn: hộp thoại. */
export function useWide(min = 1280) {
  const q = `(min-width: ${min}px)`;
  const [wide, setWide] = useState(() => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(q).matches : true));
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const m = window.matchMedia(q);
    const on = () => setWide(m.matches);
    on();
    m.addEventListener ? m.addEventListener('change', on) : m.addListener(on);
    return () => (m.removeEventListener ? m.removeEventListener('change', on) : m.removeListener(on));
  }, [q]);
  return wide;
}

const F = ({ icon: Icon, label, children, wide }) => (
  <div className={cx('flex min-w-0 items-start gap-1.5 py-[3px] text-[12.5px] leading-snug', wide && 'col-span-2')}>
    {Icon ? <Icon size={13} className="mt-[2px] shrink-0 text-[#7a838e]" aria-hidden="true" /> : <span className="w-[13px] shrink-0" />}
    <span className="flex min-w-0 flex-wrap items-baseline gap-x-1">
      <span className="text-muted">{label}:</span>
      <span className="min-w-0 font-semibold break-words text-ink">{children ?? <span className="font-normal text-subtle">—</span>}</span>
    </span>
  </div>
);

const STATUS_TONE = { dang_su_dung: 'green', thu_hoi_kho: 'amber', da_thanh_ly: 'neutral' };

const InfoTab = ({ a, focal }) => (
  <div className="space-y-2">
    <div className="grid grid-cols-2 gap-x-3">
      <F icon={Barcode} label="Barcode" wide>
        <span className="num rounded-[3px] bg-[#1e9bd7] px-1.5 py-[1px] text-white">{a.code}</span>
      </F>
      <F label="Tên tài sản" wide>
        {a.name}
      </F>
      <F icon={Lightbulb} label="Đèn">
        {a.light && LIGHT_META[a.light.code] ? <LightBadge code={a.light.code} size="sm" /> : null}
      </F>
      {!focal && (
        <F icon={Hourglass} label="Trạng thái">
          <Pill tone={STATUS_TONE[a.status] || 'neutral'}>{ASSET_STATUS[a.status] || a.status}</Pill>
        </F>
      )}
      {!focal && (
        <F icon={Layers} label="Nhóm" wide>
          {a.groupName}
          {a.groupCode ? ` (${a.groupCode})` : ''}
        </F>
      )}
      {!focal && <F icon={CalendarDays} label="Ngày sử dụng">{dateVN(a.inUseDate)}</F>}
      {!focal && (
        <F icon={Timer} label="Hao mòn">
          {a.depreciationMonths ? `${a.depreciationMonths} tháng` : null}
        </F>
      )}
      <F icon={Banknote} label="Nguyên giá">
        {money(a.originalCost)}
      </F>
      {!focal && (
        <F icon={Wallet} label="Giá trị còn lại">
          {money(a.residualValue)}
        </F>
      )}
      {!focal && <F icon={Landmark} label="Nguồn vốn">{a.fundingSource}</F>}
      {!focal && a.light && (
        <F icon={Wrench} label="Sửa năm nay">
          {a.light.yearCount || 0} lần, {money(a.light.yearCost || 0)}
          {a.light.yearCost ? ` (${pct(a.light.yearRatio)})` : ''}
        </F>
      )}
      {!focal && a.light && (
        <F icon={Wrench} label="Lũy kế" wide>
          {money(a.light.cumulativeCost || 0)}
          {a.light.cumulativeCost ? ` (${pct(a.light.cumulativeRatio)})` : ''}
        </F>
      )}
      {!focal && a.light && a.light.labels && a.light.labels.length > 0 && (
        <F icon={Tags} label="Nhãn" wide>
          <span className="font-normal">{a.light.labels.join('; ')}</span>
        </F>
      )}
    </div>
    <div className="border-t border-rule-2 pt-1.5">
      <F icon={Building2} label="Phòng ban" wide>
        {a.unit}
      </F>
      <F icon={MapPin} label="Vị trí" wide>
        {a.location}
      </F>
      <F icon={Network} label="Cơ quan" wide>
        {ORG_NAME}
      </F>
    </div>
  </div>
);

const RepairTab = ({ a }) => {
  const { data: h } = useApi(() => assetsApi.history(a.id), [a.id]);
  if (!h) return <p className="text-[13px] text-muted">Đang tải…</p>;
  if (!h.estimates.length && !h.reports.length) return <p className="text-[13px] text-muted">Chưa có phiếu báo hỏng, dự toán nào.</p>;
  return (
    <div className="space-y-2 text-[12.5px]">
      <p className="text-muted">
        <span className="num font-semibold text-ink">{h.reports.length}</span> phiếu báo hỏng,{' '}
        <span className="num font-semibold text-ink">{h.estimates.length}</span> dự toán.
      </p>
      <ul className="divide-y divide-rule-2 rounded-[3px] border border-rule">
        {h.estimates.slice(0, 8).map((e) => (
          <li key={e.id} className="flex items-start justify-between gap-2 px-2.5 py-1.5">
            <span>
              <span className="num font-semibold">{e.code}</span> <span className="text-muted">{dateVN(e.createdAt)}</span>
              <span className="block text-muted">{ESTIMATE_STATUS[e.status] || e.status}</span>
            </span>
            <span className="num shrink-0 text-right font-semibold">{money(countedCost(e.lines) || e.lines.reduce((s, l) => s + (l.estimate || 0), 0))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

const ProposalTab = ({ a, onOpenProposal, onPropose }) => {
  const p = a.proposal;
  return (
    <div className="space-y-2 text-[12.5px]">
      {p ? (
        <div className="rounded-[3px] border border-rule p-2.5">
          <p>
            <span className="num font-semibold">{p.code}</span> · {PROPOSAL_KIND[p.kind]} ·{' '}
            <span className="text-muted">{proposalStatusLabel(p) || PROPOSAL_STATUS[p.status]}</span>
          </p>
          <p className="mt-1 text-ink-2">{p.reason}</p>
          {p.decisionNote && <p className="mt-1 text-l-red">Lý do: {p.decisionNote}</p>}
          {onOpenProposal && (
            <button className="mt-1.5 text-accent hover:underline" onClick={() => onOpenProposal(p)}>
              Xem đề xuất
            </button>
          )}
        </div>
      ) : (
        <p className="text-muted">Chưa có đề xuất.</p>
      )}
      <ProposalCell asset={{ ...a, proposal: null }} onCreate={onPropose} />
    </div>
  );
};

/**
 * a: dòng tài sản đang chọn. actions: { onDetail, onReport, onPropose, onOpenProposal } (bỏ trống thì không hiện nút).
 */
export const AssetPanelBody = ({ a, focal, actions = {} }) => {
  const [tab, setTab] = useState('info');
  const assetId = a ? a.id : null;
  useEffect(() => setTab('info'), [assetId]);
  if (!a) {
    return (
      <div className="flex h-full min-h-[200px] items-center justify-center px-4 text-center text-[13px] text-muted">
        Chọn một tài sản trong danh sách để xem thông tin.
      </div>
    );
  }
  const links = [
    ['info', 'Thông tin'],
    ...(focal ? [] : [['repair', 'Sửa chữa']]),
    ['proposal', 'Đề xuất'],
  ];
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-rule bg-[#f6f7f8] px-2.5 py-1.5">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-[3px] bg-accent text-white">
          <Info size={15} />
        </span>
        {links.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cx('text-[13px]', tab === id ? 'font-semibold text-ink underline decoration-2 underline-offset-4' : 'text-accent hover:underline')}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2.5">
        {tab === 'info' && <InfoTab a={a} focal={focal} />}
        {tab === 'repair' && <RepairTab a={a} />}
        {tab === 'proposal' && <ProposalTab a={a} onOpenProposal={actions.onOpenProposal} onPropose={actions.onPropose} />}
      </div>
      {(actions.onDetail || actions.onReport || actions.onPropose) && (
        <div className="flex flex-wrap gap-1.5 border-t border-rule bg-[#f6f7f8] px-2.5 py-2">
          {actions.onDetail && (
            <Button size="sm" icon={<ScrollText size={14} />} onClick={() => actions.onDetail(a)}>
              Lý lịch
            </Button>
          )}
          {actions.onReport && a.status !== 'da_thanh_ly' && (
            <Button size="sm" icon={<FilePlus2 size={14} />} onClick={() => actions.onReport(a)}>
              Báo hỏng
            </Button>
          )}
          {actions.onPropose && (
            <Button size="sm" icon={<Send size={14} />} onClick={() => actions.onPropose(a)}>
              Lập đề xuất
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

/** Khung bên phải (màn hình rộng) hoặc hộp thoại (màn hình hẹp). */
export const AssetPanel = ({ wide, asset, focal, actions, onClose }) =>
  wide ? (
    <aside className="sticky top-[92px] flex h-[calc(100vh-104px)] w-[360px] shrink-0 flex-col overflow-hidden rounded-[3px] border border-rule bg-surface 2xl:w-[400px]">
      <AssetPanelBody a={asset} focal={focal} actions={actions} />
    </aside>
  ) : asset ? (
    <Modal open title={`${asset.code} · ${asset.name}`} onClose={onClose} width={520}>
      <div className="-mx-5 -my-4">
        <AssetPanelBody a={asset} focal={focal} actions={actions} />
      </div>
    </Modal>
  ) : null;
