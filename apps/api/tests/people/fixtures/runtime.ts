import { randomBytes } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { newPeopleId } from "../../../src/people/persistence/id.js";
import {
  closeTestDatabase,
  connectTestDatabase,
  resetTestDatabase,
  withTransaction,
} from "../../database/harness.js";
import { migrateTestDatabase } from "../../database/migrate.js";
import { seedCorePeople } from "./core.js";

const login = "projectx_people_test_login";
export const adminPool = connectTestDatabase();
let runtimePool: Pool | undefined;

/** Test-only non-owner login; random credential never reaches a file or log. */
export async function startRuntime() {
  const secret = randomBytes(24).toString("hex");
  await adminPool.query(`CREATE ROLE ${login} LOGIN PASSWORD '${secret}'`);
  await adminPool.query(`GRANT projectx_people_runtime TO ${login}`);
  const url = new URL(process.env.DATABASE_URL ?? "");
  url.username = login;
  url.password = secret;
  runtimePool = new Pool({
    connectionString: url.toString(),
    max: 1,
    connectionTimeoutMillis: 5000,
  });
  const identity = await runtimePool.query("SELECT current_user");
  if (identity.rows[0]?.current_user !== login)
    throw Error("Runtime test login failed");
  return runtimePool;
}
export async function stopRuntime() {
  if (runtimePool) await runtimePool.end();
  await adminPool.query(`DROP ROLE IF EXISTS ${login}`);
  await closeTestDatabase(adminPool);
}
export async function freshPeopleFixture() {
  await resetTestDatabase(adminPool);
  await migrateTestDatabase();
  return withTransaction(adminPool, async (client) => {
    const f = await seedCorePeople(client);
    const orgRole = newPeopleId();
    const selfRole = newPeopleId();
    const venueRole = newPeopleId();
    const manageRole = newPeopleId();
    for (const [id, scope, name] of [
      [orgRole, "ORGANIZATION", "Roster fixture"],
      [selfRole, "ORGANIZATION", "Self fixture"],
      [venueRole, "VENUE", "Venue fixture"],
      [manageRole, "ORGANIZATION", "Manage fixture"],
    ])
      await client.query(
        "INSERT INTO roles(id,organization_id,scope,name) VALUES($1,$2,$3,$4)",
        [id, f.orgA, scope, name],
      );
    for (const [role, scope, capability, permissionScope] of [
      [orgRole, "ORGANIZATION", "user.read", "ORGANIZATION"],
      [selfRole, "ORGANIZATION", "user.read.self", "SELF"],
      [venueRole, "VENUE", "venue.read", "VENUE"],
      [manageRole, "ORGANIZATION", "user.manage", "ORGANIZATION"],
    ])
      await client.query(
        "INSERT INTO role_permissions(organization_id,role_id,role_scope,permission_id,permission_scope) VALUES($1,$2,$3,$4,$5)",
        [f.orgA, role, scope, capability, permissionScope],
      );
    const orgGrant = newPeopleId();
    const selfGrant = newPeopleId();
    const venueGrant = newPeopleId();
    const manageGrant = newPeopleId();
    for (const [id, membership, role] of [
      [orgGrant, f.identities.orgA.membership, orgRole],
      [selfGrant, f.identities.a1Only.membership, selfRole],
      [manageGrant, f.identities.orgA.membership, manageRole],
    ])
      await client.query(
        "INSERT INTO organization_role_grants(id,organization_id,membership_id,role_id) VALUES($1,$2,$3,$4)",
        [id, f.orgA, membership, role],
      );
    await client.query(
      "INSERT INTO venue_role_grants(id,organization_id,venue_id,venue_access_id,role_id) VALUES($1,$2,$3,$4,$5)",
      [venueGrant, f.orgA, f.a1, f.identities.a1Only.access[0], venueRole],
    );
    const orgAdminAccess = newPeopleId();
    const venueManageRole = newPeopleId();
    const adminVenueGrant = newPeopleId();
    await client.query(
      "INSERT INTO venue_access(id,organization_id,membership_id,venue_id) VALUES($1,$2,$3,$4)",
      [orgAdminAccess, f.orgA, f.identities.orgA.membership, f.a1],
    );
    await client.query(
      "INSERT INTO roles(id,organization_id,scope,name) VALUES($1,$2,'VENUE','Venue manager fixture')",
      [venueManageRole, f.orgA],
    );
    await client.query(
      "INSERT INTO role_permissions(organization_id,role_id,role_scope,permission_id,permission_scope) VALUES($1,$2,'VENUE','venue.manage','VENUE')",
      [f.orgA, venueManageRole],
    );
    await client.query(
      "INSERT INTO venue_role_grants(id,organization_id,venue_id,venue_access_id,role_id) VALUES($1,$2,$3,$4,$5)",
      [adminVenueGrant, f.orgA, f.a1, orgAdminAccess, venueManageRole],
    );
    return {
      ...f,
      orgRole,
      selfRole,
      venueRole,
      manageRole,
      orgGrant,
      selfGrant,
      venueGrant,
      manageGrant,
      orgAdminAccess,
      venueManageRole,
      adminVenueGrant,
    };
  });
}
export async function rawScoped(
  client: PoolClient,
  user: string,
  org: string,
  venue: string | null,
  mode: "organization" | "venue" | "self",
) {
  await client.query(
    "SELECT set_config('app.user_id',$1,true),set_config('app.organization_id',$2,true),set_config('app.access_mode',$3,true)",
    [user, org, mode],
  );
  if (venue)
    await client.query("SELECT set_config('app.venue_id',$1,true)", [venue]);
}
