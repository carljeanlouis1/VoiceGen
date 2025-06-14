import { useRef, useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { AVAILABLE_VOICES, textToSpeechSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { AudioPlayer } from "./audio-player";
import { Play, Square, Loader2, Clock, Music, MusicIcon, Image } from "lucide-react";

// Import our new UI components
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui-system/Card";
import { Button } from "@/components/ui-system/Button";
import { InputField } from "@/components/ui-system/InputField";
import { COLORS, SHADOWS } from "@/components/ui-system/design-tokens";
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
  const intervalRef = useRef<number | null>(null);
  const [completedAudio, setCompletedAudio] = useState<{
    id: number;
    title: string;
    audioUrl: string;
    text: string;
    voice: string;
    artworkUrl?: string;
  } | null>(null);
  const [processingJob, setProcessingJob] = useState<{
    id: number;
    status: string;
    progress: number;
    estimatedDuration?: number;
    error?: string;
  } | null>(null);
  
  const form = useForm<FormData>({
    resolver: zodResolver(textToSpeechSchema),
    defaultValues: {
      title: "",
      text: "",
      voice: "alloy",
      generateArtwork: false
    }
  });

  // Clean up when component unmounts
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  // Function to check job status
  const checkJobStatus = async (jobId: number) => {
    try {
      console.log(`Checking status for job ${jobId}...`);
      // Using the new general-purpose job status endpoint
      const response = await fetch(`/api/job-status/${jobId}`);
      
      if (!response.ok) {
        console.error(`Failed to fetch job status: ${response.status}`);
        throw new Error(`Failed to fetch job status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`Received status for job ${jobId}:`, data);
      
      // Update job state with latest information
      setProcessingJob(prev => {
        if (!prev) return null;
        
        // Log progress updates
        if (prev.progress !== data.progress) {
          console.log(`Progress updated: ${prev.progress}% -> ${data.progress}%`);
        }
        
        return {
          ...prev,
          status: data.status,
          progress: data.progress,
          error: data.error
        };
      });
      
      // Handle completion
      if (data.status === 'complete') {
        console.log(`Job ${jobId} completed successfully!`);
        
        // Stop polling
        if (intervalRef.current) {
          console.log(`Clearing interval for completed job ${jobId}`);
          window.clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        
        if (data.audioUrl) {
          console.log(`Audio URL received for job ${jobId}, updating UI`);
          
          // Create audio file object
          const audioFile = {
            id: jobId,
            title: form.getValues('title'),
            audioUrl: data.audioUrl,
            text: form.getValues('text'),
            voice: form.getValues('voice'),
            artworkUrl: data.artworkUrl
          };
          
          // Update our local state to show the completed audio
          console.log("Setting completed audio:", audioFile);
          setCompletedAudio(audioFile);
          
          // Call success callback
          onSuccess();
          
          // Show completion toast
          toast({
            title: "Success",
            description: "Audio file created successfully",
          });
          
          // Reset the processing job
          setProcessingJob(null);
        }
      }
      // Handle error
      else if (data.status === 'error') {
        console.log(`Job ${jobId} failed with error: ${data.error}`);
        
        // Stop polling
        if (intervalRef.current) {
          window.clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        
        // Reset processing job
        setProcessingJob(null);
        
        // Show error toast
        toast({
          title: "Error",
          description: data.error || "Failed to convert text to speech",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error checking job status:", error);
    }
  };

  // Start polling when job ID changes
  useEffect(() => {
    if (processingJob?.id && processingJob.status === 'processing') {
      // Stop any existing interval
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
      
      // Start polling
      const id = window.setInterval(() => {
        checkJobStatus(processingJob.id);
      }, 2000);
      
      intervalRef.current = id;
      
      // Initial check
      checkJobStatus(processingJob.id);
    }
    
    // Clean up when component unmounts or job ID changes
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [processingJob?.id]);

  // Mutation for form submission
  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await apiRequest("/api/text-to-speech", {
        method: "POST",
        data
      });
      
      // Handle background processing job
      if (response && response.status === 'processing') {
        setProcessingJob({
          id: response.id,
          status: response.status,
          progress: response.progress || 0,
          estimatedDuration: response.estimatedDuration
        });
        
        toast({
          title: "Processing Started",
          description: "Your text is being converted in the background. This may take a few minutes.",
        });
        
        return null;
      }
      
      return response;
    },
    onSuccess: (data) => {
      if (data) {
        console.log("Received immediate completion data:", data);
        // For immediate completions (not background jobs), set our completedAudio
        setCompletedAudio(data);
        onSuccess();
        toast({
          title: "Success",
          description: "Audio file created successfully",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to convert text to speech. Please try again.",
        variant: "destructive",
      });
    }
  });

  const textLength = form.watch("text").length;
  const selectedVoice = form.watch("voice");
  
  // Play/pause voice sample
  const toggleVoiceSample = async (voice: string) => {
    try {
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
        
        // Show loading state
        setPlayingVoice("loading");
        
        // Fetch the voice sample
        const response = await fetch(`/api/voice-samples/${voice}`);
        
        if (!response.ok) {
          throw new Error(`Failed to load voice sample: ${response.status}`);
        }
        
        const data = await response.json();
        
        const audio = new Audio(data.audioUrl);
        audioRef.current = audio;
        
        audio.onended = () => {
          setPlayingVoice(null);
        };
        
        await audio.play();
        setPlayingVoice(voice);
      }
    } catch (err) {
      console.error("Error playing audio sample:", err);
      toast({
        title: "Error",
        description: "Failed to play voice sample. Please try again.",
        variant: "destructive",
      });
      setPlayingVoice(null);
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
                  <InputField placeholder="Enter a title..." {...field} />
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
                        variant={selectedVoice === voice ? "primary" : "outline"}
                        className="flex items-center justify-between gap-2"
                        onClick={() => toggleVoiceSample(voice)}
                      >
                        <span className="capitalize">{voice}</span>
                        {playingVoice === "loading" ? (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        ) : playingVoice === voice ? (
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
            variant="primary"
            size="lg"
            className="w-full"
            disabled={mutation.isPending}
            isLoading={mutation.isPending}
          >
            {mutation.isPending ? "Converting..." : "Convert to Speech"}
          </Button>
        </form>
      </Form>

      {/* Background processing status */}
      {processingJob && processingJob.status === 'processing' && (
        <Card elevated gradient className="my-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-[#0A84FF]" />
              Processing Long Text
            </CardTitle>
            <CardDescription>
              Converting {form.getValues('text').length.toLocaleString()} characters to speech with {form.getValues('voice')} voice
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium">Progress: {processingJob.progress}%</span>
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span>Estimated time: ~{processingJob.estimatedDuration ? Math.ceil(processingJob.estimatedDuration / 60) : '?'} mins</span>
              </div>
            </div>
            <Progress value={processingJob.progress} className="w-full h-3" />
            
            {/* Visual progress indicator showing chunks */}
            <div className="mt-4 border border-zinc-800 rounded-xl p-4 bg-zinc-900/50 backdrop-blur-sm">
              <div className="text-xs mb-3 text-zinc-300">Processing steps:</div>
              <div className="flex gap-1 flex-wrap">
                {Array.from({ length: 10 }).map((_, i) => {
                  const chunkProgress = i * 10;
                  const isActive = processingJob.progress >= chunkProgress;
                  const isProcessing = processingJob.progress >= chunkProgress && processingJob.progress < chunkProgress + 10;
                  
                  return (
                    <div 
                      key={i}
                      className={`h-2 flex-1 rounded-full ${
                        isActive 
                          ? isProcessing 
                            ? 'bg-gradient-to-r from-[#0A84FF] to-[#30D158] animate-pulse' 
                            : 'bg-gradient-to-r from-[#0A84FF] to-[#30D158]'
                          : 'bg-zinc-800'
                      }`}
                      title={`${chunkProgress}-${chunkProgress + 10}%`}
                    />
                  );
                })}
              </div>
            </div>
            <p className="text-sm text-zinc-300 mt-4">
              Please wait while we process your text. This may take several minutes for very long content.
              You'll be able to access the audio in your library when it's ready.
            </p>
          </CardContent>
        </Card>
      )}
      
      {/* Completed audio - show from both immediate and background processes */}
      {(mutation.data || completedAudio) && (
        <Card gradient elevated className="mt-10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MusicIcon className="h-5 w-5 text-[#0A84FF]" />
              Generated Audio
            </CardTitle>
            <CardDescription>
              Your text has been successfully converted to speech
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <AudioPlayer
              src={(mutation.data || completedAudio)?.audioUrl}
              title={(mutation.data || completedAudio)?.title}
            />
            {(mutation.data?.artworkUrl || completedAudio?.artworkUrl) && (
              <div className="mt-6">
                <h3 className="text-lg font-medium mb-3 text-white">AI-Generated Artwork</h3>
                <div className="relative rounded-xl overflow-hidden border border-zinc-700">
                  <img
                    src={(mutation.data?.artworkUrl || completedAudio?.artworkUrl)}
                    alt="Generated artwork"
                    className="w-full max-w-md mx-auto"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}