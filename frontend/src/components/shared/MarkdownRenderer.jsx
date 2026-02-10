import Markdown from "markdown-to-jsx";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { hivePrismTheme } from "./hivePrismTheme";

const MarkdownRenderer = ({ content }) => {
  if (!content || typeof content !== "string") return null;

  return (
    <Markdown
      className="text-zinc-200 w-full overflow-hidden"
      options={{
        overrides: {
          /* - CODE BLOCKS - */
          code: {
            component: ({ className, children }) => {
              const match = /language-(\w+)/.exec(className || "");
              const code = String(children).replace(/\n$/, "");

              return match ? (
                <SyntaxHighlighter
                  language={match[1]}
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
                  }}
                >
                  {code}
                </SyntaxHighlighter>
              ) : (
                <code className="bg-black/50 text-teal-300 px-1.5 py-0.5 rounded font-mono text-sm break-all ">
                  {children}
                </code>
              );
            },
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
          p: {
            props: {
              className: "text-sm leading-relaxed break-words mb-2",
            },
          },
        },
      }}
    >
      {content}
    </Markdown>
  );
};

export default MarkdownRenderer;
