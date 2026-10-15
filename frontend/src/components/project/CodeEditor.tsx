import { useEffect, useRef } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import "../../config/monaco";
import getLanguageFromFilename from "../../utils/getLanguageFromFilename";
import { getRunnerLanguage } from "../../services/runner.service";
import { ExternalLink, Eye, Loader2, Play, RefreshCw, Square } from "lucide-react";
import type { FlatFileTree } from "../../types";

interface CodeEditorProps {
  activeFile: string | null;
  fileTree?: FlatFileTree;
  onChange: (value: string) => void;
  /** Ctrl/Cmd+S */
  onSave: () => void;
  handleRun: () => void;
  handleUpdate: () => void;
  handleStop: () => void;
  /** Running a C/C++/Java/... file on the server sandbox. */
  onRunFile: () => void;
  isRunningFile?: boolean;
  isSaving?: boolean;
  runProgress?: string;
  isSaved?: boolean;
  originalIsRunning?: boolean;
  canPreview?: boolean;
  preview: (show: boolean) => void;
  /** Open the running app in a separate browser tab. */
  onOpenPreviewTab?: () => void;
}

const CodeEditor = ({
  activeFile,
  fileTree = {},
  onChange,
  onSave,
  handleRun,
  handleUpdate,
  handleStop,
  onRunFile,
  isRunningFile = false,
  isSaving = false,
  runProgress = "",
  isSaved = true,
  originalIsRunning = false,
  canPreview = false,
  preview,
  onOpenPreviewTab,
}: CodeEditorProps) => {
  // Monaco registers the shortcut once; keep it pointing at the latest handler
  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  const handleMount: OnMount = (editor, monaco) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSaveRef.current();
    });
  };

  if (!activeFile) {
    return (
      <div className="flex-1 bg-black flex flex-col items-center justify-center gap-2 text-zinc-500 px-6 text-center">
        <p>Select a file from Explorer</p>
        <p className="text-xs text-zinc-600">
          Node.js projects run in your browser · C, C++, Java, Python and more run on the cloud runner
        </p>
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
  const runnerLanguage = getRunnerLanguage(activeFile);

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
      {/* Header */}
      <div className="h-14 shrink-0 px-4 flex items-center justify-between gap-3 bg-zinc-900 border-b border-white/10 shadow-sm">
        {/* File Info */}
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium text-zinc-200 truncate" title={activeFile}>
            {activeFile}
          </span>

          {(runProgress || isSaving) && (
            <span className="text-xs text-teal-400 animate-breathe truncate">
              {isSaving ? "Saving files…" : runProgress}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {runnerLanguage ? (
            /* C / C++ / Java / Python ... -> cloud runner */
            <button
              disabled={isRunningFile}
              onClick={onRunFile}
              title={`Run ${fileName} (${runnerLanguage.label})`}
              className="flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium bg-teal-500/90 text-black hover:bg-teal-400 transition disabled:opacity-60"
            >
              {isRunningFile ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              {isRunningFile ? "Running…" : `Run ${runnerLanguage.label}`}
            </button>
          ) : (
            <>
              <button
                onClick={() => preview(true)}
                disabled={!canPreview}
                title={canPreview ? "Open preview" : "Run the project to enable preview"}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-white/10 text-zinc-300 text-sm hover:bg-white/5 transition disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <Eye size={14} /> Preview
              </button>
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
                onClick={() => {
                  if (!originalIsRunning) handleRun();
                  else if (!isSaved) handleUpdate();
                  else handleStop();
                }}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200 disabled:opacity-50 ${
                  !originalIsRunning
                    ? "bg-teal-500/90 text-black hover:bg-teal-400"
                    : !isSaved
                      ? "bg-blue-500/90 text-white hover:bg-blue-400"
                      : "bg-red-500/90 text-white hover:bg-red-400"
                }`}
              >
                {!originalIsRunning && <Play size={14} />}
                {originalIsRunning && !isSaved && <RefreshCw size={14} />}
                {originalIsRunning && isSaved && <Square size={14} />}

                {!originalIsRunning && "Run"}
                {originalIsRunning && !isSaved && "Update"}
                {originalIsRunning && isSaved && "Stop"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Monaco Editor */}
      <div className="flex-1 min-h-0">
        <Editor
          key={activeFile}
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
        <div className="flex items-center gap-3">
          {isSaved ? (
            <span className="text-emerald-400">● Saved</span>
          ) : (
            <span className="text-amber-400">
              ● Unsaved <span className="text-zinc-600">(Ctrl+S)</span>
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
              {originalIsRunning ? "Server Running" : "Server Stopped"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CodeEditor;
