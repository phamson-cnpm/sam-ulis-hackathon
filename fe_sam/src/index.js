
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { registerServiceWorker } from './utils/push';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Service worker nhận thông báo đẩy (bật, tắt ở nút chuông); không lưu đệm trang
registerServiceWorker();
