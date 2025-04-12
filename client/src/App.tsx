import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import NotFound from "./pages/not-found";
import LandingPage from "./pages/landing";
import Convert from "./pages/convert";
import Library from "./pages/library";
import Chat from "./pages/chat";
import Search from "./pages/search";
import Create from "./pages/create";
import { ThemeProvider, useTheme } from "./lib/theme-provider";
import { ThemeToggle } from "./components/theme-toggle";

function Navbar() {
  const [location] = useLocation();
  const { theme } = useTheme();
  
  // Use a different style for the navbar on the landing page
  const isLandingPage = location === "/";
  
  // Adjust navbar style based on theme and page
  const navbarBg = isLandingPage 
    ? 'bg-transparent' 
    : theme === 'light' 
      ? 'bg-white/80 backdrop-blur-sm border-b'
      : 'bg-gray-900/80 backdrop-blur-sm border-b border-gray-800';
  
  return (
    <nav className={`${navbarBg} sticky top-0 z-50 transition-colors duration-300`}>
      <div className="container flex h-16 items-center justify-between">
        <Link href="/">
          <span className="text-2xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent cursor-pointer">
            VoiceGen
          </span>
        </Link>
        <div className="flex gap-4 items-center">
          <Button variant="ghost" asChild>
            <Link href="/create">Create</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/convert">Convert</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/library">Library</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/chat">Chat</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/search">Search</Link>
          </Button>
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/create" component={Create} />
      <Route path="/convert" component={Convert} />
      <Route path="/library" component={Library} />
      <Route path="/chat" component={Chat} />
      <Route path="/search" component={Search} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <Router />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AppContent />
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;