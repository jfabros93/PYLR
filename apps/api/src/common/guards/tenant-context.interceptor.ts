import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  NestInterceptor,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { from, Observable } from "rxjs";
import { firstValueFrom } from "rxjs";
import { and, eq, withTenantContext, schema } from "@pylr/db";
import type { Database } from "@pylr/db";
import { defineAbilityFor } from "@pylr/auth";
import { APP_DB, SYSTEM_DB } from "../db/db.tokens";
import { CHECK_ABILITY_KEY, type AbilityCheck } from "./check-ability.decorator";
import type { AuthenticatedRequest, TenantScopedRequest } from "./request.types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolves the tenant for a request and runs the entire rest of the
 * request (controller + service calls that use `request.tenantDb`) inside
 * one Postgres transaction scoped to that tenant — see
 * @pylr/db's `withTenantContext`. This is the guard the whole
 * tenant-isolation model hinges on:
 *
 *  1. Look up the internal user for the Clerk id ClerkAuthGuard verified.
 *     This one lookup runs on SYSTEM_DB (BYPASSRLS) because at this point
 *     neither app.current_user_id nor app.current_org_id can be set yet —
 *     it's the only place in the API allowed to do that, and the value
 *     it's keyed on (authProviderId) came from a verified JWT, never from
 *     client-supplied input.
 *  2. Open a transaction on APP_DB with the org id taken from the route
 *     param and the user id just resolved, then confirm an *active*
 *     organization_members row exists for that pair. If it doesn't, 403 —
 *     regardless of what the caller claims about their role.
 *  3. Build the CASL ability for that membership and attach
 *     { tenant, tenantDb } to the request for controllers/services to use.
 *
 * Apply only to routes with an `:organizationId` route param.
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(
    @Inject(APP_DB) private readonly appDb: Database,
    @Inject(SYSTEM_DB) private readonly systemDb: Database,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const abilityCheck = this.reflector.get<AbilityCheck | undefined>(
      CHECK_ABILITY_KEY,
      context.getHandler(),
    );
    return from(this.run(request, next, abilityCheck));
  }

  private async run(
    request: AuthenticatedRequest,
    next: CallHandler,
    abilityCheck: AbilityCheck | undefined,
  ) {
    const organizationId = (request.params as Record<string, string>).organizationId;
    if (!organizationId || !UUID_RE.test(organizationId)) {
      throw new ForbiddenException("Missing or invalid organizationId route param");
    }

    const authUser = await this.systemDb.query.users.findFirst({
      where: eq(schema.users.authProviderId, request.authProviderId),
    });
    if (!authUser) {
      throw new UnauthorizedException("No account found for this session");
    }

    return withTenantContext(
      this.appDb,
      { organizationId, userId: authUser.id },
      async (tx) => {
        const membership = await tx.query.organizationMembers.findFirst({
          where: and(
            eq(schema.organizationMembers.organizationId, organizationId),
            eq(schema.organizationMembers.userId, authUser.id),
            eq(schema.organizationMembers.status, "active"),
          ),
        });
        if (!membership) {
          throw new ForbiddenException("Not an active member of this organization");
        }

        const leadingTeams = await tx.query.teamMembers.findMany({
          where: and(
            eq(schema.teamMembers.organizationId, organizationId),
            eq(schema.teamMembers.userId, authUser.id),
            eq(schema.teamMembers.role, "leader"),
          ),
        });

        const ability = defineAbilityFor({
          organizationId,
          role: membership.role,
          leaderOfTeamIds: leadingTeams.map((t) => t.teamId),
        });
        if (abilityCheck && !abilityCheck(ability)) {
          throw new ForbiddenException("Not permitted for your role");
        }

        const tenantRequest = request as TenantScopedRequest;
        tenantRequest.tenant = { organizationId, userId: authUser.id, role: membership.role, ability };
        tenantRequest.tenantDb = tx;

        return firstValueFrom(next.handle());
      },
    );
  }
}
