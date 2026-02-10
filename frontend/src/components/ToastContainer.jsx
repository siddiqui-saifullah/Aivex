import { useContext } from 'react';
import Toast from './Toast';
import { ToastContext } from '../context/toast.context';

const ToastContainer = () => {
  const context = useContext(ToastContext);
  const toasts = context?.toasts || [];

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast id={toast.id} message={toast.message} type={toast.type} />
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
