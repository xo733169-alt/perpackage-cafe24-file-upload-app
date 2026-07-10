"use client";

import { useRef, useState, type ChangeEvent, type DragEvent, type FormEvent, type KeyboardEvent } from "react";

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

const allowedExtensions = new Set(["ai", "pdf", "eps", "zip", "jpg", "jpeg", "png"]);
const blockedExtensions = new Set([
  "md",
  "txt",
  "csv",
  "xlsx",
  "docx",
  "exe",
  "bat",
  "cmd",
  "sh",
  "js",
  "html",
  "htm",
  "php",
  "asp",
  "aspx",
  "jsp",
  "vbs",
  "ps1",
  "msi",
  "dmg",
  "apk",
  "jar",
  "scr",
  "com",
  "lnk",
  "dll"
]);
const maxFileSizeBytes = 100 * 1024 * 1024;
const fileInputAccept = ".ai,.pdf,.eps,.jpg,.jpeg,.png,.zip";
const invalidFileTypeMessage =
  "업로드할 수 없는 파일 형식입니다. AI, PDF, EPS, JPG, PNG 또는 ZIP 파일만 업로드해 주세요.";
const fileTooLargeMessage = "파일 용량이 너무 큽니다. 100MB 이하 파일만 업로드해 주세요.";

function getExtension(filename: string) {
  const index = filename.lastIndexOf(".");
  return index === -1 ? "" : filename.slice(index + 1).toLowerCase();
}

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
  const extension = getExtension(file.name);
  if (!extension || blockedExtensions.has(extension) || !allowedExtensions.has(extension)) {
    return invalidFileTypeMessage;
  }

  if (file.size > maxFileSizeBytes) {
    return fileTooLargeMessage;
  }

  return null;
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
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadedFilename, setUploadedFilename] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  function resetInputValue() {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function applySelectedFiles(files: FileList | File[] | null) {
    const validationMessage = validateFileList(files);
    if (validationMessage) {
      setFile(null);
      setErrorMessage(validationMessage);
      setMessage(null);
      resetInputValue();
      return;
    }

    const selectedFile = files?.[0] ?? null;
    setFile(selectedFile);
    setErrorMessage(null);
    setMessage("선택한 파일을 확인했습니다. 업로드 버튼을 눌러 주세요.");
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    applySelectedFiles(event.currentTarget.files);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    applySelectedFiles(Array.from(event.dataTransfer.files));
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
    if (!isSubmitting) {
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
            cursor: isSubmitting ? "not-allowed" : "pointer",
            display: "grid",
            gap: 8,
            minHeight: 156,
            padding: "24px 18px",
            textAlign: "center"
          }}
          tabIndex={0}
        >
          <strong style={{ color: "#0f172a", fontSize: 16 }}>
            파일을 선택하거나 이곳에 끌어다 놓으세요
          </strong>
          <span style={{ color: "#475569", fontSize: 14 }}>
            AI, PDF, EPS, JPG, PNG, ZIP 파일만 업로드할 수 있습니다.
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
        ZIP 안에는 AI, PDF, EPS, JPG, PNG 파일만 포함해 주세요.
      </div>
      <button className="button" disabled={isSubmitting || !file} type="submit">
        {isSubmitting ? "업로드 중..." : "수정 파일 업로드"}
      </button>
      {message ? <p style={{ marginBottom: 0 }}>{message}</p> : null}
      {errorMessage ? <p style={{ color: "#b42318", marginBottom: 0 }}>{errorMessage}</p> : null}
    </form>
  );
}
