import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Terminal, Trash2 } from "lucide-react";

export type OutputKind = "stdout" | "stderr" | "info" | "success" | "error";

export interface OutputLine {
  id: number;
  text: string;
  kind: OutputKind;
}

interface OutputPanelProps {
  lines: OutputLine[];
  isOpen: boolean;
  onToggle: () => void;
  onClear: () => void;
  /** Shown for languages that run in the sandbox and can read stdin. */
  showInput: boolean;
  stdin: string;
  onStdinChange: (value: string) => void;
  /** Increment to bring the Output tab to the front (e.g. when a run starts). */
  revealOutputKey?: number;
}

const KIND_CLASSES: Record<OutputKind, string> = {
  stdout: "text-zinc-200",
  stderr: "text-red-400",
  info: "text-zinc-500",
  success: "text-emerald-400",
  error: "text-red-400 font-medium",
};

const OutputPanel = ({
  lines,
  isOpen,
  onToggle,
  onClear,
  showInput,
  stdin,
  onStdinChange,
  revealOutputKey = 0,
}: OutputPanelProps) => {
  const [tab, setTab] = useState<"output" | "input">("output");

  // Switch to Output whenever a new run starts
  const [seenRevealKey, setSeenRevealKey] = useState(revealOutputKey);
  if (revealOutputKey !== seenRevealKey) {
    setSeenRevealKey(revealOutputKey);
    setTab("output");
  }
  const bottomRef = useRef<HTMLDivElement>(null);
  const activeTab = showInput ? tab : "output";

  useEffect(() => {
    if (isOpen && activeTab === "output") {
      bottomRef.current?.scrollIntoView({ block: "end" });
    }
  }, [lines, isOpen, activeTab]);

  return (
    <div
      className={`flex flex-col border-t border-white/10 bg-zinc-950 transition-[height] duration-200 ${
        isOpen ? "h-56" : "h-9"
      }`}
    >
      <div className="h-9 shrink-0 flex items-center gap-1 px-2 border-b border-white/5 text-xs">
        <button
          onClick={() => {
            setTab("output");
            if (!isOpen) onToggle();
          }}
          className={`flex items-center gap-1.5 px-2 py-1 rounded ${
            activeTab === "output" ? "text-white bg-white/5" : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <Terminal size={13} /> Output
        </button>
        {showInput && (
          <button
            onClick={() => {
              setTab("input");
              if (!isOpen) onToggle();
            }}
            className={`px-2 py-1 rounded ${
              activeTab === "input" ? "text-white bg-white/5" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Input{stdin ? " •" : ""}
          </button>
        )}
        <div className="flex-1" />
        <button
          onClick={onClear}
          title="Clear output"
          aria-label="Clear output"
          className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-white/5"
        >
          <Trash2 size={13} />
        </button>
        <button
          onClick={onToggle}
          title={isOpen ? "Collapse" : "Expand"}
          aria-label={isOpen ? "Collapse output" : "Expand output"}
          className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-white/5"
        >
          {isOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>

      {isOpen &&
        (activeTab === "output" ? (
          <div className="flex-1 overflow-auto px-3 py-2 font-mono text-xs leading-relaxed">
            {lines.length === 0 ? (
              <p className="text-zinc-600">Run your code to see output here.</p>
            ) : (
              lines.map((line) => (
                <div key={line.id} className={`whitespace-pre-wrap break-all ${KIND_CLASSES[line.kind]}`}>
                  {line.text || " "}
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>
        ) : (
          <textarea
            value={stdin}
            onChange={(e) => onStdinChange(e.target.value)}
            placeholder="Input passed to your program (stdin), e.g. numbers for scanf / Scanner / input()"
            className="flex-1 resize-none bg-transparent px-3 py-2 font-mono text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
            spellCheck={false}
          />
        ))}
    </div>
  );
};

export default OutputPanel;
