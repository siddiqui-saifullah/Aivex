import AppHeader from "../components/AppHeader";
import { Outlet } from "react-router-dom";

const AppLayout = () => {
  return (
    <>
      <AppHeader />
      <main className="pt-16 min-h-screen bg-black">
        <Outlet />
      </main>
    </>
  );
};

export default AppLayout;
