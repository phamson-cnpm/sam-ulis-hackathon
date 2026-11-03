
// Hàng chờ phiếu báo hỏng của Phòng QTNL: khẩn cấp lên đầu, phiếu cùng đợt đứng cạnh nhau.
import React, { useMemo, useState } from 'react';
import { refs, reportsApi } from '../utils/api';
import { useApi } from '../hooks/useApi';
import { dateTimeVN } from '../utils/format';
import { REPORT_STATUS } from '../utils/labels';
import { useAuth } from '../utils/AuthContext';
import { useToast } from '../utils/ToastContext';
import { FISCAL_YEAR } from '../config/app';
import { Button, Check, Empty, PageHeader, Pill, ReadOnlyTag, Table, Tabs, Td, Th, cx } from '../components/ui';
import { LightBadge } from '../components/Light';
import { Pager, usePaged } from '../components/Pager';

const QueuePage = ({ onNavigate }) => {
  const { user } = useAuth();
  const toast = useToast();
  const { data } = useApi(() => reportsApi.all(), []);
  const [tab, setTab] = useState('moi');
  const [mine, setMine] = useState(false);
  const isKtv = user.role === 'ktv';

  const groups = useMemo(() => {
    const list = (data || []).filter((r) =>
      tab === 'moi'
        ? r.status === 'da_gui'
        : tab === 'dang'
          ? r.status === 'dang_xu_ly' && (!mine || r.technicianId === user.id)
          : r.status === 'hoan_thanh' && r.createdAt.startsWith(String(FISCAL_YEAR)),
    );
    // Gom theo đợt; đợt có phiếu khẩn cấp lên đầu, sau đó theo thời gian gửi
    const by = new Map();
    list.forEach((r) => by.set(r.batchCode, [...(by.get(r.batchCode) || []), r]));
    const arr = [...by.entries()].map(([batch, rs]) => ({
      batch,
      rs,
      urgent: rs.some((r) => r.urgent),
      at: rs[0].createdAt,
    }));
    arr.sort((a, b) =>
      tab === 'xong' ? b.at.localeCompare(a.at) : Number(b.urgent) - Number(a.urgent) || a.at.localeCompare(b.at),
    );
    return arr;
  }, [data, tab, mine, user.id]);

  // Phân trang theo từng phiếu (20 phiếu một trang); đợt bị tách sang trang sau thì ghi "tiếp"
  const flat = useMemo(() => groups.flatMap((g) => g.rs.map((r) => ({ g, r }))), [groups]);
  const pager = usePaged(flat, [tab, mine]);
  const pageGroups = useMemo(() => {
    const out = [];
    pager.pageRows.forEach(({ g, r }) => {
      const last = out[out.length - 1];
      if (last && last.g === g) last.rows.push(r);
      else out.push({ g, rows: [r], cont: g.rs[0] !== r });
    });
    return out;
  }, [pager.pageRows]);

  const count = (t) =>
    (data || []).filter((r) =>
      t === 'moi'
        ? r.status === 'da_gui'
        : t === 'dang'
          ? r.status === 'dang_xu_ly'
          : r.status === 'hoan_thanh' && r.createdAt.startsWith(String(FISCAL_YEAR)),
    ).length;

  const accept = async (rs) => {
    for (const r of rs) await reportsApi.accept(r.id, user.id);
    toast(
      'success',
      `Đã nhận xử lý ${rs.length > 1 ? `${rs.length} phiếu đợt ${rs[0].batchCode}` : `phiếu ${rs[0].code}`}.`,
    );
    onNavigate('case', { reportId: rs[0].id });
  };

  return (
    <div>
      <PageHeader
        title="Hàng chờ phiếu báo hỏng"
        description={
          user.role === 'khtc'
            ? 'Phòng KHTC theo dõi việc tiếp nhận, xử lý của Phòng QTNL; không nhận phiếu, không sửa hồ sơ.'
            : 'Phiếu khẩn cấp xếp lên đầu, còn lại theo thứ tự gửi. Phiếu cùng một đợt hiện chung để kiểm tra lần lượt.'
        }
        actions={user.role === 'khtc' && <ReadOnlyTag />}
      />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { id: 'moi', label: 'Chờ tiếp nhận', count: count('moi') },
            { id: 'dang', label: 'Đang xử lý', count: count('dang') },
            { id: 'xong', label: `Hoàn thành năm ${FISCAL_YEAR}`, count: count('xong') },
          ]}
        />
        {tab === 'dang' && isKtv && (
          <div className="mb-4">
            <Check checked={mine} onChange={setMine} label="Chỉ phiếu tôi phụ trách" />
          </div>
        )}
      </div>

      <div className="rounded-[3px] border border-rule bg-surface">
        {data && groups.length === 0 ? (
          <Empty title={tab === 'moi' ? 'Không có phiếu mới.' : 'Không có phiếu nào.'} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Thời gian báo</Th>
                <Th>Mã phiếu</Th>
                <Th>Tài sản</Th>
                <Th>Vị trí</Th>
                <Th>Nội dung, tình huống</Th>
                <Th>Người báo</Th>
                <Th>Đèn</Th>
                <Th>{tab === 'moi' ? '' : 'Kỹ thuật viên'}</Th>
              </tr>
            </thead>
            {pageGroups.map(({ g, rows, cont }) => (
              <tbody key={g.batch} className={cx(g.urgent && tab !== 'xong' && 'bg-l-red-soft/35')}>
                {g.rs.length > 1 && (
                  <tr>
                    <td colSpan={8} className="border-b border-rule-2 bg-sunken px-3 py-1.5 text-[12.5px] text-muted">
                      Đợt <span className="num font-medium text-ink-2">{g.batch}</span>: {g.rs.length} tài sản cùng một
                      lần báo{cont ? ' (tiếp)' : ''}
                      {tab === 'moi' && isKtv && (
                        <Button size="sm" variant="primary" className="ml-3" onClick={() => accept(g.rs)}>
                          Nhận cả đợt
                        </Button>
                      )}
                    </td>
                  </tr>
                )}
                {rows.map((r) => {
                  const a = refs.assetById(r.assetId);
                  const light = a ? a.light : null;
                  return (
                    <tr key={r.id} className="hover:bg-sunken/70">
                      <Td className="num whitespace-nowrap">{dateTimeVN(r.createdAt)}</Td>
                      <Td className="num font-medium whitespace-nowrap">
                        {r.code}
                        {r.urgent && (
                          <div>
                            <Pill tone="red">Khẩn cấp</Pill>
                          </div>
                        )}
                        {r.mergedIntoCode && (
                          <div className="text-[12px] font-normal text-muted">Gộp vào {r.mergedIntoCode}</div>
                        )}
                      </Td>
                      <Td className="min-w-[180px]">
                        {r.assetName}
                        <div className="num text-[12.5px] text-muted">{a?.code ?? 'Chưa có mã tem'}</div>
                      </Td>
                      <Td className="whitespace-nowrap">{r.location}</Td>
                      <Td className="min-w-[220px]">
                        {r.content}
                        {r.situation && <div className="text-[12.5px] text-muted">{r.situation}</div>}
                      </Td>
                      <Td className="min-w-[140px]">
                        {r.reporterName}
                        <div className="text-[12.5px] text-muted">
                          {r.source === 'qtnl' ? 'QTNL phát hiện' : r.reporterUnit}
                        </div>
                      </Td>
                      <Td>
                        {light ? <LightBadge code={light.code} size="sm" /> : <span className="text-subtle">—</span>}
                      </Td>
                      <Td right className="whitespace-nowrap">
                        {tab === 'moi' ? (
                          isKtv ? (
                            <Button size="sm" variant="primary" onClick={() => accept([r])}>
                              Nhận xử lý
                            </Button>
                          ) : (
                            <div className="flex items-center justify-end gap-2">
                              <Pill>{REPORT_STATUS[r.status]}</Pill>
                              <Button size="sm" onClick={() => onNavigate('case', { reportId: r.id })}>
                                Xem
                              </Button>
                            </div>
                          )
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-left text-[13px] text-ink-2">
                              {refs.userById(r.technicianId)?.name}
                              {r.hasTempEquipment && (
                                <span className="block text-[12px] text-muted">Đã cấp thiết bị tạm</span>
                              )}
                            </span>
                            <Button size="sm" onClick={() => onNavigate('case', { reportId: r.id })}>
                              Mở hồ sơ
                            </Button>
                          </div>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </Table>
        )}
        <Pager pager={pager} />
      </div>
    </div>
  );
};

export default QueuePage;
