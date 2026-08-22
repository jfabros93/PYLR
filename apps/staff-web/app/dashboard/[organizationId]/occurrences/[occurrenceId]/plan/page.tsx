import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api";
import type { Plan } from "@pylr/schemas";

/**
 * Thin redirector: resolves (or auto-creates, on first visit) the plan
 * for an occurrence, then sends the browser to its real URL. Keeps the
 * services/occurrences list page from having to eagerly create a draft
 * plan for every occurrence it renders, just to know a link target.
 */
export default async function OccurrencePlanRedirect({
  params,
}: {
  params: Promise<{ organizationId: string; occurrenceId: string }>;
}) {
  const { organizationId, occurrenceId } = await params;
  const plan = await apiFetch<Plan>(`/organizations/${organizationId}/occurrences/${occurrenceId}/plan`);
  redirect(`/dashboard/${organizationId}/plans/${plan.id}`);
}
