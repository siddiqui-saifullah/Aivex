import { createElement, useEffect, useRef } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import "../../config/monaco";
import getLanguageFromFilename from "../../utils/getLanguageFromFilename";
import { getRunnerLanguage } from "../../services/runner.service";
import { ExternalLink, Eye, FolderOpen, Loader2, Play, RefreshCw, Search, Square, X } from "lucide-react";
import { getFileIcon } from "../../utils/fileIconMap";
import { MonacoBinding } from "y-monaco";
import type { CollabSession, Peer } from "../../config/collab";
import type { EditorSelection, FlatFileTree } from "../../types";

interface CodeEditorProps {
  activeFile: string | null;
  fileTree?: FlatFileTree;
  onChange: (value: string) => void;
  /** Ctrl/Cmd+S */
  onSave: () => void;
  /** Current non-empty selection (null when nothing is selected), for the AI. */
  onSelectionChange?: (selection: EditorSelection | null) => void;
  handleRun: () => void;
  handleUpdate: () => void;
  handleStop: () => void;
  /** Running a C/C++/Java/... file (C in the browser, others on the server sandbox). */
  onRunFile: () => void;
  /** Stop the running file (in-browser C). */
  onStopFile?: () => void;
  isRunningFile?: boolean;
  isSaving?: boolean;
  runProgress?: string;
  isSaved?: boolean;
  originalIsRunning?: boolean;
  canPreview?: boolean;
  /** HTML/CSS/JS site shown live: no server, nothing to update. */
  isLivePreview?: boolean;
  isStaticSite?: boolean;
  preview: (show: boolean) => void;
  /** Open the running app in a separate browser tab. */
  onOpenPreviewTab?: () => void;
  /** Editor tabs. */
  openFiles?: string[];
  dirtyFiles?: Set<string>;
  onSelectTab?: (path: string) => void;
  onCloseTab?: (path: string) => void;
  /** Ctrl/Cmd+P */
  onQuickOpen?: () => void;
  /** Mobile: jump to the file explorer. */
  onBrowseFiles?: () => void;
  /** Live editing session (null until synced or when unavailable). */
  collab?: CollabSession | null;
  /** Teammates in the project right now. */
  peers?: Peer[];
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = isMac ? "⌘" : "Ctrl";

const CodeEditor = ({
  activeFile,
  fileTree = {},
  onChange,
  onSave,
  onSelectionChange,
  handleRun,
  handleUpdate,
  handleStop,
  onRunFile,
  onStopFile,
  isRunningFile = false,
  isSaving = false,
  runProgress = "",
  isSaved = true,
  originalIsRunning = false,
  canPreview = false,
  isLivePreview = false,
  isStaticSite = false,
  preview,
  onOpenPreviewTab,
  openFiles = [],
  dirtyFiles,
  onSelectTab,
  onCloseTab,
  onQuickOpen,
  onBrowseFiles,
  collab = null,
  peers = [],
}: CodeEditorProps) => {
  const runnerLanguage = getRunnerLanguage(activeFile);

  /** Ctrl/Cmd+Enter: the main action (run file, run/preview project, update). */
  const primaryAction = () => {
    if (runnerLanguage) {
      if (!isRunningFile) onRunFile();
    } else if (!originalIsRunning) handleRun();
    else if (!isSaved && !isLivePreview) handleUpdate();
  };

  // Monaco registers shortcuts once; keep them pointing at the latest handlers
  const onSaveRef = useRef(onSave);
  const onSelectionRef = useRef(onSelectionChange);
  const primaryRef = useRef(primaryAction);
  const quickOpenRef = useRef(onQuickOpen);
  useEffect(() => {
    onSaveRef.current = onSave;
    onSelectionRef.current = onSelectionChange;
    primaryRef.current = primaryAction;
    quickOpenRef.current = onQuickOpen;
  });

  const handleMount: OnMount = (editor, monaco) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSaveRef.current();
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => primaryRef.current());
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyP, () => quickOpenRef.current?.());

    // Report the selection (debounced) so "@Vex fix this" targets it
    let timer: ReturnType<typeof setTimeout> | undefined;
    editor.onDidChangeCursorSelection(({ selection }) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const text = selection.isEmpty() ? "" : editor.getModel()?.getValueInRange(selection) ?? "";
        onSelectionRef.current?.(
          text.trim()
            ? { startLine: selection.startLineNumber, endLine: selection.endLineNumber, text }
            : null,
        );
      }, 150);
    });
    editor.onDidDispose(() => clearTimeout(timer));

    // Live editing: bind this file's model to the shared document
    const text = activeFile ? collab?.getText(activeFile) : null;
    const model = editor.getModel();
    if (collab && text && model) {
      const binding = new MonacoBinding(text, model, new Set([editor]), collab.awareness);
      // Models outlive the editor (one per path), so unbind when the editor goes;
      // y-monaco also destroys itself when the model is disposed: only once
      const destroy = binding.destroy.bind(binding);
      let destroyed = false;
      binding.destroy = () => {
        if (destroyed) return;
        destroyed = true;
        destroy();
      };
      editor.onDidDispose(() => binding.destroy());
    }
  };

  if (!activeFile) {
    const shortcuts: [string, string][] = [
      [`${MOD} P`, "Go to file"],
      [`${MOD} S`, "Save"],
      [`${MOD} Enter`, "Run / Preview"],
    ];
    return (
      <div className="flex-1 bg-black flex flex-col items-center justify-center gap-5 text-zinc-500 px-6 text-center">
        <div className="space-y-1.5">
          <p className="text-zinc-300 font-medium">No file open</p>
          <p className="text-xs text-zinc-600 max-w-sm">
            HTML/CSS/JS sites preview instantly · C and Node.js run in your browser · C++, Java, Python and more run on the cloud runner
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {onBrowseFiles && (
            <button
              onClick={onBrowseFiles}
              className="md:hidden flex items-center gap-2 rounded-lg bg-teal-500/90 px-4 py-2 text-sm font-medium text-black hover:bg-teal-400"
            >
              <FolderOpen size={15} /> Browse files
            </button>
          )}
          {onQuickOpen && (
            <button
              onClick={onQuickOpen}
              className="flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:bg-white/5"
            >
              <Search size={15} /> Go to file
            </button>
          )}
        </div>
        <dl className="hidden md:grid grid-cols-[auto_auto] gap-x-4 gap-y-1.5 text-xs">
          {shortcuts.map(([keys, label]) => (
            <div key={label} className="contents">
              <dt className="text-right">
                <kbd className="rounded border border-white/10 bg-zinc-900 px-1.5 py-0.5 font-sans text-[11px] text-zinc-400">{keys}</kbd>
              </dt>
              <dd className="text-left text-zinc-500">{label}</dd>
            </div>
          ))}
        </dl>
      </div>
    );
  }

  // Prevent editing system files
  if (activeFile === ".aivex") {
    return (
      <div className="flex-1 bg-black flex flex-col items-center justify-center text-zinc-500 gap-4">
        <div className="text-center">
          <p className="text-lg font-semibold">System File</p>
          <p className="text-sm">
            .aivex is a system file and cannot be edited
          </p>
        </div>
      </div>
    );
  }

  // Get file content from fileTree (older saves may hold line arrays or { contents })
  const rawFile: unknown = fileTree?.[activeFile];
  const language = getLanguageFromFilename(activeFile);

  let code = "";

  if (typeof rawFile === "string") {
    code = rawFile;
  } else if (Array.isArray(rawFile)) {
    code = rawFile.join("\n");
  } else if (
    rawFile &&
    typeof rawFile === "object" &&
    typeof (rawFile as { contents?: unknown }).contents === "string"
  ) {
    code = (rawFile as { contents: string }).contents;
  }

  const fileName = activeFile.split("/").pop();

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-black">
      {/* Header: tabs + actions */}
      <div className="h-12 shrink-0 pr-3 flex items-stretch justify-between gap-3 bg-zinc-950 border-b border-white/10">
        <div role="tablist" aria-label="Open files" className="flex min-w-0 items-stretch overflow-x-auto no-scrollbar">
          {(openFiles.length ? openFiles : [activeFile]).map((path) => {
            const name = path.split("/").pop() ?? path;
            const active = path === activeFile;
            const dirty = dirtyFiles?.has(path);
            return (
              <div
                key={path}
                role="tab"
                aria-selected={active}
                tabIndex={0}
                title={path}
                onClick={() => onSelectTab?.(path)}
                onKeyDown={(e) => e.key === "Enter" && onSelectTab?.(path)}
                onAuxClick={(e) => e.button === 1 && onCloseTab?.(path)}
                className={`group relative flex shrink-0 cursor-pointer items-center gap-2 border-r border-white/5 pl-3 pr-2 text-[13px] transition-colors ${
                  active ? "bg-black text-zinc-100" : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300"
                }`}
              >
                {active && <span className="absolute inset-x-0 top-0 h-0.5 bg-teal-400" />}
                <span className="[&_svg]:h-3.5 [&_svg]:w-3.5">{createElement(getFileIcon(name))}</span>
                <span className="max-w-[10rem] truncate">{name}</span>
                {peers.some((p) => p.file === path) && (
                  <span className="flex -space-x-1">
                    {peers
                      .filter((p) => p.file === path)
                      .slice(0, 3)
                      .map((p) => (
                        <span
                          key={p.clientId}
                          title={`${p.name} is here`}
                          className="flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold text-black ring-1 ring-black"
                          style={{ backgroundColor: p.color }}
                        >
                          {p.name.charAt(0).toUpperCase()}
                        </span>
                      ))}
                  </span>
                )}
                {onCloseTab && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseTab(path);
                    }}
                    aria-label={`Close ${name}`}
                    className={`relative flex h-5 w-5 items-center justify-center rounded hover:bg-white/10 ${
                      active || dirty ? "" : "opacity-0 group-hover:opacity-100 focus:opacity-100"
                    }`}
                  >
                    {dirty && <span className="absolute h-2 w-2 rounded-full bg-amber-400 group-hover:opacity-0" />}
                    <X size={13} className={dirty ? "opacity-0 group-hover:opacity-100" : ""} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {peers.length > 0 && (
            <div className="hidden sm:flex items-center -space-x-1.5 mr-1" aria-label="Online teammates">
              {peers.slice(0, 4).map((p) => (
                <button
                  key={p.clientId}
                  onClick={() => p.file && onSelectTab?.(p.file)}
                  title={p.file ? `${p.name} · ${p.file} (click to follow)` : p.name}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-black ring-2 ring-zinc-950 transition hover:z-10 hover:scale-110"
                  style={{ backgroundColor: p.color }}
                >
                  {initials(p.name)}
                </button>
              ))}
              {peers.length > 4 && (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-[10px] text-zinc-300 ring-2 ring-zinc-950">
                  +{peers.length - 4}
                </span>
              )}
            </div>
          )}
          {runnerLanguage && isRunningFile && runnerLanguage.id === "c" && onStopFile ? (
            /* In-browser C can be stopped (infinite loop, waiting for input...) */
            <button
              onClick={onStopFile}
              title="Stop the program"
              className="flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium bg-red-500/90 text-white hover:bg-red-400 transition"
            >
              <Square size={14} /> Stop
            </button>
          ) : runnerLanguage ? (
            /* C runs in the browser; C++ / Java / Python ... on the cloud runner */
            <button
              disabled={isRunningFile}
              onClick={onRunFile}
              title={`Run ${fileName} (${MOD}+Enter)`}
              className="flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium bg-teal-500/90 text-black hover:bg-teal-400 transition disabled:opacity-60"
            >
              {isRunningFile ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              {isRunningFile ? "Running…" : `Run ${runnerLanguage.label}`}
            </button>
          ) : (
            <>
              {/* Static sites: the main button already opens the preview */}
              {(!isStaticSite || originalIsRunning) && (
                <button
                  onClick={() => preview(true)}
                  disabled={!canPreview}
                  title={canPreview ? "Open preview" : "Run the project to enable preview"}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-white/10 text-zinc-300 text-sm hover:bg-white/5 transition disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <Eye size={14} /> Preview
                </button>
              )}
              {onOpenPreviewTab && (
                <button
                  onClick={onOpenPreviewTab}
                  disabled={!canPreview}
                  title={canPreview ? "Open preview in a new tab" : "Run the project to enable preview"}
                  aria-label="Open preview in a new tab"
                  className="flex items-center px-2 py-1.5 rounded-md border border-white/10 text-zinc-300 hover:bg-white/5 transition disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  <ExternalLink size={14} />
                </button>
              )}

              {/* Unified Primary Action */}
              <button
                disabled={isSaving}
                title={!originalIsRunning ? `${isStaticSite ? "Preview" : "Run"} (${MOD}+Enter)` : undefined}
                onClick={() => {
                  if (!originalIsRunning) handleRun();
                  else if (!isSaved && !isLivePreview) handleUpdate();
                  else handleStop();
                }}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200 disabled:opacity-50 ${
                  !originalIsRunning
                    ? "bg-teal-500/90 text-black hover:bg-teal-400"
                    : !isSaved && !isLivePreview
                      ? "bg-blue-500/90 text-white hover:bg-blue-400"
                      : "bg-red-500/90 text-white hover:bg-red-400"
                }`}
              >
                {!originalIsRunning && <Play size={14} />}
                {originalIsRunning && !isSaved && !isLivePreview && <RefreshCw size={14} />}
                {originalIsRunning && (isSaved || isLivePreview) && <Square size={14} />}

                {!originalIsRunning && (isStaticSite ? "Preview" : "Run")}
                {originalIsRunning && !isSaved && !isLivePreview && "Update"}
                {originalIsRunning && (isSaved || isLivePreview) && "Stop"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Monaco Editor */}
      <div className="flex-1 min-h-0">
        <Editor
          // Re-mount (and bind) once live editing is ready
          key={`${activeFile}:${collab ? "live" : "local"}`}
          height="100%"
          theme="vs-dark"
          language={language}
          value={code}
          path={`file:///${activeFile}`}
          onChange={(value) => onChange(value ?? "")}
          onMount={handleMount}
          loading={
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Loader2 size={16} className="animate-spin" /> Loading editor…
            </div>
          }
          options={{
            fontFamily: "JetBrains Mono, ui-monospace, monospace",
            fontSize: 14,
            minimap: { enabled: false },
            smoothScrolling: true,
            cursorSmoothCaretAnimation: "on",
            wordWrap: "on",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
          }}
        />
      </div>

      {/* Status Bar */}
      <div className="h-7 shrink-0 px-4 flex items-center justify-between text-xs bg-zinc-950 border-t border-white/10 text-zinc-400">
        {/* Left: File status */}
        <div className="flex min-w-0 items-center gap-3">
          {(runProgress || isSaving) && (
            <span className="truncate text-teal-400 animate-breathe">{isSaving ? "Saving files…" : runProgress}</span>
          )}
          {isSaved ? (
            <span className="shrink-0 text-emerald-400">● Saved</span>
          ) : (
            <span className="text-amber-400">
              ● Unsaved <span className="hidden sm:inline text-zinc-600">({MOD}+S)</span>
            </span>
          )}
        </div>

        {/* Right: Language + Server */}
        <div className="flex items-center gap-4">
          <span className="capitalize">{runnerLanguage?.label ?? language}</span>

          {!runnerLanguage && (
            <div
              className={`hidden sm:flex items-center gap-1 ${
                originalIsRunning ? "text-emerald-400" : "text-zinc-500"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  originalIsRunning ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"
                }`}
              />
              {originalIsRunning
                ? isLivePreview ? "Live Preview" : "Server Running"
                : isStaticSite ? "Static Site" : "Server Stopped"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CodeEditor;
