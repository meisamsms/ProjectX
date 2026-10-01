import { createHash } from "node:crypto";
import type { Pool } from "pg";
import {
  PeopleAccessDenied,
  type TrustedPeopleIdentity,
  withAuthorizedPeopleTransaction,
} from "../authorization/context.js";
import { newPeopleId } from "../persistence/id.js";

export interface AddUserScope {
  readonly identity: TrustedPeopleIdentity;
  readonly organizationId: string;
}
export interface AddUserVenueRequest {
  readonly venueId: string;
  readonly roleIds: readonly string[];
}
export interface AddUserRequest {
  readonly email: string;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly jobTitle: string | null;
  readonly emailNotificationsEnabled: boolean | null;
  readonly suspended: boolean;
  readonly organizationRoleIds: readonly string[];
  readonly venues: readonly AddUserVenueRequest[];
}
export interface AddUserResult {
  readonly provisioningId: string;
  readonly userId: string;
  readonly membershipId: string;
  readonly status: "PENDING";
}

export class PeopleCreateConflict extends Error {
  constructor() {
    super("People account provisioning conflict");
  }
}
export class PeopleCreateInvalid extends Error {
  constructor() {
    super("Invalid People account provisioning request");
  }
}

function nullableText(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function normalizeRequest(scope: AddUserScope, request: AddUserRequest) {
  const venueIds = request.venues.map((venue) => venue.venueId);
  if (new Set(venueIds).size !== venueIds.length)
    throw new PeopleCreateInvalid();
  return {
    organizationId: scope.organizationId,
    email: request.email.trim().toLowerCase(),
    firstName: nullableText(request.firstName),
    lastName: nullableText(request.lastName),
    jobTitle: nullableText(request.jobTitle),
    emailNotificationsEnabled: request.emailNotificationsEnabled,
    suspended: request.suspended,
    organizationRoleIds: [...request.organizationRoleIds].sort(),
    venues: request.venues
      .map((venue) => ({
        venueId: venue.venueId,
        roleIds: [...venue.roleIds].sort(),
      }))
      .sort((left, right) => left.venueId.localeCompare(right.venueId)),
  };
}

function databaseErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error))
    return undefined;
  return typeof error.code === "string" ? error.code : undefined;
}

export async function createPendingPeopleAccount(
  pool: Pool,
  scope: AddUserScope,
  request: AddUserRequest,
  idempotencyKey: string,
): Promise<AddUserResult> {
  const normalized = normalizeRequest(scope, request);
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(normalized))
    .digest("hex");
  const organizationGrants = normalized.organizationRoleIds.map((roleId) => ({
    grant_id: newPeopleId(),
    role_id: roleId,
  }));
  const venueGrants = normalized.venues.map((venue) => ({
    venue_id: venue.venueId,
    access_id: newPeopleId(),
    grants: venue.roleIds.map((roleId) => ({
      grant_id: newPeopleId(),
      role_id: roleId,
    })),
  }));
  try {
    return await withAuthorizedPeopleTransaction(
      pool,
      scope.identity,
      {
        organizationId: scope.organizationId,
        permissionId: "user.manage",
      },
      async (client) => {
        const result = await client.query<{
          provisioning_id: string;
          user_id: string;
          membership_id: string;
          status: "PENDING";
        }>(
          `SELECT * FROM create_pending_user_account(
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16::jsonb
          )`,
          [
            scope.identity.userId,
            scope.organizationId,
            newPeopleId(),
            newPeopleId(),
            newPeopleId(),
            request.email.trim(),
            normalized.email,
            normalized.firstName,
            normalized.lastName,
            normalized.jobTitle,
            normalized.emailNotificationsEnabled,
            normalized.suspended,
            idempotencyKey,
            fingerprint,
            JSON.stringify(organizationGrants),
            JSON.stringify(venueGrants),
          ],
        );
        const row = result.rows[0];
        if (!row) throw new Error("Provisioning command returned no result");
        return {
          provisioningId: row.provisioning_id,
          userId: row.user_id,
          membershipId: row.membership_id,
          status: row.status,
        };
      },
    );
  } catch (error) {
    const code = databaseErrorCode(error);
    if (code === "42501") throw new PeopleAccessDenied();
    if (code === "23505") throw new PeopleCreateConflict();
    if (code === "22023") throw new PeopleCreateInvalid();
    throw error;
  }
}
