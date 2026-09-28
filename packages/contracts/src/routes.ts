import registry from "../routes.json";
export type RouteEntry = (typeof registry.routes)[number];
export const routes: readonly RouteEntry[] = registry.routes;
export const navigationRoutes = routes.filter(
  (route) => route.navigationVisible && !route.surfaceOnly,
);
export const homeRoute = routes.find((route) => route.screenId === "SCR-001");
export function lookupScreen(screenId: string): RouteEntry | undefined {
  return routes.find((route) => route.screenId === screenId);
}
