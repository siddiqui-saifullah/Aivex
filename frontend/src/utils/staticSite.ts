/**
 * Instant preview for plain HTML / CSS / JS projects.
 *
 * Static sites don't need Node, npm or the WebContainer: the page is built
 * straight from the editor's files into one HTML document (local CSS and JS
 * inlined, ES module imports rewritten to data: URLs) and shown in a
 * sandboxed iframe. Building takes a few milliseconds, so the preview can
 * follow every keystroke.
 */
import type { FlatFileTree } from "../types";

export const PREVIEW_MESSAGE_SOURCE = "aivex-preview";

export interface PreviewMessage {
  source: typeof PREVIEW_MESSAGE_SOURCE;
  token: string;
  type: "console" | "error" | "navigate";
  level?: "log" | "info" | "warn" | "error" | "debug";
  text?: string;
  path?: string;
}

const isHtml = (path: string) => /\.html?$/i.test(path);

/** A project is a static site when it has an HTML page and no package.json at the root. */
export const isStaticSite = (files: FlatFileTree) =>
  !("package.json" in files) && Object.keys(files).some(isHtml);

/** Page to open: the open HTML file, else index.html (closest to the root), else the first page. */
export const getEntryPage = (files: FlatFileTree, activeFile: string | null): string | null => {
  if (activeFile && isHtml(activeFile) && activeFile in files) return activeFile;
  const pages = Object.keys(files).filter(isHtml);
  const indexes = pages
    .filter((p) => /(^|\/)index\.html?$/i.test(p))
    .sort((a, b) => a.split("/").length - b.split("/").length);
  return indexes[0] ?? pages.sort()[0] ?? null;
};

const isExternal = (url: string) => /^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(url);

