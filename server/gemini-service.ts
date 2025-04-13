import { log } from "./vite";
import { generateGeminiContent } from "./gemini-client";

// Re-export the interface for compatibility
interface GenerateContentOptions {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxOutputTokens?: number;
  topK?: number;
  topP?: number;
  images?: string[]; // Base64-encoded images
}

interface GenerateContentResult {
  text: string;
  usage?: {
    promptTokens: number;
    responseTokens: number;
    totalTokens: number;
  };
}

// Re-export the generateGeminiContent function
export { generateGeminiContent };