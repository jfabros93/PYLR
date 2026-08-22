"use server";

import { redirect } from "next/navigation";
import { createOrganizationSchema } from "@pylr/schemas";
import { apiFetch } from "@/lib/api";
import type { Organization } from "@pylr/schemas";

export async function createOrganizationAction(formData: FormData) {
  const parsed = createOrganizationSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    timezone: formData.get("timezone") || undefined,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(", "));
  }

  const org = await apiFetch<Organization>("/organizations", {
    method: "POST",
    body: JSON.stringify(parsed.data),
  });

  redirect(`/dashboard/${org.id}`);
}
