import type { operations, paths } from "@projectx/contracts/api";
export type HealthResponse =
  paths["/health"]["get"]["responses"][200]["content"]["application/json"];
export async function checkHealth(baseUrl: string): Promise<HealthResponse> {
  const response = await fetch(new URL("/health", baseUrl), {
    credentials: "omit",
  });
  if (!response.ok) throw new Error("Health check failed");
  return (await response.json()) as HealthResponse;
}
// Business API clients must derive DTOs from generated OpenAPI types, never duplicate them.
type RosterOperation = operations["listPeopleAccounts"];
export type AccountsQuery = NonNullable<RosterOperation["parameters"]["query"]>;
export type AccountsResponse =
  RosterOperation["responses"][200]["content"]["application/json"];

export class AccountsRequestError extends Error {
  constructor(readonly status: number) {
    super("Unable to load accounts");
  }
}

export async function getPeopleAccounts(
  query: AccountsQuery,
  signal?: AbortSignal,
): Promise<AccountsResponse> {
  // A same-origin gateway can supply trusted identity; the browser never supplies
  // an organization, venue, token or role. The API itself remains authoritative.
  const base = import.meta.env.VITE_API_BASE_URL ?? "/api/v1/";
  const url = new URL(
    "people/accounts",
    new URL(base.endsWith("/") ? base : `${base}/`, window.location.origin),
  );
  if (query.accessLevel) url.searchParams.set("accessLevel", query.accessLevel);
  if (query.cursor) url.searchParams.set("cursor", query.cursor);
  const response = await fetch(url, {
    credentials: "same-origin",
    signal: signal ?? null,
  });
  if (!response.ok) throw new AccountsRequestError(response.status);
  return (await response.json()) as AccountsResponse;
}
