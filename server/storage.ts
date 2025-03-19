import { type AudioFile, type InsertAudioFile } from "@shared/schema";

export interface IStorage {
  getAudioFiles(): Promise<AudioFile[]>;
  getAudioFile(id: number): Promise<AudioFile | undefined>;
  createAudioFile(file: InsertAudioFile): Promise<AudioFile>;
  deleteAudioFile(id: number): Promise<void>;
}

export class MemStorage implements IStorage {
  private audioFiles: Map<number, AudioFile>;
  private currentId: number;

  constructor() {
    this.audioFiles = new Map();
    this.currentId = 1;
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
    return audioFile;
  }

  async deleteAudioFile(id: number): Promise<void> {
    this.audioFiles.delete(id);
  }
}

export const storage = new MemStorage();
