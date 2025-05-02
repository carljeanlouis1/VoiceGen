import { PodcastProject, PodcastStatus, PodcastStructure, ContentChunk } from "../../shared/schema";
import { ResearchService } from "./ResearchService";
import { NarrativeService } from "./NarrativeService";
import { ContentGenerator } from "./ContentGenerator";
import { CompilationService } from "./CompilationService";
import { AudioService } from "./AudioService";
import { log } from "../vite";
import crypto from "crypto";

// In-memory storage for projects
const projectsMap = new Map<string, PodcastProject>();

interface ChunkPlan {
  sections: any[];
  totalTokens: number;
  position: number;
}

export class PodcastProjectManager {
  private researchService: ResearchService;
  private narrativeService: NarrativeService;
  private contentGenerator: ContentGenerator;
  private compilationService: CompilationService;
  private audioService: AudioService;
  
  constructor() {
    this.researchService = new ResearchService();
    this.narrativeService = new NarrativeService();
    this.contentGenerator = new ContentGenerator();
    this.compilationService = new CompilationService();
    this.audioService = new AudioService();
  }
  
  /**
   * Creates a new podcast project and initiates the generation process
   */
  async createPodcast(params: {
    topic: string;
    targetDuration: number;
    voice: string;
  }): Promise<string> {
    const projectId = this.generateUUID();
    
    log(`Creating new podcast project with ID ${projectId} for topic: "${params.topic}"`);
    
    // Initialize project
    const project: PodcastProject = {
      id: projectId,
      topic: params.topic,
      targetDuration: params.targetDuration,
      voice: params.voice,
      status: 'initializing',
      createdAt: new Date(),
      updatedAt: new Date(),
      progress: 0
    };
    
    // Save initial project
    await this.saveProject(project);
    
    // Start async generation process
    this.generatePodcast(projectId).catch(error => {
      console.error(`Error generating podcast ${projectId}:`, error);
      this.updateProjectStatus(projectId, 'failed');
    });
    
    return projectId;
  }
  
  /**
   * Main podcast generation pipeline
   */
  private async generatePodcast(projectId: string): Promise<void> {
    try {
      // 1. Research Phase
      await this.performResearch(projectId);
      
      // 2. Planning Phase
      await this.createPodcastPlan(projectId);
      
      // 3. Content Generation Phase
      await this.generateContent(projectId);
      
      // 4. Compilation Phase
      await this.compileFinalScript(projectId);
      
      // 5. Audio Conversion Phase
      await this.generateAudio(projectId);
      
      // Update project as complete
      await this.updateProjectStatus(projectId, 'complete', 100);
      
      log(`Podcast generation completed for project ${projectId}`);
      
    } catch (error) {
      console.error(`Error in podcast generation pipeline for ${projectId}:`, error);
      await this.updateProjectStatus(projectId, 'failed');
      throw error;
    }
  }
  
  /**
   * Step 1: Research Phase - Topic analysis and web research
   */
  private async performResearch(projectId: string): Promise<void> {
    await this.updateProjectStatus(projectId, 'researching', 5);
    
    // Get project data
    const project = await this.getProject(projectId);
    
    // 1.1 Analyze topic using Claude to break it down
    const topicAnalysis = await this.researchService.analyzeTopicWithClaude(project.topic);
    await this.updateProject(projectId, {
      researchData: {
        topicAnalysis,
        mainResearch: [],
        segmentResearch: {}
      },
      progress: 10
    });
    
    // 1.2 Perform initial research using Perplexity
    const researchQueries = this.extractResearchQueries(topicAnalysis);
    const mainResearch = await this.researchService.performBatchResearch(researchQueries);
    await this.updateProject(projectId, {
      researchData: {
        ...project.researchData!,
        mainResearch
      },
      progress: 20
    });
  }
  
