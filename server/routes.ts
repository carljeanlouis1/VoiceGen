import type { Express } from "express";
import { createServer, type Server } from "http";
import OpenAI from "openai";
import { storage } from "./storage";
import { textToSpeechSchema } from "@shared/schema";
import { z } from "zod";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/text-to-speech", async (req, res) => {
    try {
      const data = textToSpeechSchema.parse(req.body);
      
      const speech = await openai.audio.speech.create({
        model: "tts-1",
        voice: data.voice,
        input: data.text
      });

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

      res.json(audioFile);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors[0].message });
      } else {
        res.status(500).json({ message: "Failed to convert text to speech" });
      }
    }
  });

  app.get("/api/library", async (_req, res) => {
    try {
      const files = await storage.getAudioFiles();
      res.json(files);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch library" });
    }
  });

  app.delete("/api/library/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteAudioFile(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete audio file" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
