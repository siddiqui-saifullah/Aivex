import { useEffect, useState, useRef, lazy, Suspense } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { WebContainer } from "@webcontainer/api";
import {
  getProjectById,
  getProjectChats,
  updateProjectFiles,
  deleteProject,
  leaveProject,
} from "../services/project.service";
import {
  formatUserMessage,
  createSystemMessage,
  normalizeSocketMessage,
} from "../services/message.service";
import { useTypingIndicator } from "../hooks/useTypingIndicator";
import ProjectHeader from "../components/project/ProjectHeader";
import MessageArea from "../components/project/MessageArea";
import SidePanel from "../components/project/SidePanel";
import FileExplorer from "../components/project/FileExplorer";
import CodeEditor from "../components/project/CodeEditor";
import PreviewOverlay from "../components/project/PreviewOverlay";
import {
  initializeSocket,
  receiveMessage,
  sendMessage,
  removeMessageListener,
  disconnectSocket,
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
  deleteEmptyFolder,
  deleteFileFromTree,
  pathExists,
} from "../utils/buildFileTree";
import { toWebContainerTree } from "../utils/toWebContainerTree";
import ProjectSkeleton from "../components/Loders/ProjectSkeleton";
import type {
  ChatMessage,
  CreateFilePayload,
  FileItemType,
  FlatFileTree,
  ProjectDetails,
  SocketProjectMessage,
  User,
} from "../types";

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

interface UserTypingEvent {
  userId: string;
  username: string;
  isTyping: boolean;
}

