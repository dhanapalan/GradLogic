import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { Readable } from "stream";
import { env } from "./env.js";
import { logger } from "./logger.js";

export const s3 = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET_KEY,
  },
  forcePathStyle: true, // required for MinIO
});

/**
 * Ensure the default upload bucket exists. Create it if missing.
 */
export async function ensureBucket(): Promise<void> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
    logger.info(`✓ S3 bucket "${env.S3_BUCKET}" ready`);
  } catch (headErr: any) {
    if (headErr?.name === "NotFound" || headErr?.$metadata?.httpStatusCode === 404) {
      try {
        logger.info(`Creating S3 bucket "${env.S3_BUCKET}"…`);
        await s3.send(new CreateBucketCommand({ Bucket: env.S3_BUCKET }));
        logger.info(`✓ S3 bucket "${env.S3_BUCKET}" created`);
      } catch (createErr) {
        logger.warn(`S3 bucket creation failed — file uploads will be unavailable: ${createErr}`);
      }
    } else {
      logger.warn(`S3 unavailable — file uploads will be disabled: ${headErr?.message}`);
    }
  }
}

/**
 * Upload a buffer to S3 / MinIO and return the object URL.
 */
export async function uploadFile(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  await s3.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );

  return `${env.S3_ENDPOINT}/${env.S3_BUCKET}/${key}`;
}

/**
 * Fetch an object from S3 / MinIO as a Buffer (for authenticated download/preview).
 */
export async function getFileBuffer(key: string): Promise<{
  body: Buffer;
  contentType?: string;
}> {
  const res = await s3.send(
    new GetObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
    })
  );
  const stream = res.Body;
  if (!stream) throw new Error("Empty S3 object body");

  let body: Buffer;
  if (Buffer.isBuffer(stream)) {
    body = stream;
  } else if (stream instanceof Readable || typeof (stream as any).transformToByteArray === "function") {
    if (typeof (stream as any).transformToByteArray === "function") {
      body = Buffer.from(await (stream as any).transformToByteArray());
    } else {
      const chunks: Buffer[] = [];
      for await (const chunk of stream as Readable) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      body = Buffer.concat(chunks);
    }
  } else {
    throw new Error("Unsupported S3 body type");
  }

  return { body, contentType: res.ContentType };
}
