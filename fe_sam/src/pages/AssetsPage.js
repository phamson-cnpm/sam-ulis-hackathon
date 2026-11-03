
// Danh sách tài sản gắn đèn (mục 5.6 đề tài): ô đèn ở cột đầu, lọc và sắp xếp theo đèn, đơn vị, nhóm, trạng thái đề
// xuất. Cột cuối "Đề xuất": đề xuất xử lý tài sản và trạng thái duyệt, hoặc gợi ý theo màu đèn; kỹ thuật viên lập đề xuất.
import React, { useMemo, useState } from 'react';
import { ArrowDownUp, CircleHelp, Download, Search } from 'lucide-react';
import { assetsApi, catalogApi, exportLogApi } from '../utils/api';
import { downloadXlsx } from '../utils/xlsx';
import { assetsSheets } from '../utils/exportSheets';
import { useToast } from '../utils/ToastContext';
import { useApi } from '../hooks/useApi';
import { LIGHT_META, LIGHT_ORDER } from '../utils/lights';
import { money, pct } from '../utils/format';
import { useAuth } from '../utils/AuthContext';
import { ASSET_BOOK_DATE, TODAY, FISCAL_YEAR } from '../config/app';
import { Button, cx, Empty, Input, PageHeader, Select, Table, Td, Th } from '../components/ui';
import { LightBadge, lightColor } from '../components/Light';
import { GroupChips, GroupFilter } from '../components/GroupFilter';
import ImportButton from '../components/ImportButton';
import { Pager, usePaged } from '../components/Pager';
import { ProposalCell, ProposalCreateDialog } from '../components/Proposals';
import { AssetPanel, useWide } from '../components/AssetPanel';
import { PROPOSAL_OPEN, PROPOSAL_STATUS } from '../utils/labels';

