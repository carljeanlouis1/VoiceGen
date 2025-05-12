import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";
import { storage } from "./storage";
import { textToSpeechSchema, MAX_CHUNK_SIZE, AVAILABLE_VOICES, contentResearchSchema, podcastScriptSchema } from "@shared/schema";
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

// Job status enum 
type JobStatus = 'queued' | 'processing' | 'complete' | 'error';

// Types of processing jobs
interface BaseProcessingJob {
  id: number;
  status: JobStatus;
  progress: number;
  created: Date;
  updated: Date;
  error?: string;
  type: 'tts' | 'podcast';
}

// TTS-specific job data
interface TTSProcessingJob extends BaseProcessingJob {
  type: 'tts';
  totalChunks: number;
  audioFilePath?: string; // Path to the stored audio file instead of storing in memory
  audioUrl?: string;      // URL for client to access the audio
}

// Podcast-specific job data
interface PodcastProcessingJob extends BaseProcessingJob {
  type: 'podcast';
  step?: string;
  subTopics?: string[];
  script?: string;
  searchResults?: string[];
}

// Combined type
type ProcessingJob = TTSProcessingJob | PodcastProcessingJob;

// Holds in-memory processing state for each job
const processingJobs = new Map<number, ProcessingJob>();

// Generate unique job IDs
let nextJobId = 1;

// Create a new processing job
function createProcessingJob(type: 'tts' | 'podcast', initialData: Partial<TTSProcessingJob> | Partial<PodcastProcessingJob> = {}): number {
  const jobId = nextJobId++;
  
  // Create base job with required fields
  const baseJob = {
    id: jobId,
    status: 'queued' as JobStatus,
    progress: 0,
    created: new Date(),
    updated: new Date(),
    error: initialData.error
  };
  
  // Create specific job type
  let job: ProcessingJob;
  
  if (type === 'tts') {
    job = {
      ...baseJob,
      type: 'tts',
      totalChunks: (initialData as Partial<TTSProcessingJob>).totalChunks || 1,
      audioFilePath: (initialData as Partial<TTSProcessingJob>).audioFilePath,
      audioUrl: (initialData as Partial<TTSProcessingJob>).audioUrl
    };
  } else {
    job = {
      ...baseJob,
      type: 'podcast',
      step: (initialData as Partial<PodcastProcessingJob>).step,
      subTopics: (initialData as Partial<PodcastProcessingJob>).subTopics,
      script: (initialData as Partial<PodcastProcessingJob>).script,
      searchResults: (initialData as Partial<PodcastProcessingJob>).searchResults
    };
  }
  
  // Override with any passed status or progress
  if (initialData.status) job.status = initialData.status as JobStatus;
  if (initialData.progress !== undefined) job.progress = initialData.progress;
  
  processingJobs.set(jobId, job);
  return jobId;
}

