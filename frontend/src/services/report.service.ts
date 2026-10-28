import axios from "../config/axios";

export type ReportTarget = "user" | "project" | "message";
export type ReportReason = "spam" | "harassment" | "hate" | "sexual" | "violence" | "impersonation" | "other";

/** Report a user, project or chat message to the Aivex team. */
export const reportAbuse = async (payload: {
  targetType: ReportTarget;
  targetId: string;
  reason: ReportReason;
  details?: string;
}) => {
  const { data } = await axios.post<{ _id: string; status: string }>("/reports", payload);
  return data;
};
