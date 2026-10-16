const COLORS = ["#f472b6", "#60a5fa", "#fbbf24", "#a78bfa", "#34d399", "#f87171", "#22d3ee", "#fb923c"];

/** Stable colour per user (cursors, avatars). */
export const colorFor = (id: string) => {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[hash % COLORS.length];
};
