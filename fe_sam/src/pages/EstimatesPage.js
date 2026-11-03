
// Danh sách phiếu dự toán. Kỹ thuật viên theo dõi phiếu của mình; Phòng KHTC đối chiếu chi phí với chứng từ.
import React, { useMemo, useState } from 'react';
import FormButton from '../components/FormButton';
import { refs, estimatesApi, exportLogApi } from '../utils/api';
import { downloadXlsx } from '../utils/xlsx';
import { estimatesSheets } from '../utils/exportSheets';
import { useToast } from '../utils/ToastContext';
import { TODAY } from '../config/app';
import { Download } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { countedCost } from '../utils/lights';
import { dateVN, money } from '../utils/format';
import { ESTIMATE_STATUS } from '../utils/labels';
import { voucherGroups, voucherKey } from '../utils/vouchers';
import { useAuth } from '../utils/AuthContext';
import { Button, Check, Empty, Notice, PageHeader, Pill, ReadOnlyTag, statusSince, Table, Tabs, Td, Th, WaitDays } from '../components/ui';
import { LightBadge } from '../components/Light';
import { Pager, usePaged } from '../components/Pager';

const inTab = (e, t) =>
  t === 'cho'
    ? e.status === 'cho_lanh_dao' || e.status === 'can_kiem_tra_lai'
    : t === 'ky'
      ? e.status === 'da_xac_nhan'
      : t === 'thucte'
        ? e.status === 'da_ky_du' && !e.actualEnteredAt
        : t === 'xong'
          ? !!e.actualEnteredAt
          : e.status === 'khong_dong_y';

const WAITING = ['cho_lanh_dao', 'can_kiem_tra_lai', 'da_xac_nhan'];