const AssetsPage = ({ onNavigate }) => {
  const { user } = useAuth();
  const toast = useToast();
  const { data: assets } = useApi(() => assetsApi.list(), []);
  const { data: groups } = useApi(() => catalogApi.assetGroups(), []);
  const { data: units } = useApi(() => catalogApi.units(), []);
  const [q, setQ] = useState('');
  const [light, setLight] = useState('all');
  const [unit, setUnit] = useState('all');
  const [groupSel, setGroupSel] = useState([]); // mã các nhóm thiết bị đang lọc; rỗng là tất cả
  const [sort, setSort] = useState({ key: 'light', dir: 1 });
  const [pstatus, setPstatus] = useState('all'); // lọc theo trạng thái đề xuất
  const [creating, setCreating] = useState(null);
  const [selId, setSelId] = useState(null); // dòng đang chọn (tô hồng), thông tin hiện ở khung bên phải
  const wide = useWide();

  const counts = useMemo(() => {
    const c = {};
    (assets || []).forEach((a) => (c[a.light.code] = (c[a.light.code] || 0) + 1));
    return c;
  }, [assets]);

  // Các điều kiện lọc trừ nhóm: dùng để đếm số tài sản cạnh từng nhóm trong bộ lọc nhóm
  const others = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (assets || []).filter(
      (a) =>
        (light === 'all' ||
          (light === 'warn'
            ? ['do_1_1', 'do_1_2', 'cam', 'vang_3_1', 'vang_3_2', 'vang_3_3'].includes(a.light.code)
            : a.light.code === light)) &&
        (unit === 'all' || a.unit === unit) &&
        (pstatus === 'all' ||
          (pstatus === 'none' ? !a.proposal : a.proposal && a.proposal.status === pstatus)) &&
        (!s ||
          a.code.toLowerCase().includes(s) ||
          a.name.toLowerCase().includes(s) ||
          a.location.toLowerCase().includes(s)),
    );
  }, [assets, q, light, unit, pstatus]);

  const groupTotals = useMemo(() => {
    const c = {};
    (assets || []).forEach((a) => (c[a.groupCode] = (c[a.groupCode] || 0) + 1));
    return c;
  }, [assets]);

  const groupCounts = useMemo(() => {
    const c = {};
    others.forEach((a) => (c[a.groupCode] = (c[a.groupCode] || 0) + 1));
    return c;
  }, [others]);

  const rows = useMemo(() => {
    let list = others.filter((a) => !groupSel.length || groupSel.includes(a.groupCode));
    const val = (a) => {
      switch (sort.key) {
        case 'light':
          return LIGHT_META[a.light.code].rank * 1e12 - a.light.yearCost;
        case 'cost':
          return a.originalCost;
        case 'yearCost':
          return a.light.yearCost;
        case 'cumulative':
          return a.light.cumulativeCost;
        case 'code':
          return a.code;
        default:
          return 0;
      }
    };
    list = [...list].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
    return list;
  }, [others, groupSel, sort]);

  const pager = usePaged(rows, [q, light, unit, groupSel, sort, pstatus]);
  const openProposal = (p) =>
    onNavigate(user.role === 'lanhdao_qtnl' ? 'approvals' : 'proposals', { section: user.role === 'lanhdao_qtnl' ? 'dx' : 'all', proposalId: p.id });

  const sortBy = (key) =>
    setSort((s) =>
      s.key === key ? { key, dir: s.dir * -1 } : { key, dir: key === 'code' || key === 'light' ? 1 : -1 },
    );

  const SortTh = ({ k, children, right }) => (
    <Th right={right}>
      <button
        onClick={() => sortBy(k)}
        className={cx('inline-flex items-center gap-1 hover:text-ink', sort.key === k && 'text-ink')}
      >
        {children}
        <ArrowDownUp size={12} className={sort.key === k ? 'text-accent' : 'text-subtle'} />
      </button>
    </Th>
  );

  const exportXlsx = async () => {
    const filterNote = [
      light === 'all' ? '' : light === 'warn' ? 'đang cảnh báo' : `đèn ${LIGHT_META[light].label}`,
      unit === 'all' ? '' : unit,
      pstatus === 'all' ? '' : pstatus === 'none' ? 'chưa có đề xuất' : `đề xuất ${PROPOSAL_STATUS[pstatus].toLowerCase()}`,
      groupSel.length ? `nhóm ${groupSel.join(', ')}` : '',
      q.trim() ? `tìm “${q.trim()}”` : '',
    ]
      .filter(Boolean)
      .join(', ');
    try {
      await downloadXlsx(`SAM_danh-sach-tai-san_${TODAY}`, assetsSheets(rows, { filterNote, year: FISCAL_YEAR }));
      exportLogApi.log(user, 'xuat_excel', `Danh sách tài sản${filterNote ? `, lọc: ${filterNote}` : ''} (${rows.length} tài sản)`);
      toast('success', `Đã tải file Excel ${rows.length} tài sản.`);
    } catch (e) {
      toast('error', `Không tạo được file Excel: ${e.message}`);
    }
  };

  const selected = selId ? (assets || []).find((a) => a.id === selId) : null;
  const canPropose = (a) => user.role === 'ktv' && a.status !== 'da_thanh_ly' && !(a.proposal && PROPOSAL_OPEN.includes(a.proposal.status));
  const panelActions = {
    onDetail: (a) => onNavigate('asset', { assetId: a.id }),
    onReport: ['ktv', 'lanhdao_qtnl'].includes(user.role) ? (a) => onNavigate('report-new', { assetIds: [a.id] }) : undefined,
    onPropose: selected && canPropose(selected) ? (a) => setCreating([a]) : undefined,
    onOpenProposal: openProposal,
  };

  return (
    <div>
      <PageHeader
        title="Thẻ tài sản"
        description={
          user.role === 'khtc'
            ? 'Mỗi tài sản một dòng, đèn ở cột đầu. Bấm một dòng để xem thông tin ở khung bên phải; bấm đúp hoặc nút Lý lịch để xem lịch sử sửa chữa và lý do mang màu đèn đó.'
            : 'Xem màu đèn và cảnh báo của tài sản để lập dự toán, kế hoạch sửa chữa. Bấm một dòng để xem thông tin; bấm đúp để mở lý lịch. Chỉ Phòng KHTC sửa được dữ liệu tài sản.'
        }
        actions={
          <>
            {user.role === 'khtc' && (
              <ImportButton hint="Danh sách tài sản xuất từ phần mềm quản lý tài sản, hoặc danh mục nhóm tài sản (.xlsx)" />
            )}
            <Button
              icon={<Download size={16} />}
              onClick={exportXlsx}
              disabled={!rows.length}
              title="Tải danh sách đang lọc"
            >
              Tải Excel (.xlsx)
            </Button>
          </>
        }
      />

      {/* Đếm theo đèn, bấm để lọc */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        <button
          onClick={() => setLight('all')}
          className={cx(
            'h-8 rounded-[3px] border px-3 text-[13px]',
            light === 'all'
              ? 'border-accent bg-accent-soft font-semibold text-accent'
              : 'border-rule bg-surface text-ink-2 hover:bg-sunken',
          )}
        >
          Tất cả <span className="num ml-1">{assets?.length ?? 0}</span>
        </button>
        {LIGHT_ORDER.map((code) => {
          const n = counts[code] || 0;
          const c = lightColor(code);
          const on = light === code;
          return (
            <button
              key={code}
              onClick={() => setLight(on ? 'all' : code)}
              disabled={!n}
              className={cx(
                'flex h-8 items-center gap-1.5 rounded-[3px] border px-2.5 text-[13px] disabled:opacity-40',
                on ? 'font-semibold' : 'border-rule bg-surface text-ink-2 hover:bg-sunken',
              )}
              style={on ? { background: c.soft, borderColor: c.fg, color: c.fg } : undefined}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: c.fg }} />
              {LIGHT_META[code].label}
              <span className="num">{n}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1 rounded-[3px] border border-rule bg-surface">
        <div className="flex flex-wrap items-center gap-2 border-b border-rule-2 p-2.5">
          <div className="relative min-w-[240px] flex-1">
            <Search size={16} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-subtle" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm theo mã tem, tên tài sản, phòng"
              className="pl-8"
            />
          </div>
          <Select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="w-auto max-w-[280px]"
            aria-label="Đơn vị"
          >
            <option value="all">Tất cả đơn vị</option>
            {(units || []).map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
          <Select value={pstatus} onChange={(e) => setPstatus(e.target.value)} className="w-auto max-w-[220px]" aria-label="Trạng thái đề xuất">
            <option value="all">Đề xuất: tất cả</option>
            <option value="none">Chưa có đề xuất</option>
            {Object.entries(PROPOSAL_STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
          <GroupFilter
            groups={groups || []}
            totals={groupTotals}
            counts={groupCounts}
            value={groupSel}
            onChange={setGroupSel}
          />
          <Button
            variant={light === 'warn' ? 'primary' : 'secondary'}
            onClick={() => setLight(light === 'warn' ? 'all' : 'warn')}
          >
            Chỉ tài sản đang cảnh báo
          </Button>
        </div>
        <GroupChips groups={groups || []} value={groupSel} onChange={setGroupSel} />
        <Table scroll="calc(100vh - 330px)">
          <thead>
            <tr>
              <Th>
                <span className="inline-flex items-center gap-1">
                  <button onClick={() => sortBy('light')} className={cx('inline-flex items-center gap-1 hover:text-ink', sort.key === 'light' && 'text-ink')}>
                    Đèn, nhãn
                    <ArrowDownUp size={12} className={sort.key === 'light' ? 'text-accent' : 'text-subtle'} />
                  </button>
                  <button type="button" className="text-accent" title="Giải thích các đèn" onClick={() => onNavigate('lights')}>
                    <CircleHelp size={13} />
                  </button>
                </span>
              </Th>
              <SortTh k="code">Tài sản, mã tem</SortTh>
              <Th title="Đơn vị quản lý, sử dụng; vị trí">Đơn vị, vị trí</Th>
              <Th right title="Thời gian tính hao mòn (tháng)" className="hidden 2xl:table-cell">
                Hao mòn
              </Th>
              <SortTh k="cost" right>
                Nguyên giá (đ)
              </SortTh>
              <Th right>GTCL (đ)</Th>
              <SortTh k="yearCost" right>
                Chi phí {FISCAL_YEAR}
              </SortTh>
              <SortTh k="cumulative" right>
                Lũy kế
              </SortTh>
              <Th className="right-0 !z-[7] border-l border-rule !bg-accent-soft font-semibold text-accent shadow-[-6px_0_8px_-6px_rgba(28,36,48,0.18)]">
                Đề xuất
              </Th>
            </tr>
          </thead>
          <tbody>
            {pager.pageRows.map((a) => (
              <tr
                key={a.id}
                onClick={() => setSelId(a.id)}
                onDoubleClick={() => onNavigate('asset', { assetId: a.id })}
                className={cx('cursor-pointer', selId === a.id ? 'bg-sel [&>td]:bg-sel' : 'hover:bg-[#eef5fb]')}
                aria-selected={selId === a.id}
              >
                <Td className="w-[170px] min-w-[150px]">
                  <LightBadge code={a.light.code} size="sm" />
                  <div className="mt-1 text-[12px] leading-snug text-muted">{a.light.labels.join('; ')}</div>
                </Td>
                <Td className="min-w-[210px]">
                  {a.name}
                  <div className="num text-[12.5px] font-medium text-accent">{a.code}</div>
                </Td>
                <Td className="min-w-[150px] text-ink-2">
                  {a.unit}
                  <div className="text-[12.5px] text-muted">{a.location}</div>
                </Td>
                <Td right className="hidden whitespace-nowrap 2xl:table-cell">
                  {a.depreciationMonths} th
                </Td>
                <Td right>{money(a.originalCost)}</Td>
                <Td right className={a.residualValue <= 0 ? 'text-subtle' : ''}>
                  {money(a.residualValue)}
                </Td>
                <Td right className="whitespace-nowrap">
                  {a.light.yearCost ? (
                    <>
                      {money(a.light.yearCost)}
                      <div className="text-[12px] text-muted">
                        {a.light.yearCount || 0} lần, {pct(a.light.yearRatio)}
                      </div>
                    </>
                  ) : (
                    <span className="text-subtle">0</span>
                  )}
                </Td>
                <Td right className="whitespace-nowrap">
                  {a.light.cumulativeCost ? (
                    <>
                      {money(a.light.cumulativeCost)}
                      <div className="text-[12px] text-muted">{pct(a.light.cumulativeRatio)}</div>
                    </>
                  ) : (
                    <span className="text-subtle">0</span>
                  )}
                </Td>
                <Td
                  className={cx(
                    'sticky right-0 z-[4] border-l border-rule-2 shadow-[-6px_0_8px_-6px_rgba(28,36,48,0.18)]',
                    selId === a.id ? '' : 'bg-[#fbfcfd]',
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  <ProposalCell asset={a} onOpen={openProposal} onCreate={canPropose(a) ? (x) => setCreating([x]) : undefined} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <Pager pager={pager} />
        {assets && rows.length === 0 && (
          <Empty title="Không có tài sản nào khớp bộ lọc.">Thử bỏ bớt điều kiện lọc.</Empty>
        )}
        <p className="border-t border-rule-2 px-3 py-1.5 text-[12px] text-muted">
          {ASSET_BOOK_DATE ? `GTCL theo sổ đến ${ASSET_BOOK_DATE}. ` : ''}Cột Đề xuất: khi chưa có đề xuất, ô hiện gợi ý theo
          màu đèn để tham khảo; đề xuất không làm đổi màu đèn.
        </p>
      </div>
      {wide && <AssetPanel wide asset={selected} actions={panelActions} />}
      </div>
      {!wide && selected && <AssetPanel asset={selected} actions={panelActions} onClose={() => setSelId(null)} />}
      {creating && (
        <ProposalCreateDialog
          assets={creating}
          defaultKind={(creating[0].suggestion && creating[0].suggestion.kind) || 'thanh_ly'}
          onClose={() => setCreating(null)}
        />
      )}
    </div>
  );
};

export default AssetsPage;
