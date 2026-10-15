import { useEffect, useState, lazy, Suspense } from "react";
import { Plus, Search } from "lucide-react";

import Button from "../components/ui/Button";
import ProjectList from "../components/dashboard/ProjectList";
import ProjectFilter, { type ProjectFilterId } from "../components/dashboard/ProjectFilter";

// Lazy load modals - they're only shown on specific user actions
const CreateProjectModal = lazy(() =>
  import("../components/dashboard/modals").then((m) => ({
    default: m.CreateProjectModal,
  })),
);
const DeleteProjectModal = lazy(() =>
  import("../components/dashboard/modals").then((m) => ({
    default: m.DeleteProjectModal,
  })),
);
const RenameProjectModal = lazy(() =>
  import("../components/dashboard/modals").then((m) => ({
    default: m.RenameProjectModal,
  })),
);
const LeaveProjectModal = lazy(() =>
  import("../components/dashboard/modals").then((m) => ({
    default: m.LeaveProjectModal,
  })),
);

import { useProjectList } from "../hooks/useProjectList";
import { useUser } from "../context/user.context";
import { useToast } from "../context/toast.context";
import { leaveProject, updateProjectName } from "../services/project.service";
import { getErrorMessage } from "../utils/getErrorMessage";
import { prefetchProjectWorkspace } from "../utils/prefetch";

export default function Dashboard() {
  const { user } = useUser();
  const toast = useToast();

  const {
    projects,
    state,
    fetchProjects,
    handleDelete,
    handleCreate,
  } = useProjectList(user);

  const [filter, setFilter] = useState<ProjectFilterId>("all");
  const [search, setSearch] = useState("");

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
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

  // Load the project workspace in the background so opening one is instant
  useEffect(() => {
    prefetchProjectWorkspace();
  }, []);

  /* -------------------------------------------------------------------------- */
  /* FILTER LOGIC                                                               */
  /* -------------------------------------------------------------------------- */
  // The list endpoint doesn't return `isOwner`, so compare owner ids
  const query = search.trim().toLowerCase();
  const filteredProjects = projects
    .filter((p) => filter !== "my-projects" || String(p.ownerId) === String(user?._id))
    .filter((p) => !query || p.name.toLowerCase().includes(query))
    // Most recently worked-on first
    .sort((a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime());

  /* -------------------------------------------------------------------------- */
  /* DELETE PROJECT                                                             */
  /* -------------------------------------------------------------------------- */
  const handleDeleteWithConfirm = (id: string, name: string) => {
    setSelectedProjectId(id);
    setSelectedProjectName(name);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    try {
      setIsDeleting(true);
      if (!selectedProjectId) return;
      await handleDelete(selectedProjectId);
      setDeleteModalOpen(false);
      setSelectedProjectId(null);
      setSelectedProjectName("");
    } catch {
      toast.error("Failed to delete project");
    } finally {
      setIsDeleting(false);
    }
  };

  /* -------------------------------------------------------------------------- */
  /* RENAME PROJECT                                                             */
  /* -------------------------------------------------------------------------- */
  const handleRenameWithConfirm = (id: string, name: string) => {
    setSelectedProjectId(id);
    setSelectedProjectName(name);
    setRenameModalOpen(true);
  };

  const handleConfirmRename = async (newName: string) => {
    try {
      setIsRenaming(true);

      if (!selectedProjectId) return;
      await updateProjectName(selectedProjectId, newName);

      await fetchProjects();

      setRenameModalOpen(false);
      setSelectedProjectId(null);
      setSelectedProjectName("");
      toast.success("Project renamed successfully");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to rename project"));
      throw err;
    } finally {
      setIsRenaming(false);
    }
  };

  /* -------------------------------------------------------------------------- */
  /* LEAVE PROJECT                                                              */
  /* -------------------------------------------------------------------------- */
  const handleLeaveWithConfirm = (id: string, name: string) => {
    setSelectedProjectId(id);
    setSelectedProjectName(name);
    setLeaveModalOpen(true);
  };

  const handleConfirmLeave = async () => {
    try {
      setIsLeaving(true);
      if (!selectedProjectId) return;
      await leaveProject(selectedProjectId);

      setLeaveModalOpen(false);
      setSelectedProjectId(null);
      setSelectedProjectName("");

      await fetchProjects();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to leave project"));
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
        <div className="flex flex-col-reverse sm:flex-row sm:items-end justify-between gap-4 mb-8 border-b border-white/10">
          <ProjectFilter activeFilter={filter} onFilterChange={setFilter} />
          {projects.length > 0 && (
            <label className="relative mb-3 sm:mb-2 block">
              <span className="sr-only">Search projects</span>
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects"
                className="w-full sm:w-64 pl-9 pr-3 py-2 rounded-lg bg-zinc-900 border border-white/10 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-teal-500/50"
              />
            </label>
          )}
        </div>

        {state === "success" && query && filteredProjects.length === 0 && (
          <p className="text-sm text-zinc-500 mb-6">No projects match “{search}”.</p>
        )}

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
        <Suspense fallback={null}>
          <CreateProjectModal
            isOpen={createModalOpen}
            onClose={() => setCreateModalOpen(false)}
            onCreate={handleCreate}
          />
        </Suspense>

        <Suspense fallback={null}>
          <DeleteProjectModal
            isOpen={deleteModalOpen}
            onClose={() => setDeleteModalOpen(false)}
            onConfirm={handleConfirmDelete}
            projectName={selectedProjectName}
            isLoading={isDeleting}
          />
        </Suspense>

        <Suspense fallback={null}>
          <RenameProjectModal
            key={`${selectedProjectId}-${renameModalOpen}`}
            isOpen={renameModalOpen}
            onClose={() => setRenameModalOpen(false)}
            onConfirm={handleConfirmRename}
            projectName={selectedProjectName}
            isLoading={isRenaming}
          />
        </Suspense>

        <Suspense fallback={null}>
          <LeaveProjectModal
            isOpen={leaveModalOpen}
            onClose={() => setLeaveModalOpen(false)}
            onConfirm={handleConfirmLeave}
            projectName={selectedProjectName}
            isLoading={isLeaving}
          />
        </Suspense>
      </main>
    </div>
  );
}
