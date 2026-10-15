/** Shared domain types for the Aivex frontend. */

export interface User {
  _id: string;
  name: string;
  username: string;
  email?: string;
  bio?: string;
  avatar?: string;
  isOnline?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** Flat file tree: `{ "src/index.js": "<contents>" }` */
export type FlatFileTree = Record<string, string>;

/** WebContainer-compatible nested tree (`FileSystemTree`). */
export type WebContainerTree = {
  [name: string]:
    | { file: { contents: string } }
    | { directory: WebContainerTree };
};

export interface Project {
  _id: string;
  /** Frontend-friendly alias of `_id`. */
  id: string;
  name: string;
  owner: string | User;
  ownerId?: string;
  /** Populated members on the project page, raw ids on the dashboard. */
  users: User[] | string[];
  files?: FlatFileTree;
  flatFileTree: FlatFileTree;
  isOwner?: boolean;
  /** Long-term notes the AI keeps about this project. */
  aiMemory?: string;
  stack?: string;
  status?: string;
  usersCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

/** A project loaded on the project page, where `users` is populated. */
export interface ProjectDetails extends Project {
  users: User[];
}

export type MessageType = "incoming" | "outgoing" | "system";

export type Timestamp = string | number | Date;

export interface ChatMessage {
  /** Server id; set once the message is stored. */
  id?: string;
  /** Local id for optimistic messages, used to attach the server id later. */
  clientId?: string;
  text: string;
  username?: string;
  type: MessageType;
  timestamp?: Timestamp;
  isAI?: boolean;
  isStreaming?: boolean;
  isError?: boolean;
  role?: string;
  senderId?: string;
  fileTree?: FlatFileTree | null;
  /** Paths the AI asked to remove. */
  deletedFiles?: string[];
  filePatch?: Record<string, string> | null;
}

export type FileItemType = "file" | "folder";

export interface CreateFilePayload {
  name: string;
  type: FileItemType;
  path: string;
}

export type ToastType = "success" | "error" | "info" | "warning";

/** Shape of the AI response the backend relays over the socket. */
export interface AiMessage {
  text?: string;
  fileTree?: Record<string, unknown>;
  deletedFiles?: string[];
  buildCommand?: string[];
  runCommand?: string[];
}

export interface SocketProjectMessage {
  id?: string;
  message: string | AiMessage;
  role?: string;
  sender?: { id: string; username?: string };
  isAI?: boolean;
  /** The server already saved the AI's file changes to the project. */
  filesSaved?: boolean;
  timestamp?: Timestamp;
  fileTree?: FlatFileTree;
}

/** The part of the editor the AI should focus on. */
export interface EditorSelection {
  startLine: number;
  endLine: number;
  text: string;
}

export interface ApiErrorBody {
  message?: string;
}
