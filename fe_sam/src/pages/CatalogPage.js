
// Phòng QTNL soạn danh mục: nội dung báo hỏng theo nhóm tài sản, tình huống đang xảy ra (mục khẩn cấp đứng đầu),
// nội dung công việc sửa chữa (nhóm tính vào đèn hoặc bảo dưỡng, vật tư). Cán bộ chọn nhanh khi báo hỏng,
// kỹ thuật viên chọn khi lập dự toán.
import React, { useState } from 'react';
import { catalogApi } from '../utils/api';
import { useApi } from '../hooks/useApi';
import { useToast } from '../utils/ToastContext';
import { COST_GROUP } from '../utils/labels';
import { Button, Check, Empty, Field, Input, PageHeader, Pill, Select, Table, Tabs, Td, Th } from '../components/ui';
import { Pager, usePaged } from '../components/Pager';

const CatalogPage = () => {
  const [tab, setTab] = useState('faults');
  const { data: lists } = useApi(async () => catalogApi.faultLists(), []);
  const { data: situations } = useApi(async () => [...catalogApi.situations()], []);
  const { data: jobs } = useApi(() => catalogApi.allRepairJobs(), []);
  const { data: groups } = useApi(() => catalogApi.assetGroups(), []);

  return (
    <div>
      <PageHeader
        title="Danh mục báo hỏng, sửa chữa"
        description="Phòng QTNL soạn: nội dung báo hỏng theo nhóm tài sản, tình huống đang xảy ra, nội dung công việc sửa chữa. Cán bộ chọn nhanh từ các danh mục này khi báo hỏng; kỹ thuật viên chọn khi lập dự toán."
      />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'faults', label: 'Nội dung báo hỏng' },
          { id: 'situations', label: 'Tình huống đang xảy ra', count: situations?.length },
          { id: 'jobs', label: 'Công việc sửa chữa', count: jobs?.length },
        ]}
      />
      {tab === 'faults' && <FaultsTab lists={lists || []} groups={groups || []} />}
      {tab === 'situations' && <SituationsTab situations={situations || []} />}
      {tab === 'jobs' && <JobsTab jobs={jobs || []} groups={groups || []} />}
    </div>
  );
};

