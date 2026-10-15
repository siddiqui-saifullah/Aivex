import React from "react";

const ProfileSkeleton = () => {
  return (
    <div className="min-h-screen bg-black text-zinc-100 px-6 py-12">
      <div className="max-w-4xl mx-auto space-y-10">
        {/* Header Skeleton */}
        <div>
          <div className="h-8 w-48 bg-zinc-800 rounded-md animate-pulse mb-3"></div>
          <div className="h-4 w-64 bg-zinc-800/50 rounded animate-pulse"></div>
        </div>

        {/* Profile Card Skeleton */}
        <div className="bg-zinc-900/60 border border-white/5 rounded-2xl p-6 flex items-center gap-6">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-full bg-zinc-800 animate-pulse shrink-0"></div>

          {/* Basic Info */}
          <div className="flex-1 space-y-2">
            <div className="h-6 w-40 bg-zinc-800 rounded animate-pulse"></div>
            <div className="h-4 w-24 bg-zinc-800/50 rounded animate-pulse"></div>
          </div>

          {/* Action Button Placeholder */}
          <div className="h-9 w-24 bg-zinc-800 rounded-lg animate-pulse"></div>
        </div>

        {/* Info Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
            <div
              key={i}
              className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6 space-y-6"
            >
              {/* Card Title */}
              <div className="h-4 w-32 bg-zinc-800 rounded animate-pulse"></div>

              {/* List Items */}
              <div className="space-y-4">
                {[...Array(3)].map((_, j) => (
                  <div key={j} className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded bg-zinc-800 animate-pulse"></div>
                    <div className="w-20 h-4 bg-zinc-800/50 rounded animate-pulse"></div>
                    <div className="flex-1 h-4 bg-zinc-800/30 rounded animate-pulse"></div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Danger Zone Skeleton */}
        <div className="border border-white/5 bg-zinc-900/30 rounded-2xl p-6">
          <div className="h-5 w-32 bg-zinc-800 rounded animate-pulse mb-3"></div>
          <div className="h-4 w-64 bg-zinc-800/50 rounded animate-pulse mb-6"></div>
          <div className="h-9 w-24 bg-zinc-800/50 rounded-lg animate-pulse"></div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSkeleton;
