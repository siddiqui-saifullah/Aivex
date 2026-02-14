// These code are commented for Vercel , and will not work on any free tire production use it when u are use paid , or devlopment env

// import { WebContainer } from "@webcontainer/api";

// let webcontainerInstance = null;

// export const getWebContainer = async () => {
//     if (webcontainerInstance === null) {
//         webcontainerInstance = await WebContainer.boot();
//     }

//     return webcontainerInstance;
// }



// /**
//  * Utility to mount files, install deps, and start the server
//  * @param {object} webContainer - The WebContainer instance
//  * @param {object} fileTree - The file tree structure to mount
//  * @param {function} onPreviewReady - Callback when server is ready with URL
//  * @param {function} onProgress - Callback for progress updates
//  */

// let runningProcess = null;
// let portListenerAttached = null; // Per-container instance instead of global

// export const runWebcontainer = async (
//     webContainer,
//     fileTree,
//     onPreviewReady,
//     onProgress
// ) => {
//     if (!webContainer || !fileTree) {
//         console.warn("WebContainer or fileTree missing");
//         return;
//     }

//     /* Reset port listener flag for this container instance */
//     portListenerAttached = null;

//     /* ---------------- STOP PREVIOUS SERVER ---------------- */
//     if (runningProcess) {
//         console.log("[WebContainer] Stopping previous server...");
//         try {
//             runningProcess.kill(); // STOPS NODE
//         } catch (err) {
//             console.warn("Failed to kill previous process", err);
//         }
//         runningProcess = null;
//     }

//     onProgress?.("Mounting files...");
//     console.log("[WebContainer] Mounting files...");
//     await webContainer.mount(fileTree);

//     onProgress?.("Installing dependencies...");
//     console.log("[WebContainer] Running 'npm install'...");
//     const installProcess = await webContainer.spawn("npm", ["install"]);

//     installProcess.output.pipeTo(
//         new WritableStream({
//             write(data) {
//                 console.log("[npm install]", data);
//             },
//         })
//     );

//     const installExitCode = await installProcess.exit;
//     if (installExitCode !== 0) {
//         console.error("Install failed", installExitCode);
//         onProgress?.("Install failed");
//         return;
//     }

//     onProgress?.("Starting development server...");
//     console.log("[WebContainer] Running 'npm start'...");
//     runningProcess = await webContainer.spawn("npm", ["start"]);

//     runningProcess.output.pipeTo(
//         new WritableStream({
//             write(data) {
//                 console.log("[npm start]", data);
//             },
//         })
//     );

//     /* ---------------- PORT LISTENER (ATTACH ONCE) ---------------- */
//     if (!portListenerAttached) {
//         webContainer.on("port", (port, type, url) => {
//             if (type === "open") {
//                 console.log("Server listening on:", url, port);
//                 onProgress?.("Server running...");
//                 onPreviewReady?.({ port, url });
//             }
//         });
//         portListenerAttached = true;
//     }
// };

// /**
//  * Stop the currently running server process
//  */
// export const stopWebcontainer = () => {
//     if (runningProcess) {
//         console.log("[WebContainer] Stopping server...");
//         try {
//             runningProcess.kill();
//             runningProcess = null;
//             return true;
//         } catch (err) {
//             console.error("Failed to kill server process", err);
//             return false;
//         }
//     }
//     return true;
// };


//this code is for dynamic import

let webcontainerInstance = null;
let runningProcess = null;
let portListenerAttached = false;




/* Browser-only WebContainer loader */
export const getWebContainer = async () => {
    if (typeof window === "undefined") {
        throw new Error("WebContainer can only run in the browser");
    }

    if (webcontainerInstance) return webcontainerInstance;

    const { WebContainer } = await import("@webcontainer/api"); //dynamic import
    webcontainerInstance = await WebContainer.boot();

    return webcontainerInstance;
};

export const runWebcontainer = async (
    webContainer,
    fileTree,
    onPreviewReady,
    onProgress
) => {
    try {
        if (!webContainer || !fileTree) return;

        /* Stop previous process */
        if (runningProcess) {
            console.log("Stopping previous process...");
            try {
                await runningProcess.kill();
            } catch (e) { console.error(e) }
            runningProcess = null;
        }

        onProgress?.("Mounting files...");
        await webContainer.mount(fileTree);

        onProgress?.("Installing dependencies...");
        const installProcess = await webContainer.spawn("npm", ["install"]);
        await installProcess.exit;

        onProgress?.("Starting dev server...");
        runningProcess = await webContainer.spawn("npm", ["start"]);

        if (!portListenerAttached) {
            webContainer.on("port", (port, type, url) => {

                if (type === "open" && runningProcess) {
                    onPreviewReady?.({ port, url });
                }
            });
            portListenerAttached = true;
        }
    } catch (error) {
        console.log(error);
        onProgress?.("Failed To Start")
    }
};

export const stopWebcontainer = async () => {
    if (runningProcess) {
        try {
            await runningProcess.kill();
            runningProcess = null;
            return true;
        } catch (err) {
            return false;
        }
    }
    return true;
};

//this code is for dynamic import
