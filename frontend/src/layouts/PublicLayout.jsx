import PublicHeader from "../components/PublicHeader";
import Footer from "../components/Footer";
import { Outlet } from "react-router-dom";

const PublicLayout = () => {
  return (
    <>
      <PublicHeader />
      <main className="pt-16 min-h-screen bg-black">
        <Outlet />
      </main>
      <Footer />
    </>
  );
};

export default PublicLayout;
