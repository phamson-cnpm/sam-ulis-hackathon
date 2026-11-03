
// Đăng nhập bằng tài khoản cá nhân do Phòng KHTC cấp (mục VII đề tài). Lần đầu đăng nhập phải đổi mật khẩu ban đầu.
// autocomplete="username" / "current-password" để trình duyệt gợi ý điền sẵn khi lỡ đăng xuất; ô mật khẩu mới dùng
// "new-password" để trình duyệt đề xuất và lưu mật khẩu mới.
import React, { useState } from 'react';
import { ArrowRight, Eye, EyeOff, HelpCircle, Info, LockKeyhole, UserRound } from 'lucide-react';
import { ROLE_LABEL } from '../utils/labels';
import { ORG_NAME } from '../config/app';
import { useAuth } from '../utils/AuthContext';
import ulisLogo from '../assets/ulis-logo.png';
import './LoginPage.css';

const ACCOUNTS = [
  ['Tài khoản cá nhân', 'Mỗi cán bộ, giảng viên một tài khoản do Phòng KHTC cấp. Đăng nhập bằng tên đăng nhập và mật khẩu; lần đầu đăng nhập phải đổi mật khẩu.'],
  [ROLE_LABEL.canbo, 'Không cần mã xác nhận. Báo hỏng tài sản bằng mã tem, theo dõi phiếu đã gửi; nhận thông báo khi phiếu được tiếp nhận, hoàn thành.'],
  [ROLE_LABEL.daumoi, 'Xem tài sản toàn trường theo màu đèn, tải Excel, PDF để kiểm kê; gửi danh sách đề xuất thanh lý tài sản đơn vị mình.'],
  ['Phòng QTNL', 'Kỹ thuật viên, lãnh đạo Phòng QTNL: xử lý phiếu, dự toán, duyệt đề xuất; nhập mã xác nhận cá nhân khi thao tác quan trọng.'],
  ['Phòng KHTC', 'Quản trị: cấp tài khoản, vai trò và mã xác nhận; xem đèn cảnh báo toàn trường, mở khóa ngoại lệ, đặt ngưỡng.'],
  ['Giữ đăng nhập', 'Mở lại SAM trên máy đã đăng nhập thì vào thẳng trang làm việc. Máy dùng chung: nhớ Đăng xuất khi xong.'],
];

const PasswordInput = ({ id, value, onChange, placeholder, autoComplete, disabled, autoFocus }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="sam-login__control">
      <LockKeyhole size={22} className="sam-login__control-icon" aria-hidden="true" />
      <input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        disabled={disabled}
      />
      <button
        type="button"
        className="sam-login__eye"
        aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        aria-pressed={show}
        onClick={() => setShow((v) => !v)}
      >
        {show ? <EyeOff size={20} /> : <Eye size={20} />}
      </button>
    </div>
  );
};

/** Bước 1: tên đăng nhập, mật khẩu. */
const AccountLogin = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) return setErr('Nhập tên đăng nhập và mật khẩu.');
    setBusy(true);
    setErr(null);
    try {
      await login(username.trim(), password);
    } catch (ex) {
      setErr(ex.message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="sam-login__form" aria-label="Đăng nhập tài khoản" method="post">
      <div className="sam-login__field">
        <label className="sr-only" htmlFor="login-user">Tên đăng nhập</label>
        <div className="sam-login__control">
          <UserRound size={22} className="sam-login__control-icon" aria-hidden="true" />
          <input
            id="login-user"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Tên đăng nhập"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            disabled={busy}
          />
        </div>
      </div>
      <div className="sam-login__field">
        <label className="sr-only" htmlFor="login-pass">Mật khẩu</label>
        <PasswordInput id="login-pass" value={password} onChange={setPassword} placeholder="Mật khẩu" autoComplete="current-password" disabled={busy} />
      </div>
      {err && <p className="sam-login__error" role="alert">{err}</p>}
      <button type="submit" disabled={busy} className="sam-login__primary">
        <span>{busy ? 'Đang đăng nhập...' : 'Đăng nhập'}</span>
        {!busy && <ArrowRight size={21} aria-hidden="true" />}
      </button>
    </form>
  );
};

