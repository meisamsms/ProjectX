import { type ReactNode, useEffect, useState } from "react";
import {
  sessionExpiredEvent,
  setStaffContext,
  staffEndpoint,
  staffFetch,
  type StaffContext,
} from "./client";

export function StaffAuthBoundary({ children }: { children: ReactNode }) {
  const [context, setContext] = useState<StaffContext | null>(null);
  const [state, setState] = useState<"loading" | "login" | "ready" | "error">(
    "loading",
  );
  const [choice, setChoice] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const expired = () => {
      setStaffContext(null);
      setContext(null);
      setState("login");
    };
    window.addEventListener(sessionExpiredEvent, expired);
    async function load() {
      try {
        const r = await staffFetch(staffEndpoint("session"), {
          signal: controller.signal,
        });
        if (r.status === 401) {
          expired();
          return;
        }
        if (!r.ok) throw Error();
        const value = (await r.json()) as StaffContext;
        if (!controller.signal.aborted) {
          setStaffContext(value);
          setContext(value);
          setState("ready");
        }
      } catch {
        if (!controller.signal.aborted) setState("error");
      }
    }
    void load();
    return () => {
      controller.abort();
      window.removeEventListener(sessionExpiredEvent, expired);
      setStaffContext(null);
    };
  }, []);
  if (state === "loading")
    return (
      <main aria-busy="true">
        <h1>Checking staff session</h1>
      </main>
    );
  if (state === "login")
    return (
      <main>
        <h1>Staff sign in required</h1>
        <p>Your session is absent or expired.</p>
        <a href={staffEndpoint("login").href}>Sign in with Auth0</a>
      </main>
    );
  if (state === "error" || !context)
    return (
      <main>
        <h1>Staff access unavailable</h1>
        <p>Reload to retry. No protected operation was submitted.</p>
      </main>
    );
  async function logout() {
    setMessage("");
    try {
      const r = await staffFetch(staffEndpoint("logout"), { method: "POST" });
      if (!r.ok) throw Error();
      setStaffContext(null);
      setContext(null);
      setState("login");
    } catch {
      setMessage(
        "Sign out could not be confirmed. Retry; the session has not been assumed invalid.",
      );
    }
  }
  async function select() {
    if (!context || !choice) return;
    const selected = context.contexts[Number(choice) - 1];
    if (!selected) return;
    setMessage("");
    try {
      const r = await staffFetch(staffEndpoint("context"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...selected,
          contextVersion: context.contextVersion,
        }),
      });
      if (!r.ok) throw Error();
      const value = (await r.json()) as StaffContext;
      setStaffContext(value);
      setContext(value);
      setChoice("");
    } catch {
      setMessage(
        "Context selection was not confirmed. Reload to check current access; no write was replayed.",
      );
    }
  }
  return (
    <>
      <section aria-label="Staff session">
        <p>Authenticated staff context · privileged assurance unverified</p>
        <button type="button" onClick={() => void logout()}>
          Sign out
        </button>
        <label>
          Authorized context
          <select value={choice} onChange={(e) => setChoice(e.target.value)}>
            <option value="">Select organization / venue</option>
            {context.contexts.map((c, i) => (
              <option key={`${c.organizationId}:${c.venueId}`} value={i + 1}>
                {c.organizationId} / {c.venueId ?? "organization only"}
              </option>
            ))}
          </select>
        </label>
        <button type="button" disabled={!choice} onClick={() => void select()}>
          Use selected context
        </button>
        {message && <p role="alert">{message}</p>}
      </section>
      {context.organizationId ? (
        <div key={context.contextVersion}>{children}</div>
      ) : (
        <main>
          <h1>Select an authorized context</h1>
          <p>
            {context.contexts.length
              ? "Select a context above."
              : "No active organization access is available."}
          </p>
        </main>
      )}
    </>
  );
}
