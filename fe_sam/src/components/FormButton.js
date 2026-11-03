
// Nút mở biểu mẫu điền sẵn của một bước (xem, in, tải Word).
import React from 'react';
import { FileText } from 'lucide-react';
import { useFormViewer } from '../utils/FormViewerContext';
import { Button } from './ui';

const FormButton = ({ source, children = 'Xem biểu mẫu', size = 'sm', variant = 'secondary', className }) => {
  const openForms = useFormViewer();
  return (
    <Button
      size={size}
      variant={variant}
      className={className}
      icon={<FileText size={size === 'sm' ? 14 : 16} />}
      onClick={(e) => {
        e.stopPropagation();
        openForms(source);
      }}
    >
      {children}
    </Button>
  );
};

export default FormButton;