/** Resolve `ref` (relative to the file at `from`) to a project path. */
export const resolvePath = (from: string, ref: string): string => {
  const clean = ref.split(/[?#]/)[0];
  const parts = clean.startsWith("/") ? [] : from.split("/").slice(0, -1);
  for (const part of clean.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return parts.join("/");
};

const toDataUrl = (mime: string, text: string) =>
  `data:${mime};charset=utf-8,${encodeURIComponent(text)}`;

/** Inline CSS @imports of local files (one level of nesting per file, cycles skipped). */
const inlineCss = (files: FlatFileTree, path: string, seen = new Set<string>()): string => {
  seen.add(path);
  return (files[path] ?? "").replace(
    /@import\s+(?:url\()?\s*["']([^"')]+)["']\s*\)?\s*;/g,
    (match, ref: string) => {
      if (isExternal(ref)) return match;
      const target = resolvePath(path, ref);
      if (seen.has(target) || !(target in files)) return match;
      return inlineCss(files, target, seen);
    },
  );
};

// `import x from "./a.js"`, `export * from "./a.js"`, `import "./a.js"`, `import("./a.js")`
const IMPORT_RE = /(\bfrom\s*|\bimport\s*\(?\s*)(["'])([^"'\n]+)\2/g;

/**
 * ES modules can't import sibling files from a srcdoc page, so each local
 * import becomes a data: URL of the (recursively rewritten) module.
 */
const moduleUrl = (
  files: FlatFileTree,
  path: string,
  cache: Map<string, string>,
  stack: Set<string>,
): string => {
  const cached = cache.get(path);
  if (cached) return cached;
  stack.add(path);
  const code = (files[path] ?? "").replace(IMPORT_RE, (match, prefix: string, quote: string, ref: string) => {
    if (isExternal(ref) || !/^\.{0,2}\//.test(ref)) return match;
    const target = resolvePath(path, ref);
    const resolved = target in files ? target : `${target}.js` in files ? `${target}.js` : null;
    if (!resolved || stack.has(resolved)) return match; // missing file or import cycle
    return `${prefix}${quote}${moduleUrl(files, resolved, cache, stack)}${quote}`;
  });
  stack.delete(path);
  const url = toDataUrl("text/javascript", code);
  cache.set(path, url);
  return url;
};

const moduleCode = (files: FlatFileTree, path: string, code: string) =>
  code.replace(IMPORT_RE, (match, prefix: string, quote: string, ref: string) => {
    if (isExternal(ref) || !/^\.{0,2}\//.test(ref)) return match;
    const target = resolvePath(path, ref);
    const resolved = target in files ? target : `${target}.js` in files ? `${target}.js` : null;
    if (!resolved) return match;
    return `${prefix}${quote}${moduleUrl(files, resolved, new Map(), new Set([path]))}${quote}`;
  });

/** Script text can't contain `</script` inside an inline <script>. */
const escapeScript = (code: string) => code.replace(/<\/script/gi, "<\\/script");

const attr = (tag: string, name: string) =>
  new RegExp(`\\s${name}\\s*=\\s*(["'])(.*?)\\1`, "i").exec(tag)?.[2] ?? null;

/** Runs before the page's own scripts: console/error forwarding, page links, storage fallback. */
const bridgeScript = (token: string, page: string) => `<script>(()=>{
const send=(m)=>{try{parent.postMessage(Object.assign({source:${JSON.stringify(PREVIEW_MESSAGE_SOURCE)},token:${JSON.stringify(token)}},m),"*")}catch(e){}};
const fmt=(v)=>{if(typeof v==="string")return v;if(v instanceof Error)return v.stack||String(v);try{return JSON.stringify(v)}catch(e){return String(v)}};
["log","info","warn","error","debug"].forEach((level)=>{const orig=console[level];console[level]=(...a)=>{send({type:"console",level,text:a.map(fmt).join(" ")});orig.apply(console,a)}});
addEventListener("error",(e)=>send({type:"error",text:e.message+(e.lineno?" (line "+e.lineno+")":"")}));
addEventListener("unhandledrejection",(e)=>send({type:"error",text:"Unhandled promise rejection: "+fmt(e.reason)}));
document.addEventListener("click",(e)=>{const a=e.target&&e.target.closest&&e.target.closest("a[href]");if(!a)return;const h=a.getAttribute("href");if(!h||/^([a-z][a-z0-9+.-]*:|\\/\\/|#)/i.test(h))return;e.preventDefault();send({type:"navigate",path:h})},true);
const mem=()=>{const s=new Map();return{getItem:(k)=>s.has(String(k))?s.get(String(k)):null,setItem:(k,v)=>{s.set(String(k),String(v))},removeItem:(k)=>{s.delete(String(k))},clear:()=>s.clear(),key:(i)=>[...s.keys()][i]??null,get length(){return s.size}}};
["localStorage","sessionStorage"].forEach((n)=>{try{window[n].length}catch(e){try{Object.defineProperty(window,n,{value:mem(),configurable:true})}catch(_){}}});
window.__AIVEX_PAGE__=${JSON.stringify(page)};
})();</script>`;

/**
 * Build a self-contained HTML document for `page`.
 * `token` tags the preview's postMessages so the editor ignores other frames.
 */
export const buildStaticPage = (files: FlatFileTree, page: string, token: string): string => {
  let html = files[page] ?? "";

  // <link rel="stylesheet" href="local.css"> -> <style>
  html = html.replace(/<link\b[^>]*>/gi, (tag) => {
    const href = attr(tag, "href");
    if (!href || !/rel\s*=\s*["']?stylesheet/i.test(tag)) return tag;
    if (isExternal(href)) {
      // CORS request: lets CDN styles load under the editor's COEP policy
      return /\scrossorigin\b/i.test(tag) ? tag : tag.replace(/<link\b/i, '<link crossorigin="anonymous"');
    }
    const target = resolvePath(page, href);
    if (!(target in files)) return tag;
    return `<style data-file="${target}">\n${inlineCss(files, target).replace(/<\/style/gi, "<\\/style")}\n</style>`;
  });

  // <script src="local.js"></script> -> inline (modules get their imports rewritten)
  html = html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (tag, attrs: string, body: string) => {
    const src = attr(` ${attrs}`, "src");
    const isModule = /type\s*=\s*["']?module/i.test(attrs);
    if (!src) {
      return isModule ? `<script${attrs}>${escapeScript(moduleCode(files, page, body))}</script>` : tag;
    }
    if (isExternal(src)) {
      return /\scrossorigin\b/i.test(attrs) ? tag : `<script crossorigin="anonymous"${attrs}>${body}</script>`;
    }
    const target = resolvePath(page, src);
    if (!(target in files)) return tag;
    const rest = attrs.replace(/\ssrc\s*=\s*(["']).*?\1/i, "");
    const code = isModule ? moduleCode(files, target, files[target]) : files[target];
    return `<script${rest} data-file="${target}">\n${escapeScript(code)}\n</script>`;
  });

  // Local images / media as data URLs only when they are text (SVG); binary files aren't stored
  html = html.replace(/(<img\b[^>]*\ssrc\s*=\s*)(["'])([^"']+)\2/gi, (match, prefix: string, quote: string, src: string) => {
    if (isExternal(src)) return match;
    const target = resolvePath(page, src);
    if (!/\.svg$/i.test(target) || !(target in files)) return match;
    return `${prefix}${quote}${toDataUrl("image/svg+xml", files[target])}${quote}`;
  });

  const bridge = bridgeScript(token, page);
  // The bridge must run first: right after <head>, else at the very start
  if (/<head\b[^>]*>/i.test(html)) return html.replace(/<head\b[^>]*>/i, (m) => `${m}${bridge}`);
  if (/<html\b[^>]*>/i.test(html)) return html.replace(/<html\b[^>]*>/i, (m) => `${m}<head>${bridge}</head>`);
  return `<!doctype html><head><meta charset="utf-8">${bridge}</head>${html}`;
};

/** Sandbox for user pages: scripts run, but on an opaque origin (no access to Aivex's session). */
export const PREVIEW_SANDBOX = "allow-scripts allow-forms allow-modals allow-popups allow-downloads";
