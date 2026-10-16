#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { basename, dirname, relative } from "node:path";
import { Compiler, CompilerError, type Language } from "./index.js";
import { extensionOf, SOURCE_EXTENSIONS } from "./validate.js";

const USAGE = `Usage: aivex-cc [options] <entry file> [other sources/headers...]

Compiles and runs C/C++ in a Docker sandbox (no network, limited CPU/memory/time).

Options:
  --lang c|cpp        Language (default: from the entry file's extension)
  --stdin <file>      Feed this file to the program's stdin (default: piped stdin, if any)
  --flag <flag>       Extra compiler flag, repeatable (e.g. --flag -O0 --flag -std=c++17)
  --image <image>     Docker image with gcc/g++ (default: gcc:14)
  --timeout <ms>      Run time limit (default: 5000)
  --pull              Pull the image first if it is missing
  -h, --help          Show this help`;

const readStdin = async () => {
    if (process.stdin.isTTY) return "";
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks).toString("utf8");
};

const main = async () => {
    const args = process.argv.slice(2);
    const paths: string[] = [];
    const flags: string[] = [];
    let lang: string | undefined;
    let stdinFile: string | undefined;
    let image: string | undefined;
    let timeout: number | undefined;
    let pull = false;

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        const value = () => {
            const v = args[++i];
            if (v === undefined) throw new Error(`${arg} needs a value`);
            return v;
        };
        if (arg === "-h" || arg === "--help") { console.log(USAGE); return 0; }
        else if (arg === "--lang") lang = value();
        else if (arg === "--stdin") stdinFile = value();
        else if (arg === "--flag") flags.push(value());
        else if (arg === "--image") image = value();
        else if (arg === "--timeout") timeout = Number(value());
        else if (arg === "--pull") pull = true;
        else if (arg.startsWith("-")) throw new Error(`Unknown option ${arg}`);
        else paths.push(arg);
    }

    if (paths.length === 0) {
        console.error(USAGE);
        return 2;
    }

    const language = (lang ?? (SOURCE_EXTENSIONS.c.includes(extensionOf(paths[0])) ? "c" : "cpp")) as Language;
    // Name files relative to the entry file's folder so #include "lib/x.h" resolves
    const root = dirname(paths[0]);
    const files = await Promise.all(paths.map(async (p) => ({
        name: relative(root, p).startsWith("..") ? basename(p) : relative(root, p),
        content: await readFile(p, "utf8"),
    })));
    const stdin = stdinFile ? await readFile(stdinFile, "utf8") : await readStdin();

    const compiler = new Compiler({ image, limits: timeout ? { runTimeoutMs: timeout } : undefined });
    if (pull) await compiler.prepare();

    const result = await compiler.run({
        language,
        files,
        stdin,
        flags,
        onStdout: (c) => process.stdout.write(c),
        onStderr: (c) => process.stderr.write(c),
    });

    if (result.compile.stderr) process.stderr.write(result.compile.stderr);
    if (!result.run) return result.compile.code ?? 1;
    if (result.run.timedOut) console.error(`\n[time limit exceeded]`);
    else if (result.run.signal) console.error(`\n[killed by ${result.run.signal}]`);
    return result.run.code ?? 1;
};

main().then(
    (code) => { process.exitCode = code; },
    (err) => {
        console.error(err instanceof CompilerError ? `aivex-cc: ${err.message}` : err);
        process.exitCode = err instanceof CompilerError && err.code === "INVALID_INPUT" ? 2 : 1;
    },
);
