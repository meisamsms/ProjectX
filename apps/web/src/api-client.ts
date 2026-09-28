import type { paths } from "@projectx/contracts/api";
export type HealthResponse =
  paths["/health"]["get"]["responses"][200]["content"]["application/json"];
export async function checkHealth(baseUrl: string): Promise<HealthResponse> {
  const response = await fetch(new URL("/health", baseUrl), {
    credentials: "omit",
  });
  if (!response.ok) throw new Error("Health check failed");
  return (await response.json()) as HealthResponse;
}
// Business API clients must derive DTOs from generated OpenAPI types, never duplicate them.
