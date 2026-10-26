import type { components, operations } from "@projectx/contracts/api";
import { staffFetch } from "../staff-auth/client";

export type ReservationStatus = components["schemas"]["ReservationStatus"];
export type StaffReservationSlot =
  components["schemas"]["StaffReservationSlot"];
export type StaffReservationAvailabilityResponse =
  components["schemas"]["StaffReservationAvailabilityResponse"];
export type StaffReservation = components["schemas"]["StaffReservation"];
export type StaffReservationListResponse =
  components["schemas"]["StaffReservationListResponse"];
export type CreateStaffReservationRequest =
  components["schemas"]["CreateStaffReservationRequest"];
export type ModifyStaffReservationRequest =
  components["schemas"]["ModifyStaffReservationRequest"];
export type TransitionStaffReservationRequest =
  components["schemas"]["TransitionStaffReservationRequest"];
export type AvailabilityQuery = NonNullable<
  operations["searchStaffReservationAvailability"]["parameters"]["query"]
>;
export type ReservationListQuery = NonNullable<
  operations["listStaffReservations"]["parameters"]["query"]
>;

export class ReservationRequestError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(status: number, code?: string) {
    super(`Reservation request failed: ${status}`);
    this.name = "ReservationRequestError";
    this.status = status;
    this.code = code;
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      code?: unknown;
    } | null;
    const code = typeof payload?.code === "string" ? payload.code : undefined;
    throw new ReservationRequestError(response.status, code);
  }
  return (await response.json()) as T;
}

export async function searchStaffReservationAvailability(
  query: AvailabilityQuery,
  signal?: AbortSignal,
): Promise<StaffReservationAvailabilityResponse> {
  const params = new URLSearchParams({
    date: query.date,
    partySize: String(query.partySize),
  });
  if (query.fromMinute !== undefined) {
    params.set("fromMinute", String(query.fromMinute));
  }
  if (query.toMinute !== undefined) {
    params.set("toMinute", String(query.toMinute));
  }
  const response = await staffFetch(
    `/api/v1/staff/reservations/availability?${params}`,
    signal ? { signal } : {},
  );
  return parseResponse<StaffReservationAvailabilityResponse>(response);
}

export async function listStaffReservations(
  query: ReservationListQuery,
  signal?: AbortSignal,
): Promise<StaffReservationListResponse> {
  const params = new URLSearchParams({
    date: query.date,
  });
  if (query.limit !== undefined) {
    params.set("limit", String(query.limit));
  }
  const response = await staffFetch(
    `/api/v1/staff/reservations?${params}`,
    signal ? { signal } : {},
  );
  return parseResponse<StaffReservationListResponse>(response);
}

export async function getStaffReservation(
  id: string,
  signal?: AbortSignal,
): Promise<StaffReservation> {
  const response = await staffFetch(
    `/api/v1/staff/reservations/${encodeURIComponent(id)}`,
    signal ? { signal } : {},
  );
  return parseResponse<StaffReservation>(response);
}

export async function createStaffReservation(
  body: CreateStaffReservationRequest,
  signal?: AbortSignal,
): Promise<StaffReservation> {
  const response = await staffFetch("/api/v1/staff/reservations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    ...(signal ? { signal } : {}),
  });
  return parseResponse<StaffReservation>(response);
}

export async function modifyStaffReservation(
  id: string,
  body: ModifyStaffReservationRequest,
  signal?: AbortSignal,
): Promise<StaffReservation> {
  const response = await staffFetch(
    `/api/v1/staff/reservations/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      ...(signal ? { signal } : {}),
    },
  );
  return parseResponse<StaffReservation>(response);
}

export async function checkInStaffReservation(
  id: string,
  body: TransitionStaffReservationRequest,
  signal?: AbortSignal,
): Promise<StaffReservation> {
  const response = await staffFetch(
    `/api/v1/staff/reservations/${encodeURIComponent(id)}/check-in`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      ...(signal ? { signal } : {}),
    },
  );
  return parseResponse<StaffReservation>(response);
}

export async function seatStaffReservation(
  id: string,
  body: TransitionStaffReservationRequest,
  signal?: AbortSignal,
): Promise<StaffReservation> {
  const response = await staffFetch(
    `/api/v1/staff/reservations/${encodeURIComponent(id)}/seat`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      ...(signal ? { signal } : {}),
    },
  );
  return parseResponse<StaffReservation>(response);
}

export async function cancelStaffReservation(
  id: string,
  signal?: AbortSignal,
): Promise<StaffReservation> {
  const response = await staffFetch(
    `/api/v1/staff/reservations/${encodeURIComponent(id)}/cancel`,
    {
      method: "POST",
      ...(signal ? { signal } : {}),
    },
  );
  return parseResponse<StaffReservation>(response);
}
