import { WebContainer } from "@webcontainer/api";

let webcontainerInstance = null;

export const getWebContainer = async () => {
    if (webcontainerInstance === null) {
        webcontainerInstance = await WebContainer.boot();
    }

    return webcontainerInstance;
}



/**
 * Utility to mount files, install deps, and start the server
 * @param {object} webContainer - The WebContainer instance
 * @param {object} fileTree - The file tree structure to mount
 * @param {function} onPreviewReady - Callback when server is ready with URL
 * @param {function} onProgress - Callback for progress updates
 */

let runningProcess = null;
let portListenerAttached = null; // Per-container instance instead of global

export const runWebcontainer = async (
    webContainer,
    fileTree,
    onPreviewReady,
    onProgress
) => {
    if (!webContainer || !fileTree) {
        console.warn("WebContainer or fileTree missing");
        return;
    }

    /* Reset port listener flag for this container instance */
    portListenerAttached = null;

    /* ---------------- STOP PREVIOUS SERVER ---------------- */
    if (runningProcess) {
        console.log("[WebContainer] Stopping previous server...");
        try {
            runningProcess.kill(); // 🔥 THIS STOPS NODE
        } catch (err) {
            console.warn("Failed to kill previous process", err);
        }
        runningProcess = null;
    }

    onProgress?.("Mounting files...");
    console.log("[WebContainer] Mounting files...");
    await webContainer.mount(fileTree);

    onProgress?.("Installing dependencies...");
    console.log("[WebContainer] Running 'npm install'...");
    const installProcess = await webContainer.spawn("npm", ["install"]);

    installProcess.output.pipeTo(
        new WritableStream({
            write(data) {
                console.log("[npm install]", data);
            },
        })
    );

    const installExitCode = await installProcess.exit;
    if (installExitCode !== 0) {
        console.error("Install failed", installExitCode);
        onProgress?.("Install failed");
        return;
    }

    onProgress?.("Starting development server...");
    console.log("[WebContainer] Running 'npm start'...");
    runningProcess = await webContainer.spawn("npm", ["start"]);

    runningProcess.output.pipeTo(
        new WritableStream({
            write(data) {
                console.log("[npm start]", data);
            },
        })
    );

    /* ---------------- PORT LISTENER (ATTACH ONCE) ---------------- */
    if (!portListenerAttached) {
        webContainer.on("port", (port, type, url) => {
            if (type === "open") {
                console.log("Server listening on:", url, port);
                onProgress?.("Server running...");
                onPreviewReady?.({ port, url });
            }
        });
        portListenerAttached = true;
    }
};

/**
 * Stop the currently running server process
 */
export const stopWebcontainer = () => {
    if (runningProcess) {
        console.log("[WebContainer] Stopping server...");
        try {
            runningProcess.kill();
            runningProcess = null;
            return true;
        } catch (err) {
            console.error("Failed to kill server process", err);
            return false;
        }
    }
    return true;
};

