/**
 * Skeleton loading component for project cards
 */
export const ProjectListSkeleton = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="bg-zinc-900/30 border border-white/5 rounded-xl p-5 h-48"
        >
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 bg-white/5 rounded-lg"></div>
            <div className="w-6 h-6 bg-white/5 rounded-md"></div>
          </div>
          <div className="h-6 w-3/4 bg-white/5 rounded mb-3"></div>
          <div className="h-4 w-1/4 bg-white/5 rounded mb-6"></div>
          <div className="mt-auto h-4 w-1/2 bg-white/5 rounded"></div>
        </div>
      ))}
    </div>
  );
};
