// Hộp nhập mã xác nhận cá nhân (mục VII đề tài). Tài khoản được giữ đăng nhập lâu dài trên thiết bị, nên thao tác có
// giá trị xác nhận (gửi dự toán, nhập chi phí thực tế, xác nhận, trả lại, duyệt đề xuất, gửi danh sách đề xuất...)
// phải nhập thêm mã do Phòng KHTC cấp. Máy chủ trả 428 code_required thì utils/api.js mở hộp này rồi gửi lại yêu cầu.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { setCodePrompt } from '../utils/api';
import { Button, Field, Input, Modal, Notice } from './ui';

const ConfirmCodeDialog = () => {
  const [ask, setAsk] = useState(null); // { error, resolve }
  const [code, setCode] = useState('');
  const resolver = useRef(null);

  useEffect(() => {
    setCodePrompt(
      ({ error } = {}) =>
        new Promise((resolve) => {
          resolver.current = resolve;
          setCode('');
          setAsk({ error });
        }),
    );
    return () => setCodePrompt(null);
  }, []);

  const finish = useCallback((value) => {
    const r = resolver.current;
    resolver.current = null;
    setAsk(null);
    if (r) r(value);
  }, []);

  const submit = (e) => {
    e.preventDefault();
    if (code.trim()) finish(code.trim());
  };

  return (
    <Modal
      open={!!ask}
      title="Nhập mã xác nhận cá nhân"
      width={440}
      onClose={() => finish(null)}
      footer={
        <>
          <Button onClick={() => finish(null)}>Hủy</Button>
          <Button variant="primary" icon={<KeyRound size={15} />} onClick={submit} disabled={!code.trim()}>
            Xác nhận
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-3" autoComplete="off">
        <p className="text-ink-2">
          Thao tác này có giá trị xác nhận. Nhập mã xác nhận cá nhân do Phòng KHTC cấp (khác mật khẩu đăng nhập).
        </p>
        {ask && ask.error && <Notice tone="danger">{ask.error}</Notice>}
        <Field label="Mã xác nhận cá nhân" required>
          <Input
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            autoComplete="off"
            autoFocus
            className="num w-[240px] tracking-[2px]"
            placeholder="Ví dụ QT-XXXX"
          />
        </Field>
      </form>
    </Modal>
  );
};

export default ConfirmCodeDialog;
