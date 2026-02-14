const Item = ({ i, item }) => {
  return (
    <div
      key={i}
      className="flex items-center gap-3 text-zinc-400 text-sm bg-zinc-900/20 p-3 rounded-lg border border-zinc-800/50"
    >
      <div className="w-1.5 h-1.5 rounded-full bg-[#14b8a6]" />
      {item}
    </div>
  );
};

export default Item;
