import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { THEME } from "./constants";

export function Navigation() {
  const [, navigate] = useLocation();
  const [hasScrolled, setHasScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Handle scroll effects
  useEffect(() => {
    const handleScroll = () => {
      setHasScrolled(window.scrollY > 10);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${hasScrolled ? 'bg-black/80 backdrop-blur-lg' : 'bg-transparent'}`}>
      <div className="container mx-auto px-8 py-6 flex items-center justify-between">
        <div className="flex items-center">
          <Link href="/">
            <h2 className="text-2xl font-medium tracking-tight cursor-pointer">
              {/* CUSTOMIZE: Update gradient colors in constants.ts */}
              <span className={`bg-gradient-to-r from-[${THEME.primary}] to-[${THEME.secondary}] bg-clip-text text-transparent`}>
                VoiceGen
              </span>
            </h2>
          </Link>
        </div>
        
        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center space-x-8">
          {/* Landing page section links */}
          <a href="#features" className="text-sm hover:text-white transition-colors">Features</a>
          <a href="#examples" className="text-sm hover:text-white transition-colors">Examples</a>
          <a href="#testimonials" className="text-sm hover:text-white transition-colors">Testimonials</a>
          
          {/* App navigation */}
          <div className="pl-8 border-l border-zinc-700 flex items-center space-x-6">
            <Link href="/create" className="text-sm hover:text-white transition-colors">Create</Link>
            <Link href="/convert" className="text-sm hover:text-white transition-colors">Convert</Link>
            <Link href="/chat" className="text-sm hover:text-white transition-colors">Chat</Link>
            <Link href="/search" className="text-sm hover:text-white transition-colors">Search</Link>
            <Link href="/library" className="text-sm hover:text-white transition-colors">Library</Link>
          </div>
        </div>
        
        {/* Mobile menu button */}
        <div className="flex md:hidden items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            className="text-zinc-400 hover:text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              )}
            </svg>
          </Button>
          
          <Button 
            onClick={() => navigate("/home")}
            variant="default"
            className="bg-white text-black hover:bg-white/90 transition-all rounded-full px-6"
          >
            Sign In
          </Button>
        </div>
        
        {/* Desktop Sign In button */}
        <div className="hidden md:block">
          <Button 
            onClick={() => navigate("/home")}
            variant="default"
            className="bg-white text-black hover:bg-white/90 transition-all rounded-full px-6"
          >
            Sign In
          </Button>
        </div>
      </div>
      
      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-black/95 backdrop-blur-lg border-t border-zinc-800">
          <div className="px-4 py-6 space-y-4">
            {/* Landing page section links */}
            <div className="border-b border-zinc-800 pb-4 space-y-3">
              <p className="text-xs uppercase text-zinc-500 font-medium mb-2">Landing Page</p>
              <a 
                href="#features" 
                className="block text-zinc-300 hover:text-white transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Features
              </a>
              <a 
                href="#examples" 
                className="block text-zinc-300 hover:text-white transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Examples
              </a>
              <a 
                href="#testimonials" 
                className="block text-zinc-300 hover:text-white transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Testimonials
              </a>
            </div>
            
            {/* App navigation */}
            <div className="pt-2 space-y-3">
              <p className="text-xs uppercase text-zinc-500 font-medium mb-2">App Navigation</p>
              <Link 
                href="/create" 
                className="block text-zinc-300 hover:text-white transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Create
              </Link>
              <Link 
                href="/convert" 
                className="block text-zinc-300 hover:text-white transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Convert
              </Link>
              <Link 
                href="/chat" 
                className="block text-zinc-300 hover:text-white transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Chat
              </Link>
              <Link 
                href="/search" 
                className="block text-zinc-300 hover:text-white transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Search
              </Link>
              <Link 
                href="/library" 
                className="block text-zinc-300 hover:text-white transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Library
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}