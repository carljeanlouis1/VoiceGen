import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardFooter, CardTitle } from "@/components/ui/card";
import { MessageSquare, Send, Loader2, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ContentChatProps {
  content: string;
  contentType: string;
  isVisible: boolean;
  onClose: () => void;
}

export function ContentChat({ content, contentType, isVisible, onClose }: ContentChatProps) {
  const { toast } = useToast();
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatCitations, setChatCitations] = useState<string[]>([]);
  
  // Auto-scroll reference for the chat area
  const chatScrollRef = useRef<HTMLDivElement>(null);
  
  // Initialize chat with system message when first becoming visible
  useEffect(() => {
    if (isVisible && chatMessages.length === 0) {
      setChatMessages([
        {
          role: "system",
          content: `Welcome to the content chat! I can answer questions about your ${contentType} and provide additional information from the web when relevant.`
        }
      ]);
    }
  }, [isVisible, contentType, chatMessages.length]);

  // Auto-scroll when messages change
  useEffect(() => {
    if (chatScrollRef.current && chatMessages.length > 0) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);
  
  // Handle chat submission
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!chatInput.trim() || isChatLoading) return;
    
    // Add user message to chat
    const userMessage: Message = { role: "user", content: chatInput };
    setChatMessages(prev => [...prev, userMessage]);
    
    // Clear input and show loading
    setChatInput("");
    setIsChatLoading(true);
    
    try {
      // Combine all messages for context (excluding system message)
      const messageHistory = chatMessages
        .filter(msg => msg.role !== "system")
        .map(msg => ({ role: msg.role, content: msg.content }));
        
      // Call API with content as context
      const response = await apiRequest("/api/content-chat", {
        method: "POST",
        data: {
          messages: [...messageHistory, userMessage],
          context: content
        }
      });
      
      // Add assistant response to chat
      setChatMessages(prev => [
        ...prev, 
        { 
          role: "assistant", 
          content: response.answer 
        }
      ]);
      
      // Set citations if available
      if (response.citations && Array.isArray(response.citations)) {
        setChatCitations(response.citations);
      }
      
    } catch (error) {
      console.error("Chat error:", error);
      toast({
        title: "Chat Error",
        description: "Failed to get a response. Please try again.",
        variant: "destructive"
      });
      
    } finally {
      setIsChatLoading(false);
    }
  };
  
  // If not visible, don't render anything
  if (!isVisible) return null;

  return (
    <Card className="mt-4" data-testid="content-chat-interface">
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
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <span className="sr-only">Close</span>
            <span aria-hidden="true">×</span>
          </Button>
        </CardTitle>
        <CardDescription>
          Ask questions about your {contentType} or request additional information from the web
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
              <h3 className="font-medium mb-1">Chat about your {contentType}</h3>
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
  );
}