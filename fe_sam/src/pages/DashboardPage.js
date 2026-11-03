
// Tổng quan cho Phòng KHTC và Phòng QTNL (mục VI đề tài), in ra để báo cáo Ban Giám hiệu.
import React, { useMemo } from 'react';
import { Download, Printer } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { assetsApi, estimatesApi, exportLogApi, noSpareApi } from '../utils/api';
import { downloadXlsx } from '../utils/xlsx';
import { dashboardSheets } from '../utils/exportSheets';
import { useAuth } from '../utils/AuthContext';
import { useToast } from '../utils/ToastContext';
import { useApi } from '../hooks/useApi';
import { countedCost, LIGHT_META, LIGHT_ORDER, RED } from '../utils/lights';
import { dateVN, money, pct } from '../utils/format';
import { TODAY, FISCAL_YEAR } from '../config/app';
import { Button, cx, Empty, PageHeader, Panel, Table, Td, Th } from '../components/ui';
import { LightBadge, lightColor } from '../components/Light';
import { Pager, usePaged } from '../components/Pager';

const WARN = ['do_1_1', 'do_1_2', 'cam', 'vang_3_1', 'vang_3_2', 'vang_3_3'];
const COLS = [
  { label: 'Đỏ', codes: ['do_1_1', 'do_1_2'], tone: 'do_1_1' },
  { label: 'Cam', codes: ['cam'], tone: 'cam' },
  { label: 'Vàng', codes: ['vang_3_1', 'vang_3_2', 'vang_3_3'], tone: 'vang_3_1' },
  { label: 'Xanh lá', codes: ['xanh_la'], tone: 'xanh_la' },
  { label: 'Xanh dương', codes: ['xanh_duong'], tone: 'xanh_duong' },
];

