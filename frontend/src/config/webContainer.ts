/**
 * In-browser Node.js runtime (StackBlitz WebContainer), loaded on demand.
 *
 * WebContainers need cross-origin isolation (COOP/COEP headers, see
 * vercel.json / vite.config.ts) and only run Node.js; other languages go
 * through the server-side runner (services/runner.service.ts).
 */
import type { WebContainer, WebContainerProcess } from "@webcontainer/api";
import type { WebContainerTree } from "../types";

let webcontainerInstance: WebContainer | null = null;
let bootPromise: Promise<WebContainer> | null = null;
let runningProcess: WebContainerProcess | null = null;
let portListenerAttached = false;
// Latest callback; the port listener is attached once, so it must not capture a stale one
let previewReadyHandler: ((info: { port: number; url: string }) => void) | undefined;
// package.json that dependencies were last installed for; reinstall only when it changes
let installedPackageJson: string | null = null;

/* Browser-only WebContainer loader (boots once, shared by every caller) */
export const getWebContainer = async (): Promise<WebContainer> => {
    if (typeof window === "undefined") {
        throw new Error("WebContainer can only run in the browser");
    }

    if (webcontainerInstance) return webcontainerInstance;

    bootPromise ??= import("@webcontainer/api")
        .then(({ WebContainer }) => WebContainer.boot())
        .then((instance) => {
            webcontainerInstance = instance;
            return instance;
        })
        .catch((err) => {
            bootPromise = null;
            throw err;
        });

    return bootPromise;
};

const pipeOutput = (process: WebContainerProcess, onOutput?: (chunk: string) => void) => {
    if (!onOutput) return;
    process.output
        .pipeTo(
            new WritableStream({
                write(data) {
                    onOutput(data);
                },
            }),
        )
        .catch(() => {
            /* stream closes when the process is killed */
        });
};

const readPackageJson = (tree: WebContainerTree): string | null => {
    const node = tree["package.json"];
    return node && "file" in node ? node.file.contents : null;
};

/** Pick what to start: `npm start` when defined, else `node <main | index.js>`. */
const getStartCommand = (tree: WebContainerTree, packageJson: string | null): [string, string[]] | null => {
    if (packageJson) {
        try {
            const pkg = JSON.parse(packageJson) as { scripts?: Record<string, string>; main?: string };
            if (pkg.scripts?.start) return ["npm", ["start"]];
            if (pkg.scripts?.dev) return ["npm", ["run", "dev"]];
            if (pkg.main && tree[pkg.main]) return ["node", [pkg.main]];
        } catch {
            // Invalid JSON: npm will report it during install
            return ["npm", ["start"]];
        }
    }

    for (const entry of ["index.js", "server.js", "app.js", "main.js", "index.mjs"]) {
        if (tree[entry] && "file" in tree[entry]) return ["node", [entry]];
    }
    return null;
};

export interface RunCallbacks {
    onPreviewReady?: (info: { port: number; url: string }) => void;
    onProgress?: (message: string) => void;
    /** Raw process output (npm install + the app itself). */
    onOutput?: (chunk: string) => void;
    /** The started process exited (crash or normal end). */
    onExit?: (code: number) => void;
}

/** Mount files, install dependencies if needed and start the app. Returns false on failure. */
export const runWebcontainer = async (
    webContainer: WebContainer | null,
    fileTree: WebContainerTree | null,
    { onPreviewReady, onProgress, onOutput, onExit }: RunCallbacks = {},
): Promise<boolean> => {
    try {
        if (!webContainer || !fileTree) return false;

        previewReadyHandler = onPreviewReady;

        await stopWebcontainer();

        onProgress?.("Mounting files...");
        await webContainer.mount(fileTree);

        const packageJson = readPackageJson(fileTree);

        if (packageJson && packageJson !== installedPackageJson) {
            onProgress?.("Installing dependencies...");
            onOutput?.("$ npm install\n");
            // Skip audit/funding lookups and reuse cached packages: noticeably faster
            const installProcess = await webContainer.spawn("npm", [
                "install",
                "--prefer-offline",
                "--no-audit",
                "--no-fund",
                "--loglevel=error",
            ]);
            pipeOutput(installProcess, onOutput);
            const installExitCode = await installProcess.exit;
            if (installExitCode !== 0) {
                onProgress?.("Install failed");
                onOutput?.(`\nnpm install failed (exit code ${installExitCode})\n`);
                return false;
            }
            installedPackageJson = packageJson;
        } else if (packageJson) {
            onOutput?.("Dependencies unchanged, skipping npm install\n");
        }

        const command = getStartCommand(fileTree, packageJson);
        if (!command) {
            onProgress?.("Nothing to run");
            onOutput?.("No start script found. Add a \"start\" script to package.json or create index.js\n");
            return false;
        }

        const [cmd, args] = command;
        onProgress?.("Starting...");
        onOutput?.(`$ ${cmd} ${args.join(" ")}\n`);
        const process = await webContainer.spawn(cmd, args);
        runningProcess = process;
        pipeOutput(process, onOutput);

        process.exit.then((code) => {
            if (runningProcess === process) runningProcess = null;
            onExit?.(code);
        });

        if (!portListenerAttached) {
            webContainer.on("port", (port, type, url) => {
                if (type === "open" && runningProcess) {
                    previewReadyHandler?.({ port, url });
                }
            });
            portListenerAttached = true;
        }
        return true;
    } catch (error) {
        console.error(error);
        onProgress?.("Failed To Start");
        onOutput?.(`\n${error instanceof Error ? error.message : String(error)}\n`);
        return false;
    }
};

export const stopWebcontainer = async (): Promise<boolean> => {
    if (runningProcess) {
        try {
            const process = runningProcess;
            runningProcess = null;
            process.kill();
            return true;
        } catch {
            return false;
        }
    }
    return true;
};
