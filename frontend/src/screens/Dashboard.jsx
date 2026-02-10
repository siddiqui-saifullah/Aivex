import { useEffect, useState } from "react";
import { Plus } from "lucide-react";

import Button from "../components/ui/Button";
import ProjectList from "../components/dashboard/ProjectList";
import ProjectFilter from "../components/dashboard/ProjectFilter";
import {
  CreateProjectModal,
  DeleteProjectModal,
  RenameProjectModal,
  LeaveProjectModal,
} from "../components/dashboard/modals";

import { useProjectList } from "../hooks/useProjectList";
import { useUser } from "../context/user.context.jsx";
import { useToast } from "../context/toast.context.jsx";
import { leaveProject, updateProjectName } from "../services/project.service";

export default function Dashboard() {
  const { user } = useUser();
  const toast = useToast();

  const {
    projects,
    state,
    fetchProjects,
    handleDelete,
    handleRename,
    handleCreate,
  } = useProjectList(user);

  const [filter, setFilter] = useState("all");

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);

  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [selectedProjectName, setSelectedProjectName] = useState("");

  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  /* -------------------------------------------------------------------------- */
  /* FETCH PROJECTS                                                             */
  /* -------------------------------------------------------------------------- */
  useEffect(() => {
    if (user) fetchProjects();
  }, [user, fetchProjects]);

  /* -------------------------------------------------------------------------- */
  /* FILTER LOGIC                                                               */
  /* -------------------------------------------------------------------------- */
  const filteredProjects =
    filter === "my-projects" ? projects.filter((p) => p.isOwner) : projects;

  /* -------------------------------------------------------------------------- */
  /* DELETE PROJECT                                                             */
  /* -------------------------------------------------------------------------- */
  const handleDeleteWithConfirm = (id, name) => {
    setSelectedProjectId(id);
    setSelectedProjectName(name);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    try {
      setIsDeleting(true);
      await handleDelete(selectedProjectId);
      setDeleteModalOpen(false);
      setSelectedProjectId(null);
      setSelectedProjectName("");
    } catch (err) {
      toast.error("Failed to delete project");
    } finally {
      setIsDeleting(false);
    }
  };

  /* -------------------------------------------------------------------------- */
  /* RENAME PROJECT                                                             */
  /* -------------------------------------------------------------------------- */
  const handleRenameWithConfirm = (id, name) => {
    setSelectedProjectId(id);
    setSelectedProjectName(name);
    setRenameModalOpen(true);
  };

  const handleConfirmRename = async (newName) => {
    try {
      setIsRenaming(true);

      await updateProjectName(selectedProjectId, newName);

      await fetchProjects();

      setRenameModalOpen(false);
      setSelectedProjectId(null);
      setSelectedProjectName("");
      toast.success("Project renamed successfully");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to rename project");
      throw err;
    } finally {
      setIsRenaming(false);
    }
  };

  /* -------------------------------------------------------------------------- */
  /* LEAVE PROJECT                                                              */
  /* -------------------------------------------------------------------------- */
  const handleLeaveWithConfirm = (id, name) => {
    setSelectedProjectId(id);
    setSelectedProjectName(name);
    setLeaveModalOpen(true);
  };

  const handleConfirmLeave = async () => {
    try {
      setIsLeaving(true);
      await leaveProject(selectedProjectId);

      setLeaveModalOpen(false);
      setSelectedProjectId(null);
      setSelectedProjectName("");

      await fetchProjects();
    } catch (err) {
      toast.error(err.response?.data?.message);
    } finally {
      setIsLeaving(false);
    }
  };

  /* -------------------------------------------------------------------------- */
  /* RENDER                                                                     */
  /* -------------------------------------------------------------------------- */
  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-teal-500/30">
      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Dashboard</h1>
            <p className="text-zinc-400 text-sm">
              Manage your projects and development environments.
            </p>
          </div>

          {state !== "empty" && state !== "loading" && (
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => setCreateModalOpen(true)}
              className="shadow-lg shadow-teal-500/20"
            >
              New Project
            </Button>
          )}
        </div>

        {/* Filter */}
        <ProjectFilter activeFilter={filter} onFilterChange={setFilter} />

        {/* Project List */}
        <ProjectList
          state={state}
          projects={filteredProjects}
          userId={user?._id}
          onDelete={handleDeleteWithConfirm}
          onRename={handleRenameWithConfirm}
          onLeave={handleLeaveWithConfirm}
          onRetry={fetchProjects}
          onCreateClick={() => setCreateModalOpen(true)}
        />

        {/* Modals */}
        <CreateProjectModal
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onCreate={handleCreate}
        />

        <DeleteProjectModal
          isOpen={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          onConfirm={handleConfirmDelete}
          projectName={selectedProjectName}
          isLoading={isDeleting}
        />

        <RenameProjectModal
          isOpen={renameModalOpen}
          onClose={() => setRenameModalOpen(false)}
          onConfirm={handleConfirmRename}
          projectName={selectedProjectName}
          isLoading={isRenaming}
        />

        <LeaveProjectModal
          isOpen={leaveModalOpen}
          onClose={() => setLeaveModalOpen(false)}
          onConfirm={handleConfirmLeave}
          projectName={selectedProjectName}
          isLoading={isLeaving}
        />
      </main>
    </div>
  );
}
