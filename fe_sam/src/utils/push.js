// Thông báo đẩy về điện thoại, máy tính (Web Push, mục 5.9 đề tài): mỗi người tự bật, tắt ở nút chuông cho từng thiết bị.
// Trình duyệt chỉ hỏi quyền sau một lần bấm (nút chuông). iPhone, iPad cần iOS 16.4 trở lên và mở SAM từ biểu tượng
// đã "Thêm vào Màn hình chính". Bấm vào thông báo: service worker (public/sw.js) mở đúng màn hình cần xử lý.
import { pushApi } from './api';

const SW_URL = `${process.env.PUBLIC_URL || ''}/sw.js`;

const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () =>
  window.navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);

/** Thiết bị này có dùng được thông báo đẩy không; reason giải thích cho người dùng khi không dùng được. */
export function pushSupport() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    if (typeof navigator !== 'undefined' && isIos() && !isStandalone()) {
      return { ok: false, reason: 'ios_home', message: 'Trên iPhone, iPad: bấm Chia sẻ → "Thêm vào Màn hình chính", mở SAM từ biểu tượng đó rồi bật chuông (cần iOS 16.4 trở lên).' };
    }
    return { ok: false, reason: 'unsupported', message: 'Trình duyệt này chưa hỗ trợ thông báo đẩy. Dùng Chrome, Edge, Firefox hoặc Safari bản mới.' };
  }
  if (!window.isSecureContext) {
    return { ok: false, reason: 'insecure', message: 'Thông báo đẩy chỉ chạy khi SAM mở bằng HTTPS.' };
  }
  return { ok: true };
}

export function registerServiceWorker() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return Promise.resolve(null);
  return navigator.serviceWorker.register(SW_URL).catch(() => null);
}

function keyBytes(base64url) {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4);
  const raw = window.atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

const sameKey = (sub, publicKey) => {
  const k = sub.options && sub.options.applicationServerKey;
  if (!k) return true;
  const a = new Uint8Array(k);
  const b = keyBytes(publicKey);
  return a.length === b.length && a.every((x, i) => x === b[i]);
};

async function currentSubscription() {
  const reg = await navigator.serviceWorker.getRegistration(SW_URL);
  return reg ? reg.pushManager.getSubscription() : null;
}

/** Trạng thái nút chuông trên máy này: { support, serverEnabled, permission, on }. */
export async function pushState() {
  const support = pushSupport();
  if (!support.ok) return { support, serverEnabled: true, permission: 'default', on: false };
  const cfg = await pushApi.config().catch(() => ({ enabled: false }));
  if (!cfg.enabled) return { support, serverEnabled: false, permission: Notification.permission, on: false };
  const sub = await currentSubscription().catch(() => null);
  const on = sub ? (await pushApi.status(sub.endpoint).catch(() => ({ on: false }))).on : false;
  return { support, serverEnabled: true, permission: Notification.permission, on };
}

/** Bật thông báo về máy này. Gọi trực tiếp từ sự kiện bấm (trình duyệt chỉ hỏi quyền sau một lần bấm). */
export async function enablePush() {
  const support = pushSupport();
  if (!support.ok) throw new Error(support.message);
  // Hỏi quyền trước mọi lệnh chờ khác để Safari còn coi là thao tác của người dùng
  const permission = await Notification.requestPermission();
  if (permission === 'denied') {
    throw new Error('Bạn đã chặn thông báo của SAM. Bật lại trong cài đặt trang web của trình duyệt hoặc cài đặt thông báo của điện thoại.');
  }
  if (permission !== 'granted') throw new Error('Chưa cho phép nhận thông báo.');
  const cfg = await pushApi.config();
  if (!cfg.enabled) throw new Error('Máy chủ SAM chưa bật thông báo đẩy. Liên hệ Phòng KHTC.');
  await navigator.serviceWorker.register(SW_URL);
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (sub && !sameKey(sub, cfg.publicKey)) {
    await sub.unsubscribe();
    sub = null;
  }
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(cfg.publicKey) });
  }
  await pushApi.subscribe(sub.toJSON());
  return true;
}

/** Tắt thông báo về máy này: máy chủ xóa đăng ký, trình duyệt hủy đăng ký. */
export async function disablePush() {
  const sub = await currentSubscription();
  if (!sub) return false;
  await pushApi.unsubscribe(sub.endpoint).catch(() => {});
  await sub.unsubscribe().catch(() => {});
  return false;
}

/** Đăng xuất: thôi nhận thông báo của tài khoản này trên máy này (máy dùng chung không nhận thông báo của người trước). */
export async function disablePushOnThisDevice() {
  if (!pushSupport().ok) return;
  await disablePush();
}
