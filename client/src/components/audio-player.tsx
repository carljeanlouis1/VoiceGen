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

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

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
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
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
          {formatTime(currentTime)} / {formatTime(duration)}
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
