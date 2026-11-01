import mongoose, { type Types } from "mongoose";
import Assignment from "../models/assignment.model.js";
import Classroom from "../models/classroom.model.js";
import Submission from "../models/submission.model.js";
import JourneyEvent from "../models/journeyEvent.model.js";
import userModel from "../models/user.model.js";
import AppError from "../errors/AppError.js";
import { fromStoredFiles } from "../utils/fileStore.js";

type Id = Types.ObjectId | string;

/*
 * Copy check. Each student's latest submission is turned into a stream of
 * tokens where names, numbers and strings are replaced by placeholders and
 * comments and spacing are dropped, so renaming variables or reformatting
 * doesn't hide copied code. Runs of K tokens are hashed and a few of them
 * kept (winnowing, as in MOSS). Two submissions are as similar as the share
 * of the smaller one's fingerprints they have in common. The starter code
 * is left out, since everyone starts from it.
 */

const K = 8; // tokens per fingerprint
const W = 4; // winnowing window
const MIN_FINGERPRINTS = 12; // too little code to judge
const REPORT_FROM = 0.4;
const CODE_FILE = /\.(c|h|cpp|cc|cxx|hpp|java|py|js|jsx|ts|tsx|go|rs|cs|kt|php|rb|html|css)$/i;

const KEYWORDS = new Set((
    "auto break case char const continue default do double else enum extern float for goto if inline int long register "
    + "restrict return short signed sizeof static struct switch typedef union unsigned void volatile while bool true false "
    + "class public private protected virtual template typename namespace using new delete this try catch throw nullptr "
    + "include define ifdef ifndef endif std cout cin endl printf scanf main string vector map set function let var import "
    + "export from def lambda elif none null undefined await async yield in of is not and or pass with as"
).split(" "));

interface Token { t: string; line: number }

/** Tokens with names, literals, comments and whitespace normalised away. */
export const tokenize = (code: string): Token[] => {
    const tokens: Token[] = [];
    let line = 1;
    let i = 0;
    const n = code.length;
    while (i < n) {
        const c = code[i];
        if (c === "\n") { line++; i++; continue; }
        if (/\s/.test(c)) { i++; continue; }
        // Comments: // # (Python, preprocessor lines are kept below) and /* */
        if (c === "/" && code[i + 1] === "/") { while (i < n && code[i] !== "\n") i++; continue; }
        if (c === "/" && code[i + 1] === "*") {
            i += 2;
            while (i < n && !(code[i] === "*" && code[i + 1] === "/")) { if (code[i] === "\n") line++; i++; }
            i += 2;
            continue;
        }
        if (c === "\"" || c === "'" || c === "`") {
            const start = line;
            i++;
            while (i < n && code[i] !== c) { if (code[i] === "\\") i++; else if (code[i] === "\n") line++; i++; }
            i++;
            tokens.push({ t: "S", line: start });
            continue;
        }
        if (/[0-9]/.test(c)) {
            while (i < n && /[0-9a-fA-FxX._]/.test(code[i])) i++;
            tokens.push({ t: "N", line });
            continue;
        }
        if (/[A-Za-z_$]/.test(c)) {
            let j = i;
            while (j < n && /[A-Za-z0-9_$]/.test(code[j])) j++;
            const word = code.slice(i, j);
            tokens.push({ t: KEYWORDS.has(word) ? word : "I", line });
            i = j;
            continue;
        }
        tokens.push({ t: c, line });
        i++;
    }
    return tokens;
};

const hash = (s: string) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
};

/** Winnowed fingerprints: hash -> the lines it covers. */
export const fingerprints = (code: string) => {
    const tokens = tokenize(code);
    const grams: { h: number; from: number; to: number }[] = [];
    for (let i = 0; i + K <= tokens.length; i++) {
        grams.push({ h: hash(tokens.slice(i, i + K).map((x) => x.t).join(" ")), from: tokens[i].line, to: tokens[i + K - 1].line });
    }
    const picked = new Map<number, { from: number; to: number }[]>();
    // In every window of W fingerprints keep the smallest (rightmost on ties)
    const windows = Math.max(0, grams.length - W + 1) || (grams.length ? 1 : 0);
    let last = -1;
    for (let i = 0; i < windows; i++) {
        let at = i;
        for (let j = i + 1; j < Math.min(grams.length, i + W); j++) if (grams[j].h <= grams[at].h) at = j;
        if (at === last) continue;
        last = at;
        const g = grams[at];
        picked.set(g.h, [...(picked.get(g.h) ?? []), { from: g.from, to: g.to }]);
    }
    return picked;
};

/** The code files of a snapshot, in a stable order. */
const codeOf = (stored: unknown) => {
    const files = fromStoredFiles(stored as Parameters<typeof fromStoredFiles>[0]);
    return Object.keys(files)
        .filter((p) => CODE_FILE.test(p))
        .sort()
        .map((path) => ({ path, content: files[path] ?? "" }));
};

/** One combined fingerprint set per submission (file:line for highlighting). */
const fingerprintFiles = (files: { path: string; content: string }[], exclude?: Set<number>) => {
    const all = new Map<number, { path: string; from: number; to: number }[]>();
    for (const f of files) {
        for (const [h, spans] of fingerprints(f.content)) {
            if (exclude?.has(h)) continue;
            all.set(h, [...(all.get(h) ?? []), ...spans.map((s) => ({ path: f.path, ...s }))]);
        }
    }
    return all;
};

