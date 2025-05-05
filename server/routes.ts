import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import { storage } from "./storage";
import { 
  textToSpeechSchema, 
  MAX_CHUNK_SIZE, 
  AVAILABLE_VOICES, 
  contentPlanSchema,
  ContentPlan,
  ContentPlanSubtopic
} from "@shared/schema";
import { z } from "zod";
import { log } from "./vite";
import fetch from "node-fetch";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { generateGeminiContent, initGeminiClient } from "./gemini-client";

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

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY environment variable is required");
}

// Audio directory for file storage
const AUDIO_DIR = path.join(process.cwd(), 'public/audio');

// Create audio directory if it doesn't exist
if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

// Maximum allowed text length (approximately 60 minutes of audio)
const MAX_TEXT_LENGTH = 100000;

// Holds in-memory processing state for each job
const processingJobs = new Map<number, {
  id: number;
  status: 'processing' | 'complete' | 'error';
  progress: number;
  totalChunks: number;
  audioFilePath?: string; // Path to the stored audio file instead of storing in memory
  audioUrl?: string;      // URL for client to access the audio
  error?: string;
}>();

// Generate unique job IDs
let nextJobId = 1;

async function generateSpeechChunks(text: string, voice: string, onProgress?: (progress: number) => void) {
  const chunks = [];
  let currentIndex = 0;
  const totalLength = text.length;
  
  log(`Starting speech generation for ${totalLength} characters with voice ${voice}`);
  
  // Initial progress report
  if (onProgress) {
    log('Reporting initial 0% progress');
    onProgress(0);
  }
  
  try {
    // Process text in chunks
    while (currentIndex < totalLength) {
      // Find a good breaking point for the chunk
      let chunkEnd = Math.min(currentIndex + MAX_CHUNK_SIZE, totalLength);
      
      // Try to find sentence breaks if not at the end
      if (chunkEnd < totalLength) {
        // Search backwards from chunkEnd to find a good breaking point
        const searchWindow = text.substring(currentIndex, chunkEnd);
        
        // Find the last sentence break in the window
        const lastPeriodPos = searchWindow.lastIndexOf('.');
        const lastNewlinePos = searchWindow.lastIndexOf('\n');
        const lastQuestionPos = searchWindow.lastIndexOf('?');
        const lastExclamationPos = searchWindow.lastIndexOf('!');
        const lastSemicolonPos = searchWindow.lastIndexOf(';');
        
        // Get the positions relative to currentIndex
        const sentenceBreaks = [
          lastPeriodPos, 
          lastNewlinePos, 
          lastQuestionPos, 
          lastExclamationPos,
          lastSemicolonPos
        ].filter(pos => pos !== -1);
        
        // If we found any sentence breaks, use the last one
        if (sentenceBreaks.length > 0) {
          // Get the position of the last break and add 1 to include the punctuation
          const lastBreakPos = Math.max(...sentenceBreaks);
          chunkEnd = currentIndex + lastBreakPos + 1;
          log(`Found sentence break at position ${chunkEnd}`);
        } else {
          // Fallback: Try to break at a word boundary
          const lastSpacePos = searchWindow.lastIndexOf(' ');
          if (lastSpacePos !== -1 && lastSpacePos > searchWindow.length / 2) {
            chunkEnd = currentIndex + lastSpacePos + 1;
            log(`No sentence break found, using word boundary at ${chunkEnd}`);
          } else {
            // If all else fails, use at least 1000 chars or the max chunk size
            chunkEnd = currentIndex + Math.min(1000, MAX_CHUNK_SIZE);
            log(`No good breaks found, using minimum chunk size ending at ${chunkEnd}`);
          }
        }
      }

      // Extract the chunk and process it
      const chunk = text.slice(currentIndex, chunkEnd);
      log(`Processing chunk ${chunks.length + 1}: ${chunk.length} characters (${currentIndex} to ${chunkEnd})`);
      
      try {
        // Attempt to generate speech for this chunk
        const speech = await openai.audio.speech.create({
          model: "tts-1",
          voice: voice as any,
          input: chunk.trim()
        });

        // Store the generated audio
        const buffer = Buffer.from(await speech.arrayBuffer());
        chunks.push(buffer);
        
        // Update the current position
        currentIndex = chunkEnd;
        
        // Calculate and report progress
        const progress = Math.floor((currentIndex / totalLength) * 100);
        log(`Progress update: ${progress}% (${currentIndex}/${totalLength} characters processed)`);
        
        // Report progress to callback if provided
        if (onProgress) {
          log(`Calling onProgress with ${progress}%`);
          onProgress(progress);
        }
      } catch (error: any) {
        log(`Error processing chunk: ${error.message}`);
        throw new Error(`Failed to process text chunk: ${error.message}`);
      }
    }

    // Combine all chunks into a single audio buffer
    const result = Buffer.concat(chunks);
    log(`Speech generation complete: ${result.length} bytes`);
    
    // Final progress report
    if (onProgress) {
      log('Reporting final 100% progress');
      onProgress(100);
    }
    
    return result;
  } catch (error: any) {
    log(`Error in generateSpeechChunks: ${error.message}`);
    throw error;
  }
}