/** Lần đăng nhập đầu (hoặc sau khi Phòng KHTC đặt lại mật khẩu): đổi mật khẩu ban đầu trước khi làm việc. */
const ChangePasswordStep = () => {
  const { session, changePassword } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!current || !next) return setErr('Nhập mật khẩu ban đầu và mật khẩu mới.');
    if (next.length < 8) return setErr('Mật khẩu mới cần ít nhất 8 ký tự.');
    if (next !== again) return setErr('Hai lần nhập mật khẩu mới chưa khớp.');
    setBusy(true);
    setErr(null);
    try {
      await changePassword(current, next);
    } catch (ex) {
      setErr(ex.message);
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="sam-login__step-copy">
        <strong>{session.user.name}</strong>
        <p>Lần đầu đăng nhập: đổi mật khẩu do Phòng KHTC cấp thành mật khẩu riêng của bạn (ít nhất 8 ký tự).</p>
      </div>
      <form onSubmit={submit} className="sam-login__step-form" method="post" aria-label="Đổi mật khẩu ban đầu">
        {/* Ô ẩn giúp trình duyệt lưu mật khẩu mới đúng tài khoản */}
        <input type="text" name="username" autoComplete="username" value={session.user.username || ''} readOnly hidden />
        <div className="sam-login__field">
          <label className="sam-login__field-label" htmlFor="pw-current">Mật khẩu ban đầu</label>
          <PasswordInput id="pw-current" value={current} onChange={setCurrent} placeholder="Mật khẩu Phòng KHTC cấp" autoComplete="current-password" disabled={busy} autoFocus />
        </div>
        <div className="sam-login__field">
          <label className="sam-login__field-label" htmlFor="pw-new">Mật khẩu mới</label>
          <PasswordInput id="pw-new" value={next} onChange={setNext} placeholder="Ít nhất 8 ký tự" autoComplete="new-password" disabled={busy} />
        </div>
        <div className="sam-login__field">
          <label className="sam-login__field-label" htmlFor="pw-again">Nhập lại mật khẩu mới</label>
          <PasswordInput id="pw-again" value={again} onChange={setAgain} placeholder="Nhập lại mật khẩu mới" autoComplete="new-password" disabled={busy} />
        </div>
        {err && <p className="sam-login__error" role="alert">{err}</p>}
        <button type="submit" disabled={busy} className="sam-login__primary">
          <span>{busy ? 'Đang lưu...' : 'Đổi mật khẩu và vào làm việc'}</span>
          {!busy && <ArrowRight size={20} aria-hidden="true" />}
        </button>
      </form>
    </div>
  );
};

const LoginHelp = () => (
  <details className="sam-login__help">
    <summary><HelpCircle size={18} aria-hidden="true" /> Hỗ trợ</summary>
    <div className="sam-login__help-panel">
      <strong>Hướng dẫn đăng nhập</strong>
      <dl>
        {ACCOUNTS.map(([name, description]) => (
          <div key={name}>
            <dt>{name}</dt>
            <dd>{description}</dd>
          </div>
        ))}
      </dl>
    </div>
  </details>
);

const LoginPage = () => {
  const { session, notice, logout } = useAuth();
  const mustChange = !!(session && session.mustChangePassword);

  return (
    <main className="sam-login">
      <div className="sam-login__layout">
        <section className="sam-login__intro" aria-label="Giới thiệu hệ thống SAM">
          <div className="sam-login__brand">
            <img src={ulisLogo} alt="Biểu trưng Trường Đại học Ngoại ngữ ULIS" className="sam-login__logo" />
            <span className="sam-login__brand-rule" aria-hidden="true" />
            <span className="sam-login__brand-name">SAM</span>
          </div>

          <div className="sam-login__hero">
            <h1><span>Quản lý tài sản</span><span>thông minh</span></h1>
            <p className="sam-login__features">
              Báo hỏng trực tuyến <span aria-hidden="true">•</span>
              Theo dõi tài sản <span aria-hidden="true">•</span>
              Bảo trì chủ động
            </p>
          </div>
          <p className="sam-login__copyright">© ULIS</p>
        </section>

        <section className="sam-login__card" aria-labelledby="sam-login-heading">
          <header>
            <h2 id="sam-login-heading">{mustChange ? 'Đổi mật khẩu' : 'Đăng nhập'}</h2>
            <p className="sam-login__subtitle">{mustChange ? 'Bước cuối trước khi vào làm việc.' : ORG_NAME}</p>
            {notice && <p className="sam-login__notice" role="status">{notice}</p>}
          </header>

          {mustChange ? <ChangePasswordStep /> : <AccountLogin />}

          <footer className="sam-login__footer">
            <span className="sam-login__footer-note">
              <Info size={18} aria-hidden="true" />
              Tài khoản cá nhân do Phòng KHTC cấp
            </span>
            <LoginHelp />
          </footer>
          {mustChange && (
            <div style={{ textAlign: 'right', marginTop: 17 }}>
              <button type="button" onClick={logout} className="sam-login__switch">
                Đăng nhập tài khoản khác
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
};

export default LoginPage;
