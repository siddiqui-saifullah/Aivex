const Privacy = () => {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16 text-white space-y-12">
      {/* Header */}
      <section className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="text-zinc-400 leading-relaxed">
          This Privacy Policy explains how Aivex collects, uses, and protects
          your information when you use our platform.
        </p>
      </section>

      {/* Sections */}
      <section className="space-y-10 text-zinc-400 leading-relaxed">
        {/* 1 */}
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-white">
            1. Information We Collect
          </h2>
          <p>We may collect the following information:</p>
          <ul className="list-disc list-inside space-y-2">
            <li>Email address and authentication details</li>
            <li>Project files and code stored within Aivex</li>
            <li>Usage data such as session activity and runtime logs</li>
          </ul>
        </div>

        {/* 2 */}
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-white">
            2. How We Use Your Information
          </h2>
          <ul className="list-disc list-inside space-y-2">
            <li>To provide and maintain the Aivex platform</li>
            <li>To enable project execution and database persistence</li>
            <li>To improve performance and system reliability</li>
          </ul>
        </div>

        {/* 3 */}
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-white">3. Data Storage</h2>
          <p>
            Project data and user information may be stored in remote databases
            such as MongoDB Atlas. All data is transmitted securely over HTTPS.
          </p>
        </div>

        {/* 4 */}
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-white">4. Data Security</h2>
          <p>
            We implement reasonable technical measures to protect user data.
            However, no system can guarantee absolute security.
          </p>
        </div>

        {/* 5 */}
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-white">
            5. Third-Party Services
          </h2>
          <p>
            Aivex may use third-party services such as database providers,
            authentication services, or AI APIs. These services operate under
            their own privacy policies.
          </p>
        </div>

        {/* 6 */}
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-white">
            6. Changes to This Policy
          </h2>
          <p>
            We may update this Privacy Policy periodically. Continued use of the
            platform constitutes acceptance of any updates.
          </p>
        </div>

        {/* 7 */}
        <div className="space-y-3">
          <h2 className="text-xl font-semibold text-white">7. Contact</h2>
          <p>
            If you have questions regarding this Privacy Policy, please contact
            us through the official Aivex website.
          </p>
        </div>
      </section>
    </div>
  );
};

export default Privacy;
