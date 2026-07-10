export type ZipInspectionErrorCode = "entry" | "limit" | "path" | "read";

export class ZipInspectionError extends Error {
  constructor(public readonly code: ZipInspectionErrorCode) {
    super(code);
    this.name = "ZipInspectionError";
  }
}

type InspectZipArchiveOptions = {
  allowedExtensions: ReadonlySet<string>;
  blockedExtensions: ReadonlySet<string>;
  maxFiles: number;
  maxTotalUncompressedBytes: number;
};

const centralDirectorySignature = 0x02014b50;
const endOfCentralDirectorySignature = 0x06054b50;
const utf8Decoder = new TextDecoder("utf-8");

export function inspectZipArchive(data: Uint8Array, options: InspectZipArchiveOptions) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const endOffset = findEndOfCentralDirectoryOffset(view);

  if (endOffset === -1 || endOffset + 22 > data.byteLength) {
    throw new ZipInspectionError("read");
  }

  const entryCount = view.getUint16(endOffset + 10, true);
  const centralDirectorySize = view.getUint32(endOffset + 12, true);
  const centralDirectoryOffset = view.getUint32(endOffset + 16, true);

  if (
    entryCount === 0xffff ||
    centralDirectorySize === 0xffffffff ||
    centralDirectoryOffset === 0xffffffff ||
    centralDirectoryOffset + centralDirectorySize > data.byteLength
  ) {
    throw new ZipInspectionError("read");
  }

  let offset = centralDirectoryOffset;
  let checkedFileCount = 0;
  let totalUncompressedBytes = 0;

  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > data.byteLength || view.getUint32(offset, true) !== centralDirectorySignature) {
      throw new ZipInspectionError("read");
    }

    const flags = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const filenameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const entryEnd = offset + 46 + filenameLength + extraLength + commentLength;

    if (entryEnd > data.byteLength || compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) {
      throw new ZipInspectionError("read");
    }

    const rawName = utf8Decoder.decode(data.subarray(offset + 46, offset + 46 + filenameLength));
    const entryName = normalizeZipEntryName(rawName);

    if (!entryName) {
      throw new ZipInspectionError("entry");
    }

    assertSafeZipPath(entryName);

    if (!isIgnorableZipEntry(entryName) && !entryName.endsWith("/")) {
      if ((flags & 0x0001) === 0x0001) {
        throw new ZipInspectionError("read");
      }

      const extension = getExtension(entryName);
      if (!extension || options.blockedExtensions.has(extension) || !options.allowedExtensions.has(extension)) {
        throw new ZipInspectionError("entry");
      }

      checkedFileCount += 1;
      totalUncompressedBytes += uncompressedSize;

      if (
        checkedFileCount > options.maxFiles ||
        totalUncompressedBytes > options.maxTotalUncompressedBytes
      ) {
        throw new ZipInspectionError("limit");
      }
    }

    offset = entryEnd;
  }

  return { checkedFileCount, totalUncompressedBytes };
}

function findEndOfCentralDirectoryOffset(view: DataView) {
  const minOffset = Math.max(0, view.byteLength - 22 - 0xffff);

  for (let offset = view.byteLength - 22; offset >= minOffset; offset -= 1) {
    if (view.getUint32(offset, true) === endOfCentralDirectorySignature) {
      return offset;
    }
  }

  return -1;
}

function getExtension(filename: string) {
  const basename = filename.replace(/\\/g, "/").split("/").pop() ?? "";
  const index = basename.lastIndexOf(".");
  return index <= 0 ? "" : basename.slice(index).toLowerCase();
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
    throw new ZipInspectionError("path");
  }
}

function isIgnorableZipEntry(entryName: string) {
  const normalized = entryName.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  const basename = parts[parts.length - 1] ?? "";

  return normalized === "__MACOSX/" || normalized.startsWith("__MACOSX/") || basename === ".DS_Store";
}
