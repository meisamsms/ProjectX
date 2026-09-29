// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { AccountsQuery, AccountsResponse } from "../../src/api-client";
import { AccountsRequestError, getPeopleAccounts } from "../../src/api-client";
import { AccountsPage } from "../../src/people/accounts/page";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const person = (
  overrides: Partial<AccountsResponse["items"][number]> = {},
): AccountsResponse["items"][number] => ({
  id: "00000000-0000-4000-8000-000000000001",
  name: "Synthetic Person",
  jobTitle: "Host",
  emailNotificationsEnabled: true,
  accessLevels: ["Manager"],
  ...overrides,
});
const page = (
  items: AccountsResponse["items"],
  nextCursor: string | null = null,
): AccountsResponse => ({ items, nextCursor });
function mount(
  loadAccounts: (
    query: AccountsQuery,
    signal?: AbortSignal,
  ) => Promise<AccountsResponse>,
) {
  return render(
    <MemoryRouter>
      <AccountsPage loadAccounts={loadAccounts} />
    </MemoryRouter>,
  );
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("PEOPLE-05 User Accounts", () => {
  it("announces loading then renders a semantic roster, nullable fields and distinct notification states", async () => {
    let resolve!: (value: AccountsResponse) => void;
    const load = vi.fn(
      () =>
        new Promise<AccountsResponse>((done) => {
          resolve = done;
        }),
    );
    mount(load);
    expect(screen.getByRole("heading", { name: "User Accounts" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("Loading");
    resolve(
      page([
        person({
          name: null,
          jobTitle: null,
          emailNotificationsEnabled: null,
          accessLevels: ["Manager", "Roster"],
        }),
        person({
          id: "00000000-0000-4000-8000-000000000002",
          emailNotificationsEnabled: false,
          accessLevels: ["Host"],
        }),
        person({
          id: "00000000-0000-4000-8000-000000000003",
          emailNotificationsEnabled: true,
          accessLevels: [],
        }),
      ]),
    );
    const table = await screen.findByRole("table", {
      name: "Authorized user accounts",
    });
    expect(within(table).getAllByRole("row")).toHaveLength(4);
    expect(within(table).getByText("Name not supplied")).toBeTruthy();
    expect(within(table).getByText("Job title not stored")).toBeTruthy();
    expect(within(table).getByText("Not configured")).toBeTruthy();
    expect(within(table).getByText("Disabled")).toBeTruthy();
    expect(within(table).getByText("Enabled")).toBeTruthy();
    expect(within(table).getByText("Roster")).toBeTruthy();
    expect(within(table).getAllByText("Host")).toHaveLength(3);
    expect(within(table).getByText("No organization role stored")).toBeTruthy();
    expect(screen.getByText("End of results")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Next page/ })).toBeNull();
  });

  it("shows an empty roster without fabricated users", async () => {
    mount(async () => page([]));
    expect(await screen.findByText("No user accounts found.")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("uses server exact-role filtering, resets cursor, and requests next page without a count or back control", async () => {
    const cursor = "00000000-0000-4000-8000-000000000011";
    const load = vi.fn(async (query: AccountsQuery) =>
      page([person()], query.cursor ? null : cursor),
    );
    mount(load);
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() =>
      expect(load).toHaveBeenLastCalledWith(
        { cursor },
        expect.any(AbortSignal),
      ),
    );
    await screen.findByText("End of results");
    const filter = screen.getByRole("textbox", {
      name: "Access Level (exact role name)",
    });
    fireEvent.change(filter, { target: { value: " Manager " } });
    const form = filter.closest("form");
    expect(form).not.toBeNull();
    if (form) fireEvent.submit(form);
    await waitFor(() =>
      expect(load).toHaveBeenLastCalledWith(
        { accessLevel: "Manager" },
        expect.any(AbortSignal),
      ),
    );
    expect(screen.getByText("Access Level filter: Manager")).toBeTruthy();
    expect(screen.queryByText(/previous page/i)).toBeNull();
  });

  it("clears a prior page while a next-page request loads and reports pagination failure safely", async () => {
    const cursor = "00000000-0000-4000-8000-000000000011";
    let reject!: (reason: Error) => void;
    const load = vi.fn((query: AccountsQuery) =>
      query.cursor
        ? new Promise<AccountsResponse>((_resolve, fail) => {
            reject = fail;
          })
        : Promise.resolve(page([person()], cursor)),
    );
    mount(load);
    await screen.findByRole("table");
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByRole("status").textContent).toContain("Loading");
    expect(screen.queryByRole("table")).toBeNull();
    reject(new Error("private backend details"));
    expect(
      await screen.findByText(
        "User accounts are unavailable. Please try again.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("private backend details")).toBeNull();
  });

  it.each([
    [401, "Sign in is required"],
    [403, "You do not have access"],
    [500, "User accounts are unavailable"],
  ])("renders safe %i state", async (status, text) => {
    mount(async () => {
      throw new AccountsRequestError(status);
    });
    expect(await screen.findByText(new RegExp(text))).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("keeps deferred actions honest and keyboard controls reachable", async () => {
    mount(async () => page([person()]));
    await screen.findByRole("table");
    const add = screen.getByRole("link", { name: "Add new" });
    expect(add.getAttribute("href")).toBe(
      "/manager/oceansatarthurs/access/user/create",
    );
    expect(screen.getByText("Export unavailable")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: /export|edit|delete|open user/i }),
    ).toBeNull();
    expect(screen.getByText("Unavailable")).toBeTruthy();
    const filter = screen.getByRole("textbox", { name: /Access Level/ });
    filter.focus();
    expect(document.activeElement).toBe(filter);
    expect(screen.getByRole("button", { name: "Apply filter" })).toBeTruthy();
    expect(document.body.textContent).not.toMatch(
      /issuer|subject|session|secret|permissionId|membershipId/i,
    );
  });

  it("uses the generated query contract and never sends client tenant selectors", async () => {
    const fetchMock = vi.fn(async (_url: URL, _init: RequestInit) => ({
      ok: true,
      json: async () => page([]),
    }));
    vi.stubGlobal("fetch", fetchMock);
    await getPeopleAccounts({
      accessLevel: "Manager",
      cursor: "00000000-0000-4000-8000-000000000011",
    });
    const call = fetchMock.mock.calls[0];
    expect(call).toBeDefined();
    if (!call) throw new Error("Fetch was not called");
    const url = call[0];
    expect(url.pathname).toBe("/api/v1/people/accounts");
    expect(url.searchParams.get("accessLevel")).toBe("Manager");
    expect(url.searchParams.has("organizationId")).toBe(false);
    expect(url.searchParams.has("venueId")).toBe(false);
    expect(call[1]).toMatchObject({
      credentials: "same-origin",
    });
  });
});