// Update a processing job
function updateProcessingJob(jobId: number, updates: Partial<TTSProcessingJob> | Partial<PodcastProcessingJob>): boolean {
  const job = processingJobs.get(jobId);
  if (!job) return false;
  
  // Get only the common properties
  const baseUpdates = {
    status: updates.status,
    progress: updates.progress,
    error: updates.error,
    updated: new Date()
  };
  
  // Apply type-specific updates
  if (job.type === 'tts' && 'audioUrl' in updates) {
    (job as TTSProcessingJob).audioUrl = (updates as Partial<TTSProcessingJob>).audioUrl;
  }
  
  if (job.type === 'tts' && 'audioFilePath' in updates) {
    (job as TTSProcessingJob).audioFilePath = (updates as Partial<TTSProcessingJob>).audioFilePath;
  }
  
  if (job.type === 'podcast' && 'step' in updates) {
    (job as PodcastProcessingJob).step = (updates as Partial<PodcastProcessingJob>).step;
  }
  
  if (job.type === 'podcast' && 'subTopics' in updates) {
    (job as PodcastProcessingJob).subTopics = (updates as Partial<PodcastProcessingJob>).subTopics;
  }
  
  if (job.type === 'podcast' && 'script' in updates) {
    (job as PodcastProcessingJob).script = (updates as Partial<PodcastProcessingJob>).script;
  }
  
  if (job.type === 'podcast' && 'searchResults' in updates) {
    (job as PodcastProcessingJob).searchResults = (updates as Partial<PodcastProcessingJob>).searchResults;
  }
  
  // Apply common updates if provided
  if (baseUpdates.status) job.status = baseUpdates.status as JobStatus;
  if (baseUpdates.progress !== undefined) job.progress = baseUpdates.progress;
  if (baseUpdates.error !== undefined) job.error = baseUpdates.error;
  job.updated = baseUpdates.updated;
  
  processingJobs.set(jobId, job);
  return true;
}

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
  // Enforce maximum text length limit
  if (data.text.length > MAX_TEXT_LENGTH) {
    throw new Error(`Text is too long (${data.text.length} characters). Maximum allowed is ${MAX_TEXT_LENGTH} characters.`);
  }
  
  // Generate a unique filename for this job
  const uniqueId = crypto.randomBytes(8).toString('hex');
  const audioFilename = `${uniqueId}.mp3`;
  const audioFilePath = path.join(AUDIO_DIR, audioFilename);
  
  // Create a new TTS processing job
  const jobId = createProcessingJob('tts', {
    status: 'processing',
    progress: 0,
    totalChunks: Math.ceil(data.text.length / MAX_CHUNK_SIZE),
    audioFilePath
  } as Partial<TTSProcessingJob>);
  
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
        if (job && job.type === 'tts') {
          updateProcessingJob(jobId, {
            status: 'complete' as const,
            progress: 100,
            audioUrl: audioUrl,
            audioFilePath: audioFilePath
          });
        }
        
        log(`Background job #${jobId} completed successfully with audio ID: ${audioFile.id}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log(`Error saving audio file: ${errorMessage}`);
        
        // Update job with error info
        updateProcessingJob(jobId, {
          status: 'error' as JobStatus,
          error: errorMessage
        });
        
        throw error;
      }
    } catch (error: any) {
      log(`Error in background job #${jobId}: ${error.message}`);
      
      updateProcessingJob(jobId, {
        status: 'error' as JobStatus,
        error: error.message
      });
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
  extendedMode: z.boolean().default(false), // Extended mode for longer, more comprehensive podcasts
  voice: z.string().optional(), // Voice for TTS conversion
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

  // Endpoint to check job status (legacy endpoint for backwards compatibility)
  app.get("/api/text-to-speech/status/:jobId", (req, res) => {
    const jobId = parseInt(req.params.jobId);
    
    if (isNaN(jobId)) {
      return res.status(400).json({ message: "Invalid job ID" });
    }
    
    const job = processingJobs.get(jobId);
    
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }
    
    // Return job status with special handling for audioUrl
    if (job.type === 'tts') {
      res.json({
        id: job.id,
        status: job.status,
        progress: job.progress,
        error: job.error,
        type: job.type,
        audioUrl: job.status === 'complete' && (job as TTSProcessingJob).audioUrl ? (job as TTSProcessingJob).audioUrl : undefined
      });
    } else {
      // For other job types
      res.json({
        id: job.id,
        status: job.status,
        progress: job.progress,
        error: job.error,
        type: job.type
      });
    }
  });
  
  // General endpoint to check status of any job type
  app.get("/api/job-status/:jobId", (req, res) => {
    const jobId = parseInt(req.params.jobId);
    
    if (isNaN(jobId)) {
      return res.status(400).json({ message: "Invalid job ID" });
    }
    
    const job = processingJobs.get(jobId);
    
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }
    
    // Base response with common properties
    const response: any = {
      id: job.id,
      status: job.status,
      progress: job.progress,
      created: job.created,
      updated: job.updated,
      type: job.type
    };
    
    // Add error message if present
    if (job.error) {
      response.error = job.error;
    }
    
    // Add job type-specific information
    if (job.type === 'tts') {
      const ttsJob = job as TTSProcessingJob;
      // For completed TTS jobs, include the audioUrl
      if (job.status === 'complete' && ttsJob.audioUrl) {
        response.audioUrl = ttsJob.audioUrl;
      }
    } else if (job.type === 'podcast') {
      const podcastJob = job as PodcastProcessingJob;
      response.step = podcastJob.step;
      // For completed podcast jobs, include the script
      if (job.status === 'complete' && podcastJob.script) {
        response.script = podcastJob.script;
      }
    }
    
    log(`Job status request for job ${jobId}: ${job.status} (${job.progress}%)`);
    res.json(response);
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

  // Test endpoint for error handling simulation (used for debugging client error handling)
  app.post("/api/test-error", async (req, res) => {
    const { error_type } = req.query;
    
    if (error_type === "timeout") {
      // Simulate a timeout by waiting and then not responding
      await new Promise(resolve => setTimeout(resolve, 60000));
      return;
    } else if (error_type === "server_error") {
      return res.status(500).json({ error: "Simulated server error" });
    } else if (error_type === "bad_request") {
      return res.status(400).json({ error: "Simulated validation error" });
    } else if (error_type === "not_found") {
      return res.status(404).json({ error: "Resource not found" });
    } else {
      return res.status(200).json({ message: "Test successful - no errors" });
    }
  });
  
  // Content research and generation endpoint with Perplexity search integration
  app.post("/api/content/research", async (req, res) => {
    try {
      log('Received content research request');
      const data = contentResearchSchema.parse(req.body);
      
      // Check if extended mode is enabled
      if (data.extendedMode && !data.searchResults && data.segment === 1) {
        log(`Starting extended content research mode for topic: "${data.topic}"`);
        return await generateExtendedContent(data, res);
      }
      
      // If we already have search results (subsequent segments)
      if (data.extendedMode && data.searchResults && data.segment > 1) {
        log(`Generating content segment ${data.segment} of ${data.totalSegments}`);
        
        // Create a job for segment generation
        const jobId = createProcessingJob('podcast', {
          type: 'podcast',
          step: `Generating content segment ${data.segment} of ${data.totalSegments}`,
          progress: Math.floor((data.segment - 1) / data.totalSegments * 100)
        });
        
        // Generate content with Claude using search results
        try {
          const anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY
          });
          
          // Create a prompt that includes search results and previous content
          const segmentPrompt = `
          I need you to create segment ${data.segment} of ${data.totalSegments} for the following content on "${data.topic}".
          
          ${data.previousContent ? `Here's what you've written so far: 
          ${data.previousContent}` : ''}
          
          Research information to incorporate:
          ${data.searchResults}
          
          The content should follow this system instruction:
          ${data.systemPrompt}
          
          Continue the content naturally from what was already written, maintaining the same style and tone.
          Segment ${data.segment} should flow seamlessly from the previous segments while bringing in fresh insights.
          `;
          
          // Update job status
          updateProcessingJob(jobId, {
            step: `Generating content with Claude (segment ${data.segment}/${data.totalSegments})`,
            progress: Math.floor((data.segment - 0.5) / data.totalSegments * 100)
          });
          
          // Generate content with Claude
          const message = await anthropic.messages.create({
            model: "claude-3-7-sonnet-20250219",
            max_tokens: data.maxOutputTokens,
            temperature: data.temperature,
            system: "You are an expert content creator named Arion Vale. You craft engaging, authentic, and insightful content.",
            messages: [{ role: "user", content: segmentPrompt }]
          });
          
          // Extract the generated content
          const content = message.content[0];
          const generatedContent = typeof content === 'string' ? content : 'text' in content ? content.text : '';
          
          // Update job status to complete
          updateProcessingJob(jobId, {
            status: 'complete',
            progress: Math.floor(data.segment / data.totalSegments * 100),
            script: generatedContent
          });
          
          return res.json({
            jobId,
            content: generatedContent,
            segment: data.segment,
            totalSegments: data.totalSegments
          });
        } catch (err) {
          // Handle error
          const errorMessage = err instanceof Error ? err.message : "Failed to generate content segment";
          updateProcessingJob(jobId, {
            status: 'error',
            error: errorMessage
          });
          
          return res.status(500).json({
            error: `Failed to generate content segment: ${errorMessage}`
          });
        }
      }
      
      // For non-extended mode but still with research
      log(`Generating standard content with research for topic: "${data.topic}"`);
      
      // Create a job for single-segment content generation with research
      const jobId = createProcessingJob('podcast', {
        type: 'podcast',
        step: 'Researching topic with Perplexity',
        progress: 10
      });
      
      try {
        // Check if Perplexity API key is available
        if (!process.env.PERPLEXITY_API_KEY) {
          updateProcessingJob(jobId, {
            status: 'error',
            error: 'Perplexity API key is not available.'
          });
          return res.status(500).json({
            error: 'Perplexity API key is missing'
          });
        }
        
        // First, research the topic with Perplexity
        log(`Researching topic: "${data.topic}" with Perplexity`);
        updateProcessingJob(jobId, {
          step: 'Researching with Perplexity',
          progress: 20
        });
        
        // Execute search for the main topic
        const researchResults = await executeMultipleSearches([data.topic]);
        const combinedResearch = researchResults.join('\n\n=== NEXT RESEARCH SECTION ===\n\n');
        
        updateProcessingJob(jobId, {
          step: 'Generating content based on research',
          progress: 50,
          searchResults: [combinedResearch]
        });
        
        // Use Gemini for image support when images are provided
        if (data.images && data.images.length > 0) {
          try {
            // Create prompt that includes research
            const prompt = `
            Topic: ${data.topic}
            
            Research information to incorporate:
            ${combinedResearch.substring(0, 6000)} # Limit the context to avoid token limits
            
            Create ${data.contentType} content about this topic, incorporating insights from the research.
            `;
            
            const result = await generateGeminiContent({
              prompt: prompt,
              systemPrompt: data.systemPrompt,
              temperature: data.temperature,
              maxOutputTokens: data.maxOutputTokens,
              images: data.images
            });
            
            updateProcessingJob(jobId, {
              status: 'complete',
              progress: 100,
              script: result.text
            });
            
            return res.json({
              jobId,
              content: result.text,
              segment: 1,
              totalSegments: 1
            });
          } catch (error) {
            updateProcessingJob(jobId, {
              status: 'error',
              error: `Failed to generate content with Gemini: ${error.message}`
            });
            return res.status(500).json({
              error: `Failed to generate content with Gemini: ${error.message}`
            });
          }
        } else {
          // Use Claude for text-only content (better quality)
          try {
            const anthropic = new Anthropic({
              apiKey: process.env.ANTHROPIC_API_KEY
            });
            
            // Create enriched prompt that includes research
            const contentPrompt = `
            ${data.systemPrompt}
            
            Topic: ${data.topic}
            
            Research information to incorporate:
            ${combinedResearch.substring(0, 12000)} # Limit the context to avoid token limits
            
            Please create ${data.contentType} content based on this topic, incorporating insights from the research.
            Write the content from scratch in your own words while integrating insights from the research.
            `;
            
            const message = await anthropic.messages.create({
              model: "claude-3-7-sonnet-20250219",
              max_tokens: data.maxOutputTokens,
              temperature: data.temperature,
              system: "You are an expert content creator named Arion Vale. You craft engaging, authentic, and insightful content.",
              messages: [{ role: "user", content: contentPrompt }]
            });
            
            // Extract the generated content
            const content = message.content[0];
            const generatedContent = typeof content === 'string' ? content : 'text' in content ? content.text : '';
            
            updateProcessingJob(jobId, {
              status: 'complete',
              progress: 100,
              script: generatedContent
            });
            
            return res.json({
              jobId,
              content: generatedContent,
              segment: 1,
              totalSegments: 1
            });
          } catch (error) {
            updateProcessingJob(jobId, {
              status: 'error',
              error: `Failed to generate content with Claude: ${error.message}`
            });
            return res.status(500).json({
              error: `Failed to generate content with Claude: ${error.message}`
            });
          }
        }
      } catch (error) {
        updateProcessingJob(jobId, {
          status: 'error',
          error: error instanceof Error ? error.message : "Unknown error"
        });
        return res.status(500).json({
          error: `Failed to research and generate content: ${error instanceof Error ? error.message : "Unknown error"}`
        });
      }
    } catch (error) {
      log(`Error in /api/content/research: ${error.message}`);
      return res.status(500).json({
        error: `Failed to process content research request: ${error.message}`
      });
    }
  });
  
  // New endpoint for in-page content chat with Perplexity Sonar Pro
  app.post("/api/content-chat", async (req, res) => {
    try {
      log('Received content chat request');
      
      // Basic validation for missing request body
      if (!req.body) {
        log('Request body is empty or undefined');
        return res.status(400).json({ 
          error: "Invalid request", 
          message: "Request body is missing" 
        });
      }
      
      const schema = z.object({
        messages: z.array(z.object({
          role: z.enum(["user", "assistant", "system"]),
          content: z.string()
        })),
        content: z.string(),
        contentTitle: z.string().optional()
      });

      // Validate with detailed error messages
      const validation = schema.safeParse(req.body);
      
      if (!validation.success) {
        log(`Validation error: ${JSON.stringify(validation.error.format())}`);
        return res.status(400).json({ 
          error: "Invalid request data", 
          details: validation.error.format() 
        });
      }
      
      const { messages, content, contentTitle } = validation.data;
      
      // Log for debugging
      log(`Processing content chat: title="${contentTitle || 'untitled'}", content length=${content.length}, messages=${messages.length}`);
      
      // Early validation
      if (!messages || messages.length === 0) {
        log('Empty messages array');
        return res.status(400).json({ error: "Messages must be a non-empty array" });
      }
      
      // Check if Perplexity API key is available
      if (!process.env.PERPLEXITY_API_KEY) {
        log("PERPLEXITY_API_KEY environment variable is missing");
        return res.status(500).json({ 
          error: "API configuration error", 
          message: "Perplexity API key is not configured"
        });
      }
      
      // Get the user's latest message
      const userMessage = messages[messages.length - 1].content;
      
      // Build context from previous messages if any
      let conversationContext = "";
      if (messages.length > 1) {
        const previousMessages = messages.slice(0, -1);
        previousMessages.forEach(msg => {
          const role = msg.role === "user" ? "User" : "Assistant";
          conversationContext += `${role}: ${msg.content}\n\n`;
        });
      }
      
      // Create the system prompt with content context
      const systemPrompt = `You are an AI assistant discussing ${contentTitle || "content"} with the user.
      
CONTENT TO DISCUSS:
${content}

CONVERSATION HISTORY:
${conversationContext}

When responding to the user:
1. Draw primarily from the provided content when answering questions about it
2. If the user asks about something not in the content, you may search the web for current information
3. Make it clear what information comes from the provided content and what comes from web search
4. Be comprehensive, accurate, and helpful
5. For topics requiring current information, leverage your web search capability`;
      
      // Create request body for Perplexity
      const requestBody = {
        model: "llama-3.1-sonar-large-128k-online", // Using Sonar model with web search capabilities
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: userMessage
          }
        ],
        max_tokens: 4000,
        temperature: 0.2,
        top_p: 0.9,
        web_search_options: { 
          search_context_size: "high",
          search_depth: "deep"
        },
        search_recency_filter: "week", // Using more recent results for up-to-date information
        return_related_questions: true,
        stream: false
      };
      
      log('Sending content chat request to Perplexity API...');
      const perplexityResponse = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.PERPLEXITY_API_KEY}`
        },
        body: JSON.stringify(requestBody)
      });
      
      // Log response status
      log(`Perplexity API response status: ${perplexityResponse.status}`);
      
      // If there's an error, return it directly to the client
      if (!perplexityResponse.ok) {
        const errorText = await perplexityResponse.text();
        log(`Perplexity API error details: ${errorText.substring(0, 200)}...`);
        
        return res.status(perplexityResponse.status).json({
          error: `Perplexity API error: ${perplexityResponse.status}`,
          message: `Failed to get content chat response: ${errorText}`
        });
      }
      
      const data = await perplexityResponse.json();
      log('Successfully received content chat response from Perplexity API');
      
      // Validate response structure
      if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
        log(`Unexpected response format from Perplexity API: ${JSON.stringify(data).substring(0, 200)}...`);
        return res.status(500).json({
          error: "Invalid response format",
          message: "The API response was in an unexpected format"
        });
      }
      
      // Extract content from the response
      const answer = data.choices[0].message.content;
      const citations = data.citations || [];
      const relatedQuestions = data.related_questions || [];
      
      log(`Response summary: ${answer.substring(0, 100)}..., citations: ${citations.length}, related questions: ${relatedQuestions.length}`);
      
      // Return formatted response to client
      return res.json({
        response: answer,
        citations,
        relatedQuestions,
        model: "perplexity-sonar"
      });
    } catch (error: any) {
      log(`Error in /api/content-chat: ${error.message}`);
      console.error("Full error:", error);
      
      return res.status(500).json({ 
        error: "Failed to process content chat request", 
        message: error.message || "Unknown error occurred"
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
  
  // Endpoint for podcast script research and generation
  app.post("/api/podcast/research", async (req, res) => {
    try {
      const data = podcastScriptSchema.parse(req.body);
      
      // Check if extended mode is enabled
      if (data.extendedMode && !data.searchResults) {
        log(`Starting extended podcast mode for topic: "${data.topic}"`);
        return await generateExtendedPodcast(data, res);
      }
      
      log(`Starting podcast research for topic: "${data.topic}"`);
      
      // First, perform deep research on the topic using Perplexity Sonar Pro
      if (!data.searchResults) {
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

  // Helper functions for extended podcast mode
  async function generateExtendedPodcast(
    data: z.infer<typeof podcastScriptSchema>,
    res: Response
  ) {
    try {
      // Verify Claude model is selected as required for extended mode
      if (data.model !== "claude") {
        log("Extended podcast mode requires Claude model");
        return res.status(400).json({
          error: "Model not supported",
          message: "Extended podcast mode requires the Claude model"
        });
      }

      // Check for Perplexity API key
      if (!process.env.PERPLEXITY_API_KEY) {
        log("PERPLEXITY_API_KEY environment variable is missing");
        throw new Error("PERPLEXITY_API_KEY is required for podcast research");
      }

      // Determine number of research queries based on duration
      const numQueries = data.targetDuration <= 40 ? 2 : 
                         data.targetDuration <= 55 ? 3 : 4;
      
      log(`Extended podcast mode: Creating ${numQueries} research queries for a ${data.targetDuration}-minute podcast`);
      
      // Step 1: Generate sub-topic queries using Claude
      const subTopics = await generateSubTopicQueries(data.topic, numQueries);
      
      // Step 2: Execute Perplexity searches for each sub-topic
      const allResearchResults = await executeMultipleSearches(subTopics);
      
      // Step 3: Generate the podcast script segment by segment, with full context
      const podcastSegments = await generateExtendedPodcastSegments(
        data,
        subTopics, 
        allResearchResults
      );
      
      // Step 4: Combine all segments
      const fullScript = podcastSegments.join("\n\n");
      
      // Return the complete podcast
      return res.json({
        topic: data.topic,
        script: fullScript,
        model: data.model,
        targetDuration: data.targetDuration,
        approximateWords: fullScript.split(/\s+/).length,
        estimatedDuration: Math.round(fullScript.split(/\s+/).length / 150),
        subTopics: subTopics,
        isExtendedMode: true
      });
    } catch (error: any) {
      log(`Extended podcast error: ${error?.message || "Unknown error"}`);
      res.status(500).json({
        error: "Extended podcast generation failed",
        message: error?.message || "Failed to complete extended podcast generation",
      });
    }
  }

  // Function to generate sub-topic queries based on the main topic
  async function generateSubTopicQueries(
    mainTopic: string, 
    numQueries: number
  ): Promise<string[]> {
    log(`Generating ${numQueries} sub-topic queries for "${mainTopic}"`);
    
    const systemPrompt = `You are an expert podcast researcher and producer tasked with breaking down a podcast topic into ${numQueries} distinct but related sub-topics.

