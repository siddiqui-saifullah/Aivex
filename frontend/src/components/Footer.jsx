import { XIcon, GithubIcon } from "../assets/fileIcons";

const Footer = () => {
  return (
    <footer className="border-t border-white/10 py-12 bg-black">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
        <div className="col-span-2 md:col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <img src="/aivex.svg" alt="Aivex" className="w-8 h-8" />
            <span className="font-bold">Aivex</span>
          </div>
          <p className="text-sm text-zinc-500">
            The AI-native IDE for the next generation of software creators.
          </p>
        </div>

        <div>
          <h4 className="font-bold mb-4">Product</h4>
          <ul className="space-y-2 text-sm text-zinc-400">
            <li>
              <a href="#" className="hover:text-white">
                Features
              </a>
            </li>
            <li>
              <a href="/docs" className="hover:text-white">
                Docs
              </a>
            </li>
            {/* <li>
              <a href="#" className="hover:text-white">
                Integrations
              </a>
            </li> */}
            {/* <li>
              <a href="#" className="hover:text-white">
                Pricing
              </a>
            </li> */}
            {/* <li>
              <a href="#" className="hover:text-white">
                Changelog
              </a>
            </li> */}
          </ul>
        </div>

        <div>
          <h4 className="font-bold mb-4">Company</h4>
          <ul className="space-y-2 text-sm text-zinc-400">
            <li>
              <a href="/about" className="hover:text-white">
                About
              </a>
            </li>
            {/* <li>
              <a href="#" className="hover:text-white">
                Blog
              </a>
            </li> */}
            {/* <li>
              <a href="#" className="hover:text-white">
                Careers
              </a>
            </li> */}
            <li>
              <a href="contact" className="hover:text-white">
                Contact
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold mb-4">Legal</h4>
          <ul className="space-y-2 text-sm text-zinc-400">
            <li>
              <a href="/privacy" className="hover:text-white">
                Privacy
              </a>
            </li>
            <li>
              <a href="/terms" className="hover:text-white">
                Terms
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-zinc-600 text-sm">
          © 2026 Aivex AI Inc. All rights reserved.
        </p>
        <div className="flex gap-4">
          <a href="#" className="text-zinc-500 hover:text-white">
            <GithubIcon size={22} />
          </a>
          <a href="#" className="text-zinc-500 hover:text-white">
            <XIcon size={20} />
          </a>
          {/* <a href="#" className="text-zinc-500 hover:text-white"><X size={20} /></a> */}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
