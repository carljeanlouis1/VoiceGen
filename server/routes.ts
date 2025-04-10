import type { Express } from "express";
import { createServer, type Server } from "http";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { storage } from "./storage";
import { textToSpeechSchema, MAX_CHUNK_SIZE } from "@shared/schema";
import { z } from "zod";
import { log } from "./vite";
import fetch from "node-fetch";

const openai = new OpenAI();
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY environment variable is required");
}

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error("ANTHROPIC_API_KEY environment variable is required");
}

async function generateSpeechChunks(text: string, voice: string) {
  const chunks = [];
  let currentIndex = 0;

  while (currentIndex < text.length) {
    // Find the last period or newline in the chunk to avoid cutting mid-sentence
    let chunkEnd = Math.min(currentIndex + MAX_CHUNK_SIZE, text.length);
    if (chunkEnd < text.length) {
      const lastPeriod = text.lastIndexOf('.', chunkEnd);
      const lastNewline = text.lastIndexOf('\n', chunkEnd);
      chunkEnd = Math.max(
        lastPeriod !== -1 ? lastPeriod + 1 : chunkEnd,
        lastNewline !== -1 ? lastNewline + 1 : chunkEnd
      );
    }

    const chunk = text.slice(currentIndex, chunkEnd);
    const speech = await openai.audio.speech.create({
      model: "tts-1",
      voice: voice as any,
      input: chunk.trim()
    });

    chunks.push(await speech.arrayBuffer());
    currentIndex = chunkEnd;
  }

  return Buffer.concat(chunks.map(chunk => Buffer.from(chunk)));
}

async function summarizeText(text: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
    messages: [
      {
        role: "system",
        content: "Create a concise, engaging 2-3 sentence summary of the following text that captures its essence."
      },
      { role: "user", content: text }
    ],
    max_tokens: 150
  });

  return response.choices[0].message.content || "";
}

async function generateArtwork(summary: string): Promise<string | undefined> {
  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt: `Create an abstract, minimalist representation that evokes the emotional essence of this concept, making sure to EXCLUDE ANY TEXT, NUMBERS, OR TYPOGRAPHY: ${summary}. Focus purely on abstract shapes, colors, and visual composition to create an elegant, modern design suitable for album artwork. The artwork should be completely free of any written elements, focusing entirely on visual symbolism and artistic expression.`,
    n: 1,
    size: "1024x1024",
    quality: "standard",
    response_format: "url"
  });

  return response.data[0]?.url || "";
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/text-to-speech", async (req, res) => {
    try {
      const data = textToSpeechSchema.parse(req.body);

      log(`Converting text to speech: ${data.title} (${data.text.length} characters)`);

      // Generate summary and artwork if requested
      let summary: string | undefined;
      let artworkUrl: string | undefined;

      if (data.generateArtwork) {
        log("Generating summary and artwork");
        summary = await summarizeText(data.text);
        artworkUrl = await generateArtwork(summary || "");
      }

      // Generate speech in chunks if needed
      log("Generating speech audio");
      const audioBuffer = await generateSpeechChunks(data.text, data.voice);
      const audioUrl = `data:audio/mp3;base64,${audioBuffer.toString('base64')}`;

      const audioFile = await storage.createAudioFile({
        title: data.title,
        text: data.text,
        voice: data.voice,
        audioUrl,
        duration: Math.ceil(audioBuffer.length / 16000), // Approximate duration
        summary,
        artworkUrl
      });

      log(`Audio file created: ${audioFile.id}`);
      res.json(audioFile);
    } catch (error: any) {
      log(`Error in text-to-speech: ${error.message}`);

      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0].message });
      } else if (error instanceof OpenAI.APIError) {
        res.status(error.status || 500).json({ 
          message: error.message || "OpenAI API error occurred"
        });
      } else {
        console.error("Unexpected error:", error);
        res.status(500).json({ 
          message: "An unexpected error occurred while converting text to speech"
        });
      }
    }
  });

  app.get("/api/library", async (_req, res) => {
    try {
      const files = await storage.getAudioFiles();
      res.json(files);
    } catch (error: any) {
      log(`Error fetching library: ${error.message || "Unknown error"}`);
      res.status(500).json({ message: "Failed to fetch library" });
    }
  });

  app.delete("/api/library/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteAudioFile(id);
      res.status(204).send();
    } catch (error: any) {
      log(`Error deleting audio file ${req.params.id}: ${error.message || "Unknown error"}`);
      res.status(500).json({ message: "Failed to delete audio file" });
    }
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const schema = z.object({
        messages: z.array(z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string()
        })),
        context: z.string()
      });

      const { messages, context } = schema.parse(req.body);

      // Convert messages to Claude format
      const claudeMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
      // Add system message with context
      const systemMessage = {
        role: "system" as const,
        content: `You are Claude Sonnet 3.7, an advanced AI assistant. You'll help analyze and discuss the following text content. Here's the context:\n\n${context}\n\nProvide detailed, thoughtful responses to questions about this content. Stay focused on the provided context.`
      };

      // Create Claude API request
      const response = await anthropic.messages.create({
        model: "claude-3-7-sonnet-20250219", // the newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
        max_tokens: 1000,
        temperature: 0.7,
        system: systemMessage.content,
        messages: claudeMessages
      });

      // Extract text content safely
      const responseText = response.content[0].type === 'text' 
        ? response.content[0].text 
        : "Sorry, I couldn't process that request properly.";
        
      res.json({ response: responseText });
    } catch (error: any) {
      log(`Error in chat endpoint: ${error.message || "Unknown error"}`);
      res.status(500).json({ message: "Failed to process chat request" });
    }
  });

  app.post("/api/search", async (req, res) => {
    try {
      const schema = z.object({
        query: z.string().min(1, "Query cannot be empty")
      });

      const { query } = schema.parse(req.body);
      
      // Check if Perplexity API key is available
      if (!process.env.PERPLEXITY_API_KEY) {
        throw new Error("PERPLEXITY_API_KEY environment variable is required");
      }

      const perplexityResponse = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.PERPLEXITY_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.1-sonar-small-128k-online",
          messages: [
            {
              role: "system",
              content: "You are a helpful assistant that provides accurate and detailed information. Be precise and concise."
            },
            {
              role: "user",
              content: query
            }
          ],
          temperature: 0.2,
          top_p: 0.9,
          max_tokens: 1000,
          stream: false,
          search_domain_filter: [],
          return_related_questions: true,
          search_recency_filter: "month"
        })
      });

      if (!perplexityResponse.ok) {
        const errorText = await perplexityResponse.text();
        throw new Error(`Perplexity API error: ${perplexityResponse.status} - ${errorText}`);
      }

      const data = await perplexityResponse.json();
      
      res.json({
        answer: data.choices[0].message.content,
        citations: data.citations || [],
        related_questions: data.related_questions || []
      });
    } catch (error: any) {
      log(`Error in search endpoint: ${error.message || "Unknown error"}`);
      
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0].message });
      } else {
        res.status(500).json({ message: error.message || "Failed to process search request" });
      }
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}