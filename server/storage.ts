
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
    this.client = new Client();
    this.audioFiles = new Map();
    this.currentId = 1;
    this.loadFromStorage();
  }

  private async loadFromStorage() {
    try {
      const data = await this.client.download_from_text("audiofiles.json");
      const files = JSON.parse(data);
      this.audioFiles = new Map(files.map((f: AudioFile) => [f.id, { ...f, createdAt: new Date(f.createdAt) }]));
      this.currentId = Math.max(...Array.from(this.audioFiles.keys()), 0) + 1;
    } catch (error) {
      // Initialize empty if no existing data
      this.audioFiles = new Map();
      this.currentId = 1;
    }
  }

  private async saveToStorage() {
    const files = Array.from(this.audioFiles.values());
    await this.client.upload_from_text("audiofiles.json", JSON.stringify(files));
  }

  async getAudioFiles(): Promise<AudioFile[]> {
    return Array.from(this.audioFiles.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getAudioFile(id: number): Promise<AudioFile | undefined> {
    return this.audioFiles.get(id);
  }

  async createAudioFile(insertFile: InsertAudioFile): Promise<AudioFile> {
    const id = this.currentId++;
    const audioFile: AudioFile = {
      ...insertFile,
      id,
      createdAt: new Date()
    };
    this.audioFiles.set(id, audioFile);
    await this.saveToStorage();
    return audioFile;
  }

  async deleteAudioFile(id: number): Promise<void> {
    this.audioFiles.delete(id);
    await this.saveToStorage();
  }
}

export const storage = new ObjectStorage();
