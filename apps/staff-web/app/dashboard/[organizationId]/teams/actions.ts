"use server";

import { redirect } from "next/navigation";
import { createTeamSchema } from "@pylr/schemas";
import { apiFetch } from "@/lib/api";
import type { Team } from "@pylr/schemas";

export async function createTeamAction(organizationId: string, formData: FormData) {
  const parsed = createTeamSchema.omit({ organizationId: true }).safeParse({
    name: formData.get("name"),
    type: formData.get("type") || undefined,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join(", "));
  }

  const team = await apiFetch<Team>(`/organizations/${organizationId}/teams`, {
    method: "POST",
    body: JSON.stringify(parsed.data),
  });

  redirect(`/dashboard/${organizationId}/teams/${team.id}/services`);
}
