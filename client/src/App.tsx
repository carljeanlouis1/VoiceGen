import { Switch, Route, Link } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Library from "@/pages/library";

function Navbar() {
  return (
    <nav className="border-b">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/">
          <a className="text-xl font-bold">VoxCraft</a>
        </Link>
        <div className="flex gap-4">
          <Button variant="ghost" asChild>
            <Link href="/">Convert</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/library">Library</Link>
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
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background">
        <Navbar />
        <Router />
      </div>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
