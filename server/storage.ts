
import { type AudioFile, type InsertAudioFile } from "@shared/schema";
import { Client } from "@replit/object-storage";

export interface IStorage {
  getAudioFiles(): Promise<AudioFile[]>;
  getAudioFile(id: number): Promise<AudioFile | undefined>;
  createAudioFile(file: InsertAudioFile): Promise<AudioFile>;
  deleteAudioFile(id: number): Promise<void>;
}

export class ObjectStorage implements IStorage {
  private client: Client;
  private audioFiles: Map<number, AudioFile>;
  private currentId: number;

  constructor() {
    try {
      this.client = new Client();
      this.audioFiles = new Map();
      this.currentId = 1;
      // Use async/await pattern with immediate invocation
      (async () => {
        try {
          await this.loadFromStorage();
        } catch (loadError) {
          console.error("Failed to load from storage:", loadError);
        }
      })();
    } catch (error) {
      console.error("Failed to initialize storage:", error);
      // Fallback to memory storage if object storage fails
      this.audioFiles = new Map();
      this.currentId = 1;
    }
  }

  private async loadFromStorage() {
    try {
      // Check if the file exists first
      const exists = await this.client.head("audiofiles.json").catch(() => false);
      
      if (exists) {
        const response = await this.client.get("audiofiles.json");
        if (response && response.length > 0) {
          const text = Buffer.from(response).toString('utf-8');
          try {
            const files = JSON.parse(text);
            this.audioFiles = new Map(files.map((f: AudioFile) => [f.id, { 
              ...f, 
              createdAt: new Date(f.createdAt) 
            }]));
            this.currentId = Math.max(...Array.from(this.audioFiles.keys()), 0) + 1;
            return;
          } catch (parseError) {
            console.error("Error parsing storage data:", parseError);
          }
        }
      }
      
      // Initialize empty if no existing data or if parsing failed
      this.audioFiles = new Map();
      this.currentId = 1;
      
      // Create an initial empty file in storage
      await this.saveToStorage();
      
    } catch (error) {
      console.error("Error loading from storage:", error);
      // Initialize empty if any error occurs
      this.audioFiles = new Map();
      this.currentId = 1;
    }
  }

  private async saveToStorage() {
    try {
      const files = Array.from(this.audioFiles.values());
      await this.client.put("audiofiles.json", JSON.stringify(files));
    } catch (error) {
      console.error("Error saving to storage:", error);
      throw error;
    }
  }

  async getAudioFiles(): Promise<AudioFile[]> {
    return Array.from(this.audioFiles.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getAudioFile(id: number): Promise<AudioFile | undefined> {
    return this.audioFiles.get(id);
  }

  async createAudioFile(insertFile: InsertAudioFile): Promise<AudioFile> {
    try {
      const id = this.currentId++;
      const audioFile: AudioFile = {
        ...insertFile,
        id,
        createdAt: new Date()
      };
      this.audioFiles.set(id, audioFile);
      await this.saveToStorage();
      return audioFile;
    } catch (error) {
      console.error("Error creating audio file:", error);
      throw error;
    }
  }

  async deleteAudioFile(id: number): Promise<void> {
    try {
      this.audioFiles.delete(id);
      await this.saveToStorage();
    } catch (error) {
      console.error("Error deleting audio file:", error);
      throw error;
    }
  }
}

export const storage = new ObjectStorage();
