import { GoogleGenAI } from "@google/genai";
import type { AiResponse } from "../types/index.js";

/* -------------------------------------------------------------------------- */
/* AI ROUTER                                                                  */
/* -------------------------------------------------------------------------- */
/*
 * Requests go through a route of model groups, best first, and fall back
 * down it when a model is rate limited, missing, overloaded or answers badly:
 * - free:  free models from OpenRouter and Groq (only when their keys are set)
 * - lite:  Gemini 2.5 Flash-Lite, 2.0 Flash (cheap)
 * - flash: Gemini 2.5 Flash
 * - pro:   Gemini 2.5 Pro (best, most expensive)
 * Each plan has its own route (config/plans.ts). Model lists can be changed
 * without a deploy: OPENROUTER_FREE_MODELS, GROQ_MODELS (comma lists), and
 * GEMINI_MODEL replaces every Gemini group.
 */
export type ModelGroup = "free" | "lite" | "flash" | "pro";
type Provider = "gemini" | "openrouter" | "groq";
interface Target { provider: Provider; model: string }

/** The route when none is given (the order used before plans existed). */
const DEFAULT_ROUTE: ModelGroup[] = ["flash", "lite"];

const DEFAULT_OPENROUTER = "deepseek/deepseek-chat-v3-0324:free,qwen/qwen-2.5-coder-32b-instruct:free,meta-llama/llama-3.3-70b-instruct:free";
const DEFAULT_GROQ = "llama-3.3-70b-versatile,openai/gpt-oss-120b";

const envList = (name: string, fallback = "") =>
    (process.env[name] || fallback).split(",").map((m) => m.trim()).filter(Boolean);

const GEMINI_GROUPS: Record<Exclude<ModelGroup, "free">, string[]> = {
    lite: ["gemini-2.5-flash-lite", "gemini-2.0-flash"],
    flash: ["gemini-2.5-flash"],
    pro: ["gemini-2.5-pro"],
};

const targetsOf = (group: ModelGroup): Target[] => {
    if (group === "free") {
        return [
            ...(process.env.OPENROUTER_API_KEY ? envList("OPENROUTER_FREE_MODELS", DEFAULT_OPENROUTER).map((model) => ({ provider: "openrouter" as const, model })) : []),
            ...(process.env.GROQ_API_KEY ? envList("GROQ_MODELS", DEFAULT_GROQ).map((model) => ({ provider: "groq" as const, model })) : []),
        ];
    }
    const models = process.env.GEMINI_MODEL ? envList("GEMINI_MODEL") : GEMINI_GROUPS[group];
    return models.map((model) => ({ provider: "gemini" as const, model }));
};

/** Every model on the route, in order, without repeats. */
const routeTargets = (route: ModelGroup[]) => {
    const seen = new Set<string>();
    return route.flatMap(targetsOf).filter((t) => {
        const id = `${t.provider}:${t.model}`;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
    });
};

/** Rate-limited models are skipped for a minute. */
const coolingUntil = new Map<string, number>();

/** Gemini errors where another model may still work (quota, missing model, overload). */
const tryNextModel = (err: unknown) => {
    const status = (err as { status?: number }).status;
    const message = String((err as { message?: string }).message ?? "");
    return status === 429 || status === 404 || status === 500 || status === 502 || status === 503
        || (status === 400 && /model|not (found|supported)|thinking/i.test(message));
};

/** Run the call on the first model of the route that works. */
const withRoute = async <T>(call: (target: Target) => Promise<T>, route: ModelGroup[] = DEFAULT_ROUTE): Promise<T> => {
    const targets = routeTargets(route.length ? route : DEFAULT_ROUTE);
    if (!targets.length) targets.push(...routeTargets(DEFAULT_ROUTE));
    const now = Date.now();
    const usable = targets.filter((t) => (coolingUntil.get(`${t.provider}:${t.model}`) ?? 0) <= now);
    let lastError: unknown;
    for (const target of usable.length ? usable : targets) {
        try {
            return await call(target);
        } catch (err) {
            lastError = err;
            const status = (err as { status?: number }).status;
            if (status === 429) coolingUntil.set(`${target.provider}:${target.model}`, Date.now() + 60_000);
            // Optional free providers never stop the route; Gemini config errors do
            if (target.provider === "gemini" && !tryNextModel(err)) throw err;
            console.warn(`AI ${target.provider} ${target.model} failed (${status ?? "error"}), trying the next model`);
        }
    }
    throw lastError;
};

