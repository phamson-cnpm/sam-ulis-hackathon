
import React, { useState } from 'react';
import { useTabTitle } from '../utils/TabContext';
import FormButton from '../components/FormButton';
import { ChevronLeft } from 'lucide-react';
import { assetsApi, refs, thresholdsApi } from '../utils/api';
import { useApi } from '../hooks/useApi';
import { countedCost, LIGHT_META } from '../utils/lights';
import { dateTimeVN, dateVN, money } from '../utils/format';
import {
  ASSET_STATUS,
  DISPOSAL_DECISION,
  ESTIMATE_STATUS,
  EXCEPTION_STATUS,
  HANDOVER_KIND,
  PROPOSAL,
  RECALL_PLAN,
  RECALL_STATUS,
  REPORT_STATUS,
  TEMP_SOURCE,
} from '../utils/labels';
import { useAuth } from '../utils/AuthContext';
import { Button, Empty, Field, Input, KV, Modal, Notice, Panel, Pill, Table, Td, Textarea, Th } from '../components/ui';
import { RED } from '../utils/lights';
import { useToast } from '../utils/ToastContext';
import { explainLight, LightBadge, LightMeter } from '../components/Light';
import { ASSET_BOOK_DATE } from '../config/app';
import { Pager, usePaged } from '../components/Pager';

