// Deep imports used to load only the Prism grammars we need (see MarkdownRenderer)
declare module "react-syntax-highlighter/dist/esm/prism-light" {
  import type { PrismLight } from "react-syntax-highlighter";
  const SyntaxHighlighter: typeof PrismLight;
  export default SyntaxHighlighter;
}

declare module "react-syntax-highlighter/dist/esm/languages/prism/*" {
  const language: unknown;
  export default language;
}
