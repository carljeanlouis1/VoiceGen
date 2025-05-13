import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause } from "lucide-react";
import { EXAMPLES, THEME } from "./constants";

export function Examples() {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // Preload audio
  useEffect(() => {
    // Set actual demo audio file
    if (audioRef.current) {
      audioRef.current.src = "/voice-samples/shimmer.mp3";
      audioRef.current.load();
    }
  }, []);
  
  const handlePlayAudio = async () => {
    if (!audioRef.current) {
      // If audio fails to load, just update the visual state
      setIsPlaying(!isPlaying);
      return;
    }
    
    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        // Attempt to play audio
        try {
          audioRef.current.currentTime = 0; // Reset to start
          await audioRef.current.play();
          setIsPlaying(true);
        } catch (err) {
          // Even if audio fails, still show visual feedback
          console.log("Audio playback failed, using animation only:", err);
          setIsPlaying(true);
        }
      }
    } catch (error) {
      // Handle any other errors gracefully
      console.log("Error handling audio:", error);
      // Still toggle the animation state for visual feedback
      setIsPlaying(!isPlaying);
    }
  };
  
  return (
    <section id="examples" className="py-24 px-8 bg-gradient-to-b from-black to-zinc-900">
      <div className="container mx-auto max-w-6xl">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
          <span className="bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
            Hear the Difference
          </span>
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
          {/* Before Example */}
          <div className="bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 rounded-2xl p-8">
            <h3 className="text-xl font-semibold mb-6 flex items-center">
              <span className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center mr-3 text-sm">1</span>
              {EXAMPLES.before.title}
            </h3>
            
            <div className="bg-zinc-950 rounded-xl p-6 mb-6 text-zinc-400 h-32 overflow-y-auto">
              <p>
                {/* CUSTOMIZE: Update raw text example in constants.ts */}
                {EXAMPLES.before.content}
              </p>
            </div>
            
            <p className="text-zinc-500 text-sm">
              {EXAMPLES.before.description}
            </p>
          </div>
          
          {/* After Example */}
          <div className="bg-zinc-900/50 backdrop-blur-sm border border-zinc-800 rounded-2xl p-8">
            <h3 className="text-xl font-semibold mb-6 flex items-center">
              <span className={`w-8 h-8 rounded-full bg-gradient-to-br from-[${THEME.primary}] to-[${THEME.secondary}] flex items-center justify-center mr-3 text-sm`}>2</span>
              {EXAMPLES.after.title}
            </h3>
            
            <div className="bg-zinc-950 rounded-xl p-6 mb-6 flex items-center justify-center">
              <div className="w-full h-32 relative">
                {/* Simplified audio waveform display */}
                <div className="absolute inset-0 flex items-center justify-center gap-1">
                  {Array.from({ length: 40 }).map((_, i) => (
                    <div 
                      key={i} 
                      className={`h-16 w-1 bg-gradient-to-t from-[${THEME.primary}]/20 to-[${THEME.secondary}]/20 rounded-full`}
                      style={{ 
                        height: `${20 + Math.sin(i * 0.3) * 15}%`,
                        opacity: isPlaying ? 0.8 : 0.4,
                        transition: "all 0.2s ease"
                      }}
                    ></div>
                  ))}
                </div>
                
                <div className="absolute inset-0 flex items-center justify-center">
                  <Button
                    onClick={handlePlayAudio}
                    size="lg"
                    variant="outline"
                    className={`rounded-full w-12 h-12 border-2 border-[${THEME.primary}] hover:bg-[${THEME.primary}]/20 transition-all flex items-center justify-center z-10`}
                  >
                    {isPlaying ? (
                      <Pause className={`h-5 w-5 text-[${THEME.primary}]`} />
                    ) : (
                      <Play className={`h-5 w-5 ml-0.5 text-[${THEME.primary}]`} />
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
                  <source src={EXAMPLES.after.audioSample} type="audio/mpeg" />
                  Your browser does not support the audio element.
                </audio>
              </div>
            </div>
            
            <p className="text-zinc-500 text-sm">
              {EXAMPLES.after.description}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}