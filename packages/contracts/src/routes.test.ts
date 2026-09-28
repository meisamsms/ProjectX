import { describe, expect, it } from "vitest";
import { homeRoute, lookupScreen, navigationRoutes, routes } from "./routes";
describe("mapped route contract", () => {
  it("keeps a unique entry for all discovered screens", () => {
    expect(routes).toHaveLength(144);
    expect(new Set(routes.map((route) => route.screenId)).size).toBe(
      routes.length,
    );
    expect(homeRoute?.implementationStatus).toBe("NOT_IMPLEMENTED");
  });
  it("never navigates to a nested UI surface", () => {
    expect(
      navigationRoutes.every(
        (route) => !route.surfaceOnly && route.routePattern?.startsWith("/"),
      ),
    ).toBe(true);
    expect(lookupScreen("SCR-003")?.surfaceOnly).toBe(true);
  });
});
