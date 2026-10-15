import { CodeBlock } from "../../../components/ui";

const MongoSetup = () => {
  return (
    <div className="space-y-10 animate-in fade-in duration-300">
      {/* Title */}
      <section className="space-y-4">
        <h1 className="text-4xl font-bold text-white tracking-tight">
          MongoDB Setup
        </h1>

        <p className="text-zinc-400 leading-relaxed">
          Aivex supports remote MongoDB connections. We recommend using MongoDB
          Atlas for database hosting.
        </p>
      </section>

      {/* Step 1 */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-white">
          1. Create a MongoDB Atlas Account
        </h2>

        <ol className="list-decimal list-inside text-zinc-400 space-y-2">
          <li>Visit the MongoDB Atlas website.</li>
          <li>Sign up or log in.</li>
          <li>Create a new project.</li>
        </ol>
      </section>

      {/* Step 2 */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-white">
          2. Create a Cluster
        </h2>

        <ol className="list-decimal list-inside text-zinc-400 space-y-2">
          <li>
            Click <span className="text-white">Build a Database</span>.
          </li>
          <li>Select the free shared cluster (recommended for development).</li>
          <li>Choose a region.</li>
          <li>Create the cluster.</li>
        </ol>
      </section>

      {/* Step 3 */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-white">
          3. Create Database User
        </h2>

        <ol className="list-decimal list-inside text-zinc-400 space-y-2">
          <li>
            Go to <span className="text-white">Database Access</span>.
          </li>
          <li>Create a new database user.</li>
          <li>Set a username and password.</li>
          <li>Give read and write permissions.</li>
        </ol>
      </section>

      {/* Step 4 */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-white">
          4. Enable Network Access (Important)
        </h2>

        <p className="text-zinc-400">
          Go to <span className="text-white">Network Access</span> and allow
          connections from anywhere.
        </p>

        <div className="border-l-2 border-yellow-500/70 pl-4 bg-yellow-500/5 py-2 rounded-sm">
          <p className="text-sm text-yellow-400 font-medium">Important</p>
          <p className="text-sm text-zinc-400 mt-1">
            Add IP address{" "}
            <code className="font-mono text-white">0.0.0.0/0</code>
            to allow access from any location. Without this, Aivex will not be
            able to connect remotely.
          </p>
        </div>
      </section>

      {/* Step 5 */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-white">
          5. Get Connection String
        </h2>

        <ol className="list-decimal list-inside text-zinc-400 space-y-2">
          <li>Go to your cluster dashboard.</li>
          <li>
            Click <span className="text-white">Connect</span>.
          </li>
          <li>
            Select <span className="text-white">Connect your application</span>.
          </li>
          <li>Copy the provided connection string.</li>
        </ol>
      </section>

      {/* Step 6 */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-white">
          6. Add to Environment File
        </h2>

        <p className="text-zinc-400">
          Paste the connection string inside your{" "}
          <code className="font-mono text-[#14b8a6]">.env</code> file:
        </p>

        <CodeBlock>
          {`MONGO_URI=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/yourDatabaseName`}
        </CodeBlock>

        <p className="text-zinc-400">
          Replace <code className="font-mono text-white">username</code>,{" "}
          <code className="font-mono text-white">password</code>, and database
          name with your actual credentials.
        </p>
      </section>

      {/* Final Note */}
      <section className="space-y-4">
        <p className="text-zinc-400 leading-relaxed">
          Once configured, Aivex will connect to MongoDB remotely and your data
          will persist securely in the cloud.
        </p>
      </section>
    </div>
  );
};

export default MongoSetup;
