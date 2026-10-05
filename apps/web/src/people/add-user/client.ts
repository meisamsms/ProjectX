import type { operations } from "@projectx/contracts/api";
import { staffFetch } from "../../staff-auth/client";

type CreateOperation = operations["createPeopleAccount"];
export type AddUserRequest =
  CreateOperation["requestBody"]["content"]["application/json"];
export type AddUserResult =
  CreateOperation["responses"][201]["content"]["application/json"];
export type AddUserOptions =
  operations["getPeopleAddUserOptions"]["responses"][200]["content"]["application/json"];
export class AddUserRequestError extends Error {
  constructor(readonly status: number) {
    super("Add User request failed");
  }
}
function endpoint(path: string) {
  const base = import.meta.env.VITE_API_BASE_URL ?? "/api/v1/";
  return new URL(
    path,
    new URL(base.endsWith("/") ? base : `${base}/`, window.location.origin),
  );
}
export async function getAddUserOptions(
  signal?: AbortSignal,
): Promise<AddUserOptions> {
  const response = await staffFetch(endpoint("people/accounts/options"), {
    credentials: "same-origin",
    signal: signal ?? null,
  });
  if (!response.ok) throw new AddUserRequestError(response.status);
  return (await response.json()) as AddUserOptions;
}
export async function createPeopleAccount(
  body: AddUserRequest,
  key: string,
  signal?: AbortSignal,
): Promise<AddUserResult> {
  // Trusted identity/context belong to the server. No browser tenant selectors or tokens.
  const response = await staffFetch(endpoint("people/accounts"), {
    method: "POST",
    credentials: "same-origin",
    signal: signal ?? null,
    headers: { "Content-Type": "application/json", "Idempotency-Key": key },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new AddUserRequestError(response.status);
  return (await response.json()) as AddUserResult;
}
