import type { components } from "../generated/api";
export type ApiError = components["schemas"]["ApiError"];
export type AuthState =
  | { status: "UNAVAILABLE" }
  | {
      status: "AUTHENTICATED";
      userId: string;
      organizationId: string;
      venueId?: string;
    };
export const initialAuthState: AuthState = { status: "UNAVAILABLE" };
