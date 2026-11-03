
// Theo dõi phiếu đã gửi. Cán bộ chỉ thấy trạng thái, không thấy biên bản, chi phí hay màu đèn.
import React, { useMemo, useState } from 'react';
import FormButton from '../components/FormButton';
import { FilePlus2 } from 'lucide-react';
import { refs, reportsApi } from '../utils/api';
import { useApi } from '../hooks/useApi';
import { dateTimeVN } from '../utils/format';
import { REPORT_STATUS } from '../utils/labels';
import { useAuth } from '../utils/AuthContext';
import { Button, Empty, PageHeader, Pill, Table, Tabs, Td, Th } from '../components/ui';
import { Pager, usePaged } from '../components/Pager';

const tone = (s) => (s === 'hoan_thanh' ? 'green' : s === 'dang_xu_ly' ? 'blue' : 'neutral');

const MyReportsPage = ({ onNavigate }) => {
  const { user } = useAuth();
  const { data } = useApi(() => reportsApi.mine(user.id), [user.id]);
  const [tab, setTab] = useState('all');
  const rows = useMemo(
    () =>
      (data || []).filter((r) =>
        tab === 'all' ? true : tab === 'open' ? r.status !== 'hoan_thanh' : r.status === 'hoan_thanh',
      ),
    [data, tab],
  );
  const open = (data || []).filter((r) => r.status !== 'hoan_thanh').length;
  const pager = usePaged(rows, tab);

  return (
    <div>
      <PageHeader
        title="Phiếu của tôi"
        description="Trạng thái chỉ có ba mức: đã gửi, đang xử lý, hoàn thành. Bạn nhận thông báo khi phiếu hoàn thành."
        actions={
          <Button variant="create" icon={<FilePlus2 size={16} />} onClick={() => onNavigate('report-new')}>
            Báo hỏng
          </Button>
        }
      />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'all', label: 'Tất cả', count: data?.length ?? 0 },
          { id: 'open', label: 'Chưa xong', count: open },
          { id: 'done', label: 'Hoàn thành', count: (data?.length ?? 0) - open },
        ]}
      />
      <div className="rounded-[3px] border border-rule bg-surface">
        {data && rows.length === 0 ? (
          <Empty title="Chưa có phiếu nào.">Khi thiết bị hỏng, bấm Báo hỏng và gõ mã tem dán trên thiết bị.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Thời gian báo</Th>
                <Th>Mã đợt</Th>
                <Th>Mã phiếu</Th>
                <Th>Tài sản</Th>
                <Th>Vị trí</Th>
                <Th>Nội dung báo hỏng</Th>
                <Th>Trạng thái</Th>
                <Th>Kỹ thuật viên phụ trách</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {pager.pageRows.map((r) => {
                const a = refs.assetById(r.assetId);
                return (
                  <tr key={r.id}>
                    <Td className="num whitespace-nowrap">{dateTimeVN(r.createdAt)}</Td>
                    <Td className="num whitespace-nowrap text-ink-2">{r.batchCode}</Td>
                    <Td className="num font-medium whitespace-nowrap">{r.code}</Td>
                    <Td className="min-w-[180px]">
                      {r.assetName}
                      <div className="num text-[12.5px] text-muted">{a?.code ?? 'Chờ kỹ thuật viên gán mã'}</div>
                    </Td>
                    <Td className="whitespace-nowrap">{r.location}</Td>
                    <Td className="min-w-[200px] text-ink-2">
                      {r.content}
                      {r.urgent && (
                        <Pill tone="red" className="ml-1.5">
                          Khẩn cấp
                        </Pill>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap">
                      <Pill tone={tone(r.status)}>{REPORT_STATUS[r.status]}</Pill>
                      {r.hasTempEquipment && (
                        <div className="mt-1 text-[12.5px] text-muted">Đã cấp thiết bị tạm thời</div>
                      )}
                      {r.mergedIntoCode && (
                        <div className="mt-1 text-[12.5px] text-muted" title="Phiếu trùng sự cố, xử lý một lần theo phiếu chính">
                          Gộp vào <span className="num">{r.mergedIntoCode}</span>
                        </div>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap">
                      {refs.userById(r.technicianId)?.name ?? <span className="text-subtle">Chưa phân công</span>}
                    </Td>
                    <Td right>
                      <FormButton source={{ type: 'case', reportId: r.id, focus: 'PH' }}>Xem phiếu</FormButton>
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

export default MyReportsPage;
