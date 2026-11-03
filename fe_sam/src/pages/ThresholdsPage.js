
// Ngưỡng cảnh báo do Phòng KHTC đặt; xem trước tài sản nào sẽ đổi màu trước khi lưu.
import React, { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { refs, thresholdsApi } from '../utils/api';
import { useApi } from '../hooks/useApi';
import { dateTimeVN } from '../utils/format';
import { useAuth } from '../utils/AuthContext';
import { useToast } from '../utils/ToastContext';
import { Button, Empty, Input, PageHeader, Panel, Table, Td, Th } from '../components/ui';
import { LightBadge } from '../components/Light';
import { Pager, usePaged } from '../components/Pager';

const DEFAULTS = { redPct: 20, orangePct: 30, orangeCount: 3, repeatCount: 2, warehouseMonths: 12, cumulativePct: 40 };

const FIELDS = [
  {
    key: 'redPct',
    label: 'Chi phí sửa trong năm, tài sản đã hết hao mòn',
    unit: '% nguyên giá',
    note: 'Chạm ngưỡng thì vào Đỏ 1.1, khóa phiếu dự toán, chờ thanh lý. Ngưỡng cảnh báo nội bộ.',
  },
  {
    key: 'orangePct',
    label: 'Chi phí sửa trong năm, tài sản chưa hết hao mòn',
    unit: '% nguyên giá',
    note: 'Vượt ngưỡng thì vào Cam. Theo Nghị định 186/2025/NĐ-CP, Điều 29 khoản 1.',
  },
  {
    key: 'orangeCount',
    label: 'Số lần sửa trong năm, tài sản chưa hết hao mòn',
    unit: 'lần',
    note: 'Đạt số lần này thì vào Cam, tạm dừng sửa chữa.',
  },
  {
    key: 'repeatCount',
    label: 'Số lần sửa trong năm để gắn nhãn “Sửa chữa lặp lại”',
    unit: 'lần',
    note: 'Chỉ để theo dõi, không khóa phiếu.',
  },
  {
    key: 'warehouseMonths',
    label: 'Nằm kho không có tương tác',
    unit: 'tháng',
    note: 'Không cấp phát, điều chuyển, báo hỏng (không tính kiểm kê) thì vào Vàng 3.1.',
  },
  {
    key: 'cumulativePct',
    label: 'Chi phí sửa cộng dồn từ khi dùng SAM',
    unit: '% nguyên giá',
    note: 'Chạm ngưỡng thì gắn nhãn “Sửa chữa kéo dài” (Vàng 3.3).',
  },
];

const ThresholdsPage = ({ onNavigate }) => {
  const { user } = useAuth();
  const toast = useToast();
  const { data: current } = useApi(() => thresholdsApi.get(), []);
  const { data: logs } = useApi(() => thresholdsApi.logs(), []);
  const [form, setForm] = useState(null);
  useEffect(() => {
    if (current && !form) setForm(current);
  }, [current, form]);
  const { data: changes } = useApi(
    () => (form ? thresholdsApi.preview(form) : Promise.resolve([])),
    [JSON.stringify(form)],
  );
  const changePager = usePaged(changes, form);
  const logPager = usePaged(logs);

  if (!current || !form) return <p className="text-muted">Đang tải…</p>;
  const dirty = Object.keys(form).some((k) => form[k] !== current[k]);
  const valid = Object.values(form).every((v) => Number.isFinite(v) && v > 0);

  const save = async () => {
    await thresholdsApi.save(form, user);
    toast('success', `Đã lưu ngưỡng. ${changes?.length ?? 0} tài sản đổi màu đèn.`);
  };

  return (
    <div>
      <PageHeader
        title="Ngưỡng cảnh báo"
        description="Phòng KHTC đặt và điều chỉnh ngưỡng. Mỗi lần thay đổi đều được ghi nhật ký; màu đèn của mọi tài sản tự tính lại."
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel title="Ngưỡng đang áp dụng">
          <div className="divide-y divide-rule-2">
            {FIELDS.map((f) => (
              <div key={f.key} className="grid grid-cols-[1fr_auto] items-start gap-4 py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="font-medium text-ink">{f.label}</p>
                  <p className="text-[12.5px] text-muted">{f.note}</p>
                  {form[f.key] !== DEFAULTS[f.key] && (
                    <p className="text-[12.5px] text-l-amber">Mặc định: {DEFAULTS[f.key]}</p>
                  )}
                </div>
                <label className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    value={form[f.key]}
                    onChange={(e) => setForm({ ...form, [f.key]: Number(e.target.value) })}
                    className="num w-[72px] text-right"
                    aria-label={f.label}
                  />
                  <span className="w-[84px] text-[12.5px] whitespace-nowrap text-muted">{f.unit}</span>
                </label>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-rule-2 pt-4">
            <Button onClick={() => setForm(DEFAULTS)}>Khôi phục mặc định</Button>
            <Button onClick={() => setForm(current)} disabled={!dirty}>
              Hủy thay đổi
            </Button>
            <Button variant="primary" onClick={save} disabled={!dirty || !valid}>
              Lưu ngưỡng
            </Button>
          </div>
        </Panel>

        <Panel
          title="Xem trước khi lưu"
          aside={
            <span className="num text-[13px] text-muted">
              {dirty ? `${changes?.length ?? 0} tài sản đổi màu` : 'Chưa có thay đổi'}
            </span>
          }
          bodyClass="p-0"
        >
          {!dirty || !changes || changes.length === 0 ? (
            <Empty
              title={
                dirty ? 'Ngưỡng mới không làm tài sản nào đổi màu.' : 'Sửa một ngưỡng để xem tài sản nào sẽ đổi màu.'
              }
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Tài sản</Th>
                  <Th>Đèn hiện tại</Th>
                  <Th />
                  <Th>Đèn mới</Th>
                </tr>
              </thead>
              <tbody>
                {changePager.pageRows.map((c) => (
                  <tr
                    key={c.asset.id}
                    className="cursor-pointer hover:bg-sunken"
                    onClick={() => onNavigate('asset', { assetId: c.asset.id })}
                  >
                    <Td>
                      {c.asset.name}
                      <div className="num text-[12.5px] text-muted">{c.asset.code}</div>
                    </Td>
                    <Td>
                      <LightBadge code={c.from.code} size="sm" />
                    </Td>
                    <Td className="w-6 text-subtle">
                      <ArrowRight size={15} />
                    </Td>
                    <Td>
                      <LightBadge code={c.to.code} size="sm" />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          {dirty && <Pager pager={changePager} />}
        </Panel>
      </div>

      <Panel title="Nhật ký thay đổi ngưỡng" className="mt-5" bodyClass="p-0">
        {!logs || logs.length === 0 ? (
          <Empty title="Chưa có thay đổi nào.">Đang dùng ngưỡng mặc định của đề tài.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Thời gian</Th>
                <Th>Người thay đổi</Th>
                <Th>Ngưỡng</Th>
                <Th right>Giá trị cũ</Th>
                <Th right>Giá trị mới</Th>
              </tr>
            </thead>
            <tbody>
              {logPager.pageRows.map((l) => (
                <tr key={l.id}>
                  <Td className="num whitespace-nowrap">{dateTimeVN(l.at)}</Td>
                  <Td>{refs.userById(l.by)?.name}</Td>
                  <Td>{FIELDS.find((f) => f.key === l.field)?.label}</Td>
                  <Td right>{l.oldValue}</Td>
                  <Td right className="font-semibold">
                    {l.newValue}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <Pager pager={logPager} />
      </Panel>
    </div>
  );
};

export default ThresholdsPage;