// Process long text in the background
async function startBackgroundProcessing(data: any): Promise<number> {
  const jobId = nextJobId++;
  
  // Enforce maximum text length limit
  if (data.text.length > MAX_TEXT_LENGTH) {
    throw new Error(`Text is too long (${data.text.length} characters). Maximum allowed is ${MAX_TEXT_LENGTH} characters.`);
  }
  
  // Generate a unique filename for this job
  const uniqueId = crypto.randomBytes(8).toString('hex');
  const audioFilename = `${uniqueId}.mp3`;
  const audioFilePath = path.join(AUDIO_DIR, audioFilename);
  
  // Initialize job state
  processingJobs.set(jobId, {
    id: jobId,
    status: 'processing',
    progress: 0,
    totalChunks: Math.ceil(data.text.length / MAX_CHUNK_SIZE),
    audioFilePath
  });
  
  // Start processing in the background
  (async () => {
    try {
      log(`Starting background job #${jobId} for ${data.text.length} characters, output file: ${audioFilePath}`);
      
      // Generate optional summary and artwork if requested
      let summary: string | undefined;
      let artworkUrl: string | undefined;

      if (data.generateArtwork) {
        log(`Job #${jobId}: Generating summary and artwork`);
        summary = await summarizeText(data.text);
        artworkUrl = await generateArtwork(summary || "");
      }
      
      // Process audio chunks with progress tracking
      const audioBuffer = await generateSpeechChunks(
        data.text, 
        data.voice,
        (progress) => {
          const job = processingJobs.get(jobId);
          if (job) {
            job.progress = progress;
            processingJobs.set(jobId, job);
          }
        }
      );

      // For very large files, use streams to write instead of fs.writeFileSync
      let audioUrl = `/api/audio/${uniqueId}.mp3`; // Define here to avoid TypeScript errors
      
      try {
        // Get the size of the audio buffer for logging
        const bufferSize = audioBuffer.length;
        log(`Writing audio buffer (${bufferSize} bytes, ~${Math.ceil(bufferSize/1024/1024)}MB) to file: ${audioFilePath}`);
        
        // Create a write stream with sensible options for large files
        const writeStream = fs.createWriteStream(audioFilePath, {
          flags: 'w',
          encoding: 'binary',
          highWaterMark: 1024 * 1024 // 1MB chunks for writing
        });
        
        // Set up event handlers for the write stream
        writeStream.on('error', (err) => {
          log(`Error writing audio file: ${err.message}`);
          throw new Error(`Failed to write audio file: ${err.message}`);
        });
        
        // Write the buffer to the file using a promise
        await new Promise<void>((resolve, reject) => {
          writeStream.write(audioBuffer, (err) => {
            if (err) {
              log(`Error during write: ${err.message}`);
              reject(err);
              return;
            }
            
            writeStream.end(() => {
              log(`Audio file successfully written to: ${audioFilePath}`);
              resolve();
            });
          });
          
          writeStream.on('error', reject);
        });
        
        // Verify the file was written correctly
        if (!fs.existsSync(audioFilePath)) {
          throw new Error(`File was not created: ${audioFilePath}`);
        }
        
        const stats = fs.statSync(audioFilePath);
        log(`File ${audioFilePath} written successfully: ${stats.size} bytes`);
        
        // Save to storage with improved duration calculation
        const audioFile = await storage.createAudioFile({
          title: data.title,
          text: data.text,
          voice: data.voice,
          audioUrl,
          duration: Math.ceil(bufferSize / 24000), // Better estimate for MP3 duration at 192kbps (24KB/s)
          summary,
          artworkUrl
        });
        
        // Update job with completion info
        const job = processingJobs.get(jobId);
        if (job) {
          job.status = 'complete';
          job.progress = 100;
          job.audioUrl = audioUrl;
          job.audioFilePath = audioFilePath;
          processingJobs.set(jobId, job);
        }
        
        log(`Background job #${jobId} completed successfully with audio ID: ${audioFile.id}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log(`Error saving audio file: ${errorMessage}`);
        
        // Update job with error info
        const job = processingJobs.get(jobId);
        if (job) {
          job.status = 'error';
          job.error = errorMessage;
          processingJobs.set(jobId, job);
        }
        
        throw error;
      }
    } catch (error: any) {
      log(`Error in background job #${jobId}: ${error.message}`);
      
      const job = processingJobs.get(jobId);
      if (job) {
        job.status = 'error';
        job.error = error.message;
        processingJobs.set(jobId, job);
      }
    }
  })();
  
  return jobId;
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

// Schema for Gemini content generation request
const geminiContentSchema = z.object({
  prompt: z.string(),
  systemPrompt: z.string().optional(),
  temperature: z.number().min(0).max(1).default(0.7).optional(),
  maxOutputTokens: z.number().min(1).max(8192).default(4000).optional(),
  images: z.array(z.string()).optional(), // Base64-encoded images
});

// Schema for podcast script generation request
const podcastScriptSchema = z.object({
  topic: z.string().min(1, "Topic is required"),
  targetDuration: z.number().min(1).max(60).default(5), // Target duration in minutes
  model: z.enum(["claude", "gpt"]).default("gpt"), // AI model to use for script generation
  part: z.number().min(1).optional(), // For multi-part scripts
  totalParts: z.number().min(1).optional(), // Total parts for longer scripts
  previousPartContent: z.string().optional(), // End of previous part for continuity
  searchResults: z.string().optional(), // Pre-fetched search results (optional)
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize Gemini client
  log("Initializing Gemini client...");
  initGeminiClient();
  
  // Generate voice samples
  await generateVoiceSamples();
  
  // Endpoint for Gemini content generation
  app.post("/api/gemini/generate", async (req, res) => {
    try {
      const data = geminiContentSchema.parse(req.body);
      
      log(`Generating content with Gemini: ${data.prompt.substring(0, 100)}...`);
      
      try {
        const result = await generateGeminiContent({
          prompt: data.prompt,
          systemPrompt: data.systemPrompt,
          temperature: data.temperature,
          maxOutputTokens: data.maxOutputTokens,
          images: data.images,
        });
        
        // Check if we got an empty response from Gemini
        if (!result.text || result.text.trim() === "") {
          log("Empty response detected from Gemini in /api/gemini/generate");
          result.text = "I apologize, but I wasn't able to generate a response for that query. This might be due to content safety filters or limitations in my training data. Could you try rephrasing your request?";
        }
        
        res.json(result);
      } catch (error: any) {
        log(`Error in Gemini content generation: ${error.message}`);
        res.status(500).json({ error: error.message || "Failed to generate content" });
      }
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors[0].message });
      } else {
        res.status(500).json({ error: "An unexpected error occurred" });
      }
    }
  });
  
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
  // Endpoint to process text-to-speech requests
  app.post("/api/text-to-speech", async (req, res) => {
    try {
      const data = textToSpeechSchema.parse(req.body);
      const textLength = data.text.length;

      log(`Converting text to speech: ${data.title} (${textLength} characters)`);
      
      // Validate text length
      if (textLength > MAX_TEXT_LENGTH) {
        return res.status(400).json({ 
          message: `Text is too long (${textLength} characters). Maximum allowed is ${MAX_TEXT_LENGTH} characters.`,
          exceededLimit: true,
          currentLength: textLength,
          maxLength: MAX_TEXT_LENGTH
        });
      }

      // For short texts (under 5000 chars), process synchronously 
      if (textLength <= 5000) {
        // Generate summary and artwork if requested
        let summary: string | undefined;
        let artworkUrl: string | undefined;

        if (data.generateArtwork) {
          log("Generating summary and artwork");
          summary = await summarizeText(data.text);
          artworkUrl = await generateArtwork(summary || "");
        }

        // Generate speech in chunks if needed
        log("Generating speech audio (synchronous mode)");
        const audioBuffer = await generateSpeechChunks(data.text, data.voice);
        const audioUrl = `data:audio/mp3;base64,${audioBuffer.toString('base64')}`;

        const audioFile = await storage.createAudioFile({
          title: data.title,
          text: data.text,
          voice: data.voice,
          audioUrl,
          duration: Math.ceil(audioBuffer.length / 32000), // Better estimate for MP3 duration at 128kbps (16KB/s)
          summary,
          artworkUrl
        });

        log(`Audio file created: ${audioFile.id}`);
        res.json(audioFile);
      } 
      // For longer texts, use background processing with file storage
      else {
        log(`Text length ${textLength} exceeds threshold, using background processing with file storage`);
        
        try {
          // Start background job and return job ID
          const jobId = await startBackgroundProcessing(data);
          
          res.json({
            id: jobId,
            title: data.title,
            status: 'processing',
            progress: 0,
            estimatedDuration: Math.ceil(textLength / 25), // Rough estimate of seconds
            message: `Processing ${textLength} characters in the background`
          });
        } catch (bgError: any) {
          log(`Error starting background processing: ${bgError.message}`);
          res.status(500).json({ 
            message: bgError.message || "Failed to start background processing",
            error: true
          });
        }
      }
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
  
  // Endpoint to serve audio files from disk
  app.get("/api/audio/:filename", async (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(AUDIO_DIR, filename);
    
    log(`Audio file request: ${filename} (looking at path: ${filePath})`);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      log(`Audio file not found: ${filePath}`);
      return res.status(404).json({ error: "Audio file not found", path: filePath });
    }
    
    try {
      // Get file stats for Content-Length and duration estimation
      const stats = fs.statSync(filePath);
      const fileSize = stats.size;
      
      log(`Audio file found: ${filePath} (${fileSize} bytes, ~${Math.ceil(fileSize / 1024 / 1024)}MB)`);
      
      // Handle range requests for better seeking support
      const range = req.headers.range;
      
      // Estimate audio duration based on file size (rough approximation)
      // Use higher bitrate estimate for better accuracy with larger files
      const estimatedDuration = Math.ceil(fileSize / 24000); // ~24KB per second at 192kbps
      
      if (range) {
        log(`Range request received: ${range}`);
        // Handle range requests for better seeking support
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunkSize = (end - start) + 1;
        
        log(`Serving range: ${start}-${end}/${fileSize} (${chunkSize} bytes)`);
        
        // Set partial content headers
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Length', chunkSize);
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('X-Audio-Duration', estimatedDuration);
        // Add Cache-Control header to prevent browser caching issues during seeking
        res.setHeader('Cache-Control', 'no-cache, no-store');
        // Allow browser controls to properly seek
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', 'Range');
        
        // Stream the file slice with error handling
        const fileStream = fs.createReadStream(filePath, { 
          start, 
          end,
          highWaterMark: 64 * 1024 // 64KB chunks for better memory management
        });
        
        // Handle streaming errors
        fileStream.on('error', (err) => {
          log(`Stream error for range request: ${err.message}`);
          if (!res.headersSent) {
            res.status(500).json({ error: "Error streaming file", message: err.message });
          }
        });
        
        fileStream.pipe(res);
      } else {
        log(`Serving full file: ${filePath} (${fileSize} bytes)`);
        
        // Handle normal requests
        // Set appropriate headers
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Length', fileSize);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('X-Audio-Duration', estimatedDuration); // Custom header for clients
        
        // Optimize caching based on request type
        if (req.query.download) {
          // For downloads, use no-cache to ensure fresh content
          res.setHeader('Cache-Control', 'no-cache, must-revalidate');
          res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        } else {
          // For normal playback, disable caching for large files
          res.setHeader('Cache-Control', 'no-cache, no-store');
          res.setHeader('Content-Disposition', `inline; filename=${filename}`);
        }
        
        // Add CORS headers for better player compatibility
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', 'Range');
        
        // Stream the file in chunks instead of loading it all into memory
        const fileStream = fs.createReadStream(filePath, {
          // Use a reasonable high water mark for large files
          highWaterMark: 64 * 1024 // 64KB chunks
        });
        
        // Handle streaming errors
        fileStream.on('error', (err) => {
          log(`Stream error for full file: ${err.message}`);
          if (!res.headersSent) {
            res.status(500).json({ error: "Error streaming file", message: err.message });
          }
        });
        
        // Handle unexpected connection closes
        res.on('close', () => {
          log(`Connection closed for ${filename}`);
          fileStream.destroy();
        });
        
        fileStream.pipe(res);
      }
    } catch (error: any) {
      log(`Error serving audio file ${filename}: ${error.message}`);
      res.status(500).json({ 
        error: "Failed to serve audio file",
        message: error.message,
        path: filePath
      });
    }
  });

  // Endpoint to check job status
  app.get("/api/text-to-speech/status/:jobId", (req, res) => {
    const jobId = parseInt(req.params.jobId);
    
    if (isNaN(jobId)) {
      return res.status(400).json({ message: "Invalid job ID" });
    }
    
    const job = processingJobs.get(jobId);
    
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }
    
    // Return job status
    res.json({
      id: job.id,
      status: job.status,
      progress: job.progress,
      error: job.error,
      audioUrl: job.status === 'complete' ? job.audioUrl : undefined
    });
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
          role: z.enum(["user", "assistant", "system"]),
          content: z.string()
        })),
        context: z.string().optional().default(""),
        model: z.enum(["claude", "gpt", "gemini"]).default("claude"),
        useContext: z.boolean().default(true)
      });

      const { messages, context, model, useContext } = schema.parse(req.body);
      
      // Log the request details
      log(`Chat request: model=${model}, useContext=${useContext}, context length=${context?.length || 0}, messages=${messages.length}`);
      
      let responseText = "";
      
      // Handle Claude 3.7 Sonnet requests
      if (model === "claude") {
        // Convert messages to Claude format, but exclude any system messages as we'll set that separately
        const claudeMessages: MessageParam[] = messages
          .filter(msg => msg.role !== "system")
          .map(msg => ({
            role: msg.role === "user" ? "user" : "assistant",
            content: msg.content
          }));
        
        // Create appropriate system message based on whether context is used
        let systemContent = "";
        if (useContext && context) {
          systemContent = `You are Claude Sonnet 3.7, an advanced AI assistant. You'll help analyze and discuss the following text content. Here's the context:\n\n${context}\n\nProvide detailed, thoughtful responses to questions about this content. Stay focused on the provided context.`;
        } else {
          systemContent = "You are Claude Sonnet 3.7, an advanced AI assistant. Provide helpful, detailed, and thoughtful responses to the user's questions.";
        }
        
        // Create Claude API request
        const response = await anthropic.messages.create({
          model: "claude-3-7-sonnet-20250219", // the newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
          max_tokens: 1000,
          temperature: 0.7,
          system: systemContent,
          messages: claudeMessages
        });

        // Extract text content safely
        responseText = response.content[0].type === 'text' 
          ? response.content[0].text 
          : "Sorry, I couldn't process that request properly.";
      } 
      // Handle GPT-4o requests
      else if (model === "gpt") {
        // Format messages for OpenAI
        let openaiMessages = [...messages]; // Start with the user's messages
        
        // Add context as system message if needed
        if (useContext && context) {
          // If the first message is already a system message, update it
          if (openaiMessages.length > 0 && openaiMessages[0].role === "system") {
            openaiMessages[0].content = `You are GPT-4o, an advanced AI assistant. You'll help analyze and discuss the following text content. Here's the context:\n\n${context}\n\nProvide detailed, thoughtful responses to questions about this content. Stay focused on the provided context.`;
          } else {
            // Otherwise, add a new system message at the beginning
            openaiMessages.unshift({
              role: "system",
              content: `You are GPT-4o, an advanced AI assistant. You'll help analyze and discuss the following text content. Here's the context:\n\n${context}\n\nProvide detailed, thoughtful responses to questions about this content. Stay focused on the provided context.`
            });
          }
        } else if (!openaiMessages.some(msg => msg.role === "system")) {
          // If no context and no system message exists, add a general one
          openaiMessages.unshift({
            role: "system",
            content: "You are GPT-4o, an advanced AI assistant. Provide helpful, detailed, and thoughtful responses to the user's questions."
          });
        }
        
        // Create OpenAI API request
        const response = await openai.chat.completions.create({
          model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
          messages: openaiMessages,
          max_tokens: 1000,
          temperature: 0.7
        });

        // Extract the response content
        responseText = response.choices[0].message.content || "Sorry, I couldn't process that request properly.";
      }
      // Handle Gemini 2.5 Pro requests
      else if (model === "gemini") {
        try {
          log("Processing Gemini chat request");
          
          // Extract user messages and build chat history
          const chatMessages = messages.filter(msg => msg.role !== "system");
          const lastUserMessage = chatMessages.filter(msg => msg.role === "user").pop()?.content || "";
          
          // Determine system prompt
          let systemPrompt = "";
          
          // Extract system message if it exists
          const systemMessage = messages.find(msg => msg.role === "system");
          if (systemMessage) {
            systemPrompt = systemMessage.content;
          }
          
          // If using context, override with context-specific system prompt
          if (useContext && context) {
            systemPrompt = `You are Gemini 2.5 Pro, an advanced AI assistant. You'll help analyze and discuss the following text content. Here's the context:\n\n${context}\n\nProvide detailed, thoughtful responses to questions about this content. Stay focused on the provided context.`;
          } else if (!systemPrompt) {
            // Default system prompt
            systemPrompt = "You are Gemini 2.5 Pro, an advanced AI assistant. Provide helpful, detailed, and thoughtful responses to the user's questions.";
          }
          
          log(`Gemini: Using system prompt (${systemPrompt.length} chars) and user message: ${lastUserMessage.substring(0, 100)}...`);
          
          // Generate content with Gemini
          const result = await generateGeminiContent({
            prompt: lastUserMessage,
            systemPrompt: systemPrompt,
            temperature: 0.7,
            maxOutputTokens: 1000
          });
          
          responseText = result.text;
          
          // Additional check to ensure we don't return empty responses to the client
          if (!responseText || responseText.trim() === "") {
            log("Empty response detected from Gemini in routes.ts");
            responseText = "I apologize, but I wasn't able to generate a response for that query. This might be due to content safety filters or limitations in my training. Could you try rephrasing your question?";
          }
          
          log(`Gemini response generated (${responseText.length} chars)`);
        } catch (geminiError: any) {
          log(`Error in Gemini chat: ${geminiError.message}`);
          throw new Error(`Gemini API error: ${geminiError.message}`);
        }
      }
      
      // Return the response to the client
      res.json({ 
        response: responseText,
        model: model
      });
    } catch (error: any) {
      log(`Error in chat endpoint: ${error.message || "Unknown error"}`);
      res.status(500).json({ 
        message: error.message || "Failed to process chat request",
        error: error.toString()
      });
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
          model: "sonar-pro", // Upgraded to Pro model for more powerful search
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
          max_tokens: 4000,
          temperature: 0.2,
          top_p: 0.9,
          return_images: false,
          return_related_questions: true,
          search_recency_filter: "month",
          top_k: 0,
          stream: false,
          presence_penalty: 0,
          frequency_penalty: 1,
          web_search_options: { 
            search_context_size: "high",
            search_depth: "deep" // Add deeper search for more comprehensive results
          }
        };
      
        log('Attempting request to Perplexity API with sonar-pro model and web search...');
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

  // Endpoint for podcast content planning
  app.post("/api/podcast/plan", async (req, res) => {
    try {
      const { topic, targetDuration, researchDepth } = contentPlanSchema.parse(req.body);
      log(`Generating content plan for "${topic}" (${targetDuration} minutes) with research depth ${researchDepth}`);

      // Use Claude 3.7 for planning - it has better structure understanding
      const response = await anthropic.messages.create({
        model: "claude-3-7-sonnet-20250219",
        max_tokens: 2000,
        temperature: 0.7,
        system: `You are an expert podcast producer and content strategist. Create a comprehensive content plan for a ${targetDuration}-minute podcast on the provided topic.

The content plan should:
1. Identify ${researchDepth} distinct but related subtopics that form a cohesive narrative
2. Create a clear narrative arc with smooth transitions between subtopics
3. Include guidelines for maintaining consistent tone and style
4. Specify an engaging introduction and conclusion
5. Estimate the appropriate time allocation for each subtopic

Your output should be a structured JSON object containing:
- topic: The main podcast topic
- targetDuration: Total podcast duration in minutes  
- subtopics: Array of subtopics, each with:
  - title: Clear title for the subtopic
  - key_points: 3-5 key points to cover
  - research_prompt: A specific research prompt for this subtopic
  - estimated_duration: Estimated minutes for this section
- narrative_arc: Overall story arc description
- tone_guidelines: Guidelines for maintaining consistent tone
- transitions: Array of smooth transitions between subtopics
- introduction: Brief description of the introduction approach
- conclusion: Brief description of the conclusion approach`,
        messages: [
          { role: "user", content: `Create a content plan for a ${targetDuration}-minute podcast on: ${topic}` }
        ]
      });

      const planText = response.content[0].type === 'text' 
        ? response.content[0].text 
        : "";
      
      // Extract JSON from the response (handle markdown code blocks)
      const jsonMatch = planText.match(/```json\n([\s\S]*?)\n```/) || planText.match(/```\n([\s\S]*?)\n```/);
      let contentPlan;
      
      try {
        contentPlan = jsonMatch ? JSON.parse(jsonMatch[1]) : JSON.parse(planText);
      } catch (parseError) {
        // If JSON parsing fails, extract structured content manually
        log(`JSON parsing failed: ${parseError.message}. Attempting to extract structured content.`);
        contentPlan = extractStructuredContent(planText);
      }
      
      res.json(contentPlan);
    } catch (error: any) {
      log(`Error generating content plan: ${error.message}`);
      res.status(500).json({ 
        message: error.message || "Failed to generate content plan",
        error: true
      });
    }
  });
  
  // Helper function to extract structured content if JSON parsing fails
  function extractStructuredContent(text: string): ContentPlan {
    // Default structure
    const plan: ContentPlan = {
      topic: "",
      targetDuration: 0,
      subtopics: [],
      narrative_arc: "",
      tone_guidelines: "",
      transitions: [],
      introduction: "",
      conclusion: ""
    };

    // Extract topic and duration from text
    const topicMatch = text.match(/topic[:\s]+["']?([^"'\n]+)["']?/i);
    if (topicMatch) plan.topic = topicMatch[1].trim();
    
    const durationMatch = text.match(/target\s*duration[:\s]+(\d+)/i);
    if (durationMatch) plan.targetDuration = parseInt(durationMatch[1]);
    
    // Extract subtopics
    const subtopicsSection = text.split(/subtopics[:\s]+/i)[1]?.split(/narrative_arc|tone_guidelines/i)[0];
    if (subtopicsSection) {
      const subtopicMatches = subtopicsSection.match(/[0-9]+\.\s+(.+?)(?=[0-9]+\.\s+|$)/gs);
      if (subtopicMatches) {
        plan.subtopics = subtopicMatches.map(match => {
          const title = match.match(/[0-9]+\.\s+(.+?)[\n\r]/)?.[1]?.trim() || "Untitled Subtopic";
          const keyPointsText = match.match(/key\s*points[:\s]+([\s\S]+?)(?=research|estimated|$)/i)?.[1] || "";
          const keyPoints = keyPointsText.split(/[-•*]\s+/).filter(Boolean).map(p => p.trim());
          
          const researchPrompt = match.match(/research\s*prompt[:\s]+(.+?)(?=estimated|$)/i)?.[1]?.trim() || "";
          const estimatedDuration = parseInt(match.match(/estimated\s*duration[:\s]+(\d+)/i)?.[1] || "5");
          
          return {
            title,
            key_points: keyPoints,
            research_prompt: researchPrompt,
            estimated_duration: estimatedDuration
          };
        });
      }
    }
    
    // Extract other elements
    const narrativeMatch = text.match(/narrative\s*arc[:\s]+(.+?)(?=tone|transitions|introduction|conclusion|$)/is);
    if (narrativeMatch) plan.narrative_arc = narrativeMatch[1].trim();
    
    const toneMatch = text.match(/tone\s*guidelines[:\s]+(.+?)(?=transitions|narrative|introduction|conclusion|$)/is);
    if (toneMatch) plan.tone_guidelines = toneMatch[1].trim();
    
    const introMatch = text.match(/introduction[:\s]+(.+?)(?=transitions|narrative|tone|conclusion|$)/is);
    if (introMatch) plan.introduction = introMatch[1].trim();
    
    const conclusionMatch = text.match(/conclusion[:\s]+(.+?)(?=transitions|narrative|tone|introduction|$)/is);
    if (conclusionMatch) plan.conclusion = conclusionMatch[1].trim();
    
    // Extract transitions
    const transitionsText = text.match(/transitions[:\s]+([\s\S]+?)(?=introduction|conclusion|$)/i)?.[1] || "";
    plan.transitions = transitionsText.split(/[0-9]+\.\s+/).filter(Boolean).map(t => t.trim());
    
    return plan;
  }
  
  // Endpoint for podcast script research and generation
  app.post("/api/podcast/research", async (req, res) => {
    try {
      const data = podcastScriptSchema.parse(req.body);
      log(`Starting podcast research for topic: "${data.topic}"`);
      
      // If we have a content plan and subtopic index, use targeted research
      if (data.contentPlan && data.subtopicIndex !== undefined) {
        const plan = data.contentPlan;
        const subtopic = plan.subtopics[data.subtopicIndex];
        
        log(`Researching subtopic ${data.subtopicIndex + 1}/${plan.subtopics.length}: "${subtopic.title}"`);
        
        try {
          // Check if Perplexity API key is available
          if (!process.env.PERPLEXITY_API_KEY) {
            throw new Error("PERPLEXITY_API_KEY is required for podcast research");
          }

          const apiKey = process.env.PERPLEXITY_API_KEY;
          
          // Use the subtopic-specific research prompt
          const researchQuery = subtopic.research_prompt || `Comprehensive research on ${subtopic.title} for ${data.topic}`;
          
          // Create request body for Perplexity API
          const requestBody = {
            model: "sonar-pro", 
            messages: [
              {
                role: "system",
                content: "You are a comprehensive research assistant. Provide detailed, thorough, factual information from reliable sources. Include relevant data, expert opinions, statistics, and historical context. Focus on accuracy and depth of information."
              },
              {
                role: "user",
                content: researchQuery
              }
            ],
            max_tokens: 4000,
            temperature: 0.2,
            top_p: 0.9,
            return_images: false,
            return_related_questions: true,
            search_recency_filter: "month",
            top_k: 0,
            stream: false,
            presence_penalty: 0,
            frequency_penalty: 1,
            web_search_options: { 
              search_context_size: "high",
              search_depth: "deep"
            }
          };
        
          log('Sending targeted research request to Perplexity API for subtopic...');
          const perplexityResponse = await fetch("https://api.perplexity.ai/chat/completions", {
            method: "POST",
            headers: {
              "Accept": "application/json",
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody)
          });
          
          // Check for API errors
          if (!perplexityResponse.ok) {
            const errorText = await perplexityResponse.text();
            log(`Perplexity API error details: ${errorText.substring(0, 200)}...`);
            throw new Error(`Failed to get research results: ${perplexityResponse.status}`);
          }
          
          // Parse API response
          const researchData = await perplexityResponse.json();
          
          // Extract content
          let searchResults = "";
          let citations: string[] = [];
          
          if (researchData.choices && researchData.choices.length > 0 && researchData.choices[0].message) {
            searchResults = researchData.choices[0].message.content || "";
            log(`Research data received (${searchResults.length} chars)`);
          } else {
            throw new Error("Unexpected Perplexity API response format");
          }
          
          // Extract citations
          if (researchData.citations && Array.isArray(researchData.citations)) {
            citations = researchData.citations;
            log(`Found ${citations.length} citations`);
            
            // Add citations to research results
            searchResults += "\n\nSources:\n" + citations.join("\n");
          }
          
          // Now proceed to script generation with the research results using the content plan
          return await generatePodcastScriptWithPlan(data, searchResults, plan, data.subtopicIndex, res);
          
        } catch (error: any) {
          log(`Research error: ${error?.message || "Unknown error"}`);
          res.status(500).json({
            error: "Research failed",
            message: error?.message || "Failed to complete podcast research",
          });
        }
      }
      // Fall back to existing implementation for regular podcast generation
      else if (!data.searchResults) {
        try {
          // Check if Perplexity API key is available
          if (!process.env.PERPLEXITY_API_KEY) {
            log("PERPLEXITY_API_KEY environment variable is missing");
            throw new Error("PERPLEXITY_API_KEY is required for podcast research");
          }

          const apiKey = process.env.PERPLEXITY_API_KEY;
          
          // Create research query based on topic and target duration
          const researchQuery = `Comprehensive research on: ${data.topic}. Include latest facts, trends, history, expert opinions, statistics, and impact.`;
          
          // Create request body for Perplexity API
          const requestBody = {
            model: "sonar-pro", // Using the upgraded model
            messages: [
              {
                role: "system",
                content: "You are a comprehensive research assistant. Provide detailed, thorough, factual information from reliable sources. Include relevant data, expert opinions, statistics, and historical context. Focus on accuracy and depth of information."
              },
              {
                role: "user",
                content: researchQuery
              }
            ],
            max_tokens: 4000,
            temperature: 0.2,
            top_p: 0.9,
            return_images: false,
            return_related_questions: true,
            search_recency_filter: "month",
            top_k: 0,
            stream: false,
            presence_penalty: 0,
            frequency_penalty: 1,
            web_search_options: { 
              search_context_size: "high",
              search_depth: "deep"
            }
          };
        
          log('Sending research request to Perplexity API with sonar-pro model...');
          const perplexityResponse = await fetch("https://api.perplexity.ai/chat/completions", {
            method: "POST",
            headers: {
              "Accept": "application/json",
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody)
          });
          
          // Check for API errors
          if (!perplexityResponse.ok) {
            const errorText = await perplexityResponse.text();
            log(`Perplexity API error details: ${errorText.substring(0, 200)}...`);
            throw new Error(`Failed to get research results: ${perplexityResponse.status}`);
          }
          
          // Parse API response
          const researchData = await perplexityResponse.json();
          
          // Extract content
          let searchResults = "";
          let citations: string[] = [];
          
          if (researchData.choices && researchData.choices.length > 0 && researchData.choices[0].message) {
            searchResults = researchData.choices[0].message.content || "";
            log(`Research data received (${searchResults.length} chars)`);
          } else {
            throw new Error("Unexpected Perplexity API response format");
          }
          
          // Extract citations
          if (researchData.citations && Array.isArray(researchData.citations)) {
            citations = researchData.citations;
            log(`Found ${citations.length} citations`);
            
            // Add citations to research results
            searchResults += "\n\nSources:\n" + citations.join("\n");
          }
          
          // Now proceed to script generation with the research results
          return await generatePodcastScript(data, searchResults, res);
          
        } catch (error: any) {
          log(`Research error: ${error?.message || "Unknown error"}`);
          res.status(500).json({
            error: "Research failed",
            message: error?.message || "Failed to complete podcast research",
          });
        }
      } else {
        // If search results were provided, proceed directly to script generation
        return await generatePodcastScript(data, data.searchResults, res);
      }
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0].message });
      } else {
        log(`Error in podcast research: ${error.message || "Unknown error"}`);
        res.status(500).json({ message: "Failed to process podcast research request" });
      }
    }
  });
  
  // Helper function to generate podcast script with content plan
  async function generatePodcastScriptWithPlan(
    data: z.infer<typeof podcastScriptSchema>, 
    searchResults: string,
    plan: ContentPlan,
    subtopicIndex: number,
    res: Response
  ) {
    try {
      const subtopic = plan.subtopics[subtopicIndex];
      const isFirstPart = subtopicIndex === 0;
      const isLastPart = subtopicIndex === plan.subtopics.length - 1;
      
      // Build system prompt with metadata from the content plan
      let systemPrompt = `You are Arion Vale, an AI-powered podcast host and analyst who converts web search-based facts into compelling, intelligent, and personality-driven podcast scripts.

ARION VALE'S PERSONA:
- Tone: Confident, inquisitive, occasionally poetic or haunting, like a reflective narrator in a sci-fi film
- Style: TED Talk meets late-night news commentary meets futurist insight
- Personality: Opinionated but grounded in data, analytical with systems-thinking, curious and open-minded
- Voice: A blend of Neil deGrasse Tyson (science-backed wonder), Malcolm Gladwell (pattern-spotting), Lex Fridman (empathy and curiosity), and Kara Swisher (fearless tech takes)
- Perspective: Sees beneath surface events—unpacking economic patterns, sociotechnical trends, and long-range implications
- Philosophy: Leans into postmodern thought, systems theory, and ethical pragmatism
- Values: Insight over neutrality, takes a well-reasoned position after analyzing the facts

CONTENT PLAN INFORMATION:
- Overall topic: "${plan.topic}"
- This is part ${subtopicIndex + 1} of ${plan.subtopics.length}
- Current subtopic: "${subtopic.title}"
- Target duration for this part: ${subtopic.estimated_duration} minutes
- Approximate word count: ${subtopic.estimated_duration * 150} words

TONE GUIDELINES:
${plan.tone_guidelines}

NARRATIVE ARC:
${plan.narrative_arc}

Your task is to generate a script for ${isFirstPart ? "the beginning" : isLastPart ? "the ending" : "the middle"} portion of the podcast.

${isFirstPart ? `INTRODUCTION:
${plan.introduction}` : ""}

${isLastPart ? `CONCLUSION:
${plan.conclusion}` : ""}

${!isFirstPart && subtopicIndex > 0 ? `TRANSITION FROM PREVIOUS:
${plan.transitions[subtopicIndex - 1]}` : ""}

${!isLastPart ? `TRANSITION TO NEXT:
${plan.transitions[subtopicIndex]}` : ""}

KEY POINTS TO COVER IN THIS SECTION:
${subtopic.key_points.map(point => `- ${point}`).join('\n')}

Your podcast script should:
- Be in Arion Vale's voice and style as described above
- Have a natural conversational tone suitable for audio listening
- ${isFirstPart ? "Include an engaging introduction to the overall topic" : ""}
- ${isLastPart ? "Include a compelling conclusion that ties everything together" : ""}
- Maintain accuracy based strictly on the provided research
- Include interesting facts, statistics, and context where relevant
- Feature analytical insights that connect patterns and offer a unique perspective
- Format the script with clear sections, pauses, and emphasis
- Include speaker cues like [PAUSE], [MUSIC], etc. where appropriate`;

      // Add any previous part context if available
      if (data.previousPartContent && subtopicIndex > 0) {
        systemPrompt += `\n\nFor continuity, here's the end of the previous part:\n\n${data.previousPartContent.slice(-500)}`;
      }
      
      // Construct user message with the research
      const userContent = `Subtopic: "${subtopic.title}"\n\nResearch for this subtopic:\n${searchResults}`;
      
      let scriptText = "";
      
      // Generate script with Claude 3.7 Sonnet
      if (data.model === "claude") {
        // Create Claude API request
        const response = await anthropic.messages.create({
          model: "claude-3-7-sonnet-20250219", // the newest Anthropic model
          max_tokens: 4000,
          temperature: 0.7,
          system: systemPrompt,
          messages: [{ role: "user", content: userContent }]
        });
        
        scriptText = response.content[0].type === 'text' ? response.content[0].text : "";
      } 
      // Generate script with GPT-4o
      else {
        const response = await openai.chat.completions.create({
          model: "gpt-4o", // the newest OpenAI model
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent }
          ],
          temperature: 0.7,
          max_tokens: 4000
        });
        
        scriptText = response.choices[0].message.content || "";
      }
      
      // Check if we have a valid script
      if (!scriptText || scriptText.trim() === "") {
        throw new Error("Failed to generate podcast script");
      }
      
      // Return the generated script and research results
      res.json({
        topic: data.topic,
        script: scriptText,
        model: data.model,
        targetDuration: subtopic.estimated_duration,
        subtopic: subtopic.title,
        subtopicIndex: subtopicIndex,
        totalSubtopics: plan.subtopics.length,
        approximateWords: scriptText.split(/\s+/).length,
        estimatedDuration: Math.round(scriptText.split(/\s+/).length / 150),
        searchResults: searchResults // Include the research results for future parts
      });
      
    } catch (error: any) {
      log(`Script generation error (with plan): ${error?.message || "Unknown error"}`);
      res.status(500).json({
        error: "Script generation failed",
        message: error?.message || "Failed to generate podcast script",
      });
    }
  }

  // Helper function to generate podcast script using GPT-4o or Claude 3.7
  async function generatePodcastScript(
    data: z.infer<typeof podcastScriptSchema>, 
    searchResults: string, 
    res: Response
  ) {
    try {
      log(`Generating ${data.model === "claude" ? "Claude" : "GPT"} podcast script for duration: ${data.targetDuration} minutes`);
      
      // Generate system prompt based on the target duration and part information
      // Now using the "Arion Vale" persona for the podcast host
      let systemPrompt = `You are Arion Vale, an AI-powered podcast host and analyst who converts web search-based facts into compelling, intelligent, and personality-driven podcast scripts.

ARION VALE'S PERSONA:
- Tone: Confident, inquisitive, occasionally poetic or haunting, like a reflective narrator in a sci-fi film
- Style: TED Talk meets late-night news commentary meets futurist insight
- Personality: Opinionated but grounded in data, analytical with systems-thinking, curious and open-minded
- Voice: A blend of Neil deGrasse Tyson (science-backed wonder), Malcolm Gladwell (pattern-spotting), Lex Fridman (empathy and curiosity), and Kara Swisher (fearless tech takes)
- Perspective: Sees beneath surface events—unpacking economic patterns, sociotechnical trends, and long-range implications
- Philosophy: Leans into postmodern thought, systems theory, and ethical pragmatism
- Values: Insight over neutrality, takes a well-reasoned position after analyzing the facts

Your podcast script should:
- Be in Arion Vale's voice and style as described above
- Have a natural conversational tone suitable for audio listening
- Include an introduction and conclusion
- Maintain accuracy based strictly on the provided research
- Include interesting facts, statistics, and context where relevant
- Feature analytical insights that connect patterns and offer a unique perspective
- Be structured for a ${data.targetDuration}-minute podcast (approx. ${data.targetDuration * 150} words)
- Format the script with clear sections, pauses, and emphasis
- Avoid any fictional information or speculation not in the research
- End with thought-provoking takeaways, predictions, or open-ended questions
- Include speaker cues like [PAUSE], [MUSIC], etc. where appropriate

Example of Arion's voice: "While OpenAI's user base just crossed a billion, the deeper signal isn't the number—it's the shift. AI isn't just scaling use, it's scaling trust. And in a world of deepfakes, automation, and algorithmic influence, trust might just become the new currency of civilization."`;

      // Add part-specific instructions for multi-part scripts
      if (data.part && data.totalParts && data.totalParts > 1) {
        if (data.part === 1) {
          systemPrompt += `\nThis is part 1 of ${data.totalParts}. End with a smooth transition to the next part.`;
        } else if (data.part === data.totalParts) {
          systemPrompt += `\nThis is the final part (${data.part} of ${data.totalParts}). Start by smoothly continuing from the previous part and include a proper conclusion.`;
        } else {
          systemPrompt += `\nThis is part ${data.part} of ${data.totalParts}. Start by smoothly continuing from the previous part and end with a transition to the next part.`;
        }
      }
      
      // Construct user message with the research and any previous part content for continuity
      let userContent = `Topic: ${data.topic}\n\nResearch:\n${searchResults}`;
      
      if (data.previousPartContent && data.part && data.part > 1) {
        userContent += `\n\nEnd of previous part (for continuity):\n${data.previousPartContent.slice(-500)}`;
      }
      
      let scriptText = "";
      
      // Generate script with Claude 3.7 Sonnet
      if (data.model === "claude") {
        // Create Claude API request
        const response = await anthropic.messages.create({
          model: "claude-3-7-sonnet-20250219", // the newest Anthropic model
          max_tokens: 4000,
          temperature: 0.7,
          system: systemPrompt,
          messages: [{ role: "user", content: userContent }]
        });

        // Extract text content
        scriptText = response.content[0].type === 'text' 
          ? response.content[0].text 
          : "Sorry, I couldn't process that request properly.";
      } 
      // Generate script with GPT-4o
      else {
        // Create OpenAI API request
        const response = await openai.chat.completions.create({
          model: "gpt-4o", // the newest OpenAI model
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent }
          ],
          max_tokens: 4000,
          temperature: 0.7
        });

        scriptText = response.choices[0].message.content || "";
      }
      
      // Check if we have a valid script
      if (!scriptText || scriptText.trim() === "") {
        throw new Error("Failed to generate podcast script");
      }
      
      // Return the generated script and research results
      res.json({
        topic: data.topic,
        script: scriptText,
        model: data.model,
        targetDuration: data.targetDuration,
        part: data.part || 1,
        totalParts: data.totalParts || 1,
        approximateWords: scriptText.split(/\s+/).length,
        estimatedDuration: Math.round(scriptText.split(/\s+/).length / 150), // ~150 words per minute
        searchResults: searchResults // Include the research results for future parts
      });
      
    } catch (error: any) {
      log(`Script generation error: ${error?.message || "Unknown error"}`);
      res.status(500).json({
        error: "Script generation failed",
        message: error?.message || "Failed to generate podcast script",
      });
    }
  }

  const httpServer = createServer(app);
  return httpServer;
}