// ---------------------------------------------------------------- Nội dung báo hỏng theo nhóm tài sản
const FaultsTab = ({ lists, groups }) => {
  const toast = useToast();
  const [groupCode, setGroupCode] = useState('');
  const [text, setText] = useState('');
  const current = lists.find((l) => l.groupCode === groupCode);
  const items = current ? current.items : [];
  const others = groups.filter((g) => !lists.some((l) => l.groupCode === g.code));
  const pager = usePaged(items, groupCode);

  const add = async (e) => {
    e.preventDefault();
    try {
      await catalogApi.addFault(groupCode, text);
      setText('');
    } catch (ex) {
      toast('error', ex.message);
    }
  };

  return (
    <div className="rounded-[3px] border border-rule bg-surface p-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Nhóm tài sản" className="w-[320px]">
          <Select value={groupCode} onChange={(e) => setGroupCode(e.target.value)}>
            {lists.map((l) => (
              <option key={l.groupCode || 'chung'} value={l.groupCode}>
                {l.groupCode ? `${l.groupCode} ${l.name}` : l.name} ({l.items.length})
              </option>
            ))}
            {others.map((g) => (
              <option key={g.code} value={g.code}>
                {g.code} {g.name} (chưa có danh sách)
              </option>
            ))}
          </Select>
        </Field>
        <p className="pb-2 text-[13px] text-muted">
          Nhóm chưa có danh sách riêng thì phiếu báo hỏng dùng Danh sách chung.
        </p>
      </div>
      <form onSubmit={add} className="mt-3 flex max-w-[640px] gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ví dụ: Không mát, kêu to"
          aria-label="Nội dung báo hỏng mới"
        />
        <Button type="submit" variant="primary" disabled={!text.trim()}>
          Thêm
        </Button>
      </form>
      {items.length === 0 ? (
        <Empty title="Chưa có nội dung nào trong danh sách này." />
      ) : (
        <div className="mt-3 rounded-md border border-rule">
          <ul className="divide-y divide-rule-2">
            {pager.pageRows.map((it) => (
              <li key={it} className="flex items-center justify-between gap-3 px-3 py-2">
                <span>{it}</span>
                <Button size="sm" variant="ghost" onClick={() => catalogApi.removeFault(groupCode, it)}>
                  Bỏ
                </Button>
              </li>
            ))}
          </ul>
          <Pager pager={pager} />
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------- Tình huống đang xảy ra
const SituationsTab = ({ situations }) => {
  const toast = useToast();
  const [text, setText] = useState('');
  const [urgent, setUrgent] = useState(false);
  const pager = usePaged(situations);

  const add = async (e) => {
    e.preventDefault();
    try {
      await catalogApi.addSituation(text, urgent);
      setText('');
      setUrgent(false);
    } catch (ex) {
      toast('error', ex.message);
    }
  };

  return (
    <div className="rounded-[3px] border border-rule bg-surface p-4">
      <p className="text-[13px] text-muted">
        Tình huống khẩn cấp đứng đầu danh sách. Cán bộ chọn tình huống khẩn cấp thì phiếu tự tích Khẩn cấp, lên đầu
        hàng chờ; chỉ phiếu khẩn cấp mới được cấp thiết bị tạm.
      </p>
      <form onSubmit={add} className="mt-3 flex max-w-[760px] flex-wrap items-center gap-3">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ví dụ: Đang thi, kiểm tra"
          aria-label="Tình huống mới"
          className="min-w-[320px] flex-1"
        />
        <Check checked={urgent} onChange={setUrgent} label="Khẩn cấp" />
        <Button type="submit" variant="primary" disabled={!text.trim()}>
          Thêm
        </Button>
      </form>
      <div className="mt-3 rounded-md border border-rule">
        <Table>
          <thead>
            <tr>
              <Th>Tình huống</Th>
              <Th>Khẩn cấp</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {pager.pageRows.map((s) => (
              <tr key={s.text}>
                <Td>
                  {s.text} {s.urgent && <Pill tone="red">Khẩn cấp</Pill>}
                </Td>
                <Td className="w-[120px]">
                  <Check checked={s.urgent} onChange={(v) => catalogApi.setSituationUrgent(s.text, v)} label="Khẩn cấp" />
                </Td>
                <Td right>
                  <Button size="sm" variant="ghost" onClick={() => catalogApi.removeSituation(s.text)}>
                    Bỏ
                  </Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <Pager pager={pager} />
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- Nội dung công việc sửa chữa
const JobsTab = ({ jobs, groups }) => {
  const toast = useToast();
  const [filter, setFilter] = useState('');
  const [name, setName] = useState('');
  const [groupCode, setGroupCode] = useState('');
  const [costGroup, setCostGroup] = useState('tinh');
  const groupName = (c) => groups.find((g) => g.code === c)?.name || c;
  const rows = jobs.filter((j) => !filter || j.groupCodes.includes(filter) || j.groupCodes.length === 0);
  const pager = usePaged(rows, filter);

  const add = async (e) => {
    e.preventDefault();
    try {
      await catalogApi.addRepairJob({ name, groupCode, costGroup });
      setName('');
    } catch (ex) {
      toast('error', ex.message);
    }
  };

  return (
    <div className="rounded-[3px] border border-rule bg-surface p-4">
      <p className="text-[13px] text-muted">
        Chỉ nhóm <b>{COST_GROUP.tinh}</b> tính vào số lần sửa chữa và chi phí xét đèn; nhóm {COST_GROUP.khong_tinh} ghi
        riêng.
      </p>
      <form onSubmit={add} className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1.4fr)_auto] sm:items-end">
        <Field label="Nội dung công việc">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ví dụ: Thay block máy nén" />
        </Field>
        <Field label="Nhóm tài sản">
          <Select value={groupCode} onChange={(e) => setGroupCode(e.target.value)}>
            <option value="">Mọi nhóm tài sản</option>
            {groups.map((g) => (
              <option key={g.code} value={g.code}>
                {g.code} {g.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Nhóm chi phí">
          <Select value={costGroup} onChange={(e) => setCostGroup(e.target.value)}>
            <option value="tinh">{COST_GROUP.tinh}</option>
            <option value="khong_tinh">{COST_GROUP.khong_tinh}</option>
          </Select>
        </Field>
        <Button type="submit" variant="primary" disabled={!name.trim()}>
          Thêm
        </Button>
      </form>
      <div className="mt-4 flex items-center gap-3">
        <Field label="Lọc theo nhóm tài sản" className="w-[320px]">
          <Select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">Tất cả</option>
            {groups.map((g) => (
              <option key={g.code} value={g.code}>
                {g.code} {g.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="mt-3 rounded-md border border-rule">
        <Table>
          <thead>
            <tr>
              <Th>Mã</Th>
              <Th>Nội dung công việc</Th>
              <Th>Nhóm tài sản</Th>
              <Th>Nhóm chi phí</Th>
              <Th>Đang dùng</Th>
            </tr>
          </thead>
          <tbody>
            {pager.pageRows.map((j) => (
              <tr key={j.id} className={j.active ? '' : 'text-subtle'}>
                <Td className="num whitespace-nowrap">{j.code}</Td>
                <Td className="min-w-[220px]">{j.name}</Td>
                <Td className="min-w-[180px] text-[13px] text-muted">
                  {j.groupCodes.length ? j.groupCodes.map(groupName).join(', ') : 'Mọi nhóm tài sản'}
                </Td>
                <Td className="whitespace-nowrap">
                  <Pill tone={j.costGroup === 'tinh' ? 'blue' : 'neutral'}>{COST_GROUP[j.costGroup]}</Pill>
                </Td>
                <Td className="w-[130px]">
                  <Check checked={j.active} onChange={(v) => catalogApi.setRepairJobActive(j.id, v)} label="Đang dùng" />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <Pager pager={pager} />
      </div>
    </div>
  );
};

export default CatalogPage;
