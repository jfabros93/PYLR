import { createClerkClient, verifyToken } from "@clerk/backend";

export interface VerifiedSession {
  /** Clerk user id — matches users.auth_provider_id, not our internal users.id. */
  authProviderId: string;
}

/**
 * Verifies a Clerk session JWT from the Authorization header. Throws if the
 * token is missing, expired, or signed by a different Clerk instance.
 *
 * The resulting authProviderId is looked up against `users.auth_provider_id`
 * to resolve our internal user, and that internal user's
 * organization_members row for the requested org is what actually decides
 * access — this function only proves "this really is a Clerk-authenticated
 * request", nothing about which org/role it maps to.
 */
export async function verifyClerkSession(
  bearerToken: string,
  opts: { secretKey: string },
): Promise<VerifiedSession> {
  const { sub } = await verifyToken(bearerToken, { secretKey: opts.secretKey });
  return { authProviderId: sub };
}

/** Thin factory so apps/api constructs one client from its own env config. */
export function createClerkBackendClient(secretKey: string) {
  return createClerkClient({ secretKey });
}
