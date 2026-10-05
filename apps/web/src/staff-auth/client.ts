import type { components } from "@projectx/contracts/api";

export type StaffContext = components["schemas"]["StaffSessionContext"];
let current: StaffContext | null = null;
export const sessionExpiredEvent = "projectx:staff-session-expired";
export function setStaffContext(value: StaffContext | null) {
  current = value;
}
export function staffEndpoint(path: string): URL {
  const base = import.meta.env.VITE_API_BASE_URL ?? "/api/v1/";
  const url = new URL(
    `staff-auth/${path}`,
    new URL(base.endsWith("/") ? base : `${base}/`, window.location.origin),
  );
  if (url.origin !== window.location.origin)
    throw new Error("Staff API must be same-origin");
  return url;
}
/** A per-tab version snapshot is a conflict guard, never identity/tenant authority. */
export async function staffFetch(
  input: URL | string,
  init: RequestInit = {},
): Promise<Response> {
  const url = new URL(input, window.location.origin);
  if (url.origin !== window.location.origin)
    throw new Error("Staff API must be same-origin");
  const headers = new Headers(init.headers);
  if (
    current &&
    ["POST", "PUT", "PATCH", "DELETE"].includes(
      (init.method ?? "GET").toUpperCase(),
    )
  ) {
    headers.set("X-ProjectX-CSRF", current.csrfToken);
    headers.set("X-ProjectX-Context-Version", String(current.contextVersion));
  }
  // Preserve existing fixture/client tests when no auth boundary is active.
  const response = await fetch(input, {
    ...init,
    credentials: "same-origin",
    ...(current ? { headers } : {}),
  });
  if (response.status === 401) {
    current = null;
    window.dispatchEvent(new Event(sessionExpiredEvent));
  }
  // Never retry 409/403, silently refresh a stale version, or replay a mutation.
  return response;
}
