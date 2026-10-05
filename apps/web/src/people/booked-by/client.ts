import type { operations } from "@projectx/contracts/api";
import { staffFetch } from "../../staff-auth/client";

export type BookedByQuery = NonNullable<
  operations["listBookedByNames"]["parameters"]["query"]
>;
export type BookedByList =
  operations["listBookedByNames"]["responses"][200]["content"]["application/json"];
export type BookedByName = BookedByList["items"][number];
export type AddBookedByRequest =
  operations["addBookedByName"]["requestBody"]["content"]["application/json"];
export type UpdateBookedByRequest =
  operations["updateBookedByName"]["requestBody"]["content"]["application/json"];
type BookedById = operations["updateBookedByName"]["parameters"]["path"]["id"];
type CreatedName =
  operations["addBookedByName"]["responses"][201]["content"]["application/json"];
type UpdatedName =
  operations["updateBookedByName"]["responses"][200]["content"]["application/json"];

export class BookedByRequestError extends Error {
  constructor(readonly status: number) {
    super("Booked By request failed");
  }
}
function endpoint(id?: BookedById) {
  const base = import.meta.env.VITE_API_BASE_URL ?? "/api/v1/";
  return new URL(
    `people/booked-by-names${id ? `/${encodeURIComponent(id)}` : ""}`,
    new URL(base.endsWith("/") ? base : `${base}/`, window.location.origin),
  );
}
export async function listBookedByNames(
  query: BookedByQuery,
  signal?: AbortSignal,
): Promise<BookedByList> {
  const url = endpoint();
  if (query.limit !== undefined)
    url.searchParams.set("limit", String(query.limit));
  if (query.cursor !== undefined) url.searchParams.set("cursor", query.cursor);
  const response = await staffFetch(url, {
    credentials: "same-origin",
    signal: signal ?? null,
  });
  if (!response.ok) throw new BookedByRequestError(response.status);
  return (await response.json()) as BookedByList;
}
export async function addBookedByName(
  body: AddBookedByRequest,
  signal?: AbortSignal,
): Promise<CreatedName> {
  const response = await staffFetch(endpoint(), {
    method: "POST",
    credentials: "same-origin",
    signal: signal ?? null,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new BookedByRequestError(response.status);
  return (await response.json()) as CreatedName;
}
export async function updateBookedByName(
  id: BookedById,
  body: UpdateBookedByRequest,
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
  if (!response.ok) throw new BookedByRequestError(response.status);
  return (await response.json()) as UpdatedName;
}
