"use server";

import { revalidatePath } from "next/cache";
import { inviteMemberSchema } from "@pylr/schemas";
import { apiFetch } from "@/lib/api";

export async function inviteMemberAction(organizationId: string, formData: FormData) {
  const parsed = inviteMemberSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role") || undefined,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(", "));
  }

  await apiFetch(`/organizations/${organizationId}/members/invite`, {
    method: "POST",
    body: JSON.stringify(parsed.data),
  });

  revalidatePath(`/dashboard/${organizationId}`);
}
