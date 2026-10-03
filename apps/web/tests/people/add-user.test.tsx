// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  created,
  first,
  options,
} from "../../../../tests/fixtures/people-add-user";
import {
  type AddUserRequest,
  AddUserRequestError,
  createPeopleAccount,
  getAddUserOptions,
} from "../../src/people/add-user/client";
import { AddUserPage } from "../../src/people/add-user/page";

function Location() {
  return <span data-testid="location">{useLocation().pathname}</span>;
}
const defaultLoad = async () => options;
function mount(
  loadOptions = defaultLoad,
  createAccount: typeof createPeopleAccount = async () => created,
) {
  return render(
    <MemoryRouter
      initialEntries={["/manager/oceansatarthurs/access/user/create"]}
    >
      <AddUserPage loadOptions={loadOptions} createAccount={createAccount} />
      <Location />
    </MemoryRouter>,
  );
}
async function fill() {
  await screen.findByRole("textbox", { name: "Email" });
  fireEvent.change(screen.getByRole("textbox", { name: "Email" }), {
    target: { value: "synthetic@example.test" },
  });
  fireEvent.click(
    screen.getByRole("checkbox", { name: "Synthetic organization role" }),
  );
}
function click(another = false) {
  fireEvent.click(
    screen.getByRole("button", {
      name: another ? "Create + Add Another" : "Create",
    }),
  );
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("PEOPLE-06 Add User", () => {
  it("renders heading, back link and options loading without a submit button", () => {
    mount(() => new Promise(() => {}));
    expect(screen.getByRole("heading", { name: "Add User" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("Loading");
    expect(
      screen
        .getByRole("link", { name: "Back to User Accounts" })
        .getAttribute("href"),
    ).toContain("/list");
    expect(screen.queryByRole("button", { name: "Create" })).toBeNull();
  });
  it("renders authorized options only, with no implicit selections", async () => {
    mount();
    await screen.findByRole("textbox", { name: "Email" });
    expect(
      screen.getByRole("checkbox", { name: "Synthetic organization role" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("checkbox", { name: /Read own synthetic/ }),
    ).toBeTruthy();
    expect(
      screen.getByRole("checkbox", { name: "Synthetic venue" }),
    ).toBeTruthy();
    for (const checkbox of screen.getAllByRole("checkbox"))
      expect((checkbox as HTMLInputElement).checked).toBe(false);
    expect(
      screen.queryByRole("checkbox", { name: "Administrator" }),
    ).toBeNull();
  });
  it.each([
    [401, /Sign in is required/],
    [403, /do not have access/],
    [500, /options are unavailable/],
  ])("handles options %i safely", async (status, message) => {
    mount(async () => {
      throw new AddUserRequestError(status);
    });
    expect(await screen.findByText(message)).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "Email" })).toBeNull();
  });
  it("handles an options network failure without raw metadata", async () => {
    mount(async () => {
      throw new Error("SQL issuer subject secret");
    });
    await screen.findByText(/options are unavailable/);
    expect(document.body.textContent).not.toMatch(/SQL|issuer|subject|secret/);
  });
  it("does not invent roles when none are assignable", async () => {
    mount(async () => ({ ...options, organizationRoles: [] }));
    await screen.findByText(/No organization access levels/);
    expect(screen.queryByRole("button", { name: "Create" })).toBeNull();
  });
  it("renders empty venue and permission groups honestly", async () => {
    mount(async () => ({
      ...options,
      organizationPermissions: [],
      venues: [],
    }));
    expect(await screen.findByText("No venues available.")).toBeTruthy();
    expect(
      screen.getByText("No organization or self permissions available."),
    ).toBeTruthy();
  });
  it("disables venues without assignable roles and renders empty venue permissions", async () => {
    mount(async () => ({
      ...options,
      venues: [{ ...first(options.venues), roles: [], permissions: [] }],
    }));
    const venue = await screen.findByRole("checkbox", {
      name: "Synthetic venue",
    });
    expect((venue as HTMLInputElement).disabled).toBe(true);
  });
  it.each(["First Name", "Last Name", "Job Title"])(
    "preserves nullable %s",
    async (label) => {
      const create = vi.fn(async (_body: AddUserRequest) => created);
      mount(defaultLoad, create);
      await fill();
      const field = screen.getByRole("textbox", {
        name: label,
      }) as HTMLInputElement;
      expect(field.required).toBe(false);
      click(true);
      await waitFor(() => expect(create).toHaveBeenCalledOnce());
      expect(create.mock.calls[0]?.[0]).toMatchObject({
        firstName: null,
        lastName: null,
        jobTitle: null,
      });
    },
  );
  it("submits names, provisioning email and job title through the generated request", async () => {
    const create = vi.fn(async (_body: AddUserRequest) => created);
    mount(defaultLoad, create);
    await fill();
    for (const [label, value] of [
      ["First Name", " Ada "],
      ["Last Name", " Example "],
      ["Job Title", " Host "],
    ] as const)
      fireEvent.change(screen.getByRole("textbox", { name: label }), {
        target: { value },
      });
    click(true);
    await waitFor(() => expect(create).toHaveBeenCalledOnce());
    expect(create.mock.calls[0]?.[0]).toMatchObject({
      firstName: "Ada",
      lastName: "Example",
      jobTitle: "Host",
      email: "synthetic@example.test",
    });
  });
  it.each([
    ["null", null],
    ["true", true],
    ["false", false],
  ])("preserves notification %s", async (value, expected) => {
    const create = vi.fn(async (_body: AddUserRequest) => created);
    mount(defaultLoad, create);
    await fill();
    fireEvent.change(
      screen.getByRole("combobox", { name: "Email Notifications" }),
      { target: { value } },
    );
    click(true);
    await waitFor(() => expect(create).toHaveBeenCalledOnce());
    expect(create.mock.calls[0]?.[0]?.emailNotificationsEnabled).toBe(expected);
  });
  it("submits only explicit role, organization/self permissions, venue and venue grants", async () => {
    const create = vi.fn(async (_body: AddUserRequest) => created);
    mount(defaultLoad, create);
    await fill();
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Read synthetic roster/ }),
    );
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Read own synthetic profile/ }),
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Synthetic venue" }));
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Synthetic venue role" }),
    );
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Read synthetic venue" }),
    );
    click(true);
    await waitFor(() => expect(create).toHaveBeenCalledOnce());
    expect(create.mock.calls[0]?.[0]).toMatchObject({
      organizationRoleIds: [first(options.organizationRoles).id],
      organizationPermissionIds: ["user.read", "user.read.self"],
      venues: [
        {
          venueId: first(options.venues).id,
          roleIds: [first(first(options.venues).roles).id],
          permissionIds: ["venue.read"],
        },
      ],
    });
  });
  it("removing a venue clears its nested choices", async () => {
    const create = vi.fn(async (_body: AddUserRequest) => created);
    mount(defaultLoad, create);
    await fill();
    fireEvent.click(screen.getByRole("checkbox", { name: "Synthetic venue" }));
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Synthetic venue role" }),
    );
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Read synthetic venue" }),
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Synthetic venue" }));
    click(true);
    await waitFor(() => expect(create).toHaveBeenCalledOnce());
    expect(create.mock.calls[0]?.[0]?.venues).toEqual([]);
  });
  it("requires organization role selection and focuses its announced validation error", async () => {
    const create = vi.fn(async () => created);
    mount(defaultLoad, create);
    await screen.findByRole("textbox", { name: "Email" });
    fireEvent.change(screen.getByRole("textbox", { name: "Email" }), {
      target: { value: "synthetic@example.test" },
    });
    click();
    expect(screen.getByRole("alert")).toBe(document.activeElement);
    expect(create).not.toHaveBeenCalled();
  });
  it("requires a role for each explicit venue", async () => {
    const create = vi.fn(async () => created);
    mount(defaultLoad, create);
    await fill();
    fireEvent.click(screen.getByRole("checkbox", { name: "Synthetic venue" }));
    click();
    expect(screen.getByRole("alert").textContent).toContain(
      "each selected venue",
    );
    expect(create).not.toHaveBeenCalled();
  });
  it("supports disabled at creation without lifecycle claims", async () => {
    const create = vi.fn(async (_body: AddUserRequest) => created);
    mount(defaultLoad, create);
    await fill();
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Disabled at creation" }),
    );
    click(true);
    await waitFor(() => expect(create).toHaveBeenCalledOnce());
    expect(create.mock.calls[0]?.[0]?.suspended).toBe(true);
  });
  it("normal Create navigates to SCR-025", async () => {
    const create = vi.fn(async () => created);
    mount(defaultLoad, create);
    await fill();
    click();
    await waitFor(() =>
      expect(screen.getByTestId("location").textContent).toContain("/list"),
    );
    expect(create).toHaveBeenCalledOnce();
  });
  it("Add Another remains and resets every user-specific value and focuses safe success", async () => {
    mount();
    await fill();
    for (const label of ["First Name", "Last Name", "Job Title"])
      fireEvent.change(screen.getByRole("textbox", { name: label }), {
        target: { value: "Synthetic" },
      });
    fireEvent.change(
      screen.getByRole("combobox", { name: "Email Notifications" }),
      { target: { value: "true" } },
    );
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Disabled at creation" }),
    );
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Read synthetic roster/ }),
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Synthetic venue" }));
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Synthetic venue role" }),
    );
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Read synthetic venue" }),
    );
    click(true);
    const success = await screen.findByText(/Pending account created/);
    expect(document.activeElement).toBe(success);
    for (const textbox of screen.getAllByRole("textbox"))
      expect((textbox as HTMLInputElement).value).toBe("");
    for (const checkbox of screen.getAllByRole("checkbox"))
      expect((checkbox as HTMLInputElement).checked).toBe(false);
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe(
      "null",
    );
    expect(
      screen.queryByRole("checkbox", { name: "Read synthetic venue" }),
    ).toBeNull();
    expect(screen.getByTestId("location").textContent).toContain("/create");
  });
  it("Add Another creates a fresh idempotency boundary", async () => {
    const create = vi.fn(
      async (_body: AddUserRequest, _key: string) => created,
    );
    mount(defaultLoad, create);
    await fill();
    click(true);
    await screen.findByText(/Pending account created/);
    await fill();
    click(true);
    await waitFor(() => expect(create).toHaveBeenCalledTimes(2));
    expect(create.mock.calls[0]?.[1]).not.toBe(create.mock.calls[1]?.[1]);
  });
  it("blocks duplicate submits synchronously and disables form controls while pending", async () => {
    const create = vi.fn(() => new Promise<typeof created>(() => {}));
    mount(defaultLoad, create);
    await fill();
    click();
    const form = screen.getByRole("textbox", { name: "Email" }).closest("form");
    if (!form) throw new Error("Missing form");
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(create).toHaveBeenCalledOnce();
    expect(
      (
        screen.getByRole("button", { name: "Create" }) as HTMLButtonElement
      ).closest("fieldset")?.disabled,
    ).toBe(true);
    expect(
      screen.queryByRole("link", { name: "Back to User Accounts" }),
    ).toBeNull();
  });
  it.each([
    [400, /Check the form/],
    [401, /Sign in is required/],
    [403, /do not have access/],
    [409, /conflicted/],
    [500, /could not be confirmed/],
  ])("maps create %i to safe focused error", async (status, text) => {
    mount(defaultLoad, async () => {
      throw new AddUserRequestError(status);
    });
    await fill();
    click();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(text);
    expect(document.activeElement).toBe(alert);
    expect(
      (screen.getByRole("textbox", { name: "Email" }) as HTMLInputElement)
        .value,
    ).toBe("synthetic@example.test");
  });
  it("never renders arbitrary backend failure details", async () => {
    mount(defaultLoad, async () => {
      throw new Error("SQL constraint RLS issuer subject foreign tenant");
    });
    await fill();
    click();
    await screen.findByRole("alert");
    expect(document.body.textContent).not.toMatch(
      /SQL|constraint|RLS|issuer|subject|foreign tenant/,
    );
  });
  it("reuses an unchanged failed request key but changes it when details change", async () => {
    const create = vi.fn(async (_body: AddUserRequest, _key: string) => {
      throw new AddUserRequestError(500);
    });
    mount(defaultLoad, create);
    await fill();
    click();
    await screen.findByRole("alert");
    click();
    await waitFor(() => expect(create).toHaveBeenCalledTimes(2));
    await screen.findByRole("alert");
    expect(create.mock.calls[0]?.[1]).toBe(create.mock.calls[1]?.[1]);
    fireEvent.change(screen.getByRole("textbox", { name: "Email" }), {
      target: { value: "second@example.test" },
    });
    click();
    await waitFor(() => expect(create).toHaveBeenCalledTimes(3));
    expect(create.mock.calls[1]?.[1]).not.toBe(create.mock.calls[2]?.[1]);
  });
  it("keeps unsupported MFA, subscriptions and delivery nonfunctional", async () => {
    mount();
    await fill();
    expect(
      screen.getByText(/Mobile MFA and Email Subscriptions are unavailable/),
    ).toBeTruthy();
    expect(
      screen.queryByRole("checkbox", { name: /MFA|subscription|same access/ }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /invite|send|enroll/ }),
    ).toBeNull();
    expect(document.body.textContent).not.toMatch(
      /invitation sent|email sent|verified identity/i,
    );
  });
  it("uses native labeled keyboard-focusable controls", async () => {
    mount();
    await fill();
    const role = screen.getByRole("checkbox", {
      name: "Synthetic organization role",
    });
    role.focus();
    expect(document.activeElement).toBe(role);
    expect(screen.getAllByRole("group").length).toBeGreaterThan(3);
  });
  it("uses generated same-origin options and command contracts with idempotency, no tenant/token authority", async () => {
    const fetchMock = vi.fn(async (_url: URL, _init: RequestInit) => ({
      ok: true,
      json: async () => options,
    }));
    vi.stubGlobal("fetch", fetchMock);
    await getAddUserOptions();
    const body: AddUserRequest = {
      email: "synthetic@example.test",
      firstName: null,
      lastName: null,
      jobTitle: null,
      emailNotificationsEnabled: null,
      suspended: false,
      organizationRoleIds: [first(options.organizationRoles).id],
      venues: [],
    };
    await createPeopleAccount(body, "synthetic-request-key");
    expect(fetchMock.mock.calls[0]?.[0].pathname).toBe(
      "/api/v1/people/accounts/options",
    );
    expect(fetchMock.mock.calls[0]?.[0].search).toBe("");
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      credentials: "same-origin",
      method: "POST",
      headers: { "Idempotency-Key": "synthetic-request-key" },
      body: JSON.stringify(body),
    });
    expect(JSON.stringify(fetchMock.mock.calls)).not.toMatch(
      /organizationId|Authorization|issuer|subject/,
    );
  });
  it("API clients discard error bodies", async () => {
    const json = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 403, json })),
    );
    await expect(getAddUserOptions()).rejects.toMatchObject({ status: 403 });
    expect(json).not.toHaveBeenCalled();
  });
  it("uses only backend email requirements and profile length limits", async () => {
    mount();
    const email = (await screen.findByRole("textbox", {
      name: "Email",
    })) as HTMLInputElement;
    expect(email.required).toBe(true);
    expect(email.type).toBe("email");
    expect(email.maxLength).toBe(254);
    email.value = "not-an-email";
    expect(email.checkValidity()).toBe(false);
    for (const label of ["First Name", "Last Name", "Job Title"])
      expect(
        (screen.getByRole("textbox", { name: label }) as HTMLInputElement)
          .maxLength,
      ).toBe(120);
  });
  it("normalizes optional whitespace to null without coercing notification null", async () => {
    const create = vi.fn(async (_body: AddUserRequest) => created);
    mount(defaultLoad, create);
    await fill();
    for (const label of ["First Name", "Last Name", "Job Title"])
      fireEvent.change(screen.getByRole("textbox", { name: label }), {
        target: { value: "   " },
      });
    click(true);
    await waitFor(() => expect(create).toHaveBeenCalledOnce());
    expect(create.mock.calls[0]?.[0]).toMatchObject({
      firstName: null,
      lastName: null,
      jobTitle: null,
      emailNotificationsEnabled: null,
      suspended: false,
      venues: [],
      organizationPermissionIds: [],
    });
  });
  it("renders an empty permission group for a selectable venue", async () => {
    mount(async () => ({
      ...options,
      venues: [{ ...first(options.venues), permissions: [] }],
    }));
    fireEvent.click(
      await screen.findByRole("checkbox", { name: "Synthetic venue" }),
    );
    expect(screen.getByText("No venue permissions available.")).toBeTruthy();
  });
  it("aborts outstanding options on unmount and ignores late results", async () => {
    let resolve!: (value: typeof options) => void;
    const load = vi.fn(
      (_signal?: AbortSignal) =>
        new Promise<typeof options>((done) => {
          resolve = done;
        }),
    );
    const view = mount(load);
    view.unmount();
    expect(load.mock.calls[0]?.[0]?.aborted).toBe(true);
    resolve(options);
    await Promise.resolve();
    expect(screen.queryByRole("heading", { name: "Add User" })).toBeNull();
  });
});
