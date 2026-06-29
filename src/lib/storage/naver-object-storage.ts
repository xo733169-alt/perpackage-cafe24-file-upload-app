import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

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
