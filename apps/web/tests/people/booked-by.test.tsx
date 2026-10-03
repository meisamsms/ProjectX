// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bookedList,
  bookedName,
} from "../../../../tests/fixtures/people-booked-by";
import {
  addBookedByName,
  BookedByRequestError,
  listBookedByNames,
  updateBookedByName,
  type BookedByList,
  type BookedByName,
} from "../../src/people/booked-by/client";
import { BookedByPage, nameValidation } from "../../src/people/booked-by/page";

function setup(initial = bookedList()) {
  const load = vi.fn<typeof listBookedByNames>().mockResolvedValue(initial);
  const create = vi.fn<typeof addBookedByName>().mockResolvedValue({
    ...bookedName,
    id: "00000000-0000-4000-8000-000000000002",
    displayName: "New host",
  });
  const save = vi.fn<typeof updateBookedByName>().mockResolvedValue({
    ...bookedName,
    displayName: "Edited host",
    version: 2,
  });
  const mount = () =>
    render(
      <MemoryRouter>
        <BookedByPage loadNames={load} createName={create} saveName={save} />
      </MemoryRouter>,
    );
  return { load, create, save, mount };
}
const input = () =>
  screen.getByRole("textbox", { name: "Booked By Name 1" }) as HTMLInputElement;
const saveButton = () =>
  screen.getByRole("button", {
    name: "Save changes for name 1",
  }) as HTMLButtonElement;
