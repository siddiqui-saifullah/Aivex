import * as Y from "yjs";
import Project from "../models/project.model.js";
import { fromStoredFiles } from "../utils/fileStore.js";

/*
 * Live collaborative editing.
 *
 * Every open project has one shared Yjs document on the server: a map of
 * file path -> Y.Text. Editors sync with it over the project's socket room,
 * so concurrent edits from teammates merge instead of overwriting each
 * other. Saving still goes through the normal "save files" API; the shared
 * document only holds the live (possibly unsaved) state while people are
 * connected, and is dropped a little after the last one leaves.
 */

const FILES_KEY = "files";
/** Origin for changes made by the server itself (AI edits). */
export const SERVER_ORIGIN = "server";
const IDLE_DROP_MS = 60_000;
/** Largest single update accepted from a client. */
export const MAX_UPDATE_BYTES = 2 * 1024 * 1024;

interface CollabRoom {
    doc: Y.Doc;
    sockets: Set<string>;
    dropTimer?: ReturnType<typeof setTimeout>;
}

const rooms = new Map<string, Promise<CollabRoom>>();

export const getFilesMap = (doc: Y.Doc) => doc.getMap<Y.Text>(FILES_KEY);

/**
 * Replace `text`'s contents with `next`, touching only the part that changed
 * (common prefix and suffix kept) so collaborators' cursors stay put.
 */
export const setText = (text: Y.Text, next: string) => {
    const current = text.toString();
    if (current === next) return;
    let start = 0;
    const max = Math.min(current.length, next.length);
    while (start < max && current[start] === next[start]) start++;
    let end = 0;
    while (
        end < max - start &&
        current[current.length - 1 - end] === next[next.length - 1 - end]
    ) end++;
    const removeLength = current.length - start - end;
    if (removeLength > 0) text.delete(start, removeLength);
    const insert = next.slice(start, next.length - end);
    if (insert) text.insert(start, insert);
};

const loadRoom = async (projectId: string): Promise<CollabRoom> => {
    const project = await Project.findById(projectId).select("files").lean();
    const doc = new Y.Doc();
    const files = getFilesMap(doc);
    doc.transact(() => {
        for (const [path, contents] of Object.entries(fromStoredFiles(project?.files))) {
            files.set(path, new Y.Text(contents));
        }
    }, SERVER_ORIGIN);
    return { doc, sockets: new Set() };
};

/** Join a project's shared document (loaded from the database on first use). */
export const joinRoom = async (projectId: string, socketId: string) => {
    let pending = rooms.get(projectId);
    if (!pending) {
        pending = loadRoom(projectId);
        rooms.set(projectId, pending);
        pending.catch(() => rooms.delete(projectId));
    }
    const room = await pending;
    clearTimeout(room.dropTimer);
    room.sockets.add(socketId);
    return room;
};

export const leaveRoom = async (projectId: string, socketId: string) => {
    const pending = rooms.get(projectId);
    if (!pending) return;
    const room = await pending.catch(() => null);
    if (!room) return;
    room.sockets.delete(socketId);
    if (room.sockets.size === 0) {
        // Keep it briefly so a quick reload/reconnect doesn't lose unsaved edits
        room.dropTimer = setTimeout(() => {
            if (room.sockets.size === 0) {
                room.doc.destroy();
                rooms.delete(projectId);
            }
        }, IDLE_DROP_MS);
    }
};

/** The live document of a project, if anyone has it open. */
export const getRoom = async (projectId: string) => {
    const pending = rooms.get(projectId);
    return pending ? pending.catch(() => null) : null;
};

/**
 * Apply file changes (e.g. from the AI) to the live document and return the
 * Yjs update to broadcast, or null if nothing changed.
 */
export const applyFileChanges = (
    doc: Y.Doc,
    changed: Record<string, string>,
    deleted: string[],
): Uint8Array | null => {
    const updates: Uint8Array[] = [];
    const collect = (update: Uint8Array) => updates.push(update);
    doc.on("update", collect);
    try {
        const files = getFilesMap(doc);
        doc.transact(() => {
            for (const path of deleted) {
                for (const key of [...files.keys()]) {
                    if (key === path || key.startsWith(`${path}/`)) files.delete(key);
                }
            }
            for (const [path, contents] of Object.entries(changed)) {
                const text = files.get(path);
                if (text) setText(text, contents);
                else files.set(path, new Y.Text(contents));
            }
        }, SERVER_ORIGIN);
    } finally {
        doc.off("update", collect);
    }
    return updates.length ? Y.mergeUpdates(updates) : null;
};

/** Accept only binary payloads of a sane size. */
export const toUpdate = (raw: unknown): Uint8Array | null => {
    if (!(raw instanceof Uint8Array) && !(raw instanceof ArrayBuffer)) return null;
    const bytes = raw instanceof ArrayBuffer ? new Uint8Array(raw) : raw;
    return bytes.byteLength > 0 && bytes.byteLength <= MAX_UPDATE_BYTES ? bytes : null;
};
