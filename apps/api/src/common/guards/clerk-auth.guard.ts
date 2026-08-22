import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { verifyClerkSession } from "@pylr/auth";
import type { Env } from "../../config/env";
import type { AuthenticatedRequest } from "./request.types";

/**
 * Verifies the Clerk session JWT on every request and attaches the
 * caller's Clerk id as `request.authProviderId`. This proves "who signed
 * in", nothing about org membership or role — that's resolved next by
 * TenantContextInterceptor from our own `users`/`organization_members`
 * tables, never trusted from client-supplied input.
 */
@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService<Env, true>) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing bearer token");
    }
    const token = header.slice("Bearer ".length);

    try {
      const session = await verifyClerkSession(token, {
        secretKey: this.config.get("CLERK_SECRET_KEY", { infer: true }),
      });
      request.authProviderId = session.authProviderId;
      return true;
    } catch {
      throw new UnauthorizedException("Invalid or expired session");
    }
  }
}