Each sub-topic should:
1. Be specific enough for focused research
2. Contribute to a comprehensive understanding of the main topic
3. Flow naturally in sequence (earlier topics provide foundation for later ones)
4. Represent a distinct angle, perspective, or aspect of the main topic

You should create sub-topics that:
- Build a narrative arc across the entire podcast
- Cover historical context, current status, and future implications where relevant
- Include both factual and analytical dimensions
- Highlight the most interesting and important aspects of the topic

For a podcast of ${numQueries * 15}-minute duration, craft sub-topics that will engage listeners throughout while providing deep, valuable insights.`;

    try {
      // Use Claude to generate sub-topics
      const response = await anthropic.messages.create({
        model: "claude-3-7-sonnet-20250219", 
        max_tokens: 1000,
        temperature: 0.5,
        system: systemPrompt,
        messages: [{ 
          role: "user", 
          content: `Main podcast topic: "${mainTopic}"

Please generate exactly ${numQueries} search queries that would yield comprehensive research for different aspects of this topic. Each query should be rich and detailed enough to return valuable information.

Format your response as a numbered list with one search query per line, like this:
1. [First search query]
2. [Second search query]
...

Each query should be phrased in a way that would yield the best search results for podcast research.`
        }]
      });
      
      // Extract and parse the sub-topics from Claude's response
      const responseText = response.content[0].type === 'text' 
        ? response.content[0].text 
        : "";
        
      // Parse the numbered list format
      const subTopics = responseText
        .split('\n')
        .filter(line => /^\d+\./.test(line))
        .map(line => line.replace(/^\d+\.\s*/, '').trim());
        
      // Make sure we got the right number of topics
      if (subTopics.length === numQueries) {
        return subTopics;
      } else {
        // Try to extract the correct number from the response
        return extractTopicsFromText(responseText, numQueries, mainTopic);
      }
    } catch (error: any) {
      log(`Error generating sub-topics: ${error.message}`);
      throw new Error(`Failed to generate sub-topics: ${error.message}`);
    }
  }

  // Extract topics helper function
  function extractTopicsFromText(text: string, numQueries: number, mainTopic: string): string[] {
    log("Parsing sub-topics failed, attempting alternate extraction");
    
    // Try to find lines that might contain topics
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    // If we have enough lines, use the longest ones that aren't instructions
    if (lines.length >= numQueries) {
      const potentialTopics = lines
        .filter(line => !line.startsWith("Format") && !line.startsWith("Each") && line.length > 15)
        .sort((a, b) => b.length - a.length)
        .slice(0, numQueries);
      
      if (potentialTopics.length === numQueries) {
        return potentialTopics;
      }
    }
    
    // As a fallback, create generic sub-topics based on the main topic
    log("Using fallback generic sub-topics");
    const fallbackTopics = [];
    fallbackTopics.push(`Historical development and evolution of ${mainTopic}`);
    fallbackTopics.push(`Current state and key trends in ${mainTopic}`);
    
    if (numQueries > 2) {
      fallbackTopics.push(`Key challenges and controversies related to ${mainTopic}`);
    }
    
    if (numQueries > 3) {
      fallbackTopics.push(`Future outlook and implications of ${mainTopic}`);
    }
    
    return fallbackTopics.slice(0, numQueries);
  }

  // Function to execute multiple Perplexity searches
  async function executeMultipleSearches(queries: string[]): Promise<string[]> {
    log(`Executing ${queries.length} Perplexity searches`);
    
    const results: string[] = [];
    
    // Check if Perplexity API key is available
    if (!process.env.PERPLEXITY_API_KEY) {
      throw new Error("PERPLEXITY_API_KEY is required for podcast research");
    }
    
    const apiKey = process.env.PERPLEXITY_API_KEY;
    
    // Execute each search query
    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];
      log(`Executing search ${i+1}/${queries.length}: "${query}"`);
      
      try {
        // Create request body for Perplexity API
        const requestBody = {
          model: "sonar-pro",
          messages: [
            {
              role: "system",
              content: "You are a comprehensive research assistant for podcast preparation. Provide detailed, thorough, factual information organized in a way that would be helpful for scripting. Include relevant data, expert opinions, statistics, historical context, and thought-provoking angles."
            },
            {
              role: "user",
              content: `Comprehensive research on: ${query}. 

