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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { 
  Loader2, Copy, Upload, Image as ImageIcon, MessageSquare, Sparkles, Send,
  Radio, Mic, Search, Play, Headphones, FileAudio, BookOpen, Pencil, CheckCircle2, 
  Volume2, Download, Square, Info as InfoIcon, X, Bug
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { ContentChat } from "@/components/content-chat";
import { apiRequest } from "@/lib/queryClient";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AVAILABLE_VOICES } from "@shared/schema";
import { AudioPlayer } from "@/components/audio-player";
import { useLocation } from "wouter";

// Common Arion Vale personality traits to be applied to all content
const ARION_VALE_PERSONALITY = `
You are Arion Vale, a renowned content creator with the following personality traits:
- Confident but not arrogant, with a calm, authoritative demeanor
- Engaging storyteller who makes complex topics accessible
- Thoughtful and empathetic, with a genuine interest in helping audiences
- Insightful with occasional witty observations and clever analogies
- Balanced perspective that considers multiple viewpoints
- Forward-thinking with an optimistic but realistic outlook
`;

// Predefined system prompts for different content types
const CONTENT_TEMPLATES = {
  story: `${ARION_VALE_PERSONALITY}
As a creative storyteller and fiction writer, create an engaging, imaginative story with compelling characters and an interesting plot. Make the story immersive and captivating with vivid descriptions and meaningful character development. Draw on relevant cultural references and universal themes that resonate with readers.`,
  
  article: `${ARION_VALE_PERSONALITY}
As a professional content writer specializing in informative articles, create well-researched, factually accurate content that is educational and engaging. Use a clear structure with headings, subheadings, and maintain a professional yet accessible tone. Include relevant examples, data points, and insights that provide value to the reader. Your article should present balanced perspectives while demonstrating expertise in the subject matter.`,
  
  tedTalk: `${ARION_VALE_PERSONALITY}
As a TED Talk writer, create an inspiring, thought-provoking talk in the style of the world's best TED presentations. The talk should:
- Start with a powerful hook or personal story that introduces the central idea
- Present a clear through-line with 2-3 key insights or revelations
- Include memorable examples, metaphors or analogies that make complex ideas accessible
- Build toward a compelling call to action or perspective shift
- End with a strong conclusion that connects back to the opening
- Have a conversational tone with natural pauses and emphasis
The talk should be approximately 15-18 minutes when read aloud (about 2000-2500 words).`,
  
  marketing: `${ARION_VALE_PERSONALITY}
As a marketing copywriter, create persuasive, attention-grabbing content that highlights benefits, addresses pain points, and includes strong calls to action. The tone should be enthusiastic and customer-focused while remaining authentic. Use compelling headers, bullet points for key benefits, social proof elements, and emotional triggers that resonate with the target audience. The copy should tell a story that positions the product or service as the solution to a specific problem.`,
  
  creative: `${ARION_VALE_PERSONALITY}
As a creative content generator, create unique, innovative content that is thought-provoking and original. Feel free to experiment with format, style, and conventions while maintaining readability and engagement. Incorporate unexpected perspectives, creative metaphors, and imaginative scenarios that challenge conventional thinking. Your content should leave readers with new ideas, questions, or perspectives they hadn't considered before.`
};

