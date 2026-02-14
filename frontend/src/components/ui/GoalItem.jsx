const GoalItem = ({ icon, title, desc }) => {
  return (
    <div className="flex gap-4">
      <div className="shrink-0 w-12 h-12 rounded-xl bg-[var(--bg-element)] text-teal-500 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <h3 className="font-bold text-[var(--text-primary)] mb-1">{title}</h3>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
          {desc}
        </p>
      </div>
    </div>
  );
};

export default GoalItem;
