const Introduction = () => {
  return (
    <div className="space-y-10 animate-in fade-in duration-300">
      {/* Title */}
      <section className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tight text-white">
          Introduction
        </h1>

        <p className="text-lg text-zinc-400 leading-relaxed">
          <span className="text-white font-medium">Aivex</span> is a
          browser-based IDE with built-in AI that enables users to create and
          run Node.js servers without local installation.
        </p>
      </section>

      {/* Description */}
      <section className="space-y-6 text-zinc-400 leading-relaxed">
        <p>
          Applications run inside an isolated browser runtime environment. You
          can write code, start a server, and preview your project directly in
          the same tab.
        </p>

        <p>
          Projects can be created manually or generated using Aivex AI by
          invoking the assistant (e.g.{" "}
          <span className="text-white font-mono">@Vex hi</span>).
        </p>
      </section>

      {/* Callout */}
      <section className="border-l-2 border-[#14b8a6] pl-5">
        <p className="text-sm text-zinc-500">
          Continue to <span className="text-zinc-300">Getting Started</span> for
          setup and workflow details.
        </p>
      </section>
    </div>
  );
};

export default Introduction;
