import { TextToSpeechForm } from "@/components/text-to-speech-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Sparkles, MessageSquare, Headphones, Search } from "lucide-react";

export default function Home() {
  return (
    <div className="container max-w-4xl py-8 space-y-8">
      <div className="text-center mb-6">
        <h1 className="text-4xl font-bold mb-2">VoiceGen</h1>
        <p className="text-lg text-muted-foreground">Advanced AI-powered multimedia tools</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center">
              <Headphones className="h-5 w-5 mr-2 text-primary" />
              <CardTitle className="text-xl">Text to Speech</CardTitle>
            </div>
            <CardDescription>
              Convert text to natural-sounding speech with various voices and languages
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <p className="text-sm text-muted-foreground mb-4">
              Transform your text into natural-sounding audio with customizable voice options.
            </p>
            <Link href="/convert">
              <Button className="w-full">Convert Text to Speech</Button>
            </Link>
          </CardContent>
        </Card>
        
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center">
              <Sparkles className="h-5 w-5 mr-2 text-primary" />
              <CardTitle className="text-xl">Content Creator</CardTitle>
            </div>
            <CardDescription>
              Generate content using Gemini 2.5 Pro AI
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <p className="text-sm text-muted-foreground mb-4">
              Use Gemini 2.5 Pro to create stories, articles, marketing content, and more with text and image inputs.
            </p>
            <Link href="/create">
              <Button className="w-full">Create Content</Button>
            </Link>
          </CardContent>
        </Card>
        
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center">
              <MessageSquare className="h-5 w-5 mr-2 text-primary" />
              <CardTitle className="text-xl">AI Chat</CardTitle>
            </div>
            <CardDescription>
              Chat with Claude 3.7 Sonnet or GPT-4o
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <p className="text-sm text-muted-foreground mb-4">
              Have intelligent conversations with leading AI models for research, creative writing, and problem-solving.
            </p>
            <Link href="/chat">
              <Button className="w-full">Start Chatting</Button>
            </Link>
          </CardContent>
        </Card>
        
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center">
              <Search className="h-5 w-5 mr-2 text-primary" />
              <CardTitle className="text-xl">Web Search</CardTitle>
            </div>
            <CardDescription>
              Search the web using Llama 3.1 Sonar
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <p className="text-sm text-muted-foreground mb-4">
              Get comprehensive, up-to-date answers to your questions with web-enhanced AI search.
            </p>
            <Link href="/search">
              <Button className="w-full">Search the Web</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
      
      <Card className="card-gradient shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Quick Convert: Text to Speech</CardTitle>
        </CardHeader>
        <CardContent>
          <TextToSpeechForm
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ["/api/library"] });
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}