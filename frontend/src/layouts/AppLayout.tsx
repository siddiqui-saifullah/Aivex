import AppHeader from "../components/AppHeader";
import ServerOutdatedBanner from "../components/shared/ServerOutdatedBanner";
import { Outlet } from "react-router-dom";

const AppLayout = () => {
  return (
    <>
      <AppHeader />
      <ServerOutdatedBanner />
      <main className="pt-16 min-h-dvh bg-black">
        <Outlet />
      </main>
    </>
  );
};

export default AppLayout;
