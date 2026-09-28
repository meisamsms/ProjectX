import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config";
describe("configuration", () => {
  it("rejects invalid port and environment without exposing values", () => {
    expect(() => loadConfig({ NODE_ENV: "production", PORT: "0" })).toThrow(
      "Invalid server configuration",
    );
    expect(() => loadConfig({ NODE_ENV: "unknown" })).toThrow();
  });
  it("loads bounded local defaults", () => {
    expect(loadConfig({ NODE_ENV: "test" })).toMatchObject({
      NODE_ENV: "test",
      HOST: "127.0.0.1",
      PORT: 3001,
    });
  });
});
