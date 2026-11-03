
// Địa chỉ backend be_sam. Đặt REACT_APP_API_BASE_URL khi build nếu frontend và backend khác địa chỉ;
// để trống thì gọi cùng địa chỉ với trang (khi máy chủ chuyển tiếp /api về backend).
export const API_BASE_URL = (process.env.REACT_APP_API_BASE_URL || '').replace(/\/+$/, '');

export default API_BASE_URL;
