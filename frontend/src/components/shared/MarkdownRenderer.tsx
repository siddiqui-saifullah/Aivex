import { useState, type ReactNode } from "react";
import Markdown from "markdown-to-jsx";
import { Check, Copy } from "lucide-react";
// PrismLight + a handful of languages instead of all ~300 grammars
import SyntaxHighlighter from "react-syntax-highlighter/dist/esm/prism-light";
import bash from "react-syntax-highlighter/dist/esm/languages/prism/bash";
import c from "react-syntax-highlighter/dist/esm/languages/prism/c";
import cpp from "react-syntax-highlighter/dist/esm/languages/prism/cpp";
import css from "react-syntax-highlighter/dist/esm/languages/prism/css";
import java from "react-syntax-highlighter/dist/esm/languages/prism/java";
import javascript from "react-syntax-highlighter/dist/esm/languages/prism/javascript";
import json from "react-syntax-highlighter/dist/esm/languages/prism/json";
import jsx from "react-syntax-highlighter/dist/esm/languages/prism/jsx";
import markup from "react-syntax-highlighter/dist/esm/languages/prism/markup";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";
import tsx from "react-syntax-highlighter/dist/esm/languages/prism/tsx";
import typescript from "react-syntax-highlighter/dist/esm/languages/prism/typescript";
import { hivePrismTheme } from "./hivePrismTheme";

const LANGUAGES = {
  bash, sh: bash, shell: bash,
  c, cpp, "c++": cpp,
  css,
  java,
  javascript, js: javascript,
  json,
  jsx,
  html: markup, xml: markup, markup,
  python, py: python,
  tsx,
  typescript, ts: typescript,
};
for (const [name, grammar] of Object.entries(LANGUAGES)) {
  SyntaxHighlighter.registerLanguage(name, grammar);
}

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      title="Copy code"
      aria-label="Copy code"
      className="absolute top-2 right-2 p-1.5 rounded-md bg-zinc-800/80 text-zinc-400 hover:text-white opacity-0 group-hover/code:opacity-100 focus:opacity-100 transition"
    >
      {copied ? <Check size={13} className="text-teal-400" /> : <Copy size={13} />}
    </button>
  );
};

const CodeBlock = ({ className, children }: { className?: string; children?: ReactNode }) => {
  const match = /language-([\w+#-]+)/.exec(className || "");
  const code = String(children).replace(/\n$/, "");

  if (!match) {
    return (
      <code className="bg-black/50 text-teal-200 px-1.5 py-0.5 rounded font-mono text-[12.5px] break-words">
        {children}
      </code>
    );
  }

  return (
    <div className="relative group/code">
      <CopyButton text={code} />
      <SyntaxHighlighter
        language={match[1].toLowerCase()}
        style={hivePrismTheme}
        PreTag="div"
        customStyle={{
          background: "#0a0a0a",
          borderRadius: "0.75rem",
          padding: "1rem",
          border: "1px solid rgba(255,255,255,0.08)",
          overflowX: "auto",
          maxWidth: "100%",
          whiteSpace: "pre",
          margin: "0.5rem 0",
          fontSize: "12.5px",
          lineHeight: 1.55,
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
};

const MarkdownRenderer = ({ content }: { content?: string | null }) => {
  if (!content || typeof content !== "string") return null;

  return (
    <Markdown
      className="text-zinc-100 w-full overflow-hidden"
      options={{
        overrides: {
          /* - CODE BLOCKS - */
          code: {
            component: CodeBlock,
          },

          /* ---------- TABLES ---------- */
          table: {
            component: ({ children }) => (
              <div className="max-w-full overflow-x-auto my-3 rounded-lg border border-white/10 auto-scrollbar">
                <table className="min-w-full border-collapse text-sm">
                  {children}
                </table>
              </div>
            ),
          },
          thead: {
            props: {
              className: "bg-zinc-900 text-zinc-300",
            },
          },
          th: {
            props: {
              className:
                "px-3 py-2 text-left font-semibold border-b border-white/10 whitespace-nowrap ",
            },
          },
          td: {
            props: {
              className:
                "px-3 py-2 border-b border-white/5 text-zinc-200 whitespace-nowrap",
            },
          },

          /* ---------- TEXT ---------- */
          // Tailwind's reset strips list markers, heading sizes and link colours: restore them
          p: { props: { className: "my-1.5 first:mt-0 last:mb-0 break-words" } },
          h1: { props: { className: "mt-3 mb-1.5 first:mt-0 text-[16px] font-semibold text-white" } },
          h2: { props: { className: "mt-3 mb-1.5 first:mt-0 text-[15px] font-semibold text-white" } },
          h3: { props: { className: "mt-3 mb-1 first:mt-0 text-[14px] font-semibold text-white" } },
          h4: { props: { className: "mt-2 mb-1 first:mt-0 text-[14px] font-semibold text-zinc-200" } },
          ul: { props: { className: "my-1.5 list-disc space-y-1 pl-5 marker:text-teal-400" } },
          ol: { props: { className: "my-1.5 list-decimal space-y-1 pl-5 marker:text-teal-400 marker:font-medium" } },
          li: { props: { className: "pl-0.5" } },
          strong: { props: { className: "font-semibold text-white" } },
          em: { props: { className: "italic text-zinc-200" } },
          blockquote: {
            props: { className: "my-2 border-l-2 border-teal-500/60 bg-teal-500/5 py-1 pl-3 pr-2 text-zinc-200 rounded-r" },
          },
          a: {
            props: {
              className: "text-teal-300 underline decoration-teal-500/40 underline-offset-2 hover:text-teal-200",
              target: "_blank",
              rel: "noopener noreferrer",
            },
          },
          hr: { props: { className: "my-3 border-white/10" } },
        },
      }}
    >
      {content}
    </Markdown>
  );
};

export default MarkdownRenderer;
