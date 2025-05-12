import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { 
  Loader2, Copy, Upload, Image as ImageIcon, MessageSquare, Sparkles, Send,
  Radio, Mic, Search, Play, Headphones, FileAudio, BookOpen, Pencil, CheckCircle2, 
  Volume2, Download, Square
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AVAILABLE_VOICES } from "@shared/schema";
import { AudioPlayer } from "@/components/audio-player";
import { useLocation } from "wouter";

// Predefined system prompts for different content types
const CONTENT_TEMPLATES = {
  story: "You are a creative storyteller and fiction writer. Create engaging, imaginative stories with compelling characters and interesting plots. Make the story immersive and captivating.",
  article: "You are a professional content writer specializing in informative articles. Create well-researched, factually accurate content that is educational and engaging. Use a clear structure with headings and maintain a professional tone.",
  scriptTalk: "You are a speech writer specializing in talks and presentations. Create a compelling, well-structured script that is conversational, engaging, and designed to be read aloud. Include natural pauses, emphasis, and conversational language.",
  marketing: "You are a marketing copywriter. Create persuasive, attention-grabbing content that highlights benefits, addresses pain points, and includes strong calls to action. The tone should be enthusiastic and customer-focused.",
  creative: "You are a creative content generator. Create unique, innovative content that is thought-provoking and original. Feel free to experiment with format, style, and conventions."
};

// Content type options for the tabs
const CONTENT_TYPES = [
  { id: "story", label: "Story", description: "Creative fiction with characters and plot" },
  { id: "article", label: "Article", description: "Informative, factual content" },
  { id: "scriptTalk", label: "Script/Talk", description: "Content designed to be spoken aloud" },
  { id: "marketing", label: "Marketing", description: "Persuasive copy that sells" },
  { id: "creative", label: "Creative", description: "Unique, experimental content" },
  { id: "custom", label: "Custom", description: "Your own instructions" }
];

// Function to convert file to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        // Extract the base64 data part from the data URL
        const base64Data = reader.result.split(',')[1];
        resolve(base64Data);
      } else {
        reject(new Error('Failed to read file as base64'));
      }
    };
    reader.onerror = (error) => reject(error);
  });
};

// Models available for podcast creation (now just Claude 3.7)
const PODCAST_MODELS = [
  { id: "claude", label: "Claude 3.7 Sonnet", description: "Anthropic's most capable model" },
];

