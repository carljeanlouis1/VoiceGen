import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, RotateCw, Download } from "lucide-react";

interface AudioPlayerProps {
  src: string;
  title: string;
}

export function AudioPlayer({ src, title }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSeeking, setIsSeeking] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => {
      // Only update time if not in the middle of a manual seek
      if (!isSeeking) {
        setCurrentTime(audio.currentTime);
      }
    };
    
    const updateDuration = () => {
      if (!isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
        setIsLoading(false);
      }
    };
    
    const onEnded = () => setIsPlaying(false);
    
    // Try to get X-Audio-Duration header if available
    if (src.startsWith('/api/')) {
      fetch(src, { method: 'HEAD' }).then(response => {
        const durationHeader = response.headers.get('X-Audio-Duration');
        if (durationHeader) {
          const durationValue = parseInt(durationHeader, 10);
          if (!isNaN(durationValue) && durationValue > 0) {
            setDuration(durationValue);
            setIsLoading(false);
          }
        }
      }).catch(err => {
        console.error('Error fetching audio headers:', err);
      });
    }
    
    // Force reload metadata on mount to get accurate duration
    audio.load();

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("durationchange", updateDuration);
    audio.addEventListener("canplaythrough", updateDuration);
    audio.addEventListener("ended", onEnded);
    
    // Try to play and immediately pause to force metadata loading
    audio.play().then(() => {
      audio.pause();
      audio.currentTime = 0;
    }).catch(e => {
      // This is expected if autoplay is blocked
      console.log("Initial play blocked, will wait for user interaction");
    });

    // Try to get duration after a brief delay (fallback)
    const timer = setTimeout(() => {
      if (duration === 0 || isNaN(duration) || !isFinite(duration)) {
        // If we still don't have duration, estimate based on file size or URL
        estimateDuration();
      }
    }, 1500);

    return () => {
      clearTimeout(timer);
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("durationchange", updateDuration);
      audio.removeEventListener("canplaythrough", updateDuration);
      audio.removeEventListener("ended", onEnded);
    };
  }, [src, isSeeking]);
  
  // Fallback method to estimate duration based on file size or URL
  const estimateDuration = async () => {
    if (src.startsWith('/api/audio/')) {
      try {
        // For streaming URLs, fetch the audio file metadata
        const response = await fetch(src, { method: 'HEAD' });
        const contentLength = parseInt(response.headers.get('Content-Length') || '0', 10);
        if (contentLength > 0) {
          // Rough estimate: ~1 second per 16KB for MP3s
          const estimatedDuration = contentLength / 16000;
          setDuration(estimatedDuration);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error estimating duration:', error);
      }
    } else if (src.includes('base64')) {
      // For data URLs, estimate based on the size of the base64 data
      const base64Data = src.split(',')[1];
      if (base64Data) {
        const sizeInBytes = (base64Data.length * 0.75); // Approximate size of decoded base64
        const estimatedDuration = sizeInBytes / 16000; // Rough estimate
        setDuration(estimatedDuration);
        setIsLoading(false);
      }
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const seek = (time: number) => {
    if (!audioRef.current) return;
    
    try {
      // Ensure the time is within valid bounds
      const validTime = Math.min(Math.max(time, 0), duration || 0);
      
      // Pause briefly to avoid media errors
      const wasPlaying = !audioRef.current.paused;
      if (wasPlaying) {
        audioRef.current.pause();
      }
      
      // Update the audio element's current time
      audioRef.current.currentTime = validTime;
      
      // Update the state to match
      setCurrentTime(validTime);
      
      // Resume playback after a brief delay if it was playing
      if (wasPlaying) {
        setTimeout(() => {
          try {
            audioRef.current?.play().catch(e => {
              console.warn("Could not resume playback after seek:", e);
            });
          } catch (e) {
            console.warn("Error resuming playback:", e);
          }
        }, 100);
      }
    } catch (error) {
      console.error("Error seeking audio:", error);
      // If seeking fails, don't change the UI state
      setIsSeeking(false);
    }
  };

  const skipTime = (seconds: number) => {
    if (!audioRef.current) return;
    
    // Calculate new time with bounds checking
    const newTime = Math.min(
      Math.max(audioRef.current.currentTime + seconds, 0),
      audioRef.current.duration || duration
    );
    
    // Apply the new time
    seek(newTime);
  };

  const formatTime = (seconds: number) => {
    // Handle invalid durations gracefully
    if (isNaN(seconds) || !isFinite(seconds)) {
      return "0:00";
    }
    
    // For very long audio, show hours too
    if (seconds >= 3600) {
      const hours = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    } else {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, "0")}`;
    }
  };

  const handleDownload = () => {
    try {
      // Create a temporary anchor element
      const downloadLink = document.createElement('a');
      downloadLink.href = src;
      
      // Use original title for the filename, sanitize it for valid filename
      const sanitizedTitle = title
        .replace(/[^\w\s.-]/g, '') // Remove special characters except underscores, spaces, periods, and hyphens
        .replace(/\s+/g, '_');     // Replace spaces with underscores
      
      // Add .mp3 extension if not already present
      const filename = sanitizedTitle.toLowerCase().endsWith('.mp3') 
        ? sanitizedTitle 
        : `${sanitizedTitle}.mp3`;
      
      // Set download attribute to desired filename
      downloadLink.download = filename;
      
      // Briefly add to DOM, trigger click, and remove
      document.body.appendChild(downloadLink);
      downloadLink.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(downloadLink);
      }, 100);
    } catch (error) {
      console.error("Error downloading audio:", error);
    }
  };

  return (
    <div className="w-full space-y-2">
      <audio ref={audioRef} src={src} preload="metadata" />
      
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-sm text-muted-foreground">
          {isLoading ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Loading audio...
            </span>
          ) : (
            `${formatTime(currentTime)} / ${formatTime(duration)}`
          )}
        </span>
      </div>

      <Slider
        value={[currentTime]}
        max={duration || 100} // Fallback to 100 if duration is 0
        step={0.1}
        // Only update visual time during drag, apply change on commit
        onValueChange={([value]) => {
          if (!isLoading && duration > 0) {
            setIsSeeking(true);
            setCurrentTime(value);
          }
        }}
        // Only seek when slider is released to prevent frequent seeks that can crash the player
        onValueCommit={([value]) => {
          if (!isLoading && duration > 0) {
            // Small delay to ensure we don't interrupt other processes
            setTimeout(() => {
              seek(value);
              setIsSeeking(false);
            }, 50);
          }
        }}
        disabled={duration <= 0 || isLoading}
        className="my-2"
      />

      <div className="flex justify-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => skipTime(-10)}
          disabled={isLoading || duration <= 0}
          title="Rewind 10 seconds"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>

        <Button 
          onClick={togglePlay} 
          size="icon"
          disabled={isLoading || duration <= 0}
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={() => skipTime(10)}
          disabled={isLoading || duration <= 0}
          title="Forward 10 seconds"
        >
          <RotateCw className="h-4 w-4" />
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={handleDownload}
          title="Download audio"
          disabled={isLoading || duration <= 0}
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
