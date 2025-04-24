import { log } from "./vite";
import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";

// Interface for generating content
export interface GenerateContentOptions {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxOutputTokens?: number;
  topK?: number;
  topP?: number;
  images?: string[]; // Base64-encoded images
}

export interface GenerateContentResult {
  text: string;
  usage?: {
    promptTokens: number;
    responseTokens: number;
    totalTokens: number;
  };
}

// Initialize the Gemini client
let geminiClient: GenerativeModel | null = null;

// Initialize the Gemini client with API key
export function initGeminiClient() {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }

    // Create the client
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Get the generative model - use experimental version for newest features
    // @ts-ignore - apiVersion is supported but not in types
    geminiClient = genAI.getGenerativeModel({
      model: "gemini-2.5-pro-exp-03-25",
      apiVersion: "v1beta"
    });
    
    log("Gemini client initialized successfully");
    return true;
  } catch (error: any) {
    log(`Error initializing Gemini client: ${error.message}`);
    return false;
  }
}

/**
 * Generate content using Gemini 2.5 Pro via the official SDK
 */
export async function generateGeminiContent(options: GenerateContentOptions, onStream?: (text: string) => void): Promise<GenerateContentResult> {
  try {
    // Initialize client if not already initialized
    if (!geminiClient) {
      const success = initGeminiClient();
      if (!success) {
        throw new Error("Failed to initialize Gemini client");
      }
    }
    
    log(`Generating content with Gemini 2.5 Pro: ${options.prompt.substring(0, 100)}...`);
    
    // Prepare content parts
    const contentParts: any[] = [{ text: options.prompt }];
    
    // Add images if provided
    if (options.images && options.images.length > 0) {
      for (const imageData of options.images) {
        contentParts.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: imageData
          }
        });
      }
    }
    
    // Configuration for the generation
    const generationConfig = {
      temperature: options.temperature || 0.7,
      topK: options.topK || 40,
      topP: options.topP || 0.95,
      maxOutputTokens: options.maxOutputTokens || 1000,
    };
    
    // Handle system prompt if provided
    if (options.systemPrompt && geminiClient) {
      // When using system prompt, we need to use a chat session
      const chat = geminiClient.startChat({
        generationConfig,
        history: [
          {
            role: "user",
            parts: [{ text: options.systemPrompt }],
          },
          {
            role: "model",
            parts: [{ text: "I'll follow your instructions." }],
          },
        ],
      });
      
      // Send the actual message
      const result = await chat.sendMessage(contentParts);
      const response = result.response;
      
      // Get the text response
      const responseText = response.text();
      
      // Check if the response is empty and provide a helpful error message
      if (!responseText || responseText.trim() === "") {
        log("Gemini returned an empty response");
        return {
          text: "I apologize, but I wasn't able to generate a response for that query. This might be due to content safety filters or limitations in my training. Could you try rephrasing your question?",
        };
      }
      
      return {
        text: responseText,
        // Usage metrics aren't directly available in the SDK
      };
    } else if (geminiClient) {
      // For simple prompts without a system instruction
      const result = await geminiClient.generateContent({
        contents: [{ role: "user", parts: contentParts }],
        generationConfig,
      });
      
      const response = result.response;
      
      // Get the text response
      const responseText = response.text();
      
      // Check if the response is empty and provide a helpful error message
      if (!responseText || responseText.trim() === "") {
        log("Gemini returned an empty response");
        return {
          text: "I apologize, but I wasn't able to generate a response for that query. This might be due to content safety filters or limitations in my training. Could you try rephrasing your question?",
        };
      }
      
      return {
        text: responseText,
        // Usage metrics aren't directly available in the SDK
      };
    } else {
      throw new Error("Gemini client not initialized properly");
    }
  } catch (error: any) {
    log(`Error generating content with Gemini 2.5 Pro: ${error.message || "Unknown error"}`);
    throw new Error(`Failed to generate content: ${error.message || "Unknown error"}`);
  }
}