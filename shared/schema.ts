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

// Content Plan interfaces for structured podcast generation
export interface ContentPlanSubtopic {
  title: string;
  key_points: string[];
  research_prompt: string;
  estimated_duration: number;
}

export interface ContentPlan {
  topic: string;
  targetDuration: number;
  subtopics: ContentPlanSubtopic[];
  narrative_arc: string;
  tone_guidelines: string;
  transitions: string[];
  introduction: string;
  conclusion: string;
}

// Content Plan schema for validation
export const contentPlanSchema = z.object({
  topic: z.string().min(1, "Topic is required"),
  targetDuration: z.number().min(5).max(60),
  researchDepth: z.number().min(1).max(4).default(1)
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
  // Adding content plan support
  contentPlan: z.record(z.any()).optional(),
  subtopicIndex: z.number().optional(),
  generateAudio: z.boolean().default(false)
});

// Maximum characters per chunk for OpenAI's TTS
export const MAX_CHUNK_SIZE = 4000;