import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { 
  Headphones, 
  MessageSquare, 
  Search, 
  Library, 
  Sparkles, 
  Menu, 
  X,
  Home,
  User,
  Settings,
  Moon,
  Sun
} from 'lucide-react';
import { useTheme } from '@/lib/theme-provider';
import { Button } from '@/components/ui/button';
import { COLORS, SPACING, TRANSITIONS } from './design-tokens';

/**
 * Main application layout with unified navigation
 */
interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  
  // Handle scroll effects
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  // Navigation items
  const navItems = [
    { name: 'Home', href: '/', icon: Home },
    { name: 'Create', href: '/create', icon: Sparkles },
    { name: 'Convert', href: '/convert', icon: Headphones },
    { name: 'Chat', href: '/chat', icon: MessageSquare },
    { name: 'Search', href: '/search', icon: Search },
    { name: 'Library', href: '/library', icon: Library }
  ];
  
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-800 to-black text-zinc-200">
      {/* Header */}
      <header 
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled ? 'bg-black/80 backdrop-blur-lg' : 'bg-transparent'
        }`}
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Logo */}
            <Link href="/">
              <div className="flex items-center space-x-2 cursor-pointer">
                <span className={`text-xl font-medium bg-gradient-to-r from-[${COLORS.primary}] to-[${COLORS.secondary}] bg-clip-text text-transparent`}>
                  VoiceGen
                </span>
              </div>
            </Link>
            
            {/* Desktop Navigation */}
            <nav className="hidden md:flex space-x-8">
              {navItems.map((item) => {
                const ItemIcon = item.icon;
                const isActive = location === item.href || 
                  (item.href !== '/' && location.startsWith(item.href));
                
                return (
                  <Link key={item.name} href={item.href}>
                    <div 
                      className={`flex items-center space-x-1 px-3 py-2 rounded-full transition-colors cursor-pointer ${
                        isActive 
                          ? `text-white bg-[${COLORS.backgroundTertiary}]` 
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      <ItemIcon className="h-4 w-4" />
                      <span>{item.name}</span>
                    </div>
                  </Link>
                );
              })}
            </nav>
            
            {/* Actions */}
            <div className="flex items-center space-x-4">
              {/* Theme toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="text-zinc-400 hover:text-white"
              >
                {theme === 'dark' ? (
                  <Sun className="h-5 w-5" />
                ) : (
                  <Moon className="h-5 w-5" />
                )}
              </Button>
              
              {/* Mobile menu toggle */}
              <div className="md:hidden">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="text-zinc-400 hover:text-white"
                >
                  {mobileMenuOpen ? (
                    <X className="h-6 w-6" />
                  ) : (
                    <Menu className="h-6 w-6" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>
      
      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden pt-16 bg-black/95 backdrop-blur-xl">
          <nav className="flex flex-col p-8 space-y-6">
            {navItems.map((item) => {
              const ItemIcon = item.icon;
              const isActive = location === item.href || 
                (item.href !== '/' && location.startsWith(item.href));
              
              return (
                <Link key={item.name} href={item.href}>
                  <div
                    className={`flex items-center space-x-4 p-4 rounded-xl transition-colors cursor-pointer ${
                      isActive 
                        ? `bg-[${COLORS.backgroundTertiary}] text-white` 
                        : 'text-zinc-400 hover:text-white'
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <ItemIcon className="h-6 w-6" />
                    <span className="text-lg">{item.name}</span>
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>
      )}
      
      {/* Main content */}
      <main className="flex-1 pt-24 md:pt-28 px-4 md:px-8">
        {children}
      </main>
      
      {/* Footer */}
      <footer className="py-8 px-4 md:px-8 border-t border-zinc-800">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <Link href="/">
                <a>
                  <span className={`text-lg font-medium bg-gradient-to-r from-[${COLORS.primary}] to-[${COLORS.secondary}] bg-clip-text text-transparent`}>
                    VoiceGen
                  </span>
                </a>
              </Link>
              <p className="text-sm text-zinc-500 mt-2">
                © {new Date().getFullYear()} VoiceGen
              </p>
            </div>
            
            <div className="flex space-x-6">
              {navItems.map((item) => (
                <Link key={item.name} href={item.href}>
                  <a className="text-sm text-zinc-500 hover:text-white transition-colors">
                    {item.name}
                  </a>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}