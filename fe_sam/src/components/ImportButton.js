
// Phòng KHTC nhập file Excel: danh sách tài sản xuất từ phần mềm quản lý tài sản, danh mục nhóm tài sản,
// danh sách cán bộ. Máy chủ tự nhận loại file theo dòng tiêu đề; nhập lại là cập nhật theo mã, không xóa dữ liệu đang có.
import React, { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { importApi } from '../utils/api';
import { useToast } from '../utils/ToastContext';
import { Button, Modal } from './ui';

const KIND = {
  assets: 'danh sách tài sản',
  groups: 'danh mục nhóm tài sản',
  staff: 'danh sách cán bộ',
};

const ImportButton = ({ label = 'Nhập Excel', hint }) => {
  const toast = useToast();
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const pick = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setBusy(true);
    try {
      setResult(await importApi.upload(f));
    } catch (ex) {
      toast('error', ex.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button icon={<Upload size={16} />} onClick={() => input.current?.click()} disabled={busy} title={hint}>
        {busy ? 'Đang nhập…' : label}
      </Button>
      <input ref={input} type="file" accept=".xlsx,.xlsm" className="sr-only" onChange={pick} aria-label={label} />
      {result && (
        <Modal
          open
          title={`Đã nhập ${KIND[result.kind] || 'file'}`}
          onClose={() => setResult(null)}
          width={560}
          footer={
            <Button variant="primary" onClick={() => setResult(null)}>
              Đóng
            </Button>
          }
        >
          <ul className="space-y-1 text-ink-2">
            <li>
              Thêm mới <b className="num">{result.added}</b>, cập nhật <b className="num">{result.updated}</b>, không đổi{' '}
              <b className="num">{result.unchanged}</b>
              {result.kind === 'assets' && (
                <>
                  {' '}
                  trên <span className="num">{result.total}</span> mã tài sản
                </>
              )}
              .
            </li>
            {result.unitsAdded > 0 && <li>Thêm {result.unitsAdded} đơn vị mới.</li>}
            {result.groupsAdded > 0 && (
              <li>
                Thêm {result.groupsAdded} nhóm tài sản chưa có tên trong danh mục; nhập file danh mục nhóm (Mã nhóm, Tên nhóm)
                để có tên nhóm.
              </li>
            )}
            {result.bookDate && <li>Số liệu sổ sách (nguyên giá, giá trị còn lại) đến ngày {result.bookDate}.</li>}
          </ul>
          {result.skipped.length > 0 && (
            <div className="mt-3">
              <p className="font-medium text-ink">Bỏ qua {result.skipped.length} dòng:</p>
              <ul className="mt-1 max-h-[200px] overflow-auto text-[13px] text-muted">
                {result.skipped.slice(0, 50).map((s) => (
                  <li key={`${s.row}-${s.code || ''}`}>
                    Dòng {s.row}
                    {s.code ? ` (${s.code})` : ''}: {s.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Modal>
      )}
    </>
  );
};

export default ImportButton;
