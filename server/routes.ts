import type { Express } from "express";
import { createServer, type Server } from "http";
import OpenAI from "openai";
import { storage } from "./storage";
import { textToSpeechSchema } from "@shared/schema";
import { z } from "zod";
import { log } from "./vite";

const openai = new OpenAI();

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY environment variable is required");
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/text-to-speech", async (req, res) => {
    try {
      const data = textToSpeechSchema.parse(req.body);

      log(`Converting text to speech: ${data.title} (${data.text.length} characters)`);

      const speech = await openai.audio.speech.create({
        model: "tts-1",
        voice: data.voice,
        input: data.text
      });

      log("Audio generation successful, converting to base64");

      // Convert audio to base64
      const audioBuffer = Buffer.from(await speech.arrayBuffer());
      const audioUrl = `data:audio/mp3;base64,${audioBuffer.toString('base64')}`;

      const audioFile = await storage.createAudioFile({
        title: data.title,
        text: data.text,
        voice: data.voice,
        audioUrl,
        duration: Math.ceil(audioBuffer.length / 16000) // Approximate duration
      });

      log(`Audio file created: ${audioFile.id}`);
      res.json(audioFile);
    } catch (error) {
      log(`Error in text-to-speech: ${error.message}`);

      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0].message });
      } else if (error instanceof OpenAI.APIError) {
        res.status(error.status || 500).json({ 
          message: error.message || "OpenAI API error occurred"
        });
      } else {
        console.error("Unexpected error:", error);
        res.status(500).json({ 
          message: "An unexpected error occurred while converting text to speech"
        });
      }
    }
  });

  app.get("/api/library", async (_req, res) => {
    try {
      const files = await storage.getAudioFiles();
      res.json(files);
    } catch (error) {
      log(`Error fetching library: ${error.message}`);
      res.status(500).json({ message: "Failed to fetch library" });
    }
  });

  app.delete("/api/library/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteAudioFile(id);
      res.status(204).send();
    } catch (error) {
      log(`Error deleting audio file ${req.params.id}: ${error.message}`);
      res.status(500).json({ message: "Failed to delete audio file" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}