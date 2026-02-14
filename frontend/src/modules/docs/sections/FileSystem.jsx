const FileSystem = () => {
  return (
    <div className="space-y-10 animate-in fade-in duration-300">
      {/* Title */}
      <section className="space-y-4">
        <h1 className="text-4xl font-bold text-white tracking-tight">
          File System
        </h1>

        <p className="text-zinc-400 leading-relaxed">
          Aivex runs projects inside an isolated virtual file system. All files
          and folders exist within this environment during execution.
        </p>
      </section>

      {/* .aivex file */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-white">
          .aivex (System File)
        </h2>

        <p className="text-zinc-400 leading-relaxed">
          Every project contains a default{" "}
          <code className="text-[#14b8a6] font-mono">.aivex</code> file. This
          file is required for internal system configuration.
        </p>

        <div className="border-l-2 border-yellow-500/70 pl-4 bg-yellow-500/5 py-2 rounded-sm">
          <p className="text-sm text-yellow-400 font-medium">Important</p>
          <p className="text-sm text-zinc-400 mt-1">
            Do not delete or modify the{" "}
            <code className="font-mono text-white">.aivex</code> file. Removing
            it may break project execution.
          </p>
        </div>
      </section>

      {/* package.json */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-white">
          package.json (Required)
        </h2>

        <p className="text-zinc-400 leading-relaxed">
          A <code className="text-[#14b8a6] font-mono">package.json</code> file
          is mandatory for dependency installation and runtime execution.
        </p>

        <p className="text-zinc-400 leading-relaxed">
          The <code className="font-mono text-white">start</code> script must
          reference the root entry file of your project.
        </p>

        <div className="border-l-2 border-yellow-500/70 pl-4 bg-yellow-500/5 py-2 rounded-sm">
          <p className="text-sm text-yellow-400 font-medium">Warning</p>
          <p className="text-sm text-zinc-400 mt-1">
            If the <code className="font-mono text-white">start</code> script
            does not point to the correct root file, the server will fail to
            start.
          </p>
        </div>
      </section>

      {/* Creating Files & Folders */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-white">
          Creating Files and Folders
        </h2>

        <p className="text-zinc-400 leading-relaxed">
          Users can create files and folders using the{" "}
          <span className="text-white font-medium">+</span> icon in the file
          explorer.
        </p>

        <ul className="list-disc list-inside text-zinc-400 space-y-2">
          <li>
            Click the <span className="text-white font-medium">+</span> icon to
            create a new file at the root level.
          </li>
          <li>
            To create a file inside a folder, hover over that folder and click
            the <span className="text-white font-medium">+</span> icon.
          </li>
        </ul>
      </section>

      {/* Empty Folder Behavior */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-white">
          Empty Folder Behavior
        </h2>

        <p className="text-zinc-400 leading-relaxed">
          Empty folders are not persisted.
        </p>

        <p className="text-zinc-400 leading-relaxed">
          If a folder contains no files, it will automatically be removed when
          the project is saved to the database.
        </p>
      </section>
    </div>
  );
};

export default FileSystem;
