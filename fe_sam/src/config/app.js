
// Cấu hình chung của SAM.
export const ORG_NAME = 'Trường Đại học Ngoại ngữ, ĐHQGHN';

// Ngày làm việc theo giờ Việt Nam. Sau khi đăng nhập lấy theo máy chủ (setWorkDate) để giao diện và máy chủ
// tính đèn, năm chi phí theo cùng một ngày.
const vnToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());

export let TODAY = vnToday();
export let FISCAL_YEAR = Number(TODAY.slice(0, 4));
// Ngày chốt số liệu sổ sách (nguyên giá, giá trị còn lại) của lần nhập tài sản gần nhất, dạng dd/mm/yyyy
export let ASSET_BOOK_DATE = null;

export function setWorkDate(meta) {
  if (!meta) return;
  if (meta.today) {
    TODAY = meta.today;
    FISCAL_YEAR = Number(meta.fiscalYear || meta.today.slice(0, 4));
  }
  ASSET_BOOK_DATE = meta.assetBookDate || null;
}
