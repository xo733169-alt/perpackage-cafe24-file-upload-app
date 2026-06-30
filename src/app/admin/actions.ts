"use server";

import { redirect } from "next/navigation";
import {
  clearAdminSessionCookie,
  getAdminAuthConfigStatus,
  isAdminAuthenticated,
  setAdminSessionCookie,
  verifyAdminPassword
} from "@/lib/admin/auth";
import { updateFileOrderId } from "@/lib/files/file-service";

export async function loginAdminAction(formData: FormData) {
  const status = getAdminAuthConfigStatus();
  if (!status.isConfigured) {
    redirect("/admin?auth=missing");
  }

  const password = String(formData.get("password") ?? "");
  if (!verifyAdminPassword(password)) {
    redirect("/admin?auth=failed");
  }

  setAdminSessionCookie();
  redirect("/admin");
}

export async function logoutAdminAction() {
  clearAdminSessionCookie();
  redirect("/admin");
}

export async function linkFileOrderIdAction(formData: FormData) {
  const fileId = String(formData.get("file_id") ?? "").trim();
  const orderId = String(formData.get("order_id") ?? "").trim();
  const fileIdParam = fileId ? `?file_id=${encodeURIComponent(fileId)}` : "";

  if (!isAdminAuthenticated()) {
    redirect("/admin?auth=failed");
  }

  if (!fileId) {
    redirect("/admin?order_link=missing_file_id");
  }

  if (!orderId) {
    redirect(`/admin?file_id=${encodeURIComponent(fileId)}&order_link=empty_order_id`);
  }

  try {
    await updateFileOrderId({ fileId, orderId });
  } catch (error) {
    const reason = error instanceof Error && error.message === "Uploaded file was not found."
      ? "file_not_found"
      : "failed";
    redirect(`${fileIdParam}&order_link=${reason}`);
  }

  redirect(`/admin?file_id=${encodeURIComponent(fileId)}&order_link=success`);
}