function edit(value = "Edited host") {
  fireEvent.change(input(), { target: { value } });
}
function add(value = "New host") {
  fireEvent.click(screen.getByRole("button", { name: "Add new name" }));
  fireEvent.change(screen.getByRole("textbox", { name: "New name" }), {
    target: { value },
  });
}
async function ready(fixture = setup()) {
  fixture.mount();
  await screen.findByRole("button", { name: "Add new name" });
  return fixture;
}
async function focusedAlert() {
  const alert = await screen.findByRole("alert");
  await waitFor(() => expect(document.activeElement).toBe(alert));
  expect(alert.textContent).not.toContain("PRIVATE");
  return alert;
}
function failure(status: number) {
  const error = new BookedByRequestError(status);
  error.message = "PRIVATE SQL actor org venue stack token";
  return error;
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("PEOPLE-07B scoped editor", () => {
  it("announces loading, then lists labeled names using a bounded query", async () => {
    const fixture = setup();
    let resolve!: (value: BookedByList) => void;
    fixture.load.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    fixture.mount();
    expect(screen.getByRole("status").textContent).toContain("Loading");
    expect(screen.queryByRole("textbox")).toBeNull();
    resolve(bookedList());
    expect(
      (
        (await screen.findByRole("textbox", {
          name: "Booked By Name 1",
        })) as HTMLInputElement
      ).value,
    ).toBe("Synthetic host");
    expect(fixture.load).toHaveBeenCalledWith(
      { limit: 25 },
      expect.any(AbortSignal),
    );
    expect(screen.getByRole("list", { name: "Booked By Names" })).toBeTruthy();
  });
  it("shows a useful empty state without fabricated rows", async () => {
    await ready(setup(bookedList([])));
    expect(
      screen.getByText("No Booked By Names yet. Add a name to begin."),
    ).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
  });
  it.each([400, 401, 403, 404, 409, 500])(
    "handles initial %i with safe focused error and no editor",
    async (status) => {
      const fixture = setup();
      fixture.load.mockRejectedValue(failure(status));
      fixture.mount();
      await focusedAlert();
      expect(screen.queryByRole("textbox")).toBeNull();
      expect(fixture.load).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("button", { name: "Add new name" })).toBeNull();
    },
  );
  it("offers an explicit retry after a network load failure", async () => {
    const fixture = setup();
    fixture.load.mockRejectedValueOnce(new Error("PRIVATE network"));
    fixture.mount();
    await focusedAlert();
    fireEvent.click(screen.getByRole("button", { name: "Refresh names" }));
    await screen.findByRole("textbox");
    expect(fixture.load).toHaveBeenCalledTimes(2);
  });
  it("passes the opaque cursor and deduplicates by ID, not display name", async () => {
    const fixture = setup(bookedList([bookedName], bookedName.id));
    fixture.load
      .mockResolvedValueOnce(bookedList([bookedName], bookedName.id))
      .mockResolvedValueOnce(
        bookedList([
          bookedName,
          { ...bookedName, id: "00000000-0000-4000-8000-000000000002" },
        ]),
      );
    await ready(fixture);
    fireEvent.click(screen.getByRole("button", { name: "Load more names" }));
    await waitFor(() => expect(screen.getAllByRole("textbox")).toHaveLength(2));
    expect(fixture.load).toHaveBeenLastCalledWith(
      { limit: 25, cursor: bookedName.id },
      expect.any(AbortSignal),
    );
    expect(
      screen.queryByRole("button", { name: "Load more names" }),
    ).toBeNull();
    expect(screen.queryByText(/Page \d/)).toBeNull();
  });
  it("paging overlap preserves an existing dirty row", async () => {
    const fixture = setup(bookedList([bookedName], bookedName.id));
    await ready(fixture);
    edit("Keep draft");
    fixture.load.mockResolvedValue(
      bookedList([
        { ...bookedName, displayName: "Remote overlap", version: 8 },
      ]),
    );
    fireEvent.click(screen.getByRole("button", { name: "Load more names" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Load more names" }),
      ).toBeNull(),
    );
    expect(input().value).toBe("Keep draft");
  });
  it("paging errors retain rows and the cursor for an explicit retry", async () => {
    const fixture = setup(bookedList([bookedName], bookedName.id));
    await ready(fixture);
    fixture.load.mockRejectedValueOnce(failure(500));
    fireEvent.click(screen.getByRole("button", { name: "Load more names" }));
    await focusedAlert();
    expect(input().value).toBe(bookedName.displayName);
    expect(
      screen.getByRole("button", { name: "Load more names" }),
    ).toBeTruthy();
  });
  it("Add new only opens and focuses a local draft", async () => {
    const fixture = await ready();
    fireEvent.click(screen.getByRole("button", { name: "Add new name" }));
    const field = screen.getByRole("textbox", { name: "New name" });
    await waitFor(() => expect(document.activeElement).toBe(field));
    expect(fixture.create).not.toHaveBeenCalled();
    expect(
      (screen.getByRole("button", { name: "Create name" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
  it("Cancel discards the new draft without POST and returns focus to Add", async () => {
    const fixture = await ready();
    add();
    fireEvent.click(screen.getByRole("button", { name: "Cancel new name" }));
    expect(screen.queryByRole("textbox", { name: "New name" })).toBeNull();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Add new name" }),
      ),
    );
    expect(fixture.create).not.toHaveBeenCalled();
  });
  it.each([
    "",
    "   ",
    "a".repeat(121),
    "a\u0000B",
    "a\u0085B",
    "\ud800",
    "x".repeat(1025),
  ])("rejects invalid names locally (case %#)", async (value) => {
    const fixture = await ready();
    add(value);
    expect(nameValidation(value)).not.toBeNull();
    const field = screen.getByRole("textbox", { name: "New name" });
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(
      (screen.getByRole("button", { name: "Create name" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.submit(screen.getByRole("form", { name: "Add new name" }));
    expect(fixture.create).not.toHaveBeenCalled();
  });
  it("accepts 120 supplementary Unicode code points without a UTF-16 maxlength", async () => {
    await ready();
    const value = "😀".repeat(120);
    add(value);
    expect(nameValidation(value)).toBeNull();
    expect(nameValidation(`${value}😀`)).not.toBeNull();
    expect(
      screen
        .getByRole("textbox", { name: "New name" })
        .getAttribute("maxlength"),
    ).toBeNull();
    expect(
      (screen.getByRole("button", { name: "Create name" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });
  it("validation rejects line breaks even though native text inputs strip them", () => {
    expect(nameValidation("a\nB")).not.toBeNull();
    expect(nameValidation("a\rB")).not.toBeNull();
  });
  it("one-record save preserves another row's unsaved draft", async () => {
    const fixture = await ready(
      setup(
        bookedList([
          bookedName,
          { ...bookedName, id: "00000000-0000-4000-8000-000000000002" },
        ]),
      ),
    );
    edit();
    const second = screen.getByRole("textbox", {
      name: "Booked By Name 2",
    }) as HTMLInputElement;
    fireEvent.change(second, { target: { value: "Other draft" } });
    fireEvent.click(saveButton());
    await screen.findByText("Name saved.");
    expect(second.value).toBe("Other draft");
    expect(fixture.save).toHaveBeenCalledTimes(1);
  });
  it("creates trimmed case-preserved text and renders only the confirmed response", async () => {
    const fixture = await ready();
    add("  New HOST  ");
    fixture.create.mockResolvedValue({
      ...bookedName,
      id: "00000000-0000-4000-8000-000000000002",
      displayName: "New HOST",
    });
    fireEvent.click(screen.getByRole("button", { name: "Create name" }));
    await waitFor(() => expect(screen.getAllByRole("textbox")).toHaveLength(2));
    expect(fixture.create).toHaveBeenCalledWith(
      { displayName: "New HOST" },
      expect.any(AbortSignal),
    );
    const status = screen.getByText("Name created.");
    await waitFor(() => expect(document.activeElement).toBe(status));
    expect(screen.queryByText("Unsaved changes")).toBeNull();
  });
  it("allows a duplicate display name with its own returned ID", async () => {
    const fixture = await ready();
    add(bookedName.displayName);
    fixture.create.mockResolvedValue({
      ...bookedName,
      id: "00000000-0000-4000-8000-000000000002",
    });
    fireEvent.click(screen.getByRole("button", { name: "Create name" }));
    await waitFor(() => expect(screen.getAllByRole("textbox")).toHaveLength(2));
  });
  it("does not fabricate create success or duplicate pending POSTs", async () => {
    const fixture = await ready();
    let resolve!: (value: BookedByName) => void;
    fixture.create.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    add();
    const form = screen.getByRole("form", { name: "Add new name" });
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(fixture.create).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Name created.")).toBeNull();
    expect(screen.getAllByRole("textbox")).toHaveLength(2);
    resolve({ ...bookedName, id: "00000000-0000-4000-8000-000000000002" });
    await screen.findByText("Name created.");
  });
  it.each([400, 401, 403, 404, 409, 500])(
    "create %i retains draft, focuses safe error and never auto-retries",
    async (status) => {
      const fixture = await ready();
      fixture.create.mockRejectedValue(failure(status));
      add();
      fireEvent.click(screen.getByRole("button", { name: "Create name" }));
      await focusedAlert();
      expect(
        (screen.getByRole("textbox", { name: "New name" }) as HTMLInputElement)
          .value,
      ).toBe("New host");
      expect(fixture.create).toHaveBeenCalledTimes(1);
      expect(screen.queryByText("Name created.")).toBeNull();
    },
  );
  it("enables Save only for dirty, valid rows and clears dirty when reverted", async () => {
    await ready();
    expect(saveButton().disabled).toBe(true);
    edit();
    expect(saveButton().disabled).toBe(false);
    edit(" ");
    expect(saveButton().disabled).toBe(true);
    edit(bookedName.displayName);
    expect(saveButton().disabled).toBe(true);
  });
  it("saves one row with the current version, applies returned name/version and focuses success", async () => {
    const fixture = await ready();
    edit("  Edited host  ");
    fireEvent.click(saveButton());
    await waitFor(() => expect(input().value).toBe("Edited host"));
    expect(fixture.save).toHaveBeenCalledWith(
      bookedName.id,
      { displayName: "Edited host", version: 1 },
      expect.any(AbortSignal),
    );
    expect(saveButton().disabled).toBe(true);
    expect(screen.queryByText("Unsaved changes")).toBeNull();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByText("Name saved.")),
    );
    edit("Second edit");
    fireEvent.click(saveButton());
    await waitFor(() => expect(fixture.save).toHaveBeenCalledTimes(2));
    expect(fixture.save).toHaveBeenLastCalledWith(
      bookedName.id,
      { displayName: "Second edit", version: 2 },
      expect.any(AbortSignal),
    );
    await waitFor(() => expect(saveButton().disabled).toBe(true));
  });
  it("does not save clean/invalid forms even on programmatic submit", async () => {
    const fixture = await ready();
    fireEvent.submit(screen.getByRole("form", { name: "Edit name 1" }));
    edit(" ");
    fireEvent.submit(screen.getByRole("form", { name: "Edit name 1" }));
    expect(fixture.save).not.toHaveBeenCalled();
  });
  it("locks repeated update submissions and waits for API confirmation", async () => {
    const fixture = await ready();
    let resolve!: (value: BookedByName) => void;
    fixture.save.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    edit();
    const form = screen.getByRole("form", { name: "Edit name 1" });
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(fixture.save).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Name saved.")).toBeNull();
    resolve({ ...bookedName, displayName: "Confirmed", version: 7 });
    await waitFor(() => expect(input().value).toBe("Confirmed"));
  });
  it.each([400, 401, 403, 404, 409, 500])(
    "update %i retains edits, associates/focuses safe alert and never auto-retries",
    async (status) => {
      const fixture = await ready();
      fixture.save.mockRejectedValue(failure(status));
      edit();
      fireEvent.click(saveButton());
      await focusedAlert();
      expect(input().value).toBe("Edited host");
      expect(input().getAttribute("aria-describedby")).toContain(
        "booked-error",
      );
      expect(fixture.save).toHaveBeenCalledTimes(1);
      expect(screen.queryByText("Name saved.")).toBeNull();
      expect(saveButton().disabled).toBe([404, 409].includes(status));
    },
  );
  it("stale 409 requires warning/explicit refresh, then uses the freshly loaded version", async () => {
    const fixture = await ready();
    fixture.save.mockRejectedValueOnce(failure(409));
    edit();
    fireEvent.click(saveButton());
    await focusedAlert();
    fireEvent.submit(screen.getByRole("form", { name: "Edit name 1" }));
    expect(fixture.save).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Refresh names" }));
    expect(fixture.load).toHaveBeenCalledTimes(1);
    expect(input().value).toBe("Edited host");
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Keep editing" }),
      ),
    );
    fixture.load.mockResolvedValue(
      bookedList([{ ...bookedName, displayName: "Remote", version: 8 }]),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Discard edits and refresh" }),
    );
    await waitFor(() => expect(input().value).toBe("Remote"));
    edit();
    fireEvent.click(saveButton());
    await waitFor(() => expect(fixture.save).toHaveBeenCalledTimes(2));
    expect(fixture.save).toHaveBeenLastCalledWith(
      bookedName.id,
      { displayName: "Edited host", version: 8 },
      expect.any(AbortSignal),
    );
    await screen.findByText("Name saved.");
  });
  it("Keep editing preserves dirty text without a refresh request", async () => {
    const fixture = await ready();
    edit();
    fireEvent.click(screen.getByRole("button", { name: "Refresh names" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(input().value).toBe("Edited host");
    expect(fixture.load).toHaveBeenCalledTimes(1);
  });
  it("a failed confirmed refresh retains both existing and new drafts", async () => {
    const fixture = await ready();
    edit();
    add();
    fixture.load.mockRejectedValue(failure(500));
    fireEvent.click(screen.getByRole("button", { name: "Refresh names" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Discard edits and refresh" }),
    );
    await focusedAlert();
    expect(input().value).toBe("Edited host");
    expect(
      (screen.getByRole("textbox", { name: "New name" }) as HTMLInputElement)
        .value,
    ).toBe("New host");
  });
  it("warns even for an empty open new editor before refresh", async () => {
    const fixture = await ready();
    fireEvent.click(screen.getByRole("button", { name: "Add new name" }));
    fireEvent.click(screen.getByRole("button", { name: "Refresh names" }));
    expect(
      screen.getByRole("group", { name: "Discard unsaved edits and refresh?" }),
    ).toBeTruthy();
    expect(fixture.load).toHaveBeenCalledTimes(1);
  });
  it("aborts initial load on unmount without displaying a late response", async () => {
    const fixture = setup();
    fixture.load.mockImplementation(() => new Promise(() => {}));
    const view = fixture.mount();
    const signal = fixture.load.mock.calls[0]?.[1];
    view.unmount();
    expect(signal?.aborted).toBe(true);
  });
  it("aborts a pending write on unmount", async () => {
    const fixture = await ready();
    fixture.save.mockImplementation(() => new Promise(() => {}));
    edit();
    fireEvent.click(saveButton());
    const signal = fixture.save.mock.calls[0]?.[2];
    cleanup();
    expect(signal?.aborted).toBe(true);
  });
  it("shows no lifecycle/identity/server controls or sensitive record metadata", async () => {
    await ready();
    expect(document.body.textContent).not.toMatch(
      /Delete|Archive|Employee|Server Names|password|token|organization_id|version/,
    );
    expect(document.body.textContent).not.toContain(bookedName.id);
    expect(
      screen.getByText(/lost when you navigate away or reload/),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Back to User Accounts" })
        .getAttribute("href"),
    ).toBe("/manager/oceansatarthurs/access/user/list");
  });
});

describe("generated Booked By API client", () => {
  it("uses GET cursor/limit and same-origin credentials without browser authority", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify(bookedList()), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetcher);
    expect(
      await listBookedByNames({ limit: 25, cursor: bookedName.id }),
    ).toEqual(bookedList());
    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(new URL(String(url)).pathname).toBe(
      "/api/v1/people/booked-by-names",
    );
    expect(new URL(String(url)).searchParams.get("cursor")).toBe(bookedName.id);
    expect(new URL(String(url)).searchParams.get("limit")).toBe("25");
    expect(init).toEqual({ credentials: "same-origin", signal: null });
  });
  it("sends minimal generated POST and versioned PATCH JSON", async () => {
    const fetcher = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify(bookedName), { status: 201 }),
        ),
      );
    vi.stubGlobal("fetch", fetcher);
    const controller = new AbortController();
    await addBookedByName({ displayName: "Synthetic" }, controller.signal);
    await updateBookedByName(
      bookedName.id,
      { displayName: "Edited", version: 1 },
      controller.signal,
    );
    expect(fetcher.mock.calls[0]?.[1]).toEqual({
      method: "POST",
      credentials: "same-origin",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "Synthetic" }),
    });
    expect(String(fetcher.mock.calls[1]?.[0])).toContain(
      `booked-by-names/${bookedName.id}`,
    );
    expect(fetcher.mock.calls[1]?.[1]).toEqual({
      method: "PATCH",
      credentials: "same-origin",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "Edited", version: 1 }),
    });
  });
  it.each([400, 401, 403, 404, 409, 500])(
    "discards raw error body for %i on all operations",
    async (status) => {
      const json = vi.fn();
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({ ok: false, status, json }),
      );
      await expect(listBookedByNames({})).rejects.toMatchObject({ status });
      await expect(
        addBookedByName({ displayName: "Synthetic" }),
      ).rejects.toMatchObject({ status });
      await expect(
        updateBookedByName(bookedName.id, {
          displayName: "Synthetic",
          version: 1,
        }),
      ).rejects.toMatchObject({ status });
      expect(json).not.toHaveBeenCalled();
    },
  );
});