const AssetDetailPage = ({ assetId, onNavigate }) => {
  const { user } = useAuth();
  const { data: a } = useApi(() => assetsApi.get(assetId), [assetId]);
  const { data: h } = useApi(() => assetsApi.history(assetId), [assetId]);
  const { data: th } = useApi(() => thresholdsApi.get(), []);
  useTabTitle(a ? `Lý lịch ${a.code}` : null);
  const [decide, setDecide] = useState(null); // 'thanh_ly' | 'loai_khoi_danh_sach'
  const estPager = usePaged(h?.estimates, assetId);
  const repPager = usePaged(h?.reports, assetId);
  const tempPager = usePaged(h?.tempTransfers, assetId);
  if (!a || !h || !th) return <p className="text-muted">Đang tải…</p>;
  const pendingDisposal = RED.includes(a.light.code) && a.status !== 'da_thanh_ly';
  const disposed = a.status === 'da_thanh_ly' ? h.disposalDecisions.find((d) => d.decision === 'thanh_ly') : null;

  const name = (id) => refs.userById(id)?.name ?? '—';
  const canOpenCase = ['ktv', 'lanhdao_qtnl', 'khtc'].includes(user.role); // KHTC mở hồ sơ ở chế độ chỉ xem

  return (
    <div>
      <button
        onClick={() => onNavigate('assets')}
        className="mb-3 inline-flex items-center gap-1 text-[13px] font-medium text-accent hover:underline"
      >
        <ChevronLeft size={16} /> Danh sách tài sản
      </button>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="num text-[13px] font-semibold text-accent">{a.code}</p>
          <h1 className="text-[22px] leading-8 font-semibold">{a.name}</h1>
          <p className="text-muted">
            {a.unit}, {a.location}
          </p>
          {a.status !== 'dang_su_dung' && (
            <Pill tone="amber" className="mt-2">
              {ASSET_STATUS[a.status]}
            </Pill>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 text-right">
          <LightBadge code={a.light.code} size="lg" />
          <p className="max-w-[360px] text-[13px] text-ink-2">{a.light.labels.join('; ')}</p>
          <FormButton size="md" source={{ type: 'asset', assetId: a.id }}>
            Lý lịch sửa chữa
          </FormButton>
        </div>
      </div>

      {pendingDisposal && user.role === 'khtc' && (
        <Notice tone="danger" className="mb-5" title="Tài sản trong danh sách chờ thanh lý">
          Giữ đèn đỏ khi sang năm tài chính mới cho đến khi Phòng KHTC quyết định thanh lý hoặc loại khỏi danh sách.
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="danger" onClick={() => setDecide('thanh_ly')}>
              Đã thanh lý
            </Button>
            <Button onClick={() => setDecide('loai_khoi_danh_sach')}>Loại khỏi danh sách chờ thanh lý</Button>
          </div>
        </Notice>
      )}
      {disposed && (
        <Notice className="mb-5" title={`Đã thanh lý ngày ${dateVN(a.disposedAt)}`}>
          Theo {disposed.basis}
          {disposed.note ? `. ${disposed.note}` : ''}. Thôi tính đèn, vẫn lưu lịch sử.
        </Notice>
      )}

      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <Panel title="Thông tin tài sản">
          <KV
            items={[
              ['Mã tem', <span className="num">{a.code}</span>],
              ['Trạng thái', ASSET_STATUS[a.status] || ASSET_STATUS.dang_su_dung],
              ['Nhóm', `${a.groupCode} ${a.groupName}`],
              ['Đơn vị quản lý, sử dụng', a.unit],
              ['Vị trí', a.location],
              ['Ngày đưa vào sử dụng', <span className="num">{dateVN(a.inUseDate)}</span>],
              ['Thời gian tính hao mòn', `${a.depreciationMonths} tháng`],
              ['Nguyên giá', <span className="num">{money(a.originalCost)} đ</span>],
              ['Hao mòn lũy kế', <span className="num">{money(a.accumulatedDepreciation)} đ</span>],
              ['Giá trị còn lại', <span className="num">{money(a.residualValue)} đ</span>],
              ['Nguồn vốn', a.fundingSource],
              ['Tương tác gần nhất', <span className="num">{dateVN(a.lastInteractionDate)}</span>],
              ['Mốc số liệu sổ', ASSET_BOOK_DATE || '—'],
            ]}
          />
        </Panel>
        <Panel title={`Vì sao đèn ${LIGHT_META[a.light.code].label}`}>
          <LightMeter before={a.light} th={th} />
          <ul className="mt-4 list-disc space-y-1 pl-5 text-[13.5px] text-ink-2">
            {explainLight(a, a.light, th).map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel title="Lịch sử sửa chữa, thay thế" className="mt-5" bodyClass="p-0">
        {h.estimates.length === 0 ? (
          <Empty title="Chưa có phiếu dự toán nào.">Chi phí chỉ ghi từ khi dùng SAM, không nhập lại dữ liệu cũ.</Empty>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Ngày lập</Th>
                <Th>Số phiếu</Th>
                <Th>Nội dung</Th>
                <Th right>Tính vào đèn (đ)</Th>
                <Th right>Tổng phiếu (đ)</Th>
                <Th>Trạng thái</Th>
                <Th>Đèn sau phiếu</Th>
              </tr>
            </thead>
            <tbody>
              {estPager.pageRows.map((e) => {
                const c = countedCost(e.lines);
                const total = e.lines.reduce((s, l) => s + (l.actual ?? l.estimate), 0);
                const x = h.exceptions.find((ex) => ex.estimateId === e.id);
                return (
                  <tr
                    key={e.id}
                    className={canOpenCase && e.reportId ? 'cursor-pointer hover:bg-sunken' : ''}
                    onClick={() => canOpenCase && e.reportId && onNavigate('case', { reportId: e.reportId })}
                  >
                    <Td className="num whitespace-nowrap">{dateVN(e.createdAt)}</Td>
                    <Td className="num font-medium whitespace-nowrap">{e.code}</Td>
                    <Td className="min-w-[260px]">
                      {e.lines.map((l) => (
                        <div key={l.id} className={l.costGroup === 'khong_tinh' ? 'text-muted' : ''}>
                          {l.content}
                          {l.costGroup === 'khong_tinh' && ' (không tính)'}
                        </div>
                      ))}
                      {x && (
                        <div className="mt-1">
                          <Pill
                            tone={x.status === 'da_mo_khoa' ? 'green' : x.status === 'cho_mo_khoa' ? 'amber' : 'red'}
                          >
                            {x.code}: {EXCEPTION_STATUS[x.status]}
                          </Pill>
                        </div>
                      )}
                    </Td>
                    <Td right>
                      {money(c.cost)}
                      {c.provisional && <div className="text-[12px] text-muted">tạm tính</div>}
                    </Td>
                    <Td right>{money(total)}</Td>
                    <Td className="whitespace-nowrap">
                      {ESTIMATE_STATUS[e.status]}
                      {e.actualEnteredAt ? ', có chứng từ' : ''}
                    </Td>
                    <Td>
                      <LightBadge code={e.lightAfter} size="sm" />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
        <Pager pager={estPager} />
      </Panel>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel title="Phiếu báo hỏng" bodyClass="p-0">
          {h.reports.length === 0 ? (
            <Empty title="Chưa có phiếu báo hỏng." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Thời gian</Th>
                  <Th>Mã phiếu</Th>
                  <Th>Nội dung</Th>
                  <Th>Kết quả</Th>
                </tr>
              </thead>
              <tbody>
                {repPager.pageRows.map((r) => {
                  const ins = h.inspections.find((i) => i.reportId === r.id);
                  return (
                    <tr key={r.id}>
                      <Td className="num whitespace-nowrap">{dateTimeVN(r.createdAt)}</Td>
                      <Td className="num whitespace-nowrap">{r.code}</Td>
                      <Td className="min-w-[180px]">
                        {r.content}
                        <div className="text-[12.5px] text-muted">{r.reporterName}</div>
                      </Td>
                      <Td className="min-w-[140px]">{ins ? PROPOSAL[ins.proposal] : REPORT_STATUS[r.status]}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
          <Pager pager={repPager} />
        </Panel>
        <Panel title="Thiết bị thay thế tạm thời" bodyClass="p-0">
          {h.tempTransfers.length === 0 ? (
            <Empty title="Chưa có lần cấp thiết bị tạm." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Số phiếu</Th>
                  <Th>Vai trò</Th>
                  <Th>Nguồn</Th>
                  <Th>Cấp lúc</Th>
                  <Th>Thu hồi thiết bị tạm</Th>
                </tr>
              </thead>
              <tbody>
                {tempPager.pageRows.map((t) => (
                  <tr key={t.id}>
                    <Td className="num whitespace-nowrap">{t.code}</Td>
                    <Td>{t.replacementAssetId === a.id ? 'Là thiết bị cấp tạm' : 'Tài sản được thay tạm'}</Td>
                    <Td>{TEMP_SOURCE[t.source]}</Td>
                    <Td className="num">{dateTimeVN(t.issuedAt)}</Td>
                    <Td className="whitespace-nowrap">
                      {t.returnedAt ? dateTimeVN(t.returnedAt) : <Pill tone="amber">Đang sử dụng</Pill>}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          <Pager pager={tempPager} />
        </Panel>
      </div>
      <Panel title="Thu hồi tài sản hỏng, bàn giao, điều chuyển" className="mt-5" bodyClass="p-0">
        {h.handovers.length === 0 && h.recalls.length === 0 ? (
          <Empty title="Chưa có biên bản bàn giao nào trên SAM." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Ngày</Th>
                <Th>Số</Th>
                <Th>Nội dung</Th>
                <Th>Trạng thái</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {h.handovers.map((b) => (
                <tr key={b.id}>
                  <Td className="num whitespace-nowrap">{dateVN(b.date)}</Td>
                  <Td className="num font-medium whitespace-nowrap">{b.code}</Td>
                  <Td className="min-w-[260px]">
                    {HANDOVER_KIND[b.kind]}: {b.giverUnit} → {b.receiverUnit}, {b.place}
                    {b.transferNo && <div className="num text-[12.5px] text-muted">{b.transferNo}</div>}
                  </Td>
                  <Td className="whitespace-nowrap">
                    {b.applied ? <Pill tone="green">Đã cập nhật sổ</Pill> : <Pill tone="amber">Chờ nhập điều chuyển</Pill>}
                  </Td>
                  <Td right>
                    <FormButton source={{ type: 'handover', handoverId: b.id }}>Biên bản</FormButton>
                  </Td>
                </tr>
              ))}
              {h.recalls
                .filter((r) => !r.handoverId)
                .map((r) => (
                  <tr key={r.id}>
                    <Td className="num whitespace-nowrap">{dateVN(r.proposedAt)}</Td>
                    <Td className="num font-medium whitespace-nowrap">{r.code}</Td>
                    <Td className="min-w-[260px]">
                      Đề nghị thu hồi tài sản hỏng về {r.toLocation}, {RECALL_PLAN[r.plan].toLowerCase()}
                    </Td>
                    <Td className="whitespace-nowrap">
                      <Pill tone={r.status === 'khong_dong_y' ? 'red' : 'amber'}>{RECALL_STATUS[r.status]}</Pill>
                    </Td>
                    <Td />
                  </tr>
                ))}
            </tbody>
          </Table>
        )}
      </Panel>
      <p className="mt-4 text-[12.5px] text-subtle">
        Người lập các phiếu: {[...new Set(h.estimates.map((e) => name(e.createdBy)))].join(', ') || '—'}.
      </p>
      {h.disposalDecisions.length > 0 && (
        <Panel title="Quyết định của Phòng KHTC về danh sách chờ thanh lý" className="mt-5" bodyClass="p-0">
          <Table>
            <thead>
              <tr>
                <Th>Thời gian</Th>
                <Th>Quyết định</Th>
                <Th>Căn cứ</Th>
                <Th>Đèn lúc quyết định</Th>
                <Th>Người ghi</Th>
              </tr>
            </thead>
            <tbody>
              {h.disposalDecisions.map((d) => (
                <tr key={d.id}>
                  <Td className="num whitespace-nowrap">{dateTimeVN(d.at)}</Td>
                  <Td className="whitespace-nowrap">{DISPOSAL_DECISION[d.decision]}</Td>
                  <Td className="min-w-[220px]">
                    {d.basis}
                    {d.note && <div className="text-[12.5px] text-muted">{d.note}</div>}
                  </Td>
                  <Td>{d.lightBefore && <LightBadge code={d.lightBefore} size="sm" />}</Td>
                  <Td className="whitespace-nowrap">{name(d.by)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>
      )}
      {decide && <DisposalModal asset={a} decision={decide} onClose={() => setDecide(null)} />}
    </div>
  );
};

/** Phòng KHTC quyết định với tài sản chờ thanh lý (mục 5.3 đề tài). */
const DisposalModal = ({ asset, decision, onClose }) => {
  const toast = useToast();
  const [basis, setBasis] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const isDispose = decision === 'thanh_ly';
  return (
    <Modal
      open
      title={`${isDispose ? 'Ghi nhận đã thanh lý' : 'Loại khỏi danh sách chờ thanh lý'}: ${asset.code}`}
      onClose={onClose}
      width={560}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button
            variant={isDispose ? 'danger' : 'primary'}
            disabled={!basis.trim() || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await assetsApi.decideDisposal(asset.id, decision, basis.trim(), note.trim());
                toast(
                  'success',
                  isDispose
                    ? `${asset.code} đã chuyển sang trạng thái Đã thanh lý.`
                    : `${asset.code} đã ra khỏi danh sách chờ thanh lý; đèn tính lại.`,
                );
                onClose();
              } catch (e) {
                toast('error', e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {isDispose ? 'Ghi nhận đã thanh lý' : 'Loại khỏi danh sách'}
          </Button>
        </>
      }
    >
      <p className="mb-4 text-ink-2">
        {isDispose
          ? 'Tài sản chuyển sang trạng thái Đã thanh lý, thôi tính đèn, vẫn lưu lịch sử; không báo hỏng được nữa.'
          : 'Tài sản ra khỏi danh sách chờ thanh lý, đèn tính lại theo số lần sửa, chi phí như bình thường. Nếu chi phí sửa chữa trong năm nay vẫn chạm ngưỡng đỏ thì chưa loại được.'}
      </p>
      <div className="space-y-4">
        <Field label="Căn cứ (số, ngày văn bản)" required>
          <Input
            value={basis}
            onChange={(e) => setBasis(e.target.value)}
            placeholder={isDispose ? 'Ví dụ: Quyết định số .../QĐ-ĐHNN ngày ...' : 'Ví dụ: Biên bản họp số ... ngày ...'}
          />
        </Field>
        <Field label="Ghi chú">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
};

export default AssetDetailPage;
