import { useState, useEffect } from "react";
import { useNavigate } from "wouter";
import { Button } from "@/components/ui/button";
import { THEME } from "./constants";

export function Navigation() {
  const navigate = useNavigate();
  const [hasScrolled, setHasScrolled] = useState(false);
  
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
          <h2 className="text-2xl font-medium tracking-tight">
            {/* CUSTOMIZE: Update gradient colors in constants.ts */}
            <span className={`bg-gradient-to-r from-[${THEME.primary}] to-[${THEME.secondary}] bg-clip-text text-transparent`}>
              VoiceGen
            </span>
          </h2>
        </div>
        
        <div className="hidden md:flex items-center space-x-8">
          <a href="#features" className="text-sm hover:text-white transition-colors">Features</a>
          <a href="#examples" className="text-sm hover:text-white transition-colors">Examples</a>
          <a href="#testimonials" className="text-sm hover:text-white transition-colors">Testimonials</a>
        </div>
        
        <Button 
          onClick={() => navigate("/home")}
          variant="default"
          className="bg-white text-black hover:bg-white/90 transition-all rounded-full px-6"
        >
          Sign In
        </Button>
      </div>
    </nav>
  );
}