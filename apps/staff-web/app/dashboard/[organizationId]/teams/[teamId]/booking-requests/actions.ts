"use server";

import { revalidatePath } from "next/cache";
import { createBookingRequestSchema } from "@pylr/schemas";
import { apiFetch } from "@/lib/api";

export async function createBookingRequestAction(organizationId: string, teamId: string, formData: FormData) {
  const parsed = createBookingRequestSchema.safeParse({
    requestingTeamId: teamId,
    resourceId: formData.get("resourceId"),
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    purpose: formData.get("purpose") || undefined,
  });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(", "));
  await apiFetch(`/organizations/${organizationId}/booking-requests`, {
    method: "POST",
    body: JSON.stringify(parsed.data),
  });
  revalidatePath(`/dashboard/${organizationId}/teams/${teamId}/booking-requests`);
}
