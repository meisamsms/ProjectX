import type { components } from "@projectx/contracts/api";
import type { Pool } from "pg";
import {
  type TrustedPeopleIdentity,
  withAuthorizedPeopleTransaction,
} from "../authorization/context.js";
import { newPeopleId } from "../persistence/id.js";

export type BookedByName = components["schemas"]["BookedByName"];
export type AddNameRequest = components["schemas"]["AddBookedByNameRequest"];
export type UpdateNameRequest =
  components["schemas"]["UpdateBookedByNameRequest"];
export interface BookedByScope {
  readonly identity: TrustedPeopleIdentity;
  readonly organizationId: string;
  readonly venueId: string;
}
export class BookedByInvalid extends Error {}
export class BookedByNotFound extends Error {}
export class BookedByConflict extends Error {}
export function normalizeBookedByName(value: unknown): string {
  if (
    typeof value !== "string" ||
    Array.from(value).length > 1024 ||
    Array.from(value).some((character) => {
      const code = character.codePointAt(0) ?? 0;
      return (
        code <= 31 ||
        (code >= 127 && code <= 159) ||
        (code >= 0xd800 && code <= 0xdfff)
      );
    })
  )
    throw new BookedByInvalid();
  const name = value.trim();
  if (Array.from(name).length < 1 || Array.from(name).length > 120)
    throw new BookedByInvalid();
  return name;
}
const target = (scope: BookedByScope) => ({
  organizationId: scope.organizationId,
  venueId: scope.venueId,
  permissionId: "venue.manage",
});
export async function listBookedByNames(
  pool: Pool,
  scope: BookedByScope,
  query: { limit?: number; cursor?: string },
): Promise<components["schemas"]["BookedByNameList"]> {
  const limit = query.limit ?? 25;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new BookedByInvalid();
  return withAuthorizedPeopleTransaction(
    pool,
    scope.identity,
    target(scope),
    async (client) => {
      const result = await client.query<BookedByName>(
        `SELECT id,display_name AS "displayName",version FROM booked_by_names
      WHERE organization_id=$1 AND venue_id=$2 AND ($3::uuid IS NULL OR id>$3::uuid) ORDER BY id LIMIT $4`,
        [scope.organizationId, scope.venueId, query.cursor ?? null, limit + 1],
      );
      const items = result.rows.slice(0, limit);
      return {
        items,
        nextCursor:
          result.rows.length > limit ? (items.at(-1)?.id ?? null) : null,
      };
    },
  );
}
export async function addBookedByName(
  pool: Pool,
  scope: BookedByScope,
  input: AddNameRequest,
  requestId: string = crypto.randomUUID(),
): Promise<BookedByName> {
  const name = normalizeBookedByName(input.displayName);
  return withAuthorizedPeopleTransaction(
    pool,
    scope.identity,
    target(scope),
    async (client) => {
      await client.query("SELECT set_config('app.request_id',$1,true)", [
        requestId,
      ]);
      const result = await client.query<BookedByName>(
        `INSERT INTO booked_by_names(id,organization_id,venue_id,display_name)
      VALUES($1,$2,$3,$4) RETURNING id,display_name AS "displayName",version`,
        [newPeopleId(), scope.organizationId, scope.venueId, name],
      );
      const created = result.rows[0];
      if (!created) throw new Error("Booked By insert failed");
      return created;
    },
  );
}
export async function updateBookedByName(
  pool: Pool,
  scope: BookedByScope,
  id: string,
  input: UpdateNameRequest,
  requestId: string = crypto.randomUUID(),
): Promise<BookedByName> {
  const name = normalizeBookedByName(input.displayName);
  if (
    !Number.isInteger(input.version) ||
    input.version < 1 ||
    input.version > 2147483646
  )
    throw new BookedByInvalid();
  return withAuthorizedPeopleTransaction(
    pool,
    scope.identity,
    target(scope),
    async (client) => {
      await client.query("SELECT set_config('app.request_id',$1,true)", [
        requestId,
      ]);
      const result = await client.query<BookedByName>(
        `UPDATE booked_by_names SET display_name=$4,version=version+1
      WHERE id=$1 AND organization_id=$2 AND venue_id=$3 AND version=$5 RETURNING id,display_name AS "displayName",version`,
        [id, scope.organizationId, scope.venueId, name, input.version],
      );
      if (result.rows[0]) return result.rows[0];
      const existing = await client.query(
        "SELECT id FROM booked_by_names WHERE id=$1 AND organization_id=$2 AND venue_id=$3",
        [id, scope.organizationId, scope.venueId],
      );
      if (existing.rowCount !== 1) throw new BookedByNotFound();
      throw new BookedByConflict();
    },
  );
}
