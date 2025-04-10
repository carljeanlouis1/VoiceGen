import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AudioFile } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, MessageSquare } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function Chat() {
  const [selectedFileId, setSelectedFileId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { data: audioFiles, isLoading: isLoadingFiles } = useQuery<AudioFile[]>({
    queryKey: ["/api/library"],
  });

  const selectedFile = audioFiles?.find(file => file.id.toString() === selectedFileId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !selectedFile) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          context: selectedFile.text
        })
      });

      const data = await response.json();
      if (response.ok) {
        setMessages(prev => [...prev, { role: "assistant", content: data.response }]);
      } else {
        setMessages(prev => [...prev, { 
          role: "assistant", 
          content: `Error: ${data.message || "Failed to get a response from Claude."}`
        }]);
      }
    } catch (error) {
      console.error("Failed to get response:", error);
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: "Sorry, there was an error connecting to the analysis service."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container max-w-4xl py-8">
      <Card className="card-gradient shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">Text Analysis with Claude</CardTitle>
              <CardDescription>
                Analyze your content and get deeper insights using Claude Sonnet 3.7
              </CardDescription>
            </div>
            <Badge variant="outline" className="bg-primary/10 text-primary">
              Claude Sonnet 3.7
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Audio File to Analyze</label>
            <Select value={selectedFileId} onValueChange={setSelectedFileId}>
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
            <>
              <div className="rounded-md border bg-card">
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

              <ScrollArea className="h-[400px] rounded-md border p-4">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
                    <h3 className="font-semibold mb-2">Start a conversation</h3>
                    <p>Ask questions about the content to analyze it or get insights.</p>
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
                        {message.role === "assistant" ? "Claude Sonnet 3.7" : "You"}
                      </div>
                      <div className="whitespace-pre-line">{message.content}</div>
                    </div>
                  ))
                )}
                {isLoading && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span className="ml-2">Claude is thinking...</span>
                  </div>
                )}
              </ScrollArea>

              <form onSubmit={handleSubmit} className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask questions about the content..."
                  className="flex-1"
                  disabled={isLoading}
                />
                <Button type="submit" disabled={isLoading || !input.trim()}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
