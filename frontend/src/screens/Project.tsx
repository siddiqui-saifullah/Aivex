import { useCallback, useEffect, useMemo, useState, useRef, lazy, Suspense, type CSSProperties } from "react";
import { Code2, FolderTree, Loader2, MessageSquare } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import type { WebContainer } from "@webcontainer/api";
import {
  getProjectById,
  cancelInvite,
  getProjectChats,
  updateProjectFiles,
  deleteProject,
  leaveProject,
  removeMember,
  transferOwnership,
  updateAiMemory,
} from "../services/project.service";
import {
  formatUserMessage,
  createSystemMessage,
  normalizeSocketMessage,
} from "../services/message.service";
import { useTypingIndicator } from "../hooks/useTypingIndicator";
import AssignmentCard from "../components/project/AssignmentCard";
import ProjectHeader from "../components/project/ProjectHeader";
import ChatRail from "../components/project/ChatRail";
import ExplorerRail from "../components/project/ExplorerRail";
import PaneResizer from "../components/project/PaneResizer";
import { useSidePane } from "../hooks/useSidePane";
import MessageArea from "../components/project/MessageArea";
import SidePanel from "../components/project/SidePanel";
import FileExplorer from "../components/project/FileExplorer";
import PreviewOverlay from "../components/project/PreviewOverlay";
import QuickOpen from "../components/project/QuickOpen";
import { CollabSession, type Peer } from "../config/collab";
import OutputPanel, { type OutputKind, type OutputLine } from "../components/project/OutputPanel";
import { RUN_STEP_LABELS, initialRunSteps, type RunStep } from "../utils/runSteps";
import type { RunStepId, RunStepStatus } from "../config/webContainer";
import { getRunnerLanguage, runFile } from "../services/runner.service";
import {
  describeExitCode,
  nativeLanguageOf,
  precompileCxx,
  runC,
  warmCRunner,
  type CRunHandle,
} from "../services/cRunner.service";
import { enhancePrompt } from "../services/ai.service";
import type { Mentionable } from "../components/shared/ChatTextarea";
import { downloadProjectZip } from "../utils/downloadZip";
import { toTerminalLines } from "../utils/terminalText";
import {
  initializeSocket,
  receiveMessage,
  sendMessage,
  removeMessageListener,
  disconnectSocket,
  sendWithAck,
} from "../config/socket";
import { useUser } from "../context/user.context";
import { useToast } from "../context/toast.context";
import {
  getWebContainer,
  runWebcontainer,
  stopWebcontainer,
} from "../config/webContainer";
import {
  addFileToTree,
  deleteFileFromTree,
  FOLDER_PLACEHOLDER,
  pathExists,
  renamePath,
} from "../utils/buildFileTree";
import { getErrorMessage, isAckTimeout } from "../utils/getErrorMessage";
import { toWebContainerTree } from "../utils/toWebContainerTree";
import { applyFilePatch } from "../utils/applyFilePatch";
import {
  PREVIEW_MESSAGE_SOURCE,
  PREVIEW_SANDBOX,
  buildStaticPage,
  getEntryPage,
  isStaticSite,
  resolvePath,
  type PreviewMessage,
} from "../utils/staticSite";
import ProjectSkeleton from "../components/Loders/ProjectSkeleton";
import type {
  ChatMessage,
  CreateFilePayload,
  EditorSelection,
  FileItemType,
  FlatFileTree,
  ProjectDetails,
  SocketProjectMessage,
  User,
} from "../types";

// The editor (Monaco) is large; load it in parallel with the project data
// instead of blocking the first paint of the page.
const CodeEditor = lazy(() => import("../components/project/CodeEditor"));

// Lazy load modals - they're only shown on specific user actions
const InviteUserModal = lazy(
  () => import("../components/project/InviteUserModal"),
);
const DeleteConfirmModal = lazy(
  () => import("../components/project/DeleteConfirmModal"),
);
const DeleteProjectModal = lazy(() =>
  import("../components/dashboard/modals").then((m) => ({
    default: m.DeleteProjectModal,
  })),
);
const LeaveProjectModal = lazy(() =>
  import("../components/dashboard/modals").then((m) => ({
    default: m.LeaveProjectModal,
  })),
);

interface UserJoinedEvent {
  userId: string;
  username: string;
  timestamp: number;
}

interface ProjectUpdatedEvent {
  projectId: string;
  reason: "members" | "owner" | "renamed" | "deleted" | "memory" | "ai-policy" | "assignment";
}

type SendAck =
  | { ok: true; id: string; timestamp?: string }
  | { ok: false; error: string };

interface UserTypingEvent {
  userId: string;
  username: string;
  isTyping: boolean;
}

const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

/** Keep the output panel responsive on chatty processes (npm install). */
const MAX_OUTPUT_LINES = 2000;

type MobileTab = "chat" | "files" | "code";

