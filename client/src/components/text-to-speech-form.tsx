import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { AVAILABLE_VOICES, textToSpeechSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { AudioPlayer } from "./audio-player";
import { Play, Square } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type FormData = {
  title: string;
  text: string;
  voice: typeof AVAILABLE_VOICES[number];
  generateArtwork: boolean;
};

interface TextToSpeechFormProps {
  onSuccess: () => void;
}

export function TextToSpeechForm({ onSuccess }: TextToSpeechFormProps) {
  const { toast } = useToast();
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const form = useForm<FormData>({
    resolver: zodResolver(textToSpeechSchema),
    defaultValues: {
      title: "",
      text: "",
      voice: "alloy",
      generateArtwork: false
    }
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await apiRequest("/api/text-to-speech", {
        method: "POST",
        data
      });
      return res.json();
    },
    onSuccess: () => {
      onSuccess();
      toast({
        title: "Success",
        description: "Audio file created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to convert text to speech. Please try again.",
        variant: "destructive",
      });
    },
  });

  const textLength = form.watch("text").length;
  const selectedVoice = form.watch("voice");
  
  // Play/pause voice sample
  const toggleVoiceSample = (voice: string) => {
    if (playingVoice === voice) {
      // Stop playing
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setPlayingVoice(null);
    } else {
      // Start playing a new voice
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      
      const audio = new Audio(`/samples/${voice}.mp3`);
      audioRef.current = audio;
      
      audio.onended = () => {
        setPlayingVoice(null);
      };
      
      audio.play().catch(err => {
        console.error("Error playing audio sample:", err);
        toast({
          title: "Error",
          description: "Failed to play voice sample. Please try again.",
          variant: "destructive",
        });
        setPlayingVoice(null);
      });
      
      setPlayingVoice(voice);
    }
  };

  return (
    <div className="space-y-8">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
          className="space-y-6"
        >
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input placeholder="Enter a title..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="text"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Text</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Enter text to convert..."
                    className="min-h-[200px]"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Characters: {textLength} (Long text will be automatically split into chunks)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="voice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Voice</FormLabel>
                <div className="space-y-3">
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a voice" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {AVAILABLE_VOICES.map((voice) => (
                        <SelectItem key={voice} value={voice}>
                          {voice.charAt(0).toUpperCase() + voice.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Voice samples grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-2 border rounded-md">
                    <FormDescription className="col-span-full mb-2">
                      Click to hear voice samples:
                    </FormDescription>
                    {AVAILABLE_VOICES.map((voice) => (
                      <Button
                        key={voice}
                        type="button"
                        variant={selectedVoice === voice ? "default" : "outline"}
                        className={`flex items-center justify-between gap-2 ${
                          selectedVoice === voice ? "border-2 border-primary" : ""
                        }`}
                        onClick={() => toggleVoiceSample(voice)}
                      >
                        <span className="capitalize">{voice}</span>
                        {playingVoice === voice ? (
                          <Square className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                    ))}
                  </div>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="generateArtwork"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Generate Artwork</FormLabel>
                  <FormDescription>
                    Use AI to create custom artwork based on the text content
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="w-full"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Converting..." : "Convert to Speech"}
          </Button>
        </form>
      </Form>

      {mutation.data && (
        <div className="space-y-6 rounded-lg border p-6">
          <h2 className="text-lg font-semibold">Generated Audio</h2>
          <AudioPlayer
            src={mutation.data.audioUrl}
            title={mutation.data.title}
          />
          {mutation.data.artworkUrl && (
            <div>
              <h3 className="text-md font-medium mb-2">AI-Generated Artwork</h3>
              <img
                src={mutation.data.artworkUrl}
                alt="Generated artwork"
                className="rounded-lg w-full max-w-md mx-auto"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}