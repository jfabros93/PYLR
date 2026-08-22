"use server";

import { revalidatePath } from "next/cache";
import { createServingRoleSchema } from "@pylr/schemas";
import { apiFetch } from "@/lib/api";

export async function createServingRoleAction(organizationId: string, formData: FormData) {
  const parsed = createServingRoleSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(", "));
  await apiFetch(`/organizations/${organizationId}/serving-roles`, { method: "POST", body: JSON.stringify(parsed.data) });
  revalidatePath(`/dashboard/${organizationId}/serving-roles`);
}
