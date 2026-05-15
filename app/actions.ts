"use server";

import { validateTargetUrl } from "@/utils/url-security";

export async function validateUrlAction(url: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await validateTargetUrl(url);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Invalid URL" };
  }
}
