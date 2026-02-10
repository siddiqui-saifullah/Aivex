import { Play, StopCircle, AlertCircle } from 'lucide-react';

const StatusBadge = ({ status }) => {
  const styles = {
    running: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    stopped: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",
    error: "text-red-400 bg-red-500/10 border-red-500/20",
  };

  const icons = {
    running: <Play size={12} className="fill-current" />,
    stopped: <StopCircle size={12} />,
    error: <AlertCircle size={12} />,
  };

  return (
    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status] || styles.stopped}`}>
      {icons[status] || icons.stopped}
      <span className="capitalize">{status}</span>
    </span>
  );
};

export default StatusBadge;