  /**
   * Step 2: Planning Phase - Create podcast structure and narrative guide
   */
  private async createPodcastPlan(projectId: string): Promise<void> {
    await this.updateProjectStatus(projectId, 'planning', 25);
    
    // Get project data
    const project = await this.getProject(projectId);
    
    if (!project.researchData) {
      throw new Error("Research data not available");
    }
    
    // 2.1 Create podcast structure using Claude
    const podcastStructure = await this.narrativeService.createPodcastStructure(
      project.topic,
      project.researchData.topicAnalysis,
      project.researchData.mainResearch,
      project.targetDuration
    );
    
    await this.updateProject(projectId, { 
      podcastStructure,
      progress: 30
    });
    
    // 2.2 Create narrative guide using Claude
    const narrativeGuide = await this.narrativeService.createNarrativeGuide(
      project.topic,
      podcastStructure
    );
    
    await this.updateProject(projectId, { 
      narrativeGuide,
      progress: 35 
    });
    
    // 2.3 Perform segment-specific research for deeper content
    const segmentResearch: Record<string, any[]> = {};
    
    for (const segment of podcastStructure.mainSegments) {
      const segmentQueries = [
        `${project.topic} ${segment.title}`,
        ...segment.sections.map(s => `${project.topic} ${s.title}`)
      ];
      
      const research = await this.researchService.performBatchResearch(segmentQueries);
      segmentResearch[segment.id] = research;
      
      // Incremental progress update
      const progressIncrement = 15 / podcastStructure.mainSegments.length;
      const updatedProgress = Math.min(50, project.progress + progressIncrement);
      
      await this.updateProject(projectId, { 
        progress: updatedProgress,
        researchData: {
          ...project.researchData,
          segmentResearch
        }
      });
    }
  }
  
  /**
   * Step 3: Content Generation Phase - Generate content with overlapping windows
   */
  private async generateContent(projectId: string): Promise<void> {
    await this.updateProjectStatus(projectId, 'generating', 55);
    
    // Get project data
    const project = await this.getProject(projectId);
    
    if (!project.podcastStructure) {
      throw new Error("Podcast structure not available");
    }
    
    // 3.1 Calculate chunk strategy based on token estimates
    const chunkingStrategy = this.planContentChunks(
      project.podcastStructure, 
      project.targetDuration
    );
    
    // 3.2 Generate content chunks with overlapping windows
    const contentChunks: ContentChunk[] = [];
    let currentContext = ""; // Initial context is empty
    
    for (const [index, chunkPlan] of chunkingStrategy.entries()) {
      // Generate content for this chunk
      const chunk = await this.contentGenerator.generateContentChunk({
        project,
        chunkPlan,
        previousContext: currentContext,
        isFirstChunk: index === 0,
        isLastChunk: index === chunkingStrategy.length - 1,
        relativePosition: index / chunkingStrategy.length
      });
      
      contentChunks.push(chunk);
      
      // Update context for next chunk (use end of current chunk)
      const OVERLAP_SIZE = 1000; // characters to keep as context
      currentContext = chunk.content.slice(-OVERLAP_SIZE);
      
      // Store overlap information
      if (index < chunkingStrategy.length - 1) {
        chunk.overlapEnd = currentContext;
      }
      
      // Update progress incrementally
      const progressIncrement = 30 / chunkingStrategy.length;
      const updatedProgress = Math.min(85, project.progress + progressIncrement);
      
      await this.updateProject(projectId, {
        contentChunks,
        progress: updatedProgress
      });
    }
  }
  
  /**
   * Step 4: Compilation Phase - Assemble the final script
   */
  private async compileFinalScript(projectId: string): Promise<void> {
    await this.updateProjectStatus(projectId, 'compiling', 90);
    
    // Get project data
    const project = await this.getProject(projectId);
    
    if (!project.contentChunks || !project.podcastStructure) {
      throw new Error("Content chunks or podcast structure not available");
    }
    
    // Compile the final script from content chunks
    const finalScript = await this.compilationService.compileFinalScript(
      project.contentChunks,
      project.podcastStructure
    );
    
    // Update project with final script
    await this.updateProject(projectId, {
      finalScript,
      progress: 95
    });
  }
  
