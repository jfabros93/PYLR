import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { TenantScopedRequest } from "./request.types";

/** Injects `request.tenant` (set by TenantContextInterceptor) into a route handler. */
export const Tenant = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<TenantScopedRequest>();
  return request.tenant;
});

/** Injects the transaction-scoped Database for this request. Always use this — never APP_DB/SYSTEM_DB directly — inside a tenant-scoped controller. */
export const TenantDb = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<TenantScopedRequest>();
  return request.tenantDb;
});