const DashboardPage = ({ onNavigate }) => {
  const { user } = useAuth();
  const toast = useToast();
  const { data: assets } = useApi(() => assetsApi.list(), []);
  const { data: estimates } = useApi(() => estimatesApi.list(), []);
  const { data: noSpares } = useApi(() => noSpareApi.list(), []);

  // Tài sản đã thanh lý thôi tính đèn, không tính vào tổng quan
  const live = useMemo(() => (assets ? assets.filter((a) => a.status !== 'da_thanh_ly') : null), [assets]);

  const stats = useMemo(() => {
    if (!live || !estimates) return null;
    const assets = live;
    const by = {};
    assets.forEach((a) => (by[a.light.code] = [...(by[a.light.code] || []), a]));
    const warn = assets.filter((a) => WARN.includes(a.light.code));
    const red = assets.filter((a) => RED.includes(a.light.code));
    const yearEst = estimates.filter((e) => e.createdAt.startsWith(String(FISCAL_YEAR)) && e.status !== 'khong_dong_y');
    const yearRepair = yearEst.reduce((s, e) => s + countedCost(e.lines).cost, 0);
    const yearAll = yearEst.reduce((s, e) => s + e.lines.reduce((x, l) => x + (l.actual ?? l.estimate), 0), 0);
    const months = Array.from({ length: Number(TODAY.slice(5, 7)) }, (_, i) => {
      const m = String(i + 1).padStart(2, '0');
      const list = yearEst.filter((e) => e.createdAt.slice(5, 7) === m);
      return {
        thang: `T${i + 1}`,
        suaChua: list.reduce((s, e) => s + countedCost(e.lines).cost, 0) / 1e6,
        baoDuong:
          list.reduce(
            (s, e) =>
              s + e.lines.filter((l) => l.costGroup === 'khong_tinh').reduce((x, l) => x + (l.actual ?? l.estimate), 0),
            0,
          ) / 1e6,
      };
    });
    const units = [...new Set(assets.map((a) => a.unit))]
      .map((u) => {
        const list = assets.filter((a) => a.unit === u);
        return {
          unit: u,
          total: list.length,
          cols: COLS.map((c) => list.filter((a) => c.codes.includes(a.light.code)).length),
        };
      })
      .sort((a, b) => b.cols[0] + b.cols[1] + b.cols[2] - (a.cols[0] + a.cols[1] + a.cols[2]) || b.total - a.total);
    const groups = [...new Set(assets.map((a) => a.groupCode))]
      .map((g) => {
        const list = assets.filter((a) => a.groupCode === g);
        return {
          code: g,
          name: list[0].groupName,
          total: list.length,
          cols: COLS.map((c) => list.filter((a) => c.codes.includes(a.light.code)).length),
        };
      })
      .sort((a, b) => b.cols[0] + b.cols[1] + b.cols[2] - (a.cols[0] + a.cols[1] + a.cols[2]) || b.total - a.total);
    // Sửa chữa kéo dài: chi phí sửa cộng dồn từ khi dùng SAM chạm ngưỡng (đèn Vàng 3.3 hoặc nhãn phụ)
    const longRepair = assets
      .filter((a) => a.light.labels.includes('Sửa chữa kéo dài'))
      .sort((a, b) => b.light.cumulativeRatio - a.light.cumulativeRatio);
    const costly = [...assets]
      .filter((a) => a.light.cumulativeCost > 0)
      .sort((a, b) => b.light.cumulativeCost - a.light.cumulativeCost)
      .slice(0, 8);
    const overLife = by['xanh_la'] || [];
    const idle = by['vang_3_1'] || [];
    return { by, warn, red, yearRepair, yearAll, months, units, groups, longRepair, costly, overLife, idle };
  }, [live, estimates]);

  // 20 dòng một trang trên màn hình; khi in báo cáo vẫn in đủ mọi dòng
  const unitPager = usePaged(stats?.units);
  const groupPager = usePaged(stats?.groups);
  const redPager = usePaged(stats?.red);
  const longPager = usePaged(stats?.longRepair);
  const idlePager = usePaged(stats?.idle);

  if (!assets || !stats) return <p className="text-muted">Đang tải…</p>;
  const sum = (l, f) => l.reduce((s, a) => s + f(a), 0);
  const maxBar = Math.max(...LIGHT_ORDER.map((c) => stats.by[c]?.length || 0), 1);

  return (
    <div>
      <PageHeader
        title="Tổng quan tài sản"
        description={`Số liệu đến ngày ${dateVN(TODAY)}. Dùng để báo cáo Ban Giám hiệu và lập kế hoạch sửa chữa, mua sắm năm ${FISCAL_YEAR + 1}.`}
        actions={
          <span className="no-print flex flex-wrap gap-2">
            <Button
              icon={<Printer size={16} />}
              onClick={() => {
                exportLogApi.log(user, 'in', 'Tổng quan tài sản (báo cáo)');
                window.print();
              }}
            >
              In báo cáo
            </Button>
            <Button
              icon={<Download size={16} />}
              title="Số liệu các bảng trên trang, mỗi bảng một trang tính"
              onClick={async () => {
                try {
                  await downloadXlsx(
                    `SAM_tong-quan-tai-san_${TODAY}`,
                    dashboardSheets({ assets: live, stats, noSpares: noSpares || [], year: FISCAL_YEAR }),
                  );
                  exportLogApi.log(user, 'xuat_excel', 'Tổng quan tài sản');
                  toast('success', 'Đã tải file Excel tổng quan tài sản.');
                } catch (e) {
                  toast('error', `Không tạo được file Excel: ${e.message}`);
                }
              }}
            >
              Tải Excel (.xlsx)
            </Button>
          </span>
        }
      />

      {/* Số liệu chính: một dải, chia ô bằng đường kẻ */}
      <div className="grid gap-px overflow-hidden rounded-[3px] border border-rule bg-rule-2 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            k: 'Tài sản đang theo dõi',
            v: live.length,
            sub: `Nguyên giá ${money(sum(live, (a) => a.originalCost))} đ`,
          },
          {
            k: 'Đang cảnh báo (Đỏ, Cam, Vàng)',
            v: stats.warn.length,
            sub: `${pct(live.length ? stats.warn.length / live.length : 0, 0)} tổng số tài sản`,
          },
          {
            k: 'Chờ thanh lý (Đỏ)',
            v: stats.red.length,
            sub: `Nguyên giá ${money(sum(stats.red, (a) => a.originalCost))} đ`,
          },
          {
            k: `Sửa chữa, thay linh kiện năm ${FISCAL_YEAR} (phần tính vào đèn)`,
            v: `${money(stats.yearRepair)} đ`,
            sub: `Tổng chi phí năm, cả bảo dưỡng, vật tư: ${money(stats.yearAll)} đ`,
          },
        ].map((x, i) => (
          <div key={i} className="bg-surface px-5 py-4">
            <p className="text-[13px] text-muted">{x.k}</p>
            <p className="num mt-1 text-[28px] leading-9 font-semibold text-ink">{x.v}</p>
            <p className="num text-[12.5px] text-subtle">{x.sub}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <Panel title="Số tài sản theo màu đèn">
          <ul className="space-y-2.5">
            {LIGHT_ORDER.map((code) => {
              const n = stats.by[code]?.length || 0;
              const c = lightColor(code);
              return (
                <li key={code} className="grid grid-cols-[96px_1fr_40px] items-center gap-3">
                  <span className="text-[13px] font-medium" style={{ color: c.fg }}>
                    {LIGHT_META[code].label}
                  </span>
                  <span className="h-[14px] rounded-[3px] bg-rule-2">
                    <span
                      className="block h-full rounded-[3px]"
                      style={{ width: `${(n / maxBar) * 100}%`, background: c.fg, minWidth: n ? 3 : 0 }}
                    />
                  </span>
                  <span className="num text-right font-semibold">{n}</span>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-[12.5px] text-subtle">
            Đèn tính theo năm tài chính {FISCAL_YEAR}; riêng Vàng 3.3 cộng dồn nhiều năm.
          </p>
        </Panel>

        <Panel title={`Chi phí theo tháng năm ${FISCAL_YEAR} (triệu đồng)`}>
          <div className="h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.months} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                <CartesianGrid vertical={false} stroke="#ebeef2" />
                <XAxis
                  dataKey="thang"
                  tickLine={false}
                  axisLine={{ stroke: '#dde1e7' }}
                  tick={{ fontSize: 12, fill: '#5e6878' }}
                />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#5e6878' }} />
                <Tooltip
                  cursor={{ fill: '#f5f6f8' }}
                  formatter={(v, n) => [
                    `${v.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} tr`,
                    n === 'suaChua' ? 'Sửa chữa, thay linh kiện' : 'Bảo dưỡng, vật tư',
                  ]}
                  contentStyle={{ borderRadius: 6, border: '1px solid #dde1e7', fontSize: 13 }}
                />
                <Bar dataKey="suaChua" stackId="a" fill="#2a78b8" maxBarSize={28} />
                <Bar dataKey="baoDuong" stackId="a" fill="#b6d3ec" maxBarSize={28} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex gap-4 text-[12.5px] text-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-accent" /> Sửa chữa, thay linh kiện (tính vào đèn)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-accent-line" /> Bảo dưỡng, vật tư, phụ kiện
            </span>
          </div>
        </Panel>
      </div>

      <Panel title="Theo đơn vị" className="mt-5" bodyClass="p-0">
        <Table>
          <thead>
            <tr>
              <Th>Đơn vị quản lý, sử dụng</Th>
              <Th right>Tổng</Th>
              {COLS.map((c) => (
                <Th key={c.label} right>
                  {c.label}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stats.units.map((u, i) => (
              <tr key={u.unit} className={pageRowClass(unitPager, i)}>
                <Td>{u.unit}</Td>
                <Td right className="font-medium">
                  {u.total}
                </Td>
                {u.cols.map((n, i) => (
                  <Td
                    key={i}
                    right
                    style={n ? { color: lightColor(COLS[i].tone).fg, fontWeight: 600 } : undefined}
                    className={n ? '' : 'text-rule'}
                  >
                    {n || '·'}
                  </Td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
        <Pager pager={unitPager} />
      </Panel>

      <Panel title="Theo nhóm tài sản" className="mt-5" bodyClass="p-0">
        <Table>
          <thead>
            <tr>
              <Th>Nhóm tài sản</Th>
              <Th right>Tổng</Th>
              {COLS.map((c) => (
                <Th key={c.label} right>
                  {c.label}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stats.groups.map((g, i) => (
              <tr key={g.code} className={pageRowClass(groupPager, i)}>
                <Td>
                  <span className="num text-muted">{g.code}</span> {g.name}
                </Td>
                <Td right className="font-medium">
                  {g.total}
                </Td>
                {g.cols.map((n, i) => (
                  <Td
                    key={i}
                    right
                    style={n ? { color: lightColor(COLS[i].tone).fg, fontWeight: 600 } : undefined}
                    className={n ? '' : 'text-rule'}
                  >
                    {n || '·'}
                  </Td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
        <Pager pager={groupPager} />
      </Panel>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Panel title="Chờ thanh lý" bodyClass="p-0">
          {stats.red.length === 0 ? (
            <Empty title="Không có tài sản chờ thanh lý." />
          ) : (
            <AssetRows
              pager={redPager}
              list={stats.red}
              go={(id) => onNavigate('asset', { assetId: id })}
              extra={(a) => a.light.labels.join('; ')}
            />
          )}
        </Panel>
        <Panel title="Tốn kém nhất (chi phí sửa cộng dồn)" bodyClass="p-0">
          <AssetRows
            list={stats.costly}
            go={(id) => onNavigate('asset', { assetId: id })}
            extra={(a) => `${money(a.light.cumulativeCost)} đ (${pct(a.light.cumulativeRatio)})`}
          />
        </Panel>
        <Panel title="Sửa chữa kéo dài (Vàng 3.3)" bodyClass="p-0">
          {stats.longRepair.length === 0 ? (
            <Empty title="Không có tài sản sửa chữa kéo dài." />
          ) : (
            <AssetRows
              pager={longPager}
              list={stats.longRepair}
              go={(id) => onNavigate('asset', { assetId: id })}
              extra={(a) => `${money(a.light.cumulativeCost)} đ (${pct(a.light.cumulativeRatio)}), rà soát thay thế`}
            />
          )}
        </Panel>
        <Panel title="Tồn kho cần rà soát, điều chuyển" bodyClass="p-0">
          {stats.idle.length === 0 ? (
            <Empty title="Không có tài sản tồn kho quá hạn." />
          ) : (
            <AssetRows
              pager={idlePager}
              list={stats.idle}
              go={(id) => onNavigate('asset', { assetId: id })}
              extra={(a) => `${a.light.warehouseMonths} tháng, nguyên giá ${money(a.originalCost)} đ`}
            />
          )}
        </Panel>
        <Panel
          className="xl:col-span-2"
          title="Tài sản vượt vòng đời"
          aside={<span className="num text-[13px] text-muted">{stats.overLife.length} tài sản</span>}
        >
          <p className="text-ink-2">
            Đã hết hao mòn nhưng vẫn dùng tốt, năm nay không phải sửa. Tổng nguyên giá{' '}
            <span className="num font-semibold text-ink">{money(sum(stats.overLife, (a) => a.originalCost))} đ</span>,
            là phần ngân sách mua mới Nhà trường chưa phải chi.
          </p>
          <p className="mt-2 text-[13px] text-muted">Danh sách đầy đủ ở trang Tài sản, lọc theo đèn Xanh lá.</p>
        </Panel>
      </div>

      <NoSparePanel list={noSpares || []} />
    </div>
  );
};

/** Các lần Phòng QTNL ghi nhận kho không có thiết bị thay thế: dữ liệu cho kế hoạch mua sắm thiết bị dự phòng. */
const NoSparePanel = ({ list }) => {
  const groups = {};
  list.forEach((n) => {
    const g = groups[n.need] || (groups[n.need] = { need: n.need, count: 0, last: n, reasons: new Set() });
    g.count += 1;
    g.reasons.add(n.reason);
    if (n.recordedAt > g.last.recordedAt) g.last = n;
  });
  const rows = Object.values(groups).sort((a, b) => b.count - a.count || b.last.recordedAt.localeCompare(a.last.recordedAt));
  const pager = usePaged(rows);
  return (
    <Panel
      title="Kho không có thiết bị thay thế"
      className="mt-5"
      bodyClass="p-0"
      aside={<span className="text-[13px] text-muted">Dữ liệu cho kế hoạch mua sắm thiết bị dự phòng</span>}
    >
      {rows.length === 0 ? (
        <Empty title="Chưa có lần nào kho thiếu thiết bị thay thế." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Thiết bị cần cấp tạm</Th>
              <Th right>Số lần thiếu</Th>
              <Th>Gần nhất</Th>
              <Th>Lý do</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((g, i) => (
              <tr key={g.need} className={pageRowClass(pager, i)}>
                <Td className="font-medium">{g.need}</Td>
                <Td right className="num">
                  {g.count}
                </Td>
                <Td className="num whitespace-nowrap">{dateVN(g.last.recordedAt)}</Td>
                <Td className="text-ink-2">{[...g.reasons].join('; ')}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Pager pager={pager} />
    </Panel>
  );
};

/** Dòng không thuộc trang đang xem: ẩn trên màn hình, vẫn in khi In báo cáo. */
const pageRowClass = (pager, i) => (pager && !pager.inPage(i) ? 'hidden print:table-row' : '');

const AssetRows = ({ list, go, extra, pager }) => (
  <>
    <Table>
      <tbody>
        {list.map((a, i) => (
          <tr key={a.id} onClick={() => go(a.id)} className={cx('cursor-pointer hover:bg-sunken', pageRowClass(pager, i))}>
            <Td className="w-[112px]">
              <LightBadge code={a.light.code} size="sm" />
            </Td>
            <Td>
              <div className="font-medium">{a.name}</div>
              <div className="num text-[12.5px] text-muted">
                {a.code}, {a.unit}
              </div>
            </Td>
            <Td right className="text-[13px] text-ink-2">
              {extra(a)}
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
    {pager && <Pager pager={pager} />}
  </>
);

export default DashboardPage;