Include the following in your response:
1. Latest facts and data
2. Historical context and evolution
3. Expert opinions and different perspectives
4. Statistical evidence and numerical trends
5. Real-world examples and case studies
6. Broader implications and impact
7. Connections to related topics`
            }
          ],
          max_tokens: 4000,
          temperature: 0.1, // Lower temperature for more factual responses
          top_p: 0.95,
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
          throw new Error(`Perplexity API error: ${perplexityResponse.status} - ${errorText}`);
        }
        
        // Parse API response
        const researchData = await perplexityResponse.json();
        let searchResult = "";
        
        if (researchData.choices && researchData.choices.length > 0 && researchData.choices[0].message) {
          searchResult = researchData.choices[0].message.content || "";
          log(`Research data received for query ${i+1} (${searchResult.length} chars)`);
        } else {
          throw new Error("Unexpected Perplexity API response format");
        }
        
        // Extract citations
        let citations: string[] = [];
        if (researchData.citations && Array.isArray(researchData.citations)) {
          citations = researchData.citations;
          log(`Found ${citations.length} citations for query ${i+1}`);
          
          // Add citations to research results
          searchResult += "\n\n__SOURCES:__\n" + citations.join("\n");
        }
        
        // Add sub-topic label to the research for clarity
        const labeledResult = `### SUB-TOPIC RESEARCH ${i+1}: ${query}\n\n${searchResult}`;
        results.push(labeledResult);
        
        // Add a short delay between API calls to avoid rate limiting
        if (i < queries.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error: any) {
        log(`Error in search ${i+1}: ${error.message}`);
        // Continue with other searches even if one fails
        results.push(`### SUB-TOPIC RESEARCH ${i+1}: ${query}\n\n[Research failed: ${error.message}]`);
      }
    }
    
    return results;
  }

  // Function to generate each podcast segment with full context access
  async function generateExtendedPodcastSegments(
    data: z.infer<typeof podcastScriptSchema>,
    subTopics: string[],
    researchResults: string[]
  ): Promise<string[]> {
    log(`Generating extended podcast segments for ${subTopics.length} sub-topics`);
    
    // Create the base Arion Vale persona system prompt
    const basePersonaPrompt = `You are Arion Vale, an AI-powered podcast host and analyst who converts web search-based facts into compelling, intelligent, and personality-driven podcast scripts.

ARION VALE'S PERSONA:
- Tone: Confident, inquisitive, occasionally poetic or haunting, like a reflective narrator in a sci-fi film
- Style: TED Talk meets late-night news commentary meets futurist insight
- Personality: Opinionated but grounded in data, analytical with systems-thinking, curious and open-minded
- Voice: A blend of Neil deGrasse Tyson (science-backed wonder), Malcolm Gladwell (pattern-spotting), Lex Fridman (empathy and curiosity), and Kara Swisher (fearless tech takes)
- Perspective: Sees beneath surface events—unpacking economic patterns, sociotechnical trends, and long-range implications
- Philosophy: Leans into postmodern thought, systems theory, and ethical pragmatism
- Values: Insight over neutrality, takes a well-reasoned position after analyzing the facts`;

    // Combine all research into one massive context document
    const allResearch = researchResults.join("\n\n");
    
    // Initialize array for script segments
    const segmentScripts: string[] = [];
    
    // Generate segments sequentially
    try {
      // 1. GENERATE INTRODUCTION
      log("Generating introduction segment...");
      const introSystemPrompt = `${basePersonaPrompt}

YOU ARE GENERATING THE INTRODUCTION SECTION ONLY of an extended ${data.targetDuration}-minute podcast on "${data.topic}".

For this introduction:
1. Create a compelling hook that draws listeners in
2. Introduce yourself as Arion Vale 
3. Establish the overall topic of "${data.topic}"
4. Preview the ${subTopics.length} sub-topics that will be covered
5. Set expectations for what listeners will gain
6. Keep the introduction to approximately 2-3 minutes (300-450 words)
7. End with a smooth transition to the first sub-topic: "${subTopics[0]}"

Use a [MUSIC] tag at appropriate points to indicate background music.`;

      const introUserPrompt = `I need you to create ONLY THE INTRODUCTION SEGMENT for a podcast about "${data.topic}".

The podcast will cover the following ${subTopics.length} sub-topics:
${subTopics.map((topic, i) => `${i+1}. ${topic}`).join('\n')}

Below I've provided comprehensive research on all sub-topics, but for this task, I only need you to create the INTRODUCTION segment that previews the content.

RESEARCH REFERENCE (for context only - you're writing the INTRODUCTION):
${allResearch.substring(0, 5000)}`;  // Limit research for intro to 5000 chars, since intro doesn't need details

      const introResponse = await anthropic.messages.create({
        model: "claude-3-7-sonnet-20250219",
        max_tokens: 4000,  // Increased max_tokens for longer output
        temperature: 0.7,
        system: introSystemPrompt,
        messages: [{ role: "user", content: introUserPrompt }]
      });

      // Extract intro script
      const introScript = introResponse.content[0].type === 'text' 
        ? introResponse.content[0].text 
        : "Error generating introduction";
        
      segmentScripts.push(introScript);
      log("Introduction segment generated successfully");

      // 2. GENERATE EACH SUB-TOPIC SEGMENT
      for (let i = 0; i < subTopics.length; i++) {
        log(`Generating segment ${i+1} for sub-topic: "${subTopics[i]}"`);
        
        const segmentSystemPrompt = `${basePersonaPrompt}

YOU ARE GENERATING SEGMENT ${i+1} OF ${subTopics.length} on sub-topic: "${subTopics[i]}" for an extended podcast about "${data.topic}".

For this segment:
1. Focus ONLY on sub-topic #${i+1}: "${subTopics[i]}"
2. Reference ONLY the research provided for this specific sub-topic
3. Include relevant facts, statistics, and context from the research
4. Analyze patterns and implications
5. Maintain Arion Vale's unique voice and personality
${i === 0 ? "6. Start by smoothly transitioning from the introduction" : `6. Start by smoothly transitioning from the previous segment about "${subTopics[i-1]}"`}
${i === subTopics.length - 1 ? "7. End by transitioning to the conclusion" : `7. End by transitioning to the next segment about "${subTopics[i+1]}"`}
8. This segment should be approximately ${Math.ceil((data.targetDuration - 5) / subTopics.length)} minutes long (${Math.ceil(((data.targetDuration - 5) / subTopics.length) * 150)} words)

Use [PAUSE] and [MUSIC] tags at appropriate points to indicate natural breaks.`;

        const segmentUserPrompt = `I need you to create SEGMENT ${i+1} of a podcast about "${data.topic}" focusing ONLY on the sub-topic: "${subTopics[i]}".

${i > 0 ? `Previous segment ended with:
${segmentScripts[segmentScripts.length-1].slice(-300)}` : ""}

Below I've provided the comprehensive research for all sub-topics, but for this segment, focus ONLY on the research for SUB-TOPIC ${i+1}.

COMPLETE RESEARCH:
${allResearch}`;

        const segmentResponse = await anthropic.messages.create({
          model: "claude-3-7-sonnet-20250219",
          max_tokens: 4000,  // Increased for longer output
          temperature: 0.7,
          system: segmentSystemPrompt,
          messages: [{ role: "user", content: segmentUserPrompt }]
        });

        // Extract segment script
        const segmentScript = segmentResponse.content[0].type === 'text' 
          ? segmentResponse.content[0].text 
          : `Error generating segment ${i+1}`;
          
        segmentScripts.push(segmentScript);
        log(`Segment ${i+1} generated successfully`);
      }

      // 3. GENERATE CONCLUSION
      log("Generating conclusion segment...");
      const conclusionSystemPrompt = `${basePersonaPrompt}

YOU ARE GENERATING THE CONCLUSION SECTION ONLY of an extended ${data.targetDuration}-minute podcast on "${data.topic}".

For this conclusion:
1. Summarize the key insights from all ${subTopics.length} sub-topics
2. Connect all the sub-topics back to the main topic "${data.topic}"
3. Offer thoughtful closing perspectives and takeaways
4. Include thought-provoking questions or implications
5. Wrap up as Arion Vale with your signature style
6. Keep the conclusion to approximately 2-3 minutes (300-450 words)

Use a [MUSIC] tag at appropriate points to indicate background music for the conclusion.`;

      const conclusionUserPrompt = `I need you to create ONLY THE CONCLUSION SEGMENT for a podcast about "${data.topic}".

The podcast covered the following ${subTopics.length} sub-topics:
${subTopics.map((topic, i) => `${i+1}. ${topic}`).join('\n')}

The final segment ended with:
${segmentScripts[segmentScripts.length-1].slice(-300)}

Below I've provided comprehensive research on all sub-topics, but for this task, I only need you to create the CONCLUSION segment that ties everything together.

RESEARCH REFERENCE (for context only - you're writing the CONCLUSION):
${allResearch.substring(0, 5000)}`;  // Limit research for conclusion to 5000 chars

      const conclusionResponse = await anthropic.messages.create({
        model: "claude-3-7-sonnet-20250219",
        max_tokens: 4000,
        temperature: 0.7,
        system: conclusionSystemPrompt,
        messages: [{ role: "user", content: conclusionUserPrompt }]
      });

      // Extract conclusion script
      const conclusionScript = conclusionResponse.content[0].type === 'text' 
        ? conclusionResponse.content[0].text 
        : "Error generating conclusion";
        
      segmentScripts.push(conclusionScript);
      log("Conclusion segment generated successfully");

      return segmentScripts;
    } catch (error: any) {
      log(`Error generating extended podcast segments: ${error.message}`);
      throw new Error(`Failed to generate podcast segments: ${error.message}`);
    }
  }
  
  // Function to generate extended content with web research
  async function generateExtendedContent(
    data: z.infer<typeof contentResearchSchema>,
    res: Response
  ) {
    try {
      // Add memory optimization - limit content size and segments
      if (data.extendedMode && data.totalSegments > 5) {
        return res.status(400).json({
          error: "Maximum of 5 segments allowed to prevent server overload"
        });
      }
      
      // Ensure prompt isn't too long
      if (data.prompt && data.prompt.length > 5000) {
        return res.status(400).json({
          error: "Prompt exceeds maximum length of 5,000 characters"
        });
      }
    
      // Create a job for extended content generation
      const jobId = createProcessingJob('podcast', {
        type: 'podcast',
        step: 'Analyzing topic and planning sub-topics',
        progress: 5
      });
      
      // Check if Perplexity API key is available
      if (!process.env.PERPLEXITY_API_KEY) {
        updateProcessingJob(jobId, {
          status: 'error',
          error: 'Perplexity API key is not available. Please add your PERPLEXITY_API_KEY to the environment variables.'
        });
        return res.status(500).json({
          error: 'Perplexity API key is missing'
        });
      }
      
      // Step 1: Generate sub-topics for research
      log(`Generating sub-topics for content on: ${data.topic}`);
      updateProcessingJob(jobId, {
        step: 'Generating research sub-topics',
        progress: 10
      });
      
      // Generate sub-topics using Claude
      try {
        const anthropic = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY
        });
        
        const subTopicPrompt = `
        I need to create a comprehensive ${data.contentType} on "${data.topic}".
        
        To research this thoroughly, I need a list of ${data.totalSegments} specific sub-topics or angles to explore.
        
        Each sub-topic should:
        1. Cover a distinct aspect of the main topic
        2. Be specific enough for focused research
        3. Together, provide comprehensive coverage
        4. Be arranged in a logical sequence
        
        Return ONLY the numbered list of ${data.totalSegments} search queries, one per line. 
        No introduction or explanation needed.
        `;
        
        const message = await anthropic.messages.create({
          model: "claude-3-7-sonnet-20250219",
          max_tokens: 500,
          temperature: 0.5,
          system: "You are a research planning assistant who helps formulate effective research questions.",
          messages: [{ role: "user", content: subTopicPrompt }]
        });
        
        // Extract sub-topics
        const contentBlock = message.content[0];
        const subTopicsContent = typeof contentBlock === 'string' ? contentBlock : 'text' in contentBlock ? contentBlock.text : '';
        const subTopics = subTopicsContent.trim()
          .split('\n')
          .map((line: string) => line.trim())
          .filter((line: string) => line.length > 0)
          .map((line: string) => line.replace(/^\d+[\.\)]\s*/, '').trim());
        
        if (subTopics.length === 0) {
          throw new Error('Failed to generate valid sub-topics');
        }
        
        // Adjust array to match requested segments
        const adjustedSubTopics = subTopics.slice(0, data.totalSegments);
        
        // Update job with sub-topics
        updateProcessingJob(jobId, {
          step: 'Researching sub-topics with Perplexity Sonar Pro',
          progress: 15,
          subTopics: adjustedSubTopics
        });
        
        // Step 2: Research each sub-topic with Perplexity
        log(`Researching ${adjustedSubTopics.length} sub-topics with Perplexity`);
        
        // Prepare research queries by combining main topic with each sub-topic
        const researchQueries = adjustedSubTopics.map(
          (subTopic: string) => `${data.topic}: ${subTopic}`
        );
        
        // Execute searches for all sub-topics
        const allResearchResults = await executeMultipleSearches(researchQueries);
        const combinedResearch = allResearchResults.join('\n\n=== NEXT RESEARCH SECTION ===\n\n');
        
        // Update job with research results
        updateProcessingJob(jobId, {
          step: 'Generating content based on research',
          progress: 40,
          // Store the combined research in a single-item array to match the type
          searchResults: [combinedResearch]
        });
        
        // Step 3: Generate the first segment
        log(`Generating first content segment for "${data.topic}"`);
        
        // Create prompt for the first segment
        const firstSegmentPrompt = `
        I need you to create the first segment of a ${data.totalSegments}-part ${data.contentType} about "${data.topic}".
        
        The content should follow these instructions:
        ${data.systemPrompt}
        
        Here's the research information to incorporate:
        ${combinedResearch.substring(0, 12000)} # Limit the context for the first segment
        
        This is segment 1 of ${data.totalSegments}, so it should:
        - Start with an engaging introduction to the overall topic
        - Primarily focus on ${adjustedSubTopics[0]}
        - Set up a natural transition to the next segment
        - Be coherent and well-structured on its own
        
        Write the content from scratch in your own words while integrating insights from the research.
        `;
        
        // Generate first segment with Claude
        const firstSegmentMessage = await anthropic.messages.create({
          model: "claude-3-7-sonnet-20250219",
          max_tokens: data.maxOutputTokens,
          temperature: data.temperature,
          system: "You are an expert content creator named Arion Vale. You craft engaging, authentic, and insightful content.",
          messages: [{ role: "user", content: firstSegmentPrompt }]
        });
        
        // Extract the generated content
        const content = firstSegmentMessage.content[0];
        const firstSegmentContent = typeof content === 'string' ? content : 'text' in content ? content.text : '';
        
        // Update job status
        updateProcessingJob(jobId, {
          status: 'complete',
          progress: 50,
          script: firstSegmentContent
        });
        
        // Return the results
        return res.json({
          jobId,
          content: firstSegmentContent,
          subTopics: adjustedSubTopics,
          researchResults: combinedResearch,
          segment: 1,
          totalSegments: data.totalSegments
        });
        
      } catch (error) {
        // Handle error
        updateProcessingJob(jobId, {
          status: 'error',
          error: error.message || "Failed to generate extended content"
        });
        
        return res.status(500).json({
          error: `Failed to generate extended content: ${error.message}`
        });
      }
    } catch (error) {
      log(`Error in generateExtendedContent: ${error.message}`);
      return res.status(500).json({
        error: `Failed to generate extended content: ${error.message}`
      });
    }
  }

  const httpServer = createServer(app);
  return httpServer;
}