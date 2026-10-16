/**
 * Live collaborative editing (client side).
 *
 * The project's files live in a shared Yjs document (path -> Y.Text) that is
 * synced through the project's socket room. Edits from teammates merge
 * character by character instead of overwriting each other, and everyone's
 * cursor and open file are shared through Yjs "awareness".
 */
import * as Y from "yjs";
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from "y-protocols/awareness";
import type { Socket } from "socket.io-client";
import type { FlatFileTree } from "../types";
import { colorFor } from "../utils/userColor";

const REMOTE = "remote";
const LOCAL = "local";

export interface Peer {
  clientId: number;
  userId: string;
  name: string;
  color: string;
  /** File the peer has open. */
  file: string | null;
}

interface CollabHandlers {
  /** Files changed in the shared document (null = deleted). */
  onFilesChanged: (changes: Record<string, string | null>, remote: boolean) => void;
  /** First sync done: the shared document's files. */
  onReady: (files: FlatFileTree) => void;
  onPeersChanged: (peers: Peer[]) => void;
  onRemoteSaved: (username: string) => void;
}


/** Replace a Y.Text's contents, touching only the changed middle part. */
const setText = (text: Y.Text, next: string) => {
  const current = text.toString();
  if (current === next) return;
  let start = 0;
  const max = Math.min(current.length, next.length);
  while (start < max && current[start] === next[start]) start++;
  let end = 0;
  while (end < max - start && current[current.length - 1 - end] === next[next.length - 1 - end]) end++;
  const removeLength = current.length - start - end;
  if (removeLength > 0) text.delete(start, removeLength);
  const insert = next.slice(start, next.length - end);
  if (insert) text.insert(start, insert);
};

const toBytes = (data: unknown) =>
  data instanceof Uint8Array ? data : new Uint8Array(data as ArrayBuffer);

export class CollabSession {
  readonly doc = new Y.Doc();
  readonly awareness = new Awareness(this.doc);
  readonly files = this.doc.getMap<Y.Text>("files");
  ready = false;

  private styleEl: HTMLStyleElement | null = null;
  private socket: Socket;
  private handlers: CollabHandlers;

  constructor(socket: Socket, user: { id: string; name: string }, handlers: CollabHandlers) {
    this.socket = socket;
    this.handlers = handlers;
    this.awareness.setLocalStateField("user", { id: user.id, name: user.name, color: colorFor(user.id) });
    this.awareness.setLocalStateField("file", null);

    this.doc.on("update", this.onDocUpdate);
    this.files.observeDeep(this.onFilesObserved);
    this.awareness.on("update", this.onAwarenessUpdate);
    this.awareness.on("change", this.onAwarenessChange);

    socket.on("connect", this.join);
    socket.on("collab:update", this.onRemoteUpdate);
    socket.on("collab:awareness", this.onRemoteAwareness);
    socket.on("collab:left", this.onPeerLeft);
    socket.on("collab:saved", this.onSaved);
    // Someone new: let them see our cursor right away
    socket.on("user-joined", this.announce);

    if (socket.connected) void this.join();
  }

  /** Sync with the server's document (also after reconnecting). */
  private join = async () => {
    try {
      const res = (await this.socket.timeout(10_000).emitWithAck("collab:join", {
        stateVector: Y.encodeStateVector(this.doc),
        clientId: this.doc.clientID,
      })) as { ok: boolean; update?: ArrayBuffer; stateVector?: ArrayBuffer };
      if (!res?.ok || !res.update || !res.stateVector) return;

      Y.applyUpdate(this.doc, toBytes(res.update), REMOTE);
      // Send anything we have that the server doesn't (edits made while offline)
      const missing = Y.encodeStateAsUpdate(this.doc, toBytes(res.stateVector));
      if (missing.byteLength > 2) this.socket.emit("collab:update", missing);

      if (!this.ready) {
        this.ready = true;
        this.handlers.onReady(this.toTree());
      }
      this.announce();
    } catch {
      // Older server or timeout: the editor keeps working without live sync
    }
  };

  private announce = () => {
    this.socket.emit("collab:awareness", encodeAwarenessUpdate(this.awareness, [this.doc.clientID]));
  };

