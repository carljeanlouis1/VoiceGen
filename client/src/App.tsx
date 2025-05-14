import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "./pages/not-found";
import LandingPage from "./pages/landing";
import Convert from "./pages/convert";
import Library from "./pages/library";
import Chat from "./pages/chat";
import Search from "./pages/search";
import Create from "./pages/create";
import { ThemeProvider } from "./lib/theme-provider";
import Home from "./pages/home";

/**
 * Main router component for the application
 */
function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/landing" component={LandingPage} />
      <Route path="/create" component={Create} />
      <Route path="/convert" component={Convert} />
      <Route path="/library" component={Library} />
      <Route path="/chat" component={Chat} />
      <Route path="/search" component={Search} />
      <Route component={NotFound} />
    </Switch>
  );
}

/**
 * Main App component
 */
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <div className="min-h-screen">
          <Router />
          <Toaster />
        </div>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;