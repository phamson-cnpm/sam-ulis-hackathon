
import React, { createContext, useCallback, useContext, useState } from 'react';
import FormViewer from '../components/FormViewer';

// Mở khung xem biểu mẫu từ bất kỳ trang nào:
//   const openForms = useFormViewer();
//   openForms({ type: 'case', reportId, focus: 'DT' });   // hồ sơ báo hỏng, mở sẵn phiếu dự toán
//   openForms({ type: 'asset', assetId });                // lý lịch sửa chữa tài sản
const FormViewerContext = createContext(() => {});

export const FormViewerProvider = ({ children }) => {
  const [source, setSource] = useState(null);
  const close = useCallback(() => setSource(null), []);

  return (
    <FormViewerContext.Provider value={setSource}>
      {children}
      {source && <FormViewer source={source} onClose={close} />}
    </FormViewerContext.Provider>
  );
};

export const useFormViewer = () => useContext(FormViewerContext);
