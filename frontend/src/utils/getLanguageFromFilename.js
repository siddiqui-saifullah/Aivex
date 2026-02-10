const getLanguageFromFilename = (filename) => {
    if (!filename || typeof filename !== "string") return "plaintext";

    const lower = filename.toLowerCase();

    // ---------- Special / config files ----------
    if (lower === "package.json") return "json";
    if (lower === "package-lock.json") return "json";
    if (lower === "tsconfig.json") return "json";
    if (lower === "jsconfig.json") return "json";
    if (lower === ".eslintrc" || lower.endsWith(".eslintrc.json")) return "json";
    if (lower === ".prettierrc" || lower.endsWith(".prettierrc.json")) return "json";

    if (lower === ".gitignore") return "plaintext";
    if (lower === ".env" || lower.startsWith(".env.")) return "plaintext";
    if (lower === "dockerfile") return "dockerfile";
    if (lower === "makefile") return "makefile";

    // ---------- Extension-based ----------
    const ext = lower.split(".").pop();

    switch (ext) {

        case "js":
        case "jsx":
            return "javascript";
        case "ts":
        case "tsx":
            return "typescript";


        case "html":
            return "html";
        case "css":
            return "css";
        case "scss":
            return "scss";
        case "sass":
            return "sass";
        case "less":
            return "less";


        case "json":
            return "json";
        case "yaml":
        case "yml":
            return "yaml";
        case "xml":
            return "xml";
        case "toml":
            return "toml";

        case "java":
            return "java";
        case "py":
            return "python";
        case "rb":
            return "ruby";
        case "php":
            return "php";
        case "go":
            return "go";
        case "rs":
            return "rust";
        case "cs":
            return "csharp";


        case "c":
            return "c";
        case "cpp":
        case "cc":
        case "cxx":
        case "h":
        case "hpp":
            return "cpp";


        case "sh":
            return "shell";
        case "bash":
            return "shell";
        case "ps1":
            return "powershell";


        case "sql":
            return "sql";


        case "md":
            return "markdown";
        case "txt":
            return "plaintext";


        case "gradle":
            return "groovy";
        case "bat":
            return "bat";
        case "ejs":
            return "html";

        default:
            return "plaintext";
    }
};

export default getLanguageFromFilename;
