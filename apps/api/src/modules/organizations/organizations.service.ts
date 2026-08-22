import { ConflictException, Inject, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { and, eq, schema, withTenantContext, withUserContext } from "@pylr/db";
import type { Database } from "@pylr/db";
import type { CreateOrganizationInput, InviteMemberInput } from "@pylr/schemas";
import { APP_DB, SYSTEM_DB } from "../../common/db/db.tokens";

@Injectable()
export class OrganizationsService {
  constructor(
    @Inject(APP_DB) private readonly appDb: Database,
    @Inject(SYSTEM_DB) private readonly systemDb: Database,
  ) {}

  /**
   * Creates a new org, its default campus, and makes the requesting user
   * its org_admin. The `organizations` insert itself goes through
   * SYSTEM_DB (BYPASSRLS) — see the comment on `organizations` in
   * migrations/0001_rls.sql for why: pylr_app has no INSERT policy on
   * this table at all, because RETURNING a just-inserted row also has to
   * satisfy the SELECT policy, which is structurally impossible before
   * the org (and therefore any tenant context) exists.
   */
  async createOrganization(authProviderId: string, input: CreateOrganizationInput) {
    const user = await this.systemDb.query.users.findFirst({
      where: eq(schema.users.authProviderId, authProviderId),
    });
    if (!user) {
      throw new UnauthorizedException(
        "No account found for this session — Clerk user sync has not run yet",
      );
    }

    // Slug uniqueness is global (public URLs), so this check is also
    // necessarily cross-tenant — it runs on SYSTEM_DB for the same reason
    // the insert does.
    const existing = await this.systemDb.query.organizations.findFirst({
      where: eq(schema.organizations.slug, input.slug),
    });
    if (existing) {
      throw new ConflictException(`Slug "${input.slug}" is already taken`);
    }

    const [org] = await this.systemDb
      .insert(schema.organizations)
      .values({ name: input.name, slug: input.slug, timezone: input.timezone })
      .returning();
    if (!org) throw new Error("Organization insert returned no row");

    await withTenantContext(this.appDb, { organizationId: org.id, userId: user.id }, async (tx) => {
      await tx.insert(schema.campuses).values({
        organizationId: org.id,
        name: "Main Campus",
        isDefault: true,
      });
      await tx.insert(schema.organizationMembers).values({
        organizationId: org.id,
        userId: user.id,
        role: "org_admin",
        status: "active",
      });
    });

    return org;
  }

  /** All orgs the calling user is an active member of. */
  async listMyOrganizations(authProviderId: string) {
    const user = await this.systemDb.query.users.findFirst({
      where: eq(schema.users.authProviderId, authProviderId),
    });
    if (!user) {
      throw new UnauthorizedException(
        "No account found for this session — Clerk user sync has not run yet",
      );
    }

    return withUserContext(this.appDb, user.id, (tx) =>
      tx.query.organizationMembers.findMany({
        where: and(
          eq(schema.organizationMembers.userId, user.id),
          eq(schema.organizationMembers.status, "active"),
        ),
        with: { organization: true },
      }),
    );
  }

  /** Public branding lookup for congregant-facing pages — no auth, no tenant context. Only ever selects non-sensitive columns. */
  async findPublicBySlug(slug: string) {
    const org = await this.systemDb.query.organizations.findFirst({
      where: eq(schema.organizations.slug, slug),
      columns: { id: true, name: true, slug: true, logoUrl: true, primaryColor: true },
    });
    if (!org) throw new NotFoundException("Organization not found");
    return org;
  }

  async getCurrentOrganization(tx: Database, organizationId: string) {
    const org = await tx.query.organizations.findFirst({
      where: eq(schema.organizations.id, organizationId),
    });
    if (!org) throw new NotFoundException("Organization not found");
    return org;
  }

  async listMembers(tx: Database, organizationId: string) {
    return tx.query.organizationMembers.findMany({
      where: eq(schema.organizationMembers.organizationId, organizationId),
      with: { user: true },
    });
  }

  /**
   * Invites a person into the org by email. If no `users` row exists yet
   * for that email (they've never signed in via Clerk), a placeholder
   * user is created with a `pending:` authProviderId that gets reconciled
   * to their real Clerk id the first time they sign in with that email —
   * see the TODO in AuthModule for the reconciliation step, which is out
   * of scope for Phase 0.
   */
  async inviteMember(tx: Database, organizationId: string, invitedBy: string, input: InviteMemberInput) {
    let user = await this.systemDb.query.users.findFirst({
      where: eq(schema.users.email, input.email),
    });
    if (!user) {
      const [created] = await this.systemDb
        .insert(schema.users)
        .values({ authProviderId: `pending:${crypto.randomUUID()}`, email: input.email })
        .returning();
      if (!created) throw new Error("Pending user insert returned no row");
      user = created;
    }

    const [membership] = await tx
      .insert(schema.organizationMembers)
      .values({
        organizationId,
        userId: user.id,
        role: input.role,
        status: "invited",
        invitedByUserId: invitedBy,
      })
      .onConflictDoNothing({
        target: [schema.organizationMembers.organizationId, schema.organizationMembers.userId],
      })
      .returning();

    if (!membership) {
      throw new ConflictException("That person is already a member of this organization");
    }
    return membership;
  }
}
