import type { SubmissionStatus } from "../../types";

const STYLES: Record<SubmissionStatus, { label: string; className: string }> = {
  submitted: { label: "Submitted", className: "border-sky-500/30 bg-sky-500/10 text-sky-300" },
  reviewed: { label: "Reviewed", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" },
  "revision-requested": { label: "Changes requested", className: "border-amber-500/30 bg-amber-500/10 text-amber-300" },
};

/** A hand-in's review status, optionally with its version and marks. */
const SubmissionBadge = ({ status, version, marks, maxMarks }: {
  status: SubmissionStatus;
  version?: number;
  marks?: number | null;
  maxMarks?: number | null;
}) => {
  const { label, className } = STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${className}`}>
      {label}
      {version && version > 1 ? ` · v${version}` : ""}
      {marks != null && maxMarks ? ` · ${marks}/${maxMarks}` : ""}
    </span>
  );
};

export default SubmissionBadge;
