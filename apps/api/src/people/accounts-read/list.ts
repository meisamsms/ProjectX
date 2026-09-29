import type { Pool } from "pg";
import {
  type TrustedPeopleIdentity,
  withAuthorizedPeopleTransaction,
} from "../authorization/context.js";

export interface PeopleRosterScope {
  readonly identity: TrustedPeopleIdentity;
  readonly organizationId: string;
}
export interface RosterQuery {
  readonly accessLevel?: string;
  readonly cursor?: string;
  readonly limit?: number;
}

export async function listPeopleAccounts(
  pool: Pool,
  scope: PeopleRosterScope,
  query: RosterQuery,
) {
  const limit = query.limit ?? 25;
  return withAuthorizedPeopleTransaction(
    pool,
    scope.identity,
    { organizationId: scope.organizationId, permissionId: "user.read" },
    async (client) => {
      const result = await client.query<{
        id: string;
        name: string | null;
        job_title: string | null;
        email_notifications_enabled: boolean | null;
        access_levels: string[];
      }>(
        `SELECT u.id,
          nullif(concat_ws(' ',nullif(btrim(u.first_name),''),nullif(btrim(u.last_name),'')),'') AS name,
          m.job_title,m.email_notifications_enabled,
          COALESCE((SELECT array_agg(DISTINCT r.name ORDER BY r.name)
            FROM organization_role_grants g
            JOIN roles r ON r.id=g.role_id AND r.organization_id=m.organization_id AND r.scope='ORGANIZATION'
            WHERE g.organization_id=m.organization_id AND g.membership_id=m.id AND g.revoked_at IS NULL),ARRAY[]::text[]) AS access_levels
        FROM organization_memberships m JOIN users u ON u.id=m.user_id
        WHERE m.organization_id=$1 AND m.revoked_at IS NULL
          AND ($2::uuid IS NULL OR u.id>$2::uuid)
          AND ($3::text IS NULL OR EXISTS (
            SELECT 1 FROM organization_role_grants fg
            JOIN roles fr ON fr.id=fg.role_id AND fr.organization_id=m.organization_id AND fr.scope='ORGANIZATION'
            WHERE fg.organization_id=m.organization_id AND fg.membership_id=m.id AND fg.revoked_at IS NULL AND fr.name=$3))
        ORDER BY u.id LIMIT $4`,
        [
          scope.organizationId,
          query.cursor ?? null,
          query.accessLevel ?? null,
          limit + 1,
        ],
      );
      const hasMore = result.rows.length > limit;
      const rows = result.rows.slice(0, limit);
      return {
        items: rows.map((row) => ({
          id: row.id,
          name: row.name,
          jobTitle: row.job_title,
          emailNotificationsEnabled: row.email_notifications_enabled,
          accessLevels: row.access_levels,
        })),
        nextCursor: hasMore ? (rows.at(-1)?.id ?? null) : null,
      };
    },
  );
}
