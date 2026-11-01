import type { components } from "@projectx/contracts/api";

export type PublicAvailability =
  components["schemas"]["PublicReservationAvailabilityResponse"];
export type PublicBooking =
  components["schemas"]["CreatePublicReservationRequest"];
export type PublicConfirmation =
  components["schemas"]["PublicReservationConfirmation"];

export class PublicBookingError extends Error {
  constructor(readonly status: number) {
    super(`Booking request failed: ${status}`);
  }
}

async function response<T>(result: Response): Promise<T> {
  if (!result.ok) throw new PublicBookingError(result.status);
  return (await result.json()) as T;
}

export async function publicAvailability(
  slug: string,
  date: string,
  partySize: number,
): Promise<PublicAvailability> {
  const query = new URLSearchParams({ date, partySize: String(partySize) });
  return response(
    await fetch(
      `/api/v1/public/venues/${encodeURIComponent(slug)}/availability?${query}`,
      { credentials: "omit", cache: "no-store" },
    ),
  );
}

export async function publicBook(
  slug: string,
  booking: PublicBooking,
): Promise<PublicConfirmation> {
  return response(
    await fetch(
      `/api/v1/public/venues/${encodeURIComponent(slug)}/reservations`,
      {
        method: "POST",
        credentials: "omit",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(booking),
      },
    ),
  );
}
