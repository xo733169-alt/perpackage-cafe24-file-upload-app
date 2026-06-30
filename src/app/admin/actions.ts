"use server";

import { redirect } from "next/navigation";
import {
  clearAdminSessionCookie,
  getAdminAuthConfigStatus,
  setAdminSessionCookie,
  verifyAdminPassword
} from "@/lib/admin/auth";

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
