const base = "w-4 h-4 shrink-0";
const strokeProps = { strokeLinecap: "round", strokeLinejoin: "round" };

/* ==========================================
   GENERIC / SYSTEM
   ========================================== */

export const FileIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className={base}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    {...strokeProps}
  >
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

export const XIcon = () => (
  <svg
    role="img"
    viewBox="0 0 24 24"
    className={base}
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <title>X</title>
    <path d="M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z" />
  </svg>
);

export const GithubIcon = () => (
  <svg
    role="img"
    viewBox="0 0 24 24"
    className={base}
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <title>GitHub</title>
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
  </svg>
);

export const FolderIcon = ({ open }) => (
  <svg
    viewBox="0 0 24 24"
    className={`${base} text-teal-400`}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    {...strokeProps}
  >
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
  <svg
    viewBox="0 0 24 24"
    className={`${base} text-zinc-400`}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    {...strokeProps}
  >
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.18-.08a2 2 0 0 0-2.66 1.1l-.17.3a2 2 0 0 0 .45 2.54l.15.12a2 2 0 0 1 0 2.9l-.15.12a2 2 0 0 0-.45 2.54l.17.3a2 2 0 0 0 2.66 1.1l.18-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.18.08a2 2 0 0 0 2.66-1.1l.17-.3a2 2 0 0 0-.45-2.54l-.15-.12a2 2 0 0 1 0-2.9l.15-.12a2 2 0 0 0 .45-2.54l-.17-.3a2 2 0 0 0-2.66-1.1l-.18.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const ServerIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className={`${base} text-emerald-400`}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    {...strokeProps}
  >
    <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
    <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
    <line x1="6" y1="6" x2="6.01" y2="6" />
    <line x1="6" y1="18" x2="6.01" y2="18" />
  </svg>
);

export const DatabaseIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className={`${base} text-emerald-400`}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    {...strokeProps}
  >
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
  </svg>
);

export const TerminalIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className={`${base} text-slate-300`}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    {...strokeProps}
  >
    <polyline points="4 17 10 11 4 5" />
    <line x1="12" y1="19" x2="20" y2="19" />
  </svg>
);

/* ==========================================
   WEB LANGUAGES (File Outline + Symbol)
   ========================================== */

export const JSIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className={`${base} text-yellow-400`}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    {...strokeProps}
  >
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    {/* Letter J */}
    <path d="M12 18v-6" />
    <path d="M8 17a2 2 0 0 0 4 0" />
  </svg>
);

export const JSONIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className={`${base} text-orange-400`}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    {...strokeProps}
  >
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="M8 13a2 2 0 0 0 2-2v-1" />
    <path d="M16 13a2 2 0 0 1-2-2v-1" />
    <circle cx="12" cy="17" r="1" fill="currentColor" />
  </svg>
);

export const HtmlIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className={`${base} text-orange-500`}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    {...strokeProps}
  >
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="M8 13l2 2 2-2" transform="rotate(-90 10 13)" />
    <path d="M14 13l2 2 2-2" transform="rotate(-90 16 13) translate(2,0)" />
  </svg>
);

export const CssIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className={`${base} text-sky-400`}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    {...strokeProps}
  >
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="M8 13h8" />
    <path d="M8 17h8" />
    <path d="M14 11l-2 8" />
  </svg>
);

export const MarkdownIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className={`${base} text-slate-400`}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    {...strokeProps}
  >
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
  <svg
    viewBox="0 0 24 24"
    className={`${base} text-red-400`}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    {...strokeProps}
  >
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="M9 16c1.5 1 3.5 1 5 0" />
    <path d="M8 12a4 4 0 0 1 8 0" />
    <line x1="12" y1="12" x2="12" y2="10" />
  </svg>
);

export const PythonIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className={`${base} text-blue-400`}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    {...strokeProps}
  >
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="M10 11v2a2 2 0 0 0 2 2h2" />
    <path d="M14 17v-2a2 2 0 0 0-2-2h-2" />
  </svg>
);

export const CppIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className={`${base} text-blue-500`}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    {...strokeProps}
  >
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
  <svg
    viewBox="0 0 24 24"
    className={`${base} text-orange-600`}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    {...strokeProps}
  >
    <circle cx="12" cy="18" r="2" />
    <circle cx="6" cy="6" r="2" />
    <circle cx="18" cy="6" r="2" />
    <path d="M6 8v6a4 4 0 0 0 4 4h2" />
    <path d="M18 8v1a4 4 0 0 1-4 4h-2" />
  </svg>
);

export const DockerIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className={`${base} text-blue-500`}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    {...strokeProps}
  >
    <path d="M4 10h6" />
    <path d="M22 13c0 4-3 7-7 7H4v-8h8l2-2h3l3 2v1z" />
    <rect x="4" y="6" width="4" height="4" rx="1" />
    <rect x="10" y="6" width="4" height="4" rx="1" />
    <rect x="4" y="2" width="4" height="4" rx="1" />
  </svg>
);
