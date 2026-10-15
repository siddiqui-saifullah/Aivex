import { GoogleGenAI } from "@google/genai";
import type { AiResponse } from "../types/index.js";

const MODEL = "gemini-2.5-flash";

/**
 * System instruction, kept compact on purpose: it is sent with every request,
 * so every token here costs latency. Gemini receives it as `systemInstruction`
 * (not inside the user message) and must answer with JSON only.
 */
const SYSTEM_INSTRUCTION = `You are Vex AI, the coding assistant inside Aivex (by Grawity Team), a browser IDE whose Node.js projects run in a WebContainer.
Reply with ONE JSON object, no markdown fences:
{"text": string, "fileTree"?: {...}, "deletedFiles"?: string[]}
- text: short Markdown answer/summary for the chat.
- fileTree: ONLY files you create or change, nested WebContainer format:
  {"name.js":{"file":{"contents":"..."}},"dir":{"directory":{"a.js":{"file":{"contents":"..."}}}}}
  Unchanged files must be omitted (they are kept as they are).
- deletedFiles: paths (e.g. "src/old.js") to remove, only when needed.
Rules:
- Greetings/questions: only "text".
- Code: complete file contents, never fragments or "..." placeholders.
- Node projects: package.json with "type":"module" and a "start" script; only dependencies that are needed.
- C, C++, Java, Python and other languages run on the cloud runner: put the entry point (main) in the file the user should run, no package.json needed.
- Edit the existing project shown in CONTEXT when relevant instead of starting over.
- Never invent secrets/API keys; never write destructive commands.
- Ambiguous or unsafe request: explain in "text" and omit fileTree.`;

const ENHANCE_INSTRUCTION = `Rewrite the user's request for a coding assistant so it is specific and actionable: name the language/framework, the features, files or behaviour expected and any constraints implied. Keep the user's intent and language, do not add unrelated features, stay under 120 words. Reply with the rewritten request only.`;

/* -------------------------------------------------------------------------- */
/* CONTEXT COMPRESSION                                                        */
/* -------------------------------------------------------------------------- */

/** Budget for project files sent as context (characters, roughly 4 per token). */
const MAX_CONTEXT_CHARS = 24_000;
const MAX_FILE_CHARS = 6_000;
const IGNORED_FILES = /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|\.aivex|\.gitkeep)$|(^|\/)node_modules\//;

export interface ChatTurn {
    role: "user" | "ai";
    text: string;
}

/**
 * Pack the project's files into a compact listing. Every path is always
 * listed; contents are included smallest-first until the budget is used up,
 * and very long files are truncated.
 */
export const buildProjectContext = (files: Record<string, string>): string => {
    const entries = Object.entries(files).filter(([path]) => !IGNORED_FILES.test(path));
    if (entries.length === 0) return "The project is empty.";

    const listing = entries.map(([path]) => path).join("\n");
    let budget = MAX_CONTEXT_CHARS - listing.length;
    const parts: string[] = [];

    for (const [path, contents] of [...entries].sort((a, b) => a[1].length - b[1].length)) {
        if (budget <= 0) break;
        const body = contents.length > MAX_FILE_CHARS
            ? `${contents.slice(0, MAX_FILE_CHARS)}\n…[truncated ${contents.length - MAX_FILE_CHARS} chars]`
            : contents;
        if (body.length > budget) continue;
        parts.push(`--- ${path}\n${body}`);
        budget -= body.length + path.length + 5;
    }

    const omitted = entries.length - parts.length;
    return `Files:\n${listing}\n\n${parts.join("\n\n")}${omitted > 0 ? `\n\n(${omitted} file(s) not shown to save space)` : ""}`;
};

const buildHistory = (history: ChatTurn[]) =>
    history
        .filter(turn => turn.text?.trim())
        .slice(-6)
        .map(turn => `${turn.role === "ai" ? "Vex" : "User"}: ${turn.text.slice(0, 500)}`)
        .join("\n");

/* -------------------------------------------------------------------------- */
/* GEMINI                                                                     */
/* -------------------------------------------------------------------------- */

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

const parseJsonResponse = (raw: string): AiResponse => {
    try {
        return JSON.parse(raw) as AiResponse;
    } catch {
        // Defensive: strip anything around the outermost object
        const first = raw.indexOf("{");
        const last = raw.lastIndexOf("}");
        if (first === -1 || last === -1) return { text: raw };
        return JSON.parse(raw.slice(first, last + 1)) as AiResponse;
    }
};

export const generate = async ({
    prompt,
    files,
    history = [],
}: {
    prompt: string;
    files?: Record<string, string>;
    history?: ChatTurn[];
}): Promise<AiResponse> => {
    try {
        const context = [
            files ? `CONTEXT (current project):\n${buildProjectContext(files)}` : "",
            history.length ? `RECENT CHAT:\n${buildHistory(history)}` : "",
            `REQUEST:\n${prompt}`,
        ].filter(Boolean).join("\n\n");

        const response = await ai.models.generateContent({
            model: MODEL,
            contents: [{ role: "user", parts: [{ text: context }] }],
            config: {
                systemInstruction: SYSTEM_INSTRUCTION,
                responseMimeType: "application/json",
                // A small thinking budget keeps answers fast while still
                // planning multi-file changes
                thinkingConfig: { thinkingBudget: 1024 },
            },
        });

        const raw = response.text ?? "";
        if (!raw) return { text: "AI returned an empty response" };

        return parseJsonResponse(raw);
    } catch (err) {
        console.error("Gemini Error:", err);
        return { text: "AI failed to generate response" };
    }
};

/** Turn a rough idea into a precise prompt (no thinking: this must feel instant). */
export const enhancePrompt = async (prompt: string): Promise<string> => {
    const response = await ai.models.generateContent({
        model: MODEL,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
            systemInstruction: ENHANCE_INSTRUCTION,
            thinkingConfig: { thinkingBudget: 0 },
            maxOutputTokens: 300,
        },
    });

    return (response.text ?? "").trim().replace(/^["']|["']$/g, "");
};
