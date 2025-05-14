import { useState, useEffect, useRef } from "react";
import { TextToSpeechForm } from "@/components/text-to-speech-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Sparkles, MessageSquare, Headphones, Search, ArrowRight, Play, Pause } from "lucide-react";
import { AppLayout } from "@/components/ui-system/AppLayout";

export default function Home() {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Preload audio
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.src = "/voice-samples/shimmer.mp3";
      audioRef.current.load();
    }
  }, []);

  // Audio visualization effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    let animationId: number;
    
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Center line
      const centerY = canvas.height / 2;
      
      // Draw audio waveform
      ctx.beginPath();
      ctx.strokeStyle = isPlaying ? '#0A84FF' : '#666';
      ctx.lineWidth = 2;
      
      // Generate waveform points
      for (let x = 0; x < canvas.width; x += 3) {
        // When playing, create dynamic wave with more pronounced movement
        const speed = isPlaying ? 0.005 : 0.001;
        const amplitude = isPlaying 
          ? Math.sin(x * 0.01 + Date.now() * speed) * 20 + 
            Math.sin(x * 0.02 + Date.now() * (speed/2)) * 10
          : Math.sin(x * 0.05) * 5;
        
        ctx.lineTo(x, centerY + amplitude);
      }
      
      ctx.stroke();
      
      animationId = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => cancelAnimationFrame(animationId);
  }, [isPlaying]);
  
  // Handle audio playback
  const handlePlayAudio = async () => {
    if (!audioRef.current) {
      setIsPlaying(!isPlaying);
      return;
    }
    
    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        try {
          audioRef.current.currentTime = 0; // Reset to start
          await audioRef.current.play();
          setIsPlaying(true);
        } catch (err) {
          console.log("Audio playback failed, using animation only:", err);
          setIsPlaying(true);
        }
      }
    } catch (error) {
      console.log("Error handling audio:", error);
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <AppLayout>
      {/* Hero Section */}
      <section className="relative pt-24 pb-20 px-4 sm:px-6">
        {/* Background gradients */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute w-[500px] h-[500px] rounded-full opacity-20 blur-3xl bg-[#0A84FF] -top-[250px] -left-[250px]"></div>
          <div className="absolute w-[500px] h-[500px] rounded-full opacity-10 blur-3xl bg-[#30D158] -bottom-[350px] -right-[250px]"></div>
        </div>
        
        <div className="container mx-auto max-w-6xl relative">
          <div className="text-center mb-8">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
              <span className="bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                Your Voice, Amplified.
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-zinc-400 max-w-3xl mx-auto mb-8">
              VoiceGen turns any text into rich, AI-generated podcasts, voice clips, or long-form articles. Just type, and transform.
            </p>
            
            <Link href="/convert">
              <Button 
                size="lg"
                className="rounded-full bg-gradient-to-r from-[#0A84FF] to-[#30D158] hover:opacity-90 transition-all py-6 px-8 text-lg"
              >
                Start Creating
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
          
          {/* Animated Waveform */}
          <div className="relative mt-12 md:mt-16 rounded-2xl overflow-hidden bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 p-8">
            <canvas 
              ref={canvasRef}
              className="w-full h-32 md:h-48"
              width={1200}
              height={200}
            ></canvas>
            
            <div className="absolute inset-0 flex items-center justify-center">
              <Button
                onClick={handlePlayAudio}
                size="lg"
                variant="outline"
                className="rounded-full w-16 h-16 border-2 border-[#0A84FF] hover:bg-[#0A84FF]/20 transition-all flex items-center justify-center"
              >
                {isPlaying ? (
                  <Pause className="h-6 w-6 text-[#0A84FF]" />
                ) : (
                  <Play className="h-6 w-6 ml-1 text-[#0A84FF]" />
                )}
              </Button>
            </div>
            
            {/* Hidden audio element */}
            <audio 
              ref={audioRef} 
              className="hidden" 
              onEnded={() => setIsPlaying(false)}
            >
              <source src="/voice-samples/shimmer.mp3" type="audio/mpeg" />
              Your browser does not support the audio element.
            </audio>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-4 sm:px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">Advanced AI Capabilities</h2>
            <p className="text-lg text-zinc-400 max-w-3xl mx-auto">
              Harness the power of multiple AI models to enhance your content creation and knowledge exploration.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Feature 1 */}
            <Card className="bg-zinc-800/50 border border-zinc-700 hover:border-zinc-600 transition-colors">
              <CardHeader>
                <div className="flex items-center">
                  <div className="h-12 w-12 flex items-center justify-center rounded-lg bg-[#0A84FF]/10 text-[#0A84FF] mb-4">
                    <Headphones className="h-6 w-6" />
                  </div>
                </div>
                <CardTitle className="text-xl">Text-to-Speech</CardTitle>
                <CardDescription>
                  Convert any text into natural-sounding audio with six premium voice options. Supports texts of any length.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <Link href="/convert">
                  <Button className="w-full bg-[#0A84FF] hover:bg-[#0074E0]">Try It</Button>
                </Link>
              </CardContent>
            </Card>
            
            {/* Feature 2 */}
            <Card className="bg-zinc-800/50 border border-zinc-700 hover:border-zinc-600 transition-colors">
              <CardHeader>
                <div className="flex items-center">
                  <div className="h-12 w-12 flex items-center justify-center rounded-lg bg-[#5E5CE6]/10 text-[#5E5CE6] mb-4">
                    <Sparkles className="h-6 w-6" />
                  </div>
                </div>
                <CardTitle className="text-xl">Content Creator</CardTitle>
                <CardDescription>
                  Create stories, articles, scripts, and marketing copy with Gemini 2.5 Pro. Supports both text and image inputs.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <Link href="/create">
                  <Button className="w-full bg-[#5E5CE6] hover:bg-[#4E4CD6]">Try It</Button>
                </Link>
              </CardContent>
            </Card>
            
            {/* Feature 3 */}
            <Card className="bg-zinc-800/50 border border-zinc-700 hover:border-zinc-600 transition-colors">
              <CardHeader>
                <div className="flex items-center">
                  <div className="h-12 w-12 flex items-center justify-center rounded-lg bg-[#30D158]/10 text-[#30D158] mb-4">
                    <MessageSquare className="h-6 w-6" />
                  </div>
                </div>
                <CardTitle className="text-xl">AI Chat</CardTitle>
                <CardDescription>
                  Discuss and analyze content with Claude 3.7 Sonnet or GPT-4o, with or without audio context.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <Link href="/chat">
                  <Button className="w-full bg-[#30D158] hover:bg-[#28B14C]">Try It</Button>
                </Link>
              </CardContent>
            </Card>
            
            {/* Feature 4 */}
            <Card className="bg-zinc-800/50 border border-zinc-700 hover:border-zinc-600 transition-colors">
              <CardHeader>
                <div className="flex items-center">
                  <div className="h-12 w-12 flex items-center justify-center rounded-lg bg-[#FF9F0A]/10 text-[#FF9F0A] mb-4">
                    <Search className="h-6 w-6" />
                  </div>
                </div>
                <CardTitle className="text-xl">Web Search</CardTitle>
                <CardDescription>
                  Get real-time information from the internet with Llama 3.1 Sonar AI-powered search and source citations.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-2">
                <Link href="/search">
                  <Button className="w-full bg-[#FF9F0A] hover:bg-[#E08900]">Try It</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
      
      {/* How It Works Section */}
      <section className="py-24 px-4 sm:px-6 bg-gradient-to-b from-zinc-800/50 to-zinc-900">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">How VoiceGen Works</h2>
            <p className="text-lg text-zinc-400 max-w-3xl mx-auto">
              A seamless workflow powered by multiple AI models working together
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-10 max-w-4xl mx-auto">
            {/* Step 1 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-[#0A84FF] text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">1</div>
              <h3 className="text-xl font-semibold mb-2 text-white">Input Your Text</h3>
              <p className="text-zinc-400">
                Enter or paste your content and select from six premium voice options.
              </p>
            </div>
            
            {/* Step 2 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-[#5E5CE6] text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">2</div>
              <h3 className="text-xl font-semibold mb-2 text-white">Process with AI</h3>
              <p className="text-zinc-400">
                Our AI processes your text, breaks it into optimal chunks, and generates high-quality audio.
              </p>
            </div>
            
            {/* Step 3 */}
            <div className="text-center">
              <div className="w-16 h-16 bg-[#30D158] text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">3</div>
              <h3 className="text-xl font-semibold mb-2 text-white">Interact & Analyze</h3>
              <p className="text-zinc-400">
                Listen to your audio, analyze with AI, chat about the content, or search for related information.
              </p>
            </div>
          </div>
          
          <div className="text-center mt-16">
            <Button asChild size="lg" className="rounded-full bg-gradient-to-r from-[#0A84FF] to-[#30D158] hover:opacity-90 transition-all py-6 px-8 text-lg">
              <Link href="/convert">
                Start Converting Now
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
      
      {/* Quick Convert Section */}
      <section className="py-24 px-4 sm:px-6">
        <div className="container mx-auto max-w-4xl">
          <Card className="bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700">
            <CardHeader>
              <CardTitle className="text-2xl">Quick Convert: Text to Speech</CardTitle>
            </CardHeader>
            <CardContent>
              <TextToSpeechForm
                onSuccess={() => {
                  queryClient.invalidateQueries({ queryKey: ["/api/library"] });
                }}
              />
            </CardContent>
          </Card>
        </div>
      </section>
    </AppLayout>
  );
}