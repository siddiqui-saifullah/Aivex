import axios from "../config/axios";

/** Rewrite a rough request into a precise prompt for the AI. */
export const enhancePrompt = async (prompt: string): Promise<string> => {
  const { data } = await axios.post<{ prompt: string }>("/ai/enhance", { prompt });
  return data.prompt;
};
