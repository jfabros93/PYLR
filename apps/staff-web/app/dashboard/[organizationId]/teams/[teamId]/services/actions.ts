"use server";

import { revalidatePath } from "next/cache";
import { createServiceSchema } from "@pylr/schemas";
import { apiFetch } from "@/lib/api";

export async function createServiceAction(organizationId: string, teamId: string, formData: FormData) {
  const parsed = createServiceSchema.safeParse({
    name: formData.get("name"),
    recurrenceRule: formData.get("recurrenceRule") || undefined,
    defaultTime: formData.get("defaultTime") || undefined,
    defaultDurationMinutes: formData.get("defaultDurationMinutes")
      ? Number(formData.get("defaultDurationMinutes"))
      : undefined,
    isPublic: formData.get("isPublic") === "on",
    defaultResourceId: formData.get("defaultResourceId") || undefined,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(", "));
  }

  await apiFetch(`/organizations/${organizationId}/teams/${teamId}/services`, {
    method: "POST",
    body: JSON.stringify(parsed.data),
  });

  revalidatePath(`/dashboard/${organizationId}/teams/${teamId}/services`);
}
