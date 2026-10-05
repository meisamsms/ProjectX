import type { operations } from "@projectx/contracts/api";
import { staffFetch } from "../../staff-auth/client";

export type ServerQuery = NonNullable<
  operations["listServerNames"]["parameters"]["query"]
>;
export type ServerList =
  operations["listServerNames"]["responses"][200]["content"]["application/json"];
export type ServerName = ServerList["items"][number];
export type AddServerRequest =
  operations["addServerName"]["requestBody"]["content"]["application/json"];
export type UpdateServerRequest =
  operations["updateServerName"]["requestBody"]["content"]["application/json"];
type ServerId = operations["updateServerName"]["parameters"]["path"]["id"];
type CreatedName =
  operations["addServerName"]["responses"][201]["content"]["application/json"];
type UpdatedName =
  operations["updateServerName"]["responses"][200]["content"]["application/json"];

export class ServerRequestError extends Error {
  constructor(readonly status: number) {
    super("Server Names request failed");
  }
}
function endpoint(id?: ServerId) {
  const base = import.meta.env.VITE_API_BASE_URL ?? "/api/v1/";
  return new URL(
    `people/server-names${id ? `/${encodeURIComponent(id)}` : ""}`,
    new URL(base.endsWith("/") ? base : `${base}/`, window.location.origin),
  );
}
export async function listServerNames(
  query: ServerQuery,
  signal?: AbortSignal,
): Promise<ServerList> {
  const url = endpoint();
  if (query.limit !== undefined)
    url.searchParams.set("limit", String(query.limit));
  if (query.cursor !== undefined) url.searchParams.set("cursor", query.cursor);
  const response = await staffFetch(url, {
    credentials: "same-origin",
    signal: signal ?? null,
  });
  if (!response.ok) throw new ServerRequestError(response.status);
  return (await response.json()) as ServerList;
}
export async function addServerName(
  body: AddServerRequest,
  signal?: AbortSignal,
): Promise<CreatedName> {
  const response = await staffFetch(endpoint(), {
    method: "POST",
    credentials: "same-origin",
    signal: signal ?? null,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new ServerRequestError(response.status);
  return (await response.json()) as CreatedName;
}
export async function updateServerName(
  id: ServerId,
  body: UpdateServerRequest,
  signal?: AbortSignal,
): Promise<UpdatedName> {
  // Authority and organization/venue selection belong to the trusted server context.
  const response = await staffFetch(endpoint(id), {
    method: "PATCH",
    credentials: "same-origin",
    signal: signal ?? null,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new ServerRequestError(response.status);
  return (await response.json()) as UpdatedName;
}
