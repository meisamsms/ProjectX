import type { PoolClient } from "pg";
import { newPeopleId } from "../../../src/people/persistence/id.js";

/** Synthetic relationship graph only; no reference-app staff/customer data. */
export async function seedCorePeople(client: PoolClient) {
  const orgA = newPeopleId();
  const orgB = newPeopleId();
  const a1 = newPeopleId();
  const a2 = newPeopleId();
  const b1 = newPeopleId();
  for (const [id, name] of [
    [orgA, "ORG-A"],
    [orgB, "ORG-B"],
  ])
    await client.query("INSERT INTO organizations(id,name) VALUES ($1,$2)", [
      id,
      name,
    ]);
  for (const [id, org, name] of [
    [a1, orgA, "VENUE-A1"],
    [a2, orgA, "VENUE-A2"],
    [b1, orgB, "VENUE-B1"],
  ])
    await client.query(
      "INSERT INTO venues(id,organization_id,name) VALUES ($1,$2,$3)",
      [id, org, name],
    );
  type FixtureKey =
    | "orgA"
    | "a1Only"
    | "a1a2"
    | "a2Only"
    | "orgB"
    | "revokedMembership"
    | "revokedAccess"
    | "disabledUser";
  const identities = {} as Record<
    FixtureKey,
    { user: string; membership: string; access: string[] }
  >;
  for (const [key, org, venueIds] of [
    ["orgA", orgA, []],
    ["a1Only", orgA, [a1]],
    ["a1a2", orgA, [a1, a2]],
    ["a2Only", orgA, [a2]],
    ["orgB", orgB, [b1]],
    ["revokedMembership", orgA, [a1]],
    ["revokedAccess", orgA, [a1]],
    ["disabledUser", orgA, [a1]],
  ] as const) {
    const user = newPeopleId();
    const membership = newPeopleId();
    await client.query(
      "INSERT INTO users(id, disabled_at) VALUES ($1, CASE WHEN $2 THEN now() ELSE NULL END)",
      [user, key === "disabledUser"],
    );
    await client.query(
      "INSERT INTO authenticated_identities(id,user_id,issuer,subject) VALUES ($1,$2,$3,$4)",
      [newPeopleId(), user, "https://fixture.invalid", key],
    );
    await client.query(
      "INSERT INTO organization_memberships(id,user_id,organization_id,revoked_at) VALUES ($1,$2,$3,CASE WHEN $4 THEN now() ELSE NULL END)",
      [membership, user, org, key === "revokedMembership"],
    );
    const access: string[] = [];
    for (const venue of venueIds) {
      const id = newPeopleId();
      await client.query(
        "INSERT INTO venue_access(id,organization_id,membership_id,venue_id,revoked_at) VALUES ($1,$2,$3,$4,CASE WHEN $5 THEN now() ELSE NULL END)",
        [id, org, membership, venue, key === "revokedAccess"],
      );
      access.push(id);
    }
    identities[key] = { user, membership, access };
  }
  return { orgA, orgB, a1, a2, b1, identities };
}
