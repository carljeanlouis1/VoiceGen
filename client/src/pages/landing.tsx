import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Headphones, MessageSquare, Search, Library, Sparkles, Undo2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

// Import the Apple-style landing page components
import {
  Navigation,
  Hero,
  Features,
  Examples,
  Testimonials,
  CTASection,
  Footer
} from "@/components/landing";

export default function LandingPage() {
  // Toggle state for the new design
  const [showNewDesign, setShowNewDesign] = useState(() => {
    // Initialize from localStorage if available, default to true to show new design
    const savedPref = localStorage.getItem("showNewDesign");
    return savedPref !== null ? savedPref === "true" : true;
  });

  // Save preference to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("showNewDesign", String(showNewDesign));
  }, [showNewDesign]);

  // Return the Apple-style design if showNewDesign is true
  if (showNewDesign) {
    return (
      <div className="relative">
        {/* Design toggle - fixed in the bottom right corner */}
        <div className="fixed bottom-4 right-4 z-50 bg-zinc-900/80 backdrop-blur-sm p-3 rounded-full shadow-lg flex items-center gap-2">
          <Label htmlFor="design-toggle" className="text-xs text-white">Original</Label>
          <Switch
            id="design-toggle"
            checked={showNewDesign}
            onCheckedChange={setShowNewDesign}
          />
          <Label htmlFor="design-toggle" className="text-xs text-white">New</Label>
        </div>
        
        {/* Apple-style landing page */}
        <div className="min-h-screen bg-gradient-to-b from-zinc-900 via-zinc-800 to-black text-zinc-200">
          <Navigation />
          <Hero />
          <Features />
          <Examples />
          <CTASection />
          <Footer />
        </div>
      </div>
    );
  }

  // Return the original design if showNewDesign is false
  return (
    <div className="relative min-h-screen flex flex-col">
      {/* Design toggle - fixed in the bottom right corner */}
      <div className="fixed bottom-4 right-4 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm p-3 rounded-full shadow-lg flex items-center gap-2">
        <Label htmlFor="design-toggle" className="text-xs">Original</Label>
        <Switch
          id="design-toggle"
          checked={showNewDesign}
          onCheckedChange={setShowNewDesign}
        />
        <Label htmlFor="design-toggle" className="text-xs">New</Label>
      </div>
      
      {/* Original Landing Page Design */}
      {/* Hero Section */}
      <section className="relative px-6 lg:px-8 bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-950">
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]"></div>
        
        {/* Additional landing page navigation - visible on landing page only */}
        <div className="hidden md:flex items-center justify-center py-6 relative">
          <div className="flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-gray-700 hover:text-primary dark:text-gray-300">
              Features
            </a>
            <a href="#how-it-works" className="text-sm font-medium text-gray-700 hover:text-primary dark:text-gray-300">
              How It Works
            </a>
          </div>
        </div>
        
        {/* Hero Content */}
        <div className="relative mx-auto max-w-5xl pt-20 pb-24 sm:pt-24 sm:pb-32">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
              AI-Powered Content Creation & Text-to-Speech
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
              VoiceGen combines cutting-edge AI models including Gemini 2.5 Pro, Claude 3.7, GPT-4o, and Llama 3.1 
              to create content, convert text to speech, analyze information, and search the web—all in one powerful platform.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Button asChild size="lg" className="px-8">
                <Link href="/convert">
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" asChild size="lg">
                <a href="#features">
                  Learn More
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 bg-white dark:bg-gray-950">
        <div className="container px-4 md:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Advanced AI Capabilities</h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
              Harness the power of multiple AI models to enhance your content creation and knowledge exploration.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8">
            {/* Feature 1 */}
            <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 hover:shadow-md transition-shadow">
              <div className="h-12 w-12 flex items-center justify-center rounded-lg bg-primary/10 text-primary mb-4">
                <Headphones className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Text-to-Speech</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Convert any text into natural-sounding audio with six premium voice options. Supports texts of any length.
              </p>
              <div className="mt-4">
                <Link href="/convert">
                  <Button variant="outline" size="sm">Try It</Button>
                </Link>
              </div>
            </div>
            
            {/* Feature 2 */}
            <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 hover:shadow-md transition-shadow">
              <div className="h-12 w-12 flex items-center justify-center rounded-lg bg-primary/10 text-primary mb-4">
                <Sparkles className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Content Creator</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Create stories, articles, scripts, and marketing copy with Gemini 2.5 Pro. Supports both text and image inputs.
              </p>
              <div className="mt-4">
                <Link href="/create">
                  <Button variant="outline" size="sm">Try It</Button>
                </Link>
              </div>
            </div>
            
            {/* Feature 3 */}
            <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 hover:shadow-md transition-shadow">
              <div className="h-12 w-12 flex items-center justify-center rounded-lg bg-primary/10 text-primary mb-4">
                <MessageSquare className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold mb-2">AI Chat</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Discuss and analyze content with Claude 3.7 Sonnet or GPT-4o, with or without audio context.
              </p>
              <div className="mt-4">
                <Link href="/chat">
                  <Button variant="outline" size="sm">Try It</Button>
                </Link>
              </div>
            </div>
            
            {/* Feature 4 */}
            <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 hover:shadow-md transition-shadow">
              <div className="h-12 w-12 flex items-center justify-center rounded-lg bg-primary/10 text-primary mb-4">
                <Search className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Web Search</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Get real-time information from the internet with Llama 3.1 Sonar AI-powered search and source citations.
              </p>
              <div className="mt-4">
                <Link href="/search">
                  <Button variant="outline" size="sm">Try It</Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* How It Works */}
      <section id="how-it-works" className="py-24 bg-gray-50 dark:bg-gray-900">
        <div className="container px-4 md:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How VoiceGen Works</h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
              A seamless workflow powered by multiple AI models working together
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-10 max-w-4xl mx-auto">
            {/* Step 1 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">1</div>
              <h3 className="text-xl font-semibold mb-2">Input Your Text</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Enter or paste your content and select from six premium voice options.
              </p>
            </div>
            
            {/* Step 2 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">2</div>
              <h3 className="text-xl font-semibold mb-2">Process with AI</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Our AI processes your text, breaks it into optimal chunks, and generates high-quality audio.
              </p>
            </div>
            
            {/* Step 3 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">3</div>
              <h3 className="text-xl font-semibold mb-2">Interact & Analyze</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Listen to your audio, analyze with AI, chat about the content, or search for related information.
              </p>
            </div>
          </div>
          
          <div className="text-center mt-16">
            <Button asChild size="lg">
              <Link href="/convert">
                Start Converting Now
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
      
      {/* Footer */}
      <footer className="py-12 bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800">
        <div className="container px-4 md:px-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <span className="text-2xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                VoiceGen
              </span>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Advanced AI-powered content creation & text-to-speech platform
              </p>
            </div>
            
            <div className="flex space-x-6 md:space-x-8">
              <Link href="/create" className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary">
                Create
              </Link>
              <Link href="/convert" className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary">
                Convert
              </Link>
              <Link href="/library" className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary">
                Library
              </Link>
              <Link href="/chat" className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary">
                Chat
              </Link>
              <Link href="/search" className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary">
                Search
              </Link>
            </div>
          </div>
          
          <div className="text-center text-sm text-gray-600 dark:text-gray-400 mt-8">
            © {new Date().getFullYear()} VoiceGen. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}