import { GoogleGenAI } from "@google/genai";
import type { AiResponse } from "../types/index.js";

const MODEL = "gemini-2.5-flash";

/**
 * System instruction, kept compact on purpose: it is sent with every request,
 * so every token here costs latency. Gemini receives it as `systemInstruction`
 * (not inside the user message) and must answer with JSON only.
 */
const SYSTEM_INSTRUCTION = `You are Vex AI, the coding assistant in Aivex, a browser IDE (Node.js runs in a WebContainer; C/C++/Java/Python/etc. run on a cloud runner).
Reply with ONE JSON object only:
{"text":string,"fileTree"?:{},"deletedFiles"?:string[],"memory"?:string}
text: short Markdown reply.
fileTree: ONLY created/changed files, complete contents, nested format {"a.js":{"file":{"contents":"..."}},"src":{"directory":{"b.js":{"file":{"contents":"..."}}}}}. Omit unchanged files. Changes are saved to the project automatically.
deletedFiles: paths to remove, only if needed.
memory: updated PROJECT MEMORY (<=600 chars: purpose, stack, structure, user preferences, decisions) when something new is worth remembering; omit otherwise.
Rules: questions/greetings -> only text. Never use "..." placeholders. Websites/UI without a backend: plain index.html + style.css + script.js, NO package.json (instant live preview). Node: package.json with "type":"module" and a "start" script, minimal deps. Other languages: entry point in the file to run. If code is SELECTED, apply the request to it unless told otherwise; prefer editing the OPEN FILE. Edit the existing project, don't restart it. No secrets, no destructive commands. Unclear/unsafe -> explain in text, no files.`;

const ENHANCE_INSTRUCTION = `Rewrite the user's request for a coding assistant so it is specific and actionable: name the language/framework, the features, files or behaviour expected and any constraints implied. Keep the user's intent and language, do not add unrelated features, stay under 120 words. Reply with the rewritten request only.`;

/* -------------------------------------------------------------------------- */
/* CONTEXT COMPRESSION                                                        */
/* -------------------------------------------------------------------------- */
/*
 * The free Gemini tier is limited by tokens per minute, so every request is
 * kept small (~3-4k tokens of context):
 * - every file path is listed, but only relevant files are sent in full:
 *   the open file, files named in the request, package.json, then the
 *   smallest remaining files while the budget lasts
 * - blank-line runs and trailing whitespace are removed
 * - chat history is short; long-term facts live in the project memory
 * Stable parts (instructions, memory, files) come before the request so
 * Gemini's implicit prefix caching can reuse them across messages.
 */

/** Budget for project files sent as context (characters, roughly 4 per token). */
const MAX_CONTEXT_CHARS = 12_000;
const MAX_FILE_CHARS = 4_000;
const MAX_FOCUS_FILE_CHARS = 8_000;
const MAX_SELECTION_CHARS = 4_000;
const IGNORED_FILES = /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|\.aivex|\.gitkeep)$|(^|\/)node_modules\//;

export interface ChatTurn {
    role: "user" | "ai";
    text: string;
}

/** What the user is looking at in the editor when they ask. */
export interface EditorFocus {
    activeFile?: string;
    selection?: { startLine: number; endLine: number; text: string };
}

