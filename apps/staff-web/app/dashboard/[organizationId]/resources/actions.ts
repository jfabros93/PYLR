"use server";

import { revalidatePath } from "next/cache";
import { createResourceSchema } from "@pylr/schemas";
import { apiFetch } from "@/lib/api";

export async function createResourceAction(organizationId: string, formData: FormData) {
  const parsed = createResourceSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    capacity: formData.get("capacity") ? Number(formData.get("capacity")) : undefined,
    requiresApproval: formData.get("requiresApproval") === "on",
  });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(", "));
  await apiFetch(`/organizations/${organizationId}/resources`, { method: "POST", body: JSON.stringify(parsed.data) });
  revalidatePath(`/dashboard/${organizationId}/resources`);
}
