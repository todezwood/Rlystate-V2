import { Storage } from '@google-cloud/storage';
import fs from 'fs';
import path from 'path';

// Initialize the Google Cloud Storage SDK.
// Locally: set GCP_CREDENTIALS_PATH in .env pointing to a service account key JSON file.
// Production (Cloud Run): omit GCP_CREDENTIALS_PATH entirely. The SDK automatically uses
// the service account attached to the Cloud Run service via the GCP metadata server.
const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID,
  ...(process.env.GCP_CREDENTIALS_PATH && { keyFilename: process.env.GCP_CREDENTIALS_PATH }),
});
const bucketName = process.env.GCS_BUCKET_NAME || 'rlystate-v2-assets';

export const StorageService = {
  /**
   * Generates a temporary, 15-minute secure Signed URL so the React frontend
   * can stream massive retina photos directly into the Cloud bucket seamlessly.
   */
  async generateUploadUrl(fileName: string, contentType: string) {
    const bucket = storage.bucket(bucketName);
    const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `listings/${Date.now()}_${safeName}`;
    const file = bucket.file(filePath);

    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000,
      contentType,
    });

    return {
      uploadUrl: signedUrl,
      publicUrl: `https://storage.googleapis.com/${bucketName}/${filePath}`
    };
  },

  /**
   * Uploads a buffer directly.
   * Local (NODE_ENV !== 'production'): writes to ./uploads/ and returns a localhost URL.
   * Production (Cloud Run): uploads to GCS and returns the public CDN URL.
   * This is the abstraction boundary for the cloud migration — swap the env var, done.
   */
  async uploadFile(buffer: Buffer, fileName: string, contentType: string): Promise<{ publicUrl: string }> {
    const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const finalName = `${Date.now()}_${safeName}`;

    if (process.env.NODE_ENV !== 'production') {
      const uploadsDir = path.resolve(process.cwd(), 'uploads');
      fs.mkdirSync(uploadsDir, { recursive: true });
      fs.writeFileSync(path.join(uploadsDir, finalName), buffer);
      const port = process.env.PORT || 8080;
      return { publicUrl: `http://localhost:${port}/uploads/${finalName}` };
    }

    const filePath = `listings/${finalName}`;
    const bucket = storage.bucket(bucketName);
    await bucket.file(filePath).save(buffer, { contentType });
    return { publicUrl: `https://storage.googleapis.com/${bucketName}/${filePath}` };
  }
};
