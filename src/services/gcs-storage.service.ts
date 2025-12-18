import { Storage } from '@google-cloud/storage';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Google Cloud Storage service for uploading transition frames
 */
export class GCSStorageService {
  private storage: Storage;
  private bucketName: string;
  private bucketPath: string;

  constructor() {
    this.bucketName = process.env.GCS_BUCKET_NAME || '';
    this.bucketPath = process.env.GCS_BUCKET_PATH || 'uploads';

    if (!this.bucketName) {
      throw new Error('GCS_BUCKET_NAME environment variable is required. Please set it in your .env file.');
    }

    // Initialize storage with credentials if provided
    const credentialsPath = process.env.GCS_CREDENTIALS_PATH;

    if (credentialsPath && fs.existsSync(credentialsPath)) {
      this.storage = new Storage({
        keyFilename: credentialsPath,
      });
      console.log(`  ✓ GCS initialized with credentials from: ${credentialsPath}`);
    } else {
      // Fall back to Application Default Credentials (gcloud auth)
      this.storage = new Storage();
      console.log(`  ✓ GCS initialized with Application Default Credentials`);
    }
  }

  /**
   * Uploads an image to GCS and returns the public URL
   */
  async uploadImage(
    localFilePath: string,
    remoteFileName?: string
  ): Promise<string> {
    try {
      if (!fs.existsSync(localFilePath)) {
        throw new Error(`File not found: ${localFilePath}`);
      }

      // Generate remote filename if not provided
      const fileName = remoteFileName || path.basename(localFilePath);
      const destination = `${this.bucketPath}/${fileName}`;

      console.log(`  ↳ Uploading to GCS: gs://${this.bucketName}/${destination}`);

      // Upload file directly - GCS SDK handles its own retries
      await this.storage.bucket(this.bucketName).upload(localFilePath, {
        destination: destination,
        metadata: {
          cacheControl: 'public, max-age=3600',
        },
      });

      // Public access is managed via bucket-level IAM policy
      // No need to call makePublic() - bucket is already configured with allUsers objectViewer role

      // Generate public URL
      const publicUrl = `https://storage.googleapis.com/${this.bucketName}/${destination}`;

      console.log(`  ✓ Uploaded successfully: ${publicUrl}`);

      return publicUrl;
    } catch (error) {
      console.error(`  ✗ GCS upload failed:`, error);
      throw new Error(`Failed to upload to GCS: ${error}`);
    }
  }

  /**
   * Deletes an image from GCS
   */
  async deleteImage(fileName: string): Promise<void> {
    try {
      const filePath = `${this.bucketPath}/${fileName}`;
      await this.storage.bucket(this.bucketName).file(filePath).delete();
      console.log(`  ✓ Deleted from GCS: ${filePath}`);
    } catch (error) {
      console.warn(`  ⚠️  Failed to delete ${fileName}:`, error);
    }
  }

  /**
   * Lists all files in the seed-bucket folder
   */
  async listFiles(): Promise<string[]> {
    try {
      const [files] = await this.storage
        .bucket(this.bucketName)
        .getFiles({ prefix: this.bucketPath });

      return files.map((file) => file.name);
    } catch (error) {
      console.error(`  ✗ Failed to list GCS files:`, error);
      return [];
    }
  }

  /**
   * Validates GCS configuration
   */
  async validate(): Promise<boolean> {
    try {
      // Try to access the bucket
      const bucket = this.storage.bucket(this.bucketName);
      const [exists] = await bucket.exists();

      if (!exists) {
        console.error(`  ✗ Bucket does not exist: ${this.bucketName}`);
        return false;
      }

      console.log(`  ✓ GCS bucket accessible: ${this.bucketName}`);
      return true;
    } catch (error) {
      console.error(`  ✗ GCS validation failed:`, error);
      return false;
    }
  }
}
