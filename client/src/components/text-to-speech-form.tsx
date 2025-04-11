import { useRef, useState, useCallback, useEffect } from "react";
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
import { Progress } from "@/components/ui/progress";
import { AudioPlayer } from "./audio-player";
import { Play, Square, Loader2, Clock } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  const [processingJob, setProcessingJob] = useState<{
    id: number;
    status: string;
    progress: number;
    estimatedDuration?: number;
    error?: string;
  } | null>(null);
  
  // Use state for polling interval
  const [pollingInterval, setPollingInterval] = useState<number | null>(null);
  // Forward declare mutation ref to avoid circular dependencies
  const mutationRef = useRef<any>(null);
  
  const form = useForm<FormData>({
    resolver: zodResolver(textToSpeechSchema),
    defaultValues: {
      title: "",
      text: "",
      voice: "alloy",
      generateArtwork: false
    }
  });

  // Declare mutation early to avoid dependency issues
  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      // apiRequest already returns parsed JSON, so we don't need to call .json() again
      const response = await apiRequest("/api/text-to-speech", {
        method: "POST",
        data
      });
      
      // Check if this is a background job
      if (response.status === 'processing') {
        setProcessingJob({
          id: response.id,
          status: response.status,
          progress: response.progress || 0,
          estimatedDuration: response.estimatedDuration
        });
        
        // For background jobs, immediately return to prevent mutation.onSuccess
        throw new Error("BACKGROUND_JOB_STARTED");
      }
      
      // For regular jobs, return the response normally
      return response;
    },
    onSuccess: (data) => {
      onSuccess();
      toast({
        title: "Success",
        description: "Audio file created successfully",
      });
      
      // Clear any processing job state
      setProcessingJob(null);
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
      }
    },
    onError: (error: Error) => {
      // Special case for background jobs
      if (error.message === "BACKGROUND_JOB_STARTED") {
        toast({
          title: "Processing Started",
          description: "Your text is being converted in the background. This may take a few minutes for long texts.",
        });
        return;
      }
      
      toast({
        title: "Error",
        description: error.message || "Failed to convert text to speech. Please try again.",
        variant: "destructive",
      });
    },
  });
  
  // Update the mutation ref so it can be accessed in callbacks
  useEffect(() => {
    mutationRef.current = mutation;
  }, [mutation]);

  // Function to check job status
  const checkJobStatus = useCallback(async (jobId: number) => {
    try {
      console.log(`Checking status for job ${jobId}...`);
      
      const result = await apiRequest(`/api/text-to-speech/status/${jobId}`, {
        method: "GET"
      });
      
      console.log(`Status for job ${jobId}:`, result);
      
      // Only proceed if we're still processing this job
      if (!processingJob || processingJob.id !== jobId) {
        console.log(`Ignoring update for job ${jobId} as it's no longer the active job`);
        return;
      }
      
      // Update the job state with the latest information
      setProcessingJob(prev => {
        if (!prev) return null;
        
        // Log the progress update
        if (prev.progress !== result.progress) {
          console.log(`Progress updated: ${prev.progress}% -> ${result.progress}%`);
        }
        
        return {
          ...prev,
          status: result.status,
          progress: result.progress,
          error: result.error
        };
      });
      
      // If complete, get the file and clean up
      if (result.status === 'complete') {
        console.log(`Job ${jobId} completed successfully!`);
        
        // Clear the polling interval
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }
        
        if (result.audioUrl) {
          console.log(`Audio URL received, length: ${result.audioUrl.length.toLocaleString()} chars`);
          
          // Create audio file object with completed data
          const audioFile = { 
            id: jobId,
            title: form.getValues('title'),
            audioUrl: result.audioUrl,
            text: form.getValues('text'),
            voice: form.getValues('voice')
          };
          
          // Set the mutation data directly and clear processing job
          if (mutationRef.current) {
            (mutationRef.current as any)._state.data = audioFile;
          }
          setProcessingJob(null);
          
          // Call onSuccess function and show toast
          onSuccess();
          
          toast({
            title: "Success",
            description: "Audio file created successfully",
          });
        }
      } 
      // If error, show error toast and clean up
      else if (result.status === 'error') {
        console.log(`Job ${jobId} failed with error: ${result.error}`);
        
        // Clear the polling interval
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }
        
        // Reset the processing job
        setProcessingJob(null);
        
        // Show error toast
        toast({
          title: "Error",
          description: result.error || "Failed to convert text to speech",
          variant: "destructive",
        });
      }
      // If still processing, just continue with updates
      else {
        console.log(`Job ${jobId} is still processing (${result.progress}%)`);
      }
    } catch (error: any) {
      console.error("Error checking job status:", error);
      
      // Don't stop polling on connection errors - just log it and try again
      console.log("Will retry on next polling cycle");
      
      // Only show toast for persistent connection issues
      if (error.message.includes("Failed to fetch") || error.message.includes("NetworkError")) {
        toast({
          title: "Connection Issue",
          description: "Trouble connecting to server. Will keep trying...",
          variant: "destructive",
        });
      }
    }
  }, [pollingInterval, processingJob, toast, form, onSuccess]);

  // Set up polling when a job is in progress
  useEffect(() => {
    // Only start/restart polling if we have a processing job and no active interval
    if (processingJob && processingJob.status === 'processing' && !pollingInterval) {
      console.log(`Starting polling for job ${processingJob.id}, current progress: ${processingJob.progress}%`);
      
      // First check immediately
      checkJobStatus(processingJob.id);
      
      // Then poll every 2 seconds for job status (more frequent updates)
      const intervalId = window.setInterval(() => {
        console.log(`Polling job ${processingJob.id} status...`);
        checkJobStatus(processingJob.id);
      }, 2000);
      
      setPollingInterval(intervalId);
    }
    
    // Clean up on unmount or when processing job changes/completes
    return () => {
      if (pollingInterval) {
        console.log(`Cleaning up polling interval`);
        clearInterval(pollingInterval);
      }
    };
  }, [processingJob?.id, pollingInterval, checkJobStatus]);

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
        
        // Fetch the voice sample from our API endpoint
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
                        {playingVoice === "loading" ? (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
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
            className="w-full"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Converting..." : "Convert to Speech"}
          </Button>
        </form>
      </Form>

      {/* Background processing status */}
      {processingJob && processingJob.status === 'processing' && (
        <Card className="my-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
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
            <div className="mt-4 border rounded-md p-3 bg-muted/20">
              <div className="text-xs mb-2 text-muted-foreground">Processing steps:</div>
              <div className="flex gap-1 flex-wrap">
                {Array.from({ length: 10 }).map((_, i) => {
                  const chunkProgress = i * 10;
                  const isActive = processingJob.progress >= chunkProgress;
                  const isProcessing = processingJob.progress >= chunkProgress && processingJob.progress < chunkProgress + 10;
                  
                  return (
                    <div 
                      key={i}
                      className={`h-2 flex-1 rounded-sm ${
                        isActive 
                          ? isProcessing 
                            ? 'bg-primary animate-pulse' 
                            : 'bg-primary'
                          : 'bg-muted'
                      }`}
                      title={`${chunkProgress}-${chunkProgress + 10}%`}
                    />
                  );
                })}
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              Please wait while we process your text. This may take several minutes for very long content.
              You'll be able to access the audio in your library when it's ready.
            </p>
          </CardContent>
        </Card>
      )}
      
      {/* Completed audio */}
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
