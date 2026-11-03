
import React, { createContext, useCallback, useContext, useState } from 'react';
import { Toasts } from '../components/Toast';

// Thông báo nhỏ góc dưới màn hình: toast('success' | 'error' | 'info', 'nội dung').
const ToastContext = createContext(() => {});

export const ToastProvider = ({ children }) => {
  const [items, setItems] = useState([]);

  const dismiss = useCallback((id) => setItems((t) => t.filter((x) => x.id !== id)), []);

  const toast = useCallback(
    (type, message) => {
      const id = `t${Date.now()}${Math.random()}`;
      setItems((t) => [...t, { id, type, message }]);
      setTimeout(() => dismiss(id), 4200);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <Toasts items={items} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
