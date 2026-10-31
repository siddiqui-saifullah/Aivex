import { useEffect } from "react";

const SITE = "https://aivex.in";
const DEFAULT_IMAGE = `${SITE}/aivex.png`;

interface PageMeta {
  title: string;
  description: string;
  /** Path of the page's canonical URL, e.g. "/features". */
  path: string;
  image?: string;
  /** schema.org data for this page (JSON-LD). */
  jsonLd?: object;
}

const setMeta = (attr: "name" | "property", key: string, content: string) => {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
};

/**
 * Title, description, canonical URL, social cards and structured data for a
 * public page. Search engines render the app, so these are read per route.
 */
export const usePageMeta = ({ title, description, path, image = DEFAULT_IMAGE, jsonLd }: PageMeta) => {
  const json = jsonLd ? JSON.stringify(jsonLd) : "";

  useEffect(() => {
    const url = `${SITE}${path}`;
    document.title = title;
    setMeta("name", "description", description);
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("property", "og:url", url);
    setMeta("property", "og:image", image);
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", description);
    setMeta("name", "twitter:image", image);

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = url;

    let script: HTMLScriptElement | null = null;
    if (json) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.dataset.page = path;
      script.textContent = json;
      document.head.appendChild(script);
    }
    return () => script?.remove();
  }, [title, description, path, image, json]);
};
