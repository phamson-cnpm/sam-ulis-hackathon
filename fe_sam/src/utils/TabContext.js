// Dải tab như phần mềm cũ: mỗi chức năng, mỗi hồ sơ mở ra một tab. Trang con đặt tên tab theo dữ liệu đã tải
// (ví dụ "Phiếu PH-2026-0012") bằng useTabTitle.
import { createContext, useContext, useEffect } from 'react';

export const TabTitleContext = createContext(null);

export function useTabTitle(title) {
  const set = useContext(TabTitleContext);
  useEffect(() => {
    if (set && title) set(title);
  }, [set, title]);
}