  private onDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin !== REMOTE && this.ready) this.socket.emit("collab:update", update);
  };

  private onRemoteUpdate = (update: unknown) => {
    Y.applyUpdate(this.doc, toBytes(update), REMOTE);
  };

  private onFilesObserved = (events: Y.YEvent<Y.AbstractType<unknown>>[], txn: Y.Transaction) => {
    if (!this.ready && txn.origin !== REMOTE) return;
    const changes: Record<string, string | null> = {};
    for (const event of events) {
      if (event.target === this.files) {
        event.changes.keys.forEach((change, key) => {
          changes[key] = change.action === "delete" ? null : (this.files.get(key)?.toString() ?? null);
        });
      } else {
        const key = String(event.path[0]);
        changes[key] = this.files.get(key)?.toString() ?? null;
      }
    }
    if (this.ready) this.handlers.onFilesChanged(changes, txn.origin === REMOTE);
  };

  private onAwarenessUpdate = (
    { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ) => {
    if (origin === REMOTE) return;
    const changed = [...added, ...updated, ...removed];
    this.socket.emit("collab:awareness", encodeAwarenessUpdate(this.awareness, changed));
  };

  private onRemoteAwareness = (update: unknown) => {
    applyAwarenessUpdate(this.awareness, toBytes(update), REMOTE);
  };

  private onPeerLeft = ({ clientId }: { clientId: number }) => {
    removeAwarenessStates(this.awareness, [clientId], REMOTE);
  };

  private onSaved = ({ username }: { username: string }) => this.handlers.onRemoteSaved(username);

  private onAwarenessChange = () => {
    const peers = this.getPeers();
    this.handlers.onPeersChanged(peers);
    this.updateCursorStyles(peers);
  };

  getPeers(): Peer[] {
    const peers: Peer[] = [];
    this.awareness.getStates().forEach((state, clientId) => {
      if (clientId === this.doc.clientID || !state.user) return;
      const user = state.user as { id: string; name: string; color: string };
      peers.push({ clientId, userId: user.id, name: user.name, color: user.color, file: (state.file as string) ?? null });
    });
    return peers;
  }

  /** y-monaco marks remote selections with per-client classes; colour and label them. */
  private updateCursorStyles(peers: Peer[]) {
    if (typeof document === "undefined") return;
    this.styleEl ??= document.head.appendChild(document.createElement("style"));
    this.styleEl.textContent = peers
      .map(({ clientId, color, name }) => {
        const label = JSON.stringify(name.slice(0, 24));
        return `.yRemoteSelection-${clientId}{background-color:${color}33}
.yRemoteSelectionHead-${clientId}{position:absolute;border-left:2px solid ${color};height:100%;box-sizing:border-box}
.yRemoteSelectionHead-${clientId}::after{content:${label};position:absolute;top:-1.15em;left:-2px;padding:0 4px;border-radius:3px 3px 3px 0;background:${color};color:#000;font:600 10px/1.4 system-ui,sans-serif;white-space:nowrap;pointer-events:none;z-index:10}`;
      })
      .join("\n");
  }

  setActiveFile(path: string | null) {
    this.awareness.setLocalStateField("file", path);
  }

  getText(path: string) {
    return this.files.get(path) ?? null;
  }

  toTree(): FlatFileTree {
    const tree: FlatFileTree = {};
    this.files.forEach((text, path) => {
      tree[path] = text.toString();
    });
    return tree;
  }

  /** Make the shared files match `next` (create / delete / rename / apply AI files). */
  applyTree(next: FlatFileTree) {
    this.doc.transact(() => {
      for (const path of [...this.files.keys()]) {
        if (!(path in next)) this.files.delete(path);
      }
      for (const [path, contents] of Object.entries(next)) {
        const text = this.files.get(path);
        if (text) setText(text, contents);
        else this.files.set(path, new Y.Text(contents));
      }
    }, LOCAL);
  }

  notifySaved() {
    if (this.ready) this.socket.emit("collab:saved");
  }

  destroy() {
    // Tell others we left before tearing down
    this.awareness.setLocalState(null);
    this.socket.off("connect", this.join);
    this.socket.off("collab:update", this.onRemoteUpdate);
    this.socket.off("collab:awareness", this.onRemoteAwareness);
    this.socket.off("collab:left", this.onPeerLeft);
    this.socket.off("collab:saved", this.onSaved);
    this.socket.off("user-joined", this.announce);
    this.awareness.off("update", this.onAwarenessUpdate);
    this.awareness.off("change", this.onAwarenessChange);
    this.awareness.destroy();
    this.doc.destroy();
    this.styleEl?.remove();
  }
}
