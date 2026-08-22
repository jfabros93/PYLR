"use server";

import { revalidatePath } from "next/cache";
import { reviewNoteSchema } from "@pylr/schemas";
import { apiFetch } from "@/lib/api";

export async function approveBookingRequestAction(organizationId: string, id: string) {
  await apiFetch(`/organizations/${organizationId}/booking-requests/${id}/approve`, { method: "POST" });
  revalidatePath(`/dashboard/${organizationId}/booking-requests`);
}

export async function denyBookingRequestAction(organizationId: string, id: string, formData: FormData) {
  const parsed = reviewNoteSchema.parse({ reviewNote: formData.get("reviewNote") || undefined });
  await apiFetch(`/organizations/${organizationId}/booking-requests/${id}/deny`, {
    method: "POST",
    body: JSON.stringify(parsed),
  });
  revalidatePath(`/dashboard/${organizationId}/booking-requests`);
}

export async function requestChangesBookingRequestAction(organizationId: string, id: string, formData: FormData) {
  const parsed = reviewNoteSchema.parse({ reviewNote: formData.get("reviewNote") || undefined });
  await apiFetch(`/organizations/${organizationId}/booking-requests/${id}/request-changes`, {
    method: "POST",
    body: JSON.stringify(parsed),
  });
  revalidatePath(`/dashboard/${organizationId}/booking-requests`);
}
