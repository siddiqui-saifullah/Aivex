const CommonErrors = () => {
  return (
    <div className="space-y-14 animate-in fade-in duration-300">
      {/* Header */}
      <section className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tight text-white">
          Common Errors
        </h1>

        <p className="text-zinc-400 leading-relaxed">
          The following issues are common during project setup and execution.
          Review these points if your project fails to run.
        </p>
      </section>

      {/* Error List */}
      <section className="space-y-10">
        {/* Missing package.json */}
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-white">
            Missing package.json
          </h2>

          <p className="text-zinc-400 leading-relaxed">
            A <code className="font-mono text-[#14b8a6]">package.json</code>{" "}
            file is required to install dependencies and start the server.
          </p>

          <div className="border-l-2 border-red-500/70 pl-4 bg-red-500/5 py-2 rounded-sm">
            <p className="text-sm text-red-400 font-medium">Error</p>
            <p className="text-sm text-zinc-400 mt-1">
              If the file is missing, dependency installation will fail and the
              project will not start.
            </p>
          </div>
        </div>

        {/* Wrong start script */}
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-white">
            Incorrect start Script
          </h2>

          <p className="text-zinc-400 leading-relaxed">
            The <code className="font-mono text-white">start</code> script
            inside{" "}
            <code className="font-mono text-[#14b8a6]">package.json</code> must
            reference your root entry file.
          </p>

          <div className="border-l-2 border-red-500/70 pl-4 bg-red-500/5 py-2 rounded-sm">
            <p className="text-sm text-red-400 font-medium">Error</p>
            <p className="text-sm text-zinc-400 mt-1">
              If the entry file is incorrect or does not exist, the server will
              fail during the Starting phase.
            </p>
          </div>
        </div>

        {/* Deleted .aivex */}
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-white">
            Deleted .aivex File
          </h2>

          <p className="text-zinc-400 leading-relaxed">
            Every project contains a system configuration file named{" "}
            <code className="font-mono text-[#14b8a6]">.aivex</code>.
          </p>

          <div className="border-l-2 border-red-500/70 pl-4 bg-red-500/5 py-2 rounded-sm">
            <p className="text-sm text-red-400 font-medium">Critical</p>
            <p className="text-sm text-zinc-400 mt-1">
              Deleting or modifying this file may break project execution. If
              removed, recreate the project.
            </p>
          </div>
        </div>

        {/* MongoDB Not Connected */}
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-white">
            MongoDB Not Connected
          </h2>

          <p className="text-zinc-400 leading-relaxed">
            If your project depends on MongoDB and the database is not properly
            configured, runtime errors may occur.
          </p>

          <ul className="list-disc list-inside text-zinc-400 space-y-2">
            <li>Invalid connection string</li>
            <li>Incorrect username or password</li>
            <li>IP access not enabled</li>
          </ul>

          <div className="border-l-2 border-yellow-500/70 pl-4 bg-yellow-500/5 py-2 rounded-sm">
            <p className="text-sm text-yellow-400 font-medium">Reminder</p>
            <p className="text-sm text-zinc-400 mt-1">
              Ensure your MongoDB Atlas network access allows connections from
              <code className="font-mono text-white"> 0.0.0.0/0</code> during
              development.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default CommonErrors;
