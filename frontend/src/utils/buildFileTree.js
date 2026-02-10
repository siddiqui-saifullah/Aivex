export function buildFileTree(fileTree) {
    const root = {};

    Object.keys(fileTree).forEach((path) => {
        const parts = path.split("/");
        let current = root;

        parts.forEach((part, index) => {
            if (!current[part]) {
                const isFile = index === parts.length - 1;
                const fileContent = fileTree[path];

                current[part] = {
                    __isFile: isFile,
                    __children: {},
                    // Store file content if it's a file (can be string or array)
                    ...(isFile && fileContent ? { __content: fileContent } : {}),
                };
            }
            current = current[part].__children;
        });
    });

    return root;
}
