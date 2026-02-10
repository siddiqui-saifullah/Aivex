import { useEffect, useState, useRef, useContext } from "react";
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
import InviteUserModal from "../components/project/InviteUserModal";
import FileExplorer from "../components/project/FileExplorer";
import CodeEditor from "../components/project/CodeEditor";
import PreviewOverlay from "../components/project/PreviewOverlay";
import {
  DeleteProjectModal,
  LeaveProjectModal,
} from "../components/dashboard/modals";
import {
  initializeSocket,
  receiveMessage,
  sendMessage,
  removeMessageListener,
} from "../config/socket";
import { UserContext } from "../context/user.context";
import { useToast } from "../context/toast.context"; // 1. Fixed Import
import {
  getWebContainer,
  runWebcontainer,
  stopWebcontainer,
} from "../config/webContainer";
import { hasFileTreeChanges } from "../utils/fileTreeDetector";
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

  // Message state
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");

  // FileTree states
  const [originalFileTree, setOriginalFileTree] = useState({});
  const [dbFileTree, setDbFileTree] = useState({});
  const [flatFileTree, setFlatFileTree] = useState({});

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

  useEffect(() => {
    if (!projectId) return;

    setMessages([]);
    setMessage("");
    clearAllTypingUsers();

    initializeSocket(projectId);
    fetchProject().then((projectData) => {
      if (projectData) {
        fetchProjectChats(projectData);
      }
    });

    if (!webContainer) {
      getWebContainer().then((container) => {
        setWebContainer(container);
        console.log("Container Started");
      });
    }

    const handleProjectMessage = (socketData) => {
      const normalizedMessage = normalizeSocketMessage(
        socketData,
        user?._id,
        project?.users,
      );
      console.log("[Project] Normalized message:", normalizedMessage);
      setMessages((prev) => [...prev, normalizedMessage]);

      if (normalizedMessage.fileTree) {
        console.log("[Project] Setting fileTree:", normalizedMessage.fileTree);
        setFlatFileTree(normalizedMessage.fileTree);
      }

      if (socketData.fileTree) {
        console.log(
          "[Project] Setting original fileTree:",
          socketData.fileTree,
        );
        setOriginalFileTree(socketData.fileTree);
      }
    };

    const handleUserJoined = (data) => {
      console.log("User joined:", data.username);
      const joinMessage = createSystemMessage(
        `${data.username} joined the project`,
        data.timestamp,
      );
      setMessages((prev) => [...prev, joinMessage]);
    };

    const handleUserTypingEvent = (data) => {
      console.log("User typing:", data.username, data.isTyping);
      handleUserTyping(data.userId, data.username, data.isTyping);
    };

    receiveMessage("project-message", handleProjectMessage);
    receiveMessage("user-joined", handleUserJoined);
    receiveMessage("user-typing", handleUserTypingEvent);

    return () => {
      removeMessageListener("project-message", handleProjectMessage);
      removeMessageListener("user-joined", handleUserJoined);
      removeMessageListener("user-typing", handleUserTypingEvent);
      clearAllTypingUsers();
    };
  }, [projectId, user?._id]);

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
    const hasChanges = hasFileTreeChanges(dbFileTree, flatFileTree);

    if (hasChanges && !isSaved) {
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
        <InviteUserModal
          isOpen={inviteModalOpen}
          onClose={() => setInviteModalOpen(false)}
          onSelectUser={handleSelectUser}
          projectId={projectId}
          existingMembers={project?.users || []}
        />

        {/* Delete Project Modal */}
        <DeleteProjectModal
          isOpen={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          onConfirm={handleConfirmDelete}
          projectName={project?.name}
          isLoading={isDeleting}
        />

        {/* Leave Project Modal */}
        <LeaveProjectModal
          isOpen={isLeaveOpen}
          onClose={() => setIsLeaveOpen(false)}
          onConfirm={handleConfirmLeave}
          projectName={project?.name}
          isLoading={isLeaving}
          isOwner={isOwner}
        />
      </section>

      <section className="right flex bg-amber-50 w-[77%]">
        <FileExplorer
          fileTree={flatFileTree}
          activeFile={activeFile}
          onSelectFile={setActiveFile}
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
