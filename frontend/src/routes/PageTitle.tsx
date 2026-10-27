import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const TITLES: [RegExp, string][] = [
  [/^\/$/, "Aivex · AI-powered browser IDE"],
  [/^\/dashboard/, "Dashboard · Aivex"],
  [/^\/projects\//, "Project · Aivex"],
  [/^\/profile/, "Profile · Aivex"],
  [/^\/classes\//, "Class · Aivex"],
  [/^\/join/, "Join a class · Aivex"],
  [/^\/admin/, "Usage · Aivex"],
  [/^\/login/, "Sign in · Aivex"],
  [/^\/register/, "Create account · Aivex"],
  [/^\/auth\/callback/, "Signing in · Aivex"],
  [/^\/about/, "About · Aivex"],
  [/^\/contact/, "Contact · Aivex"],
  [/^\/docs/, "Docs · Aivex"],
  [/^\/privacy/, "Privacy · Aivex"],
  [/^\/terms/, "Terms · Aivex"],
];

/** Gives every route a meaningful tab title (pages may refine it, e.g. with the project name). */
const PageTitle = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = TITLES.find(([re]) => re.test(pathname))?.[1] ?? "Page not found · Aivex";
  }, [pathname]);
  return null;
};

export default PageTitle;
