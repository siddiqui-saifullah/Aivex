import axios from "../config/axios";

/** Rewrite a rough request into a precise prompt for the AI. */
export const enhancePrompt = async (prompt: string, projectId?: string): Promise<string> => {
  // The project lets the server apply its class's AI setting
  const { data } = await axios.post<{ prompt: string }>("/ai/enhance", { prompt, projectId });
  return data.prompt;
};
