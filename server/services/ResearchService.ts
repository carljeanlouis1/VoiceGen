import Anthropic from "@anthropic-ai/sdk";
import { TopicAnalysis, ResearchResult } from "../../shared/schema";
import { log } from "../vite";
import fetch from "node-fetch";

export class ResearchService {
  private anthropicClient: Anthropic;
  private perplexityApiKey: string;
  
  constructor() {
    this.anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || "",
    });
    this.perplexityApiKey = process.env.PERPLEXITY_API_KEY || "";
  }
  
  /**
   * Analyzes the podcast topic using Claude to break it down into areas
   */
  async analyzeTopicWithClaude(topic: string): Promise<TopicAnalysis> {
    log(`Analyzing podcast topic with Claude: "${topic}"`);
    
    const prompt = `
You are an expert podcast researcher. Your task is to analyze the following podcast topic: "${topic}".

Create a comprehensive research plan by:
1. Breaking down the topic into 4-5 main areas to cover
2. For each area, identify 3-5 specific research questions
3. Identify the target audience for this topic
4. Suggest potential angles, approaches, or controversies to explore
5. Rate each area's relevance on a scale of 1-10

Format your response as a structured JSON object with the following schema:
{
  "mainAreas": [
    {
      "title": "string",
      "description": "string",
      "researchQuestions": ["string"],
      "relevance": number
    }
  ],
  "targetAudience": "string",
  "keyQuestions": ["string"],
  "suggestedApproach": "string"
}
`;

    try {
      const response = await this.anthropicClient.messages.create({
        model: 'claude-3-7-sonnet-20250219',
        max_tokens: 4000,
        system: "You are an expert podcast topic researcher who analyzes topics and creates structured research plans. Always return valid JSON without any markdown formatting, code fences, or explanations. Respond with only the raw JSON object.",
        messages: [{ role: 'user', content: prompt }]
      });
      
      try {
        // Handle the structure of the response content
        let responseText = typeof response.content[0] === 'object' && 'text' in response.content[0] 
          ? response.content[0].text 
          : JSON.stringify(response.content[0]);
          
        console.log("Original Claude response:", responseText.substring(0, 300));
        
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
                
        // As a last resort, try to parse the entire response
        try {
          return JSON.parse(responseText);
        } catch (innerError) {
          console.error("First JSON parse attempt failed:", innerError);
          
          // If the direct parse fails, look for the first { and last }
          const firstBrace = responseText.indexOf('{');
          const lastBrace = responseText.lastIndexOf('}');
          
          if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
            const possibleJson = responseText.substring(firstBrace, lastBrace + 1);
            console.log("Attempting with extracted JSON object:", possibleJson.substring(0, 100) + "...");
            return JSON.parse(possibleJson);
          }
          
          throw innerError;
        }
      } catch (error) {
        console.error("Failed to parse Claude's topic analysis response as JSON:", error);
        throw new Error("Invalid response format from topic analysis");
      }
    } catch (error) {
      console.error(`Error analyzing topic with Claude: ${error}`);
      throw new Error(`Failed to analyze topic: ${error}`);
    }
  }
  
  /**
   * Performs a batch of research queries using Perplexity
   */
  async performBatchResearch(queries: string[]): Promise<ResearchResult[]> {
    log(`Performing batch research for ${queries.length} queries`);
    const results: ResearchResult[] = [];
    
    for (const query of queries) {
      try {
        const searchResults = await this.performPerplexitySearch(query);
        
        results.push({
          query,
          results: searchResults.results || [],
          summary: searchResults.answer || "No summary available."
        });
        
        log(`Research completed for query: "${query}"`);
      } catch (error) {
        console.error(`Error performing research for query "${query}":`, error);
        // Add empty result to maintain query order
        results.push({
          query,
          results: [],
          summary: `Research failed for this query: ${error}`
        });
      }
    }
    
    return results;
  }
  
  /**
   * Performs a search using Perplexity API
   */
  private async performPerplexitySearch(query: string): Promise<{ answer: string, results: any[], citations: string[] }> {
    log(`Searching with Perplexity API for: "${query}"`);
    
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
        search_depth: "deep"
      }
    };
    
    try {
      const perplexityResponse = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.perplexityApiKey}`
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!perplexityResponse.ok) {
        const errorText = await perplexityResponse.text();
        log(`Perplexity API error details: ${errorText.substring(0, 200)}...`);
        throw new Error(`Failed to get research results: ${perplexityResponse.status}`);
      }
      
      const data = await perplexityResponse.json();
      
      let answer = "";
      let citations: string[] = [];
      
      if (data.choices && data.choices.length > 0 && data.choices[0].message) {
        answer = data.choices[0].message.content || "";
      } else {
        throw new Error("Unexpected Perplexity API response format");
      }
      
      if (data.citations && Array.isArray(data.citations)) {
        citations = data.citations;
      }
      
      return {
        answer,
        results: [{ content: answer, citations }],
        citations
      };
    } catch (error) {
      console.error(`Error searching with Perplexity: ${error}`);
      throw new Error(`Perplexity search failed: ${error}`);
    }
  }
}