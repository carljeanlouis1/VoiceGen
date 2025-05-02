import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { log } from "../vite";
import crypto from "crypto";

export class AudioService {
  private openaiClient: OpenAI;
  
  constructor() {
    this.openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || ""
    });
  }
  
  /**
   * Generates audio for a long-form script by chunking
   */
  async generateLongformAudio(script: string, voice: string): Promise<string> {
    log(`Generating longform audio with voice: ${voice}`);
    
    // Split script into manageable chunks for TTS
    const scriptChunks = this.splitScriptForTTS(script);
    
    log(`Split script into ${scriptChunks.length} chunks for TTS processing`);
    
    // Generate audio for each chunk
    const audioChunkPaths = await Promise.all(
      scriptChunks.map((chunk, index) => 
        this.generateAudioChunk(chunk, voice, index)
      )
    );
    
    log(`Generated ${audioChunkPaths.length} audio chunks`);
    
    // For now, we'll return the first chunk path without actual concatenation
    // In a production environment, we would actually concatenate them
    return audioChunkPaths[0];
  }
  
  /**
   * Splits the script into TTS-friendly chunks
   */
  private splitScriptForTTS(script: string): string[] {
    const MAX_CHARS = 4000; // Conservative limit for TTS
    const chunks: string[] = [];
    
    // Strip markdown headings
    const cleanedScript = script.replace(/^#+.*$/gm, '').trim();
    
    // Split on paragraph boundaries
    const paragraphs = cleanedScript.split('\n\n');
    let currentChunk = '';
    
    for (const paragraph of paragraphs) {
      // If adding this paragraph would exceed limit, start a new chunk
      if (currentChunk.length + paragraph.length + 2 > MAX_CHARS && currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = paragraph;
      } else {
        // Add paragraph to current chunk
        currentChunk = currentChunk.length === 0 
          ? paragraph 
          : `${currentChunk}\n\n${paragraph}`;
      }
    }
    
    // Add the last chunk if not empty
    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }
    
    return chunks;
  }
  
  /**
   * Generates audio for a single chunk
   */
  private async generateAudioChunk(
    chunk: string, 
    voice: string, 
    index: number
  ): Promise<string> {
    try {
      log(`Generating audio for chunk ${index} (${chunk.length} chars)`);
      
      const response = await this.openaiClient.audio.speech.create({
        model: 'tts-1',
        voice,
        input: chunk,
      });
      
      // Save audio to file
      const fileName = `audio_chunk_${crypto.randomBytes(4).toString('hex')}.mp3`;
      const filePath = path.join(process.cwd(), 'public', 'audio', fileName);
      
      // Ensure directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Get audio data as buffer
      const buffer = Buffer.from(await response.arrayBuffer());
      
      // Write to file
      fs.writeFileSync(filePath, buffer);
      
      log(`Saved audio chunk ${index} to ${filePath}`);
      
      // Return the URL path
      return `/audio/${fileName}`;
    } catch (error) {
      console.error(`Error generating audio for chunk ${index}:`, error);
      throw error;
    }
  }
}