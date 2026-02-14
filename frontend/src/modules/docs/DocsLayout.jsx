import DocsSidebar from "./DocsSidebar";
import DocsContent from "./DocsContent";
import { useState } from "react";

const DocsLayout = () => {
  const [title, setTitle] = useState("Introduction");

  return (
    <div className="flex min-h-screen bg-black text-white">
      {/* Sidebar */}
      <div className="hidden md:block">
        <DocsSidebar />
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col">
        <main className="flex-1 px-8 py-14">
          <div className="max-w-4xl mx-auto">
            <DocsContent setTitle={setTitle} />
          </div>
        </main>
      </div>
    </div>
  );
};

export default DocsLayout;
