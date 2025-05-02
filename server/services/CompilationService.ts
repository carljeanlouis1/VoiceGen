import { ContentChunk, PodcastStructure } from "../../shared/schema";
import { log } from "../vite";

export class CompilationService {
  /**
   * Compiles the final script from content chunks
   */
  async compileFinalScript(
    contentChunks: ContentChunk[],
    structure: PodcastStructure
  ): Promise<string> {
    log(`Compiling final script from ${contentChunks.length} chunks`);
    
    // Sort chunks by position
    const orderedChunks = [...contentChunks].sort((a, b) => a.position - b.position);
    
    // 1. Direct assembly with intelligent overlap management
    const rawScript = this.assembleWithOverlapManagement(orderedChunks);
    
    // 2. Add structure elements (timestamps, chapter markers, etc.)
    const formattedScript = this.addFormattingElements(rawScript, structure);
    
    log(`Compiled script with ${formattedScript.length} characters`);
    
    return formattedScript;
  }
  
  /**
   * Assembles chunks with intelligent overlap handling
   */
  private assembleWithOverlapManagement(chunks: ContentChunk[]): string {
    if (chunks.length === 0) {
      return "";
    }
    
    if (chunks.length === 1) {
      return chunks[0].content;
    }
    
    let assembledScript = chunks[0].content;
    
    // For each subsequent chunk, find intelligent joining point
    for (let i = 1; i < chunks.length; i++) {
      const prevChunk = chunks[i - 1];
      const currentChunk = chunks[i];
      
      // Get the overlap between chunks (if available)
      const overlapEnd = prevChunk.overlapEnd || "";
      const overlapStart = currentChunk.overlapStart || "";
      
      if (!overlapEnd || !overlapStart) {
        // No overlap information, simple concatenation
        assembledScript += "\n\n" + currentChunk.content;
        continue;
      }
      
      // Find where to join the chunks
      const joinPosition = this.findOptimalJoinPosition(
        assembledScript,
        currentChunk.content,
        overlapEnd
      );
      
      if (joinPosition > 0) {
        // Join at the optimal position
        assembledScript = assembledScript.substring(0, joinPosition) + 
                         currentChunk.content.substring(
                           this.findOverlapEndPosition(currentChunk.content, overlapStart)
                         );
      } else {
        // Fallback: add with a paragraph break
        assembledScript += "\n\n" + currentChunk.content;
      }
    }
    
    return assembledScript;
  }
  
  /**
   * Finds optimal position to join two chunks
   */
  private findOptimalJoinPosition(text1: string, text2: string, overlap: string): number {
    if (!overlap || overlap.length < 20) {
      return -1;
    }
    
    // Look for the overlap at the end of text1
    const overlapPosition = text1.lastIndexOf(overlap);
    if (overlapPosition >= 0) {
      return overlapPosition;
    }
    
    // If exact match not found, try sentence boundaries in the last 25% of text1
    const lastQuarter = text1.substring(Math.floor(text1.length * 0.75));
    const sentences = lastQuarter.split(/(?<=[.!?])\s+/);
    
    if (sentences.length <= 1) {
      return -1;
    }
    
    // Try to find a good sentence boundary
    const lastCompleteSentencePosition = text1.lastIndexOf(sentences[sentences.length - 2]);
    if (lastCompleteSentencePosition > 0) {
      return lastCompleteSentencePosition + sentences[sentences.length - 2].length;
    }
    
    return -1;
  }
  
  /**
   * Finds where overlap ends in the second chunk
   */
  private findOverlapEndPosition(text: string, overlap: string): number {
    if (!overlap || overlap.length < 20) {
      return 0;
    }
    
    const overlapPosition = text.indexOf(overlap);
    if (overlapPosition >= 0) {
      return overlapPosition + overlap.length;
    }
    
    return 0;
  }
  
  /**
   * Adds formatting elements to the script
   */
  private addFormattingElements(script: string, structure: PodcastStructure): string {
    let formattedScript = `# ${structure.title}\n\n`;
    
    // Add introduction header
    formattedScript += `## Introduction: ${structure.introduction.title}\n\n`;
    
    // Split the script into approximate segments based on estimated durations
    const totalDuration = structure.estimatedDuration;
    const scriptLength = script.length;
    const charsPerMinute = scriptLength / totalDuration;
    
    let currentPosition = 0;
    let currentTime = 0;
    
    // Add introduction (estimated)
    const introLength = Math.floor(structure.introduction.estimatedDuration * charsPerMinute);
    formattedScript += script.substring(0, introLength) + "\n\n";
    currentPosition += introLength;
    currentTime += structure.introduction.estimatedDuration;
    
    // Add main segments with timestamps
    for (const segment of structure.mainSegments) {
      // Add segment header with timestamp
      const timestamp = this.formatTimestamp(currentTime);
      formattedScript += `## [${timestamp}] ${segment.title}\n\n`;
      
      // Add segment content (estimated)
      const segmentLength = Math.floor(segment.estimatedDuration * charsPerMinute);
      const segmentEndPosition = Math.min(currentPosition + segmentLength, scriptLength);
      
      formattedScript += script.substring(currentPosition, segmentEndPosition) + "\n\n";
      
      currentPosition = segmentEndPosition;
      currentTime += segment.estimatedDuration;
    }
    
    // Add conclusion with timestamp
    const conclusionTimestamp = this.formatTimestamp(currentTime);
    formattedScript += `## [${conclusionTimestamp}] Conclusion: ${structure.conclusion.title}\n\n`;
    
    // Add remaining script as conclusion
    formattedScript += script.substring(currentPosition);
    
    return formattedScript;
  }
  
  /**
   * Formats a timestamp
   */
  private formatTimestamp(minutes: number): string {
    const hrs = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }
}