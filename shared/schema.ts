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
  extendedMode: z.boolean().default(false), // Extended podcast mode flag
});

// Content research and generation schema
export const contentResearchSchema = z.object({
  topic: z.string().min(1, "Topic is required"),
  contentType: z.string(), // "story", "article", "tedTalk", "custom"
  systemPrompt: z.string(),
  temperature: z.number().min(0).max(1).default(0.7),
  maxOutputTokens: z.number().min(100).max(8000).default(4000),
  segment: z.number().default(1),
  totalSegments: z.number().default(1),
  previousContent: z.string().optional(),
  searchResults: z.string().optional(),
  extendedMode: z.boolean().default(false),
  images: z.array(z.string()).optional(),
});

// Maximum characters per chunk for OpenAI's TTS
export const MAX_CHUNK_SIZE = 4000;