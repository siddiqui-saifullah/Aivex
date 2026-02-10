const Loader = () => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-5">
        <div className="w-14 h-14 rounded-full border-2 border-white/10 border-t-teal-400 animate-spin"></div>
        <p className="text-zinc-400 text-sm">Initializing Hive…</p>
      </div>
    </div>
  );
};

export default Loader;
