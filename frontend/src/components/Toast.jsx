import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useContext } from 'react';
import { ToastContext } from '../context/toast.context';

const Toast = ({ id, message, type }) => {
  const context = useContext(ToastContext);
  const removeToast = context?.removeToast;

  const styles = {
    success: {
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
      icon: 'text-emerald-400',
      text: 'text-emerald-100',
      Icon: CheckCircle2,
    },
    error: {
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      icon: 'text-red-400',
      text: 'text-red-100',
      Icon: AlertCircle,
    },
    warning: {
      bg: 'bg-yellow-500/10',
      border: 'border-yellow-500/30',
      icon: 'text-yellow-400',
      text: 'text-yellow-100',
      Icon: AlertTriangle,
    },
    info: {
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/30',
      icon: 'text-blue-400',
      text: 'text-blue-100',
      Icon: Info,
    },
  };

  const { bg, border, icon, text, Icon } = styles[type] || styles.info;

  return (
    <div
      className={`${bg} ${border} backdrop-blur-sm border rounded-lg p-4 flex items-center gap-3 animate-in slide-in-from-right fade-in duration-300`}
    >
      <Icon size={20} className={icon} />
      <p className={`text-sm font-medium ${text} flex-1`}>{message}</p>
      <button
        onClick={() => removeToast?.(id)}
        className="text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        <X size={16} />
      </button>
    </div>
  );
};

export default Toast;
