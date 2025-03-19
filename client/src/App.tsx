import { Switch, Route, Link } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Library from "@/pages/library";
import Chat from "@/pages/chat";

function Navbar() {
  return (
    <nav className="bg-white/80 backdrop-blur-sm border-b sticky top-0 z-50">
      <div className="container flex h-16 items-center justify-between">
        <span className="text-2xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
          VoiceGen
        </span>
        <div className="flex gap-4">
          <Button variant="ghost" asChild>
            <Link href="/">Convert</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/library">Library</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/chat">Chat</Link>
          </Button>
        </div>
      </div>
    </nav>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/library" component={Library} />
      <Route path="/chat" component={Chat} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen">
        <Navbar />
        <Router />
      </div>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;