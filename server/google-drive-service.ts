import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

interface GoogleDriveConfig {
  serviceAccountKey: string;
  folderId: string;
}

interface UploadResult {
  fileId: string;
  webViewLink: string;
  webContentLink: string;
}

class GoogleDriveService {
  private drive: any;
  private folderId: string;
  private isConfigured: boolean = false;

  constructor() {
    this.initializeService();
  }

  private initializeService() {
    try {
      const serviceAccountKey = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY;
      const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

      if (!serviceAccountKey || !folderId) {
        console.log('[GoogleDrive] Service not configured - missing credentials');
        return;
      }

      // Parse the service account key
      const credentials = JSON.parse(serviceAccountKey);
      
      // Create JWT auth client
      const auth = new google.auth.JWT(
        credentials.client_email,
        undefined,
        credentials.private_key,
        ['https://www.googleapis.com/auth/drive.file']
      );

      this.drive = google.drive({ version: 'v3', auth });
      this.folderId = folderId;
      this.isConfigured = true;
      
      console.log('[GoogleDrive] Service initialized successfully');
    } catch (error) {
      console.error('[GoogleDrive] Failed to initialize:', error instanceof Error ? error.message : String(error));
      this.isConfigured = false;
    }
  }

  public isReady(): boolean {
    return this.isConfigured;
  }

  public async uploadAudioFile(filePath: string, title: string): Promise<UploadResult | null> {
    if (!this.isConfigured) {
      console.log('[GoogleDrive] Service not configured, skipping upload');
      return null;
    }

    try {
      const fileName = `${title}.mp3`;
      const fileMetadata = {
        name: fileName,
        parents: [this.folderId],
      };

      const media = {
        mimeType: 'audio/mpeg',
        body: fs.createReadStream(filePath),
      };

      console.log(`[GoogleDrive] Starting upload of ${fileName}...`);

      const response = await this.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id,webViewLink,webContentLink',
      });

      const result: UploadResult = {
        fileId: response.data.id,
        webViewLink: response.data.webViewLink,
        webContentLink: response.data.webContentLink,
      };

      console.log(`[GoogleDrive] Upload successful - File ID: ${result.fileId}`);
      return result;

    } catch (error) {
      console.error('[GoogleDrive] Upload failed:', error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  public async createFolder(name: string, parentFolderId?: string): Promise<string | null> {
    if (!this.isConfigured) {
      return null;
    }

    try {
      const fileMetadata = {
        name: name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentFolderId ? [parentFolderId] : [this.folderId],
      };

      const response = await this.drive.files.create({
        resource: fileMetadata,
        fields: 'id',
      });

      console.log(`[GoogleDrive] Created folder "${name}" with ID: ${response.data.id}`);
      return response.data.id;

    } catch (error) {
      console.error('[GoogleDrive] Failed to create folder:', error instanceof Error ? error.message : String(error));
      return null;
    }
  }
}

export const googleDriveService = new GoogleDriveService();