
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
      (async () => {
        try {
          await this.loadFromStorage();
        } catch (loadError) {
          console.error("Failed to load from storage:", loadError);
        }
      })();
    } catch (error) {
      console.error("Failed to initialize storage:", error);
      this.audioFiles = new Map();
      this.currentId = 1;
    }
  }

  private async loadFromStorage() {
    try {
      const response = await this.client.get_object("audiofiles.json");
      
      let text;
      if (response instanceof Buffer) {
        text = response.toString('utf-8');
      } else if (response instanceof Uint8Array) {
        text = Buffer.from(response).toString('utf-8');
      } else if (typeof response === 'string') {
        text = response;
      } else {
        text = Buffer.from(response as any).toString('utf-8');
      }
      
      if (!text || text.trim() === '') {
        this.audioFiles = new Map();
        this.currentId = 1;
        return;
      }
      
      const files = JSON.parse(text);
      this.audioFiles = new Map(files.map((f: AudioFile) => [f.id, { ...f, createdAt: new Date(f.createdAt) }]));
      this.currentId = Math.max(...Array.from(this.audioFiles.keys()), 0) + 1;
    } catch (error) {
      console.error("Error loading from storage:", error);
      this.audioFiles = new Map();
      this.currentId = 1;
    }
  }

  private async saveToStorage() {
    try {
      const files = Array.from(this.audioFiles.values());
      const jsonData = JSON.stringify(files);
      await this.client.put_object("audiofiles.json", jsonData);
    } catch (error) {
      console.error("Error saving to storage:", error);
      throw new Error(`Failed to save to storage: ${error.message}`);
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
      throw new Error(`Failed to create audio file: ${error.message}`);
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
