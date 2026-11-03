
// Phòng KHTC: nhật ký mọi lần In, Tải Word, Tải Excel, ghi theo người thao tác
// (mỗi người một tài khoản cá nhân; cán bộ đầu mối ghi thêm theo mã đầu mối của đơn vị).
import React, { useMemo, useState } from 'react';
import { refs, exportLogApi } from '../utils/api';
import { useApi } from '../hooks/useApi';
import { dateTimeVN } from '../utils/format';
import { FOCAL_ACTION, ROLE_LABEL } from '../utils/labels';
import { Empty, PageHeader, Pill, Table, Tabs, Td, Th } from '../components/ui';
import { Pager, usePaged } from '../components/Pager';

const GROUPS = [
  { id: 'all', label: 'Tất cả', match: () => true },
  { id: 'qtnl', label: 'Phòng QTNL', match: (l) => l.role === 'ktv' || l.role === 'lanhdao_qtnl' },
  { id: 'khtc', label: 'Phòng KHTC', match: (l) => l.role === 'khtc' },
  { id: 'daumoi', label: 'Đầu mối đơn vị', match: (l) => l.role === 'daumoi' },
];
const TONE = { tai_word: 'blue', xuat_excel: 'green', tai_pdf: 'blue', in: 'neutral' };

const ExportLogsPage = () => {
  const { data } = useApi(() => exportLogApi.list(), []);
  const [tab, setTab] = useState('all');
  const g = GROUPS.find((x) => x.id === tab);
  const rows = useMemo(() => (data || []).filter(g.match), [data, g]);
  const pager = usePaged(rows, tab);

  return (
    <div>
      <PageHeader
        title="Nhật ký xuất file"
        description="Mọi lần In, Tải Word, Tải Excel (.xlsx), Tải PDF trên SAM, ghi theo tài khoản cá nhân của người thao tác; cán bộ đầu mối ghi thêm theo mã đầu mối của đơn vị."
      />
      <Tabs
        value={tab}
        onChange={setTab}
        items={GROUPS.map((x) => ({ id: x.id, label: x.label, count: (data || []).filter(x.match).length }))}
      />
      <div className="rounded-[3px] border border-rule bg-surface">
        {data && rows.length === 0 ? (
          <Empty title="Chưa có lần xuất file nào." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Thời gian</Th>
                <Th>Người xuất</Th>
                <Th>Định dạng</Th>
                <Th>Nội dung</Th>
              </tr>
            </thead>
            <tbody>
              {pager.pageRows.map((l) => (
                <tr key={l.id} className="hover:bg-sunken">
                  <Td className="num whitespace-nowrap">{dateTimeVN(l.at)}</Td>
                  <Td className="min-w-[200px]">
                    {l.role === 'daumoi' ? (
                      <>
                        {l.name}
                        <div className="text-[12.5px] text-muted">
                          Mã <span className="num">{l.code}</span>, đầu mối {l.unit}
                        </div>
                      </>
                    ) : (
                      <>
                        {l.name}
                        <div className="text-[12.5px] text-muted">
                          {ROLE_LABEL[l.role]}
                          {refs.userById(l.userId)?.code && (
                            <>
                              , mã <span className="num">{refs.userById(l.userId).code}</span>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap">
                    <Pill tone={TONE[l.action] || 'neutral'}>{FOCAL_ACTION[l.action] || l.action}</Pill>
                  </Td>
                  <Td className="min-w-[280px] text-ink-2">{l.detail || '—'}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <Pager pager={pager} />
      </div>
    </div>
  );
};

export default ExportLogsPage;
