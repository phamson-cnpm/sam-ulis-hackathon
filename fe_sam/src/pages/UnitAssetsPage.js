// Cán bộ đầu mối đơn vị (mục 5.8 đề tài, bản 30/10/2026):
// - Xem tài sản toàn trường (lọc theo đơn vị, mặc định đơn vị mình), chỉ các cột: màu đèn, mã, tên, phòng ban, vị trí,
//   nguyên giá và Đề xuất. Máy chủ chỉ trả về các trường này (không có giá trị còn lại, chi phí sửa chữa, nhãn chi tiết).
// - Kiểm kê: tải danh sách đang lọc dạng Excel (.xlsx) và PDF, có cột Kiểm kê (0/1), Ghi chú để điền.
// - Gửi danh sách đề xuất thanh lý tài sản của đơn vị mình lên Phòng KHTC (qua lãnh đạo Phòng QTNL duyệt), nhập mã xác nhận.
// - Mọi lần xem, tải file đều ghi nhật ký theo tài khoản và mã đầu mối.
import React, { useEffect, useMemo, useState } from 'react';
import { CircleHelp, Download, FilePlus2, FileText, Search, Send } from 'lucide-react';
import { focalApi } from '../utils/api';
import { useApi } from '../hooks/useApi';
import { LIGHT_META, LIGHT_ORDER, RED } from '../utils/lights';
import { money } from '../utils/format';
import { PROPOSAL_KIND, PROPOSAL_OPEN, PROPOSAL_STATUS } from '../utils/labels';
import { useAuth } from '../utils/AuthContext';
import { useToast } from '../utils/ToastContext';
import { downloadXlsx } from '../utils/xlsx';
import { proposalText, unitAssetsSheets } from '../utils/exportSheets';
import { printList } from '../utils/printList';
import { ASSET_BOOK_DATE, TODAY } from '../config/app';
import { Button, Empty, Input, Notice, PageHeader, Select, Table, Td, Th, cx } from '../components/ui';
import { LightBadge, lightColor } from '../components/Light';
import { Pager, usePaged } from '../components/Pager';
import { ProposalCell, ProposalCreateDialog } from '../components/Proposals';
import { AssetPanel, useWide } from '../components/AssetPanel';

const WARN = ['do_1_1', 'do_1_2', 'cam', 'vang_3_1', 'vang_3_2', 'vang_3_3'];
const ALL = '__all__';
const slug = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

