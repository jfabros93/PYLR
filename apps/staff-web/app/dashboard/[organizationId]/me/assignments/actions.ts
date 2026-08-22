"use server";

import { revalidatePath } from "next/cache";
import { updateAssignmentStatusSchema } from "@pylr/schemas";
import { apiFetch } from "@/lib/api";

export async function respondToAssignmentAction(
  organizationId: string,
  planId: string,
  assignmentId: string,
  status: "confirmed" | "declined",
) {
  const parsed = updateAssignmentStatusSchema.parse({ status });
  await apiFetch(`/organizations/${organizationId}/plans/${planId}/role-assignments/${assignmentId}`, {
    method: "PATCH",
    body: JSON.stringify(parsed),
  });
  revalidatePath(`/dashboard/${organizationId}/me/assignments`);
}
