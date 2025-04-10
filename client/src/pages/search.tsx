import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, ExternalLink, ThumbsUp } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface Citation {
  [key: string]: string;
}

interface SearchResponse {
  answer: string;
  citations: string[];
  related_questions: string[];
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { mutate, isPending } = useMutation({
    mutationFn: async (searchQuery: string) => {
      setError(null); // Clear any previous errors
      return apiRequest("/api/search", {
        method: "POST",
        data: { query: searchQuery }
      }) as Promise<SearchResponse>;
    },
    onSuccess: (data) => {
      setSearchResults(data);
    },
    onError: (error: Error) => {
      console.error("Search error:", error);
      setError(error.message || "An error occurred while searching. Please try again.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    mutate(query);
  };

  return (
    <div className="container max-w-4xl py-8">
      <Card className="card-gradient shadow-lg">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">AI Web Search</CardTitle>
              <CardDescription>
                Search the web using Perplexity's powerful AI-powered search
              </CardDescription>
            </div>
            <Badge variant="outline" className="bg-primary/10 text-primary">
              Perplexity Llama 3.1
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter your search query..."
              className="min-h-[100px] resize-none"
              disabled={isPending}
            />
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isPending || !query.trim()}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Search Web
                </>
              )}
            </Button>
          </form>

          {error && (
            <div className="mt-6 p-4 border border-red-200 bg-red-50 text-red-600 rounded-lg">
              <div className="flex items-start">
                <div className="flex-shrink-0 mr-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-alert-triangle">
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
                    <path d="M12 9v4"></path>
                    <path d="M12 17h.01"></path>
                  </svg>
                </div>
                <div>
                  <p className="font-medium">Search Error</p>
                  <p className="text-sm mt-1">Using Claude Sonnet as a fallback search engine</p>
                </div>
              </div>
            </div>
          )}

          {searchResults && (
            <div className="mt-6 space-y-4">
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-card p-4 border-b">
                  <h3 className="font-medium">Answer</h3>
                </div>
                <ScrollArea className="h-[250px]">
                  <div className="p-4 whitespace-pre-line">
                    {searchResults.answer}
                  </div>
                </ScrollArea>
              </div>

              {searchResults.citations?.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-card p-4 border-b">
                    <h3 className="font-medium">Sources</h3>
                  </div>
                  <div className="p-4">
                    <div className="grid gap-2">
                      {searchResults.citations.map((citation, index) => (
                        <div key={index} className="flex items-center">
                          <ExternalLink className="h-4 w-4 mr-2 flex-shrink-0" />
                          <a 
                            href={citation}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline text-sm truncate"
                          >
                            {citation}
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {searchResults.related_questions?.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-card p-4 border-b">
                    <h3 className="font-medium">Related Questions</h3>
                  </div>
                  <div className="p-4">
                    <div className="grid gap-2">
                      {searchResults.related_questions.map((question, index) => (
                        <Button 
                          key={index} 
                          variant="outline" 
                          className="justify-start h-auto py-2 px-3"
                          onClick={() => {
                            setQuery(question);
                            mutate(question);
                          }}
                        >
                          <ThumbsUp className="h-4 w-4 mr-2" />
                          <span className="text-left">{question}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}