const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

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
  const [emptyFolders, setEmptyFolders] = useState<Set<string>>(new Set());

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
    initializeSocket(projectId);

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
      setFlatFileTree(projectData.files || projectData.flatFileTree || {});
      setIsSaved(true);

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

      const aiFileTree = normalizedMessage.fileTree;
      if (aiFileTree) {
        setFlatFileTree((prev) => {
          // Preserve .aivex system file when AI sends new fileTree
          const aivex = prev[".aivex"];
          return {
            ...aiFileTree,
            ...(aivex ? { ".aivex": aivex } : {}),
          };
        });
        setIsSaved(false);
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

    receiveMessage("project-message", handleProjectMessage);
    receiveMessage("user-joined", handleUserJoined);
    receiveMessage("user-typing", handleUserTypingEvent);

    /* ---------- CLEANUP ---------- */
    return () => {
      isMounted = false;

      removeMessageListener("project-message", handleProjectMessage);
      removeMessageListener("user-joined", handleUserJoined);
      removeMessageListener("user-typing", handleUserTypingEvent);

      // Leave the project room when navigating away
      disconnectSocket();
      clearAllTypingUsers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, user?._id]);

  const handleSend = () => {
    if (!message.trim()) return;

    const userMessage = formatUserMessage(message, user);
    setMessages((prev) => [...prev, userMessage]);

    // The server only answers messages that start with "@vex"
    if (message.trim().toLowerCase().startsWith("@vex")) {
      setIsAiThinking(true);
    }

    sendMessage("project-message", {
      message,
    });

    setMessage("");
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
        "Project owner cannot leave. Transfer ownership or delete the project.",
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
    const addedUserMessages: ChatMessage[] = users.map((user) => ({
      text: `${user.username} was added to the project`,
      type: "system",
      timestamp: Date.now(),
    }));

    setMessages((prev) => [...prev, ...addedUserMessages]);

    try {
      applyProject(await getProjectById(projectId));
    } catch (err) {
      console.error("Failed to refresh project:", err);
    }
  };

  /** Persist the current file tree. Returns false (and toasts) on failure. */
  const saveFiles = async (progressLabel: string): Promise<boolean> => {
    setRunProgress(progressLabel);
    setIsSaving(true);

    try {
      await updateProjectFiles(projectId, flatFileTree);
      setIsSaved(true);
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

  const startServer = async () => {
    setOriginalIsRunning(true);
    setRunProgress("Installing dependencies...");

    try {
      await runWebcontainer(
        webContainer,
        toWebContainerTree(flatFileTree),
        ({ url }) => {
          setPreviewBaseUrl(url);
          setPreviewUrl(url);
          setShowPreview(true);
          setRunProgress("Server running...");
        },
        (progress) => {
          setRunProgress(progress);
        },
      );
    } catch (error) {
      console.error("Failed to run webcontainer:", error);
      setRunProgress("Error starting server");
      setOriginalIsRunning(false);
    }
  };

  const handleRun = async () => {
    if (!webContainer) {
      toast.warning("The runtime is still starting. Please try again shortly.");
      return;
    }

    if (!isSaved && !(await saveFiles("Saving files..."))) return;

    await startServer();
  };

  const handleUpdate = async () => {
    if (isSaved) return;

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
      toast.info("Server stopped");
    } else {
      toast.error("Failed to stop server");
    }
  };

  const handleCreateFile = async ({ name, type, path }: CreateFilePayload) => {
    try {
      const fullPath = path ? `${path}/${name}` : name;

      // Check if file/folder already exists
      if (pathExists(flatFileTree, fullPath, emptyFolders)) {
        toast.error(`${capitalize(type)} already exists: ${fullPath}`);
        return;
      }

      if (type === "file") {
        // Add file to flatFileTree
        const updated = addFileToTree(flatFileTree, fullPath, "");
        setFlatFileTree(updated);
        setActiveFile(fullPath);
        setIsSaved(false);

        // Remove parent folder from emptyFolders if it exists
        if (path && emptyFolders.has(path)) {
          const updatedEmptyFolders = new Set(emptyFolders);
          updatedEmptyFolders.delete(path);
          setEmptyFolders(updatedEmptyFolders);
        }

        // Auto-save to backend
        try {
          await updateProjectFiles(projectId, updated);
          setIsSaved(true);
          toast.success(`File created: ${fullPath}`);
        } catch (error) {
          console.error("Failed to save file:", error);
          toast.warning(`File created locally. Save pending...`);
        }
      } else if (type === "folder") {
        // Add folder to emptyFolders
        const updated = new Set(emptyFolders);
        updated.add(fullPath);
        setEmptyFolders(updated);
        toast.success(`Folder created: ${fullPath}`);
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

      // Deselect active file if it's being deleted
      if (activeFile === path || activeFile?.startsWith(path + "/")) {
        setActiveFile(null);
      }

      // Removes the file, or every file under the folder
      const updated = deleteFileFromTree(flatFileTree, path);

      setFlatFileTree(updated);
      if (type === "folder") {
        setEmptyFolders((prev) => deleteEmptyFolder(prev, path));
      }

      // Save to backend
      await updateProjectFiles(projectId, updated);
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

  if (!project) {
    return <ProjectSkeleton />;
  }

  return (
    <main className="h-[calc(100vh-4rem)] flex overflow-hidden">
      <section className="flex flex-col h-full w-[23%] min-w-60 border-r border-white/10 overflow-hidden">
        {/* Header */}
        <ProjectHeader
          project={project}
          isSidePanelOpen={isSidePanelOpen}
          onToggleSidePanel={() => setIsSidePanelOpen((prev) => !prev)}
        />

        {/* Message Area */}
        <MessageArea
          messages={messages}
          message={message}
          onMessageChange={setMessage}
          onSend={handleSend}
          onTyping={handleTyping}
          typingUsers={typingUsers}
          isAiThinking={isAiThinking}
        />

        {/* Side Panel */}
        <SidePanel
          isOpen={isSidePanelOpen}
          project={project}
          isOwner={isOwner}
          onAddMember={handleAddMember}
          onDelete={handleDeleteProject}
          onLeave={handleLeaveProject}
          invitePermissionError={invitePermissionError}
          deletePermissionError={deletePermissionError}
        />

        {/* Invite User Modal */}
        <Suspense fallback={null}>
          <InviteUserModal
            isOpen={inviteModalOpen}
            onClose={() => setInviteModalOpen(false)}
            onSelectUser={handleSelectUser}
            projectId={projectId}
            existingMembers={project.users || []}
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

      <section className="right flex bg-amber-50 w-[77%]">
        <FileExplorer
          fileTree={flatFileTree}
          activeFile={activeFile}
          onSelectFile={setActiveFile}
          onCreateFile={handleCreateFile}
          onDeleteFile={handleDeleteFile}
          emptyFolders={emptyFolders}
        />

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
          handleRun={handleRun}
          handleUpdate={handleUpdate}
          handleStop={handleStop}
          isSaving={isSaving}
          runProgress={runProgress}
          isSaved={isSaved}
          originalIsRunning={originalIsRunning}
          preview={setShowPreview}
        />

        {showPreview && (
          <PreviewOverlay
            url={previewUrl}
            baseUrl={previewBaseUrl}
            onNavigate={setPreviewUrl}
            onClose={() => setShowPreview(false)}
          />
        )}
      </section>
    </main>
  );
};

export default Project;
