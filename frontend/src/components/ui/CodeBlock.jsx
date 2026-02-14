import React from "react";
import { Copy, Check } from "lucide-react";

const CodeBlock = ({ children }) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative">
      <div className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleCopy}
          className="p-2 hover:bg-zinc-800 rounded-md border border-zinc-700/50 bg-black/50 backdrop-blur-sm text-zinc-400 hover:text-white transition-colors"
        >
          {copied ? (
            <Check size={14} className="text-[#14b8a6]" />
          ) : (
            <Copy size={14} />
          )}
        </button>
      </div>
      <pre className="bg-zinc-900/40 border border-zinc-800/50 p-5 rounded-xl text-sm font-mono text-zinc-200 overflow-x-auto auto-scrollbar leading-relaxed">
        {children}
      </pre>
    </div>
  );
};

export default CodeBlock;
