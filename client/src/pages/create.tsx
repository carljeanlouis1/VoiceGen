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
  Volume2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AVAILABLE_VOICES } from "@shared/schema";
import { AudioPlayer } from "@/components/audio-player";

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

// Models available for podcast creation
const PODCAST_MODELS = [
  { id: "gpt", label: "GPT-4o", description: "OpenAI's advanced multimodal model" },
  { id: "claude", label: "Claude 3.7", description: "Anthropic's most capable model" },
];

export default function CreatePage() {
  const { toast } = useToast();
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
  const [podcastModel, setPodcastModel] = useState<"gpt" | "claude">("gpt");
  const [podcastMultipart, setPodcastMultipart] = useState(false);
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
  
  // Function to play a voice sample
  const playVoiceSample = (voice: string) => {
    setPlayingVoiceSample(voice);
    const audio = new Audio(`/api/voice-samples/${voice}`);
    audio.onended = () => setPlayingVoiceSample(null);
    audio.play().catch(err => {
      console.error("Error playing sample:", err);
      setPlayingVoiceSample(null);
    });
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

  // Mutation for podcast research and script generation
  const podcastResearchMutation = useMutation({
    mutationFn: async () => {
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
          searchResults: podcastResearchResults
        }
      });
    },
    onSuccess: (data) => {
      setPodcastScript(data.script);
      
      // Store research results from the first part for subsequent parts
      if (currentPodcastPart === 1) {
        setPodcastResearchFinished(true);
        // Store the research results for future parts
        setPodcastResearchResults(data.searchResults || "");
      }
      
      toast({
        title: "Podcast script generated",
        description: `Created script for part ${currentPodcastPart} of ${podcastMultipart ? podcastParts : 1}`
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to generate podcast script: ${error.message || "Unknown error"}`,
        variant: "destructive"
      });
    }
  });
  
  // Text-to-speech conversion for the podcast script
  const ttsConversionMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/text-to-speech", {
        method: "POST",
        data: {
          title: `${podcastTopic} - Part ${currentPodcastPart}`,
          text: podcastScript,
          voice: podcastVoice,
          generateArtwork: true
        }
      });
    },
    onSuccess: (data) => {
      // Save the last part's content for continuity in the next part
      setPreviousPartContent(podcastScript);
      
      // Set the audio URL for playback on the page
      if (data && data.id) {
        const audioTitle = `${podcastTopic} - Part ${currentPodcastPart}`;
        setGeneratedAudioTitle(audioTitle);
        setGeneratedAudioUrl(`/api/audio/${data.audioFilename}`);
        
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
      
      // Clear current script and increment part number
      setPodcastScript("");
      setCurrentPodcastPart(prev => prev + 1);
      
      // Start generation of the next part
      podcastResearchMutation.mutate();
    }
  };
  
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
              
              {/* Step 2: Model Selection */}
              <div className="space-y-2">
                <Label>AI Model</Label>
                <div className="grid grid-cols-2 gap-4 pt-2">
                  {PODCAST_MODELS.map(model => (
                    <div 
                      key={model.id}
                      className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                        podcastModel === model.id 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => setPodcastModel(model.id as "gpt" | "claude")}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                          podcastModel === model.id ? 'bg-primary' : 'border border-muted-foreground'
                        }`}>
                          {podcastModel === model.id && (
                            <div className="w-2 h-2 rounded-full bg-white" />
                          )}
                        </div>
                        <span className="font-medium">{model.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">{model.description}</p>
                    </div>
                  ))}
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
                
                <div className="space-y-2 pt-2">
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
                        {playingVoiceSample === voice ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Volume2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                onClick={() => podcastResearchMutation.mutate()}
                disabled={podcastTopic.trim() === "" || podcastResearchMutation.isPending}
              >
                {podcastResearchMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Researching & Writing...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Research and Generate Script
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
          
          {/* Results Display */}
          {podcastScript && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center">
                    <span>Podcast Script</span>
                    <div className="ml-2 px-2 py-1 bg-primary/10 rounded-md text-sm">
                      Part {currentPodcastPart} of {podcastMultipart ? podcastParts : 1}
                    </div>
                  </div>
                  {podcastResearchFinished && (
                    <div className="flex items-center text-sm text-green-600 font-normal">
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Research Complete
                    </div>
                  )}
                </CardTitle>
                <CardDescription>
                  {podcastMultipart 
                    ? `This script will be approximately ${Math.round(podcastScript.split(/\s+/).length / 150)} minutes of audio in a ${podcastDuration * podcastParts}-minute total podcast`
                    : `This script will create approximately ${Math.round(podcastScript.split(/\s+/).length / 150)} minutes of audio`
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[400px] overflow-y-auto bg-muted/20 p-4 rounded-md">
                  <pre className="whitespace-pre-wrap">{podcastScript}</pre>
                </div>
              </CardContent>
              <CardFooter className="flex flex-wrap gap-2 justify-between">
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
                
                <div className="flex gap-2">
                  {/* Only show Generate Next Part if we're in a multi-part podcast and have more parts to generate */}
                  {podcastMultipart && currentPodcastPart < podcastParts && (
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
                </div>
              </CardFooter>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}