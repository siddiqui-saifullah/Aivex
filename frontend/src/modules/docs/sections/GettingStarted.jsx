import { Terminal } from "lucide-react";
import { CodeBlock } from "../../../components/ui";

const Step = ({ number, title, children }) => (
  <section className="space-y-3">
    <h2 className="text-xl font-semibold text-white flex items-center gap-3">
      <span className="w-6 h-6 flex items-center justify-center rounded-full bg-zinc-800 text-xs font-bold border border-zinc-700">
        {number}
      </span>
      {title}
    </h2>
    <div className="text-zinc-400 space-y-3 leading-relaxed">{children}</div>
  </section>
);

const GettingStarted = () => {
  return (
    <div className="max-w-3xl space-y-14 animate-in fade-in duration-300">
      {/* Header */}
      <section className="space-y-4 border-l-2 border-[#14b8a6] pl-5">
        <div className="flex items-center gap-3 text-[#14b8a6]">
          <Terminal size={18} />
          <span className="text-xs font-bold uppercase tracking-widest">
            User Guide
          </span>
        </div>

        <h1 className="text-4xl font-bold tracking-tight text-white">
          Getting Started
        </h1>

        <p className="text-zinc-400 leading-relaxed">
          Create, configure, and run your first project inside Aivex in a few
          simple steps.
        </p>
      </section>

      {/* Steps */}
      <div className="space-y-12">
        <Step number="1" title="Create an Account">
          <p>Register or log in to access your dashboard.</p>
        </Step>

        <Step number="2" title="Create a Project">
          <p>
            From the dashboard, click{" "}
            <span className="text-white font-medium">Create Project</span>.
          </p>
        </Step>

        <Step number="3" title="Open the Project">
          <p>Open the project and create files directly inside the editor.</p>
        </Step>

        <Step number="4" title="Create package.json (Required)">
          <p>
            To install dependencies, create a{" "}
            <code className="text-[#14b8a6] font-mono">package.json</code> file
            and define all required packages.
          </p>

          <CodeBlock>
            {`{
  "name": "speed-test",
  "version": "1.0.0",
  "main": "index.js",
  "type": "commonjs",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "ejs": "^3.1.9"
  }
}`}
          </CodeBlock>

          <p>
            Dependencies listed here are automatically installed when you click{" "}
            <span className="text-white font-medium">Run</span>.
          </p>

          {/* Warning */}
          <div className="border-l-2 border-yellow-500/70 pl-4 bg-yellow-500/5 py-2 rounded-sm">
            <p className="text-sm text-yellow-400 font-medium">Important</p>
            <p className="text-sm text-zinc-400 mt-1">
              The <code className="font-mono text-white">start</code> script
              must reference your root entry file (e.g.{" "}
              <code className="font-mono text-white">index.js</code>). If the
              entry file does not match your project structure, the server will
              fail to start.
            </p>
          </div>
        </Step>

        <Step number="5" title="Use Aivex AI (Optional)">
          <p>You can generate boilerplate using Aivex AI:</p>

          <CodeBlock>@Vex create an express server boilerplate</CodeBlock>
        </Step>

        <Step number="6" title="Click Run">
          <p>
            Click <span className="text-white font-medium">Run</span> to install
            dependencies and start the server.
          </p>

          <p>
            Files are persisted to the database after the first successful run.
            If you do not run the project, changes will not be saved.
          </p>
        </Step>
      </div>
    </div>
  );
};

export default GettingStarted;
