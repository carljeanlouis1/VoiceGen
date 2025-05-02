import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const audioFiles = pgTable("audio_files", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  text: text("text").notNull(),
  voice: text("voice").notNull(),
  audioUrl: text("audio_url").notNull(),
  duration: integer("duration").notNull(),
  summary: text("summary"),
  artworkUrl: text("artwork_url"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

export const insertAudioFileSchema = createInsertSchema(audioFiles).pick({
  title: true,
  text: true,
  voice: true,
  audioUrl: true,
  duration: true,
  summary: true,
  artworkUrl: true
});

export type InsertAudioFile = z.infer<typeof insertAudioFileSchema>;
export type AudioFile = typeof audioFiles.$inferSelect;

export const AVAILABLE_VOICES = [
  "alloy",
  "echo",
  "fable",
  "onyx",
  "nova",
  "shimmer"
] as const;

export const textToSpeechSchema = z.object({
  title: z.string().min(1, "Title is required"),
  text: z.string().min(1, "Text is required"),
  voice: z.enum(AVAILABLE_VOICES, {
    errorMap: () => ({ message: "Please select a valid voice" })
  }),
  generateArtwork: z.boolean().default(false)
});

// Podcast script generation schema
export const podcastScriptSchema = z.object({
  topic: z.string().min(1, "Topic is required"),
  model: z.enum(["gpt", "claude"]),
  targetDuration: z.number().min(1).max(60),
  voice: z.enum(AVAILABLE_VOICES),
  part: z.number().optional(),
  totalParts: z.number().optional(),
  previousPartContent: z.string().optional(),
  searchResults: z.string().optional(),
});

// Enhanced podcast project schema for long-form content
export type PodcastStatus = 
  | 'initializing'
  | 'researching' 
  | 'planning'
  | 'generating'
  | 'compiling'
  | 'converting'
  | 'complete'
  | 'failed';

export interface TopicArea {
  title: string;
  description: string;
  researchQuestions: string[];
  relevance: number; // 1-10 importance score
}

export interface TopicAnalysis {
  mainAreas: TopicArea[];
  targetAudience: string;
  keyQuestions: string[];
  suggestedApproach: string;
}

export interface ResearchResult {
  query: string;
  results: any[];
  summary: string;
}

export interface ResearchData {
  topicAnalysis: TopicAnalysis;
  mainResearch: ResearchResult[];
  segmentResearch: Record<string, ResearchResult[]>;
}

export interface ContentSection {
  id: string;
  title: string;
  keyPoints: string[];
  talkingPoints: string[];
  estimatedDuration: number;
  estimatedTokens: number;
}

export interface ContentSegment {
  id: string;
  title: string;
  sections: ContentSection[];
  estimatedDuration: number;
  estimatedTokens: number;
}

export interface PodcastStructure {
  title: string;
  introduction: ContentSection;
  mainSegments: ContentSegment[];
  conclusion: ContentSection;
  estimatedDuration: number;
  estimatedTokens: number;
}

export interface ContentChunk {
  id: string;
  position: number;
  sectionIds: string[];
  content: string;
  overlapStart?: string; // Overlap with previous chunk
  overlapEnd?: string; // Overlap with next chunk
  modelUsed: 'gpt-4o' | 'claude-3-7-sonnet';
  generatedAt: Date;
  contextUsed: string; // Description of context used for this generation
}

export interface PodcastProject {
  id: string;
  topic: string;
  targetDuration: number; // minutes
  voice: string; // TTS voice option
  status: PodcastStatus;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  
  // Process data
  researchData?: ResearchData;
  narrativeGuide?: string;
  podcastStructure?: PodcastStructure;
  contentChunks?: ContentChunk[];
  finalScript?: string;
  audioUrl?: string;
  
  // Metrics/tracking
  progress: number; // 0-100%
  estimatedTokensUsed?: number;
  estimatedCost?: number;
}

// Enhanced podcast project creation schema
export const enhancedPodcastProjectSchema = z.object({
  topic: z.string().min(1, "Topic is required"),
  targetDuration: z.number().min(5).max(60),
  voice: z.enum(AVAILABLE_VOICES),
});

// Maximum characters per chunk for OpenAI's TTS
export const MAX_CHUNK_SIZE = 4000;