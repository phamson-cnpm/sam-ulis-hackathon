
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  authApi,
  clearRefs,
  loadRefs,
  metaApi,
  refreshSession,
  setSessionHandler,
  setToken,
  setUnauthorizedHandler,
} from './api';
import { setWorkDate } from '../config/app';
import { disablePushOnThisDevice } from './push';

// Mỗi cán bộ, giảng viên một tài khoản cá nhân do Phòng KHTC cấp (mục VII đề tài). Vai trò (cán bộ đầu mối, kỹ thuật
// viên, lãnh đạo Phòng QTNL, quản trị) do Phòng KHTC thiết lập và máy chủ tính lại ở mỗi lần gọi.
// Access Token giữ trong state/bộ nhớ (utils/api.js), Refresh Token nằm trong cookie HTTP-Only.

const AuthContext = createContext();

const sessionOf = (res) => ({
  accountKind: res.accountKind, // staff: tài khoản cá nhân; account: tài khoản quản trị hệ thống
  user: res.user,
  mustChangePassword: !!res.mustChangePassword,
});

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState(null);
  const entered = useRef(null);

  const reset = useCallback((msg) => {
    setToken(null);
    clearRefs();
    entered.current = null;
    setSession(null);
    setNotice(msg || null);
  }, []);

  // Vào làm việc: tải danh bạ, danh mục, ngày làm việc của máy chủ trước khi hiện các trang
  const enter = useCallback(async (res) => {
    if (res.accessToken) setToken(res.accessToken);
    const s = sessionOf(res);
    if (!s.mustChangePassword) {
      await Promise.all([loadRefs(), metaApi.get().then(setWorkDate)]);
    }
    entered.current = s.user.id;
    setSession(s);
    setNotice(null);
    return s;
  }, []);

  useEffect(() => {
    // Phiên hết hiệu lực khi đang làm việc (đăng xuất nơi khác, Phòng KHTC khóa hoặc đặt lại mật khẩu).
    // Đã ra màn hình đăng nhập (vừa bấm Đăng xuất) thì bỏ qua các lỗi 401 đến muộn của yêu cầu đang chạy dở,
    // để không hiện nhầm lời báo "phiên đã kết thúc".
    setUnauthorizedHandler((err) => {
      if (!entered.current) return;
      reset(err.reason === 'no_session' ? null : err.message);
    });
    // Mỗi lần tự làm mới phiên: cập nhật vai trò (ví dụ vừa được cấp hoặc thu hồi mã đầu mối)
    setSessionHandler((res) => {
      if (!entered.current || !res.user) return;
      if (res.user.id === entered.current) {
        setSession(sessionOf(res));
        return;
      }
      // Cookie đăng nhập dùng chung cho mọi cửa sổ của trình duyệt: cửa sổ khác vừa đăng nhập tài khoản khác thì cửa sổ
      // này không được dùng tiếp phiên của người kia; về màn hình đăng nhập kèm lời giải thích.
      reset(
        `Trình duyệt này vừa đăng nhập tài khoản khác (${res.user.name}) ở cửa sổ khác. Mỗi trình duyệt chỉ giữ một tài khoản; ` +
          'muốn dùng hai tài khoản cùng lúc, mở tài khoản thứ hai bằng cửa sổ ẩn danh hoặc trình duyệt khác.',
      );
    });
    return () => {
      setUnauthorizedHandler(null);
      setSessionHandler(null);
    };
  }, [reset]);

  // Mở lại web: biến tạm đã mất, gọi /auth/refresh-token (trình duyệt tự gửi cookie HTTP-Only).
  // Phiên còn hiệu lực thì vào thẳng trang chủ theo vai trò, không nhập lại mật khẩu.
  useEffect(() => {
    let alive = true;
    refreshSession()
      .then((res) => (alive ? enter(res) : null))
      .catch(() => {
        if (alive) reset(null);
      })
      .finally(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, [enter, reset]);

  const login = async (username, password) => enter(await authApi.login(username, password));

  /** Đổi mật khẩu (bắt buộc ở lần đầu với mật khẩu Phòng KHTC cấp); các thiết bị khác bị đăng xuất. */
  const changePassword = async (current, next) => {
    await authApi.changePassword(current, next);
    return enter(await refreshSession());
  };

  const logout = async () => {
    await disablePushOnThisDevice().catch(() => {});
    await authApi.logout();
    reset(null);
    window.scrollTo(0, 0);
  };

  const logoutAll = async () => {
    await disablePushOnThisDevice().catch(() => {});
    await authApi.logoutAll();
    reset('Đã đăng xuất trên mọi thiết bị.');
  };

  const user = session && !session.mustChangePassword ? session.user : null;
  return (
    <AuthContext.Provider value={{ session, user, ready, notice, login, changePassword, logout, logoutAll }}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook để dùng AuthContext ở mọi nơi
export const useAuth = () => useContext(AuthContext);
