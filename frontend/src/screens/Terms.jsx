const Terms = () => {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16 text-white space-y-12">
      {/* Header */}
      <section className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">Terms of Service</h1>
        <p className="text-zinc-400 leading-relaxed">
          These Terms of Service govern your access to and use of the Aivex
          platform. By using Aivex, you agree to comply with these terms.
        </p>
      </section>

      <section className="space-y-10 text-zinc-400 leading-relaxed">
        {/* 1 */}
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-white">
            1. Use of the Platform
          </h2>
          <p>
            Aivex provides a browser-based development environment for building
            and running applications. You agree to use the platform only for
            lawful purposes.
          </p>
        </div>

        {/* 2 */}
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-white">
            2. Account Responsibility
          </h2>
          <p>
            You are responsible for maintaining the confidentiality of your
            account credentials and for all activity that occurs under your
            account.
          </p>
        </div>

        {/* 3 */}
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-white">
            3. Prohibited Activities
          </h2>
          <ul className="list-disc list-inside space-y-2">
            <li>Using Aivex for illegal or harmful activities</li>
            <li>Attempting to exploit, disrupt, or damage the platform</li>
            <li>Uploading malicious code or unauthorized content</li>
          </ul>
        </div>

        {/* 4 */}
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-white">
            4. Intellectual Property
          </h2>
          <p>
            Users retain ownership of their project code. Aivex retains
            ownership of the platform, infrastructure, branding, and proprietary
            systems.
          </p>
        </div>

        {/* 5 */}
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-white">
            5. Service Availability
          </h2>
          <p>
            Aivex is provided on an "as is" basis. We do not guarantee
            uninterrupted service, and functionality may change or improve over
            time.
          </p>
        </div>

        {/* 6 */}
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-white">
            6. Limitation of Liability
          </h2>
          <p>
            Aivex is not responsible for data loss, service interruptions, or
            any indirect damages resulting from the use of the platform.
          </p>
        </div>

        {/* 7 */}
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-white">7. Termination</h2>
          <p>
            We reserve the right to suspend or terminate accounts that violate
            these terms.
          </p>
        </div>

        {/* 8 */}
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-white">
            8. Changes to Terms
          </h2>
          <p>
            We may update these Terms of Service at any time. Continued use of
            Aivex after updates indicates acceptance of the revised terms.
          </p>
        </div>
      </section>
    </div>
  );
};

export default Terms;
