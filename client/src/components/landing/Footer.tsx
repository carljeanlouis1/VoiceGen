import { FOOTER_LINKS, THEME } from "./constants";

export function Footer() {
  return (
    <footer className="py-12 px-8 border-t border-zinc-800">
      <div className="container mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-6 md:mb-0">
            <h2 className="text-xl font-medium">
              {/* CUSTOMIZE: Update gradient colors in constants.ts */}
              <span className={`bg-gradient-to-r from-[${THEME.primary}] to-[${THEME.secondary}] bg-clip-text text-transparent`}>
                VoiceGen
              </span>
            </h2>
            <p className="text-sm text-zinc-500 mt-2">© {new Date().getFullYear()} VoiceGen AI. All rights reserved.</p>
          </div>
          
          <div className="flex gap-8">
            {/* CUSTOMIZE: Update footer links in constants.ts */}
            {FOOTER_LINKS.map((link, index) => (
              <a 
                key={index} 
                href={link.href} 
                className="text-sm text-zinc-500 hover:text-white transition-colors"
              >
                {link.text}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}