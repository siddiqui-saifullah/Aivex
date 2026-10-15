/**
 * ProjectFilter - Tab-based filter for projects
 */
export type ProjectFilterId = 'all' | 'my-projects';

interface ProjectFilterProps {
  activeFilter: ProjectFilterId;
  onFilterChange: (filter: ProjectFilterId) => void;
}

const ProjectFilter = ({ activeFilter, onFilterChange }: ProjectFilterProps) => {
  const filters: { id: ProjectFilterId; label: string }[] = [
    { id: 'all', label: 'All Projects' },
    { id: 'my-projects', label: 'My Projects' },
  ];

  return (
    <div className="flex gap-2">
      {filters.map((filter) => (
        <button
          key={filter.id}
          onClick={() => onFilterChange(filter.id)}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-all duration-200 ${
            activeFilter === filter.id
              ? 'border-teal-500 text-teal-400'
              : 'border-transparent text-zinc-400 hover:text-zinc-300'
          }`}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
};

export default ProjectFilter;
