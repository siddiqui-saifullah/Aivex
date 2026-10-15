/**
 * In-browser Node.js runtime (StackBlitz WebContainer), loaded on demand.
 *
 * WebContainers need cross-origin isolation (COOP/COEP headers, see
 * vercel.json / vite.config.ts) and only run Node.js; other languages go
 * through the server-side runner (services/runner.service.ts).
 */
import type { PreviewMessage, WebContainer, WebContainerProcess } from "@webcontainer/api";
import type { WebContainerTree } from "../types";

let webcontainerInstance: WebContainer | null = null;
let bootPromise: Promise<WebContainer> | null = null;
let runningProcess: WebContainerProcess | null = null;
let listenersAttached = false;
// Latest callbacks; the container listeners are attached once, so they must
// not capture a stale run's handlers
let previewReadyHandler: ((info: { port: number; url: string }) => void) | undefined;
let previewErrorHandler: ((message: string) => void) | undefined;
// package.json that dependencies were last installed for
let installedPackageJson: string | null = null;

/* Browser-only WebContainer loader (boots once, shared by every caller) */
export const getWebContainer = async (): Promise<WebContainer> => {
    if (typeof window === "undefined") {
        throw new Error("WebContainer can only run in the browser");
    }

    if (webcontainerInstance) return webcontainerInstance;

    bootPromise ??= import("@webcontainer/api")
        .then(({ WebContainer }) =>
            WebContainer.boot({
                coep: "require-corp",
                // Lets us show *why* a preview is blank instead of a white screen
                forwardPreviewErrors: "exceptions-only",
            }),
        )
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
            // Invalid JSON: npm will report it
            return ["npm", ["start"]];
        }
    }

    for (const entry of ["index.js", "server.js", "app.js", "main.js", "index.mjs"]) {
        if (tree[entry] && "file" in tree[entry]) return ["node", [entry]];
    }
    return null;
};

const hasNodeModules = async (webContainer: WebContainer) => {
    try {
        await webContainer.fs.readdir("node_modules");
        return true;
    } catch {
        return false;
    }
};

const formatPreviewError = (message: PreviewMessage) => {
    if ("message" in message) return message.message;
    if ("args" in message) return message.args.map(String).join(" ");
    return "Unknown error in the preview";
};

export type RunStepId = "mount" | "install" | "start" | "ready";
export type RunStepStatus = "pending" | "active" | "done" | "skipped" | "error";

export interface RunCallbacks {
    /** Progress of each stage, for the run loader. */
    onStep?: (step: RunStepId, status: RunStepStatus, detail?: string) => void;
    onPreviewReady?: (info: { port: number; url: string }) => void;
    /** Raw process output (npm install + the app itself). */
    onOutput?: (chunk: string) => void;
    /** The started app process exited (crash or normal end). */
    onExit?: (code: number) => void;
    /** Uncaught errors thrown inside the preview page (the usual cause of a blank preview). */
    onPreviewError?: (message: string) => void;
}

/** Mount files, install dependencies if needed and start the app. Returns false on failure. */
export const runWebcontainer = async (
    webContainer: WebContainer | null,
    fileTree: WebContainerTree | null,
    { onStep, onPreviewReady, onOutput, onExit, onPreviewError }: RunCallbacks = {},
): Promise<boolean> => {
    if (!webContainer || !fileTree) return false;

    previewReadyHandler = onPreviewReady;
    previewErrorHandler = onPreviewError;
    let step: RunStepId = "mount";

    try {
        await stopWebcontainer();

        onStep?.("mount", "active");
        await webContainer.mount(fileTree);
        onStep?.("mount", "done");

        const packageJson = readPackageJson(fileTree);

        step = "install";
        if (!packageJson) {
            onStep?.("install", "skipped", "No package.json");
        } else if (packageJson === installedPackageJson && (await hasNodeModules(webContainer))) {
            onStep?.("install", "skipped", "Dependencies unchanged");
        } else {
            onStep?.("install", "active");
            onOutput?.("$ npm install\n");
            // Plain `npm install`: WebContainer's npm doesn't support every CLI flag
            const installProcess = await webContainer.spawn("npm", ["install"]);
            pipeOutput(installProcess, onOutput);
            const installExitCode = await installProcess.exit;
            if (installExitCode !== 0) {
                onStep?.("install", "error", `npm install failed (exit code ${installExitCode})`);
                return false;
            }
            installedPackageJson = packageJson;
            onStep?.("install", "done");
        }

        step = "start";
        const command = getStartCommand(fileTree, packageJson);
        if (!command) {
            onStep?.("start", "error", 'No start script. Add "start" to package.json or create index.js');
            return false;
        }

        const [cmd, args] = command;
        onStep?.("start", "active", `${cmd} ${args.join(" ")}`);
        onOutput?.(`$ ${cmd} ${args.join(" ")}\n`);
        const process = await webContainer.spawn(cmd, args);
        runningProcess = process;
        pipeOutput(process, onOutput);
        onStep?.("start", "done", `${cmd} ${args.join(" ")}`);
        onStep?.("ready", "active");

        process.exit.then((code) => {
            // Ignore processes we stopped ourselves (Stop / Update): only the
            // current app exiting on its own is reported
            if (runningProcess !== process) return;
            runningProcess = null;
            onExit?.(code);
        });

        if (!listenersAttached) {
            // `server-ready` fires once the server actually answers requests;
            // opening the preview earlier is what shows a blank page
            webContainer.on("server-ready", (port, url) => {
                if (runningProcess) previewReadyHandler?.({ port, url });
            });
            webContainer.on("preview-message", (message) => {
                previewErrorHandler?.(formatPreviewError(message));
            });
            listenersAttached = true;
        }
        return true;
    } catch (error) {
        console.error(error);
        onStep?.(step, "error", error instanceof Error ? error.message : String(error));
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
