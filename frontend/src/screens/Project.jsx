import { useEffect, useState, useRef, useContext, lazy, Suspense } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getProjectById,
  getProjectChats,
  updateProjectFiles,
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
import {
  initializeSocket,
  receiveMessage,
  sendMessage,
  removeMessageListener,
} from "../config/socket";
import { UserContext } from "../context/user.context";
import { useToast } from "../context/toast.context";
import {
  getWebContainer,
  runWebcontainer,
  stopWebcontainer,
} from "../config/webContainer";
import { hasFileTreeChanges } from "../utils/fileTreeDetector";
import {
  addFileToTree,
  deleteFileFromTree,
  pathExists,
} from "../utils/buildFileTree";
import { deleteProject, leaveProject } from "../services/project.service";
import ProjectSkeleton from "../components/Loders/ProjectSkeleton";

const Project = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(UserContext);
  const toast = useToast(); // 2. Fixed Hook Usage

  // Project state
  const [project, setProject] = useState(null);
  const [isOwner, setIsOwner] = useState(false);

  // UI state
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [invitePermissionError, setInvitePermissionError] = useState(false);
  const [deletePermissionError, setDeletePermissionError] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLeaveOpen, setIsLeaveOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [activeFile, setActiveFile] = useState(null);

  // File management state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState(null);
  const [selectedPath, setSelectedPath] = useState("");

  // Message state
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");

  // FileTree states
  const [originalFileTree, setOriginalFileTree] = useState({});
  const [dbFileTree, setDbFileTree] = useState({});
  const [flatFileTree, setFlatFileTree] = useState({});
  const [emptyFolders, setEmptyFolders] = useState(new Set());

  // Web Container State
  const [webContainer, setWebContainer] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [runProgress, setRunProgress] = useState("");
  const runningProcessRef = useRef(null);
  const [originalIsRunning, setOriginalIsRunning] = useState(false);
  const [isSaved, setIsSaved] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [showPreview, setShowPreview] = useState(false);
  const [previewBaseUrl, setPreviewBaseUrl] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  function toWebContainerTree(flatTree) {
    const root = {};

    for (const [path, contents] of Object.entries(flatTree)) {
      const parts = path.split("/");
      let current = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isFile = i === parts.length - 1;

        if (isFile) {
          current[part] = {
            file: {
              contents: contents,
            },
          };
        } else {
          current[part] ??= { directory: {} };
          current = current[part].directory;
        }
      }
    }

    return root;
  }

  // Typing indicator state
  const {
    typingUsers,
    handleUserTyping,
    clearAllTypingUsers,
    typingTimeoutRef,
  } = useTypingIndicator();

  const fetchProject = async () => {
    try {
      const data = await getProjectById(projectId);
      setProject(data.project);
      setIsOwner(data.project.isOwner);

      if (data.project?.files || data.project?.flatFileTree) {
        const files = data.project.files || data.project.flatFileTree;
        console.log("[Project] Loading initial files from project:", files);
        setFlatFileTree(files);
        setDbFileTree(files);
        setIsSaved(true);
      }
      return data.project;
    } catch (err) {
      console.error("Failed to fetch project:", err);
    }
  };

  const fetchProjectChats = async (projectData) => {
    try {
      const response = await getProjectChats(projectId);
      const chats = response.projectChats || [];

      if (Array.isArray(chats) && chats.length > 0) {
        const currentUserId = user?._id;
        const userMap = {};
        if (projectData?.users && Array.isArray(projectData.users)) {
          projectData.users.forEach((member) => {
            userMap[member._id] = member.username || member.name;
          });
        }

        const normalizedChats = chats.map((chat) => {
          const isFromCurrentUser =
            String(chat.sender) === String(currentUserId);
          const senderId = chat.sender;
          const isAI = chat.isAI || chat.role === "ai";

          let username = "Unknown User";
          if (isAI) {
            username = "Aivex";
          } else {
            username = userMap[senderId] || "Unknown User";
          }

          return {
            id: chat.id,
            text: chat.text,
            role: chat.role,
            senderId: senderId,
            username: username,
            filePatch: chat.filePatch,
            timestamp: chat.createdAt,
            type: isFromCurrentUser ? "outgoing" : "incoming",
            isAI: isAI,
          };
        });

        setMessages(normalizedChats);
        console.log("[Project] Chat history loaded:", normalizedChats);
      }
    } catch (err) {
      console.error("Failed to fetch chat history:", err);
    }
  };

  // useEffect(() => {
  //   if (!projectId) return;

  //   setMessages([]);
  //   setMessage("");
  //   clearAllTypingUsers();

  //   initializeSocket(projectId);
  //   fetchProject().then((projectData) => {
  //     if (projectData) {
  //       fetchProjectChats(projectData);
  //     }
  //   });

  //   if (!webContainer) {
  //     getWebContainer().then((container) => {
  //       setWebContainer(container);
  //       console.log("Container Started");
  //     });
  //   }

  //   const handleProjectMessage = (socketData) => {
  //     const normalizedMessage = normalizeSocketMessage(
  //       socketData,
  //       user?._id,
  //       project?.users,
  //     );
  //     console.log("[Project] Normalized message:", normalizedMessage);
  //     setMessages((prev) => [...prev, normalizedMessage]);

  //     if (normalizedMessage.fileTree) {
  //       console.log("[Project] Setting fileTree:", normalizedMessage.fileTree);
  //       setFlatFileTree(normalizedMessage.fileTree);
  //     }

  //     if (socketData.fileTree) {
  //       console.log(
  //         "[Project] Setting original fileTree:",
  //         socketData.fileTree,
  //       );
  //       setOriginalFileTree(socketData.fileTree);
  //     }
  //   };

  //   const handleUserJoined = (data) => {
  //     console.log("User joined:", data.username);
  //     const joinMessage = createSystemMessage(
  //       `${data.username} joined the project`,
  //       data.timestamp,
  //     );
  //     setMessages((prev) => [...prev, joinMessage]);
  //   };

  //   const handleUserTypingEvent = (data) => {
  //     console.log("User typing:", data.username, data.isTyping);
  //     handleUserTyping(data.userId, data.username, data.isTyping);
  //   };

  //   receiveMessage("project-message", handleProjectMessage);
  //   receiveMessage("user-joined", handleUserJoined);
  //   receiveMessage("user-typing", handleUserTypingEvent);

  //   return () => {
  //     removeMessageListener("project-message", handleProjectMessage);
  //     removeMessageListener("user-joined", handleUserJoined);
  //     removeMessageListener("user-typing", handleUserTypingEvent);
  //     clearAllTypingUsers();
  //   };
  // }, [projectId, user?._id]);

  useEffect(() => {
    if (!projectId || !user?._id) return;

    let isMounted = true;

    /* ---------- RESET STATE ---------- */
    setMessages([]);
    setMessage("");
    clearAllTypingUsers();

    /* ---------- SOCKET INIT ---------- */
    initializeSocket(projectId);

    fetchProject().then((projectData) => {
      if (projectData && isMounted) {
        fetchProjectChats(projectData);
      }
    });

    /* ---------- WEB CONTAINER (BROWSER ONLY, ONCE) ---------- */
    if (!webContainer && typeof window !== "undefined") {
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
    }

    /* ---------- SOCKET HANDLERS ---------- */
    const handleProjectMessage = (socketData) => {
      const normalizedMessage = normalizeSocketMessage(
        socketData,
        user._id,
        project?.users,
      );

      setMessages((prev) => [...prev, normalizedMessage]);

      if (normalizedMessage.fileTree) {
        setFlatFileTree((prev) => {
          // Preserve .aivex system file when AI sends new fileTree
          const aivex = prev[".aivex"];
          return {
            ...normalizedMessage.fileTree,
            ...(aivex ? { ".aivex": aivex } : {}),
          };
        });
        setIsSaved(false);
      }

      if (socketData.fileTree) {
        setOriginalFileTree(socketData.fileTree);
      }
    };

    const handleUserJoined = (data) => {
      setMessages((prev) => [
        ...prev,
        createSystemMessage(
          `${data.username} joined the project`,
          data.timestamp,
        ),
      ]);
    };

    const handleUserTypingEvent = (data) => {
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

      clearAllTypingUsers();
    };
  }, [projectId, user?._id, webContainer]);

  useEffect(() => {
    if (!webContainer || Object.keys(originalFileTree).length === 0) {
      return;
    }

    (async () => {
      try {
        console.log(
          "[Project] Mounting files to WebContainer:",
          originalFileTree,
        );
        await webContainer.mount(toWebContainerTree(flatFileTree));
        console.log("[Project] Files mounted successfully");
      } catch (error) {
        console.error("[Project] Failed to mount files:", error);
      }
    })();
  }, [webContainer, originalFileTree]);

  const handleSend = () => {
    if (!message.trim()) return;

    const userMessage = formatUserMessage(message, user);
    setMessages((prev) => [...prev, userMessage]);

    sendMessage("project-message", {
      message,
    });

    setMessage("");
  };

  const handleTyping = (isTyping) => {
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
      // 3. Fixed Error Logic: Now correctly shows warning
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
      // 4. Fixed Error Logic: Now correctly shows error
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

  const handleSelectUser = async (users) => {
    console.log("Users added to project:", users);
    const addedUserMessages = users.map((user) => ({
      text: `${user.username} was added to the project`,
      type: "system",
      timestamp: Date.now(),
    }));

    setMessages((prev) => [...prev, ...addedUserMessages]);

    try {
      const updatedData = await getProjectById(projectId);
      setProject(updatedData.project);
    } catch (err) {
      console.error("Failed to refresh project:", err);
    }
  };

  const handleRun = async () => {
    if (!isSaved) {
      setRunProgress("Saving files...");
      setIsSaving(true);

      try {
        await updateProjectFiles(projectId, flatFileTree);
        setDbFileTree(flatFileTree);
        setIsSaved(true);
      } catch (error) {
        console.error("Failed to save files:", error);
        toast.error("Failed to save files");
        setRunProgress("");
        setIsSaving(false);
        return;
      } finally {
        setRunProgress("");
        setIsSaving(false);
      }
    }

    setIsRunning(true);
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
      setIsRunning(false);
    }
  };

  const handleUpdate = async () => {
    if (isSaved) return;

    setIsSaving(true);
    setRunProgress("Updating files...");

    try {
      await updateProjectFiles(projectId, flatFileTree);
      setDbFileTree(flatFileTree);
      setIsSaved(true);

      stopWebcontainer();
      await handleRun();

      setRunProgress("");
    } catch (error) {
      console.error("Failed to update files:", error);
      toast.error("Failed to update files");
      setRunProgress("");
    } finally {
      setIsSaving(false);
    }
  };

  const handleStop = () => {
    const stopped = stopWebcontainer();
    if (stopped) {
      setIsRunning(false);
      setOriginalIsRunning(false);
      setRunProgress("");
      setShowPreview(false);
      toast.info("Server stopped");
    } else {
      toast.error("Failed to stop server");
    }
  };

  const handleCreateFile = async ({ name, type, path }) => {
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
          setDbFileTree(updated);
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

  const handleDeleteFile = async (path, type) => {
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
    console.log("[Project] Deleting:", {
      path,
      type,
      treeKeys: Object.keys(flatFileTree),
    });

    try {
      setIsDeleting(true);

      // Deselect active file if it's being deleted
      if (activeFile === path || activeFile?.startsWith(path + "/")) {
        setActiveFile(null);
      }

      const updated = { ...flatFileTree };
      console.log("[Project] Before delete:", Object.keys(updated));

      if (type === "file") {
        // Delete single file (both root and nested)
        console.log(
          "[Project] Deleting file:",
          path,
          "| Exists:",
          path in updated,
        );
        delete updated[path];
        console.log("[Project] After delete, exists:", path in updated);
      } else if (type === "folder") {
        // Delete all files in folder (route/h.js, route/p.js, etc.)
        const deletedFiles = [];
        Object.keys(updated).forEach((filePath) => {
          if (filePath.startsWith(path + "/")) {
            console.log("[Project] Deleting from folder:", filePath);
            delete updated[filePath];
            deletedFiles.push(filePath);
          }
        });
        console.log("[Project] Deleted files from folder:", deletedFiles);
      }

      console.log("[Project] After delete:", Object.keys(updated));

      // Update state
      setFlatFileTree(updated);

      // Save to backend
      await updateProjectFiles(projectId, updated);
      setDbFileTree(updated);
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

  const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

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
            existingMembers={project?.users || []}
          />
        </Suspense>

        {/* Delete Project Modal */}
        <Suspense fallback={null}>
          <DeleteProjectModal
            isOpen={deleteModalOpen}
            onClose={() => setDeleteModalOpen(false)}
            onConfirm={handleConfirmDelete}
            projectName={project?.name}
            isLoading={isDeleting}
          />
        </Suspense>

        {/* Leave Project Modal */}
        <Suspense fallback={null}>
          <LeaveProjectModal
            isOpen={isLeaveOpen}
            onClose={() => setIsLeaveOpen(false)}
            onConfirm={handleConfirmLeave}
            projectName={project?.name}
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
          language="javascript"
          onChange={(newCode) => {
            setFlatFileTree((prev) => ({
              ...prev,
              [activeFile]: newCode,
            }));
            setIsSaved(false);
          }}
          handleRun={handleRun}
          handleUpdate={handleUpdate}
          handleStop={handleStop}
          isRunning={isRunning}
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
