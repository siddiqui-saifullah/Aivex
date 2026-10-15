import type { ReactNode } from "react";

const StatBox = ({ number, label }: { number: ReactNode; label: ReactNode }) => {
  return (
    <div className="p-4 rounded-lg bg-white/5 border border-white/5">
      <div className="text-xl font-bold text-white mb-1">{number}</div>
      <div className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">
        {label}
      </div>
    </div>
  );
};

export default StatBox;
