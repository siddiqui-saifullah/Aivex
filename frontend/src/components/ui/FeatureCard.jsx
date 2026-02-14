const FeatureCard = ({ icon, title, desc }) => {
  return (
    <div className="group p-8 rounded-2xl bg-zinc-900/50 border border-white/5 hover:border-teal-500/30 hover:bg-zinc-900 transition-all duration-300">
      <div className="w-12 h-12 rounded-lg bg-teal-500/10 flex items-center justify-center mb-6 group-hover:bg-teal-500/20 transition-colors">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-3 text-zinc-100">{title}</h3>
      <p className="text-zinc-400 leading-relaxed">{desc}</p>
    </div>
  );
};

export default FeatureCard;
