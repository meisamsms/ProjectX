import type { Pool, PoolClient } from "pg";

const trustedBrand = Symbol("server-verified People identity");
export interface TrustedPeopleIdentity {
  readonly userId: string;
  readonly [trustedBrand]: true;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Call only after a trusted server-side identity verification. Never pass a request DTO. */
export function bindVerifiedPeopleIdentity(
  userId: string,
): TrustedPeopleIdentity {
  if (!uuid.test(userId)) throw new Error("Invalid verified user identity");
  return Object.freeze({ userId, [trustedBrand]: true as const });
}

export class PeopleAccessDenied extends Error {
  constructor() {
    super("People access denied");
  }
}

export type PeopleObject = {
  readonly kind: "user" | "membership" | "venueAccess" | "role" | "venue";
  readonly id: string;
};
export interface PeopleScopeRequest {
  readonly organizationId: string;
  readonly venueId?: string;
  readonly permissionId: string;
  readonly target?: PeopleObject;
}
const targetTables: Record<PeopleObject["kind"], string> = {
  user: "users",
  membership: "organization_memberships",
  venueAccess: "venue_access",
  role: "roles",
  venue: "venues",
};

/** A narrow server-only People security boundary; the supplied pool MUST connect as
 * projectx_people_runtime (or an inheriting non-owner runtime login). */
export async function withAuthorizedPeopleTransaction<T>(
  pool: Pool,
  identity: TrustedPeopleIdentity,
  request: PeopleScopeRequest,
  operation: (client: PoolClient) => Promise<T>,
): Promise<T> {
  if (
    identity[trustedBrand] !== true ||
    !uuid.test(identity.userId) ||
    !uuid.test(request.organizationId) ||
    (request.venueId !== undefined && !uuid.test(request.venueId)) ||
    !/^[a-z][a-z.]*$/.test(request.permissionId) ||
    (request.target !== undefined && !uuid.test(request.target.id))
  )
    throw new PeopleAccessDenied();
  const client = await pool.connect();
  let destroy = false;
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL search_path TO projectx_test, public");
    const allowed = await client.query<{ allowed: boolean }>(
      "SELECT people_has_capability($1,$2,$3,$4) allowed",
      [
        identity.userId,
        request.organizationId,
        request.venueId ?? null,
        request.permissionId,
      ],
    );
    if (allowed.rows[0]?.allowed !== true) throw new PeopleAccessDenied();
    const mode =
      request.permissionId === "user.read.self"
        ? "self"
        : request.venueId
          ? "venue"
          : "organization";
    if (mode === "self" && request.target?.kind !== "user")
      throw new PeopleAccessDenied();
    if (mode === "self" && request.target?.id !== identity.userId)
      throw new PeopleAccessDenied();
    await client.query(
      "SELECT set_config('app.user_id',$1,true),set_config('app.organization_id',$2,true),set_config('app.access_mode',$3,true)",
      [identity.userId, request.organizationId, mode],
    );
    await client.query("SELECT set_config('app.venue_id',$1,true)", [
      request.venueId ?? "",
    ]);
    if (request.target) {
      const table = targetTables[request.target.kind];
      const found = await client.query(`SELECT id FROM ${table} WHERE id=$1`, [
        request.target.id,
      ]);
      if (found.rowCount !== 1) throw new PeopleAccessDenied();
    }
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      destroy = true;
    }
    throw error;
  } finally {
    client.release(destroy);
  }
}