const loadForTeacher = async (assignmentId: string, userId: Id) => {
    if (!mongoose.Types.ObjectId.isValid(assignmentId)) throw new AppError("Invalid assignment id", 400);
    const assignment = await Assignment.findById(assignmentId).select("classroom starterFiles title").lean();
    if (!assignment) throw new AppError("Assignment not found", 404);
    const classroom = await Classroom.findById(assignment.classroom).select("teacher").lean();
    if (!classroom || String(classroom.teacher) !== String(userId)) throw new AppError("Only the teacher can check for copying", 403);
    return assignment;
};

const starterHashes = (starterFiles: unknown) => new Set(fingerprintFiles(codeOf(starterFiles)).keys());

/** Every pair of students whose latest submissions share a lot of code. */
export const similarityReport = async ({ assignmentId, userId }: { assignmentId: string; userId: Id }) => {
    const assignment = await loadForTeacher(assignmentId, userId);
    const rows = await Submission.find({ assignment: assignment._id }).select("student version files").lean();
    const latest = new Map<string, (typeof rows)[number]>();
    for (const r of rows) {
        const k = String(r.student);
        if (!latest.has(k) || latest.get(k)!.version < r.version) latest.set(k, r);
    }

    const starter = starterHashes(assignment.starterFiles);
    const prints = [...latest.values()].map((s) => ({
        submission: s,
        hashes: new Set(fingerprintFiles(codeOf(s.files), starter).keys()),
    }));
    const usable = prints.filter((p) => p.hashes.size >= MIN_FINGERPRINTS);

    const pairs: { a: number; b: number; score: number; shared: number }[] = [];
    for (let i = 0; i < usable.length; i++) {
        for (let j = i + 1; j < usable.length; j++) {
            const [small, big] = usable[i].hashes.size <= usable[j].hashes.size ? [usable[i], usable[j]] : [usable[j], usable[i]];
            let shared = 0;
            for (const h of small.hashes) if (big.hashes.has(h)) shared++;
            const score = shared / small.hashes.size;
            if (score >= REPORT_FROM) pairs.push({ a: i, b: j, score, shared });
        }
    }
    pairs.sort((x, y) => y.score - x.score);

    // Who they are, and how they worked (from the coding journey)
    const studentIds = usable.map((u) => u.submission.student);
    const [users, journey] = await Promise.all([
        userModel.find({ _id: { $in: studentIds } }).select("name username").lean(),
        JourneyEvent.find({ assignment: assignment._id, student: { $in: studentIds }, type: { $in: ["save", "ai-edit"] } })
            .select("student type added")
            .lean(),
    ]);
    const userById = new Map(users.map((u) => [String(u._id), u]));
    const signals = new Map<string, { biggestSave: number; aiEdits: number; saves: number }>();
    for (const e of journey) {
        const k = String(e.student);
        const s = signals.get(k) ?? { biggestSave: 0, aiEdits: 0, saves: 0 };
        if (e.type === "save") {
            s.saves++;
            s.biggestSave = Math.max(s.biggestSave, e.added ?? 0);
        } else s.aiEdits++;
        signals.set(k, s);
    }
    const who = (i: number) => {
        const sub = usable[i].submission;
        const u = userById.get(String(sub.student));
        return {
            studentId: sub.student,
            name: u?.name ?? "Former student",
            username: u?.username ?? "",
            submissionId: sub._id,
            version: sub.version,
            journey: signals.get(String(sub.student)) ?? { biggestSave: 0, aiEdits: 0, saves: 0 },
        };
    };

    return {
        compared: usable.length,
        skipped: prints.length - usable.length,
        pairs: pairs.slice(0, 100).map((p) => ({ score: Math.round(p.score * 100), a: who(p.a), b: who(p.b) })),
    };
};

/** Two submissions with the lines they share marked. */
export const compareSubmissions = async ({ assignmentId, userId, a, b }: { assignmentId: string; userId: Id; a: string; b: string }) => {
    const assignment = await loadForTeacher(assignmentId, userId);
    if (!mongoose.Types.ObjectId.isValid(a) || !mongoose.Types.ObjectId.isValid(b)) throw new AppError("Invalid submission id", 400);
    const subs = await Submission.find({ _id: { $in: [a, b] }, assignment: assignment._id }).select("student version files").lean();
    const subA = subs.find((s) => String(s._id) === a);
    const subB = subs.find((s) => String(s._id) === b);
    if (!subA || !subB) throw new AppError("Submission not found", 404);

    const starter = starterHashes(assignment.starterFiles);
    const filesA = codeOf(subA.files);
    const filesB = codeOf(subB.files);
    const printsA = fingerprintFiles(filesA, starter);
    const printsB = fingerprintFiles(filesB, starter);

    const mark = (files: { path: string; content: string }[], mine: typeof printsA, theirs: typeof printsB) => {
        const lines = new Map<string, Set<number>>();
        for (const [h, spans] of mine) {
            if (!theirs.has(h)) continue;
            for (const s of spans) {
                const set = lines.get(s.path) ?? new Set<number>();
                for (let l = s.from; l <= s.to; l++) set.add(l);
                lines.set(s.path, set);
            }
        }
        return files.map((f) => ({ path: f.path, content: f.content, matched: [...(lines.get(f.path) ?? [])].sort((x, y) => x - y) }));
    };

    const users = await userModel.find({ _id: { $in: [subA.student, subB.student] } }).select("name username").lean();
    const nameOf = (id: Types.ObjectId) => users.find((u) => String(u._id) === String(id));
    return {
        a: { submissionId: subA._id, version: subA.version, student: nameOf(subA.student) ?? null, files: mark(filesA, printsA, printsB) },
        b: { submissionId: subB._id, version: subB.version, student: nameOf(subB.student) ?? null, files: mark(filesB, printsB, printsA) },
    };
};