const EstimatesPage = ({ onNavigate }) => {
  const { user } = useAuth();
  const isKhtc = user.role === 'khtc';
  const toast = useToast();
  const { data } = useApi(() => estimatesApi.list(), []);
  const [tab, setTab] = useState(isKhtc ? 'thucte' : 'cho');
  const [mine, setMine] = useState(user.role === 'ktv');

  const base = useMemo(() => (data || []).filter((e) => !mine || e.createdBy === user.id), [data, mine, user.id]);
  const rows = base.filter((e) => inTab(e, tab));
  const vouchers = useMemo(() => voucherGroups(data), [data]);
  const pager = usePaged(rows, [tab, mine]);
  const n = (t) => base.filter((e) => inTab(e, t)).length;
  const TAB_LABEL = {
    cho: 'Chờ lãnh đạo phòng',
    ky: 'Chờ in và ký',
    thucte: 'Chờ chi phí thực tế',
    xong: 'Đã có chứng từ',
    khong: 'Không đồng ý',
  };

  const exportXlsx = async () => {
    try {
      await downloadXlsx(
        `SAM_phieu-du-toan_${TODAY}`,
        estimatesSheets(rows, {
          assetOf: refs.assetById,
          nameOf: (id) => refs.userById(id)?.name ?? '',
          tabLabel: `mục ${TAB_LABEL[tab]}${mine ? ', phiếu tôi lập' : ''}`,
        }),
      );
      exportLogApi.log(user, 'xuat_excel', `Phiếu dự toán, mục ${TAB_LABEL[tab]} (${rows.length} phiếu)`);
      toast('success', `Đã tải file Excel ${rows.length} phiếu.`);
    } catch (e) {
      toast('error', `Không tạo được file Excel: ${e.message}`);
    }
  };

  return (
    <div>
      <PageHeader
        title={isKhtc ? 'Đối chiếu chi phí sửa chữa' : 'Dự toán sửa chữa, thay thế'}
        description={
          isKhtc
            ? 'Phòng KHTC không nhập chi phí mà đối chiếu số Phòng QTNL nhập với chứng từ thanh toán. Khoản còn ở dạng dự toán thì đề nghị kỹ thuật viên cập nhật số thực tế.'
            : 'Mỗi tài sản một phiếu để tính đèn đúng. Chi phí chỉ có hai trạng thái: dự toán trước khi sửa và thực tế khi có chứng từ.'
        }
        actions={
          <>
            {isKhtc && <ReadOnlyTag title="Phòng KHTC xem, đối chiếu số Phòng QTNL nhập; không sửa phiếu dự toán" />}
            <Button
              icon={<Download size={16} />}
              onClick={exportXlsx}
              disabled={!rows.length}
              title="Tải danh sách đang xem"
            >
              Tải Excel (.xlsx)
            </Button>
          </>
        }
      />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            ...Object.keys(TAB_LABEL).map((id) => ({ id, label: TAB_LABEL[id], count: n(id) })),
          ]}
        />
        {user.role === 'ktv' && (
          <div className="mb-4">
            <Check checked={mine} onChange={setMine} label="Chỉ phiếu tôi lập" />
          </div>
        )}
      </div>
      {isKhtc && tab === 'thucte' && n('thucte') > 0 && (
        <Notice tone="warn" className="mb-4" title={`${n('thucte')} phiếu đã ký đủ nhưng chưa có số thực tế`}>
          Đèn của các tài sản này đang tính theo dự toán và mang nhãn “Tạm tính”.
        </Notice>
      )}
      <div className="rounded-[3px] border border-rule bg-surface">
        {data && rows.length === 0 ? (
          <Empty title="Không có phiếu nào." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Số phiếu</Th>
                <Th>Ngày lập</Th>
                <Th>Tài sản</Th>
                <Th right>Dự toán (đ)</Th>
                <Th right>Tính vào đèn (đ)</Th>
                <Th right>Thực tế (đ)</Th>
                <Th>Chứng từ</Th>
                <Th>Đèn sau phiếu</Th>
                <Th>Trạng thái</Th>
                <Th>Người lập</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {pager.pageRows.map((e) => {
                const a = refs.assetById(e.assetId);
                const total = e.lines.reduce((s, l) => s + l.estimate, 0);
                const actual = e.actualEnteredAt ? e.lines.reduce((s, l) => s + (l.actual ?? 0), 0) : null;
                return (
                  <tr
                    key={e.id}
                    className="cursor-pointer hover:bg-sunken"
                    onClick={() =>
                      e.reportId
                        ? onNavigate('case', { reportId: e.reportId })
                        : onNavigate('asset', { assetId: e.assetId })
                    }
                  >
                    <Td className="num font-medium whitespace-nowrap">
                      {e.code}
                      {e.locked && (
                        <div>
                          <Pill tone="red">Bị khóa</Pill>
                        </div>
                      )}
                    </Td>
                    <Td className="num whitespace-nowrap">{dateVN(e.createdAt)}</Td>
                    <Td className="min-w-[200px]">
                      {a?.name}
                      <div className="num text-[12.5px] text-muted">
                        {a?.code}, {a?.location}
                      </div>
                    </Td>
                    <Td right>{money(total)}</Td>
                    <Td right>{money(countedCost(e.lines).cost)}</Td>
                    <Td right>{actual === null ? <span className="text-subtle">—</span> : money(actual)}</Td>
                    <Td className="text-[13px] whitespace-nowrap">
                      {e.voucherNo ?? <span className="text-subtle">Chưa có</span>}
                      {e.voucherNo &&
                        (() => {
                          const v = vouchers[voucherKey(e.voucherNo)];
                          if (!v) return null;
                          return (
                            <>
                              {v.count > 1 && <div className="text-[12px] text-muted">Hóa đơn gộp {v.count} mã</div>}
                              {v.total !== null && v.sum !== v.total && (
                                <div>
                                  <Pill tone="amber">
                                    Các mã {money(v.sum)} / hóa đơn {money(v.total)} đ
                                  </Pill>
                                </div>
                              )}
                            </>
                          );
                        })()}
                    </Td>
                    <Td>
                      <LightBadge code={e.lightAfter} size="sm" />
                    </Td>
                    <Td className="whitespace-nowrap">
                      {ESTIMATE_STATUS[e.status]}
                      {(WAITING.includes(e.status) || (e.status === 'da_ky_du' && !e.actualEnteredAt)) && (
                        <div>
                          <WaitDays since={statusSince(e)} />
                        </div>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap">{refs.userById(e.createdBy)?.name}</Td>
                    <Td right>
                      {e.reportId && (
                        <FormButton source={{ type: 'case', reportId: e.reportId, focus: 'DT' }}>Biểu mẫu</FormButton>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
        <Pager pager={pager} />
      </div>
    </div>
  );
};

export default EstimatesPage;
