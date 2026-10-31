import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { loadConfig } from "../../src/config.js";
import type { PublicReservationsRateLimitConfig } from "../../src/reservations/public-route.js";

const date = "2028-01-15";
const publicBase = (slug = "oak-grill") => `/api/v1/public/venues/${slug}`;
// Every case must reject before touching persistence.
const runtime = {
  connect: () => {
    throw new Error("Boundary must reject before database access");
  },
} as unknown as Pool;
function createTestApp(rateLimit?: PublicReservationsRateLimitConfig) {
  return {
    app: createApp(loadConfig({ NODE_ENV: "test" }), {
      publicReservations: {
        runtimePool: runtime,
        expectedHost: "app.test",
        ...(rateLimit ? { rateLimit } : {}),
      },
    }),
  };
}
describe("Public booking authority and abuse boundaries", () => {
  it("refills tokens continuously and never evicts an active limit at capacity", async () => {
    let clock = 100000;
    const { app } = createTestApp({
      maxRequests: 2,
      windowMs: 60000,
      now: () => clock,
    });
    const request = (slug = "oak-grill") =>
      app.inject({
        method: "GET",
        url: `${publicBase(slug)}/availability?date=invalid&partySize=2`,
        headers: { host: "app.test" },
      });
    expect((await request()).statusCode).toBe(400);
    expect((await request()).statusCode).toBe(400);
    expect((await request()).statusCode).toBe(429);
    clock += 30000;
    expect((await request()).statusCode).toBe(400);
    expect((await request()).statusCode).toBe(429);
    for (let i = 0; i < 4095; i++)
      expect((await request(`venue-${i}`)).statusCode).toBe(400);
    expect((await request("overflow")).statusCode).toBe(429);
    expect((await request()).statusCode).toBe(429);
    clock -= 1000;
    expect((await request()).statusCode).toBe(429);
    clock += 61000;
    expect((await request("overflow")).statusCode).toBe(400);
    await app.close();
  });

  it("fails closed without a valid canonical host and rejects conflicting authority", async () => {
    for (const expectedHost of ["", "bad/host", "app.test:99999"]) {
      const app = createApp(loadConfig({ NODE_ENV: "test" }), {
        publicReservations: { runtimePool: runtime, expectedHost },
      });
      expect(
        (
          await app.inject({
            method: "GET",
            url: `${publicBase()}/availability?date=${date}&partySize=2`,
            headers: { host: "app.test" },
          })
        ).statusCode,
      ).toBe(403);
      await app.close();
    }
    const { app } = createTestApp();
    for (const headers of [
      { host: "app.test", forwarded: "host=evil.invalid" },
      { host: "app.test", ":authority": "evil.invalid" },
      { host: "app.test", origin: "ftp://app.test" },
      { host: "app.test", origin: "https://user@app.test" },
    ]) {
      expect(
        (
          await app.inject({
            method: "GET",
            url: `${publicBase()}/availability?date=${date}&partySize=2`,
            headers,
          })
        ).statusCode,
      ).toBe(403);
    }
    await app.close();
  });
});
