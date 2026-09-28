// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { Shell } from "../src/shell";
afterEach(cleanup);
describe("web shell", () => {
  it("renders a mapped route with honest placeholder state", () => {
    render(
      <MemoryRouter initialEntries={["/app/home/oceansatarthurs"]}>
        <Shell />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Home" })).toBeTruthy();
    expect(screen.getByText("Feature not implemented yet.")).toBeTruthy();
    expect(
      screen.getByText(/Authentication and venue context are not connected/),
    ).toBeTruthy();
  });
  it("renders not found and keyboard reachable navigation", () => {
    render(
      <MemoryRouter initialEntries={["/no-such-route"]}>
        <Shell />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("heading", { name: "Page not found" }),
    ).toBeTruthy();
    const skip = screen.getByRole("link", { name: "Skip to content" });
    skip.focus();
    expect(document.activeElement).toBe(skip);
    const nav = screen.getByRole("navigation", {
      name: "Application navigation",
    });
    expect(nav).toBeTruthy();
    fireEvent.click(screen.getAllByText("MOD-01")[0] ?? nav);
    expect(screen.getByRole("link", { name: "Home" })).toBeTruthy();
  });
});
