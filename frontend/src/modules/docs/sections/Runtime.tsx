const Runtime = () => {
  return (
    <div className="space-y-14 animate-in fade-in duration-300">
      {/* Header */}
      <section className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tight text-white">
          Runtime & Execution Model
        </h1>

        <p className="text-zinc-400 leading-relaxed">
          When you click <span className="text-white font-medium">Run</span>,
          Aivex initializes a virtual runtime environment and executes your
          project inside the browser.
        </p>
      </section>

      {/* Execution Flow */}
      <section className="space-y-10">
        {/* Step 1 */}
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-white">
            1. Installing Dependencies
          </h2>

          <p className="text-zinc-400 leading-relaxed">
            All required packages listed in{" "}
            <code className="font-mono text-[#14b8a6]">package.json</code> are
            automatically installed.
          </p>

          <p className="text-zinc-400 leading-relaxed">
            During this process, the editor header displays the status:
            <span className="text-white font-medium"> Installing</span>.
          </p>
        </div>

        {/* Step 2 */}
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-white">
            2. Starting the Server
          </h2>

          <p className="text-zinc-400 leading-relaxed">
            After installation completes, Aivex executes the{" "}
            <code className="font-mono text-white">start</code> script defined
            in your{" "}
            <code className="font-mono text-[#14b8a6]">package.json</code>.
          </p>

          <p className="text-zinc-400 leading-relaxed">
            The status updates to:
            <span className="text-white font-medium"> Starting</span>.
          </p>
        </div>

        {/* Step 3 */}
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-white">3. Running</h2>

          <p className="text-zinc-400 leading-relaxed">
            Once the server initializes successfully, the project enters the{" "}
            <span className="text-white font-medium">Running</span> state.
          </p>
        </div>

        {/* Step 4 */}
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-white">
            4. Automatic Preview
          </h2>

          <p className="text-zinc-400 leading-relaxed">
            When the server starts successfully, the preview panel opens
            automatically within the same tab.
          </p>

          <p className="text-zinc-400 leading-relaxed">
            No additional configuration is required.
          </p>
        </div>
      </section>

      {/* Persistence Note */}
      <section className="border-l-2 border-[#14b8a6] pl-5">
        <p className="text-sm text-zinc-500 leading-relaxed">
          After the first successful run, project files are persisted to the
          database.
        </p>
      </section>

      {/* Performance Section */}
      <section className="space-y-6">
        <h2 className="text-xl font-semibold text-white">
          Performance & Execution Time
        </h2>

        <p className="text-zinc-400 leading-relaxed">
          Installation and startup time may vary depending on your system
          configuration and internet speed.
        </p>

        <ul className="list-disc list-inside text-zinc-400 space-y-2">
          <li>CPU and memory performance</li>
          <li>Browser performance</li>
          <li>Internet connection speed</li>
          <li>Size of installed dependencies</li>
        </ul>

        <div className="border-l-2 border-yellow-500/70 pl-4 bg-yellow-500/5 py-2 rounded-sm">
          <p className="text-sm text-yellow-400 font-medium">Note</p>
          <p className="text-sm text-zinc-400 mt-1 leading-relaxed">
            Please wait while dependencies are installing and the server is
            starting. Larger projects may take additional time during the first
            run.
          </p>
        </div>
      </section>
    </div>
  );
};

export default Runtime;
