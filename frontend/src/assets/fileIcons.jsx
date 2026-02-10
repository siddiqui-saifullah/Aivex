const base = "w-4 h-4 shrink-0";
const strokeProps = { strokeLinecap: "round", strokeLinejoin: "round" };

/* ==========================================
   GENERIC / SYSTEM
   ========================================== */

export const FileIcon = () => (
  <svg viewBox="0 0 24 24" className={base} fill="none" stroke="currentColor" strokeWidth="1.8" {...strokeProps}>
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

export const FolderIcon = ({ open }) => (
  <svg viewBox="0 0 24 24" className={`${base} text-teal-400`} fill="none" stroke="currentColor" strokeWidth="1.8" {...strokeProps}>
    {open ? (
      <>
        <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
        <path d="M2 10h20" strokeOpacity="0.5" />
      </>
    ) : (
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
    )}
  </svg>
);

export const ConfigIcon = () => (
  <svg viewBox="0 0 24 24" className={`${base} text-zinc-400`} fill="none" stroke="currentColor" strokeWidth="1.8" {...strokeProps}>
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.18-.08a2 2 0 0 0-2.66 1.1l-.17.3a2 2 0 0 0 .45 2.54l.15.12a2 2 0 0 1 0 2.9l-.15.12a2 2 0 0 0-.45 2.54l.17.3a2 2 0 0 0 2.66 1.1l.18-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.18.08a2 2 0 0 0 2.66-1.1l.17-.3a2 2 0 0 0-.45-2.54l-.15-.12a2 2 0 0 1 0-2.9l.15-.12a2 2 0 0 0 .45-2.54l-.17-.3a2 2 0 0 0-2.66-1.1l-.18.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const ServerIcon = () => (
  <svg viewBox="0 0 24 24" className={`${base} text-emerald-400`} fill="none" stroke="currentColor" strokeWidth="1.8" {...strokeProps}>
    <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
    <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
    <line x1="6" y1="6" x2="6.01" y2="6" />
    <line x1="6" y1="18" x2="6.01" y2="18" />
  </svg>
);

export const DatabaseIcon = () => (
  <svg viewBox="0 0 24 24" className={`${base} text-emerald-400`} fill="none" stroke="currentColor" strokeWidth="1.8" {...strokeProps}>
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
  </svg>
);

export const TerminalIcon = () => (
  <svg viewBox="0 0 24 24" className={`${base} text-slate-300`} fill="none" stroke="currentColor" strokeWidth="1.8" {...strokeProps}>
    <polyline points="4 17 10 11 4 5" />
    <line x1="12" y1="19" x2="20" y2="19" />
  </svg>
);

/* ==========================================
   WEB LANGUAGES (File Outline + Symbol)
   ========================================== */

export const JSIcon = () => (
  <svg viewBox="0 0 24 24" className={`${base} text-yellow-400`} fill="none" stroke="currentColor" strokeWidth="1.8" {...strokeProps}>
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    {/* Letter J */}
    <path d="M12 18v-6" /> 
    <path d="M8 17a2 2 0 0 0 4 0" />
  </svg>
);

export const JSONIcon = () => (
  <svg viewBox="0 0 24 24" className={`${base} text-orange-400`} fill="none" stroke="currentColor" strokeWidth="1.8" {...strokeProps}>
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="M8 13a2 2 0 0 0 2-2v-1" />
    <path d="M16 13a2 2 0 0 1-2-2v-1" />
    <circle cx="12" cy="17" r="1" fill="currentColor" />
  </svg>
);

export const HtmlIcon = () => (
  <svg viewBox="0 0 24 24" className={`${base} text-orange-500`} fill="none" stroke="currentColor" strokeWidth="1.8" {...strokeProps}>
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="M8 13l2 2 2-2" transform="rotate(-90 10 13)" />
    <path d="M14 13l2 2 2-2" transform="rotate(-90 16 13) translate(2,0)" />
  </svg>
);

export const CssIcon = () => (
  <svg viewBox="0 0 24 24" className={`${base} text-sky-400`} fill="none" stroke="currentColor" strokeWidth="1.8" {...strokeProps}>
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="M8 13h8" />
    <path d="M8 17h8" />
    <path d="M14 11l-2 8" />
  </svg>
);

export const MarkdownIcon = () => (
  <svg viewBox="0 0 24 24" className={`${base} text-slate-400`} fill="none" stroke="currentColor" strokeWidth="1.8" {...strokeProps}>
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="M8 13l2 2 2-2" />
    <line x1="10" y1="11" x2="10" y2="15" />
    <line x1="16" y1="13" x2="13" y2="13" />
  </svg>
);

/* ==========================================
   BACKEND / APP LANGUAGES
   ========================================== */

export const JavaIcon = () => (
  <svg viewBox="0 0 24 24" className={`${base} text-red-400`} fill="none" stroke="currentColor" strokeWidth="1.8" {...strokeProps}>
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="M9 16c1.5 1 3.5 1 5 0" />
    <path d="M8 12a4 4 0 0 1 8 0" />
    <line x1="12" y1="12" x2="12" y2="10" />
  </svg>
);

export const PythonIcon = () => (
  <svg viewBox="0 0 24 24" className={`${base} text-blue-400`} fill="none" stroke="currentColor" strokeWidth="1.8" {...strokeProps}>
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="M10 11v2a2 2 0 0 0 2 2h2" />
    <path d="M14 17v-2a2 2 0 0 0-2-2h-2" />
  </svg>
);

export const CppIcon = () => (
  <svg viewBox="0 0 24 24" className={`${base} text-blue-500`} fill="none" stroke="currentColor" strokeWidth="1.8" {...strokeProps}>
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="M9 14a2 2 0 1 1 0-4" />
    <line x1="14" y1="12" x2="18" y2="12" />
    <line x1="16" y1="10" x2="16" y2="14" />
  </svg>
);

/* ==========================================
   DEVOPS
   ========================================== */

export const GitIcon = () => (
  <svg viewBox="0 0 24 24" className={`${base} text-orange-600`} fill="none" stroke="currentColor" strokeWidth="1.8" {...strokeProps}>
    <circle cx="12" cy="18" r="2" />
    <circle cx="6" cy="6" r="2" />
    <circle cx="18" cy="6" r="2" />
    <path d="M6 8v6a4 4 0 0 0 4 4h2" />
    <path d="M18 8v1a4 4 0 0 1-4 4h-2" />
  </svg>
);

export const DockerIcon = () => (
  <svg viewBox="0 0 24 24" className={`${base} text-blue-500`} fill="none" stroke="currentColor" strokeWidth="1.8" {...strokeProps}>
    <path d="M4 10h6" />
    <path d="M22 13c0 4-3 7-7 7H4v-8h8l2-2h3l3 2v1z" />
    <rect x="4" y="6" width="4" height="4" rx="1" />
    <rect x="10" y="6" width="4" height="4" rx="1" />
    <rect x="4" y="2" width="4" height="4" rx="1" />
  </svg>
);