/** File to open when a project loads: the page or entry point a person would start with. */
const pickEntryFile = (files: FlatFileTree): string | null => {
  const paths = Object.keys(files).filter((p) => p !== ".aivex" && !p.endsWith(FOLDER_PLACEHOLDER));
  if (paths.length === 0) return null;
  let main: string | undefined;
  try {
    main = (JSON.parse(files["package.json"] ?? "{}") as { main?: string }).main?.replace(/^\.\//, "");
  } catch {
    /* invalid package.json */
  }
  const preferred = [
    main,
    "index.html",
    "src/App.jsx",
    "src/App.tsx",
    "src/main.jsx",
    "server.js",
    "index.js",
    "app.js",
    "main.js",
    "main.py",
    "main.cpp",
    "main.c",
    "Main.java",
  ];
  return preferred.find((p) => p && p in files) ?? paths.find((p) => !p.includes("/") && p !== "package.json") ?? paths[0];
};

const Project = () => {
  const { projectId = "" } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useUser();
  const toast = useToast();

  // Project state
  const [project, setProject] = useState<ProjectDetails | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  // Socket handlers are registered once per project; read members through a ref
  const projectUsersRef = useRef<User[]>([]);

  // UI state
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [invitePermissionError, setInvitePermissionError] = useState(false);
  const [deletePermissionError, setDeletePermissionError] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLeaveOpen, setIsLeaveOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [activeFile, setActiveFile] = useState<string | null>(null);

  // File management state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<{
    path: string;
    type: FileItemType;
  } | null>(null);

  // Message state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState("");

  // FileTree states
  const [flatFileTree, setFlatFileTree] = useState<FlatFileTree>({});
  // Last saved contents, to mark edited tabs
  const [savedTree, setSavedTree] = useState<FlatFileTree>({});

  // Live collaborative editing (shared document synced over the socket)
  const collabRef = useRef<CollabSession | null>(null);
  const [collab, setCollab] = useState<CollabSession | null>(null);
  const [peers, setPeers] = useState<Peer[]>([]);

  /** Change the project's files: through the shared document when live editing is on. */
  const commitTree = (next: FlatFileTree) => {
    if (collabRef.current?.ready) collabRef.current.applyTree(next);
    else setFlatFileTree(next);
  };

  // Web Container State
  const [webContainer, setWebContainer] = useState<WebContainer | null>(null);
  const [runProgress, setRunProgress] = useState("");
  const [originalIsRunning, setOriginalIsRunning] = useState(false);
  const [isSaved, setIsSaved] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [showPreview, setShowPreview] = useState(false);
  const [previewBaseUrl, setPreviewBaseUrl] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAiThinking, setIsAiThinking] = useState(false);

  // Output panel / runner state
  const [outputLines, setOutputLines] = useState<OutputLine[]>([]);
  const [isOutputOpen, setIsOutputOpen] = useState(false);
  const [stdin, setStdin] = useState("");
  const [isRunningFile, setIsRunningFile] = useState(false);
  const [revealOutputKey, setRevealOutputKey] = useState(0);
  const outputIdRef = useRef(0);

  // Node project run shown as a step loader (raw logs kept behind "Show logs")
  const [nodeRun, setNodeRun] = useState<{
    steps: RunStep[];
    startedAt: number;
    logs: OutputLine[];
    previewErrors: string[];
  } | null>(null);

  const updateRunStep = useCallback((id: RunStepId, status: RunStepStatus, detail?: string) => {
    setNodeRun((run) =>
      run
        ? { ...run, steps: run.steps.map((s) => (s.id === id ? { ...s, status, detail: detail ?? s.detail } : s)) }
        : run,
    );
    if (status === "active") setRunProgress(`${RUN_STEP_LABELS[id]}…`);
    if (status === "error") setRunProgress(`${RUN_STEP_LABELS[id]} failed`);
  }, []);

  const appendRunLog = useCallback((chunk: string) => {
    const lines = toTerminalLines(chunk);
    setNodeRun((run) => {
      if (!run) return run;
      const logs = [...run.logs, ...lines.map((text) => ({ id: outputIdRef.current++, text, kind: "stdout" as OutputKind }))];
      return { ...run, logs: logs.length > MAX_OUTPUT_LINES ? logs.slice(-MAX_OUTPUT_LINES) : logs };
    });
  }, []);

  // HTML / CSS / JS projects: instant live preview without the WebContainer
  const [staticPage, setStaticPage] = useState<string | null>(null);
  const [staticTree, setStaticTree] = useState<FlatFileTree>({});
  const previewTokenRef = useRef(Math.random().toString(36).slice(2));
  const previewTabRef = useRef<Window | null>(null);
  const isStatic = useMemo(() => isStaticSite(flatFileTree), [flatFileTree]);

  // Follow edits (saved or not) with a short debounce so typing stays smooth
  useEffect(() => {
    if (!staticPage) return;
    const timer = setTimeout(() => setStaticTree(flatFileTree), 250);
    return () => clearTimeout(timer);
  }, [flatFileTree, staticPage]);

  const staticHtml = useMemo(
    () => (staticPage ? buildStaticPage(staticTree, staticPage, previewTokenRef.current) : null),
    [staticTree, staticPage],
  );

  // AI mode: send every message to Vex without typing @Vex (remembered per browser)
  const [aiMode, setAiMode] = useState(() => {
    try {
      return localStorage.getItem("aivex-ai-mode") === "1";
    } catch {
      return false;
    }
  });
  const toggleAiMode = () => {
    setAiMode((on) => {
      try {
        localStorage.setItem("aivex-ai-mode", on ? "0" : "1");
      } catch {
        /* storage unavailable */
      }
      return !on;
    });
  };

  // Editor focus sent with AI requests: the open file and current selection.
  // The user can drop it for the next message with the chip's ×.
  const [editorSelection, setEditorSelection] = useState<EditorSelection | null>(null);
  const [aiContextDismissed, setAiContextDismissed] = useState(false);

  // Editor tabs (most recent last) and the "Go to file" palette
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [isQuickOpen, setIsQuickOpen] = useState(false);

  const selectFile = (path: string | null) => {
    setActiveFile(path);
    setEditorSelection(null);
    setAiContextDismissed(false);
    if (path) {
      setOpenFiles((tabs) => {
        if (tabs.includes(path)) return tabs;
        // Keep the tab bar manageable: drop the oldest tab beyond 10
        const next = [...tabs, path];
        return next.length > 10 ? next.slice(-10) : next;
      });
    }
  };

  const closeTab = (path: string) => {
    const index = openFiles.indexOf(path);
    const next = openFiles.filter((p) => p !== path);
    setOpenFiles(next);
    if (activeFile === path) {
      const neighbour = next[Math.min(index, next.length - 1)] ?? null;
      setActiveFile(neighbour);
      setEditorSelection(null);
    }
  };

  // Small screens show one pane at a time
  const [mobileTab, setMobileTab] = useState<MobileTab>("chat");
  // Desktop: the chat and explorer columns can be collapsed to rails and resized
  const chatPanel = useSidePane({
    storageKey: "aivex-chat",
    minWidth: 288,
    maxWidth: 640,
    isShortcut: (e) => (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "b",
  });
  const explorerPane = useSidePane<HTMLDivElement>({
    storageKey: "aivex-explorer",
    minWidth: 180,
    maxWidth: 480,
    isShortcut: (e) => (e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === "e",
  });
  // Messages already seen when the chat was collapsed (the rest count as unread)
  const [seenMessageCount, setSeenMessageCount] = useState(0);

  const appendOutput = useCallback((chunk: string, kind: OutputKind = "stdout") => {
    const lines = kind === "stdout" || kind === "stderr" ? toTerminalLines(chunk) : chunk.split("\n");
    setOutputLines((prev) => {
      const next = [
        ...prev,
        ...lines.map((text) => ({ id: outputIdRef.current++, text, kind })),
      ];
      return next.length > MAX_OUTPUT_LINES ? next.slice(-MAX_OUTPUT_LINES) : next;
    });
  }, []);

  /**
   * Streamed program output: continues the last line until a newline arrives,
   * so "Enter n: " and what the user types stay on one line like a terminal.
   */
  const streamOpenRef = useRef(false);
  const appendStream = useCallback((chunk: string, kind: OutputKind) => {
    if (!chunk) return;
    const continueLast = streamOpenRef.current;
    streamOpenRef.current = !chunk.endsWith("\n");
    const parts = chunk.replace(/\r\n/g, "\n").split("\n");
    if (!streamOpenRef.current) parts.pop(); // nothing after the final newline
    setOutputLines((prev) => {
      const next = [...prev];
      let start = 0;
      const last = next[next.length - 1];
      if (continueLast && last && last.kind === kind && last.input === undefined) {
        next[next.length - 1] = { ...last, text: last.text + parts[0] };
        start = 1;
      }
      for (let i = start; i < parts.length; i++) next.push({ id: outputIdRef.current++, text: parts[i], kind });
      return next.length > MAX_OUTPUT_LINES ? next.slice(-MAX_OUTPUT_LINES) : next;
    });
  }, []);

  /** Echo typed input after the prompt (or on its own line). */
  const echoInput = useCallback((text: string) => {
    const continueLast = streamOpenRef.current;
    streamOpenRef.current = false;
    setOutputLines((prev) => {
      const last = prev[prev.length - 1];
      if (continueLast && last && last.input === undefined) {
        return [...prev.slice(0, -1), { ...last, input: text }];
      }
      return [...prev, { id: outputIdRef.current++, text: "", kind: "stdout", input: text }];
    });
  }, []);

  // Running C program (in-browser compiler) and whether it waits for input
  const cRunRef = useRef<CRunHandle | null>(null);
  const [awaitingInput, setAwaitingInput] = useState(false);

  // Typing indicator state
  const { typingUsers, handleUserTyping, clearAllTypingUsers } =
    useTypingIndicator();

  const applyProject = (data: ProjectDetails) => {
    setProject(data);
    setIsOwner(Boolean(data.isOwner));
    projectUsersRef.current = data.users || [];
  };

  /* ---------- WEB CONTAINER (BROWSER ONLY, ONCE) ---------- */
  // Kept separate from the socket effect: booting must not reconnect the
  // socket or reload the chat history.
  useEffect(() => {
    if (typeof window === "undefined") return;

    let isMounted = true;

    (async () => {
      try {
        const container = await getWebContainer();
        if (!isMounted) return;

        setWebContainer(container);
        console.log("WebContainer started");
      } catch (err) {
        console.error("WebContainer failed:", err);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!projectId || !user?._id) return;

    let isMounted = true;
    const currentUserId = user._id;

    /* ---------- RESET STATE ---------- */
    setMessages([]);
    setMessage("");
    clearAllTypingUsers();

    /* ---------- SOCKET INIT ---------- */
    const socket = initializeSocket(projectId);

    const session = new CollabSession(
      socket,
      { id: currentUserId, name: user.name || user.username || "Someone" },
      {
        onReady: (files) => {
          if (!isMounted) return;
          // The shared document includes teammates' unsaved edits
          setFlatFileTree(files);
          setCollab(session);
        },
        onFilesChanged: (changes) => {
          setFlatFileTree((prev) => {
            const next = { ...prev };
            for (const [path, contents] of Object.entries(changes)) {
              if (contents === null) delete next[path];
              else next[path] = contents;
            }
            return next;
          });
        },
        onPeersChanged: setPeers,
        onRemoteSaved: (username) => {
          setSavedTree(session.toTree());
          toast.info(`${username} saved the project`, 1500);
        },
      },
    );
    collabRef.current = session;

    const loadProjectAndChats = async () => {
      let projectData: ProjectDetails;
      try {
        projectData = await getProjectById(projectId);
      } catch (err) {
        console.error("Failed to fetch project:", err);
        if (isMounted) toast.error("Failed to load project");
        return;
      }
      if (!isMounted) return;

      applyProject(projectData);
      const files = projectData.files || projectData.flatFileTree || {};
      // Live editing may already have delivered the shared (newer) state
      if (!collabRef.current?.ready) setFlatFileTree(files);
      setSavedTree(files);
      setIsSaved(true);
      // Open the project's main file so there's something to work with right away
      const entry = pickEntryFile(files);
      if (entry) selectFile(entry);

      try {
        const response = await getProjectChats(projectId);
        if (!isMounted) return;

        const userMap: Record<string, string> = {};
        projectData.users.forEach((member) => {
          userMap[member._id] = member.username || member.name;
        });

        const history: ChatMessage[] = (response.projectChats || []).map(
          (chat) => {
            const isAI = Boolean(chat.isAI || chat.role === "ai");
            const senderId = chat.sender ?? undefined;

            return {
              id: chat.id,
              text: chat.text,
              role: chat.role,
              senderId,
              username: isAI
                ? "Aivex"
                : (senderId && userMap[senderId]) || "Unknown User",
              filePatch: chat.filePatch,
              timestamp: chat.createdAt,
              type:
                String(senderId) === String(currentUserId)
                  ? "outgoing"
                  : "incoming",
              isAI,
            };
          },
        );

        // Keep any live messages that arrived while history was loading
        setMessages((prev) => [...history, ...prev]);
      } catch (err) {
        console.error("Failed to fetch chat history:", err);
      }
    };

    loadProjectAndChats();

    /* ---------- SOCKET HANDLERS ---------- */
    const handleProjectMessage = (socketData: SocketProjectMessage) => {
      const normalizedMessage = normalizeSocketMessage(
        socketData,
        currentUserId,
        projectUsersRef.current,
      );

      if (normalizedMessage.isAI) {
        setIsAiThinking(false);
      }

      setMessages((prev) => [...prev, normalizedMessage]);

      const { fileTree: aiFiles, deletedFiles } = normalizedMessage;
      if (aiFiles || deletedFiles?.length) {
        // The AI sends only what it changed; merge it into the project.
        // The server saves those changes itself, so they only count as
        // unsaved here if it couldn't (or is an older server).
        // With live editing the server already put them into the shared document
        if (!(socketData.filesSynced && collabRef.current?.ready)) {
          setFlatFileTree((prev) => applyFilePatch(prev, aiFiles, deletedFiles));
        }
        if (socketData.filesSaved) setSavedTree((prev) => applyFilePatch(prev, aiFiles, deletedFiles));
        else setIsSaved(false);
      }
    };

    const handleUserJoined = (data: UserJoinedEvent) => {
      setMessages((prev) => [
        ...prev,
        createSystemMessage(
          `${data.username} joined the project`,
          data.timestamp,
        ),
      ]);
    };

    const handleUserTypingEvent = (data: UserTypingEvent) => {
      handleUserTyping(data.userId, data.username, data.isTyping);
    };

    const handleMessageDeleted = ({ id }: { id: string }) => {
      setMessages((prev) => prev.filter((m) => m.id !== id));
    };

    // Membership, ownership or name changed (possibly by someone else)
    const handleProjectUpdated = async ({ reason }: ProjectUpdatedEvent) => {
      if (reason === "deleted") {
        toast.info("This project was deleted by its owner");
        navigate("/dashboard");
        return;
      }

      try {
        const updated = await getProjectById(projectId);
        if (!isMounted) return;
        applyProject(updated);
        if (reason === "ai-policy" && updated.isOwner) {
          if (updated.aiDisabled) toast.info("Your teacher turned off Vex AI for this class");
          else toast.success("Your teacher turned Vex AI back on");
        }
        if (reason === "assignment" && updated.isOwner) toast.info("Your teacher updated this assignment");
      } catch {
        // No longer a member (removed by the owner)
        if (!isMounted) return;
        toast.warning("You no longer have access to this project");
        navigate("/dashboard");
      }
    };

    receiveMessage("project-message", handleProjectMessage);
    receiveMessage("user-joined", handleUserJoined);
    receiveMessage("user-typing", handleUserTypingEvent);
    receiveMessage("message-deleted", handleMessageDeleted);
    receiveMessage("project-updated", handleProjectUpdated);

    /* ---------- CLEANUP ---------- */
    return () => {
      isMounted = false;

      removeMessageListener("project-message", handleProjectMessage);
      removeMessageListener("user-joined", handleUserJoined);
      removeMessageListener("user-typing", handleUserTypingEvent);
      removeMessageListener("message-deleted", handleMessageDeleted);
      removeMessageListener("project-updated", handleProjectUpdated);

      session.destroy();
      collabRef.current = null;
      setCollab(null);
      setPeers([]);

      // Leave the project room when navigating away
      disconnectSocket();
      clearAllTypingUsers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, user?._id]);

  const handleSend = async () => {
    if (!message.trim()) return;

    // AI mode auto-mentions Vex so the server routes the message to the AI
    const text =
      aiMode && !project?.aiDisabled && !/^\s*@vex\b/i.test(message) ? `@Vex ${message.trim()}` : message;
    if (project?.aiDisabled && /^\s*@vex\b/i.test(text)) {
      toast.info("Your teacher has turned off Vex AI for this class");
      return;
    }
    const userMessage = formatUserMessage(text, user);
    setMessages((prev) => [...prev, userMessage]);
    setMessage("");

    // The server only answers messages that start with "@vex"
    const asksAi = text.trim().toLowerCase().startsWith("@vex");
    if (asksAi) setIsAiThinking(true);

    // Tell the AI what the user is looking at (and the open file's unsaved edits)
    const context =
      asksAi && activeFile && activeFile !== ".aivex" && !aiContextDismissed
        ? {
            activeFile,
            activeFileContent: isSaved ? undefined : flatFileTree[activeFile],
            selection: editorSelection ?? undefined,
          }
        : undefined;
    if (asksAi) setAiContextDismissed(false);

    try {
      const ack = await sendWithAck<SendAck>("project-message", { message: text, context });
      if (!ack.ok) throw new Error(ack.error);

      // Attach the stored id so the message can be deleted later
      setMessages((prev) =>
        prev.map((m) =>
          m.clientId === userMessage.clientId ? { ...m, id: ack.id } : m,
        ),
      );
    } catch (err) {
      // No acknowledgement (older server, or a slow one): the message was most
      // likely delivered anyway, so don't flag it as failed
      if (isAckTimeout(err)) return;

      console.error("Failed to send message:", err);
      setMessages((prev) =>
        prev.map((m) =>
          m.clientId === userMessage.clientId ? { ...m, isError: true } : m,
        ),
      );
      if (asksAi) setIsAiThinking(false);
      toast.error("Message failed to send");
    }
  };

  const handleEnhancePrompt = async (text: string) => {
    try {
      // Don't send the mention itself to the enhancer; put it back afterwards
      const mention = /^\s*@vex\s*/i.exec(text)?.[0] ?? "";
      const improved = await enhancePrompt(text.slice(mention.length), projectId);
      return mention ? `@Vex ${improved}` : improved;
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not enhance the prompt"));
      return text;
    }
  };

  const handleDeleteMessage = async (id: string) => {
    try {
      const ack = await sendWithAck<{ ok: boolean; error?: string }>(
        "delete-message",
        { id },
      );
      if (!ack.ok) throw new Error(ack.error);
      // Removal itself arrives via the "message-deleted" broadcast
    } catch (err) {
      toast.error(
        isAckTimeout(err)
          ? "The server didn't confirm the delete. It may be outdated or waking up; please try again."
          : err instanceof Error && err.message
            ? err.message
            : "Failed to delete message",
      );
    }
  };

  /** Load files from an AI message into the editor (unsaved until Run/Update). */
  const handleApplyFiles = (files: FlatFileTree) => {
    commitTree(applyFilePatch(flatFileTree, files));
    setIsSaved(false);
    toast.info("Files loaded into the editor. Run or update to save them.");
  };

  const handleSaveMemory = async (memory: string) => {
    try {
      const { aiMemory } = await updateAiMemory(projectId, memory);
      setProject((prev) => (prev ? { ...prev, aiMemory } : prev));
      toast.success(aiMemory ? "AI memory saved" : "AI memory cleared");
      return true;
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to save AI memory"));
      return false;
    }
  };

  const handleTransferOwnership = async (member: User) => {
    try {
      await transferOwnership(projectId, member._id);
      toast.success(`${member.name || member.username} is now the owner`);
      applyProject(await getProjectById(projectId));
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to transfer ownership"));
    }
  };

  const handleRemoveMember = async (member: User) => {
    try {
      await removeMember(projectId, member._id);
      toast.success(`${member.name || member.username} was removed`);
      applyProject(await getProjectById(projectId));
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to remove member"));
    }
  };

  const handleTyping = (isTyping: boolean) => {
    sendMessage("user-typing", { isTyping });
  };

  const handleAddMember = () => {
    if (!isOwner) {
      setInvitePermissionError(true);
      setTimeout(() => setInvitePermissionError(false), 3000);
      return;
    }
    setInviteModalOpen(true);
  };

  const handleDeleteProject = () => {
    if (!isOwner) {
      setDeletePermissionError(true);
      setTimeout(() => setDeletePermissionError(false), 3000);
      return;
    }
    setDeleteModalOpen(true);
  };

  const handleLeaveProject = () => {
    if (isOwner) {
      toast.warning(
        "Project owner cannot leave. Make another member the owner (Members panel) or delete the project.",
      );
      return;
    }

    setIsLeaveOpen(true);
  };

  const handleConfirmLeave = async () => {
    if (isOwner) return;

    try {
      setIsLeaving(true);
      await leaveProject(projectId);
      setIsLeaveOpen(false);
      navigate("/dashboard");
    } catch (error) {
      console.error("Failed to leave project:", error);
      toast.error("Failed to leave project");
    } finally {
      setIsLeaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    try {
      setIsDeleting(true);
      await deleteProject(projectId);
      setDeleteModalOpen(false);
      navigate("/dashboard");
    } catch (error) {
      console.error("Failed to delete project:", error);
      toast.error("Failed to delete project");
      setIsDeleting(false);
    }
  };

  const handleSelectUser = async (users: User[]) => {
    toast.success(
      users.length === 1
        ? `Invitation sent to @${users[0].username}`
        : `Invitations sent to ${users.length} people`,
    );

    try {
      applyProject(await getProjectById(projectId));
    } catch (err) {
      console.error("Failed to refresh project:", err);
    }
  };

  const handleCancelInvite = async (invitee: User) => {
    try {
      await cancelInvite(projectId, invitee._id);
      toast.info(`Invitation for @${invitee.username} withdrawn`);
      applyProject(await getProjectById(projectId));
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not cancel the invitation"));
    }
  };

  /** Persist the current file tree. Returns false (and toasts) on failure. */
  const saveFiles = async (progressLabel: string): Promise<boolean> => {
    setRunProgress(progressLabel);
    setIsSaving(true);

    try {
      await updateProjectFiles(projectId, flatFileTree);
      setSavedTree(flatFileTree);
      setIsSaved(true);
      collabRef.current?.notifySaved();
      return true;
    } catch (error) {
      console.error("Failed to save files:", error);
      toast.error("Failed to save files");
      return false;
    } finally {
      setRunProgress("");
      setIsSaving(false);
    }
  };

  // Tab title: project name, with a dot while there are unsaved changes
  useEffect(() => {
    if (project?.name) document.title = `${isSaved ? "" : "● "}${project.name} · Aivex`;
  }, [project?.name, isSaved]);

  // With live editing teammates change files too: compare with the last save
  useEffect(() => {
    if (!collab) return;
    const paths = new Set([...Object.keys(flatFileTree), ...Object.keys(savedTree)]);
    setIsSaved([...paths].every((p) => flatFileTree[p] === savedTree[p]));
  }, [collab, flatFileTree, savedTree]);

  // Let teammates see which file we're in
  useEffect(() => {
    collab?.setActiveFile(activeFile);
  }, [collab, activeFile]);

  // Don't lose unsaved edits to an accidental tab close / reload
  useEffect(() => {
    if (isSaved) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isSaved]);

  const dirtyFiles = useMemo(
    () => new Set(openFiles.filter((p) => p in flatFileTree && flatFileTree[p] !== savedTree[p])),
    [openFiles, flatFileTree, savedTree],
  );
  const visibleFiles = useMemo(
    () => Object.keys(flatFileTree).filter((p) => !p.endsWith(FOLDER_PLACEHOLDER) && p !== ".aivex").sort(),
    [flatFileTree],
  );

  // Ctrl/Cmd+P anywhere in the workspace (the editor registers its own too)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setIsQuickOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /** Messages from the static preview: console output, errors and page links. */
  useEffect(() => {
    if (!staticPage) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data as PreviewMessage | null;
      if (data?.source !== PREVIEW_MESSAGE_SOURCE || data.token !== previewTokenRef.current) return;

      if (data.type === "console") {
        const kind: OutputKind = data.level === "error" || data.level === "warn" ? "stderr" : "stdout";
        appendOutput(data.text ?? "", kind);
      } else if (data.type === "error") {
        appendOutput(data.text ?? "Error", "error");
        setIsOutputOpen(true);
      } else if (data.type === "navigate" && data.path) {
        const target = resolvePath(staticPage, data.path);
        const page = target in flatFileTree ? target : `${target}/index.html` in flatFileTree ? `${target}/index.html` : null;
        if (page) setStaticPage(page);
        else appendOutput(`Page not found: ${target}`, "error");
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [staticPage, flatFileTree, appendOutput]);

  // Keep a preview opened in a new tab in sync
  useEffect(() => {
    const tab = previewTabRef.current;
    if (!tab || tab.closed) return;
    const frame = tab.document.querySelector("iframe");
    if (frame && staticHtml !== null) frame.srcdoc = staticHtml;
  }, [staticHtml]);

  const startStaticPreview = () => {
    const page = getEntryPage(flatFileTree, activeFile);
    if (!page) {
      toast.warning("Add an index.html to preview this site");
      return;
    }
    setStaticTree(flatFileTree);
    setStaticPage(page);
    setOriginalIsRunning(true);
    setPreviewUrl(`/${page}`);
    setShowPreview(true);
    setRunProgress("Live preview · updates as you type");
    appendOutput(`— Live preview of ${page} (console output appears here) —`, "info");
  };

  const openStaticPreviewTab = () => {
    if (staticHtml === null) return;
    const tab = previewTabRef.current && !previewTabRef.current.closed ? previewTabRef.current : window.open("", "_blank");
    if (!tab) {
      toast.warning("Allow pop-ups to open the preview in a new tab");
      return;
    }
    previewTabRef.current = tab;
    const doc = tab.document;
    if (!doc.querySelector("iframe")) {
      doc.title = `${project?.name ?? "Preview"} · Aivex`;
      doc.body.style.cssText = "margin:0;height:100vh;background:#fff";
      const frame = doc.createElement("iframe");
      frame.setAttribute("sandbox", PREVIEW_SANDBOX);
      frame.title = "Preview";
      frame.style.cssText = "border:0;width:100%;height:100%;display:block";
      doc.body.appendChild(frame);
      // Relay console output and page links back to the editor
      tab.addEventListener("message", (event) => window.postMessage(event.data, "*"));
    }
    doc.querySelector("iframe")!.srcdoc = staticHtml;
    tab.focus();
  };

  const startServer = async () => {
    setOriginalIsRunning(true);
    setIsOutputOpen(true);
    setRevealOutputKey((k) => k + 1);
    setPreviewUrl(null);
    setNodeRun({ steps: initialRunSteps(), startedAt: Date.now(), logs: [], previewErrors: [] });

    const started = await runWebcontainer(webContainer, toWebContainerTree(flatFileTree), {
      onStep: updateRunStep,
      onPreviewReady: ({ url }) => {
        setPreviewBaseUrl(url);
        setPreviewUrl(url);
        setShowPreview(true);
        setRunProgress("Server running");
        updateRunStep("ready", "done", url);
      },
      onOutput: appendRunLog,
      onPreviewError: (message) => {
        setNodeRun((run) =>
          run ? { ...run, previewErrors: [...run.previewErrors.slice(-9), message] } : run,
        );
        setIsOutputOpen(true);
      },
      onExit: (code) => {
        // A script that finishes (no server) is fine; a crash is an error
        updateRunStep("ready", code === 0 ? "skipped" : "error", code === 0 ? "Program finished" : `App exited with code ${code}`);
        setOriginalIsRunning(false);
        setRunProgress("");
        setPreviewUrl(null);
        setShowPreview(false);
      },
    });

    if (!started) {
      setOriginalIsRunning(false);
    }
  };

  /** C and C++ run in the browser: compiled to WebAssembly, interactive input. */
  const runCFile = (entry: string) => {
    const isCpp = nativeLanguageOf(entry) === "cpp";
    setIsRunningFile(true);
    setIsOutputOpen(true);
    setRevealOutputKey((k) => k + 1);
    streamOpenRef.current = false;
    appendOutput(`— Running ${entry} (${isCpp ? "C++" : "C"} · in your browser) —`, "info");

    cRunRef.current = runC(
      { files: flatFileTree, entry, stdin },
      {
        onStatus: (phase) => {
          if (phase === "loading") {
            appendOutput(
              isCpp
                ? "Loading the C++ compiler (one time, ~40 MB; later runs start instantly)…"
                : "Loading the C compiler (one time, ~180 KB)…",
              "info",
            );
          }
          setRunProgress(phase === "running" ? "Running…" : phase === "compiling" ? "Compiling…" : "Loading compiler…");
        },
        onProgress: (loaded, total) =>
          setRunProgress(`Loading compiler… ${Math.min(100, Math.round((100 * loaded) / total))}%`),
        onWarnings: (text) => appendOutput(text.replace(/\n$/, ""), "stderr"),
        onOutput: (stream, text) => {
          setAwaitingInput(false);
          appendStream(text, stream);
        },
        onInputRequest: () => {
          setAwaitingInput(true);
          setIsOutputOpen(true);
        },
        onDone: (result) => {
          cRunRef.current = null;
          setAwaitingInput(false);
          setIsRunningFile(false);
          setRunProgress("");
          if (streamOpenRef.current) appendStream("\n", "stdout");
          const timing = (compileMs: number, runMs: number) =>
            ` in ${(runMs / 1000).toFixed(2)}s (compiled in ${Math.max(1, Math.round(compileMs))} ms)`;
          switch (result.kind) {
            case "compile-error":
              appendOutput(result.diagnostics.replace(/\n$/, ""), "stderr");
              appendOutput("Compilation failed", "error");
              break;
            case "exit":
              appendOutput(
                `${result.code === 0 ? "Finished" : describeExitCode(result.code)}${timing(result.compileMs, result.runMs)}`,
                result.code === 0 ? "success" : "error",
              );
              break;
            case "crash":
              appendOutput(`${result.message}${timing(result.compileMs, result.runMs)}`, "error");
              break;
            case "stopped":
              appendOutput(
                result.reason === "timeout"
                  ? "Stopped: time limit exceeded (20 s of CPU). Is there an infinite loop?"
                  : "Stopped",
                "error",
              );
              break;
            case "error":
              appendOutput(result.message, "error");
              break;
          }
        },
      },
    );
  };

  const stopCRun = () => cRunRef.current?.stop();

  // Start loading the compiler as soon as a C/C++ file is opened, so Run is instant
  useEffect(() => {
    const language = nativeLanguageOf(activeFile);
    if (language) warmCRunner(language);
  }, [activeFile]);

  // C++ compiles take a second or two: build the open file whenever the user
  // pauses typing, so Run usually starts the program right away
  useEffect(() => {
    if (!activeFile || nativeLanguageOf(activeFile) !== "cpp") return;
    const timer = setTimeout(() => precompileCxx(flatFileTree, activeFile), 600);
    return () => clearTimeout(timer);
  }, [activeFile, flatFileTree]);

  const handleRunFile = async () => {
    if (!activeFile || isRunningFile) return;
    const language = getRunnerLanguage(activeFile);
    if (!language) return;

    if (nativeLanguageOf(activeFile)) {
      runCFile(activeFile);
      return;
    }

    setIsRunningFile(true);
    setIsOutputOpen(true);
    setRevealOutputKey((k) => k + 1);
    appendOutput(`— Running ${activeFile} (${language.label}) —`, "info");

    try {
      const result = await runFile(activeFile, flatFileTree, stdin);

      if (result.compile && (result.compile.code ?? 0) !== 0) {
        appendOutput(result.compile.stderr || result.compile.stdout, "stderr");
        appendOutput("Compilation failed", "error");
        return;
      }
      if (result.compile?.stderr) appendOutput(result.compile.stderr, "stderr");

      if (result.run.stdout) appendOutput(result.run.stdout.replace(/\n$/, ""), "stdout");
      if (result.run.stderr) appendOutput(result.run.stderr.replace(/\n$/, ""), "stderr");

      const ok = result.run.code === 0;
      const reason = result.run.signal ? ` (${result.run.signal === "SIGKILL" ? "time/memory limit" : result.run.signal})` : "";
      appendOutput(
        `${ok ? "Finished" : `Exited with code ${result.run.code ?? "?"}${reason}`} in ${(result.durationMs / 1000).toFixed(2)}s`,
        ok ? "success" : "error",
      );
    } catch (err) {
      appendOutput(getErrorMessage(err, "Could not reach the code runner"), "error");
    } finally {
      setIsRunningFile(false);
    }
  };

  /** Ctrl/Cmd+S */
  const handleSave = async () => {
    if (isSaved || isSaving) return;
    if (await saveFiles("Saving...")) toast.success("Saved", 1200);
  };

  const handleRenameItem = async (path: string, newName: string): Promise<boolean> => {
    const parent = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
    const target = parent ? `${parent}/${newName}` : newName;

    const updated = renamePath(flatFileTree, path, target);
    if (!updated) return false;

    commitTree(updated);
    const move = (p: string) => (p === path ? target : p.startsWith(path + "/") ? target + p.slice(path.length) : p);
    if (activeFile) setActiveFile(move(activeFile));
    setOpenFiles((tabs) => tabs.map(move));

    try {
      await updateProjectFiles(projectId, updated);
      setSavedTree(updated);
      setIsSaved(true);
    } catch {
      setIsSaved(false);
      toast.warning("Renamed locally. Save pending...");
    }
    return true;
  };

  const handleDownload = async () => {
    try {
      await downloadProjectZip(flatFileTree, project?.name ?? "project");
    } catch {
      toast.error("Failed to create zip");
    }
  };

  const handleRun = async () => {
    if (isStatic) {
      startStaticPreview();
      return;
    }

    if (!webContainer) {
      toast.warning("The runtime is still starting. Please try again shortly.");
      return;
    }

    if (!isSaved && !(await saveFiles("Saving files..."))) return;

    await startServer();
  };

  const handleUpdate = async () => {
    if (isSaved) return;

    // The static preview is already live: just save
    if (staticPage) {
      await saveFiles("Saving files...");
      return;
    }

    if (!(await saveFiles("Updating files..."))) return;

    await stopWebcontainer();
    await startServer();
  };

  const handleStop = async () => {
    const stopped = await stopWebcontainer();
    if (stopped) {
      setOriginalIsRunning(false);
      setRunProgress("");
      setShowPreview(false);
      setPreviewUrl(null);
      setNodeRun(null);
      const wasStatic = Boolean(staticPage);
      setStaticPage(null);
      if (previewTabRef.current && !previewTabRef.current.closed) previewTabRef.current.close();
      previewTabRef.current = null;
      toast.info(wasStatic ? "Preview stopped" : "Server stopped");
    } else {
      toast.error("Failed to stop server");
    }
  };

  const handleCreateFile = async ({ name, type, path }: CreateFilePayload) => {
    try {
      const fullPath = path ? `${path}/${name}` : name;

      // Check if file/folder already exists
      if (pathExists(flatFileTree, fullPath)) {
        toast.error(`${capitalize(type)} already exists: ${fullPath}`);
        return;
      }

      let updated: FlatFileTree;

      if (type === "file") {
        updated = addFileToTree(flatFileTree, fullPath, "");
        // The parent no longer needs its empty-folder placeholder
        if (path) delete updated[`${path}/${FOLDER_PLACEHOLDER}`];
        selectFile(fullPath);
      } else {
        // Folders only exist through their files, so an empty folder is
        // stored as a hidden placeholder file to survive a reload
        updated = addFileToTree(flatFileTree, `${fullPath}/${FOLDER_PLACEHOLDER}`, "");
      }

      commitTree(updated);
      setIsSaved(false);

      // Auto-save to backend
      try {
        await updateProjectFiles(projectId, updated);
        setSavedTree(updated);
        setIsSaved(true);
        toast.success(`${capitalize(type)} created: ${fullPath}`);
      } catch (error) {
        console.error("Failed to save file:", error);
        toast.warning(`${capitalize(type)} created locally. Save pending...`);
      }
    } catch (error) {
      console.error("Failed to create file/folder:", error);
      toast.error("Failed to create file/folder");
    }
  };

  const handleDeleteFile = (path: string, type: FileItemType) => {
    // Prevent deletion of system files
    if (path === ".aivex") {
      toast.error("System file .aivex cannot be deleted");
      return;
    }
    setDeleteConfirmItem({ path, type });
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDeleteFile = async () => {
    if (!deleteConfirmItem) return;

    const { path, type } = deleteConfirmItem;

    try {
      setIsDeleting(true);

      // Close tabs of deleted files
      const removed = (p: string) => p === path || p.startsWith(path + "/");
      const remaining = openFiles.filter((p) => !removed(p));
      setOpenFiles(remaining);
      if (activeFile && removed(activeFile)) {
        setActiveFile(remaining[remaining.length - 1] ?? null);
        setEditorSelection(null);
      }

      // Removes the file, or every file under the folder
      const updated = deleteFileFromTree(flatFileTree, path);

      commitTree(updated);

      // Save to backend
      await updateProjectFiles(projectId, updated);
      setSavedTree(updated);
      setIsSaved(true);

      toast.success(`${type === "file" ? "File" : "Folder"} deleted: ${path}`);
      setDeleteConfirmOpen(false);
      setDeleteConfirmItem(null);
    } catch (error) {
      console.error("[Project] Failed to delete:", error);
      toast.error("Failed to delete");
    } finally {
      setIsDeleting(false);
    }
  };

  // Warn before closing the tab with unsaved edits
  useEffect(() => {
    if (isSaved) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isSaved]);

  // Ctrl/Cmd+S also works when focus is outside the editor
  const saveRef = useRef(handleSave);
  useEffect(() => {
    saveRef.current = handleSave;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!project) {
    return <ProjectSkeleton />;
  }

  const unreadMessages = chatPanel.collapsed
    ? messages.slice(seenMessageCount).filter((m) => m.type === "incoming").length
    : 0;
  const collapseChat = () => {
    setSeenMessageCount(messages.length);
    chatPanel.setCollapsed(true);
  };
  const explorerWidthClass = explorerPane.collapsed
    ? "md:w-12"
    : explorerPane.width
      ? "md:w-(--explorer-w)"
      : "md:w-64";
  const chatWidthClass = chatPanel.collapsed
    ? "md:w-12"
    : chatPanel.width
      ? "md:w-(--chat-w)"
      : "md:w-[30%] lg:w-[28%] md:min-w-72 md:max-w-[460px]";

  // The class teacher can turn the AI off for students
  const aiDisabled = Boolean(project.aiDisabled);
  const mentionables: Mentionable[] = [
    ...(aiDisabled ? [] : [{ id: "vex", handle: "Vex", label: "Vex AI", isAI: true }]),
    ...project.users
      .filter((member) => member._id !== user?._id)
      .map((member) => ({
        id: member._id,
        handle: member.username,
        label: member.name || member.username,
      })),
  ];

  const mobileTabs: { id: MobileTab; label: string; icon: typeof MessageSquare }[] = [
    { id: "chat", label: "Chat", icon: MessageSquare },
    { id: "files", label: "Files", icon: FolderTree },
    { id: "code", label: "Code", icon: Code2 },
  ];

  return (
    <main className="h-[calc(100dvh-4rem)] flex flex-col md:flex-row overflow-hidden">
      <section
        ref={chatPanel.panelRef}
        aria-label="Chat"
        style={chatPanel.width ? ({ "--chat-w": `${chatPanel.width}px` } as CSSProperties) : undefined}
        className={`${mobileTab === "chat" ? "flex" : "hidden"} md:flex relative flex-col flex-1 min-h-0 md:flex-none ${chatWidthClass} ${chatPanel.isResizing ? "" : "md:transition-[width] md:duration-200"} border-r border-white/10 bg-zinc-950 overflow-hidden`}
      >
        {chatPanel.collapsed && (
          <ChatRail
            unread={unreadMessages}
            isAiThinking={isAiThinking}
            isTyping={Object.keys(typingUsers).length > 0}
            members={project.users}
            currentUserId={user?._id}
            onExpand={() => chatPanel.setCollapsed(false)}
          />
        )}

        {/* Stays mounted while collapsed, so the draft and scroll position survive */}
        <div className={`flex flex-col flex-1 min-h-0 ${chatPanel.collapsed ? "md:hidden" : ""}`}>
        {/* Header */}
        <ProjectHeader
          project={project}
          isSidePanelOpen={isSidePanelOpen}
          onToggleSidePanel={() => setIsSidePanelOpen((prev) => !prev)}
          onCollapse={collapseChat}
        />

        {project.assignment && <AssignmentCard assignment={project.assignment} isTeacher={!project.isOwner} />}

        {/* Message Area */}
        <MessageArea
          messages={messages}
          message={message}
          onMessageChange={setMessage}
          onSend={handleSend}
          onTyping={handleTyping}
          typingUsers={typingUsers}
          isAiThinking={isAiThinking}
          onDeleteMessage={handleDeleteMessage}
          onApplyFiles={handleApplyFiles}
          aiDisabled={aiDisabled}
          aiHintsOnly={project.aiPolicy === "hints"}
          inputProps={{
            mentionables,
            aiMode: aiMode && !aiDisabled,
            onToggleAiMode: aiDisabled ? undefined : toggleAiMode,
            onEnhance: aiDisabled ? undefined : handleEnhancePrompt,
            aiContext:
              !aiDisabled && activeFile && activeFile !== ".aivex" && !aiContextDismissed
                ? {
                    label: editorSelection
                      ? `${activeFile.split("/").pop()} · lines ${editorSelection.startLine}–${editorSelection.endLine}`
                      : activeFile,
                    onRemove: () => setAiContextDismissed(true),
                  }
                : null,
          }}
        />

        {/* Side Panel */}
        <SidePanel
          isOpen={isSidePanelOpen}
          onClose={() => setIsSidePanelOpen(false)}
          project={project}
          isOwner={isOwner}
          onAddMember={handleAddMember}
          onDelete={handleDeleteProject}
          onLeave={handleLeaveProject}
          onTransferOwnership={handleTransferOwnership}
          onRemoveMember={handleRemoveMember}
          onCancelInvite={handleCancelInvite}
          onSaveMemory={handleSaveMemory}
          currentUserId={user?._id}
          invitePermissionError={invitePermissionError}
          deletePermissionError={deletePermissionError}
        />
        </div>

        {!chatPanel.collapsed && <PaneResizer pane={chatPanel} label="Resize chat" />}

        {/* Invite User Modal */}
        <Suspense fallback={null}>
          <InviteUserModal
            isOpen={inviteModalOpen}
            onClose={() => setInviteModalOpen(false)}
            onSelectUser={handleSelectUser}
            projectId={projectId}
            existingMembers={project.users || []}
            pendingInvites={(project.invites ?? []).map((i) => i.user)}
          />
        </Suspense>

        {/* Delete Project Modal */}
        <Suspense fallback={null}>
          <DeleteProjectModal
            isOpen={deleteModalOpen}
            onClose={() => setDeleteModalOpen(false)}
            onConfirm={handleConfirmDelete}
            projectName={project.name}
            isLoading={isDeleting}
          />
        </Suspense>

        {/* Leave Project Modal */}
        <Suspense fallback={null}>
          <LeaveProjectModal
            isOpen={isLeaveOpen}
            onClose={() => setIsLeaveOpen(false)}
            onConfirm={handleConfirmLeave}
            projectName={project.name}
            isLoading={isLeaving}
            isOwner={isOwner}
          />
        </Suspense>

        {/* Delete File/Folder Confirmation Modal */}
        <Suspense fallback={null}>
          <DeleteConfirmModal
            isOpen={deleteConfirmOpen}
            onClose={() => {
              setDeleteConfirmOpen(false);
              setDeleteConfirmItem(null);
            }}
            onConfirm={handleConfirmDeleteFile}
            itemName={deleteConfirmItem?.path}
            itemType={deleteConfirmItem?.type}
            isLoading={isDeleting}
          />
        </Suspense>
      </section>

      <div
        ref={explorerPane.panelRef}
        style={explorerPane.width ? ({ "--explorer-w": `${explorerPane.width}px` } as CSSProperties) : undefined}
        className={`${mobileTab === "files" ? "flex" : "hidden"} md:flex relative flex-1 min-h-0 md:flex-none ${explorerWidthClass} ${explorerPane.isResizing ? "" : "md:transition-[width] md:duration-200"}`}
      >
      {explorerPane.collapsed && (
        <ExplorerRail
          onExpand={() => explorerPane.setCollapsed(false)}
          onQuickOpen={() => setIsQuickOpen(true)}
        />
      )}
      <FileExplorer
        className={`flex flex-1 min-h-0 min-w-0 ${explorerPane.collapsed ? "md:hidden" : ""}`}
        onCollapse={() => explorerPane.setCollapsed(true)}
        fileTree={flatFileTree}
        activeFile={activeFile}
        onSelectFile={(path) => {
          selectFile(path);
          setMobileTab("code");
        }}
        onCreateFile={handleCreateFile}
        onDeleteFile={handleDeleteFile}
        onRenameItem={handleRenameItem}
        onDownload={handleDownload}
      />
      {!explorerPane.collapsed && <PaneResizer pane={explorerPane} label="Resize files" />}
      </div>

      <section
        className={`${mobileTab === "code" ? "flex" : "hidden"} md:flex flex-col flex-1 min-w-0 min-h-0 bg-black`}
      >
        <Suspense
          fallback={
            <div className="flex-1 flex items-center justify-center gap-2 text-sm text-zinc-500">
              <Loader2 size={16} className="animate-spin" /> Loading editor…
            </div>
          }
        >
          <CodeEditor
            activeFile={activeFile}
            fileTree={flatFileTree}
            onChange={(newCode) => {
              if (!activeFile) return;
              setFlatFileTree((prev) => ({
                ...prev,
                [activeFile]: newCode,
              }));
              setIsSaved(false);
            }}
            onSave={handleSave}
            onSelectionChange={setEditorSelection}
            handleRun={handleRun}
            handleUpdate={handleUpdate}
            handleStop={handleStop}
            onRunFile={handleRunFile}
            onStopFile={stopCRun}
            isRunningFile={isRunningFile}
            isSaving={isSaving}
            runProgress={runProgress}
            isSaved={isSaved}
            originalIsRunning={originalIsRunning}
            isLivePreview={Boolean(staticPage)}
            isStaticSite={isStatic}
            canPreview={Boolean(previewUrl)}
            preview={setShowPreview}
            openFiles={openFiles}
            dirtyFiles={dirtyFiles}
            collab={collab}
            peers={peers}
            onSelectTab={selectFile}
            onCloseTab={closeTab}
            onQuickOpen={() => setIsQuickOpen(true)}
            onBrowseFiles={() => setMobileTab("files")}
            onOpenPreviewTab={() => {
              if (staticPage) {
                openStaticPreviewTab();
                return;
              }
              // The preview server lives in this tab; keep it open while using the new one
              if (previewUrl) window.open(previewUrl, "_blank", "noopener");
            }}
          />
        </Suspense>

        <OutputPanel
          lines={outputLines}
          isOpen={isOutputOpen}
          onToggle={() => setIsOutputOpen((v) => !v)}
          onClear={() => {
            setOutputLines([]);
            setNodeRun(null);
          }}
          showInput={Boolean(getRunnerLanguage(activeFile))}
          stdin={stdin}
          onStdinChange={setStdin}
          revealOutputKey={revealOutputKey}
          run={nodeRun}
          awaitingInput={awaitingInput}
          onSubmitInput={(text) => {
            echoInput(text);
            setAwaitingInput(false);
            cRunRef.current?.provideInput(text);
          }}
          onEndInput={() => {
            setAwaitingInput(false);
            cRunRef.current?.sendEof();
          }}
        />

        {isQuickOpen && (
          <QuickOpen
            files={visibleFiles}
            onOpen={(path) => {
              selectFile(path);
              setMobileTab("code");
            }}
            onClose={() => setIsQuickOpen(false)}
          />
        )}

        {showPreview && (
          <PreviewOverlay
            url={staticPage ? `/${staticPage}` : previewUrl}
            baseUrl={previewBaseUrl}
            srcDoc={staticHtml}
            onOpenTab={staticPage ? openStaticPreviewTab : undefined}
            onNavigate={(target) => {
              if (!staticPage) {
                setPreviewUrl(target);
                return;
              }
              const page = target.replace(/^\/+/, "") || "index.html";
              if (page in flatFileTree) setStaticPage(page);
              else toast.warning(`No page ${page}`);
            }}
            onClose={() => setShowPreview(false)}
          />
        )}
      </section>

      {/* Mobile pane switcher */}
      <nav className="md:hidden shrink-0 h-14 flex border-t border-white/10 bg-zinc-950" aria-label="Project panes">
        {mobileTabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setMobileTab(id)}
            aria-current={mobileTab === id ? "page" : undefined}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] ${
              mobileTab === id ? "text-teal-400" : "text-zinc-500"
            }`}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </nav>
    </main>
  );
};

export default Project;
