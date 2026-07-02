"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import {
  clearAdminSessionCookie,
  getAdminAuthConfigStatus,
  isAdminAuthenticated,
  setAdminSessionCookie,
  verifyAdminPassword
} from "@/lib/admin/auth";
import { getFileById, updateFileOrderId } from "@/lib/files/file-service";
import { createFileOrderLinkLog } from "@/lib/files/order-link-log-service";
import {
  createProofConfirmationRequest,
  updateProofConfirmationStatus,
  type ProofConfirmationStatus
} from "@/lib/files/proof-confirmation-service";

function getAdminRequestLogContext() {
  const headerStore = headers();
  const forwardedFor = headerStore.get("x-forwarded-for");

  return {
    ipAddress: forwardedFor?.split(",")[0]?.trim() || headerStore.get("x-real-ip") || null,
    userAgent: headerStore.get("user-agent")
  };
}

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
    const previousFile = await getFileById(fileId);
    const previousOrderId = previousFile?.order_id?.trim() || null;
    await updateFileOrderId({ fileId, orderId });

    if (previousOrderId !== orderId) {
      const context = getAdminRequestLogContext();
      await createFileOrderLinkLog({
        fileId,
        previousOrderId,
        newOrderId: orderId,
        linkSource: "manual",
        adminUser: "admin",
        memo: "관리자 file_id 검색 화면에서 주문번호 수동 연결",
        ipAddress: context.ipAddress,
        userAgent: context.userAgent
      });
    }
  } catch (error) {
    const reason = error instanceof Error && error.message === "Uploaded file was not found."
      ? "file_not_found"
      : "failed";
    redirect(`${fileIdParam}&order_link=${reason}`);
  }

  redirect(`/admin?file_id=${encodeURIComponent(fileId)}&order_link=success`);
}

export async function linkCafe24LookupFileOrderIdAction(formData: FormData) {
  const fileId = String(formData.get("file_id") ?? "").trim();
  const orderId = String(formData.get("order_id") ?? "").trim();
  const redirectToCafe24Lookup = (status: string) => {
    const params = new URLSearchParams();
    if (orderId) {
      params.set("cafe24_order_id", orderId);
    }
    params.set("cafe24_link", status);
    redirect(`/admin?${params.toString()}`);
  };

  if (!isAdminAuthenticated()) {
    redirect("/admin?auth=failed");
  }

  if (!orderId) {
    redirectToCafe24Lookup("empty_order_id");
  }

  if (!fileId) {
    redirectToCafe24Lookup("missing_file_id");
  }

  let linkStatus = "success";

  try {
    const file = await getFileById(fileId);
    if (!file) {
      linkStatus = "file_not_found";
    } else {
      const currentOrderId = file.order_id?.trim() ?? "";
      if (currentOrderId === orderId) {
        linkStatus = "already_linked";
      } else if (currentOrderId && currentOrderId !== orderId) {
        linkStatus = "different_order";
      } else {
        await updateFileOrderId({ fileId, orderId });
        const context = getAdminRequestLogContext();
        await createFileOrderLinkLog({
          fileId,
          previousOrderId: null,
          newOrderId: orderId,
          linkSource: "cafe24_order_lookup",
          adminUser: "admin",
          memo: "Cafe24 주문 조회 결과에서 업로드 파일 ID 확인 후 주문번호 연결",
          ipAddress: context.ipAddress,
          userAgent: context.userAgent
        });
      }
    }
  } catch (error) {
    console.error("cafe24_lookup_file_order_link_failed", {
      message: error instanceof Error ? error.message : "Unknown error"
    });
    linkStatus = "failed";
  }

  redirectToCafe24Lookup(linkStatus);
}

function parseSelectedProofItems(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => typeof item === "string" ? item.trim() : "")
      .filter(Boolean)
      .slice(0, 20);
  } catch {
    return [];
  }
}

function redirectToFileProofResult(fileId: string, status: string) {
  const params = new URLSearchParams();
  if (fileId) {
    params.set("file_id", fileId);
  }
  params.set("proof_action", status);
  redirect(`/admin?${params.toString()}`);
}

export async function createProofConfirmationRequestAction(formData: FormData) {
  const fileId = String(formData.get("file_id") ?? "").trim();
  const orderId = String(formData.get("order_id") ?? "").trim();
  const requestMessage = String(formData.get("request_message") ?? "").trim();
  const extraMemo = String(formData.get("extra_memo") ?? "").trim();
  const selectedItems = parseSelectedProofItems(formData.get("selected_items"));

  if (!isAdminAuthenticated()) {
    redirect("/admin?auth=failed");
  }

  if (!fileId) {
    redirectToFileProofResult("", "missing_file_id");
  }

  if (!requestMessage) {
    redirectToFileProofResult(fileId, "empty_message");
  }

  try {
    await createProofConfirmationRequest({
      fileId,
      orderId: orderId || null,
      requestMessage,
      selectedItems,
      extraMemo,
      requestedBy: "admin"
    });
  } catch (error) {
    console.error("proof_confirmation_request_action_failed", {
      message: error instanceof Error ? error.message : "Unknown error",
      fileId
    });
    redirectToFileProofResult(fileId, "request_failed");
  }

  redirectToFileProofResult(fileId, "request_saved");
}

export async function updateProofConfirmationStatusAction(formData: FormData) {
  const fileId = String(formData.get("file_id") ?? "").trim();
  const confirmationId = String(formData.get("confirmation_id") ?? "").trim();
  const proofStatus = String(formData.get("proof_status") ?? "").trim() as Exclude<
    ProofConfirmationStatus,
    "requested" | "skipped"
  >;
  const customerResponse = String(formData.get("customer_response") ?? "").trim();
  const rejectReason = String(formData.get("reject_reason") ?? "").trim();
  const responseChannel = String(formData.get("response_channel") ?? "").trim();

  if (!isAdminAuthenticated()) {
    redirect("/admin?auth=failed");
  }

  if (!fileId) {
    redirectToFileProofResult("", "missing_file_id");
  }

  if (!confirmationId) {
    redirectToFileProofResult(fileId, "missing_confirmation_id");
  }

  try {
    await updateProofConfirmationStatus({
      confirmationId,
      proofStatus,
      customerResponse,
      rejectReason,
      responseChannel,
      confirmedBy: "admin"
    });
  } catch (error) {
    console.error("proof_confirmation_status_action_failed", {
      message: error instanceof Error ? error.message : "Unknown error",
      fileId,
      confirmationId,
      proofStatus
    });
    redirectToFileProofResult(fileId, "status_failed");
  }

  redirectToFileProofResult(fileId, `${proofStatus}_saved`);
}
