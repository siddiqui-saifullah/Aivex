function InputField({ theme, icon, rightElement, ...props }) {
  return (
    <div className="relative group">
      <div
        className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${
          theme === "dark"
            ? "text-zinc-500 group-focus-within:text-teal-400"
            : "text-slate-400 group-focus-within:text-indigo-500"
        }`}
      >
        {icon}
      </div>
      <input
        {...props}
        className={`w-full pl-10 pr-4 py-3 rounded-xl border outline-none transition-all duration-300 ${
          theme === "dark"
            ? "bg-white/5 border-white/10 text-white placeholder-zinc-500 focus:border-teal-500 focus:bg-black/50 focus:ring-1 focus:ring-teal-500"
            : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
        }`}
      />
      {rightElement}
    </div>
  );
}

export default InputField;
