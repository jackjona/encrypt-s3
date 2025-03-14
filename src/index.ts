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

// Route: Upload
app.post("/upload", async (c) => {
  try {
    const formData = await c.req.parseBody();
    const file = formData.file;
    const iv = formData.iv;
    const salt = formData.salt;

    if (!file || !iv || !salt) {
      throw new Error("Missing required fields");
    }

    const uniqueFileName = `file-${Date.now()}`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: uniqueFileName,
        Body: file,
        Metadata: {
          iv,
          salt,
        },
      })
    );

    return c.json({
      message: "File uploaded successfully!",
      fileName: uniqueFileName,
    });
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

// Route: Download
app.get("/download/:fileName", async (c) => {
  try {
    const { fileName } = c.req.param();

    const { Body, Metadata } = await s3Client.send(
      new GetObjectCommand({ Bucket: bucketName, Key: fileName })
    );

    // Return the file and metadata to the client
    return c.body(Body, {
      headers: {
        "x-metadata": JSON.stringify(Metadata),
      },
    });
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

export default app;
