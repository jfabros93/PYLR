import { ConflictException, Injectable } from "@nestjs/common";
import { eq, schema } from "@pylr/db";
import type { Database } from "@pylr/db";
import type { CreateServingRoleInput } from "@pylr/schemas";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

@Injectable()
export class ServingRolesService {
  async listServingRoles(tx: Database, organizationId: string) {
    return tx.query.servingRoles.findMany({
      where: eq(schema.servingRoles.organizationId, organizationId),
      orderBy: (r, { asc }) => [asc(r.name)],
    });
  }

  async createServingRole(tx: Database, organizationId: string, input: CreateServingRoleInput) {
    const [role] = await tx
      .insert(schema.servingRoles)
      .values({ organizationId, teamId: input.teamId, name: input.name, slug: slugify(input.name) })
      .onConflictDoNothing({ target: [schema.servingRoles.organizationId, schema.servingRoles.slug] })
      .returning();
    if (!role) throw new ConflictException("A serving role with that name already exists");
    return role;
  }
}
