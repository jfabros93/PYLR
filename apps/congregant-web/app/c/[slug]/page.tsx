import { notFound } from "next/navigation";
import type { Organization } from "@pylr/schemas";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

export default async function ChurchPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // Public, unauthenticated lookup — see OrganizationsService.findPublicBySlug,
  // which only ever selects non-sensitive branding columns.
  const res = await fetch(`${API_URL}/organizations/by-slug/${slug}`, { cache: "no-store" });
  if (res.status === 404) notFound();
  if (!res.ok) throw new Error(`Failed to load church: ${res.status}`);
  const org = (await res.json()) as Pick<Organization, "id" | "name" | "slug" | "logoUrl" | "primaryColor">;

  return (
    <main style={{ padding: "var(--pylr-space-6)", maxWidth: 640 }}>
      <h1 style={{ fontFamily: "var(--pylr-font-display)", fontSize: "2rem", marginBottom: "var(--pylr-space-3)" }}>{org.name}</h1>
      <p style={{ color: "var(--pylr-ink-muted)" }}>Public events, Sunday speaker promotion, and giving land here in Phase 3–4.</p>
    </main>
  );
}
