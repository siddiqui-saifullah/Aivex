import { useParams } from "react-router-dom";
import { useEffect } from "react";
import { docsConfig } from "./docsConfig";

const DocsContent = ({ setTitle }) => {
  const { slug } = useParams();

  const doc = docsConfig.find((item) => item.path === slug);

  useEffect(() => {
    if (doc) {
      setTitle(doc.title);
    }
  }, [doc, setTitle]);

  if (!doc) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">404</h1>
        <p className="text-slate-400">Documentation page not found.</p>
      </div>
    );
  }

  const SectionComponent = doc.component;

  return <SectionComponent />;
};

export default DocsContent;
