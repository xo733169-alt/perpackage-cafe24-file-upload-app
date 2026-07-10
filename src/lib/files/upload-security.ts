import { inspectZipArchive, ZipInspectionError } from "./zip-archive-inspection";

const DEFAULT_UPLOAD_MAX_FILE_SIZE_MB = 10;
const DEFAULT_UPLOAD_ZIP_MAX_FILES = 50;
const DEFAULT_UPLOAD_ZIP_MAX_TOTAL_UNCOMPRESSED_MB = 50;

const DIRECT_UPLOAD_ALLOWED_EXTENSIONS = new Set([".ai", ".pdf", ".eps", ".zip", ".jpg", ".jpeg", ".png"]);
const ZIP_ENTRY_ALLOWED_EXTENSIONS = new Set([".ai", ".pdf", ".eps", ".jpg", ".jpeg", ".png"]);
const BLOCKED_EXTENSIONS = new Set([
  ".exe",
  ".bat",
  ".cmd",
  ".sh",
  ".js",
  ".html",
  ".htm",
  ".php",
  ".asp",
  ".aspx",
  ".jsp",
  ".vbs",
  ".ps1",
  ".msi",
  ".dmg",
  ".apk",
  ".jar",
  ".scr",
  ".com",
  ".lnk"
]);

const DIRECT_EXTENSION_ERROR =
  "업로드할 수 없는 파일 형식입니다. AI, PDF, EPS, JPG, PNG 또는 ZIP 파일만 업로드해 주세요.";
const ZIP_ENTRY_ERROR =
  "ZIP 파일 안에 업로드할 수 없는 파일이 포함되어 있습니다. AI, PDF, EPS, JPG, PNG 파일만 남긴 뒤 다시 압축해 업로드해 주세요.";
const ZIP_PATH_ERROR =
  "ZIP 파일 안에 안전하지 않은 파일 경로가 포함되어 있습니다. 다시 압축해 업로드해 주세요.";
const ZIP_READ_ERROR =
  "ZIP 파일을 확인할 수 없습니다. 파일이 손상되었거나 지원하지 않는 압축 형식입니다.";
const ZIP_LIMIT_ERROR =
  "ZIP 파일 안의 파일 수 또는 전체 용량이 너무 큽니다. 파일을 줄인 뒤 다시 업로드해 주세요.";

export class UploadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadValidationError";
  }
}

export function getUploadLimitBytes() {
  return getPositiveIntegerEnv("UPLOAD_MAX_FILE_SIZE_MB", DEFAULT_UPLOAD_MAX_FILE_SIZE_MB) * 1024 * 1024;
}

export function getExtension(filename: string) {
  const basename = filename.replace(/\\/g, "/").split("/").pop() ?? "";
  const index = basename.lastIndexOf(".");
  if (index <= 0) return "";
  return basename.slice(index).toLowerCase();
}

export function validateUploadFile(input: {
  file: File;
  buffer: Buffer;
}) {
  validateUploadFileMetadata(input.file);

  if (getExtension(input.file.name) === ".zip") {
    validateZipArchive(input.buffer);
  }
}

export function validateUploadFileMetadata(file: File) {
  if (file.size <= 0) {
    throw new UploadValidationError("비어 있는 파일은 업로드할 수 없습니다.");
  }

  if (file.size > getUploadLimitBytes()) {
    throw new UploadValidationError("파일 용량이 너무 큽니다. 100MB 이하 파일만 업로드해 주세요.");
  }

  const extension = getExtension(file.name);

  if (!extension || BLOCKED_EXTENSIONS.has(extension) || !DIRECT_UPLOAD_ALLOWED_EXTENSIONS.has(extension)) {
    throw new UploadValidationError(DIRECT_EXTENSION_ERROR);
  }
}

function validateZipArchive(buffer: Buffer) {
  const maxFiles = getPositiveIntegerEnv("UPLOAD_ZIP_MAX_FILES", DEFAULT_UPLOAD_ZIP_MAX_FILES);
  const maxTotalUncompressedBytes =
    getPositiveIntegerEnv(
      "UPLOAD_ZIP_MAX_TOTAL_UNCOMPRESSED_MB",
      DEFAULT_UPLOAD_ZIP_MAX_TOTAL_UNCOMPRESSED_MB
    ) * 1024 * 1024;

  try {
    inspectZipArchive(buffer, {
      allowedExtensions: ZIP_ENTRY_ALLOWED_EXTENSIONS,
      blockedExtensions: BLOCKED_EXTENSIONS,
      maxFiles,
      maxTotalUncompressedBytes
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