/** Only 2.5 models take a thinking budget (Pro can't switch thinking off). */
const thinking = (model: string, budget: number) => {
    if (!/2\.5/.test(model)) return {};
    return { thinkingConfig: { thinkingBudget: /pro/.test(model) ? Math.max(budget, 128) : budget } };
};

class ProviderError extends Error {
    constructor(message: string, public status: number) {
        super(message);
    }
}

const COMPAT = {
    openrouter: { base: () => process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1", key: () => process.env.OPENROUTER_API_KEY },
    groq: { base: () => process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1", key: () => process.env.GROQ_API_KEY },
};

/** OpenAI-style chat completion (OpenRouter, Groq). */
const chatCompletion = async (
    provider: "openrouter" | "groq",
    model: string,
    system: string,
    user: string,
    { json = false, maxTokens }: { json?: boolean; maxTokens?: number } = {},
): Promise<string> => {
    const res = await fetch(`${COMPAT[provider].base()}/chat/completions`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${COMPAT[provider].key()}`,
            ...(provider === "openrouter" ? { "HTTP-Referer": "https://aivex.in", "X-Title": "Aivex" } : {}),
        },
        body: JSON.stringify({
            model,
            messages: [{ role: "system", content: system }, { role: "user", content: user }],
            temperature: 0.4,
            ...(json ? { response_format: { type: "json_object" } } : {}),
            ...(maxTokens ? { max_tokens: maxTokens } : {}),
        }),
        signal: AbortSignal.timeout(60_000),
    }).catch((err) => {
        throw new ProviderError(`${provider} unreachable: ${(err as Error).message}`, 503);
    });
    if (!res.ok) throw new ProviderError(`${provider} ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`, res.status);
    const data = await res.json().catch(() => null) as { choices?: { message?: { content?: string } }[] } | null;
    // Reasoning models may show their thinking first
    const text = (data?.choices?.[0]?.message?.content ?? "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    if (!text) throw new ProviderError(`${provider} returned an empty answer`, 502);
    return text;
};

/**
 * System instruction, kept compact on purpose: it is sent with every request,
 * so every token here costs latency. Gemini receives it as `systemInstruction`
 * (not inside the user message) and must answer with JSON only.
 */
const SYSTEM_INSTRUCTION = `You are Vex AI, the coding assistant in Aivex, a browser IDE (Node.js runs in a WebContainer; C compiles and runs in the browser (C99, interactive stdin; no POSIX/threads); C++/Java/Python/etc. run on a cloud runner).
Reply with ONE JSON object only:
{"text":string,"fileTree"?:{},"deletedFiles"?:string[],"memory"?:string}
text: short Markdown reply.
fileTree: ONLY created/changed files, complete contents, nested format {"a.js":{"file":{"contents":"..."}},"src":{"directory":{"b.js":{"file":{"contents":"..."}}}}}. Omit unchanged files. Changes are saved to the project automatically.
deletedFiles: paths to remove, only if needed.
memory: updated PROJECT MEMORY (<=600 chars: purpose, stack, structure, user preferences, decisions) when something new is worth remembering; omit otherwise.
Rules: questions/greetings -> only text. Never use "..." placeholders. Websites/UI without a backend: plain index.html + style.css + script.js, NO package.json (instant live preview). Node: package.json with "type":"module" and a "start" script, minimal deps. Other languages: entry point in the file to run. If code is SELECTED, apply the request to it unless told otherwise; prefer editing the OPEN FILE. Edit the existing project, don't restart it. No secrets, no destructive commands. Unclear/unsafe -> explain in text, no files.`;

/** Added for students on an assignment where the teacher allows hints only. */
const HINTS_INSTRUCTION = `
TEACHING MODE (a student's assignment; the teacher allows hints only): never return fileTree or deletedFiles, and never write the solution or large code blocks. Help the student learn: explain concepts and errors, ask guiding questions, point to the line or idea to look at, and give the next small step. Short snippets (<=3 lines) only to show syntax, never the answer.`;

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
    // Configuration problems (bad key, model access) are logged for us, not shown to users
    return "Vex AI is unavailable right now. Please try again later.";
};

/**
 * Replies that are errors, not answers: they don't cost a question and are
 * left out of the AI's chat history. Also matches older wordings saved in chats.
 */
export const AI_ERROR_REPLY = /^(AI failed|AI returned an empty|Vex AI (has reached|is busy|is unavailable|couldn't))/;

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
    hintsOnly = false,
    task,
    route,
    thinkingBudget = 512,
}: {
    prompt: string;
    files?: Record<string, string>;
    history?: ChatTurn[];
    memory?: string;
    focus?: EditorFocus;
    /** Teach instead of writing code (assignment rule "hints"). */
    hintsOnly?: boolean;
    /** The assignment the student is working on. */
    task?: string;
    /** Model groups to try, best first (from the user's plan). */
    route?: ModelGroup[];
    /** Thinking tokens for Gemini 2.5 models (from the user's plan). */
    thinkingBudget?: number;
}): Promise<AiResponse> => {
    // Stable → variable order (helps prefix caching): task, memory, files, chat, focus, request
    const context = [
        task?.trim() ? `ASSIGNMENT:\n${task.trim().slice(0, 2000)}` : "",
        memory.trim() ? `PROJECT MEMORY:\n${memory.trim()}` : "",
        files ? `CONTEXT (current project):\n${buildProjectContext(files, { prompt, activeFile: focus.activeFile })}` : "",
        history.length ? `RECENT CHAT:\n${buildHistory(history)}` : "",
        buildFocus(focus),
        `REQUEST:\n${prompt}`,
    ].filter(Boolean).join("\n\n");
    const system = hintsOnly ? SYSTEM_INSTRUCTION + HINTS_INSTRUCTION : SYSTEM_INSTRUCTION;

    const ask = async ({ provider, model }: Target): Promise<string> => {
        if (provider !== "gemini") return chatCompletion(provider, model, system, context, { json: true, maxTokens: 8192 });
        const response = await ai.models.generateContent({
            model,
            contents: [{ role: "user", parts: [{ text: context }] }],
            config: {
                systemInstruction: system,
                responseMimeType: "application/json",
                // A small thinking budget keeps answers fast while still
                // planning multi-file changes; Pro and Premium think longer
                ...thinking(model, thinkingBudget),
            },
        });
        return response.text ?? "";
    };

    try {
        return await withRoute(async (target) => {
            let raw: string;
            try {
                raw = await ask(target);
            } catch (err) {
                // One retry for transient Gemini overloads (free providers: next model)
                if (target.provider !== "gemini" || !isRetryable(err)) throw err;
                await new Promise((r) => setTimeout(r, 1500));
                raw = await ask(target);
            }
            // A missing or broken answer goes to the next model
            let parsed: AiResponse;
            try {
                if (!raw.includes("{")) throw new Error("not JSON");
                parsed = parseJsonResponse(raw);
            } catch {
                throw new ProviderError(`${target.model} returned invalid JSON`, 502);
            }
            if (typeof parsed?.text !== "string" || (!parsed.text.trim() && !parsed.fileTree)) {
                throw new ProviderError(`${target.model} returned no answer`, 502);
            }
            return { ...parsed, model: target.model };
        }, route);
    } catch (err) {
        console.error("AI Error:", err);
        return { text: friendlyAiError(err) };
    }
};

/** Turn a rough idea into a precise prompt (no thinking: this must feel instant). */
export const enhancePrompt = async (prompt: string, route: ModelGroup[] = ["free", "lite"]): Promise<string> => {
    const text = await withRoute(async ({ provider, model }) => {
        const out = provider === "gemini"
            ? (await ai.models.generateContent({
                model,
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                config: { systemInstruction: ENHANCE_INSTRUCTION, ...thinking(model, 0), maxOutputTokens: 300 },
            })).text ?? ""
            : await chatCompletion(provider, model, ENHANCE_INSTRUCTION, prompt, { maxTokens: 300 });
        if (!out.trim()) throw new ProviderError(`${model} returned an empty prompt`, 502);
        return out;
    }, route);

    return text.trim().replace(/^["']|["']$/g, "");
};