export default function CreatePage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  // Mode selection state
  const [createMode, setCreateMode] = useState<"content" | "podcast">("content");
  
  // Content creation states
  const [prompt, setPrompt] = useState("");
  const [generatedContent, setGeneratedContent] = useState("");
  const [contentType, setContentType] = useState<keyof typeof CONTENT_TEMPLATES | "custom">("story");
  const [customSystemPrompt, setCustomSystemPrompt] = useState("");
  const [useImages, setUseImages] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [imageBase64, setImageBase64] = useState<string[]>([]);
  const [temperature, setTemperature] = useState(0.7);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [maxOutputTokens, setMaxOutputTokens] = useState(4000);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Podcast creation states
  const [podcastTopic, setPodcastTopic] = useState("");
  const [podcastDuration, setPodcastDuration] = useState(10); // Default 10 minutes
  const [podcastModel, setPodcastModel] = useState<"claude">("claude");
  const [podcastMultipart, setPodcastMultipart] = useState(false);
  const [podcastExtendedMode, setPodcastExtendedMode] = useState(false); // Extended podcast mode
  const [podcastParts, setPodcastParts] = useState(1);
  const [podcastVoice, setPodcastVoice] = useState<typeof AVAILABLE_VOICES[number]>(AVAILABLE_VOICES[0]);
  const [podcastScript, setPodcastScript] = useState("");
  const [podcastResearchResults, setPodcastResearchResults] = useState("");
  const [podcastResearchFinished, setPodcastResearchFinished] = useState(false);
  const [currentPodcastPart, setCurrentPodcastPart] = useState(1);
  const [previousPartContent, setPreviousPartContent] = useState("");
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [generatedAudioTitle, setGeneratedAudioTitle] = useState<string>("");
  const [playingVoiceSample, setPlayingVoiceSample] = useState<string | null>(null);
  const [combinedScript, setCombinedScript] = useState<string>("");
  const [isAutomatedGeneration, setIsAutomatedGeneration] = useState(false);
  const [generatedParts, setGeneratedParts] = useState<{[key: number]: string}>({});
  const [processingPart, setProcessingPart] = useState<number | null>(null);
  const [autoGenerateAudio, setAutoGenerateAudio] = useState(true); // Auto-generate audio by default
  
  // Audio reference for voice samples
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Function to play a voice sample
  const playVoiceSample = async (voice: string) => {
    try {
      if (playingVoiceSample === voice) {
        // Stop playing
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
        setPlayingVoiceSample(null);
      } else {
        // Start playing a new voice
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
        
        // Show loading state
        setPlayingVoiceSample("loading");
        
        // Fetch the voice sample
        const response = await fetch(`/api/voice-samples/${voice}`);
        
        if (!response.ok) {
          throw new Error(`Failed to load voice sample: ${response.status}`);
        }
        
        const data = await response.json();
        
        const audio = new Audio(data.audioUrl);
        audioRef.current = audio;
        
        audio.onended = () => {
          setPlayingVoiceSample(null);
        };
        
        await audio.play();
        setPlayingVoiceSample(voice);
      }
    } catch (err) {
      console.error("Error playing audio sample:", err);
      setPlayingVoiceSample(null);
      toast({
        title: "Error",
        description: "Failed to play voice sample. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Handle image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newImages = Array.from(e.target.files);
      setImages([...images, ...newImages]);
      
      // Convert images to base64
      try {
        const base64Promises = newImages.map(file => fileToBase64(file));
        const base64Results = await Promise.all(base64Promises);
        setImageBase64([...imageBase64, ...base64Results]);
      } catch (error) {
        console.error("Error converting images to base64:", error);
        toast({
          title: "Error",
          description: "Failed to process image uploads",
          variant: "destructive"
        });
      }
    }
  };

  // Remove an image
  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
    setImageBase64(imageBase64.filter((_, i) => i !== index));
  };

  // Mutation for generating content
  const generationMutation = useMutation({
    mutationFn: async () => {
      const systemPrompt = contentType === "custom" 
        ? customSystemPrompt 
        : CONTENT_TEMPLATES[contentType as keyof typeof CONTENT_TEMPLATES];
      
      return apiRequest("/api/gemini/generate", {
        method: "POST",
        data: {
          prompt,
          systemPrompt,
          temperature,
          maxOutputTokens,
          images: useImages ? imageBase64 : undefined
        }
      });
    },
    onSuccess: (data) => {
      setGeneratedContent(data.text);
      toast({
        title: "Content generated",
        description: "Your content has been created successfully!"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to generate content: ${error.message || "Unknown error"}`,
        variant: "destructive"
      });
    }
  });

  // Copy content to clipboard
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generatedContent);
      toast({
        title: "Copied!",
        description: "Content copied to clipboard"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive"
      });
    }
  };

  // Extended mode states
  const [extendedModeStep, setExtendedModeStep] = useState<string | null>(null);
  const [extendedModeProgress, setExtendedModeProgress] = useState(0);
  const [extendedModeSubTopics, setExtendedModeSubTopics] = useState<string[]>([]);
  
  // Mutation for podcast research and script generation
  const podcastResearchMutation = useMutation({
    mutationFn: async () => {
      // For extended mode, set initial state
      if (podcastExtendedMode) {
        setExtendedModeStep("Analyzing topic and planning sub-topics");
        setExtendedModeProgress(10);
      }
      
      return apiRequest("/api/podcast/research", {
        method: "POST",
        data: {
          topic: podcastTopic,
          model: podcastModel,
          targetDuration: podcastDuration,
          voice: podcastVoice,
          part: currentPodcastPart,
          totalParts: podcastMultipart ? podcastParts : 1,
          previousPartContent: previousPartContent,
          searchResults: podcastResearchResults,
          extendedMode: podcastExtendedMode
        }
      });
    },
    onSuccess: (data) => {
      setPodcastScript(data.script);
      
      // Reset extended mode states
      setExtendedModeStep(null);
      setExtendedModeProgress(0);
      
      // Handle extended mode sub-topics if provided
      if (data.isExtendedMode && data.subTopics) {
        setExtendedModeSubTopics(data.subTopics);
      }
      
      // Store research results from the first part for subsequent parts
      if (currentPodcastPart === 1) {
        setPodcastResearchFinished(true);
        // Store the research results for future parts
        setPodcastResearchResults(data.searchResults || "");
      }
      
      toast({
        title: podcastExtendedMode ? "Extended Podcast Generated" : "Podcast Script Generated",
        description: podcastExtendedMode 
          ? `Created comprehensive podcast with ${data.subTopics?.length || 0} research segments` 
          : `Created script for part ${currentPodcastPart} of ${podcastMultipart ? podcastParts : 1}`
      });
      
      // Auto-generate audio for single-part podcast if enabled
      if (autoGenerateAudio && !isAutomatedGeneration && (!podcastMultipart || (podcastMultipart && currentPodcastPart === podcastParts))) {
        setTimeout(() => {
          ttsConversionMutation.mutate();
        }, 500);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to generate podcast script: ${error.message || "Unknown error"}`,
        variant: "destructive"
      });
    }
  });
  
  // For tracking background processing job status
  const [processingJobId, setProcessingJobId] = useState<number | null>(null);
  const [processingProgress, setProcessingProgress] = useState(0);
  
  // Content chat states
  const [showContentChat, setShowContentChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{role: "user" | "assistant" | "system", content: string}>>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatCitations, setChatCitations] = useState<string[]>([]);
  const [chatRelatedQuestions, setChatRelatedQuestions] = useState<string[]>([]);
  
  // Reference for auto-scrolling the chat
  const chatScrollRef = useRef<HTMLDivElement>(null);
  
  // Toggle the in-page chat interface
  const toggleContentChat = () => {
    if (!showContentChat && podcastScript && chatMessages.length === 0) {
      // Initialize with a system message when first opening the chat
      setChatMessages([
        {
          role: "system",
          content: `Welcome to the content chat! I can answer questions about your ${createMode === "podcast" ? "podcast" : "content"} and provide additional information from the web when relevant.`
        }
      ]);
    }
    setShowContentChat(!showContentChat);
  };
  
  // Handle sending a message in the chat
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!chatInput.trim() || isChatLoading || !podcastScript) return;
    
    // Add user message to chat
    const userMessage = { role: "user" as const, content: chatInput };
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput("");
    setIsChatLoading(true);
    
    try {
      const response = await fetch("/api/content-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messages: [...chatMessages, userMessage],
          content: podcastScript,
          contentTitle: podcastTopic || (createMode === "content" ? "generated content" : "podcast")
        })
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Add assistant message to chat
      setChatMessages(prev => [...prev, { 
        role: "assistant", 
        content: data.response
      }]);
      
      // Store any citations or related questions
      if (data.citations) setChatCitations(data.citations);
      if (data.relatedQuestions) setChatRelatedQuestions(data.relatedQuestions);
      
    } catch (error) {
      console.error("Error sending chat message:", error);
      setChatMessages(prev => [...prev, { 
        role: "assistant", 
        content: "Sorry, there was an error processing your request. Please try again later."
      }]);
      
      toast({
        title: "Error",
        description: "Failed to get a response from the AI.",
        variant: "destructive"
      });
    } finally {
      setIsChatLoading(false);
    }
  };
  
  // Auto-scroll chat to bottom when new messages are added
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);
  
  // Function to navigate to chat with podcast content (legacy, now using in-page chat)
  const navigateToChatWithPodcast = () => {
    // Instead of navigating, just open the in-page chat
    toggleContentChat();
    
    toast({
      title: "Chat opened",
      description: "You can now chat about your content directly on this page"
    });
  };
  
  // Effect for polling job status if needed
  useEffect(() => {
    if (processingJobId === null) return;
    
    let intervalId: NodeJS.Timeout;
    
    const checkJobStatus = async () => {
      try {
        console.log(`Checking status for job ${processingJobId}`);
        // Using the new general-purpose job status endpoint
        const response = await fetch(`/api/job-status/${processingJobId}`);
        if (!response.ok) throw new Error('Failed to check job status');
        
        const data = await response.json();
        console.log(`Job status:`, data);
        
        setProcessingProgress(data.progress || 0);
        
        // If job is complete, update the audio URL and stop polling
        if (data.status === 'complete' && data.audioUrl) {
          setGeneratedAudioUrl(data.audioUrl);
          setProcessingJobId(null);
          toast({
            title: "Audio generated successfully",
            description: "You can now listen to the audio directly on this page"
          });
        } else if (data.status === 'error') {
          // Handle error
          setProcessingJobId(null);
          toast({
            title: "Error generating audio",
            description: data.error || "An unknown error occurred",
            variant: "destructive"
          });
        }
      } catch (error) {
        console.error('Error checking job status:', error);
      }
    };
    
    // Check immediately first
    checkJobStatus();
    
    // Then set up interval
    intervalId = setInterval(checkJobStatus, 2000);
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [processingJobId]);
  
  // Text-to-speech conversion for the podcast script
  const ttsConversionMutation = useMutation({
    mutationFn: async () => {
      // Determine if this is a combined multi-part script
      const isMultiPartCombined = podcastMultipart && combinedScript && combinedScript === podcastScript;
      
      const title = isMultiPartCombined
        ? `${podcastTopic} - Complete (${podcastParts} Parts)`
        : `${podcastTopic} - Part ${currentPodcastPart}`;
      
      console.log(`Sending TTS request for podcast "${title}" with voice: ${podcastVoice}`);
      
      const response = await apiRequest("/api/text-to-speech", {
        method: "POST",
        data: {
          title: title,
          text: podcastScript,
          voice: podcastVoice,
          generateArtwork: true
        }
      });
      
      console.log("Text-to-speech API raw response:", response);
      return response;
    },
    onSuccess: (data) => {
      // Save the last part's content for continuity in the next part
      setPreviousPartContent(podcastScript);
      
      // Log the response data for debugging
      console.log("Text-to-speech API response:", data);
      
      // Determine if this is a combined multi-part script
      const isMultiPartCombined = podcastMultipart && combinedScript && combinedScript === podcastScript;
      const audioTitle = isMultiPartCombined
        ? `${podcastTopic} - Complete (${podcastParts} Parts)`
        : `${podcastTopic} - Part ${currentPodcastPart}`;
        
      setGeneratedAudioTitle(audioTitle);
      
      // Handle background processing job
      if (data && data.status === 'processing') {
        setProcessingJobId(data.id);
        setProcessingProgress(data.progress || 0);
        
        toast({
          title: "Processing Started",
          description: "Your podcast is being converted to audio in the background. This may take a few minutes.",
        });
        return;
      }
      
      // Handle immediate completion - set the audio URL for playback on the page
      if (data) {
        // Check different possible properties for the audio URL
        if (data.audioUrl) {
          setGeneratedAudioUrl(data.audioUrl);
        } else if (data.audioFilename) {
          setGeneratedAudioUrl(`/api/audio/${data.audioFilename}`);
        } else if (typeof data === 'string') {
          // Handle if the API returns just a string URL
          setGeneratedAudioUrl(data);
        } else if (data.id && !data.status) { // Check it's not a job status object
          // If it's an audio file object with just an ID
          setGeneratedAudioUrl(`/api/audio/${data.id}.mp3`);
        } else {
          console.error("Could not determine audio URL from API response:", data);
          toast({
            title: "Warning",
            description: "Audio was generated but playback URL could not be determined",
            variant: "destructive"
          });
          return;
        }
        
        toast({
          title: "Audio generated successfully",
          description: "You can now listen to the audio directly on this page"
        });
      }
      
      // If we have more parts to generate, increment part and clear the script
      if (podcastMultipart && currentPodcastPart < podcastParts) {
        setCurrentPodcastPart(prev => prev + 1);
        setPodcastScript("");
        
        toast({
          title: "Podcast audio created",
          description: `Audio for part ${currentPodcastPart} has been added to your library. Ready to generate part ${currentPodcastPart + 1}.`
        });
      } else if (!podcastMultipart) {
        // Single part podcast is complete
        toast({
          title: "Podcast complete!",
          description: "Your podcast has been created and added to your library."
        });
      } else {
        // Final part of multi-part podcast is complete
        toast({
          title: "Podcast complete!",
          description: `All ${podcastParts} parts of your podcast have been created and added to your library.`
        });
        
        // Complete workflow - optionally reset for a new podcast after a delay
        setTimeout(() => {
          resetPodcastWorkflow();
        }, 5000);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to create podcast audio: ${error.message || "Unknown error"}`,
        variant: "destructive"
      });
    }
  });
  
  // Generate the next part of a multi-part podcast
  const generateNextPart = () => {
    if (podcastMultipart && currentPodcastPart < podcastParts) {
      // Store the current script content for continuity
      setPreviousPartContent(podcastScript);
      
      // Add current part to generatedParts object
      setGeneratedParts(prev => ({
        ...prev,
        [currentPodcastPart]: podcastScript
      }));
      
      // Clear current script and increment part number
      setPodcastScript("");
      setCurrentPodcastPart(prev => prev + 1);
      
      // Start generation of the next part
      podcastResearchMutation.mutate();
    }
  };
  
  // Start automated multi-part podcast generation
  const startAutomatedPodcastGeneration = async () => {
    // Reset states
    resetPodcastWorkflow();
    setIsAutomatedGeneration(true);
    setGeneratedParts({});
    setCombinedScript("");
    
    // Generate the first part
    setCurrentPodcastPart(1);
    setProcessingPart(1);
    
    // Start the generation process
    try {
      await podcastResearchMutation.mutateAsync();
    } catch (error) {
      console.error("Error starting automated generation:", error);
      setIsAutomatedGeneration(false);
      toast({
        title: "Error",
        description: "Failed to start automated podcast generation",
        variant: "destructive"
      });
    }
  };
  
  // Effect to handle automatic generation of parts
  useEffect(() => {
    // If automated generation is in progress and we have a script for the current part
    if (isAutomatedGeneration && podcastScript && currentPodcastPart <= podcastParts) {
      const processPart = async () => {
        // Update the generated parts with the current script
        const updatedParts = {
          ...generatedParts,
          [currentPodcastPart]: podcastScript
        };
        setGeneratedParts(updatedParts);
        
        // If this is the last part, combine all scripts
        if (currentPodcastPart === podcastParts) {
          // Combine all parts
          let fullScript = "";
          for (let i = 1; i <= podcastParts; i++) {
            if (updatedParts[i]) {
              if (fullScript) fullScript += "\n\n--- PART " + i + " ---\n\n";
              else fullScript += "--- PART " + i + " ---\n\n";
              fullScript += updatedParts[i];
            }
          }
          
          setCombinedScript(fullScript);
          setPodcastScript(fullScript);
          setIsAutomatedGeneration(false);
          setProcessingPart(null);
          
          toast({
            title: "Complete Podcast Generated!",
            description: `All ${podcastParts} parts have been generated and combined.`
          });
          
          // Auto-generate audio for the combined script if enabled
          if (autoGenerateAudio) {
            setTimeout(() => {
              ttsConversionMutation.mutate();
            }, 500);
          }
        } 
        // Otherwise, proceed to the next part
        else {
          // Store the script for continuity
          setPreviousPartContent(podcastScript);
          
          // Move to next part
          const nextPart = currentPodcastPart + 1;
          setCurrentPodcastPart(nextPart);
          setProcessingPart(nextPart);
          setPodcastScript("");
          
          // Generate the next part
          try {
            await podcastResearchMutation.mutateAsync();
          } catch (error) {
            console.error(`Error generating part ${nextPart}:`, error);
            setIsAutomatedGeneration(false);
            setProcessingPart(null);
            toast({
              title: "Generation Interrupted",
              description: `Error while generating part ${nextPart}. Process stopped.`,
              variant: "destructive"
            });
          }
        }
      };
      
      // Process after a short delay to ensure state updates
      const timer = setTimeout(processPart, 1000);
      return () => clearTimeout(timer);
    }
  }, [isAutomatedGeneration, podcastScript, currentPodcastPart, podcastParts, generatedParts, autoGenerateAudio]);
  
  // Reset the podcast creation workflow
  const resetPodcastWorkflow = () => {
    setPodcastScript("");
    setPodcastResearchResults("");
    setPodcastResearchFinished(false);
    setCurrentPodcastPart(1);
    setPreviousPartContent("");
    setGeneratedAudioUrl(null);
    setGeneratedAudioTitle("");
  };

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-6xl">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold">Content Creator</h1>
        <p className="text-muted-foreground">Create AI-generated content for your projects</p>
      </div>
      
      {/* Mode Selection */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button 
              onClick={() => setCreateMode("content")}
              variant={createMode === "content" ? "default" : "outline"}
              className="flex items-center gap-2 py-8 px-4 h-auto"
              size="lg"
            >
              <Pencil className="h-6 w-6" />
              <div className="flex flex-col items-start">
                <span className="text-lg font-medium">Content Creation</span>
                <span className="text-xs text-muted-foreground">Create articles, stories, and marketing content</span>
              </div>
            </Button>
            
            <Button 
              onClick={() => setCreateMode("podcast")}
              variant={createMode === "podcast" ? "default" : "outline"}
              className="flex items-center gap-2 py-8 px-4 h-auto"
              size="lg"
            >
              <Headphones className="h-6 w-6" />
              <div className="flex flex-col items-start">
                <span className="text-lg font-medium">Podcast Creation</span>
                <span className="text-xs text-muted-foreground">Create research-backed audio content</span>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

      {createMode === "content" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Content Type</CardTitle>
                <CardDescription>Select the type of content you want to generate</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={contentType} onValueChange={(value) => setContentType(value as any)} className="w-full">
                  <TabsList className="grid grid-cols-3 mb-4">
                    {CONTENT_TYPES.slice(0, 6).map(type => (
                      <TabsTrigger key={type.id} value={type.id}>{type.label}</TabsTrigger>
                    ))}
                  </TabsList>
                  
                  {CONTENT_TYPES.map(type => (
                    <TabsContent key={type.id} value={type.id} className="space-y-4">
                      <p className="text-sm text-muted-foreground">{type.description}</p>
                      
                      {type.id === "custom" && (
                        <div className="space-y-2">
                          <Label htmlFor="systemPrompt">Custom System Instructions</Label>
                          <Textarea
                            id="systemPrompt"
                            placeholder="Provide custom instructions to guide the AI..."
                            value={customSystemPrompt}
                            onChange={(e) => setCustomSystemPrompt(e.target.value)}
                            className="min-h-[120px]"
                          />
                        </div>
                      )}
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your Prompt</CardTitle>
              <CardDescription>Describe what content you want to create</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Enter your prompt here..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[200px]"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <CardTitle>Images</CardTitle>
                <div className="flex items-center space-x-2">
                  <Switch 
                    checked={useImages} 
                    onCheckedChange={setUseImages} 
                    id="use-images" 
                  />
                  <Label htmlFor="use-images">Include images</Label>
                </div>
              </div>
              <CardDescription>Add images for multimodal content generation</CardDescription>
            </CardHeader>
            <CardContent className={useImages ? "" : "opacity-50 pointer-events-none"}>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                multiple
                className="hidden"
              />
              
              <Button
                variant="outline"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
                disabled={!useImages}
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload Images
              </Button>
              
              {images.length > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {images.map((image, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={URL.createObjectURL(image)}
                        alt={`Uploaded ${index + 1}`}
                        className="w-full h-auto rounded-md aspect-square object-cover"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeImage(index)}
                      >
                        ✕
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <CardTitle>Generation Settings</CardTitle>
                <div className="flex items-center space-x-2">
                  <Switch 
                    checked={showAdvanced} 
                    onCheckedChange={setShowAdvanced} 
                    id="advanced-options" 
                  />
                  <Label htmlFor="advanced-options">Advanced</Label>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label htmlFor="temperature">Temperature: {temperature}</Label>
                </div>
                <Slider
                  id="temperature"
                  min={0}
                  max={1}
                  step={0.1}
                  value={[temperature]}
                  onValueChange={(value) => setTemperature(value[0])}
                />
                <p className="text-xs text-muted-foreground">
                  Lower values produce more focused and deterministic outputs. Higher values produce more creative and varied outputs.
                </p>
              </div>

              {showAdvanced && (
                <div className="space-y-2 pt-2">
                  <Separator className="my-2" />
                  <div className="flex justify-between">
                    <Label htmlFor="max-tokens">Max Output Tokens: {maxOutputTokens}</Label>
                  </div>
                  <Slider
                    id="max-tokens"
                    min={100}
                    max={8000}
                    step={100}
                    value={[maxOutputTokens]}
                    onValueChange={(value) => setMaxOutputTokens(value[0])}
                  />
                  <p className="text-xs text-muted-foreground">
                    The maximum number of tokens (words/characters) in the generated response.
                  </p>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                onClick={() => generationMutation.mutate()}
                disabled={prompt.trim() === "" || generationMutation.isPending}
              >
                {generationMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Content
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>

        <div>
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle>Generated Content</CardTitle>
              <CardDescription>Your AI-generated content will appear here</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col overflow-hidden">
              {generatedContent ? (
                <div className="whitespace-pre-wrap overflow-y-auto flex-1 p-4 border rounded-md bg-muted/50">
                  {generatedContent}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border rounded-md border-dashed">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No content generated yet</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    Fill in the details on the left and click 'Generate Content' to create your content with Gemini 2.5 Pro.
                  </p>
                  <div className="mt-4 flex flex-col items-center">
                    <p className="text-sm font-medium mb-2">What can you create?</p>
                    <ul className="text-sm text-muted-foreground text-left">
                      <li>• Stories and creative fiction</li>
                      <li>• Articles and blog posts</li>
                      <li>• Speech scripts and talks</li>
                      <li>• Marketing copy</li>
                      <li>• And much more!</li>
                    </ul>
                  </div>
                </div>
              )}
            </CardContent>
            {generatedContent && (
              <CardFooter className="flex justify-between">
                <Button variant="outline" onClick={copyToClipboard}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy
                </Button>
                <Button 
                  onClick={() => {
                    // Navigate to convert page with this content
                    const textToConvert = encodeURIComponent(generatedContent);
                    window.location.href = `/convert?text=${textToConvert}`;
                  }}
                >
                  <Send className="mr-2 h-4 w-4" />
                  Convert to Speech
                </Button>
              </CardFooter>
            )}
          </Card>
        </div>
      </div>
    ) : (
        /* Podcast Creation UI */
        <div className="grid grid-cols-1 gap-6">
          {/* Input Form */}
          <Card>
            <CardHeader>
              <CardTitle>Create Podcast</CardTitle>
              <CardDescription>Generate research-backed podcast scripts and audio</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Step 1: Topic Selection */}
              <div className="space-y-2">
                <Label htmlFor="podcast-topic">Podcast Topic</Label>
                <Input
                  id="podcast-topic"
                  placeholder="Enter a topic for your podcast..."
                  value={podcastTopic}
                  onChange={(e) => setPodcastTopic(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Choose a specific topic for your podcast. More specific topics yield better results.
                </p>
              </div>
              
              {/* Step 2: Model Information */}
              <div className="space-y-2">
                <Label>AI Model</Label>
                <div className="border rounded-lg p-4 bg-primary/5 border-primary">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-white" />
                    </div>
                    <span className="font-medium">Claude 3.7 Sonnet</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Using Anthropic's most capable model to create high-quality, research-backed podcast content
                  </p>
                </div>
              </div>
              
              {/* Step 3: Duration and Parts */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label htmlFor="podcast-duration">Target Duration: {podcastDuration} minutes</Label>
                  </div>
                  <Slider
                    id="podcast-duration"
                    min={5}
                    max={60}
                    step={5}
                    value={[podcastDuration]}
                    onValueChange={(value) => setPodcastDuration(value[0])}
                  />
                  <p className="text-xs text-muted-foreground">
                    Choose the approximate duration for your podcast. Longer durations will create more detailed content.
                  </p>
                </div>
                
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="multipart-toggle">Multi-part Podcast</Label>
                      <Switch
                        id="multipart-toggle"
                        checked={podcastMultipart}
                        onCheckedChange={setPodcastMultipart}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Split your podcast into multiple parts for better organization and management.
                    </p>
                  </div>
                  
                  {podcastMultipart && (
                    <div className="space-y-2 pl-4 border-l-2 border-muted">
                      <Label htmlFor="podcast-parts">Number of Parts: {podcastParts}</Label>
                      <Slider
                        id="podcast-parts"
                        min={2}
                        max={6}
                        step={1}
                        value={[podcastParts]}
                        onValueChange={(value) => setPodcastParts(value[0])}
                      />
                    </div>
                  )}
                  
                  {/* Extended Podcast Mode Toggle */}
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="extended-mode-toggle">Extended Research Mode</Label>
                      <Switch
                        id="extended-mode-toggle"
                        checked={podcastExtendedMode}
                        onCheckedChange={(checked) => {
                          setPodcastExtendedMode(checked);
                          // Force Claude model when extended mode is enabled
                          if (checked) {
                            setPodcastModel("claude");
                          }
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Leverages Claude's full context window to create a comprehensive podcast with multiple sub-topics and deeper research.
                      {podcastExtendedMode && podcastModel !== "claude" && 
                        " (Requires Claude model - will be auto-selected)"}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Step 4: Voice Selection */}
              <div className="space-y-2">
                <Label>Voice Selection</Label>
                <div className="grid grid-cols-2 gap-4 pt-2">
                  {AVAILABLE_VOICES.map(voice => (
                    <div 
                      key={voice} 
                      className={`flex items-center justify-between p-3 rounded-lg border relative ${
                        podcastVoice === voice ? 'border-primary bg-primary/10' : 'border-muted hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center space-x-2" onClick={() => setPodcastVoice(voice)}>
                        <div className={`w-4 h-4 rounded-full border ${
                          podcastVoice === voice ? 'border-primary bg-primary' : 'border-muted-foreground'
                        }`}>
                          {podcastVoice === voice && (
                            <div className="w-2 h-2 rounded-full bg-white m-auto" />
                          )}
                        </div>
                        <Label className="capitalize cursor-pointer">{voice}</Label>
                      </div>
                      
                      {/* Play voice sample button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => playVoiceSample(voice)}
                        title={`Play ${voice} sample`}
                      >
                        {playingVoiceSample === "loading" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : playingVoiceSample === voice ? (
                          <Square className="h-4 w-4" />
                        ) : (
                          <Volume2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Auto-generate audio option */}
              <div className="flex items-center space-x-2 pt-2">
                <Switch 
                  id="auto-generate-audio" 
                  checked={autoGenerateAudio}
                  onCheckedChange={setAutoGenerateAudio}
                />
                <Label htmlFor="auto-generate-audio">
                  Automatically convert script to audio after generation
                </Label>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-3">
              <div className="w-full flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => podcastResearchMutation.mutate()}
                  disabled={podcastTopic.trim() === "" || podcastResearchMutation.isPending || isAutomatedGeneration}
                >
                  {podcastResearchMutation.isPending && !isAutomatedGeneration ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Researching & Writing...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      Generate Single Part
                    </>
                  )}
                </Button>
                
                {podcastMultipart && (
                  <Button
                    className="flex-1"
                    onClick={startAutomatedPodcastGeneration}
                    disabled={podcastTopic.trim() === "" || isAutomatedGeneration || podcastResearchMutation.isPending}
                    variant="secondary"
                  >
                    {isAutomatedGeneration ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating Part {processingPart} of {podcastParts}...
                      </>
                    ) : (
                      <>
                        <BookOpen className="mr-2 h-4 w-4" />
                        Auto-Generate All Parts
                      </>
                    )}
                  </Button>
                )}
              </div>
              
              {isAutomatedGeneration && (
                <div className="w-full bg-slate-100 dark:bg-slate-800 p-2 rounded text-center text-sm">
                  <div className="mb-1 font-medium">Generating podcast in {podcastParts} parts</div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
                    <div 
                      className="bg-primary h-2.5 rounded-full transition-all duration-500" 
                      style={{ width: `${(((processingPart || 1) - 1) / podcastParts) * 100}%` }}
                    ></div>
                  </div>
                </div>
              )}
              
              {/* Extended mode progress indicator */}
              {podcastExtendedMode && extendedModeStep && (
                <div className="w-full bg-slate-100 dark:bg-slate-800 p-3 rounded text-sm mt-2">
                  <div className="mb-2">
                    <div className="font-medium text-primary">Extended Podcast Mode</div>
                    <div className="text-sm text-muted-foreground mt-1">{extendedModeStep}</div>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
                    <div 
                      className="bg-primary h-2.5 rounded-full transition-all duration-500" 
                      style={{ width: `${extendedModeProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </CardFooter>
          </Card>
          
          {/* Results Display */}
          {podcastScript && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center">
                    <span>Podcast Script</span>
                    {podcastMultipart && combinedScript && combinedScript === podcastScript ? (
                      <div className="ml-2 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-md text-sm font-medium">
                        Complete Script (All {podcastParts} Parts)
                      </div>
                    ) : (
                      <div className="ml-2 px-2 py-1 bg-primary/10 rounded-md text-sm">
                        Part {currentPodcastPart} of {podcastMultipart ? podcastParts : 1}
                      </div>
                    )}
                  </div>
                  {podcastResearchFinished && (
                    <div className="flex items-center text-sm text-green-600 font-normal">
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Research Complete
                    </div>
                  )}
                </CardTitle>
                <CardDescription>
                  {podcastMultipart && combinedScript && combinedScript === podcastScript 
                    ? `Complete podcast script - approximately ${Math.round(podcastScript.split(/\s+/).length / 150)} minutes of audio`
                    : podcastMultipart 
                      ? `This script will be approximately ${Math.round(podcastScript.split(/\s+/).length / 150)} minutes of audio in a ${podcastDuration * podcastParts}-minute total podcast`
                      : `This script will create approximately ${Math.round(podcastScript.split(/\s+/).length / 150)} minutes of audio`
                  }
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Audio processing progress indicator */}
                {processingJobId !== null && (
                  <div className="border rounded-lg p-4 bg-muted/10 mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-medium">Processing Audio</h3>
                      <span className="text-sm text-muted-foreground">{processingProgress}% complete</span>
                    </div>
                    <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-primary h-full transition-all duration-300 ease-in-out" 
                        style={{ width: `${processingProgress}%` }}
                      ></div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      Converting your podcast script to audio. This may take a few minutes for longer scripts.
                    </p>
                  </div>
                )}
                
                {/* Audio player section - shown only when audio is generated */}
                {generatedAudioUrl && (
                  <div className="border rounded-lg p-4 bg-muted/10">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-medium">Generated Audio</h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Create an anchor element for downloading
                          const a = document.createElement('a');
                          a.href = generatedAudioUrl;
                          
                          // Set download attribute with a clean filename
                          const cleanFilename = generatedAudioTitle
                            ? generatedAudioTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.mp3'
                            : `podcast_${Date.now()}.mp3`;
                          
                          a.download = cleanFilename;
                          document.body.appendChild(a);
                          a.click();
                          
                          // Clean up
                          setTimeout(() => {
                            document.body.removeChild(a);
                          }, 0);
                          
                          toast({
                            title: "Downloaded!",
                            description: "Audio file downloaded successfully",
                          });
                        }}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download Audio
                      </Button>
                    </div>
                    <AudioPlayer 
                      src={generatedAudioUrl} 
                      title={generatedAudioTitle || `${podcastTopic} - Part ${currentPodcastPart}`}
                    />
                  </div>
                )}
                
                {/* Script text */}
                <div className="h-[400px] overflow-y-auto bg-muted/20 p-4 rounded-md">
                  <pre className="whitespace-pre-wrap">{podcastScript}</pre>
                </div>
              </CardContent>
              <CardFooter className="flex flex-wrap gap-2 justify-between">
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(podcastScript);
                      toast({
                        title: "Copied!",
                        description: "Script copied to clipboard",
                      });
                    }}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy to Clipboard
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      // Create text file download
                      const blob = new Blob([podcastScript], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      
                      // Set the filename
                      const isMultiPartCombined = podcastMultipart && combinedScript && combinedScript === podcastScript;
                      const filename = isMultiPartCombined
                        ? `${podcastTopic.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_complete_script.txt`
                        : `${podcastTopic.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_part_${currentPodcastPart}.txt`;
                      
                      a.href = url;
                      a.download = filename;
                      document.body.appendChild(a);
                      a.click();
                      
                      // Clean up
                      setTimeout(() => {
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }, 0);
                      
                      toast({
                        title: "Downloaded!",
                        description: "Script downloaded as text file",
                      });
                    }}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download Script
                  </Button>
                </div>
                
                <div className="flex gap-2">
                  {/* Only show Generate Next Part if we're in a multi-part podcast and have more parts to generate */}
                  {podcastMultipart && currentPodcastPart < podcastParts && !combinedScript && (
                    <Button 
                      onClick={generateNextPart}
                      disabled={podcastResearchMutation.isPending}
                      variant="secondary"
                    >
                      {podcastResearchMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <BookOpen className="mr-2 h-4 w-4" />
                          Generate Part {currentPodcastPart + 1}
                        </>
                      )}
                    </Button>
                  )}
                  
                  <Button 
                    onClick={() => ttsConversionMutation.mutate()}
                    disabled={ttsConversionMutation.isPending}
                  >
                    {ttsConversionMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Converting to Audio...
                      </>
                    ) : (
                      <>
                        <FileAudio className="mr-2 h-4 w-4" />
                        Convert to Audio
                      </>
                    )}
                  </Button>
                  
                  <Button 
                    variant={showContentChat ? "default" : "outline"}
                    onClick={toggleContentChat}
                    className="ml-2"
                  >
                    <MessageSquare className="mr-2 h-4 w-4" />
                    {showContentChat ? "Hide Chat" : "Chat with Content"}
                  </Button>
                </div>
              </CardFooter>
            </Card>
          )}
          
          {/* Standalone Audio Player Card - shown when there's no script but audio exists (e.g., after page reset) */}
          {!podcastScript && generatedAudioUrl && (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Generated Audio</CardTitle>
                    <CardDescription>Listen to your generated podcast</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Create an anchor element for downloading
                      const a = document.createElement('a');
                      a.href = generatedAudioUrl;
                      
                      // Set download attribute with a clean filename
                      const cleanFilename = generatedAudioTitle
                        ? generatedAudioTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.mp3'
                        : `podcast_${Date.now()}.mp3`;
                      
                      a.download = cleanFilename;
                      document.body.appendChild(a);
                      a.click();
                      
                      // Clean up
                      setTimeout(() => {
                        document.body.removeChild(a);
                      }, 0);
                      
                      toast({
                        title: "Downloaded!",
                        description: "Audio file downloaded successfully",
                      });
                    }}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download Audio
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <AudioPlayer 
                  src={generatedAudioUrl} 
                  title={generatedAudioTitle || "Generated Podcast"}
                />
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}