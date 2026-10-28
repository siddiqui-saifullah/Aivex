/** Shared domain types for the Aivex frontend. */

export interface User {
  _id: string;
  name: string;
  username: string;
  email?: string;
  bio?: string;
  /** False for Google/GitHub accounts that haven't set a password yet. */
  hasPassword?: boolean;
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
  /** Class this project belongs to (a student's copy of an assignment). */
  classroom?: string | null;
  /** The class teacher turned Vex AI off for this user. */
  aiDisabled?: boolean;
  /** Invited but not yet accepted (populated on the project page). */
  invites?: { user: User; createdAt: string }[];
  createdAt?: string;
  updatedAt?: string;
}

export type ClassroomRole = "teacher" | "student";

/** A class as listed on the dashboard. */
export interface ClassroomSummary {
  _id: string;
  name: string;
  stack: string;
  /** Whether students may use Vex AI. */
  aiEnabled?: boolean;
  role: ClassroomRole;
  /** Join code (teacher only). */
  code?: string;
  teacher: { name?: string; username?: string };
  studentCount: number;
  /** The student's own project. */
  projectId?: string;
  createdAt: string;
}

export interface ClassroomStudent {
  userId: string;
  name?: string;
  username?: string;
  projectId: string;
  joinedAt: string;
  lastActive: string;
  online: boolean;
}

export interface ClassroomDetails extends Omit<ClassroomSummary, "createdAt"> {
  /** Teacher only. */
  students?: ClassroomStudent[];
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
  /** ...and put them into the live shared document. */
  filesSynced?: boolean;
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

export type NotificationType =
  | "project-invite"
  | "invite-accepted"
  | "invite-declined"
  | "project-removed"
  | "project-owner"
  | "mention"
  | "class-join"
  | "class-leave"
  | "class-removed"
  | "report-update"
  | "class-ai";

export interface AppNotification {
  _id: string;
  type: NotificationType;
  title: string;
  body: string;
  /** In-app path to open. */
  link: string;
  actor: { id: string | null; username: string } | null;
  /** Invites: the project, and whether it was answered. */
  projectId?: string | null;
  status?: InviteStatus | null;
  read: boolean;
  createdAt: string;
}

export type InviteStatus = "pending" | "accepted" | "declined" | "cancelled" | "expired";

/** An invitation waiting for the current user's answer. */
export interface ProjectInvite {
  projectId: string;
  name: string;
  stack: string;
  membersCount: number;
  owner: { name?: string; username?: string };
  invitedBy: { name?: string; username?: string };
  createdAt: string;
}
