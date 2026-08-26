"use server";

import { revalidatePath } from "next/cache";
import { createPersonSchema } from "@pylr/schemas";
import { apiFetch } from "@/lib/api";

export async function createPersonAction(organizationId: string, formData: FormData) {
  const parsed = createPersonSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName") || undefined,
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
  });
  if (!parsed.success) throw new Error(parsed.error.issues.map((i) => i.message).join(", "));
  await apiFetch(`/organizations/${organizationId}/people`, { method: "POST", body: JSON.stringify(parsed.data) });
  revalidatePath(`/dashboard/${organizationId}/people`);
}
