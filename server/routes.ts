import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { storage } from "./storage";
import { textToSpeechSchema, MAX_CHUNK_SIZE, AVAILABLE_VOICES } from "@shared/schema";
import { z } from "zod";
import { log } from "./vite";
import fetch from "node-fetch";
import path from "path";
import fs from "fs";

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

// Function to generate voice samples for all available voices
async function generateVoiceSamples() {
  const sampleDir = path.join(process.cwd(), 'public/samples');
  const sampleText = "This is a sample of what this voice sounds like. It can be used for text-to-speech conversion.";
  
  // Create samples directory if it doesn't exist
  if (!fs.existsSync(sampleDir)){
    fs.mkdirSync(sampleDir, { recursive: true });
  }
  
  // Generate samples for each voice
  for (const voice of AVAILABLE_VOICES) {
    const samplePath = path.join(sampleDir, `${voice}.mp3`);
    
    // Skip if sample already exists
    if (fs.existsSync(samplePath)) {
      log(`Sample for ${voice} voice already exists`);
      continue;
    }
    
    try {
      log(`Generating sample for ${voice} voice...`);
      const speech = await openai.audio.speech.create({
        model: "tts-1",
        voice: voice as any,
        input: sampleText
      });
      
      const buffer = Buffer.from(await speech.arrayBuffer());
      fs.writeFileSync(samplePath, buffer);
      log(`Voice sample for ${voice} created at ${samplePath}`);
    } catch (error: any) {
      log(`Error generating sample for ${voice}: ${error.message}`);
    }
  }
  
  log("Voice samples generation completed");
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Generate voice samples
  await generateVoiceSamples();
  
  // Create a dedicated API endpoint for voice samples
  app.get('/api/voice-samples/:voice', async (req: Request, res: Response) => {
    const voice = req.params.voice;
    if (!AVAILABLE_VOICES.includes(voice as any)) {
      return res.status(404).json({ error: 'Voice not found' });
    }
    
    const samplePath = path.join(process.cwd(), 'public/samples', `${voice}.mp3`);
    log(`Serving voice sample: ${samplePath}`);
    
    if (fs.existsSync(samplePath)) {
      // Read the file and serve it as a base64 data URL
      const audioBuffer = fs.readFileSync(samplePath);
      const audioBase64 = audioBuffer.toString('base64');
      const dataUrl = `data:audio/mp3;base64,${audioBase64}`;
      
      res.json({ 
        voice,
        audioUrl: dataUrl
      });
    } else {
      res.status(404).json({ error: 'Sample file not found' });
    }
  });
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
      
      // Log the query for debugging
      log(`Received search query: "${query}"`);
      
      // Use only Perplexity API for web search - no fallback
      try {
        // Check if Perplexity API key is available
        if (!process.env.PERPLEXITY_API_KEY) {
          log("PERPLEXITY_API_KEY environment variable is missing");
          throw new Error("PERPLEXITY_API_KEY is required for web search");
        }

        // Log API key prefix (first 5 chars) for debugging
        const apiKey = process.env.PERPLEXITY_API_KEY;
        log(`Using Perplexity API key starting with: ${apiKey.substring(0, 5)}...`);
      
        // Create request body exactly as in the documentation, with corrected parameters
        const requestBody = {
          model: "llama-3.1-sonar-small-128k-online", // Use Llama model for web search
          messages: [
            {
              role: "system",
              content: "You are a comprehensive web search assistant. Provide detailed, thorough answers with accurate and up-to-date information from the web. Include relevant context, explain complex topics clearly, and organize your response in a structured manner. Aim to be comprehensive while maintaining clarity."
            },
            {
              role: "user",
              content: query
            }
          ],
          max_tokens: 4000, // Increased to allow for longer, more detailed responses
          temperature: 0.2,
          top_p: 0.9,
          // Remove search_domain_filter since it's causing validation errors
          return_images: false,
          return_related_questions: true,
          search_recency_filter: "month",
          top_k: 0,
          stream: false,
          presence_penalty: 0,
          frequency_penalty: 1,
          web_search_options: { search_context_size: "high" }
        };
      
        log('Attempting request to Perplexity API with Llama 3.1 Sonar small model and web search...');
        const perplexityResponse = await fetch("https://api.perplexity.ai/chat/completions", {
          method: "POST",
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify(requestBody)
        });

        // Log response status
        log(`Perplexity API response status: ${perplexityResponse.status}`);
      
        // If there's an error, return it directly to the client without falling back
        if (!perplexityResponse.ok) {
          const errorText = await perplexityResponse.text();
          log(`Perplexity API error details: ${errorText.substring(0, 200)}...`);
          
          // Return error to client instead of throwing
          res.status(perplexityResponse.status).json({
            error: `Perplexity API error: ${perplexityResponse.status}`,
            message: `Failed to get web search results: ${errorText}`,
            query
          });
          return;
        }
        
        const data = await perplexityResponse.json();
        log('Successfully received response from Perplexity API');
        log(`Response data structure: ${Object.keys(data).join(', ')}`);
        
        // Full response logging for debugging (without any sensitive information)
        log(`Response data sample: ${JSON.stringify(data).substring(0, 300)}...`);
        
        // Extract content from the response
        let answer = "";
        let citations: string[] = [];
        let relatedQuestions: string[] = [];
        
        // Extract the answer from the response according to the Perplexity API format
        if (data.choices && data.choices.length > 0 && data.choices[0].message) {
          answer = data.choices[0].message.content || "";
          log(`Answer extracted (first 100 chars): ${answer.substring(0, 100)}...`);
        } else {
          log('No choices or message content in response');
          throw new Error("Unexpected Perplexity API response format: missing choices/message content");
        }
        
        // Extract citations if they exist in the correct format
        if (data.citations && Array.isArray(data.citations)) {
          citations = data.citations;
          log(`Found ${citations.length} citations`);
        } else if (data.links && Array.isArray(data.links)) {
          // Alternative format some APIs might use
          citations = data.links;
          log(`Found ${citations.length} links (alternative to citations)`);
        }
        
        // Extract related questions if they exist
        if (data.related_questions && Array.isArray(data.related_questions)) {
          relatedQuestions = data.related_questions;
          log(`Found ${relatedQuestions.length} related questions`);
        } else {
          // Generate some related questions based on the topic
          const queryWords = query.split(' ').filter(w => w.length > 3);
          if (queryWords.length > 0) {
            relatedQuestions = [
              `What's the history of ${queryWords[0]}?`,
              `How does ${queryWords[0]} impact society?`,
              `Latest developments in ${queryWords[0]}`
            ];
            log('Generated fallback related questions');
          }
        }
        
        res.json({
          answer,
          citations,
          related_questions: relatedQuestions
        });
      } catch (error: any) {
        // Log the error but don't fall back to Claude
        log(`Perplexity API error: ${error?.message || "Unknown error"}`);
        
        // Return a clear error message to the client
        res.status(500).json({
          error: "Web search failed",
          message: error?.message || "Failed to process web search request",
          query
        });
      }
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