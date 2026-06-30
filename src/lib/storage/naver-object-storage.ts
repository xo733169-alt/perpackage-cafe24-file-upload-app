import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type StorageUploadResult = {
  provider: "naver-object-storage";
  bucket: string;
  path: string;
};

function getStorageConfig() {
  const endpoint = process.env.NAVER_OBJECT_STORAGE_ENDPOINT?.trim();
  const bucket = process.env.NAVER_OBJECT_STORAGE_BUCKET?.trim();
  const region = process.env.NAVER_REGION?.trim() || "kr-standard";
  const accessKeyId = process.env.NAVER_ACCESS_KEY?.trim();
  const secretAccessKey = process.env.NAVER_SECRET_KEY?.trim();

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("Missing Naver Object Storage configuration.");
  }

  return { endpoint, bucket, region, accessKeyId, secretAccessKey };
}

function createClient() {
  const config = getStorageConfig();

  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    },
    forcePathStyle: true
  });
}

export function getNaverStorageStatus() {
  return {
    hasEndpoint: Boolean(process.env.NAVER_OBJECT_STORAGE_ENDPOINT?.trim()),
    hasBucket: Boolean(process.env.NAVER_OBJECT_STORAGE_BUCKET?.trim()),
    hasRegion: Boolean(process.env.NAVER_REGION?.trim()),
    hasAccessKey: Boolean(process.env.NAVER_ACCESS_KEY?.trim()),
    hasSecretKey: Boolean(process.env.NAVER_SECRET_KEY?.trim())
  };
}

export async function uploadToNaverObjectStorage(input: {
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<StorageUploadResult> {
  const config = getStorageConfig();
  const client = createClient();

  await client.send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: input.key,
    Body: input.body,
    ContentType: input.contentType
  }));

  return {
    provider: "naver-object-storage",
    bucket: config.bucket,
    path: input.key
  };
}

export async function createSignedDownloadUrl(input: {
  bucket: string;
  key: string;
  filename?: string | null;
  expiresInSeconds?: number;
}): Promise<string> {
  const expiresInSeconds = input.expiresInSeconds ?? 300;
  const client = createClient();

  if (!input.bucket.trim() || !input.key.trim()) {
    throw new Error("Missing storage download target.");
  }

  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: input.bucket,
      Key: input.key,
      ResponseContentDisposition: input.filename
        ? buildAttachmentContentDisposition(input.filename)
        : undefined
    }),
    { expiresIn: expiresInSeconds }
  );
}

function buildAttachmentContentDisposition(filename: string) {
  const safeFilename = sanitizeDownloadFilename(filename);
  const asciiFallback = safeFilename
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/["\\]/g, "_")
    .trim() || "download-file";

  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeRFC5987ValueChars(safeFilename)}`;
}

function sanitizeDownloadFilename(filename: string) {
  return filename
    .normalize("NFKC")
    .replace(/[\r\n\0]/g, "")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function encodeRFC5987ValueChars(value: string) {
  return encodeURIComponent(value).replace(/['()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}
