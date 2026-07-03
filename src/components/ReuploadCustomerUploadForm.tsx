"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";

type ReuploadCustomerUploadFormProps = {
  token: string;
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

const allowedExtensions = new Set(["ai", "pdf", "eps", "zip", "jpg", "jpeg", "png", "psd"]);
const blockedExtensions = new Set(["exe", "bat", "cmd", "sh", "js", "msi", "dll", "php", "html", "htm"]);

function getExtension(filename: string) {
  const index = filename.lastIndexOf(".");
  return index === -1 ? "" : filename.slice(index + 1).toLowerCase();
}

function validateFileList(files: FileList | null) {
  if (!files || files.length === 0) {
    return "업로드할 파일을 선택해 주세요.";
  }

  if (files.length > 1) {
    return "파일은 1개만 업로드 가능합니다. 여러 파일은 하나의 ZIP 파일로 압축해 업로드해 주세요.";
  }

  const extension = getExtension(files[0].name);
  if (blockedExtensions.has(extension)) {
    return "보안상 업로드할 수 없는 파일 형식입니다.";
  }

  if (!allowedExtensions.has(extension)) {
    return "AI, PDF, EPS, ZIP, JPG, PNG, PSD 파일만 업로드할 수 있습니다.";
  }

  return null;
}

export function ReuploadCustomerUploadForm({ token }: ReuploadCustomerUploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadedFilename, setUploadedFilename] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const validationMessage = validateFileList(event.currentTarget.files);
    if (validationMessage) {
      setFile(null);
      setErrorMessage(validationMessage);
      setMessage(null);
      event.currentTarget.value = "";
      return;
    }

    setFile(event.currentTarget.files?.[0] ?? null);
    setErrorMessage(null);
    setMessage("선택한 파일을 확인했습니다. 업로드 버튼을 눌러 주세요.");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      setErrorMessage("업로드할 파일을 선택해 주세요.");
      setMessage(null);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setMessage("파일을 업로드하는 중입니다. 잠시만 기다려 주세요.");

    try {
      const formData = new FormData();
      formData.append("token", token);
      formData.append("file", file);

      const response = await fetch("/api/reupload/upload", {
        method: "POST",
        body: formData
      });
      const result = (await response.json()) as ReuploadUploadResponse;

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "재업로드에 실패했습니다.");
      }

      setUploadedFilename(result.file?.original_filename ?? file.name);
      setIsComplete(true);
      setMessage("재업로드가 완료되었습니다. 파일 확인 후 제작 진행 상황을 안내드리겠습니다.");
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "재업로드에 실패했습니다.");
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
        <label htmlFor="reupload_file">수정 파일 선택</label>
        <input
          accept=".ai,.pdf,.eps,.zip,.jpg,.jpeg,.png,.psd"
          id="reupload_file"
          name="file"
          onChange={handleFileChange}
          type="file"
        />
      </div>
      <div className="notice">
        파일은 1개만 업로드 가능합니다.
        <br />
        여러 파일을 전달해야 하는 경우 AI, PDF, 이미지, 칼선 파일 등을 하나의 ZIP 파일로 압축해 업로드해 주세요.
      </div>
      <button className="button" disabled={isSubmitting} type="submit">
        {isSubmitting ? "업로드 중..." : "수정 파일 업로드"}
      </button>
      {message ? <p style={{ marginBottom: 0 }}>{message}</p> : null}
      {errorMessage ? <p style={{ color: "#b42318", marginBottom: 0 }}>{errorMessage}</p> : null}
    </form>
  );
}