const UnitAssetsPage = ({ onNavigate }) => {
  const { user } = useAuth();
  const toast = useToast();
  const myUnit = user.focalUnit || user.unit;
  const { data: assets, error } = useApi(() => focalApi.unitAssets(), []);
  const [unit, setUnit] = useState(myUnit);
  const [q, setQ] = useState('');
  const [light, setLight] = useState('all');
  const [loc, setLoc] = useState('all');
  const [picked, setPicked] = useState([]);
  const [sending, setSending] = useState(null);
  const [sent, setSent] = useState(null); // danh sách vừa gửi: tải PDF, Excel để lưu hồ sơ đơn vị
  const [selId, setSelId] = useState(null); // dòng đang chọn (tô hồng), thông tin ở khung bên phải
  const wide = useWide();

  // Mỗi lần mở danh sách đều ghi nhật ký
  useEffect(() => {
    focalApi.log(null, 'xem', 'Danh sách tài sản toàn trường');
  }, []);

  const units = useMemo(() => [...new Set((assets || []).map((a) => a.unit))].sort((a, b) => a.localeCompare(b, 'vi')), [assets]);
  const inUnit = useMemo(() => (assets || []).filter((a) => unit === ALL || a.unit === unit), [assets, unit]);
  const counts = useMemo(() => {
    const c = {};
    inUnit.forEach((a) => {
      c[a.light.code] = (c[a.light.code] || 0) + 1;
    });
    return c;
  }, [inUnit]);
  const locations = useMemo(() => [...new Set(inUnit.map((a) => a.location))].sort(), [inUnit]);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return inUnit
      .filter(
        (a) =>
          (light === 'all' || (light === 'warn' ? WARN.includes(a.light.code) : a.light.code === light)) &&
          (loc === 'all' || a.location === loc) &&
          (!s || a.code.toLowerCase().includes(s) || a.name.toLowerCase().includes(s) || a.location.toLowerCase().includes(s)),
      )
      .sort((a, b) => LIGHT_META[a.light.code].rank - LIGHT_META[b.light.code].rank || a.code.localeCompare(b.code));
  }, [inUnit, q, light, loc]);

  const unitNote = unit === ALL ? 'toàn trường' : unit;
  const filterNote = [
    unit === ALL ? 'toàn trường' : `đơn vị ${unit}`,
    light === 'all' ? '' : light === 'warn' ? 'đang cảnh báo' : `đèn ${LIGHT_META[light].label}`,
    loc === 'all' ? '' : `vị trí ${loc}`,
    q.trim() ? `tìm “${q.trim()}”` : '',
  ]
    .filter(Boolean)
    .join(', ');

  const pager = usePaged(rows, [q, light, loc, unit]);

  // Chỉ đề xuất tài sản của đơn vị mình, chưa có đề xuất đang xử lý
  const canPick = (a) => a.unit === myUnit && !(a.proposal && PROPOSAL_OPEN.includes(a.proposal.status));
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const pickable = rows.filter(canPick);
  const allShownPicked = pickable.length > 0 && pickable.every((a) => picked.includes(a.id));
  const redIds = (assets || []).filter((a) => a.unit === myUnit && RED.includes(a.light.code) && canPick(a)).map((a) => a.id);
  const pickedRows = (assets || []).filter((a) => picked.includes(a.id));
  const selected = selId ? (assets || []).find((a) => a.id === selId) : null;
  const panelActions = {
    onReport: (a) => onNavigate('report-new', { assetIds: [a.id] }),
    onPropose: selected && canPick(selected) ? (a) => setSending([a]) : undefined,
    onOpenProposal: (p) => onNavigate('proposals', { section: 'all', proposalId: p.id }),
  };

  const fileBase = `SAM_${slug(unit === ALL ? 'toan-truong' : unit)}_tai-san_${TODAY}`;

  const exportExcel = async () => {
    try {
      await downloadXlsx(fileBase, unitAssetsSheets(rows, { unit: unitNote, filterNote }));
      focalApi.log(null, 'xuat_excel', `Danh sách tài sản, lọc: ${filterNote} (${rows.length} tài sản)`);
      toast('success', `Đã tải file Excel ${rows.length} tài sản.`);
    } catch (e) {
      toast('error', `Không tạo được file Excel: ${e.message}`);
    }
  };

  const exportPdf = () => {
    const ok = printList({
      fileName: fileBase,
      unit: unit === ALL ? '' : unit,
      title: 'Danh sách tài sản theo màu đèn',
      subtitle: `Số liệu đến ngày ${TODAY.split('-').reverse().join('/')}; ${filterNote}; ${rows.length} tài sản`,
      columns: [
        { header: 'STT', align: 'center', width: '34px' },
        { header: 'Màu đèn', width: '70px' },
        { header: 'Mã tài sản', width: '120px' },
        { header: 'Tên tài sản' },
        { header: 'Phòng ban' },
        { header: 'Vị trí', width: '70px' },
        { header: 'Nguyên giá (đ)', align: 'right', width: '96px' },
        { header: 'Đề xuất' },
        { header: 'Kiểm kê', align: 'center', width: '52px' },
        { header: 'Ghi chú', width: '110px' },
      ],
      rows: rows.map((a, i) => [
        i + 1,
        LIGHT_META[a.light.code].label,
        a.code,
        a.name,
        a.unit,
        a.location,
        money(a.originalCost),
        proposalText(a),
        0,
        '',
      ]),
      note: 'Cột Kiểm kê: 0 chưa kiểm, đánh 1 khi thấy tài sản thực tế. Màu đèn chỉ là căn cứ đề xuất; thanh lý thực hiện theo quy định hiện hành.',
    });
    if (!ok) return toast('error', 'Trình duyệt đã chặn cửa sổ in. Cho phép cửa sổ bật lên rồi thử lại.');
    focalApi.log(null, 'tai_pdf', `Danh sách tài sản, lọc: ${filterNote} (${rows.length} tài sản)`);
  };

  const sentPdf = () => {
    const list = sent.proposals;
    const ok = printList({
      fileName: `SAM_${slug(myUnit)}_de-xuat_${TODAY}`,
      unit: myUnit,
      title: `Danh sách tài sản đề xuất ${list.every((p) => p.kind === 'thanh_ly') ? 'thanh lý' : 'xử lý'}`,
      subtitle: `Gửi Phòng Kế hoạch – Tài chính qua phần mềm SAM ngày ${TODAY.split('-').reverse().join('/')}${sent.batchCode ? ` (${sent.batchCode})` : ''}; ${list.length} tài sản; trạng thái: chờ lãnh đạo Phòng QTNL duyệt`,
      columns: [
        { header: 'STT', align: 'center', width: '34px' },
        { header: 'Số đề xuất', width: '70px' },
        { header: 'Mã tài sản', width: '120px' },
        { header: 'Tên tài sản' },
        { header: 'Phòng ban' },
        { header: 'Vị trí', width: '70px' },
        { header: 'Nguyên giá (đ)', align: 'right', width: '96px' },
        { header: 'Đèn', width: '64px' },
        { header: 'Loại' },
        { header: 'Lý do đề xuất' },
        { header: 'Trạng thái' },
      ],
      rows: list.map((p, i) => {
        const a = sent.assets.find((x) => x.id === p.assetId) || {};
        return [i + 1, p.code, a.code, a.name, a.unit, a.location, money(a.originalCost), LIGHT_META[a.light?.code]?.label || '', PROPOSAL_KIND[p.kind], p.reason, PROPOSAL_STATUS[p.status]];
      }),
      note: 'Danh sách gồm các cột cán bộ đầu mối được xem: mã, tên tài sản, phòng ban, vị trí, nguyên giá, màu đèn, đề xuất. Màu đèn là căn cứ để đề xuất; thanh lý thực hiện theo quy định hiện hành.',
    });
    if (!ok) return toast('error', 'Trình duyệt đã chặn cửa sổ in. Cho phép cửa sổ bật lên rồi thử lại.');
    focalApi.log(null, 'tai_pdf', `Danh sách đề xuất đã gửi ${sent.batchCode || sent.proposals[0].code} (${list.length} tài sản)`);
  };

  return (
    <div className={picked.length ? 'pb-20' : ''}>
      <PageHeader
        title="Thẻ tài sản (toàn trường)"
        description={`Cán bộ đầu mối ${myUnit}. Xem tài sản toàn trường theo màu đèn để theo dõi, kiểm kê; đề xuất xử lý tài sản của đơn vị mình. Tài khoản này không xem giá trị còn lại, chi phí sửa chữa.`}
        actions={
          <>
            <Button variant="create" icon={<FilePlus2 size={16} />} onClick={() => onNavigate('report-new')}>
              Báo hỏng
            </Button>
            <Button icon={<FileText size={16} />} onClick={exportPdf} disabled={!rows.length} title="Mở bản in, chọn Lưu dưới dạng PDF">
              Tải PDF
            </Button>
            <Button variant="primary" icon={<Download size={16} />} onClick={exportExcel} disabled={!rows.length} title="Danh sách đang lọc, có cột Kiểm kê, Ghi chú">
              Tải Excel (.xlsx)
            </Button>
          </>
        }
      />

      {sent && (
        <Notice tone="ok" className="mb-3" title={`Đã gửi ${sent.proposals.length} đề xuất${sent.batchCode ? ` (${sent.batchCode})` : ''}`}>
          <div className="flex flex-wrap items-center gap-2">
            <span>Lãnh đạo Phòng QTNL đã được thông báo. Tải bản lưu hồ sơ đơn vị:</span>
            <Button size="sm" icon={<FileText size={14} />} onClick={sentPdf}>
              Tải PDF danh sách vừa gửi
            </Button>
            <Button size="sm" onClick={() => onNavigate('proposals')}>
              Xem đề xuất của đơn vị
            </Button>
          </div>
        </Notice>
      )}

      {/* Đếm theo đèn, bấm để lọc */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        <button
          onClick={() => setLight('all')}
          className={cx(
            'h-8 rounded-[3px] border px-3 text-[13px]',
            light === 'all' ? 'border-accent bg-accent-soft font-semibold text-accent' : 'border-rule bg-surface text-ink-2 hover:bg-sunken',
          )}
        >
          Tất cả <span className="num ml-1">{inUnit.length}</span>
        </button>
        {LIGHT_ORDER.filter((c) => counts[c]).map((code) => {
          const c = lightColor(code);
          const on = light === code;
          return (
            <button
              key={code}
              onClick={() => setLight(on ? 'all' : code)}
              className={cx(
                'flex h-8 items-center gap-1.5 rounded-[3px] border px-2.5 text-[13px]',
                on ? 'font-semibold' : 'border-rule bg-surface text-ink-2 hover:bg-sunken',
              )}
              style={on ? { background: c.soft, borderColor: c.fg, color: c.fg } : undefined}
              title={LIGHT_META[code].desc}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: c.fg }} />
              {LIGHT_META[code].label}
              <span className="num">{counts[code]}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1 rounded-[3px] border border-rule bg-surface">
        <div className="flex flex-wrap items-center gap-2 border-b border-rule-2 p-3">
          <div className="relative min-w-[200px] flex-1">
            <Search size={16} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-subtle" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo mã tài sản, tên tài sản, phòng" className="pl-8" />
          </div>
          <Select
            value={unit}
            onChange={(e) => {
              setUnit(e.target.value);
              setLoc('all');
            }}
            className="w-auto max-w-[260px]"
            aria-label="Đơn vị"
          >
            <option value={myUnit}>{myUnit} (đơn vị mình)</option>
            <option value={ALL}>Tất cả đơn vị (toàn trường)</option>
            {units
              .filter((u) => u !== myUnit)
              .map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
          </Select>
          <Select value={loc} onChange={(e) => setLoc(e.target.value)} className="w-auto max-w-[160px]" aria-label="Vị trí">
            <option value="all">Tất cả vị trí</option>
            {locations.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </Select>
          <Button variant={light === 'warn' ? 'primary' : 'secondary'} onClick={() => setLight(light === 'warn' ? 'all' : 'warn')}>
            Chỉ tài sản đang cảnh báo
          </Button>
          <Button onClick={() => setPicked(redIds)} disabled={!redIds.length} title="Đèn Đỏ của đơn vị mình, chưa có đề xuất đang xử lý">
            Chọn tài sản đèn Đỏ của đơn vị
          </Button>
        </div>
        {error && <p className="p-4 text-l-red">{error}</p>}
        <Table scroll="calc(100vh - 330px)">
          <thead>
            <tr>
              <Th className="w-[40px]">
                <input
                  type="checkbox"
                  aria-label="Chọn mọi tài sản của đơn vị mình khớp bộ lọc"
                  title="Chọn mọi tài sản của đơn vị mình khớp bộ lọc (kể cả các trang khác)"
                  checked={allShownPicked}
                  disabled={!pickable.length}
                  onChange={(e) =>
                    setPicked((p) =>
                      e.target.checked
                        ? [...new Set([...p, ...pickable.map((a) => a.id)])]
                        : p.filter((id) => !pickable.some((a) => a.id === id)),
                    )
                  }
                  className="h-4 w-4 accent-[#2a78b8]"
                />
              </Th>
              <Th>
                <span className="inline-flex items-center gap-1">
                  Màu đèn
                  <button type="button" className="text-accent" title="Giải thích các đèn" onClick={() => onNavigate('lights')}>
                    <CircleHelp size={14} />
                  </button>
                </span>
              </Th>
              <Th>Mã tài sản</Th>
              <Th>Tên tài sản</Th>
              <Th>Phòng ban</Th>
              <Th>Vị trí</Th>
              <Th right>Nguyên giá (đ)</Th>
              <Th className="border-l border-rule !bg-accent-soft font-semibold text-accent">Đề xuất</Th>
            </tr>
          </thead>
          <tbody>
            {pager.pageRows.map((a) => {
              const on = picked.includes(a.id);
              const can = canPick(a);
              return (
                <tr
                  key={a.id}
                  onClick={() => setSelId(a.id)}
                  className={cx('cursor-pointer', selId === a.id ? '[&>td]:bg-sel' : on ? 'bg-accent-soft/40' : 'hover:bg-[#eef5fb]')}
                  aria-selected={selId === a.id}
                >
                  <Td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`Chọn ${a.code}`}
                      checked={on}
                      disabled={!can}
                      title={can ? '' : a.unit !== myUnit ? 'Chỉ đề xuất tài sản của đơn vị mình' : 'Đang có đề xuất chưa xử lý xong'}
                      onChange={() => toggle(a.id)}
                      className="h-4 w-4 accent-[#2a78b8] disabled:opacity-40"
                    />
                  </Td>
                  <Td>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigate('lights', { focus: a.light.code });
                      }}
                      title="Xem giải thích đèn này"
                    >
                      <LightBadge code={a.light.code} size="sm" />
                    </button>
                  </Td>
                  <Td className="num font-medium whitespace-nowrap text-accent">{a.code}</Td>
                  <Td className="min-w-[200px]">{a.name}</Td>
                  <Td className="min-w-[150px] text-ink-2">{a.unit}</Td>
                  <Td className="whitespace-nowrap">{a.location}</Td>
                  <Td right>{money(a.originalCost)}</Td>
                  <Td className={cx('border-l border-rule-2', selId !== a.id && 'bg-[#fbfcfd]')} onClick={(e) => e.stopPropagation()}>
                    <ProposalCell asset={a} onCreate={can ? (x) => setSending([x]) : undefined} />
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        <Pager pager={pager} />
        {assets && rows.length === 0 && <Empty title="Không có tài sản nào khớp bộ lọc.">Thử bỏ bớt điều kiện lọc.</Empty>}
        <p className="border-t border-rule-2 px-3 py-1.5 text-[12px] text-muted">
          Đang xem: {unitNote}.{ASSET_BOOK_DATE ? ` Nguyên giá theo sổ đến ${ASSET_BOOK_DATE}.` : ''} Mọi lần xem và tải file
          được ghi nhật ký theo tài khoản.
        </p>
      </div>
      {wide && <AssetPanel wide focal asset={selected} actions={panelActions} />}
      </div>
      {!wide && selected && <AssetPanel focal asset={selected} actions={panelActions} onClose={() => setSelId(null)} />}

      <Notice className="mt-4" title="Màu đèn chỉ là căn cứ đề xuất">
        Đèn Đỏ là tài sản trong danh sách chờ thanh lý; Vàng 3.1 là tài sản nằm kho lâu. Đề xuất đi qua lãnh đạo Phòng QTNL
        duyệt rồi chuyển Phòng KHTC; thanh lý thực hiện theo quy định hiện hành.
      </Notice>

      {picked.length > 0 && (
        <div className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-surface/95 backdrop-blur">
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <p className="text-[13.5px]">
              Đã chọn <span className="num font-semibold">{picked.length}</span> tài sản của đơn vị
            </p>
            <Button size="sm" variant="ghost" onClick={() => setPicked([])}>
              Bỏ chọn
            </Button>
            <div className="flex-1" />
            <Button
              icon={<FilePlus2 size={16} />}
              disabled={picked.length > 10}
              title={picked.length > 10 ? 'Báo hỏng tối đa 10 tài sản một lần' : 'Mở phiếu báo hỏng, điền sẵn các tài sản đã chọn'}
              onClick={() => onNavigate('report-new', { assetIds: picked })}
            >
              Báo hỏng tài sản đã chọn
            </Button>
            <Button variant="primary" icon={<Send size={16} />} onClick={() => setSending(pickedRows)}>
              Gửi danh sách đề xuất thanh lý lên Phòng KHTC
            </Button>
          </div>
        </div>
      )}

      {sending && (
        <ProposalCreateDialog
          assets={sending}
          defaultKind="thanh_ly"
          title={sending.length > 1 ? 'Gửi danh sách đề xuất thanh lý lên Phòng KHTC' : undefined}
          onClose={() => setSending(null)}
          onDone={(res) => {
            setSent({ ...res, assets: sending });
            setPicked([]);
          }}
        />
      )}
    </div>
  );
};

export default UnitAssetsPage;
