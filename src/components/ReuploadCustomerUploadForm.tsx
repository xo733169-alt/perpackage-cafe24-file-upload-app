"use client";

import { useRef, useState, type ChangeEvent, type DragEvent, type FormEvent, type KeyboardEvent } from "react";
import { hasExpectedUploadFileSignature } from "@/lib/files/upload-file-signature";
import {
  BLOCKED_UPLOAD_EXTENSION_SET,
  DIRECT_UPLOAD_ALLOWED_EXTENSION_SET,
  getUploadExtension,
  isAllowedUploadMimeType,
  UPLOAD_ALLOWED_FORMAT_LABEL,
  UPLOAD_FILE_INPUT_ACCEPT,
  ZIP_ALLOWED_FORMAT_LABEL,
  ZIP_ENTRY_ALLOWED_EXTENSION_SET
} from "@/lib/files/upload-policy";
import { inspectZipArchive, ZipInspectionError } from "@/lib/files/zip-archive-inspection";

type ReuploadCustomerUploadFormProps = {
  token?: string;
  publicId?: string;
};

type ReuploadUploadResponse = {
  ok: boolean;
  message?: string;
  file?: {
    id: string;
    original_filename: string;
    file_size: number;
    mime_type: string;
    status: string;
    created_at: string;
  };
};

const maxFileSizeBytes = 100 * 1024 * 1024;
const maxZipFileCount = 50;
const maxZipTotalUncompressedBytes = 50 * 1024 * 1024;
const maxZipCompressionRatio = 100;
const fileInputAccept = UPLOAD_FILE_INPUT_ACCEPT;
const invalidFileTypeMessage =
  `지원하지 않는 파일 형식입니다. ${UPLOAD_ALLOWED_FORMAT_LABEL} 파일을 업로드해 주세요.`;
const blockedFileTypeMessage = "보안상 업로드할 수 없는 파일 형식입니다.";
const invalidMimeTypeMessage =
  "파일 확장자와 브라우저에서 확인한 파일 형식이 일치하지 않습니다. 원본 파일을 다시 저장한 뒤 업로드해 주세요.";
const invalidSignatureMessage =
  "파일 확장자와 실제 파일 형식이 일치하지 않습니다. 원본 파일을 다시 저장한 뒤 업로드해 주세요.";
const fileTooLargeMessage = "파일 용량이 너무 큽니다. 100MB 이하 파일만 업로드해 주세요.";
const zipEntryErrorMessage =
  `ZIP 파일 안에 업로드할 수 없는 파일이 포함되어 있습니다. ${ZIP_ALLOWED_FORMAT_LABEL} 파일만 남긴 뒤 다시 압축해 업로드해 주세요.`;
const zipPathErrorMessage =
  "ZIP 파일 안에 안전하지 않은 파일 경로가 포함되어 있습니다. 다시 압축해 업로드해 주세요.";
const zipReadErrorMessage =
  "ZIP 파일을 확인할 수 없습니다. 파일이 손상되었거나 비밀번호가 설정된 ZIP인지 확인해 주세요.";
