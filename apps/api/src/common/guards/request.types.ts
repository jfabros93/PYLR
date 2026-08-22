import type { Request } from "express";
import type { Database } from "@pylr/db";
import type { AppAbility } from "@pylr/auth";
import type { OrgRole } from "@pylr/schemas";

export interface AuthenticatedRequest extends Request {
  /** Set by ClerkAuthGuard. The Clerk user id, not our internal users.id. */
  authProviderId: string;
}

export interface TenantScopedRequest extends AuthenticatedRequest {
  /** Set by TenantContextInterceptor once membership is confirmed. */
  tenant: {
    organizationId: string;
    userId: string;
    role: OrgRole;
    ability: AppAbility;
  };
  /**
   * The transaction-scoped Drizzle instance for this request — every
   * tenant-scoped query MUST use this, never a raw APP_DB/SYSTEM_DB
   * connection, or it runs outside the SET LOCAL app.current_org_id that
   * the RLS policies key off.
   */
  tenantDb: Database;
}
