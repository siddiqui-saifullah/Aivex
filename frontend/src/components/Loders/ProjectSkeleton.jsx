import React from "react";

const ProjectSkeleton = () => {
  return (
    <div className="h-[calc(100vh-4rem)] flex overflow-hidden bg-zinc-950 text-zinc-400">
      {/* Left Section (Sidebar + Chat) - Matches w-[23%] */}
      <div className="flex flex-col h-full w-[23%] min-w-60 border-r border-white/10 bg-black/20">
        {/* Header Skeleton */}
        <div className="h-14 border-b border-white/10 flex items-center justify-between px-4 shrink-0">
          <div className="h-4 w-24 bg-zinc-800 rounded animate-pulse"></div>
          <div className="h-8 w-8 bg-zinc-800 rounded animate-pulse"></div>
        </div>

        {/* Messages Skeleton */}
        <div className="flex-1 p-4 space-y-6 overflow-hidden flex flex-col justify-end pb-4">
          {/* Incoming Message */}
          <div className="flex flex-col gap-2 w-3/4">
            <div className="h-3 w-16 bg-zinc-800 rounded animate-pulse"></div>
            <div className="h-16 w-full bg-zinc-800/50 rounded-xl animate-pulse"></div>
          </div>

          {/* Outgoing Message */}
          <div className="flex flex-col gap-2 w-3/4 self-end items-end">
            <div className="h-16 w-full bg-zinc-700/30 rounded-xl animate-pulse"></div>
          </div>

          {/* Incoming Message */}
          <div className="flex flex-col gap-2 w-2/3">
            <div className="h-3 w-20 bg-zinc-800 rounded animate-pulse"></div>
            <div className="h-10 w-full bg-zinc-800/50 rounded-xl animate-pulse"></div>
          </div>
        </div>

        {/* Input Area Skeleton */}
        <div className="p-3 border-t border-white/10 shrink-0">
          <div className="h-12 w-full bg-zinc-900 rounded-lg border border-white/5 animate-pulse"></div>
        </div>
      </div>

      {/* Right Section (Files + Editor) - Matches w-[77%] */}
      <div className="flex w-[77%] h-full bg-zinc-900/10">
        {/* File Explorer Skeleton */}
        <div className="w-64 border-r border-white/10 h-full p-4 flex flex-col gap-3 shrink-0 hidden md:flex">
          <div className="h-4 w-20 bg-zinc-800 rounded animate-pulse mb-2"></div>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-4 w-4 bg-zinc-800 rounded animate-pulse"></div>
              <div className="h-3 w-32 bg-zinc-800/50 rounded animate-pulse"></div>
            </div>
          ))}
        </div>

        {/* Code Editor Skeleton */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Editor Header/Tabs */}
          <div className="h-10 border-b border-white/10 flex items-center px-4 gap-2 bg-black/10">
            <div className="h-7 w-32 bg-zinc-800 rounded-t-md animate-pulse"></div>
            <div className="h-7 w-4 bg-zinc-800/50 rounded animate-pulse"></div>
          </div>

          {/* Editor Body */}
          <div className="p-6 space-y-3 flex-1">
            <div className="h-4 w-1/3 bg-zinc-800/40 rounded animate-pulse"></div>
            <div className="h-4 w-1/2 bg-zinc-800/40 rounded animate-pulse"></div>
            <div className="h-4 w-1/4 bg-zinc-800/40 rounded animate-pulse"></div>
            <div className="h-4 w-2/3 bg-zinc-800/40 rounded animate-pulse"></div>
            <div className="h-4 w-1/2 bg-zinc-800/40 rounded animate-pulse"></div>
            <div className="h-4 w-3/4 bg-zinc-800/40 rounded animate-pulse mt-8"></div>
            <div className="h-4 w-1/3 bg-zinc-800/40 rounded animate-pulse"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectSkeleton;