const zipLimitErrorMessage =
  "ZIP 파일 안의 파일 수, 전체 용량 또는 압축률이 허용 기준을 초과했습니다. 파일을 줄인 뒤 다시 업로드해 주세요.";

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(1)}MB`;
  }

  if (size >= 1024) {
    return `${Math.ceil(size / 1024)}KB`;
  }

  return `${size}B`;
}

function validateFile(file: File) {
  const extension = getUploadExtension(file.name);
  if (!extension) {
    return invalidFileTypeMessage;
  }

  if (BLOCKED_UPLOAD_EXTENSION_SET.has(extension)) {
    return blockedFileTypeMessage;
  }

  if (!DIRECT_UPLOAD_ALLOWED_EXTENSION_SET.has(extension)) {
    return invalidFileTypeMessage;
  }

  if (file.size > maxFileSizeBytes) {
    return fileTooLargeMessage;
  }

  if (!isAllowedUploadMimeType(extension, file.type)) {
    return invalidMimeTypeMessage;
  }

  return null;
}

async function validateSelectedFile(file: File) {
  const metadataError = validateFile(file);
  if (metadataError) {
    return metadataError;
  }

  const extension = getUploadExtension(file.name);

  try {
    const data = new Uint8Array(
      await (extension === ".zip" ? file : file.slice(0, 64 * 1024)).arrayBuffer()
    );

    if (!hasExpectedUploadFileSignature(extension, data)) {
      return invalidSignatureMessage;
    }

    if (extension === ".zip") {
      inspectZipArchive(data, {
        allowedExtensions: ZIP_ENTRY_ALLOWED_EXTENSION_SET,
        blockedExtensions: BLOCKED_UPLOAD_EXTENSION_SET,
        maxFiles: maxZipFileCount,
        maxTotalUncompressedBytes: maxZipTotalUncompressedBytes,
        maxCompressionRatio: maxZipCompressionRatio
      });
    }
    return null;
  } catch (error) {
    if (!(error instanceof ZipInspectionError)) {
      return zipReadErrorMessage;
    }

    const messages = {
      entry: zipEntryErrorMessage,
      limit: zipLimitErrorMessage,
      path: zipPathErrorMessage,
      read: zipReadErrorMessage
    } satisfies Record<ZipInspectionError["code"], string>;

    return messages[error.code];
  }
}

function validateFileList(files: FileList | File[] | null) {
  if (!files || files.length === 0) {
    return "업로드할 파일을 선택해 주세요.";
  }

  if (files.length > 1) {
    return "파일은 1개만 업로드 가능합니다. 여러 파일은 하나의 ZIP 파일로 압축해 업로드해 주세요.";
  }

  return validateFile(files[0]);
}

function getUploadErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "재업로드에 실패했습니다.";
}

export function ReuploadCustomerUploadForm({ token, publicId }: ReuploadCustomerUploadFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const validationRunRef = useRef(0);
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadedFilename, setUploadedFilename] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  function resetInputValue() {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function applySelectedFiles(files: FileList | File[] | null) {
    const validationRun = validationRunRef.current + 1;
    validationRunRef.current = validationRun;
    const validationMessage = validateFileList(files);
    if (validationMessage) {
      setFile(null);
      setErrorMessage(validationMessage);
      setMessage(null);
      setIsValidating(false);
      resetInputValue();
      return;
    }

    const selectedFile = files?.[0] ?? null;
    if (!selectedFile) {
      return;
    }

    setFile(null);
    setErrorMessage(null);
    setMessage(
      getUploadExtension(selectedFile.name) === ".zip"
        ? "ZIP 파일 안의 파일을 검사하고 있습니다."
        : "파일 형식과 용량을 검사하고 있습니다."
    );
    setIsValidating(true);

    const selectionError = await validateSelectedFile(selectedFile);
    if (validationRunRef.current !== validationRun) {
      return;
    }

    setIsValidating(false);
    if (selectionError) {
      setErrorMessage(selectionError);
      setMessage(null);
      resetInputValue();
      return;
    }

    setFile(selectedFile);
    setErrorMessage(null);
    setMessage("파일 보안 검사를 통과했습니다. 업로드 버튼을 눌러 주세요.");
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    void applySelectedFiles(Array.from(event.currentTarget.files ?? []));
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    void applySelectedFiles(Array.from(event.dataTransfer.files));
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  }

  function handleDropzoneKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openFileDialog();
    }
  }

  function openFileDialog() {
    if (!isSubmitting && !isValidating) {
      fileInputRef.current?.click();
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      setErrorMessage("업로드할 파일을 선택해 주세요.");
      setMessage(null);
      return;
    }

    const validationMessage = validateFile(file);
    if (validationMessage) {
      setErrorMessage(validationMessage);
      setMessage(null);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setMessage("파일을 업로드하는 중입니다. 잠시만 기다려 주세요.");

    try {
      const formData = new FormData();
      if (token) {
        formData.append("token", token);
      }
      if (publicId) {
        formData.append("public_id", publicId);
      }
      formData.append("file", file);

      const response = await fetch("/api/reupload/upload", {
        method: "POST",
        body: formData
      });
      const result = (await response.json().catch(() => null)) as ReuploadUploadResponse | null;

      if (!response.ok || !result?.ok) {
        throw new Error(result?.message || "재업로드에 실패했습니다.");
      }

      setUploadedFilename(result.file?.original_filename ?? file.name);
      setIsComplete(true);
      setMessage("재업로드가 완료되었습니다. 파일 확인 후 진행 상황을 안내드리겠습니다.");
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(getUploadErrorMessage(error));
      setMessage(null);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isComplete) {
    return (
      <div className="notice" style={{ borderColor: "#b7e2c4", background: "#f0fbf3", color: "#17643a" }}>
        <strong>재업로드가 완료되었습니다.</strong>
        <p style={{ marginBottom: 0, marginTop: 8 }}>
          {uploadedFilename ? `업로드 파일: ${uploadedFilename}` : "새 인쇄 파일이 정상 접수되었습니다."}
          <br />
          담당자가 파일을 확인한 뒤 안내드리겠습니다.
        </p>
      </div>
    );
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="reupload_file">수정 파일 업로드</label>
        <div
          aria-busy={isValidating}
          aria-disabled={isSubmitting || isValidating}
          aria-label="수정 파일 업로드 영역"
          onClick={openFileDialog}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onKeyDown={handleDropzoneKeyDown}
          role="button"
          style={{
            alignItems: "center",
            background: isDragging ? "#f0f7ff" : "#f8fafc",
            border: isDragging ? "2px solid #2563eb" : "1px dashed #94a3b8",
            borderRadius: 10,
            cursor: isSubmitting || isValidating ? "not-allowed" : "pointer",
            display: "grid",
            gap: 8,
            minHeight: 156,
            padding: "24px 18px",
            textAlign: "center"
          }}
          tabIndex={0}
        >
          <strong style={{ color: "#0f172a", fontSize: 16 }}>
            {isValidating ? "파일을 검사하고 있습니다..." : "파일을 선택하거나 이곳에 끌어다 놓으세요"}
          </strong>
          <span style={{ color: "#475569", fontSize: 14 }}>
            AI, PDF, EPS, PSD, TIFF, JPG, PNG, DXF, ZIP 파일만 업로드할 수 있습니다.
          </span>
          <span style={{ color: "#64748b", fontSize: 13 }}>
            여러 파일은 ZIP 1개로 압축해 업로드해 주세요. 최대 100MB까지 업로드할 수 있습니다.
          </span>
          <span className="button secondary" style={{ justifySelf: "center", pointerEvents: "none" }}>
            파일 선택
          </span>
        </div>
        <input
          accept={fileInputAccept}
          id="reupload_file"
          name="file"
          onChange={handleFileChange}
          ref={fileInputRef}
          style={{ display: "none" }}
          type="file"
        />
      </div>
      {errorMessage ? (
        <div
          className="notice"
          role="alert"
          style={{ background: "#fff5f3", borderColor: "#f0b8ae", color: "#b42318", margin: 0 }}
        >
          {errorMessage}
        </div>
      ) : null}
      {file ? (
        <div className="notice" style={{ margin: 0 }}>
          <strong>선택된 파일</strong>
          <p style={{ marginBottom: 0, marginTop: 8 }}>
            {file.name} ({formatFileSize(file.size)})
          </p>
        </div>
      ) : null}
      <div className="notice">
        파일은 1개만 업로드 가능합니다.
        <br />
        ZIP 안에는 AI, PDF, EPS, PSD, TIFF, JPG, PNG, DXF 파일만 포함해 주세요.
      </div>
      <button className="button" disabled={isSubmitting || isValidating || !file} type="submit">
        {isValidating ? "파일 검사 중..." : isSubmitting ? "업로드 중..." : "수정 파일 업로드"}
      </button>
      {message ? <p style={{ marginBottom: 0 }}>{message}</p> : null}
    </form>
  );
}
