import { Hono } from "hono";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";

const app = new Hono();

const credentials = {
  accessKeyId: "8D0GIxjFkuvBNHC5",
  secretAccessKey: "vqJIP3R4a5Sr5ToKBEOMHUvc2jK8NFWqa0N7xaOG",
};

const bucketName = "s3media";

const s3Client = new S3Client({
  endpoint: "https://s3.tebi.io", // Replace with your S3-compatible endpoint
  credentials,
  region: "global", // Replace with your region if needed
});

// Helper functions for base64 encoding and decoding
function toBase64(array) {
  return btoa(String.fromCharCode(...array));
}

function fromBase64(base64String) {
  return Uint8Array.from(atob(base64String), (c) => c.charCodeAt(0));
}

// Upload Route: Handles encrypted file uploads
app.post("/upload", async (c) => {
  const { file, iv, salt, contentType } = await c.req.json(); // Extract data from the request body

  const fileName = `file-${Date.now()}`; // Generate a unique filename
  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: fileName,
        Body: Uint8Array.from(file), // Convert file back to Uint8Array
        ContentType: contentType, // Explicitly set the ContentType
        Metadata: {
          iv: toBase64(iv), // Store IV in metadata
          salt: toBase64(salt), // Store salt in metadata
        },
      })
    );

    return c.json({ message: "Upload successful!", fileName });
  } catch (error) {
    return c.json({ error: `Failed to upload file: ${error.message}` }, 500);
  }
});

// Download Route: Handles retrieval of encrypted files and metadata
app.get("/download/:fileName", async (c) => {
  const { fileName } = c.req.param(); // Extract filename from the URL

  try {
    // Fetch the object, including ContentType
    const { Body, Metadata, ContentType } = await s3Client.send(
      new GetObjectCommand({ Bucket: bucketName, Key: fileName })
    );

    const encryptedContent = await Body.transformToByteArray(); // Read file content as byte array
    const iv = fromBase64(Metadata.iv); // Decode IV from metadata
    const salt = fromBase64(Metadata.salt); // Decode salt from metadata

    // Pass ContentType correctly, fallback to 'application/octet-stream'
    return c.json({
      encryptedContent: Array.from(encryptedContent), // Convert to Array for JSON
      iv: Array.from(iv),
      salt: Array.from(salt),
      contentType: ContentType || "application/octet-stream", // Default if not found
    });
  } catch (error) {
    return c.json({ error: `Failed to download file: ${error.message}` }, 500);
  }
});

// Default export for the app
export default app;
