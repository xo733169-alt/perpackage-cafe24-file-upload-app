const DEFAULT_UPLOAD_MAX_FILE_SIZE_MB = 10;
const DEFAULT_UPLOAD_ZIP_MAX_FILES = 50;
const DEFAULT_UPLOAD_ZIP_MAX_TOTAL_UNCOMPRESSED_MB = 50;

const DIRECT_UPLOAD_ALLOWED_EXTENSIONS = new Set([".ai", ".pdf", ".eps", ".zip"]);
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
  "업로드할 수 없는 파일 형식입니다. AI, PDF, EPS 또는 ZIP 파일만 업로드해 주세요.";
const ZIP_ENTRY_ERROR =
  "ZIP 파일 안에 업로드할 수 없는 파일이 포함되어 있습니다. 허용 파일만 남긴 뒤 다시 압축해 업로드해 주세요.";
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
  const endOfCentralDirectoryOffset = findEndOfCentralDirectoryOffset(buffer);
  if (endOfCentralDirectoryOffset === -1) {
    throw new UploadValidationError(ZIP_READ_ERROR);
  }

  if (endOfCentralDirectoryOffset + 22 > buffer.length) {
    throw new UploadValidationError(ZIP_READ_ERROR);
  }

  const entryCount = buffer.readUInt16LE(endOfCentralDirectoryOffset + 10);
  const centralDirectorySize = buffer.readUInt32LE(endOfCentralDirectoryOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(endOfCentralDirectoryOffset + 16);

  if (
    entryCount === 0xffff ||
    centralDirectorySize === 0xffffffff ||
    centralDirectoryOffset === 0xffffffff ||
    centralDirectoryOffset + centralDirectorySize > buffer.length
  ) {
    throw new UploadValidationError(ZIP_READ_ERROR);
  }

  const maxFiles = getPositiveIntegerEnv("UPLOAD_ZIP_MAX_FILES", DEFAULT_UPLOAD_ZIP_MAX_FILES);
  const maxTotalUncompressedBytes =
    getPositiveIntegerEnv(
      "UPLOAD_ZIP_MAX_TOTAL_UNCOMPRESSED_MB",
      DEFAULT_UPLOAD_ZIP_MAX_TOTAL_UNCOMPRESSED_MB
    ) * 1024 * 1024;

  let offset = centralDirectoryOffset;
  let checkedFileCount = 0;
  let totalUncompressedBytes = 0;

  for (let i = 0; i < entryCount; i += 1) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new UploadValidationError(ZIP_READ_ERROR);
    }

    const flags = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const filenameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const entryEnd = offset + 46 + filenameLength + extraLength + commentLength;

    if (entryEnd > buffer.length || compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) {
      throw new UploadValidationError(ZIP_READ_ERROR);
    }

    const rawName = buffer.subarray(offset + 46, offset + 46 + filenameLength).toString("utf8");
    const entryName = normalizeZipEntryName(rawName);

    if (!entryName) {
      throw new UploadValidationError(ZIP_ENTRY_ERROR);
    }

    assertSafeZipPath(entryName);

    if (!isIgnorableZipEntry(entryName) && !entryName.endsWith("/")) {
      if ((flags & 0x0001) === 0x0001) {
        throw new UploadValidationError(ZIP_READ_ERROR);
      }

      const extension = getExtension(entryName);
      if (!extension || BLOCKED_EXTENSIONS.has(extension) || !ZIP_ENTRY_ALLOWED_EXTENSIONS.has(extension)) {
        throw new UploadValidationError(ZIP_ENTRY_ERROR);
      }

      checkedFileCount += 1;
      totalUncompressedBytes += uncompressedSize;

      if (checkedFileCount > maxFiles || totalUncompressedBytes > maxTotalUncompressedBytes) {
        throw new UploadValidationError(ZIP_LIMIT_ERROR);
      }
    }

    offset = entryEnd;
  }
}

function findEndOfCentralDirectoryOffset(buffer: Buffer) {
  const minOffset = Math.max(0, buffer.length - 22 - 0xffff);

  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      return offset;
    }
  }

  return -1;
}

function normalizeZipEntryName(entryName: string) {
  return entryName.replace(/\0/g, "").replace(/\\/g, "/").trim();
}

function assertSafeZipPath(entryName: string) {
  if (
    entryName.startsWith("/") ||
    entryName.startsWith("\\") ||
    /^[A-Za-z]:[\\/]/.test(entryName) ||
    entryName.split("/").some((segment) => segment === "..")
  ) {
    throw new UploadValidationError(ZIP_PATH_ERROR);
  }
}

function isIgnorableZipEntry(entryName: string) {
  const normalized = entryName.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  const basename = parts[parts.length - 1] ?? "";

  return normalized === "__MACOSX/" || normalized.startsWith("__MACOSX/") || basename === ".DS_Store";
}

function getPositiveIntegerEnv(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}
