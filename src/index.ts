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
  endpoint: "https://s3.tebi.io",
  credentials,
  region: "global",
});

// Helper Functions
function toBase64(array) {
  return btoa(String.fromCharCode(...array));
}

function fromBase64(base64String) {
  return Uint8Array.from(atob(base64String), (c) => c.charCodeAt(0));
}

// Upload Route
app.post("/upload", async (c) => {
  const { file, iv, salt } = await c.req.json();

  const fileName = `file-${Date.now()}`;
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: fileName,
      Body: Uint8Array.from(file),
      Metadata: {
        iv: toBase64(iv),
        salt: toBase64(salt),
      },
    })
  );

  return c.json({
    message: "Upload successful!",
    fileName,
  });
});

// Download Route
app.get("/download/:fileName", async (c) => {
  const { fileName } = c.req.param();

  try {
    const { Body, Metadata } = await s3Client.send(
      new GetObjectCommand({ Bucket: bucketName, Key: fileName })
    );

    const encryptedContent = await Body.transformToByteArray();
    const iv = fromBase64(Metadata.iv); // Convert Base64 back to Uint8Array
    const salt = fromBase64(Metadata.salt); // Convert Base64 back to Uint8Array

    return c.json({
      encryptedContent: Array.from(encryptedContent), // Convert Uint8Array to Array for JSON
      iv: Array.from(iv),
      salt: Array.from(salt),
    });
  } catch (error) {
    return c.json({ error: `Failed to download file: ${error.message}` }, 500);
  }
});

export default app;
