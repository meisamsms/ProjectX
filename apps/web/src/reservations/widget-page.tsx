import { useRef, useState } from "react";
import {
  type PublicAvailability,
  PublicBookingError,
  type PublicConfirmation,
  publicAvailability,
  publicBook,
} from "./widget-client";

function errorMessage(error: unknown): string {
  if (!(error instanceof PublicBookingError))
    return "Unable to connect. Please try again.";
  if (error.status === 404)
    return "This venue is unavailable for online booking.";
  if (error.status === 409)
    return "This time is no longer available or the booking request conflicts. Please search again.";
  if (error.status === 429)
    return "Too many requests. Please wait and try again.";
  if (error.status === 400) return "Please check your details and try again.";
  return "Unable to complete your request. Please try again.";
}

export function ReservationWidgetPage({ venueSlug }: { venueSlug: string }) {
  const [date, setDate] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [selected, setSelected] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [availability, setAvailability] = useState<PublicAvailability | null>(
    null,
  );
  const [confirmation, setConfirmation] = useState<PublicConfirmation | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const draft = useRef<{ fingerprint: string; key: string } | null>(null);
  const request = useRef(0);

  async function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = ++request.current;
    setBusy(true);
    setError("");
    setAvailability(null);
    setSelected("");
    try {
      const result = await publicAvailability(venueSlug, date, partySize);
      if (id === request.current) setAvailability(result);
    } catch (caught) {
      if (id === request.current) setError(errorMessage(caught));
    } finally {
      if (id === request.current) setBusy(false);
    }
  }
  async function book(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || busy) return;
    const payload = {
      date,
      partySize,
      startsAt: selected,
      guestName: name.trim(),
      guestEmail: email.trim(),
    };
    const fingerprint = JSON.stringify([venueSlug, payload]);
    if (!draft.current || draft.current.fingerprint !== fingerprint)
      draft.current = { fingerprint, key: crypto.randomUUID() };
    setBusy(true);
    setError("");
    try {
      const result = await publicBook(venueSlug, {
        ...payload,
        idempotencyKey: draft.current.key,
      });
      setConfirmation(result);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }
  if (confirmation)
    return (
      <main id="main">
        <h1>Reservation booked</h1>
        <p>Status: {confirmation.status}</p>
        <p>
          {confirmation.venueName}: {confirmation.date} —{" "}
          {confirmation.startsAt} ({confirmation.timezone})
        </p>
        <p>No email or SMS confirmation is sent.</p>
      </main>
    );
  return (
    <main id="main">
      <h1>Book a table</h1>
      <form onSubmit={search}>
        <label htmlFor="booking-date">Date</label>
        <input
          id="booking-date"
          type="date"
          required
          value={date}
          disabled={busy}
          onChange={(e) => {
            setDate(e.target.value);
            setAvailability(null);
            setSelected("");
          }}
        />
        <label htmlFor="booking-party">Party size</label>
        <input
          id="booking-party"
          type="number"
          required
          min={1}
          max={50}
          value={partySize}
          disabled={busy}
          onChange={(e) => {
            setPartySize(Number(e.target.value));
            setAvailability(null);
            setSelected("");
          }}
        />
        <button type="submit" disabled={busy}>
          {busy ? "Please wait…" : "Find available times"}
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {availability && (
        <section aria-labelledby="availability-heading">
          <h2 id="availability-heading">
            Available times at {availability.venue.name}
          </h2>
          {availability.items.length === 0 ? (
            <p>No available times. Try another date or party size.</p>
          ) : (
            <form onSubmit={book}>
              <label htmlFor="booking-time">
                Time ({availability.venue.timezone})
              </label>
              <select
                id="booking-time"
                required
                disabled={busy}
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                <option value="">Select a time</option>
                {availability.items.map((slot) => (
                  <option key={slot.startsAt} value={slot.startsAt}>
                    {new Intl.DateTimeFormat(undefined, {
                      hour: "numeric",
                      minute: "2-digit",
                      timeZone: slot.timezone,
                      timeZoneName: "short",
                    }).format(new Date(slot.startsAt))}
                  </option>
                ))}
              </select>
              <label htmlFor="booking-name">Name</label>
              <input
                id="booking-name"
                required
                maxLength={120}
                autoComplete="name"
                value={name}
                disabled={busy}
                onChange={(e) => setName(e.target.value)}
              />
              <label htmlFor="booking-email">Email</label>
              <input
                id="booking-email"
                type="email"
                required
                maxLength={254}
                autoComplete="email"
                value={email}
                disabled={busy}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button type="submit" disabled={busy || !selected}>
                {busy ? "Booking…" : "Book reservation"}
              </button>
            </form>
          )}
        </section>
      )}
    </main>
  );
}
