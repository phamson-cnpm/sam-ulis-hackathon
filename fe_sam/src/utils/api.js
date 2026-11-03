
// Gọi backend be_sam. Tên hàm, tham số và dữ liệu trả về giữ đúng như bản giao diện đang dùng,
// nên các trang không phải đổi cách gọi. Sau mỗi thao tác ghi, giao diện tự tải lại dữ liệu (subscribe).

import { API_BASE_URL } from '../config/api';
import { TODAY, setWorkDate } from '../config/app';

// ---------------------------------------------------------------- Phiên đăng nhập (mục VII đề tài)
// Access Token chỉ giữ trong bộ nhớ (biến của mã), không lưu localStorage. Refresh Token nằm trong cookie HTTP-Only do
// máy chủ đặt: mã JavaScript không đọc được, trình duyệt tự gửi kèm khi gọi /auth/refresh-token.
// Mở lại web: biến tạm đã mất, AuthContext gọi refreshSession() để lấy Access Token mới, không phải nhập lại mật khẩu.
// Access Token hết hạn (401) khi đang làm việc: tự làm mới phiên rồi gửi lại yêu cầu, người dùng không thấy gián đoạn.
let token = null;
try {
  localStorage.removeItem('sam_token'); // bản cũ lưu token ở localStorage: xóa đi
} catch {
  // trình duyệt chặn lưu trữ
}

export function setToken(t) {
  token = t || null;
}
export const hasToken = () => !!token;

let onUnauthorized = null;
/** AuthContext đăng ký: phiên hết hiệu lực (đăng xuất, khóa tài khoản, đặt lại mật khẩu) thì về màn hình đăng nhập. */
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}
let onSession = null;
/** AuthContext đăng ký: nhận phiên mới sau mỗi lần làm mới (vai trò có thể đã đổi). */
export function setSessionHandler(fn) {
  onSession = fn;
}
let codePrompt = null;
/** Hộp nhập mã xác nhận cá nhân (ConfirmCodeDialog) đăng ký: trả Promise mã đã nhập, hoặc null nếu hủy. */
export function setCodePrompt(fn) {
  codePrompt = fn;
}

const listeners = new Set();
export function subscribe(fn) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
function emitChange() {
  listeners.forEach((fn) => fn());
}

export class ApiError extends Error {
  constructor(message, status, reason) {
    super(message);
    this.status = status;
    this.reason = reason;
  }
}

const URL_BASE = `${API_BASE_URL}/api/v1`;

