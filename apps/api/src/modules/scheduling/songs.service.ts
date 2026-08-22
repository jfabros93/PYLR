import { Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, schema } from "@pylr/db";
import type { Database } from "@pylr/db";
import type { CreateSongInput } from "@pylr/schemas";

@Injectable()
export class SongsService {
  async listSongs(tx: Database, organizationId: string) {
    return tx.query.songs.findMany({
      where: eq(schema.songs.organizationId, organizationId),
      orderBy: (s, { asc }) => [asc(s.title)],
    });
  }

  async createSong(tx: Database, organizationId: string, input: CreateSongInput) {
    const [song] = await tx
      .insert(schema.songs)
      .values({ organizationId, ...input })
      .returning();
    if (!song) throw new Error("Song insert returned no row");
    return song;
  }

  async updateSong(tx: Database, organizationId: string, songId: string, input: Partial<CreateSongInput>) {
    const [song] = await tx
      .update(schema.songs)
      .set({ ...input, updatedAt: new Date() })
      .where(and(eq(schema.songs.id, songId), eq(schema.songs.organizationId, organizationId)))
      .returning();
    if (!song) throw new NotFoundException("Song not found");
    return song;
  }
}
