const textDecoder = new TextDecoder("latin1");

export function hasExpectedUploadFileSignature(extension: string, data: Uint8Array) {
  switch (extension) {
    case ".pdf":
      return hasAsciiWithin(data, "%PDF-", 1024);
    case ".png":
      return hasBytes(data, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case ".jpg":
    case ".jpeg":
      return hasBytes(data, [0xff, 0xd8, 0xff]);
    case ".psd":
      return hasAsciiPrefix(data, "8BPS");
    case ".tif":
    case ".tiff":
      return isTiff(data);
    case ".eps":
      return isPostScript(data) || isBinaryEps(data);
    case ".ai":
      return hasAsciiWithin(data, "%PDF-", 1024) || isPostScript(data) || isBinaryEps(data);
    case ".dxf":
      return isBinaryDxf(data) || isAsciiDxf(data);
    case ".zip":
      return isZip(data);
    default:
      return false;
  }
}

function hasBytes(data: Uint8Array, expected: number[], offset = 0) {
  if (data.byteLength < offset + expected.length) {
    return false;
  }

  return expected.every((value, index) => data[offset + index] === value);
}

function hasAsciiPrefix(data: Uint8Array, expected: string, offset = 0) {
  if (data.byteLength < offset + expected.length) {
    return false;
  }

  for (let index = 0; index < expected.length; index += 1) {
    if (data[offset + index] !== expected.charCodeAt(index)) {
      return false;
    }
  }

  return true;
}

function hasAsciiWithin(data: Uint8Array, expected: string, maxOffset: number) {
  const finalOffset = Math.min(maxOffset, data.byteLength - expected.length);

  for (let offset = 0; offset <= finalOffset; offset += 1) {
    if (hasAsciiPrefix(data, expected, offset)) {
      return true;
    }
  }

  return false;
}

function isPostScript(data: Uint8Array) {
  return hasAsciiPrefix(data, "%!PS-Adobe");
}

function isBinaryEps(data: Uint8Array) {
  return hasBytes(data, [0xc5, 0xd0, 0xd3, 0xc6]);
}

function isTiff(data: Uint8Array) {
  return (
    hasBytes(data, [0x49, 0x49, 0x2a, 0x00]) ||
    hasBytes(data, [0x4d, 0x4d, 0x00, 0x2a]) ||
    hasBytes(data, [0x49, 0x49, 0x2b, 0x00]) ||
    hasBytes(data, [0x4d, 0x4d, 0x00, 0x2b])
  );
}

function isZip(data: Uint8Array) {
  return (
    hasBytes(data, [0x50, 0x4b, 0x03, 0x04]) ||
    hasBytes(data, [0x50, 0x4b, 0x05, 0x06]) ||
    hasBytes(data, [0x50, 0x4b, 0x07, 0x08])
  );
}

function isBinaryDxf(data: Uint8Array) {
  return hasAsciiPrefix(data, "AutoCAD Binary DXF\r\n\x1a\0");
}

function isAsciiDxf(data: Uint8Array) {
  const text = textDecoder.decode(data.subarray(0, Math.min(data.byteLength, 64 * 1024))).replace(/^\uFEFF/, "");
  const lines = text.replace(/\r/g, "").split("\n");
  let foundSection = false;

  for (let index = 0; index + 1 < lines.length && index < 400; index += 2) {
    const groupCode = lines[index].trim();
    const value = lines[index + 1].trim().toUpperCase();

    if (!/^-?\d+$/.test(groupCode)) {
      return false;
    }

    if (groupCode === "0" && value === "SECTION") {
      foundSection = true;
      continue;
    }

    if (
      foundSection &&
      groupCode === "2" &&
      /^(HEADER|CLASSES|TABLES|BLOCKS|ENTITIES|OBJECTS|THUMBNAILIMAGE)$/.test(value)
    ) {
      return true;
    }
  }

  return false;
}
