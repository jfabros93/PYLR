"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/api";

export async function generateOccurrencesAction(organizationId: string, teamId: string, serviceId: string) {
  await apiFetch(`/organizations/${organizationId}/teams/${teamId}/services/${serviceId}/occurrences/generate`, {
    method: "POST",
    body: JSON.stringify({ count: 8 }),
  });
  revalidatePath(`/dashboard/${organizationId}/teams/${teamId}/services/${serviceId}`);
}
