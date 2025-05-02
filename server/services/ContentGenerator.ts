import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { ContentChunk, ContentSection, PodcastProject } from "../../shared/schema";
import { log } from "../vite";

interface ChunkPlan {
  sections: ContentSection[];
  totalTokens: number;
  position: number;
}

export class ContentGenerator {
  private openaiClient: OpenAI;
  private anthropicClient: Anthropic;
  
  constructor() {
    this.openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || ""
    });
    
    this.anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || "",
    });
  }
  
  /**
   * Generates a content chunk with overlapping context
   */
  async generateContentChunk(params: {
    project: PodcastProject;
    chunkPlan: ChunkPlan;
    previousContext: string;
    isFirstChunk: boolean;
    isLastChunk: boolean;
    relativePosition: number;
  }): Promise<ContentChunk> {
    const { 
      project, 
      chunkPlan, 
      previousContext, 
      isFirstChunk, 
      isLastChunk,
      relativePosition 
    } = params;
    
    log(`Generating content chunk at position ${chunkPlan.position} (relative: ${relativePosition.toFixed(2)})`);
    
    // Extract relevant narrative guidance from the full guide
    const narrativeGuidance = this.extractNarrativeGuidance(
      project.narrativeGuide || "",
      relativePosition,
      isFirstChunk,
      isLastChunk
    );
    
    // Format sections for the prompt
    const sectionsFormatted = chunkPlan.sections.map(section => `
SECTION: ${section.title}
KEY POINTS:
${section.keyPoints.map(point => `- ${point}`).join('\n')}
${section.talkingPoints ? `TALKING POINTS:\n${section.talkingPoints.map(point => `- ${point}`).join('\n')}` : ''}
    `).join('\n\n');
    
    // Create the generation prompt
    const prompt = `
You are Arion Vale, an engaging podcast host. You're creating ${isFirstChunk ? "the introduction" : isLastChunk ? "the conclusion" : "a middle segment"} of a podcast on "${project.topic}".

${previousContext ? "CONTEXT FROM PREVIOUS CONTENT (continue naturally from this):\n" + previousContext : ""}

NARRATIVE GUIDANCE (to maintain flow and continuity):
${narrativeGuidance}

${isFirstChunk ? "Start with an engaging hook that draws listeners in and introduces the topic in a compelling way." : ""}
${isLastChunk ? "End with a satisfying conclusion that ties everything together and leaves listeners with something meaningful to reflect on." : ""}

In this segment, cover these sections:
${sectionsFormatted}

Write in a conversational, natural style as if you're speaking directly to listeners. Include:
1. Smooth transitions between points
2. References to earlier content when relevant (${isFirstChunk ? "foreshadow what's to come" : "refer back to earlier points"})
3. Natural speech patterns with contractions and occasional pauses (...)
4. Engaging analogies or examples to illustrate complex ideas
5. Occasional rhetorical questions to engage the listener

IMPORTANT: 
- Your content should flow naturally from any preceding content
- Don't repeat information already covered
- Maintain consistent terminology and tone throughout
- Write the script as spoken content, not as an essay

Write ONLY the podcast script content, not section headers or notes.
`;

    try {
      const { model } = project;
      console.log(`Using model ${model} for content generation`);
      
      // Always use the selected AI model for content generation
      let content = "";
      
      // Use the selected model for generation
      try {
        if (model === "claude") {
          // Use Claude 3.7 Sonnet
          log(`Generating content with Claude for position ${chunkPlan.position}`);
          const response = await this.anthropicClient.messages.create({
            model: 'claude-3-7-sonnet-20250219', // the newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
            max_tokens: 4000,
            system: "You are Arion Vale, an engaging podcast host. Write only the podcast script content, no headers or notes.",
            messages: [{ role: 'user', content: prompt }]
          });
          
          // Get the text from Claude's response
          content = typeof response.content[0] === 'object' && 'text' in response.content[0] 
            ? response.content[0].text 
            : JSON.stringify(response.content[0]);
        } else {
          // Use GPT-4o
          log(`Generating content with GPT-4o for position ${chunkPlan.position}`);
          const response = await this.openaiClient.chat.completions.create({
            model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
            max_tokens: 4000,
            messages: [
              { 
                role: "system", 
                content: "You are Arion Vale, an engaging podcast host. Write only the podcast script content, no headers or notes."
              },
              { role: "user", content: prompt }
            ]
          });
          
          content = response.choices[0].message.content || "";
        }
        
        log(`Successfully generated content with ${model} model: ${content.substring(0, 100)}...`);
      } catch (aiError) {
        console.error(`Error using ${model} model for content generation: ${aiError}`);
        log(`Error using ${model} model for content generation: ${aiError}`);
        
        // Fallback to minimal content in case of API errors
        log("Using fallback content due to API error");
        content = "I'm Arion Vale, and today we're exploring " + project.topic + ". " +
          "Unfortunately, we encountered a technical issue with our content generation. " +
          "Please try again or contact support if this issue persists.";
      }
      
      // If content is empty for some reason, use hardcoded fallback content
      if (!content) {
        log("Content is empty, using hardcoded fallback content");
        
        if (isFirstChunk) {
          content = `Welcome to Horizons of Innovation, I'm your host Arion Vale. In today's episode, we're diving deep into ${project.topic}.`;
        } else if (isLastChunk) {
          content = `As we conclude our exploration of ${project.topic}, I hope you've gained valuable insights. Thank you for joining me on this journey. I'm Arion Vale, and this has been Horizons of Innovation.`;
        } else {
          content = `Let's continue our discussion of ${project.topic} by examining some key aspects that make this topic so fascinating and important.`;
        }
      }
      
      // Create the chunk record
      return {
        id: `chunk-${chunkPlan.position}`,
        position: chunkPlan.position,
        sectionIds: chunkPlan.sections.map(s => s.id),
        content,
        overlapStart: previousContext || undefined,
        modelUsed: model === 'claude' ? 'claude-3-7-sonnet' : 'gpt-4o',
        generatedAt: new Date(),
        contextUsed: `Position: ${relativePosition.toFixed(2)}, First: ${isFirstChunk}, Last: ${isLastChunk}`
      };
    } catch (error) {
      console.error(`Error generating content chunk: ${error}`);
      throw new Error(`Failed to generate content chunk: ${error}`);
    }
  }
  
  /**
   * Extracts position-specific guidance from the narrative guide
   */
  private extractNarrativeGuidance(
    narrativeGuide: string,
    relativePosition: number,
    isFirstChunk: boolean,
    isLastChunk: boolean
  ): string {
    // Extract relevant parts from the narrative guide based on the position
    
    // For simplicity, here's a position-based approach
    if (isFirstChunk) {
      return `OPENING STAGE: Establish the main themes and questions. Use an inviting, curious tone that draws listeners in and hints at what's to come. Create intrigue and set expectations.`;
    } else if (isLastChunk) {
      return `CONCLUSION STAGE: Bring everything together. Reference key insights from throughout the podcast. Provide synthesis and meaningful takeaways. End with something thought-provoking.`;
    } else if (relativePosition < 0.33) {
      return `EARLY DEVELOPMENT: Build on the introduction. Start deepening the exploration of key concepts. Provide context and background that will be important later.`;
    } else if (relativePosition < 0.66) {
      return `MAIN EXPLORATION: This is the core of the podcast. Fully explore the key concepts with detailed examples and insights. Make connections between ideas introduced earlier.`;
    } else {
      return `SYNTHESIS STAGE: Begin connecting the ideas explored earlier. Highlight patterns and insights. Start preparing for the conclusion.`;
    }
  }
}