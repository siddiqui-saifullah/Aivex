const SocialLink = ({ href, icon, label }) => {
  return (
    <a
      href={href}
      className="flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-teal-500/50 hover:bg-[var(--bg-element)] transition-all"
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </a>
  );
};

export default SocialLink;
