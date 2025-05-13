import { Link } from "wouter";
import { FOOTER_LINKS, THEME } from "./constants";

export function Footer() {
  return (
    <footer className="py-12 px-8 border-t border-zinc-800">
      <div className="container mx-auto">
        <div className="flex flex-col md:flex-row justify-between">
          <div className="mb-8 md:mb-0">
            <Link href="/">
              <h2 className="text-xl font-medium cursor-pointer">
                {/* CUSTOMIZE: Update gradient colors in constants.ts */}
                <span className={`bg-gradient-to-r from-[${THEME.primary}] to-[${THEME.secondary}] bg-clip-text text-transparent`}>
                  VoiceGen
                </span>
              </h2>
            </Link>
            <p className="text-sm text-zinc-500 mt-2 max-w-md">
              Transform any text into rich, AI-generated podcasts, voice clips, or long-form articles with advanced AI technology.
            </p>
            <p className="text-sm text-zinc-500 mt-6">© {new Date().getFullYear()} VoiceGen AI. All rights reserved.</p>
          </div>
          
          <div className="grid grid-cols-2 gap-x-12 gap-y-8 sm:grid-cols-3">
            {/* Main App Navigation */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">Product</h3>
              <ul className="space-y-2">
                <li>
                  <Link href="/create" className="text-sm text-zinc-500 hover:text-white transition-colors">Create</Link>
                </li>
                <li>
                  <Link href="/convert" className="text-sm text-zinc-500 hover:text-white transition-colors">Convert</Link>
                </li>
                <li>
                  <Link href="/library" className="text-sm text-zinc-500 hover:text-white transition-colors">Library</Link>
                </li>
                <li>
                  <Link href="/chat" className="text-sm text-zinc-500 hover:text-white transition-colors">Chat</Link>
                </li>
                <li>
                  <Link href="/search" className="text-sm text-zinc-500 hover:text-white transition-colors">Search</Link>
                </li>
              </ul>
            </div>
            
            {/* Landing page sections */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">Landing Page</h3>
              <ul className="space-y-2">
                <li>
                  <a href="#features" className="text-sm text-zinc-500 hover:text-white transition-colors">Features</a>
                </li>
                <li>
                  <a href="#examples" className="text-sm text-zinc-500 hover:text-white transition-colors">Examples</a>
                </li>

              </ul>
            </div>
            
            {/* Company/Legal links */}
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">Legal</h3>
              <ul className="space-y-2">
                {/* CUSTOMIZE: Update footer links in constants.ts */}
                {FOOTER_LINKS.map((link, index) => (
                  <li key={index}>
                    <a 
                      href={link.href} 
                      className="text-sm text-zinc-500 hover:text-white transition-colors"
                    >
                      {link.text}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}