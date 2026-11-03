
import React from 'react';
import { AuthProvider } from './utils/AuthContext';
import { ToastProvider } from './utils/ToastContext';
import { FormViewerProvider } from './utils/FormViewerContext';
import SamApp from './pages/SamApp';

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <FormViewerProvider>
          <SamApp />
        </FormViewerProvider>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
