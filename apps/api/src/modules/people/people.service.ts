import { Injectable } from "@nestjs/common";
import { eq, schema } from "@pylr/db";
import type { Database } from "@pylr/db";
import type { CreatePersonInput } from "@pylr/schemas";

@Injectable()
export class PeopleService {
  async listPeople(tx: Database, organizationId: string) {
    return tx.query.people.findMany({
      where: eq(schema.people.organizationId, organizationId),
      orderBy: (p, { asc }) => [asc(p.firstName), asc(p.lastName)],
    });
  }

  async createPerson(tx: Database, organizationId: string, input: CreatePersonInput) {
    const [person] = await tx
      .insert(schema.people)
      .values({ organizationId, ...input })
      .returning();
    if (!person) throw new Error("Person insert returned no row");
    return person;
  }
}
