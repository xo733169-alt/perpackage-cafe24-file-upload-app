export const DIRECT_UPLOAD_ALLOWED_EXTENSIONS = [
  ".ai",
  ".pdf",
  ".eps",
  ".psd",
  ".tif",
  ".tiff",
  ".jpg",
  ".jpeg",
  ".png",
  ".dxf",
  ".zip"
] as const;

export const ZIP_ENTRY_ALLOWED_EXTENSIONS = DIRECT_UPLOAD_ALLOWED_EXTENSIONS.filter(
  (extension) => extension !== ".zip"
);

export const BLOCKED_UPLOAD_EXTENSIONS = [
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
  ".lnk",
  ".dll",
  ".sys",
  ".reg",
  ".hta",
  ".chm",
  ".wsf",
  ".wsh",
  ".cpl",
  ".iso"
] as const;

export const DIRECT_UPLOAD_ALLOWED_EXTENSION_SET = new Set<string>(DIRECT_UPLOAD_ALLOWED_EXTENSIONS);
export const ZIP_ENTRY_ALLOWED_EXTENSION_SET = new Set<string>(ZIP_ENTRY_ALLOWED_EXTENSIONS);
export const BLOCKED_UPLOAD_EXTENSION_SET = new Set<string>(BLOCKED_UPLOAD_EXTENSIONS);

export const UPLOAD_FILE_INPUT_ACCEPT = DIRECT_UPLOAD_ALLOWED_EXTENSIONS.join(",");
export const UPLOAD_ALLOWED_FORMAT_LABEL = "AI, PDF, EPS, PSD, TIFF, JPG, PNG, DXF 또는 ZIP";
export const ZIP_ALLOWED_FORMAT_LABEL = "AI, PDF, EPS, PSD, TIFF, JPG, PNG, DXF";

const GENERIC_MIME_TYPES = new Set(["", "application/octet-stream", "binary/octet-stream"]);

const ALLOWED_MIME_TYPES_BY_EXTENSION: Record<string, ReadonlySet<string>> = {
  ".ai": new Set([
    "application/illustrator",
    "application/pdf",
    "application/postscript",
    "application/vnd.adobe.illustrator"
  ]),
  ".pdf": new Set(["application/pdf"]),
  ".eps": new Set([
    "application/eps",
    "application/postscript",
    "application/x-eps",
    "image/eps",
    "image/x-eps"
  ]),
  ".psd": new Set(["application/x-photoshop", "image/vnd.adobe.photoshop", "image/x-photoshop"]),
  ".tif": new Set(["image/tiff"]),
  ".tiff": new Set(["image/tiff"]),
  ".jpg": new Set(["image/jpeg", "image/pjpeg"]),
  ".jpeg": new Set(["image/jpeg", "image/pjpeg"]),
  ".png": new Set(["image/png"]),
  ".dxf": new Set([
    "application/acad",
    "application/dxf",
    "application/x-autocad",
    "application/x-dxf",
    "image/vnd.dxf",
    "image/x-dxf",
    "text/plain"
  ]),
  ".zip": new Set(["application/zip", "application/x-zip-compressed", "multipart/x-zip"])
};

const CANONICAL_MIME_TYPES_BY_EXTENSION: Record<string, string> = {
  ".ai": "application/vnd.adobe.illustrator",
  ".pdf": "application/pdf",
  ".eps": "application/postscript",
  ".psd": "image/vnd.adobe.photoshop",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".dxf": "image/vnd.dxf",
  ".zip": "application/zip"
};

export function getUploadExtension(filename: string) {
  const basename = filename.replace(/\\/g, "/").split("/").pop() ?? "";
  const index = basename.lastIndexOf(".");
  return index <= 0 ? "" : basename.slice(index).toLowerCase();
}

export function isAllowedUploadMimeType(extension: string, mimeType: string | null | undefined) {
  const normalizedMimeType = (mimeType ?? "").split(";", 1)[0].trim().toLowerCase();
  if (GENERIC_MIME_TYPES.has(normalizedMimeType)) {
    return true;
  }

  return ALLOWED_MIME_TYPES_BY_EXTENSION[extension]?.has(normalizedMimeType) ?? false;
}

export function getCanonicalUploadMimeType(extension: string) {
  return CANONICAL_MIME_TYPES_BY_EXTENSION[extension] ?? "application/octet-stream";
}
