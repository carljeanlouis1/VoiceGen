import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play, Pause } from "lucide-react";
import { HERO, THEME } from "./constants";

export function Hero() {
  const [, navigate] = useLocation();
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Audio visualization effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Animation loop for audio visualization
    let animationId: number;
    
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Center line
      const centerY = canvas.height / 2;
      
      // Draw audio waveform
      ctx.beginPath();
      ctx.strokeStyle = isPlaying ? THEME.primary : '#666';
      ctx.lineWidth = 2;
      
      // Generate waveform points
      for (let x = 0; x < canvas.width; x += 3) {
        // When playing, create dynamic wave
        const amplitude = isPlaying 
          ? Math.sin(x * 0.01 + Date.now() * 0.003) * 20 + 
            Math.sin(x * 0.02 + Date.now() * 0.001) * 10
          : Math.sin(x * 0.05) * 5;
        
        ctx.lineTo(x, centerY + amplitude);
      }
      
      ctx.stroke();
      
      animationId = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => cancelAnimationFrame(animationId);
  }, [isPlaying]);
  
  // Handle audio playback with error handling
  const handlePlayAudio = async () => {
    if (!audioRef.current) return;
    
    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        // Using await with a try/catch to properly handle interruptions
        await audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (error) {
      // Handle aborted play requests gracefully
      console.log("Audio playback interrupted:", error);
      setIsPlaying(false);
    }
  };
  
  return (
    <section className="relative pt-32 pb-24 md:pt-40 md:pb-32 px-8">
      {/* Background gradients */}
      <div className="absolute inset-0 overflow-hidden">
        <div className={`absolute w-[500px] h-[500px] rounded-full opacity-20 blur-3xl bg-[${THEME.primary}] -top-[250px] -left-[250px]`}></div>
        <div className={`absolute w-[500px] h-[500px] rounded-full opacity-10 blur-3xl bg-[${THEME.secondary}] -bottom-[350px] -right-[250px]`}></div>
      </div>
      
      <div className="container mx-auto max-w-6xl relative">
        <div className="text-center mb-8">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
            {/* CUSTOMIZE: Update heading in constants.ts */}
            <span className="bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
              {HERO.headline}
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-zinc-400 max-w-3xl mx-auto mb-8">
            {/* CUSTOMIZE: Update subheading in constants.ts */}
            {HERO.subheadline}
          </p>
          
          <Link href="/convert">
            <Button 
              size="lg"
              className={`rounded-full bg-gradient-to-r from-[${THEME.primary}] to-[${THEME.secondary}] hover:opacity-90 transition-all py-6 px-8 text-lg`}
            >
              {/* CUSTOMIZE: Update button text in constants.ts */}
              {HERO.ctaText}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
        
        {/* Animated Waveform */}
        <div className="relative mt-16 md:mt-24 rounded-2xl overflow-hidden bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 p-8">
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
              className={`rounded-full w-16 h-16 border-2 border-[${THEME.primary}] hover:bg-[${THEME.primary}]/20 transition-all flex items-center justify-center`}
            >
              {isPlaying ? (
                <Pause className={`h-6 w-6 text-[${THEME.primary}]`} />
              ) : (
                <Play className={`h-6 w-6 ml-1 text-[${THEME.primary}]`} />
              )}
            </Button>
          </div>
          
          {/* Hidden audio element */}
          <audio 
            ref={audioRef} 
            className="hidden" 
            onEnded={() => setIsPlaying(false)}
          >
            {/* CUSTOMIZE: Update audio source in constants.ts */}
            <source src={HERO.audioSample} type="audio/mpeg" />
            Your browser does not support the audio element.
          </audio>
        </div>
      </div>
    </section>
  );
}