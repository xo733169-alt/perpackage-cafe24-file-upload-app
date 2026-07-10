import {
  BLOCKED_UPLOAD_EXTENSION_SET,
  DIRECT_UPLOAD_ALLOWED_EXTENSION_SET,
  getCanonicalUploadMimeType,
  getUploadExtension,
  isAllowedUploadMimeType,
  UPLOAD_ALLOWED_FORMAT_LABEL,
  ZIP_ALLOWED_FORMAT_LABEL,
  ZIP_ENTRY_ALLOWED_EXTENSION_SET
} from "./upload-policy";
import { hasExpectedUploadFileSignature } from "./upload-file-signature";
import { inspectZipArchive, ZipInspectionError } from "./zip-archive-inspection";

const DEFAULT_UPLOAD_MAX_FILE_SIZE_MB = 10;
const DEFAULT_UPLOAD_ZIP_MAX_FILES = 50;
const DEFAULT_UPLOAD_ZIP_MAX_TOTAL_UNCOMPRESSED_MB = 50;
const DEFAULT_UPLOAD_ZIP_MAX_COMPRESSION_RATIO = 100;

const DIRECT_EXTENSION_ERROR =
  `지원하지 않는 파일 형식입니다. ${UPLOAD_ALLOWED_FORMAT_LABEL} 파일을 업로드해 주세요.`;
const BLOCKED_EXTENSION_ERROR = "보안상 업로드할 수 없는 파일 형식입니다.";
const MIME_TYPE_ERROR =
  "파일 확장자와 브라우저에서 확인한 파일 형식이 일치하지 않습니다. 원본 파일을 다시 저장한 뒤 업로드해 주세요.";
const FILE_SIGNATURE_ERROR =
  "파일 확장자와 실제 파일 형식이 일치하지 않습니다. 원본 파일을 다시 저장한 뒤 업로드해 주세요.";
const ZIP_ENTRY_ERROR =
  `ZIP 파일 안에 업로드할 수 없는 파일이 포함되어 있습니다. ${ZIP_ALLOWED_FORMAT_LABEL} 파일만 남긴 뒤 다시 압축해 업로드해 주세요.`;
const ZIP_PATH_ERROR =
  "ZIP 파일 안에 안전하지 않은 파일 경로가 포함되어 있습니다. 다시 압축해 업로드해 주세요.";
const ZIP_READ_ERROR =
  "ZIP 파일을 확인할 수 없습니다. 파일이 손상되었거나 비밀번호가 설정된 ZIP인지 확인해 주세요.";
const ZIP_LIMIT_ERROR =
  "ZIP 파일 안의 파일 수, 전체 용량 또는 압축률이 허용 기준을 초과했습니다. 파일을 줄인 뒤 다시 업로드해 주세요.";

export class UploadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadValidationError";
  }
}

export type ValidatedUploadFile = {
  extension: string;
  canonicalMimeType: string;
};

export function getUploadLimitBytes() {
  return getPositiveIntegerEnv("UPLOAD_MAX_FILE_SIZE_MB", DEFAULT_UPLOAD_MAX_FILE_SIZE_MB) * 1024 * 1024;
}

export function getExtension(filename: string) {
  return getUploadExtension(filename);
}

export function validateUploadFile(input: { file: File; buffer: Buffer }): ValidatedUploadFile {
  const metadata = validateUploadFileMetadata(input.file);

  if (!hasExpectedUploadFileSignature(metadata.extension, input.buffer)) {
    throw new UploadValidationError(FILE_SIGNATURE_ERROR);
  }

  if (metadata.extension === ".zip") {
    validateZipArchive(input.buffer);
  }

  return metadata;
}

export function validateUploadFileMetadata(file: File): ValidatedUploadFile {
  if (file.size <= 0) {
    throw new UploadValidationError("비어 있는 파일은 업로드할 수 없습니다.");
  }

  if (file.size > getUploadLimitBytes()) {
    throw new UploadValidationError("파일 용량이 너무 큽니다. 100MB 이하 파일만 업로드해 주세요.");
  }

  const extension = getUploadExtension(file.name);

  if (!extension) {
    throw new UploadValidationError(DIRECT_EXTENSION_ERROR);
  }

  if (BLOCKED_UPLOAD_EXTENSION_SET.has(extension)) {
    throw new UploadValidationError(BLOCKED_EXTENSION_ERROR);
  }

  if (!DIRECT_UPLOAD_ALLOWED_EXTENSION_SET.has(extension)) {
    throw new UploadValidationError(DIRECT_EXTENSION_ERROR);
  }

  if (!isAllowedUploadMimeType(extension, file.type)) {
    throw new UploadValidationError(MIME_TYPE_ERROR);
  }

  return {
    extension,
    canonicalMimeType: getCanonicalUploadMimeType(extension)
  };
}

function validateZipArchive(buffer: Buffer) {
  const maxFiles = getPositiveIntegerEnv("UPLOAD_ZIP_MAX_FILES", DEFAULT_UPLOAD_ZIP_MAX_FILES);
  const maxTotalUncompressedBytes =
    getPositiveIntegerEnv(
      "UPLOAD_ZIP_MAX_TOTAL_UNCOMPRESSED_MB",
      DEFAULT_UPLOAD_ZIP_MAX_TOTAL_UNCOMPRESSED_MB
    ) * 1024 * 1024;
  const maxCompressionRatio = getPositiveNumberEnv(
    "UPLOAD_ZIP_MAX_COMPRESSION_RATIO",
    DEFAULT_UPLOAD_ZIP_MAX_COMPRESSION_RATIO
  );

  try {
    inspectZipArchive(buffer, {
      allowedExtensions: ZIP_ENTRY_ALLOWED_EXTENSION_SET,
      blockedExtensions: BLOCKED_UPLOAD_EXTENSION_SET,
      maxFiles,
      maxTotalUncompressedBytes,
      maxCompressionRatio
    });
  } catch (error) {
    if (!(error instanceof ZipInspectionError)) {
      throw error;
    }

    const messages = {
      entry: ZIP_ENTRY_ERROR,
      limit: ZIP_LIMIT_ERROR,
      path: ZIP_PATH_ERROR,
      read: ZIP_READ_ERROR
    } satisfies Record<ZipInspectionError["code"], string>;

    throw new UploadValidationError(messages[error.code]);
  }
}

function getPositiveIntegerEnv(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function getPositiveNumberEnv(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
