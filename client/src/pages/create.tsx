import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Loader2, Copy, Upload, Image as ImageIcon, MessageSquare, Sparkles, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

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

export default function CreatePage() {
  const { toast } = useToast();
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

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-6xl">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold">Content Creator</h1>
        <p className="text-muted-foreground">Create AI-generated content with Gemini 2.5 Pro</p>
      </div>

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
    </div>
  );
}