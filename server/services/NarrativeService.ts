import Anthropic from "@anthropic-ai/sdk";
import { TopicAnalysis, ResearchResult, PodcastStructure } from "../../shared/schema";
import { log } from "../vite";
import crypto from "crypto";

export class NarrativeService {
  private anthropicClient: Anthropic;
  
  constructor() {
    this.anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || "",
    });
  }
  
  /**
   * Creates the podcast structure with Claude
   */
  async createPodcastStructure(
    topic: string,
    topicAnalysis: TopicAnalysis,
    mainResearch: ResearchResult[],
    targetDuration: number
  ): Promise<PodcastStructure> {
    log(`Creating podcast structure for topic: "${topic}" with target duration: ${targetDuration} minutes`);
    
    // Prepare research summaries to include in prompt
    const researchSummary = mainResearch.map(r => 
      `Query: ${r.query}\nSummary: ${r.summary}`
    ).join("\n\n");
    
    const prompt = `
You are an expert podcast producer. Your task is to create a detailed structure for a ${targetDuration}-minute podcast on the topic: "${topic}".

Here is the topic analysis:
${JSON.stringify(topicAnalysis, null, 2)}

Here is a summary of research on this topic:
${researchSummary}

Create a podcast structure with:
1. An engaging introduction (1-2 minutes)
2. 4-6 main segments that build a compelling narrative
3. A conclusion that ties everything together (1-2 minutes)

For each segment and section:
1. Provide a clear title
2. List key points to cover
3. List specific talking points (sentences or phrases to include)
4. Estimate the duration (in minutes)
5. Estimate tokens needed (approx. 750 tokens per minute)

Make sure each segment has a clear purpose and flows naturally from the previous one.
Ensure you're creating content for "Arion Vale" - an engaging, thoughtful podcast host with a conversational style.

Format your response as a structured JSON object following this schema:
{
  "title": "string",
  "introduction": {
    "id": "string",
    "title": "string",
    "keyPoints": ["string"],
    "talkingPoints": ["string"],
    "estimatedDuration": number,
    "estimatedTokens": number
  },
  "mainSegments": [
    {
      "id": "string",
      "title": "string",
      "sections": [
        {
          "id": "string",
          "title": "string",
          "keyPoints": ["string"],
          "talkingPoints": ["string"],
          "estimatedDuration": number,
          "estimatedTokens": number
        }
      ],
      "estimatedDuration": number,
      "estimatedTokens": number
    }
  ],
  "conclusion": {
    "id": "string",
    "title": "string",
    "keyPoints": ["string"],
    "talkingPoints": ["string"],
    "estimatedDuration": number,
    "estimatedTokens": number
  },
  "estimatedDuration": number,
  "estimatedTokens": number
}

Ensure the total duration adds up to approximately ${targetDuration} minutes.
Ensure all IDs are unique strings.
`;

    try {
      const response = await this.anthropicClient.messages.create({
        model: 'claude-3-7-sonnet-20250219',
        max_tokens: 4000,
        system: "You are an expert podcast producer who creates detailed, well-structured podcast outlines. Always return valid JSON without any markdown formatting, code fences, or explanations. Respond with only the raw JSON object.",
        messages: [{ role: 'user', content: prompt }]
      });
      
      try {
        // Handle the structure of the response content
        let responseText = typeof response.content[0] === 'object' && 'text' in response.content[0] 
          ? response.content[0].text 
          : JSON.stringify(response.content[0]);
          
        console.log("Original Claude structure response:", responseText.substring(0, 300));
        
        // Extract JSON from the response using regex to find content between code fences
        const jsonRegex = /```(?:json)?\s*({[\s\S]*?})\s*```/;
        const jsonMatch = responseText.match(jsonRegex);
        
        if (jsonMatch && jsonMatch[1]) {
          responseText = jsonMatch[1].trim();
          console.log("Extracted JSON within code fences:", responseText.substring(0, 100) + "...");
        } else {
          // If no code fences found, try to find a JSON object directly
          const directJsonMatch = responseText.match(/({[\s\S]*})/);
          if (directJsonMatch && directJsonMatch[1]) {
            responseText = directJsonMatch[1].trim();
            console.log("Extracted direct JSON:", responseText.substring(0, 100) + "...");
          }
        }
        
        // Try to parse the extracted JSON
        let structure;
        try {
          structure = JSON.parse(responseText);
        } catch (innerError) {
          console.error("First JSON parse attempt failed:", innerError);
          
          // If the direct parse fails, look for the first { and last }
          const firstBrace = responseText.indexOf('{');
          const lastBrace = responseText.lastIndexOf('}');
          
          if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
            const possibleJson = responseText.substring(firstBrace, lastBrace + 1);
            console.log("Attempting with extracted JSON object:", possibleJson.substring(0, 100) + "...");
            structure = JSON.parse(possibleJson);
          } else {
            throw innerError;
          }
        }
        
        // Ensure IDs are unique if they aren't already
        structure.introduction.id = structure.introduction.id || `intro-${this.generateId()}`;
        structure.conclusion.id = structure.conclusion.id || `conclusion-${this.generateId()}`;
        
        for (const segment of structure.mainSegments) {
          segment.id = segment.id || `segment-${this.generateId()}`;
          
          for (const section of segment.sections) {
            section.id = section.id || `section-${this.generateId()}`;
          }
        }
        
        return structure;
      } catch (error) {
        console.error("Failed to parse Claude's podcast structure response as JSON:", error);
        throw new Error("Invalid response format from podcast structure generation");
      }
    } catch (error) {
      console.error(`Error creating podcast structure: ${error}`);
      throw new Error(`Failed to create podcast structure: ${error}`);
    }
  }
  
  /**
   * Creates a narrative guide for the podcast using Claude
   */
  async createNarrativeGuide(
    topic: string,
    structure: PodcastStructure
  ): Promise<string> {
    log(`Creating narrative guide for topic: "${topic}"`);
    
    const prompt = `
You are an expert podcast narrative designer. Your task is to create a comprehensive narrative guide for a ${structure.estimatedDuration}-minute podcast titled "${structure.title}" on the topic: "${topic}".

The podcast has this structure:
${JSON.stringify(structure, null, 2)}

Create a narrative guide that:
1. Establishes the overall "story arc" of this podcast
2. Identifies 3-5 key themes that should recur throughout
3. Establishes the voice and tone (as "Arion Vale", an engaging, conversational podcast host)
4. Notes how earlier segments should foreshadow later ones
5. Describes how later segments should callback to earlier ones
6. Suggests metaphors, analogies, or examples that could work across segments
7. Defines the audience journey from start to finish

This guide will be used to ensure all segments of the podcast maintain narrative continuity and flow naturally together, even when generated separately.
`;

    try {
      const response = await this.anthropicClient.messages.create({
        model: 'claude-3-7-sonnet-20250219',
        max_tokens: 4000,
        system: "You are an expert podcast narrative designer who creates comprehensive guides for narrative flow and continuity.",
        messages: [{ role: 'user', content: prompt }]
      });
      
      // Handle the structure of the response content
      if (typeof response.content[0] === 'object' && 'text' in response.content[0]) {
        return response.content[0].text;
      }
      return JSON.stringify(response.content[0]);
    } catch (error) {
      console.error(`Error creating narrative guide: ${error}`);
      throw new Error(`Failed to create narrative guide: ${error}`);
    }
  }
  
  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return crypto.randomBytes(4).toString('hex');
  }
}