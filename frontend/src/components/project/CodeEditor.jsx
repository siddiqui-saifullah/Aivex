import Editor from "@monaco-editor/react";
import getLanguageFromFilename from "../../utils/getLanguageFromFilename";
import { Play, Square } from "lucide-react";

const CodeEditor = ({
  activeFile,
  fileTree = {},
  language = "javascript",
  onChange,
  handleRun,
  handleUpdate,
  handleStop,
  isRunning = false,
  isSaving = false,
  runProgress = "",
  isSaved = true,
  originalIsRunning = false,
  preview,
}) => {
  console.log(fileTree);
  if (!activeFile) {
    return (
      <div className="flex-1 bg-black flex items-center justify-center text-zinc-500">
        Select a file from Explorer
      </div>
    );
  }

  // Get file content from fileTree
  const rawFile = fileTree?.[activeFile];
  language = getLanguageFromFilename(activeFile);

  let code = "";

  if (typeof rawFile === "string") {
    code = rawFile;
  } else if (Array.isArray(rawFile)) {
    code = rawFile.join("\n");
  } else if (
    rawFile &&
    typeof rawFile === "object" &&
    typeof rawFile.contents === "string"
  ) {
    code = rawFile.contents;
  } else {
    code = "";
  }

  return (
    <div className="flex flex-col flex-1 bg-black border-r border-white/10">
      {/* Header */}
      <div
        className="h-14 px-4 flex items-center justify-between
  bg-zinc-900 border-b border-white/10 shadow-sm"
      >
        {/* File Info */}
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium text-zinc-200 truncate">
            {activeFile}
          </span>

          {(runProgress || isSaving) && (
            <span className="text-xs text-teal-400 animate-breathe">
              {isSaving ? "Saving files…" : runProgress}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Preview (secondary) */}
          <button
            onClick={() => preview(true)}
            className="px-3 py-1.5 rounded-md
        border border-white/10
        text-zinc-300 text-sm
        hover:bg-white/5 transition"
          >
            Preview
          </button>

          {/* Unified Primary Action */}
          <button
            disabled={isSaving}
            onClick={() => {
              if (!originalIsRunning) handleRun();
              else if (!isSaved) handleUpdate();
              else handleStop();
            }}
            className={`
        flex items-center gap-2
        px-4 py-1.5 rounded-md
        text-sm font-medium
        transition-all duration-200
        ${
          !originalIsRunning
            ? "bg-teal-500/90 text-black hover:bg-teal-400"
            : !isSaved
              ? "bg-blue-500/90 text-white hover:bg-blue-400"
              : "bg-red-500/90 text-white hover:bg-red-400"
        }
        disabled:opacity-50
      `}
          >
            {/* Icon swap */}
            {!originalIsRunning && <Play size={14} />}
            {originalIsRunning && !isSaved && (
              <Play size={14} className="rotate-90" />
            )}
            {originalIsRunning && isSaved && <Square size={14} />}

            {/* Label */}
            {!originalIsRunning && "Run"}
            {originalIsRunning && !isSaved && "Update"}
            {originalIsRunning && isSaved && "Stop"}
          </button>
        </div>
      </div>

      {/* Monaco Editor */}
      <Editor
        key={activeFile}
        height="100%"
        theme="vs-dark"
        language={language}
        value={code}
        path={`file:///${activeFile}`}
        onChange={(value) => onChange(value ?? "")}
        options={{
          fontFamily: "JetBrains Mono",
          fontSize: 14,
          minimap: { enabled: false },
          smoothScrolling: true,
          cursorSmoothCaretAnimation: "on",
          wordWrap: "on",
          scrollBeyondLastLine: false,
          automaticLayout: true,
        }}
      />

      {/* Status Bar */}
      <div
        className="h-7 px-4 flex items-center justify-between text-xs
        bg-zinc-950 border-t border-white/10 text-zinc-400"
      >
        {/* Left: File status */}
        <div className="flex items-center gap-3">
          {isSaved ? (
            <span className="text-emerald-400">● Saved</span>
          ) : (
            <span className="text-amber-400">● Unsaved</span>
          )}
        </div>

        {/* Right: Language + Server */}
        <div className="flex items-center gap-4">
          <span className="capitalize">{language}</span>

          <div
            className={`flex items-center gap-1 ${
              originalIsRunning ? "text-emerald-400" : "text-zinc-500"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                originalIsRunning
                  ? "bg-emerald-400 animate-pulse"
                  : "bg-zinc-600"
              }`}
            />
            {originalIsRunning ? "Server Running" : "Server Stopped"}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodeEditor;