// Content type options for the tabs
const CONTENT_TYPES = [
  { id: "story", label: "Story", description: "Creative fiction with characters and plot" },
  { id: "article", label: "Article", description: "Informative, research-based content with facts and insights" },
  { id: "tedTalk", label: "TED Talk", description: "Engaging, inspirational talk in TED presentation style" },
  { id: "marketing", label: "Marketing", description: "Persuasive copy that sells products or services" },
  { id: "creative", label: "Creative", description: "Unique, experimental content with creative flair" },
  { id: "custom", label: "Custom", description: "Your own instructions for personalized content" }
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
  
  // Content creation extended research mode states
  const [contentExtendedMode, setContentExtendedMode] = useState(false);
  const [contentSegments, setContentSegments] = useState(3); // Default to 3 segments for extended mode
  const [contentCurrentSegment, setContentCurrentSegment] = useState(1);
  const [contentSubTopics, setContentSubTopics] = useState<string[]>([]);
  const [contentResearchResults, setContentResearchResults] = useState("");
  const [contentResearchFinished, setContentResearchFinished] = useState(false);
  const [contentGenerationProgress, setContentGenerationProgress] = useState(0);
  const [contentGeneratingSegment, setContentGeneratingSegment] = useState(false);
  const [contentGeneratedSegments, setContentGeneratedSegments] = useState<Record<number, string>>({});
  const [contentCombinedContent, setContentCombinedContent] = useState("");
  const [contentProcessingJobId, setContentProcessingJobId] = useState<number | null>(null);
  const [contentResearchStep, setContentResearchStep] = useState<string | null>(null);
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
  
  // Text-to-speech states
  const [ttsJobId, setTtsJobId] = useState<number | null>(null);
  const [ttsProgress, setTtsProgress] = useState(0);
  const [ttsComplete, setTtsComplete] = useState(false);
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null);
  const [ttsTitle, setTtsTitle] = useState<string>("");
  const [ttsVoice, setTtsVoice] = useState<typeof AVAILABLE_VOICES[number]>("alloy");
  const [ttsProcessing, setTtsProcessing] = useState(false);
  const [ttsGenerateArtwork, setTtsGenerateArtwork] = useState(false);
  
  // Interval reference for TTS job polling
  const ttsIntervalRef = useRef<number | null>(null);

  // Function to check TTS job status
  const checkTtsJobStatus = async (jobId: number) => {
    try {
      console.log(`Checking status for TTS job ${jobId}...`);
      // Using the general-purpose job status endpoint
      const response = await fetch(`/api/job-status/${jobId}`);
      
      if (!response.ok) {
        console.error(`Failed to fetch job status: ${response.status}`);
        throw new Error(`Failed to fetch job status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`Received status for TTS job ${jobId}:`, data);
      
      // Update job state with latest information
      setTtsProgress(data.progress || 0);
      
      // Handle completion
      if (data.status === 'complete') {
        console.log(`TTS job ${jobId} completed successfully!`);
        
        // Stop polling
        if (ttsIntervalRef.current) {
          console.log(`Clearing interval for completed TTS job ${jobId}`);
          window.clearInterval(ttsIntervalRef.current);
          ttsIntervalRef.current = null;
        }
        
        setTtsProcessing(false);
        setTtsComplete(true);
        
        if (data.audioUrl) {
          console.log(`Audio URL received for TTS job ${jobId}, updating UI`);
          setTtsAudioUrl(data.audioUrl);
          
          // Show completion toast
          toast({
            title: "Success",
            description: "Audio file created successfully",
          });
        }
      }
      // Handle error
      else if (data.status === 'error') {
        console.log(`TTS job ${jobId} failed with error: ${data.error}`);
        
        // Stop polling
        if (ttsIntervalRef.current) {
          window.clearInterval(ttsIntervalRef.current);
          ttsIntervalRef.current = null;
        }
        
        setTtsProcessing(false);
        
        // Show error toast
        toast({
          title: "Error",
          description: data.error || "Failed to convert text to speech",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error checking TTS job status:", error);
    }
  };
  
  // Start polling when TTS job ID changes
  useEffect(() => {
    if (ttsJobId && ttsProcessing) {
      // Stop any existing interval
      if (ttsIntervalRef.current) {
        window.clearInterval(ttsIntervalRef.current);
      }
      
      // Start polling
      const id = window.setInterval(() => {
        checkTtsJobStatus(ttsJobId);
      }, 2000);
      
      ttsIntervalRef.current = id;
      
      // Initial check
      checkTtsJobStatus(ttsJobId);
    }
    
    // Clean up when component unmounts or job ID changes
    return () => {
      if (ttsIntervalRef.current) {
        window.clearInterval(ttsIntervalRef.current);
        ttsIntervalRef.current = null;
      }
    };
  }, [ttsJobId]);
  
  // Function to start the TTS process
  const startTextToSpeech = async (text: string, title: string) => {
    if (!text || !title) {
      toast({
        title: "Error",
        description: "Text and title are required",
        variant: "destructive",
      });
      return;
    }
    
    // Verify text isn't too large
    if (text.length > 100000) {
      toast({
        title: "Text too large",
        description: "Text exceeds 100,000 characters. Please reduce the size or split into multiple parts.",
        variant: "destructive",
      });
      return;
    }
    
    setTtsProcessing(true);
    setTtsComplete(false);
    setTtsAudioUrl(null);
    setTtsTitle(title);
    
    try {
      const response = await apiRequest("/api/text-to-speech", {
        method: "POST",
        data: {
          title,
          text,
          voice: ttsVoice,
          generateArtwork: ttsGenerateArtwork
        }
      });
      
      // Handle background processing job
      if (response && response.status === 'processing') {
        setTtsJobId(response.id);
        
        toast({
          title: "Processing Started",
          description: "Your text is being converted in the background. This may take a few minutes.",
        });
      } else if (response) {
        // For immediate completions (not background jobs)
        setTtsComplete(true);
        setTtsProcessing(false);
        setTtsAudioUrl(response.audioUrl);
        
        toast({
          title: "Success",
          description: "Audio file created successfully",
        });
      }
    } catch (error: any) {
      setTtsProcessing(false);
      
      toast({
        title: "Error",
        description: error.message || "Failed to convert text to speech. Please try again.",
        variant: "destructive",
      });
    }
  };
  
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
  // Content research and generation mutation
  const contentResearchMutation = useMutation({
    mutationFn: async () => {
      // Initialize the system prompt
      const systemPrompt = contentType === "custom" 
        ? customSystemPrompt 
        : CONTENT_TEMPLATES[contentType as keyof typeof CONTENT_TEMPLATES];
      
      // For extended mode, set initial state
      if (contentExtendedMode) {
        setContentResearchStep("Analyzing topic and planning sub-topics");
        setContentGenerationProgress(10);
      }
      
      return apiRequest("/api/content/research", {
        method: "POST",
        data: {
          topic: prompt,
          contentType: contentType,
          systemPrompt: systemPrompt,
          temperature: temperature,
          maxOutputTokens: maxOutputTokens,
          segment: contentCurrentSegment,
          totalSegments: contentExtendedMode ? contentSegments : 1,
          previousContent: contentCurrentSegment > 1 ? Object.values(contentGeneratedSegments).join("\n\n") : "",
          searchResults: contentResearchResults,
          extendedMode: contentExtendedMode,
          images: useImages ? imageBase64 : undefined
        }
      });
    },
    onSuccess: (data) => {
      if (contentExtendedMode) {
        // For extended mode, handle multi-part content
        if (data.subTopics && contentCurrentSegment === 1) {
          setContentSubTopics(data.subTopics);
        }
        
        if (data.researchResults) {
          setContentResearchResults(data.researchResults);
          setContentResearchFinished(true);
        }
        
        if (data.script || data.content) {
          const generatedText = data.script || data.content;
          
          // Store segment
          setContentGeneratedSegments(prev => ({
            ...prev,
            [contentCurrentSegment]: generatedText
          }));
          
          // If this is the last segment or only has one segment
          if (contentCurrentSegment >= contentSegments) {
            // Combine all segments
            const allSegments = {
              ...contentGeneratedSegments,
              [contentCurrentSegment]: generatedText
            };
            
            const combined = Object.keys(allSegments)
              .sort((a, b) => parseInt(a) - parseInt(b))
              .map(key => allSegments[parseInt(key)])
              .join("\n\n");
            
            setContentCombinedContent(combined);
            setGeneratedContent(combined);
          } else {
            // Just show the current segment
            setGeneratedContent(generatedText);
          }
        }
        
        // Handle next segment or completion
        if (contentCurrentSegment < contentSegments) {
          // Move to the next segment
          const nextSegment = contentCurrentSegment + 1;
          
          toast({
            title: "Segment Complete",
            description: `Generating segment ${nextSegment} of ${contentSegments}...`
          });
          
          // Increment the segment counter
          setContentCurrentSegment(nextSegment);
          
          // Start generating the next segment after a longer delay to allow server to recover
          toast({
            title: "Memory optimization",
            description: "Waiting 3 seconds between segments to prevent server overload."
          });
          
          setTimeout(() => {
            contentResearchMutation.mutate();
          }, 3000);
        } else {
          // We're done with all segments
          setContentProcessingJobId(null);
          
          toast({
            title: "Content Complete",
            description: "Your complete content has been generated!"
          });
          
          // Clean up large data objects to save memory after 5 minutes
          setTimeout(() => {
            // If the content is still displayed, show a warning
            if (contentCombinedContent.length > 0) {
              toast({
                title: "Memory Management",
                description: "To prevent browser crashes with large content, consider copying or downloading your content soon.",
              });
            }
          }, 300000); // 5 minutes
        }
      } else {
        // For regular mode, just set the content
        setGeneratedContent(data.script || data.content);
        toast({
          title: "Content Generated",
          description: "Your content has been created successfully!"
        });
      }
    },
    onError: (error: Error) => {
      setContentProcessingJobId(null);
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
  
  // Chat state
  const [showContentChat, setShowContentChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<{role: "user" | "assistant" | "system", content: string}[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatCitations, setChatCitations] = useState<string[]>([]);
  
  // Reference for auto-scrolling the chat
  const chatScrollRef = useRef<HTMLDivElement>(null);
  
  // Helper function to get the appropriate content based on mode
  const getCurrentContent = () => {
    if (createMode === "podcast") {
      return podcastScript || "";
    } else {
      return generatedContent || "";
    }
  };
  
  // Helper function to check if there's content to chat about
  const hasContentToChat = () => {
    return createMode === "podcast" ? !!podcastScript : !!generatedContent;
  };
  
  // Toggle chat interface and initialize chat if needed
  const toggleContentChat = (e?: React.MouseEvent) => {
    // Prevent any default behavior if this is called from an event
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    console.log("Toggle chat called, current state:", showContentChat);
    
    // Check if there's content to chat about
    if (!hasContentToChat()) {
      toast({
        title: "No content to chat about",
        description: "Please generate some content first before starting a chat.",
        variant: "destructive"
      });
      return; // Don't proceed if no content
    }
    
    // Initialize with a system message when first opening the chat
    if (!showContentChat && chatMessages.length === 0) {
      const contentType = createMode === "podcast" ? "podcast script" : "generated content";
      setChatMessages([
        {
          role: "system",
          content: `Welcome to the content chat! I can answer questions about your ${contentType} and provide additional information from the web when relevant.`
        }
      ]);
    }
    
    // Toggle the chat visibility
    setShowContentChat(prev => !prev);
    
    // Log for debugging
    console.log("Chat should now be:", !showContentChat);
  };
  
  // Handle chat submission
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!chatInput.trim() || isChatLoading) return;
    
    try {
      // Add user message to chat
      const userMessage = { role: "user" as const, content: chatInput };
      setChatMessages(prev => [...prev, userMessage]);
      setChatInput("");
      setIsChatLoading(true);
      
      // Get content and title based on mode
      const content = getCurrentContent();
      const title = createMode === "podcast" ? podcastTopic || "podcast" : prompt || "content";
      
      // Call API
      const response = await fetch("/api/content-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...chatMessages, userMessage].filter(m => m.role !== "system"),
          content,
          contentTitle: title
        })
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Add response to chat
      setChatMessages(prev => [...prev, { 
        role: "assistant", 
        content: data.response 
      }]);
      
      // Update citations if available
      if (data.citations) {
        setChatCitations(data.citations);
      }
      
    } catch (error) {
      console.error("Chat error:", error);
      
      // Add error message to chat
      setChatMessages(prev => [...prev, { 
        role: "assistant", 
        content: "Sorry, there was an error processing your request. Please try again." 
      }]);
      
      toast({
        title: "Chat Error",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
    } finally {
      setIsChatLoading(false);
    }
  };
  
  // Auto-scroll chat when messages change
  useEffect(() => {
    if (chatScrollRef.current && chatMessages.length > 0) {
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
    
    // Also clear sessionStorage
    try {
      sessionStorage.removeItem('podcast_script');
      sessionStorage.removeItem('podcast_topic');
      sessionStorage.removeItem('podcast_audio_url');
    } catch (error) {
      console.error("Error clearing sessionStorage:", error);
    }
  };
  
  // Save important state to sessionStorage
  useEffect(() => {
    if (podcastScript) {
      try {
        // Store podcast script and related data in sessionStorage
        sessionStorage.setItem('podcast_script', podcastScript);
        sessionStorage.setItem('podcast_topic', podcastTopic || '');
        if (generatedAudioUrl) {
          sessionStorage.setItem('podcast_audio_url', generatedAudioUrl);
        }
      } catch (error) {
        console.error("Error saving state to sessionStorage:", error);
      }
    }
  }, [podcastScript, podcastTopic, generatedAudioUrl]);
  
  // Try to recover state from sessionStorage on page load
  useEffect(() => {
    try {
      // Only attempt recovery if we don't already have a script
      if (!podcastScript) {
        const savedScript = sessionStorage.getItem('podcast_script');
        const savedTopic = sessionStorage.getItem('podcast_topic');
        const savedAudioUrl = sessionStorage.getItem('podcast_audio_url');
        
        if (savedScript) {
          setPodcastScript(savedScript);
          if (savedTopic) setPodcastTopic(savedTopic);
          if (savedAudioUrl) setGeneratedAudioUrl(savedAudioUrl);
          
          toast({
            title: "Content Recovered",
            description: "Your previous content has been restored.",
          });
        }
      }
    } catch (error) {
      console.error("Error recovering state from sessionStorage:", error);
    }
  }, []);

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
              {/* Extended Research Mode Toggle */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="extended-research-mode" className="text-base font-medium mb-1 block">Extended Research Mode</Label>
                    <p className="text-xs text-muted-foreground">Enables web research and multi-segment content generation</p>
                  </div>
                  <Switch
                    checked={contentExtendedMode}
                    onCheckedChange={setContentExtendedMode}
                    id="extended-research-mode"
                  />
                </div>
                
                {contentExtendedMode && (
                  <div className="pt-2 pb-2 space-y-3 border rounded-md p-3 bg-muted/10">
                    <div>
                      <Label htmlFor="content-segments" className="mb-1 block">Content Segments: {contentSegments}</Label>
                      <Slider
                        id="content-segments"
                        min={1}
                        max={5}
                        step={1}
                        value={[contentSegments]}
                        onValueChange={(value) => setContentSegments(value[0])}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        More segments create longer content with more thorough research
                      </p>
                    </div>
                    
                    <Alert className="bg-primary/5">
                      <InfoIcon className="h-4 w-4" />
                      <AlertTitle>Enhanced Research</AlertTitle>
                      <AlertDescription className="text-xs">
                        Uses Perplexity Sonar Pro to research your topic in real-time and generate comprehensive content based on the latest information.
                      </AlertDescription>
                    </Alert>
                  </div>
                )}
              </div>
              
              <Separator />
              
              {/* All advanced settings moved to the advanced section */}
              {showAdvanced && (
                <div className="space-y-4 pt-2">
                  <Separator className="my-2" />
                  
                  {/* Temperature control */}
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
                  
                  {/* Max tokens control */}
                  <div className="space-y-2 pt-2">
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
                  
                  {/* Image upload toggle */}
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center space-x-2">
                      <Switch 
                        checked={useImages} 
                        onCheckedChange={setUseImages} 
                        id="use-images" 
                      />
                      <Label htmlFor="use-images">Include Images</Label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Upload images to generate content that references them. Only works with Gemini model.
                    </p>
                    
                    {useImages && (
                      <div className="mt-2">
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
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full"
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
                                  alt={`Uploaded image ${index + 1}`}
                                  className="w-full h-auto rounded-md object-cover"
                                />
                                <Button
                                  variant="destructive"
                                  size="icon"
                                  className="absolute top-1 right-1 w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => removeImage(index)}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                onClick={() => contentResearchMutation.mutate()}
                disabled={prompt.trim() === "" || contentResearchMutation.isPending}
              >
                {contentResearchMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {contentExtendedMode 
                      ? `${contentResearchStep || 'Researching & Generating'}... ${contentGenerationProgress > 0 ? `(${contentGenerationProgress}%)` : ''}`
                      : 'Generating Content...'}
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    {contentExtendedMode ? 'Research & Generate Content' : 'Generate Content'}
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
              <>
                <CardFooter className="flex justify-between">
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={copyToClipboard}>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy
                    </Button>
                    <div className="flex gap-2">
                      <Button
                        variant={showContentChat ? "default" : "outline"}
                        onClick={toggleContentChat}
                      >
                        <MessageSquare className="mr-2 h-4 w-4" />
                        {showContentChat ? "Hide Chat" : "Chat with Content"}
                      </Button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Select
                      value={ttsVoice}
                      onValueChange={(value) => setTtsVoice(value as typeof AVAILABLE_VOICES[number])}
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue placeholder="Select voice" />
                      </SelectTrigger>
                      <SelectContent>
                        {AVAILABLE_VOICES.map((voice) => (
                          <SelectItem key={voice} value={voice}>
                            {voice.charAt(0).toUpperCase() + voice.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button 
                      onClick={() => {
                        startTextToSpeech(
                          generatedContent, 
                          contentCombinedContent 
                            ? `Content: ${prompt.substring(0, 20)}...` 
                            : `Content: ${prompt.substring(0, 20)}...`
                        );
                      }}
                      disabled={ttsProcessing}
                    >
                      {ttsProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Volume2 className="mr-2 h-4 w-4" />}
                      {ttsProcessing ? "Processing..." : "Generate Audio"}
                    </Button>
                  </div>
                </CardFooter>
                
                {/* TTS Processing Status */}
                {ttsProcessing && (
                  <div className="mt-4 p-4 border rounded-md bg-muted/20">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-medium">Converting to speech: {ttsProgress}%</span>
                    </div>
                    <Progress value={ttsProgress} className="w-full h-2" />
                  </div>
                )}
                
                {/* Audio Player */}
                {ttsComplete && ttsAudioUrl && (
                  <div className="mt-4">
                    <AudioPlayer 
                      src={ttsAudioUrl} 
                      title={ttsTitle} 
                    />
                  </div>
                )}
              </>
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
                    className="ml-2"
                    type="button"
                    onClick={toggleContentChat}
                    id="chatToggleBtn"
                  >
                    <MessageSquare className="mr-2 h-4 w-4" />
                    {showContentChat ? "Hide Chat" : "Chat with Content"}
                  </Button>
                  
                  {/* Debug button - will be removed in production */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-2 bg-yellow-100 dark:bg-yellow-900"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log("Debug button clicked");
                      console.log("Chat state:", {
                        showContentChat, 
                        hasContent: hasContentToChat(),
                        messages: chatMessages.length,
                        chatKey
                      });
                      
                      // Force chat to show with a message
                      setShowContentChat(true);
                      
                      // Add a debug message
                      const newMessages = [
                        {
                          role: "system" as const,
                          content: "Debug message - " + new Date().toISOString()
                        }
                      ];
                      setChatMessages(newMessages);
                      
                      toast({
                        title: "Debug mode activated",
                        description: "Chat interface should appear now"
                      });
                    }}
                  >
                    <Bug className="mr-2 h-4 w-4" />
                    Debug
                  </Button>
                </div>
              </CardFooter>
            </Card>
          )}
          
          {/* Chat Interface */}
          {showContentChat && (
            <Card className="mt-4" data-testid="chat-interface">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center justify-between">
                  <div className="flex items-center">
                    <Sparkles className="h-5 w-5 mr-2 text-primary" />
                    <span>Chat with Perplexity Sonar</span>
                    <div className="ml-2 text-xs px-1.5 py-0.5 bg-primary/10 rounded-md">
                      Web search enabled
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setShowContentChat(false)}
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                  </Button>
                </CardTitle>
                <CardDescription>
                  Ask questions about your {createMode === "podcast" ? "podcast script" : "generated content"} or request additional information
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div 
                  className="h-[300px] overflow-y-auto border rounded-md p-3 mb-3"
                  ref={chatScrollRef}
                >
                  {chatMessages.length <= 1 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground p-4">
                      <MessageSquare className="h-10 w-10 mb-3 opacity-50" />
                      <h3 className="font-medium mb-1">Chat about your {createMode === "podcast" ? "podcast script" : "generated content"}</h3>
                      <p className="text-sm">
                        Ask questions, request summaries, or get related information from the web using Perplexity's Sonar Pro.
                      </p>
                    </div>
                  ) : (
                    chatMessages.map((msg, index) => {
                      if (msg.role === 'system') return null;
                      
                      return (
                        <div 
                          key={index} 
                          className={`mb-3 p-3 rounded-lg ${
                            msg.role === 'assistant' 
                              ? 'bg-muted' 
                              : 'bg-primary text-primary-foreground'
                          }`}
                        >
                          <div className="text-xs mb-1">
                            {msg.role === 'assistant' ? 'Perplexity Sonar' : 'You'}
                          </div>
                          <div className="whitespace-pre-line">{msg.content}</div>
                        </div>
                      );
                    })
                  )}
                  
                  {isChatLoading && (
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      <span className="text-sm">Perplexity Sonar is thinking...</span>
                    </div>
                  )}
                </div>
                
                {/* Chat input form */}
                <form className="flex gap-2" onSubmit={handleChatSubmit}>
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask about the content or get related information..."
                    className="flex-1"
                    disabled={isChatLoading}
                  />
                  <Button 
                    type="submit" 
                    size="sm"
                    disabled={!chatInput.trim() || isChatLoading}
                  >
                    {isChatLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </form>
                
                {/* Citations */}
                {chatCitations.length > 0 && (
                  <div className="mt-3 text-xs text-muted-foreground">
                    <div className="font-medium mb-1">Sources:</div>
                    <div className="flex flex-wrap gap-1">
                      {chatCitations.slice(0, 5).map((cite, i) => (
                        <div key={i} className="max-w-[200px] truncate bg-muted px-1.5 py-0.5 rounded">
                          {cite}
                        </div>
                      ))}
                      {chatCitations.length > 5 && (
                        <div className="bg-muted px-1.5 py-0.5 rounded">
                          +{chatCitations.length - 5} more
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
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