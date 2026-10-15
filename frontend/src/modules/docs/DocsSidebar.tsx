import { NavLink } from "react-router-dom";
import { docsConfig } from "./docsConfig";
import { BookOpen, ChevronRight } from "lucide-react";

const DocsSidebar = () => {
  return (
    <aside className="w-64 h-[calc(100vh-64px)] sticky top-16 bg-black border-r border-zinc-800 flex flex-col">
      {/* Header */}
      <div className="px-6 py-6 flex items-center gap-2 shrink-0">
        <BookOpen size={14} className="text-zinc-500" />
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
          Documentation
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 pb-6 overflow-y-auto flex flex-col gap-1">
        {docsConfig.map((item) => (
          <NavLink
            key={item.path}
            to={`/docs/${item.path}`}
            className={({ isActive }) =>
              `group flex items-center justify-between px-4 py-2.5 rounded-lg text-sm transition-all duration-200
              ${
                isActive
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className="truncate">{item.title}</span>
                {isActive && (
                  <ChevronRight size={14} className="text-[#14b8a6]" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default DocsSidebar;
