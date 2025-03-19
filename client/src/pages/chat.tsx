import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AudioFile } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function Chat() {
  const [selectedFileId, setSelectedFileId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");

  const { data: audioFiles } = useQuery<AudioFile[]>({
    queryKey: ["/api/library"],
  });

  const selectedFile = audioFiles?.find(file => file.id.toString() === selectedFileId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !selectedFile) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");

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
      setMessages(prev => [...prev, { role: "assistant", content: data.response }]);
    } catch (error) {
      console.error("Failed to get response:", error);
    }
  };

  return (
    <div className="container max-w-4xl py-8">
      <Card className="card-gradient shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Chat Analysis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Audio File</label>
            <Select value={selectedFileId} onValueChange={setSelectedFileId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a file to analyze" />
              </SelectTrigger>
              <SelectContent>
                {audioFiles?.map((file) => (
                  <SelectItem key={file.id} value={file.id.toString()}>
                    {file.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedFile && (
            <>
              <ScrollArea className="h-[400px] rounded-md border p-4">
                {messages.map((message, i) => (
                  <div
                    key={i}
                    className={`mb-4 p-4 rounded-lg ${
                      message.role === "assistant"
                        ? "bg-muted"
                        : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {message.content}
                  </div>
                ))}
              </ScrollArea>

              <form onSubmit={handleSubmit} className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask a question about the content..."
                  className="flex-1"
                />
                <Button type="submit">Send</Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
