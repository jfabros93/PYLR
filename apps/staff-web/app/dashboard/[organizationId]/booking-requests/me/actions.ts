"use server";

import { revalidatePath } from "next/cache";
import { resubmitBookingRequestSchema } from "@pylr/schemas";
import { apiFetch } from "@/lib/api";

export async function withdrawBookingRequestAction(organizationId: string, id: string) {
  await apiFetch(`/organizations/${organizationId}/booking-requests/${id}/cancel`, { method: "POST" });
  revalidatePath(`/dashboard/${organizationId}/booking-requests/me`);
}

export async function resubmitBookingRequestAction(organizationId: string, id: string, formData: FormData) {
  const parsed = resubmitBookingRequestSchema.safeParse({
    startsAt: formData.get("startsAt") || undefined,
    endsAt: formData.get("endsAt") || undefined,
    purpose: formData.get("purpose") || undefined,
  });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(", "));
  await apiFetch(`/organizations/${organizationId}/booking-requests/${id}/resubmit`, {
    method: "POST",
    body: JSON.stringify(parsed.data),
  });
  revalidatePath(`/dashboard/${organizationId}/booking-requests/me`);
}
