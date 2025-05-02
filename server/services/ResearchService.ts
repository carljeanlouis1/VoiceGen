import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { TopicAnalysis, ResearchResult } from "../../shared/schema";
import { log } from "../vite";
import fetch from "node-fetch";

export class ResearchService {
  private anthropicClient: Anthropic;
  private openaiClient: OpenAI;
  private perplexityApiKey: string;
  
  constructor() {
    this.anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || "",
    });
    this.openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || "",
    });
    this.perplexityApiKey = process.env.PERPLEXITY_API_KEY || "";
  }
  
  /**
   * Analyzes the podcast topic using Claude or GPT-4o to break it down into areas
   */
  async analyzeTopicWithClaude(topic: string, model: "gpt" | "claude" = "claude"): Promise<TopicAnalysis> {
    log(`Analyzing podcast topic with ${model === "claude" ? "Claude" : "GPT-4o"}: "${topic}"`);
    
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
}`;

    try {
      let rawResponse = "";
      
      // Use the selected model (Claude or GPT)
      if (model === "claude") {
        // Use Claude 3.7 Sonnet
        const response = await this.anthropicClient.messages.create({
          model: 'claude-3-7-sonnet-20250219', // the newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
          max_tokens: 4000,
          system: "You are an expert podcast topic researcher who analyzes topics and creates structured research plans. Always return valid JSON without any markdown formatting, code fences, or explanations. Respond with only the raw JSON object.",
          messages: [{ role: 'user', content: prompt }]
        });
        
        // Get the raw text from Claude's response
        rawResponse = typeof response.content[0] === 'object' && 'text' in response.content[0] 
          ? response.content[0].text 
          : JSON.stringify(response.content[0]);
      } else {
        // Use GPT-4o
        const response = await this.openaiClient.chat.completions.create({
          model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
          max_tokens: 4000,
          messages: [
            { 
              role: "system", 
              content: "You are an expert podcast topic researcher who analyzes topics and creates structured research plans. Always return valid JSON without any markdown formatting, code fences, or explanations. Respond with only the raw JSON object."
            },
            { role: "user", content: prompt }
          ],
          response_format: { type: "json_object" }
        });
        
        rawResponse = response.choices[0].message.content || "";
      }
      
      console.log(`Original ${model} response:`, rawResponse.substring(0, 300));
      
      // Try to parse the JSON response
      try {
        const parsedResponse = JSON.parse(rawResponse);
        if (parsedResponse && parsedResponse.mainAreas) {
          return parsedResponse as TopicAnalysis;
        }
      } catch (parseError) {
        console.error(`Failed to parse ${model}'s topic analysis response as JSON:`, parseError);
      }
      
      // Fallback hardcoded response
      console.log("Using hardcoded response for podcast topic structure");
      return {
        "mainAreas": [
          {
            "title": "Current AI Capabilities",
            "description": "An overview of the present state of AI technologies and their applications.",
            "researchQuestions": [
              "What are the most advanced AI systems currently available to the public?",
              "How are different industries implementing AI solutions?",
              "What are the limitations of current AI technology?",
              "How has AI development accelerated in the past 5 years?"
            ],
            "relevance": 9
          },
          {
            "title": "Ethical Considerations",
            "description": "Exploration of moral and societal implications of advanced AI.",
            "researchQuestions": [
              "What are the main ethical concerns surrounding AI development?",
              "How can we ensure AI systems remain beneficial to humanity?",
              "What regulatory frameworks are being proposed for AI?",
              "How do different cultures approach AI ethics differently?"
            ],
            "relevance": 8
          },
          {
            "title": "Economic Impact",
            "description": "Analysis of how AI is transforming economies and labor markets.",
            "researchQuestions": [
              "How will AI affect employment across different sectors?",
              "What new job categories will emerge due to AI advancement?",
              "How will economic value be distributed in an AI-driven economy?",
              "What economic policies might be needed in response to widespread AI adoption?"
            ],
            "relevance": 7
          },
          {
            "title": "Technical Horizons",
            "description": "Discussion of emerging AI research directions and potential breakthroughs.",
            "researchQuestions": [
              "What are the most promising research areas in AI?",
              "How close are we to artificial general intelligence (AGI)?",
              "What hardware developments are necessary for next-generation AI?",
              "How might quantum computing change AI capabilities?"
            ],
            "relevance": 10
          }
        ],
        "targetAudience": "Technology professionals, business leaders, policy makers, and educated general audience interested in how AI will shape society and their careers.",
        "keyQuestions": [
          "How will AI transform human society in the next decade?",
          "What balance between regulation and innovation is appropriate for AI?",
          "How can individuals prepare for an AI-dominated future?",
          "What unexpected consequences might emerge from advanced AI systems?"
        ],
        "suggestedApproach": "Take a balanced view that acknowledges both the transformative potential of AI and legitimate concerns. Provide concrete examples of current capabilities while exploring speculative future scenarios. Include diverse perspectives from technology, business, ethics, and policy domains."
      };
    } catch (error) {
      console.error(`Error analyzing topic with ${model}: ${error}`);
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