import { BadRequestException, Controller, Headers, Inject, Post, Req, type RawBodyRequest } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";
import { Webhook } from "svix";
import { schema } from "@pylr/db";
import type { Database } from "@pylr/db";
import type { Env } from "../../config/env";
import { SYSTEM_DB } from "../../common/db/db.tokens";

interface ClerkUserEvent {
  type: string;
  data: {
    id: string;
    email_addresses: { id: string; email_address: string }[];
    primary_email_address_id: string | null;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
    phone_numbers?: { phone_number: string }[];
  };
}

/**
 * Syncs Clerk's user records into our own `users` table so the rest of
 * the API never has to call out to Clerk mid-request. This is the ONE
 * place allowed to write to `users` (RLS on that table has no INSERT
 * policy for the `pylr_app` role at all — see
 * packages/db/migrations/0001_rls.sql), which is why it goes through
 * SYSTEM_DB (BYPASSRLS) rather than the tenant-scoped connection.
 *
 * Must be registered BEFORE the global JSON body parser strips the raw
 * body — see main.ts (`rawBody: true`) — because svix verifies the
 * signature against the exact bytes Clerk sent, not the re-serialized
 * parsed object.
 */
@Controller("webhooks/clerk")
export class ClerkWebhookController {
  constructor(
    @Inject(SYSTEM_DB) private readonly systemDb: Database,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Post()
  async handle(
    @Req() req: RawBodyRequest<Request>,
    @Headers("svix-id") svixId?: string,
    @Headers("svix-timestamp") svixTimestamp?: string,
    @Headers("svix-signature") svixSignature?: string,
  ) {
    const secret = this.config.get("CLERK_WEBHOOK_SECRET", { infer: true });
    if (!secret) {
      throw new BadRequestException("CLERK_WEBHOOK_SECRET is not configured");
    }
    if (!req.rawBody || !svixId || !svixTimestamp || !svixSignature) {
      throw new BadRequestException("Missing webhook signature headers");
    }

    let event: ClerkUserEvent;
    try {
      event = new Webhook(secret).verify(req.rawBody, {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      }) as ClerkUserEvent;
    } catch {
      throw new BadRequestException("Invalid webhook signature");
    }

    if (event.type === "user.created" || event.type === "user.updated") {
      await this.upsertUser(event.data);
    }
    // user.deleted intentionally not handled in Phase 0 — deactivation
    // should go through organization_members.status, not delete the
    // global identity row (it may still be referenced by other orgs).

    return { received: true };
  }

  private async upsertUser(data: ClerkUserEvent["data"]) {
    const primaryEmail = data.email_addresses.find(
      (e) => e.id === data.primary_email_address_id,
    )?.email_address;
    if (!primaryEmail) return;

    await this.systemDb
      .insert(schema.users)
      .values({
        authProviderId: data.id,
        email: primaryEmail,
        firstName: data.first_name,
        lastName: data.last_name,
        avatarUrl: data.image_url,
        phone: data.phone_numbers?.[0]?.phone_number ?? null,
      })
      .onConflictDoUpdate({
        target: schema.users.authProviderId,
        set: {
          email: primaryEmail,
          firstName: data.first_name,
          lastName: data.last_name,
          avatarUrl: data.image_url,
          updatedAt: new Date(),
        },
      });
  }
}
