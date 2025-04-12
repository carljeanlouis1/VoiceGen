import { GoogleGenerativeAI } from '@google/genai';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configure the generative AI instance with your API key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function run() {
  try {
    // Use Gemini Pro model
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    
    // Generate a simple text response
    const prompt = "Write a haiku about programming";
    console.log(`Sending prompt: ${prompt}`);
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log("Generated text:");
    console.log(text);
  } catch (error) {
    console.error("Error:", error.message);
    console.error(error);
  }
}

run();