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

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    
    const updateDuration = () => {
      if (!isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
        setIsLoading(false);
      }
    };
    
    const onEnded = () => setIsPlaying(false);
    
    // Force reload metadata on mount to get accurate duration
    audio.load();

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("durationchange", updateDuration);
    audio.addEventListener("canplaythrough", updateDuration);
    audio.addEventListener("ended", onEnded);

    // Try to get duration after a brief delay (fallback)
    const timer = setTimeout(() => {
      if (duration === 0 || isNaN(duration) || !isFinite(duration)) {
        // If we still don't have duration, estimate based on file size or URL
        estimateDuration();
      }
    }, 1000);

    return () => {
      clearTimeout(timer);
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("durationchange", updateDuration);
      audio.removeEventListener("canplaythrough", updateDuration);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);
  
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
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const skipTime = (seconds: number) => {
    if (!audioRef.current) return;
    const newTime = Math.min(
      Math.max(currentTime + seconds, 0),
      duration
    );
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
    // Create a temporary anchor element
    const downloadLink = document.createElement('a');
    downloadLink.href = src;
    downloadLink.download = `${title.replace(/\s+/g, '_')}.mp3`; // Replace spaces with underscores for filename
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  return (
    <div className="w-full space-y-2">
      <audio ref={audioRef} src={src} preload="metadata" />
      
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-sm text-muted-foreground">
          {isLoading && duration === 0 ? (
            "Loading..."
          ) : (
            `${formatTime(currentTime)} / ${formatTime(duration)}`
          )}
        </span>
      </div>

      <Slider
        value={[currentTime]}
        max={duration}
        step={0.1}
        onValueChange={([value]) => seek(value)}
        className="my-2"
      />

      <div className="flex justify-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => skipTime(-10)}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>

        <Button onClick={togglePlay} size="icon">
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
        >
          <RotateCw className="h-4 w-4" />
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={handleDownload}
          title="Download audio"
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
