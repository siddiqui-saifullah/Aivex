/** Where to go after signing in: a path on this site from ?next=, else the dashboard. */
export const safeNextPath = (next: string | null | undefined) =>
  next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/dashboard";
