import PublicHeader from "../PublicHeader";
import Footer from "../Footer";
const Loader = () => {
  return (
    <>
      <PublicHeader />
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="relative w-40 h-40">
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 512 512"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="drop-shadow-[0_0_20px_rgba(34,211,238,0.4)]"
          >
            <defs>
              <linearGradient
                id="a"
                x1="0"
                y1="0"
                x2="512"
                y2="512"
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0%" stop-color="#22d3ee" />
                <stop offset="100%" stop-color="#14b8a6" />
              </linearGradient>
            </defs>

            {/* Outer Border Box */}
            <rect
              x="80"
              y="80"
              width="352"
              height="352"
              rx="96"
              stroke="url(#a)"
              strokeWidth="52"
            />

            {/* Inner White Box */}
            <rect
              x="156"
              y="156"
              width="200"
              height="200"
              rx="32"
              stroke="#fff"
              strokeWidth="36"
            />

            {/* Animated Horizontal Scanning Bar (Dandi) */}
            <g className="animate-[horizontalScan_1.8s_ease-in-out_infinite]">
              <path
                stroke="#fff"
                strokeWidth="28"
                strokeLinecap="round"
                d="M0 198v116"
                className="drop-shadow-[0_0_12px_rgba(255,255,255,0.9)]"
              />
            </g>
          </svg>

          {/* Optional: Subtle Glow underneath */}
          <div className="absolute inset-0 bg-[#14b8a6]/5 blur-[100px] rounded-full -z-10 animate-pulse" />
        </div>

        <style
          dangerouslySetInnerHTML={{
            __html: `
        @keyframes horizontalScan {
          0% { transform: translateX(180px); opacity: 0; }
          20% { opacity: 1; }
          50% { transform: translateX(256px); }
          80% { opacity: 1; }
          100% { transform: translateX(332px); opacity: 0; }
        }
      `,
          }}
        />
      </div>
      <Footer />
    </>
  );
};

export default Loader;