/** Lossless-enough shrinking of code for reading: drop trailing spaces and blank-line runs. */
export const compactCode = (code: string) =>
    code
        .replace(/[ \t]+$/gm, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

const truncate = (text: string, max: number) =>
    text.length > max ? `${text.slice(0, max)}\n…[truncated ${text.length - max} chars]` : text;

/**
 * Pack the project's files into a compact listing. Every path is always
 * listed; relevant files are included in full first, then the smallest
 * remaining ones until the budget is used up.
 */
export const buildProjectContext = (
    files: Record<string, string>,
    { prompt = "", activeFile }: { prompt?: string; activeFile?: string } = {},
): string => {
    const entries = Object.entries(files).filter(([path]) => !IGNORED_FILES.test(path));
    if (entries.length === 0) return "The project is empty.";

    const listing = entries.map(([path]) => path).join("\n");
    const lowerPrompt = prompt.toLowerCase();

    const priority = (path: string) => {
        if (path === activeFile) return 0;
        const base = path.split("/").pop()!.toLowerCase();
        if (lowerPrompt.includes(path.toLowerCase()) || (base.length > 3 && lowerPrompt.includes(base))) return 1;
        if (path === "package.json") return 2;
        return 3;
    };

    const ordered = [...entries].sort((a, b) =>
        priority(a[0]) - priority(b[0]) || a[1].length - b[1].length,
    );

    let budget = MAX_CONTEXT_CHARS - listing.length;
    const parts: string[] = [];

    for (const [path, contents] of ordered) {
        if (budget <= 0) break;
        const body = truncate(
            compactCode(contents),
            path === activeFile ? MAX_FOCUS_FILE_CHARS : MAX_FILE_CHARS,
        );
        // The open file is always included, even if it eats the budget
        if (body.length > budget && path !== activeFile) continue;
        parts.push(`--- ${path}\n${body}`);
        budget -= body.length + path.length + 5;
    }

    const omitted = entries.length - parts.length;
    return `Files:\n${listing}\n\n${parts.join("\n\n")}${omitted > 0 ? `\n\n(${omitted} file(s) not shown to save space)` : ""}`;
};

const buildHistory = (history: ChatTurn[]) =>
    history
        .filter(turn => turn.text?.trim())
        .slice(-4)
        .map(turn => `${turn.role === "ai" ? "Vex" : "User"}: ${turn.text.replace(/\s+/g, " ").slice(0, 300)}`)
        .join("\n");

const buildFocus = ({ activeFile, selection }: EditorFocus) => {
    if (!activeFile) return "";
    if (!selection?.text?.trim()) return `OPEN FILE: ${activeFile}`;
    return `OPEN FILE: ${activeFile}\nSELECTED (lines ${selection.startLine}-${selection.endLine}):\n${truncate(selection.text, MAX_SELECTION_CHARS)}`;
};

/** Gemini errors as a message the user can act on. */
export const friendlyAiError = (err: unknown): string => {
    const status = (err as { status?: number }).status;
    if (status === 429) {
        return "Vex AI has reached the free usage limit for now. Please wait a minute and try again.";
    }
    if (status === 503 || status === 500) {
        return "Vex AI is busy right now. Please try again in a moment.";
    }
    if (status === 400 || status === 403) {
        return "Vex AI couldn't process this request (check the server's Gemini API key).";
    }
    return "AI failed to generate response";
};

const isRetryable = (err: unknown) => [500, 503].includes((err as { status?: number }).status ?? 0);

/* -------------------------------------------------------------------------- */
/* GEMINI                                                                     */
/* -------------------------------------------------------------------------- */

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    // Optional: route through a proxy / gateway (also used for local testing)
    ...(process.env.GEMINI_BASE_URL ? { httpOptions: { baseUrl: process.env.GEMINI_BASE_URL } } : {}),
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
    memory = "",
    focus = {},
}: {
    prompt: string;
    files?: Record<string, string>;
    history?: ChatTurn[];
    memory?: string;
    focus?: EditorFocus;
}): Promise<AiResponse> => {
    // Stable → variable order (helps prefix caching): memory, files, chat, focus, request
    const context = [
        memory.trim() ? `PROJECT MEMORY:\n${memory.trim()}` : "",
        files ? `CONTEXT (current project):\n${buildProjectContext(files, { prompt, activeFile: focus.activeFile })}` : "",
        history.length ? `RECENT CHAT:\n${buildHistory(history)}` : "",
        buildFocus(focus),
        `REQUEST:\n${prompt}`,
    ].filter(Boolean).join("\n\n");

    const request = () => ai.models.generateContent({
        model: MODEL,
        contents: [{ role: "user", parts: [{ text: context }] }],
        config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: "application/json",
            // A small thinking budget keeps answers fast (and within free-tier
            // token limits) while still planning multi-file changes
            thinkingConfig: { thinkingBudget: 512 },
        },
    });

    try {
        let response;
        try {
            response = await request();
        } catch (err) {
            // One retry for transient overloads
            if (!isRetryable(err)) throw err;
            await new Promise((r) => setTimeout(r, 1500));
            response = await request();
        }

        const raw = response.text ?? "";
        if (!raw) return { text: "AI returned an empty response" };

        return parseJsonResponse(raw);
    } catch (err) {
        console.error("Gemini Error:", err);
        return { text: friendlyAiError(err) };
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