async function send(method, path, body, extraHeaders) {
  const headers = { ...(extraHeaders || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  try {
    // credentials: trình duyệt gửi kèm cookie Refresh Token (chỉ ở đường dẫn /api/v1/auth) và nhận cookie mới
    return await fetch(`${URL_BASE}${path}`, { method, headers, body: payload, credentials: 'include' });
  } catch {
    throw new ApiError('Không kết nối được máy chủ SAM. Kiểm tra mạng rồi thử lại.', 0, 'network');
  }
}

async function errorOf(res) {
  const data = await res.json().catch(() => null);
  return new ApiError((data && data.message) || `Lỗi máy chủ (${res.status})`, res.status, data && data.reason);
}

// Nhiều yêu cầu cùng gặp 401 thì chỉ làm mới phiên một lần
let refreshing = null;
/** Gọi /auth/refresh-token (cookie HTTP-Only tự đính kèm). Thành công: giữ Access Token mới trong bộ nhớ. */
export function refreshSession() {
  if (!refreshing) {
    refreshing = (async () => {
      const res = await send('POST', '/auth/refresh-token');
      if (!res.ok) {
        token = null;
        throw await errorOf(res);
      }
      const data = await res.json();
      token = data.accessToken;
      if (onSession) onSession(data);
      return data;
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

const RETRY_REASONS = ['token_expired', 'no_token'];

async function request(method, path, body, opts = {}) {
  let headers = opts.headers;
  let res = await send(method, path, body, headers);
  // Access Token hết hạn: làm mới phiên rồi gửi lại một lần
  if (res.status === 401 && !opts.noAuthHandler) {
    const err = await errorOf(res);
    if (RETRY_REASONS.includes(err.reason)) {
      try {
        await refreshSession();
      } catch (e) {
        if (onUnauthorized) onUnauthorized(e);
        throw e;
      }
      res = await send(method, path, body, headers);
    } else {
      if (onUnauthorized) onUnauthorized(err);
      throw err;
    }
  }
  // Thao tác quan trọng cần mã xác nhận cá nhân (428): hỏi mã rồi gửi lại; sai mã thì hỏi lại kèm lời báo
  let lastError = null;
  for (let i = 0; i < 6 && (res.status === 428 || (lastError && res.status === 400)); i += 1) {
    const err = await errorOf(res);
    if (res.status === 400 && !['bad_code', 'bad_leader_code'].includes(err.reason)) throw err;
    if (!codePrompt) throw err;
    const code = await codePrompt({ error: res.status === 400 ? err.message : null });
    if (!code) throw new ApiError('Đã hủy thao tác (chưa nhập mã xác nhận).', 0, 'cancelled');
    lastError = err;
    headers = { ...(opts.headers || {}), 'X-Confirm-Code': code };
    res = await send(method, path, body, headers);
  }
  if (opts.raw && res.ok) return res;
  if (!res.ok) {
    const err = await errorOf(res);
    if (res.status === 401 && !opts.noAuthHandler && onUnauthorized) onUnauthorized(err);
    throw err;
  }
  return res.status === 204 ? null : res.json().catch(() => null);
}

const get = (path) => request('GET', path);
/** Thao tác ghi: xong thì tải lại danh bạ, danh mục rồi báo các màn hình tải lại dữ liệu. */
async function write(method, path, body, opts) {
  const data = await request(method, path, body, opts);
  await loadRefs().catch(() => {});
  emitChange();
  return data;
}
const post = (path, body = {}, opts) => write('POST', path, body, opts);
const qs = (o) =>
  Object.entries(o)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

/** Tệp chọn bằng FilePick: { id, name } vừa tải lên; chuỗi là tệp đã có (không đổi). */
const fileIdOf = (f) => (f && typeof f === 'object' ? f.id : null);
/** Mã xác nhận đã nhập sẵn trên hộp thoại: gửi kèm header, thiếu thì máy chủ trả 428 và giao diện hỏi mã. */
const withCode = (code) => (code ? { headers: { 'X-Confirm-Code': String(code).trim() } } : undefined);

/** Thời điểm hiện tại theo giờ Việt Nam, dạng 2026-10-24T09:30 (điền sẵn giờ kiểm tra, giờ cấp thiết bị tạm). */
export function nowStamp() {
  const t = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
  return `${TODAY}T${t}`;
}

// ---------------------------------------------------------------- Đăng nhập
export const authApi = {
  /** Đúng mật khẩu: Access Token trong JSON, Refresh Token máy chủ đặt vào cookie HTTP-Only. */
  login: (username, password) => request('POST', '/auth/login', { username, password }, { noAuthHandler: true }),
  refresh: () => refreshSession(),
  me: () => request('GET', '/auth/me'),
  changePassword: (currentPassword, newPassword) =>
    request('POST', '/auth/password', { currentPassword, newPassword }),
  /** Hủy phiên của máy này, máy chủ xóa cookie. */
  logout: () => send('POST', '/auth/logout').catch(() => {}),
  logoutAll: () => request('POST', '/auth/logout-all', {}),
};

// ---------------------------------------------------------------- Danh bạ, tài sản rút gọn, danh mục (tra nhanh theo id)
const cache = {
  people: new Map(),
  assets: new Map(),
  faultLists: [{ groupCode: '', name: 'Danh sách chung', items: [] }],
  situations: [],
  openReports: new Map(),
  eligibility: new Map(),
  pending: [],
};

export async function loadRefs() {
  if (!token) return;
  const r = await get('/refs');
  cache.people = new Map(r.people.map((p) => [p.id, p]));
  cache.assets = new Map(r.assets.map((a) => [a.id, a]));
  cache.faultLists = r.faultLists;
  cache.situations = r.situations;
}

export function clearRefs() {
  cache.people = new Map();
  cache.assets = new Map();
  cache.openReports = new Map();
  cache.eligibility = new Map();
  cache.pending = [];
}

/** Tra tên người, tài sản theo id (đồng bộ, từ danh bạ đã tải). */
export const refs = {
  userById: (id) => (id ? cache.people.get(id) : undefined),
  assetById: (id) => (id ? cache.assets.get(id) : undefined),
};

// Nhớ phiếu đang mở của tài sản (để cảnh báo báo trùng) từ kết quả tìm, xem tài sản
const rememberOpen = (list) => {
  for (const a of list) cache.openReports.set(a.id, a.openReport || undefined);
  return list;
};

// ---------------------------------------------------------------- Ngày làm việc, số việc chờ
export const metaApi = {
  get: () => get('/meta'),
  counts: () => get('/me/counts'),
};

// ---------------------------------------------------------------- Danh mục
export const catalogApi = {
  async users() {
    // Cán bộ đã xóa khỏi danh sách chỉ dùng để hiện tên trong lịch sử, không đưa vào ô chọn người
    return [...cache.people.values()].filter((p) => !p.kind && !p.deleted);
  },
  units: () => get('/catalog/units'),
  assetGroups: () => get('/catalog/asset-groups'),
  repairJobs: () => get('/catalog/repair-jobs'),
  /** Nội dung báo hỏng hay gặp theo nhóm tài sản; nhóm chưa có danh sách thì dùng danh sách chung. */
  faults(groupCode) {
    const hit = cache.faultLists.find((f) => f.groupCode === groupCode && f.items.length);
    return (hit || cache.faultLists.find((f) => f.groupCode === '') || { items: [] }).items;
  },
  /** Tình huống đang xảy ra, mục khẩn cấp đứng đầu. */
  situations() {
    return cache.situations;
  },
  faultLists() {
    return cache.faultLists;
  },
  addFault: (groupCode, text) => post('/catalog/faults', { groupCode, text }),
  removeFault: (groupCode, text) => post('/catalog/faults/remove', { groupCode, text }),
  addSituation: (text, urgent) => post('/catalog/situations', { text, urgent }),
  setSituationUrgent: (text, urgent) => write('PATCH', '/catalog/situations', { text, urgent }),
  removeSituation: (text) => post('/catalog/situations/remove', { text }),
  allRepairJobs: () => get('/catalog/repair-jobs?all=true'),
  addRepairJob: (input) => post('/catalog/repair-jobs', input),
  setRepairJobActive: (id, active) => write('PATCH', `/catalog/repair-jobs/${id}`, { active }),
};

// ---------------------------------------------------------------- Tài sản
export const assetsApi = {
  list: () => get('/assets'),
  async get(id) {
    const a = await get(`/assets/${id}`);
    rememberOpen([a]);
    return a;
  },
  async search(q, limit = 8) {
    if (!String(q || '').trim()) return [];
    return rememberOpen(await get(`/assets/search?${qs({ q, limit })}`));
  },
  history: (id) => get(`/assets/${id}/history`),
  previewLight: (assetId, draftLines, excludeEstimateId) =>
    request('POST', `/assets/${assetId}/preview-light`, { draftLines, excludeEstimateId }),
  /** Phòng KHTC quyết định với tài sản chờ thanh lý: decision thanh_ly | loai_khoi_danh_sach. */
  decideDisposal: (assetId, decision, basis, note) =>
    post(`/assets/${assetId}/disposal-decision`, { decision, basis, note }),
};

// ---------------------------------------------------------------- Phiếu báo hỏng
export const reportsApi = {
  mine: () => get('/reports/mine'),
  all: () => get('/reports'),
  /** Phiếu chưa xử lý xong của một tài sản (để cảnh báo báo trùng). */
  openFor(assetId) {
    return cache.openReports.get(assetId);
  },
  /** Người báo tự điền theo tài khoản đang đăng nhập; Phòng QTNL lập thay thì chọn người báo từ dữ liệu cán bộ. */
  createBatch: (reporter, phone, items) => post('/reports/batch', { reporterId: reporter ? reporter.id : null, phone, items }),
  accept: (reportId) => post(`/reports/${reportId}/accept`),
  /** Gộp phiếu trùng cùng một sự cố vào phiếu chính (mục 5.3 đề tài). */
  mergeCandidates: (reportId) => get(`/reports/${reportId}/merge-candidates`),
  merge: (reportId, mainId) => post(`/reports/${reportId}/merge`, { mainId }),
  unmerge: (reportId) => post(`/reports/${reportId}/unmerge`),
  async getCase(reportId) {
    const c = await get(`/reports/${reportId}/case`);
    cache.eligibility.set(reportId, c.recallEligibility);
    return c;
  },
};

// ---------------------------------------------------------------- Biên bản kiểm tra
export const inspectionsApi = {
  create: (input) => post('/inspections', input),
  attachScan: (id, file) => post(`/inspections/${id}/scan`, { fileId: fileIdOf(file) }),
  pendingTotalLoss: () => get('/inspections/pending-total-loss'),
  /** Lãnh đạo xác nhận hoặc trả lại (kèm lý do), đều nhập mã xác nhận cá nhân (leader.code; thiếu thì hỏi mã). */
  decideTotalLoss: (id, leader, approve, reason) =>
    post(`/inspections/${id}/total-loss`, { approve, reason, leaderCode: (leader && leader.code) || undefined }),
};

// ---------------------------------------------------------------- Thiết bị tạm, kho không có thiết bị
export const tempTransfersApi = {
  create: (input) => post('/temp-transfers', input),
  markReturned: (id) => post(`/temp-transfers/${id}/return`),
  active: () => get('/temp-transfers/active'),
};

export const noSpareApi = {
  create: (input) => post('/no-spares', input),
  list: () => get('/no-spares'),
};

// ---------------------------------------------------------------- Dự toán, ngoại lệ, ngưỡng
export const estimatesApi = {
  list: () => get('/estimates'),
  create: (input, _technician, exception) => post('/estimates', { ...input, exception: exception || null }),
  resubmit: (id, lines) => post(`/estimates/${id}/resubmit`, { lines }),
  confirm: (id, leader) => post(`/estimates/${id}/confirm`, { leaderCode: (leader && leader.code) || undefined }),
  returnBack: (id, leader, reason) => post(`/estimates/${id}/return`, { reason, leaderCode: (leader && leader.code) || undefined }),
  markSigned: (id, file) => post(`/estimates/${id}/signed`, { fileId: fileIdOf(file) }),
  markRejected: (id, reason) => post(`/estimates/${id}/reject`, { reason }),
  canEnterActual(est) {
    return est.canEnterActual || { ok: false, reason: '' };
  },
  enterActual: (id, actuals, voucherNo, voucherDate, voucherTotal) =>
    post(`/estimates/${id}/actual`, { actuals, voucherNo, voucherDate, voucherTotal }),
  /** Sửa chi phí thực tế khi nhập nhầm; máy chủ ghi người sửa, thời gian, số cũ và số mới. */
  correctActual: (id, actuals, voucherNo, voucherDate, voucherTotal, note) =>
    post(`/estimates/${id}/actual/correct`, { actuals, voucherNo, voucherDate, voucherTotal, note }),
};

export const exceptionsApi = {
  list: () => get('/exceptions'),
  decide: (id, _user, approve, docNo, docDate, conclusion, file) =>
    post(`/exceptions/${id}/decide`, { approve, docNo, docDate, conclusion, fileId: fileIdOf(file) }),
};

export const thresholdsApi = {
  get: () => get('/thresholds'),
  logs: () => get('/thresholds/logs'),
  preview: (next) => request('POST', '/thresholds/preview', next),
  save: (next) => write('PUT', '/thresholds', next),
};

// ---------------------------------------------------------------- Thu hồi tài sản hỏng về kho, bàn giao
export const recallsApi = {
  async list() {
    const [list, pending] = await Promise.all([get('/recalls'), get('/recalls/pending')]);
    cache.pending = pending;
    return list;
  },
  /** Các hồ sơ đủ căn cứ nhưng Phòng QTNL chưa đề nghị thu hồi (tải cùng list()). */
  pending() {
    return cache.pending;
  },
  /** Hồ sơ có được đề nghị thu hồi không (tải cùng getCase()). */
  eligibility(reportId) {
    return cache.eligibility.get(reportId) || { ok: false };
  },
  propose: (input) => post('/recalls', input),
  decide: (id, _user, approve, reason) => post(`/recalls/${id}/decide`, { approve, reason }),
  complete: (id, _user, transferNo, transferDate, file) =>
    post(`/recalls/${id}/complete`, { transferNo, transferDate, fileId: fileIdOf(file) }),
  attachDocs: (id, _user, transferNo, file) => post(`/recalls/${id}/attach`, { transferNo, fileId: fileIdOf(file) }),
};

export const handoversApi = {
  list: () => get('/handovers'),
  create: ({ scanFile, ...input }) => post('/handovers', { ...input, fileId: fileIdOf(scanFile) }),
  createForRecall: (recallId, { scanFile, ...input }) =>
    post(`/recalls/${recallId}/handover`, { ...input, fileId: fileIdOf(scanFile) }),
};

// ---------------------------------------------------------------- Biểu mẫu in
export const formsApi = {
  caseDossier: (reportId) => get(`/forms/case/${reportId}`),
  handoverDossier: (handoverId) => get(`/forms/handover/${handoverId}`),
  assetDossier: (assetId) => get(`/forms/asset/${assetId}`),
};

// ---------------------------------------------------------------- Cán bộ đầu mối, dữ liệu cán bộ
export const focalApi = {
  /** Tài sản toàn trường, chỉ các cột cán bộ đầu mối được xem (màu đèn, mã, tên, phòng ban, vị trí, nguyên giá, Đề xuất). */
  unitAssets: () => get('/focal/assets'),
  /** Ghi nhật ký theo mã đầu mối (xem, tải file); không tải lại màn hình. */
  log: (_code, action, detail) => request('POST', '/focal/log', { action, detail }).catch(() => {}),
  list: () => get('/focal'),
  logs: () => get('/focal/logs'),
  reissue: (unit, input) => post('/focal/reissue', { unit, ...input }),
  revoke: (id, reason) => post(`/focal/${id}/revoke`, { reason }),
};

export const staffApi = {
  list: () => get('/staff'),
  /** Tìm cán bộ theo tên, đơn vị (ô Họ tên trên phiếu báo hỏng). */
  search(q, limit = 8) {
    const s = String(q || '').trim().toLowerCase();
    if (!s) return [];
    return [...cache.people.values()]
      .filter((u) => !u.kind && !u.deleted && (u.name.toLowerCase().includes(s) || u.unit.toLowerCase().includes(s)))
      .slice(0, limit);
  },
  create: (input) => post('/staff', input),
  update: (id, patch) => write('PATCH', `/staff/${id}`, patch),
  /** Xóa cán bộ khỏi danh sách (kèm tài khoản): trả { mode: 'removed' (xóa hẳn) | 'hidden' (đã có lịch sử, ẩn), name }. */
  remove: (id) => write('DELETE', `/staff/${id}`),
  /** Cấp tài khoản cá nhân hoặc đặt lại mật khẩu: trả { username, password } (mật khẩu ban đầu chỉ hiện một lần). */
  issueAccount: (id, username) => post(`/staff/${id}/account`, username ? { username } : {}),
  issueAll: (unit) => post('/staff/accounts/issue-all', unit ? { unit } : {}),
  setActive: (id, active) => post(`/staff/${id}/active`, { active }),
  /** Xóa tài khoản đăng nhập (giữ dữ liệu cán bộ, lịch sử); mọi thiết bị của người đó đăng xuất ngay. */
  deleteAccount: (id) => write('DELETE', `/staff/${id}/account`),
  logoutAll: (id) => post(`/staff/${id}/logout-all`),
  /** Đổi mã xác nhận cá nhân của kỹ thuật viên, lãnh đạo Phòng QTNL. */
  reissueCode: (id) => post(`/staff/${id}/code`),
  /** Lãnh đạo Phòng QTNL nhập lại mã cá nhân khi xác nhận; máy chủ kiểm tra mã khi xác nhận. */
  leaderByCode(code) {
    const c = String(code || '').trim();
    if (!c) throw new Error('Nhập mã xác nhận cá nhân');
    return { code: c };
  },
};

// ---------------------------------------------------------------- Đề xuất xử lý tài sản (cột Đề xuất)
export const proposalsApi = {
  list: (status) => get(`/proposals${status ? `?${qs({ status })}` : ''}`),
  get: (id) => get(`/proposals/${id}`),
  /** Gửi đề xuất (một hoặc nhiều tài sản): items [{ assetId, kind, reason }]. Cần mã xác nhận cá nhân. */
  create: (kind, items, code) => post('/proposals', { kind, items }, withCode(code)),
  /** Lãnh đạo Phòng QTNL: action duyet | ky_thuat (techId) | khong_duyet (reason bắt buộc). */
  decide: (id, input, code) => post(`/proposals/${id}/decide`, input, withCode(code)),
  /** Kỹ thuật viên được giao: opinion dong_y | khong_dong_y | de_xuat_khac, note. */
  tech: (id, opinion, note, code) => post(`/proposals/${id}/tech`, { opinion, note }, withCode(code)),
  /** Phòng KHTC: tiep_nhan, hoặc khong_duyet kèm lý do (Ban Giám hiệu không đồng ý). */
  khtc: (action, ids, reason) => post('/proposals/khtc', { action, ids, reason }),
};

// ---------------------------------------------------------------- Thông báo đẩy về máy này (nút chuông)
export const pushApi = {
  config: () => get('/push/config'),
  subscribe: (subscription) => request('POST', '/push/subscribe', { subscription, test: true }),
  unsubscribe: (endpoint) => request('POST', '/push/unsubscribe', { endpoint }),
  status: (endpoint) => request('POST', '/push/status', { endpoint }),
};

// ---------------------------------------------------------------- Thông báo, nhật ký xuất file
export const notificationsApi = {
  list: () => get('/notifications'),
  markAllRead: () => post('/notifications/read-all'),
};

export const EXPORT_ACTIONS = ['xuat_excel', 'tai_pdf', 'in', 'tai_word'];

export const exportLogApi = {
  /** Mọi lần In, Tải Word, Tải Excel, Tải PDF đều ghi lại theo tài khoản của người thao tác. */
  log: (user, action, detail = '') => (user ? request('POST', '/export-logs', { action, detail }).catch(() => {}) : undefined),
  list: () => get('/export-logs'),
};

// ---------------------------------------------------------------- Tệp, nhập Excel
export const filesApi = {
  async upload(file) {
    const fd = new FormData();
    fd.append('file', file);
    return request('POST', '/files', fd);
  },
  /** Mở tệp đã tải lên (bản quét) ở thẻ mới. */
  async open(id) {
    const win = window.open('', '_blank');
    try {
      const res = await request('GET', `/files/${id}`, undefined, { raw: true });
      const url = URL.createObjectURL(await res.blob());
      if (win) win.location.href = url;
      else window.location.href = url;
    } catch (e) {
      if (win) win.close();
      throw e;
    }
  },
};

export const importApi = {
  async upload(file) {
    const fd = new FormData();
    fd.append('file', file);
    const res = await request('POST', '/import', fd);
    // Ngày chốt số liệu sổ sách đổi theo file vừa nhập
    await Promise.all([loadRefs().catch(() => {}), metaApi.get().then(setWorkDate).catch(() => {})]);
    emitChange();
    return res;
  },
};
