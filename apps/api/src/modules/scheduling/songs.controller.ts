import { Body, Controller, Get, Param, Patch, Post, UseGuards, UseInterceptors } from "@nestjs/common";
import { createSongSchema, type CreateSongInput } from "@pylr/schemas";
import { ClerkAuthGuard } from "../../common/guards/clerk-auth.guard";
import { TenantContextInterceptor } from "../../common/guards/tenant-context.interceptor";
import { CheckAbility } from "../../common/guards/check-ability.decorator";
import { Tenant, TenantDb } from "../../common/guards/tenant.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import type { TenantScopedRequest } from "../../common/guards/request.types";
import { SongsService } from "./songs.service";

@Controller("organizations/:organizationId/songs")
@UseGuards(ClerkAuthGuard)
@UseInterceptors(TenantContextInterceptor)
export class SongsController {
  constructor(private readonly songs: SongsService) {}

  @Get()
  @CheckAbility((ability) => ability.can("read", "Song"))
  async list(@TenantDb() tx: TenantScopedRequest["tenantDb"], @Tenant() tenant: TenantScopedRequest["tenant"]) {
    return this.songs.listSongs(tx, tenant.organizationId);
  }

  @Post()
  @CheckAbility((ability) => ability.can("create", "Song"))
  async create(
    @TenantDb() tx: TenantScopedRequest["tenantDb"],
    @Tenant() tenant: TenantScopedRequest["tenant"],
    @Body(new ZodValidationPipe(createSongSchema)) body: ReturnType<typeof createSongSchema.parse>,
  ) {
    return this.songs.createSong(tx, tenant.organizationId, body);
  }

  @Patch(":songId")
  @CheckAbility((ability) => ability.can("update", "Song"))
  async update(
    @TenantDb() tx: TenantScopedRequest["tenantDb"],
    @Tenant() tenant: TenantScopedRequest["tenant"],
    @Param("songId") songId: string,
    @Body(new ZodValidationPipe(createSongSchema.partial())) body: Partial<CreateSongInput>,
  ) {
    return this.songs.updateSong(tx, tenant.organizationId, songId, body);
  }
}
