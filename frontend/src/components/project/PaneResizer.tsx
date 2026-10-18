import type { SidePane } from "../../hooks/useSidePane";

/** Draggable right edge of a side pane (arrow keys too; double-click resets). */
const PaneResizer = ({ pane, label }: { pane: SidePane; label: string }) => (
  <div
    role="separator"
    aria-orientation="vertical"
    aria-label={label}
    aria-valuemin={pane.minWidth}
    aria-valuemax={pane.maxWidth}
    aria-valuenow={pane.width ?? undefined}
    tabIndex={0}
    title="Drag to resize · double-click to reset"
    onPointerDown={pane.startResize}
    onDoubleClick={pane.resetWidth}
    onKeyDown={(e) => {
      if (e.key === "ArrowLeft") pane.resizeBy(-24);
      else if (e.key === "ArrowRight") pane.resizeBy(24);
    }}
    className={`absolute inset-y-0 right-0 z-20 hidden w-1.5 cursor-col-resize md:block focus:outline-none ${
      pane.isResizing ? "bg-teal-500/50" : "hover:bg-teal-500/30 focus-visible:bg-teal-500/40"
    }`}
  />
);

export default PaneResizer;
