import axios from "../config/axios";

/** Rewrite a rough request into a precise prompt for the AI. */
export const enhancePrompt = async (prompt: string, projectId?: string): Promise<string> => {
  // The project lets the server apply its class's AI setting
  const { data } = await axios.post<{ prompt: string }>("/ai/enhance", { prompt, projectId });
  return data.prompt;
};

/** The user's daily Vex allowance (limit null = unlimited). */
export interface AiUsage {
  /** The user's plan ("free", "student", "pro", "premium"). */
  plan?: string;
  limit: number | null;
  used: number;
  remaining: number | null;
  resetsAt: string;
  /** Which limit the numbers are: today's, or the month's when that runs out first. */
  period?: "day" | "month";
  monthLimit?: number | null;
  monthUsed?: number;
}

export const getAiUsage = async (): Promise<AiUsage> => {
  const { data } = await axios.get<AiUsage>("/ai/usage");
  return data;
};

export const aiLimitMessage = (usage: AiUsage) => {
  const more = usage.plan === "premium" ? "" : " Upgrade your plan in Settings for more.";
  if (usage.period === "month") {
    return `You've used all ${usage.limit} Vex AI questions for this month. They reset on ${new Date(usage.resetsAt).toLocaleDateString([], { day: "numeric", month: "short" })}.${more}`;
  }
  return `You've used all ${usage.limit} Vex AI questions for today. They reset at ${new Date(usage.resetsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.${more}`;
};
