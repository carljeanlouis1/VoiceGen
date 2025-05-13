import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { AudioFile } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Send, MessageSquare, Bot, FileText, Brain, Sparkles, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

// Import our new UI components
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui-system/Card";
import { Button } from "@/components/ui-system/Button";
import { InputField } from "@/components/ui-system/InputField"; 
import { AppLayout } from "@/components/ui-system/AppLayout";
import { COLORS, SHADOWS } from "@/components/ui-system/design-tokens";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

type ModelType = "claude" | "gpt" | "gemini";

export default function Chat() {
  const [, navigate] = useLocation();
  
  // State for file selection and context mode
  const [selectedFileId, setSelectedFileId] = useState<string>("");
  const [useContext, setUseContext] = useState<boolean>(true);
  const [modelType, setModelType] = useState<ModelType>("claude");
  
  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  // Podcast content state
  const [podcastContent, setPodcastContent] = useState<string | null>(null);
  const [podcastTitle, setPodcastTitle] = useState<string | null>(null);
  const [isPodcastMode, setIsPodcastMode] = useState(false);
  
  // Scroll area ref for auto-scrolling
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  
  const { data: audioFiles, isLoading: isLoadingFiles } = useQuery<AudioFile[]>({
    queryKey: ["/api/library"],
  });

  const selectedFile = useContext 
    ? audioFiles?.find(file => file.id.toString() === selectedFileId) 
    : undefined;
  
  // Determine model display name based on selected type
  const getModelName = () => {
    switch(modelType) {
      case "claude": return "Claude Sonnet 3.7";
      case "gpt": return "GPT-4o";
      case "gemini": return "Gemini 2.5 Pro";
      default: return "AI Assistant";
    }
  };
  
  const modelName = getModelName();
  
  // Check for podcast content from localStorage on component mount
  useEffect(() => {
    const content = localStorage.getItem('podcastContent');
    const title = localStorage.getItem('podcastTitle');
    
    if (content && title) {
      setPodcastContent(content);
      setPodcastTitle(title);
      setIsPodcastMode(true);
      setUseContext(true); // Enable context mode for podcast
      
      // Get the URL parameters to see if we're coming from the podcast page
      const urlParams = new URLSearchParams(window.location.search);
      const source = urlParams.get('source');
      
      if (source === 'podcast') {
        // Set an initial system message
        setMessages([
          {
            role: "system",
            content: `You are discussing a podcast about ${title}. The podcast content is provided as context. Be helpful, informative, and engaging.`
          }
        ]);
      }
    }
  }, []);
  
  // Auto scroll to bottom of messages
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle tab change
  const handleTabChange = (value: string) => {
    if (value === "podcast") {
      setIsPodcastMode(true);
      setUseContext(true);
    } else {
      setIsPodcastMode(false);
      const isContextMode = value === "context";
      setUseContext(isContextMode);
    }
    
    // Clear messages when switching modes
    setMessages([]);
    setInput("");
  };
  
  // Function to return to podcast creation
  const returnToPodcast = () => {
    navigate('/create');
  };
  
  // Handle model change
  const handleModelChange = (value: ModelType) => {
    setModelType(value);
    
    // Clear messages when changing models
    setMessages([]);
    setInput("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || (useContext && !selectedFile && !isPodcastMode)) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Determine the context to use
      let context = "";
      let useContextFlag = false;
      
      if (useContext) {
        if (isPodcastMode && podcastContent) {
          context = podcastContent;
          useContextFlag = true;
        } else if (selectedFile) {
          context = selectedFile.text;
          useContextFlag = true;
        }
      }
      
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          context: context,
          model: modelType,
          useContext: useContextFlag
        })
      });

      const data = await response.json();
      if (response.ok) {
        setMessages(prev => [...prev, { 
          role: "assistant", 
          content: data.response 
        }]);
      } else {
        setMessages(prev => [...prev, { 
          role: "assistant", 
          content: `Error: ${data.message || `Failed to get a response from ${modelName}.`}`
        }]);
      }
    } catch (error) {
      console.error("Failed to get response:", error);
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "Sorry, there was an error connecting to the AI service."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="container max-w-4xl mx-auto">
        <Card gradient elevated>
          <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              {isPodcastMode && podcastTitle ? (
                <>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 px-2" 
                      onClick={returnToPodcast}
                    >
                      <ArrowLeft className="h-4 w-4 mr-1" />
                      Back to Podcast
                    </Button>
                  </div>
                  <CardTitle className="text-2xl mt-2">Chat about "{podcastTitle}"</CardTitle>
                  <CardDescription>
                    Ask questions and discuss the podcast with the AI
                  </CardDescription>
                </>
              ) : (
                <>
                  <CardTitle className="text-2xl">AI Chat</CardTitle>
                  <CardDescription>
                    Chat with AI models with or without content context
                  </CardDescription>
                </>
              )}
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="bg-primary/10 text-primary">
                {modelName}
              </Badge>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Mode selection tabs */}
          <Tabs 
            defaultValue={isPodcastMode ? "podcast" : "context"} 
            onValueChange={handleTabChange}
          >
            <TabsList className={`w-full grid ${isPodcastMode ? "grid-cols-3" : "grid-cols-2"}`}>
              <TabsTrigger value="context" className="flex items-center gap-1">
                <FileText className="h-4 w-4" />
                <span>Content Analysis</span>
              </TabsTrigger>
              <TabsTrigger value="chat" className="flex items-center gap-1">
                <Brain className="h-4 w-4" />
                <span>General Chat</span>
              </TabsTrigger>
              {isPodcastMode && (
                <TabsTrigger value="podcast" className="flex items-center gap-1">
                  <MessageSquare className="h-4 w-4" />
                  <span>Podcast Chat</span>
                </TabsTrigger>
              )}
            </TabsList>
            
            {/* Context mode content */}
            <TabsContent value="context">
              <div className="space-y-2 py-2">
                <label className="text-sm font-medium">Select Audio File to Analyze</label>
                <Select 
                  value={selectedFileId} 
                  onValueChange={setSelectedFileId}
                  disabled={isLoadingFiles || audioFiles?.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a file to analyze" />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingFiles ? (
                      <SelectItem value="loading" disabled>Loading files...</SelectItem>
                    ) : audioFiles?.length ? (
                      audioFiles.map((file) => (
                        <SelectItem key={file.id} value={file.id.toString()}>
                          {file.title}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="empty" disabled>No files available</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {selectedFile && (
                <div className="rounded-md border bg-card mt-4">
                  <div className="p-3 border-b bg-muted/50">
                    <div className="font-medium">Content Summary</div>
                  </div>
                  <div className="p-3 text-sm text-muted-foreground max-h-[100px] overflow-auto">
                    {selectedFile.summary || (
                      <>
                        <span>Analyzing: </span>
                        <span className="font-semibold">{selectedFile.title}</span> 
                        <span> ({Math.ceil(selectedFile.text.length / 5)} words approx.)</span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>
            
            {/* General chat mode content */}
            <TabsContent value="chat">
              <div className="rounded-md border bg-card p-4 mt-2">
                <p className="text-sm text-muted-foreground">
                  Ask any question or discuss any topic with the AI. In this mode, the AI responds based on its general knowledge without analyzing specific content.
                </p>
              </div>
            </TabsContent>
            
            {/* Podcast mode content */}
            {isPodcastMode && (
              <TabsContent value="podcast">
                <div className="rounded-md border bg-card p-4 mt-2">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-full bg-primary/10">
                      <MessageSquare className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium mb-1">Podcast: {podcastTitle}</h3>
                      <p className="text-sm text-muted-foreground">
                        Ask questions about the podcast content, request summaries, or discuss specific parts of the podcast. The AI has access to the full podcast script and can help you understand or analyze it.
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>
            )}
          </Tabs>
          
          {/* Model selection */}
          <div className="flex flex-col gap-3 pt-2">
            <div className="font-medium text-sm">Choose AI Model:</div>
            <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant={modelType === "claude" ? "primary" : "outline"}
                  size="sm"
                  onClick={() => handleModelChange("claude")}
                  className="flex items-center gap-1"
                >
                  <Bot className="h-4 w-4" />
                  <span>Claude Sonnet</span>
                </Button>
                <Button
                  variant={modelType === "gpt" ? "primary" : "outline"}
                  size="sm"
                  onClick={() => handleModelChange("gpt")}
                  className="flex items-center gap-1"
                >
                  <Bot className="h-4 w-4" />
                  <span>GPT-4o</span>
                </Button>
                <Button
                  variant={modelType === "gemini" ? "primary" : "outline"}
                  size="sm"
                  onClick={() => handleModelChange("gemini")}
                  className="flex items-center gap-1"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>Gemini 2.5 Pro</span>
                </Button>
            </div>
          </div>
          
          {/* Chat interface - show if in general chat mode, podcast mode, or a file is selected in context mode */}
          {(!useContext || selectedFile || (isPodcastMode && podcastContent)) && (
            <>
              <ScrollArea 
                className="h-[350px] rounded-md border p-4 overflow-y-auto" 
                ref={scrollAreaRef as any}
              >
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
                    <h3 className="font-semibold mb-2">
                      {useContext 
                        ? "Start a conversation about this content" 
                        : "Start a conversation with the AI"
                      }
                    </h3>
                    <p>
                      {useContext
                        ? "Ask questions about the content to analyze it or get insights."
                        : "Ask any question or discuss any topic you're interested in."
                      }
                    </p>
                  </div>
                ) : (
                  messages.map((message, i) => (
                    <div
                      key={i}
                      className={`mb-4 p-4 rounded-lg ${
                        message.role === "assistant"
                          ? "bg-muted"
                          : "bg-primary text-primary-foreground"
                      }`}
                    >
                      <div className="mb-1 text-xs opacity-70">
                        {message.role === "assistant" ? modelName : "You"}
                      </div>
                      <div className="whitespace-pre-line">{message.content}</div>
                    </div>
                  ))
                )}
                {isLoading && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span className="ml-2">{modelName} is thinking...</span>
                  </div>
                )}
              </ScrollArea>

              <form onSubmit={handleSubmit} className="flex gap-2">
                <InputField
                  value={input}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
                  placeholder={
                    isPodcastMode
                      ? "Ask questions about the podcast..."
                      : useContext
                        ? "Ask questions about the content..." 
                        : "Ask me anything..."
                  }
                  className="flex-1"
                  disabled={isLoading}
                />
                <Button 
                  type="submit" 
                  disabled={isLoading || !input.trim() || (useContext && !selectedFile && !isPodcastMode)}
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </form>
            </>
          )}
        </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
