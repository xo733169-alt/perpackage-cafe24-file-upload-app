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
