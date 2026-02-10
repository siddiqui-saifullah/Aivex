import {
    FileIcon,
    JSIcon,
    JSONIcon,
    ServerIcon,
    ConfigIcon,
    HtmlIcon,
    CssIcon,
    MarkdownIcon,
    DatabaseIcon,
    TerminalIcon,
    JavaIcon,
    PythonIcon,
    CppIcon,
    GitIcon,
    DockerIcon,
} from "../assets/fileIcons";


export function getFileIcon(name) {
    if (!name || typeof name !== "string") return FileIcon;

    const lower = name.toLowerCase();

    // ---------- Special / config / hidden ----------
    if (lower.startsWith(".env")) return ConfigIcon;
    if (lower === ".gitignore") return GitIcon;
    if (lower === "dockerfile") return DockerIcon;
    if (lower === "makefile") return ConfigIcon;

    if (
        lower === "package.json" ||
        lower === "package-lock.json" ||
        lower === "tsconfig.json" ||
        lower === "jsconfig.json" ||
        lower.endsWith(".eslintrc") ||
        lower.endsWith(".prettierrc")
    ) {
        return JSONIcon;
    }

    // ---------- Extension-based ----------
    const ext = lower.split(".").pop();

    switch (ext) {
        // JavaScript / TypeScript
        case "js":
        case "jsx":
        case "ts":
        case "tsx":
            return JSIcon;

        // Web
        case "html":
        case "ejs":
            return HtmlIcon;
        case "css":
        case "scss":
        case "sass":
        case "less":
            return CssIcon;

        // Data / config
        case "json":
        case "yaml":
        case "yml":
        case "xml":
        case "toml":
            return JSONIcon;

        // Backend / languages
        case "java":
            return JavaIcon;
        case "py":
            return PythonIcon;
        case "c":
        case "cpp":
        case "cc":
        case "cxx":
        case "h":
        case "hpp":
            return CppIcon;

        // Shell / scripts
        case "sh":
        case "bash":
        case "ps1":
        case "bat":
            return TerminalIcon;

        // Database
        case "sql":
            return DatabaseIcon;

        // Docs
        case "md":
            return MarkdownIcon;

        // Server / entry files
        case "go":
        case "rs":
        case "php":
        case "rb":
            return ServerIcon;

        default:
            return FileIcon;
    }
}

