import { Plus, AlertCircle, Folder } from "lucide-react";
import Button from "../ui/Button";
import ProjectCard from "./ProjectCard/ProjectCard";
import { ProjectListSkeleton } from "./ProjectList.Skeleton";
import { PROJECT_STATES } from "../../constants/options";
import { useToast } from "../../context/toast.context";

/**
 * ProjectList - Renders projects with different states (loading, empty, error, success)
 */
const ProjectList = ({
  state,
  projects,
  onDelete,
  onRename,
  onLeave,
  onRetry,
  onCreateClick,
  userId,
}) => {
  const { error } = useToast();
  if (state === PROJECT_STATES.LOADING) {
    return <ProjectListSkeleton />;
  }

  if (state === PROJECT_STATES.ERROR) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center bg-red-500/5 border border-red-500/10 rounded-2xl">
        <div className="p-4 bg-red-500/10 rounded-full text-red-400 mb-4">
          <AlertCircle size={32} />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">
          Unable to load projects
        </h3>
        <p className="text-zinc-400 max-w-sm mb-6">
          We encountered an error while fetching your dashboard data.
        </p>
        <Button
          variant="secondary"
          onClick={() => {
            onRetry();
            error("Retrying...");
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (state === PROJECT_STATES.EMPTY) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-zinc-800 rounded-3xl bg-zinc-900/20">
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-teal-500/20 blur-xl rounded-full"></div>
          <div className="relative p-6 bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl">
            <Folder size={48} className="text-teal-500" />
          </div>
        </div>
        <h3 className="text-xl font-bold text-white mb-2">No projects found</h3>
        <p className="text-zinc-400 max-w-md mb-8">
          You haven't created any projects yet. Start by creating a new
          environment to deploy your first application.
        </p>
        <Button
          variant="primary"
          size="lg"
          icon={Plus}
          onClick={onCreateClick}
          className="shadow-xl shadow-teal-500/20"
        >
          Create First Project
        </Button>
      </div>
    );
  }

  // SUCCESS state
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {projects.map((project) => {
        const isOwner = project.owner === userId;
        console.log(project);
        return (
          <ProjectCard
            key={project.id}
            project={project}
            onDelete={onDelete}
            onRename={onRename}
            onLeave={onLeave}
            isOwner={isOwner}
          />
        );
      })}

      {/* Quick Add Card */}
      <button
        onClick={onCreateClick}
        className="group flex flex-col items-center justify-center gap-4 h-full min-h-[220px] border-2 border-dashed border-zinc-800 hover:border-teal-500/30 rounded-xl hover:bg-zinc-900/50 transition-all duration-300"
      >
        <div className="p-3 rounded-full bg-zinc-900 border border-zinc-800 group-hover:border-teal-500/50 group-hover:bg-teal-500/10 transition-colors">
          <Plus size={24} className="text-zinc-500 group-hover:text-teal-400" />
        </div>
        <span className="text-sm font-medium text-zinc-500 group-hover:text-zinc-300">
          Create New Project
        </span>
      </button>
    </div>
  );
};

export default ProjectList;