  /**
   * Step 5: Audio Conversion Phase - Generate audio
   */
  private async generateAudio(projectId: string): Promise<void> {
    await this.updateProjectStatus(projectId, 'converting', 96);
    
    // Get project data
    const project = await this.getProject(projectId);
    
    if (!project.finalScript) {
      throw new Error("Final script not available");
    }
    
    // Generate audio from the script
    const audioUrl = await this.audioService.generateLongformAudio(
      project.finalScript,
      project.voice
    );
    
    // Update project with audio URL
    await this.updateProject(projectId, {
      audioUrl,
      progress: 100
    });
  }
  
  /**
   * Plans how to divide content into chunks for generation
   */
  private planContentChunks(
    structure: PodcastStructure,
    targetDuration: number
  ): ChunkPlan[] {
    const TOKENS_PER_MINUTE = 750; // Approximate tokens for 1 minute of audio
    const MAX_CHUNK_SIZE = 3000; // Target tokens per generation (excluding overlap)
    
    // Flatten all sections
    const allSections = [
      structure.introduction,
      ...structure.mainSegments.flatMap(segment => segment.sections),
      structure.conclusion
    ];
    
    const chunkPlans: ChunkPlan[] = [];
    let currentChunk: ChunkPlan = {
      sections: [],
      totalTokens: 0,
      position: 0
    };
    
    // Group sections into chunks respecting token limits
    for (const section of allSections) {
      const sectionTokens = section.estimatedTokens || 
                          (section.estimatedDuration * TOKENS_PER_MINUTE);
      
      // If adding this section would exceed our chunk size and we already have content,
      // save current chunk and start a new one
      if (currentChunk.totalTokens > 0 && 
          currentChunk.totalTokens + sectionTokens > MAX_CHUNK_SIZE) {
        chunkPlans.push(currentChunk);
        
        currentChunk = {
          sections: [section],
          totalTokens: sectionTokens,
          position: chunkPlans.length
        };
      } else {
        // Add section to current chunk
        currentChunk.sections.push(section);
        currentChunk.totalTokens += sectionTokens;
      }
    }
    
    // Add the final chunk if it has any sections
    if (currentChunk.sections.length > 0) {
      chunkPlans.push(currentChunk);
    }
    
    return chunkPlans;
  }
  
  // Helper methods for project management
  async saveProject(project: PodcastProject): Promise<void> {
    projectsMap.set(project.id, project);
  }
  
  async getProject(projectId: string): Promise<PodcastProject> {
    const project = projectsMap.get(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }
    return project;
  }
  
  async updateProject(
    projectId: string, 
    updates: Partial<PodcastProject>
  ): Promise<void> {
    const project = await this.getProject(projectId);
    const updatedProject = { ...project, ...updates, updatedAt: new Date() };
    await this.saveProject(updatedProject);
  }
  
  async updateProjectStatus(
    projectId: string, 
    status: PodcastStatus, 
    progress?: number
  ): Promise<void> {
    const updates: Partial<PodcastProject> = { 
      status, 
      updatedAt: new Date()
    };
    
    if (progress !== undefined) {
      updates.progress = progress;
    }
    
    if (status === 'complete') {
      updates.completedAt = new Date();
    }
    
    await this.updateProject(projectId, updates);
  }
  
  private extractResearchQueries(topicAnalysis: any): string[] {
    return topicAnalysis.mainAreas.flatMap((area: any) => area.researchQuestions);
  }
  
  private generateUUID(): string {
    return crypto.randomBytes(16).toString('hex');
  }
  
  // Public methods for API endpoints
  
  /**
   * Gets a list of all podcast projects
   */
  async getAllProjects(): Promise<PodcastProject[]> {
    return Array.from(projectsMap.values());
  }
  
  /**
   * Deletes a podcast project
   */
  async deleteProject(projectId: string): Promise<void> {
    if (!projectsMap.has(projectId)) {
      throw new Error(`Project not found: ${projectId}`);
    }
    projectsMap.delete(projectId);
  }
}