//import * as genai from "@google/genai";
import { GoogleGenAI } from "@google/genai";
import { log } from "./vite";

// Use environment variable for the API key
const apiKey = process.env.GEMINI_API_KEY || "";

if (!apiKey) {
  throw new Error("GEMINI_API_KEY environment variable is required");
}

// Initialize the Gemini API client
const genAI = new GoogleGenAI(apiKey);

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

/**
 * Generate content using Gemini 2.5 Pro
 */
export async function generateGeminiContent(options: GenerateContentOptions): Promise<GenerateContentResult> {
  try {
    log(`Generating content with Gemini 2.5 Pro: ${options.prompt.substring(0, 100)}...`);
    
    // Use Gemini 2.5 Pro model
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-pro-exp-03-25", // Experimental Gemini 2.5 Pro model
      generationConfig: {
        temperature: options.temperature || 0.7,
        maxOutputTokens: options.maxOutputTokens || 4000,
        topK: options.topK || 40,
        topP: options.topP || 0.95,
      },
    });
    
    // Prepare parts array for the content
    const parts: any[] = [{text: options.prompt}];
    
    // Add images if provided
    if (options.images && options.images.length > 0) {
      for (const imageData of options.images) {
        parts.push({
          inlineData: {
            data: imageData,
            mimeType: "image/jpeg", // Assuming JPEG format
          },
        });
      }
    }
    
    try {
      // Add system prompt if provided
      if (options.systemPrompt) {
        const chatSession = model.startChat({
          generationConfig: {
            temperature: options.temperature || 0.7,
            maxOutputTokens: options.maxOutputTokens || 4000,
          },
          history: [
            {
              role: "user",
              parts: [{text: options.systemPrompt}],
            },
            {
              role: "model",
              parts: [{text: "I'll follow your instructions."}],
            },
          ],
        });
        
        const result = await chatSession.sendMessage(parts);
        const response = await result.response;
        const text = response.text();
        
        return { text };
      } else {
        // Standard request without system prompt
        const result = await model.generateContent({
          contents: [{ parts }],
        });
        
        const response = await result.response;
        const text = response.text();
        
        return { text };
      }
    } catch (error: any) {
      log(`Error in Gemini API call: ${error.message || "Unknown error"}`);
      throw error;
    }
  } catch (error: any) {
    log(`Error generating content with Gemini 2.5 Pro: ${error.message || "Unknown error"}`);
    throw new Error(`Failed to generate content: ${error.message || "Unknown error"}`);
  }
}