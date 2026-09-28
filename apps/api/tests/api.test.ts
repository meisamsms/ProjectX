import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { loadConfig } from "../src/config";
const apps: ReturnType<typeof createApp>[] = [];
function app() {
  const instance = createApp(
    loadConfig({ NODE_ENV: "test", LOG_LEVEL: "silent" }),
  );
  apps.push(instance);
  return instance;
}
afterEach(async () => {
  await Promise.all(apps.splice(0).map((instance) => instance.close()));
});
describe("foundation API", () => {
  it("serves only liveness at /health", async () => {
    const response = await app().inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });
  it("hides unknown resources and includes a generated request ID", async () => {
    const response = await app().inject({
      method: "GET",
      url: "/api/v1/reservations",
      headers: { authorization: "Bearer secret" },
    });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({
      code: "NOT_FOUND",
      message: "Resource not found",
      requestId: expect.any(String),
    });
    expect(response.body).not.toContain("secret");
  });
  it("does not expose an internal error message or stack", async () => {
    const instance = app();
    instance.addHook("onRequest", async () => {
      throw new Error("database-secret-path");
    });
    const response = await instance.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({
      code: "INTERNAL_ERROR",
      requestId: expect.any(String),
    });
    expect(response.body).not.toContain("database-secret-path");
  });
  it("returns a safe error without internals on malformed request", async () => {
    const response = await app().inject({
      method: "POST",
      url: "/health",
      payload: "bad",
    });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toHaveProperty("requestId");
    expect(response.body).not.toMatch(/stack|node_modules|Bearer/i);
  });
});
