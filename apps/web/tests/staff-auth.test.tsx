// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StaffAuthBoundary } from "../src/staff-auth/boundary";
import {
  setStaffContext,
  staffFetch,
  type StaffContext,
} from "../src/staff-auth/client";

const context: StaffContext = {
  userId: "00000000-0000-4000-8000-000000000001",
  organizationId: "00000000-0000-4000-8000-000000000002",
  venueId: null,
  contextVersion: 7,
  expiresAt: "2099-01-01T00:00:00Z",
  assurance: "UNVERIFIED",
  contexts: [],
  csrfToken: "a".repeat(64),
};
afterEach(() => {
  cleanup();
  setStaffContext(null);
  vi.unstubAllGlobals();
});
describe("minimal staff authentication continuity", () => {
  it("401 exposes explicit same-origin login, never protected children", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 401 })),
    );
    render(
      <StaffAuthBoundary>
        <p>protected</p>
      </StaffAuthBoundary>,
    );
    const link = await screen.findByRole("link", {
      name: "Sign in with Auth0",
    });
    expect(new URL((link as HTMLAnchorElement).href).origin).toBe(
      window.location.origin,
    );
    expect(screen.queryByText("protected")).toBeNull();
  });
  it("store unavailability fails closed with no provider/token detail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("canary-secret")),
    );
    render(
      <StaffAuthBoundary>
        <p>protected</p>
      </StaffAuthBoundary>,
    );
    expect(
      await screen.findByRole("heading", { name: "Staff access unavailable" }),
    ).toBeTruthy();
    expect(document.body.textContent).not.toContain("canary-secret");
  });
  it("session snapshot adds bound CSRF + version to every mutation without authority headers", async () => {
    setStaffContext(context);
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetch);
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      await staffFetch("/api/v1/people/booked-by-names", { method });
      const headers = new Headers(fetch.mock.lastCall?.[1].headers);
      expect(headers.get("x-projectx-csrf")).toBe(context.csrfToken);
      expect(headers.get("x-projectx-context-version")).toBe("7");
      expect(headers.has("x-user-id")).toBe(false);
      expect(headers.has("x-organization-id")).toBe(false);
    }
  });
  it("stale context 409 is not refreshed or automatically replayed", async () => {
    setStaffContext(context);
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 409 }));
    vi.stubGlobal("fetch", fetch);
    expect(
      (await staffFetch("/api/v1/people/booked-by-names", { method: "POST" }))
        .status,
    ).toBe(409);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("foreign API URLs are refused without sending cookie/CSRF", async () => {
    setStaffContext(context);
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(
      staffFetch("https://foreign.test/api/v1/people/accounts", {
        method: "POST",
      }),
    ).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("successful durable logout removes protected content; failure retains explicit error", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json(context))
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetch);
    render(
      <StaffAuthBoundary>
        <p>protected</p>
      </StaffAuthBoundary>,
    );
    await screen.findByText("protected");
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText("protected")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(screen.queryByText("protected")).toBeNull());
  });
  it("no organization access cannot mount protected children", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(Response.json({ ...context, organizationId: null })),
    );
    render(
      <StaffAuthBoundary>
        <p>protected</p>
      </StaffAuthBoundary>,
    );
    expect(
      await screen.findByText("No active organization access is available."),
    ).toBeTruthy();
    expect(screen.queryByText("protected")).toBeNull();
  });
});
