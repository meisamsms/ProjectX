import type { Pool } from "pg";
import type { LoginProof, LoginTransaction } from "./oidc.js";

export interface StaffSession {
  readonly userId: string;
  readonly organizationId: string | null;
  readonly venueId: string | null;
  readonly contextVersion: number;
  readonly expiresAt: string;
  readonly assurance: "UNVERIFIED";
  readonly contexts: readonly {
    organizationId: string;
    venueId: string | null;
  }[];
}
export type SessionResult =
  | StaffSession
  | { readonly denial: "DISABLED" | "CONTEXT" | "STALE" }
  | null;
export interface StaffSessionStore {
  startLogin(hash: string, transaction: LoginTransaction): Promise<void>;
  consumeLogin(hash: string): Promise<LoginTransaction | null>;
  issue(
    proof: LoginProof,
    hash: string,
    predecessor: string | null,
  ): Promise<SessionResult>;
  read(hash: string, interactive: boolean): Promise<SessionResult>;
  switch(
    hash: string,
    organizationId: string,
    venueId: string | null,
    version: number,
  ): Promise<SessionResult>;
  revoke(hash: string): Promise<void>;
}
export function postgresStaffStore(pool: Pool): StaffSessionStore {
  async function call<T>(sql: string, args: unknown[]): Promise<T> {
    const result = await pool.query<{ value: T }>(sql, args);
    return result.rows[0]?.value as T;
  }
  return {
    async startLogin(h, t) {
      await call("SELECT projectx_test.staff_login_start($1,$2,$3,$4) value", [
        h,
        t.state,
        t.nonce,
        t.verifier,
      ]);
    },
    consumeLogin: (h) =>
      call("SELECT projectx_test.staff_login_consume($1) value", [h]),
    issue: (p, h, old) =>
      call("SELECT projectx_test.staff_session_issue($1,$2,$3,$4,$5) value", [
        p.issuer,
        p.subject,
        h,
        old,
        p.authenticatedAt,
      ]),
    read: (h, touch) =>
      call("SELECT projectx_test.staff_session_read($1,$2) value", [h, touch]),
    switch: (h, org, venue, version) =>
      call("SELECT projectx_test.staff_session_switch($1,$2,$3,$4) value", [
        h,
        org,
        venue,
        version,
      ]),
    async revoke(h) {
      await call("SELECT projectx_test.staff_session_revoke($1) value", [h]);
    },
  };
}
