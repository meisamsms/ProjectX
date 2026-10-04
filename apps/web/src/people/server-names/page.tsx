import { useEffect, useRef, useState } from "react";
import {
  addServerName,
  ServerRequestError,
  listServerNames,
  updateServerName,
  type ServerName,
} from "./client";

export function nameValidation(value: string): string | null {
  const points = Array.from(value);
  if (
    points.length > 1024 ||
    points.some((point) => {
      const code = point.codePointAt(0) ?? 0;
      return (
        code <= 31 ||
        (code >= 127 && code <= 159) ||
        (code >= 0xd800 && code <= 0xdfff)
      );
    })
  )
    return "Use plain text without control characters.";
  const length = Array.from(value.trim()).length;
  return length < 1 || length > 120
    ? "Enter 1–120 characters after trimming spaces."
    : null;
}
function safeError(error: unknown): string {
  const status = error instanceof ServerRequestError ? error.status : 0;
  switch (status) {
    case 400:
      return "The request could not be accepted. Check the name and try again.";
    case 401:
      return "Sign in again before accessing Server Names.";
    case 403:
      return "You do not have access to manage Server Names for this venue.";
    case 404:
      return "This name is unavailable. Refresh the list before editing it again.";
    case 409:
      return "This name changed since it was loaded. Your draft is retained. Refresh before saving again.";
    default:
      return "Server Names could not be saved or loaded. Your drafts are retained. Try again.";
  }
}
function mergeNames(existing: ServerName[], incoming: ServerName[]) {
  const byId = new Map(existing.map((name) => [name.id, name]));
  for (const name of incoming) if (!byId.has(name.id)) byId.set(name.id, name);
  // Match the verified backend's UUID order, including a confirmed create
  // that may precede later cursor pages in local state. Never sort by name.
  return [...byId.values()].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );
}
export function ServerPage({
  loadNames = listServerNames,
  createName = addServerName,
  saveName = updateServerName,
}: {
  loadNames?: typeof listServerNames;
  createName?: typeof addServerName;
  saveName?: typeof updateServerName;
}) {
  const [rows, setRows] = useState<ServerName[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [newDraft, setNewDraft] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>("Loading names…");
  const [error, setError] = useState<{ message: string; row?: string } | null>(
    null,
  );
  const [success, setSuccess] = useState<{ message: string } | null>(null);
  const [confirmRefresh, setConfirmRefresh] = useState(false);
  const lock = useRef(true);
  const controller = useRef<AbortController | null>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLParagraphElement>(null);
  const newRef = useRef<HTMLInputElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const refreshRef = useRef<HTMLButtonElement>(null);
  const keepFocus = useRef(false);
  const cancelFocus = useRef(false);
  const dirty =
    newDraft !== null ||
    rows.some(
      (row) =>
        drafts[row.id] !== undefined &&
        drafts[row.id]?.trim() !== row.displayName,
    );

  useEffect(() => {
    const request = new AbortController();
    controller.current = request;
    lock.current = true;
    setBusy("Loading names…");
    loadNames({ limit: 25 }, request.signal)
      .then((result) => {
        if (request.signal.aborted) return;
        setRows(mergeNames([], result.items));
        setCursor(result.nextCursor);
        setLoaded(true);
      })
      .catch((reason: unknown) => {
        if (!request.signal.aborted) setError({ message: safeError(reason) });
      })
      .finally(() => {
        if (!request.signal.aborted) {
          lock.current = false;
          setBusy(null);
        }
      });
    return () => {
      request.abort();
      controller.current?.abort();
    };
  }, [loadNames]);
  useEffect(() => {
    if (error) alertRef.current?.focus();
  }, [error]);
  useEffect(() => {
    if (success) successRef.current?.focus();
  }, [success]);
  const newOpen = newDraft !== null;
  useEffect(() => {
    if (newOpen) newRef.current?.focus();
    else if (cancelFocus.current) {
      cancelFocus.current = false;
      addRef.current?.focus();
    }
  }, [newOpen]);
  useEffect(() => {
    if (confirmRefresh) keepRef.current?.focus();
    else if (keepFocus.current) {
      keepFocus.current = false;
      refreshRef.current?.focus();
    }
  }, [confirmRefresh]);

  async function perform<T>(
    label: string,
    action: (signal: AbortSignal) => Promise<T>,
    done: (value: T) => void,
    row?: string,
  ) {
    if (lock.current) return;
    lock.current = true;
    const request = new AbortController();
    controller.current = request;
    setBusy(label);
    setError(null);
    setSuccess(null);
    try {
      const result = await action(request.signal);
      if (!request.signal.aborted) done(result);
    } catch (reason) {
      if (!request.signal.aborted) {
        setError({ message: safeError(reason), ...(row ? { row } : {}) });
        if (row)
          setRowErrors((current) => ({ ...current, [row]: safeError(reason) }));
        if (
          row &&
          reason instanceof ServerRequestError &&
          [404, 409].includes(reason.status)
        )
          setBlocked((current) => [...new Set([...current, row])]);
      }
    } finally {
      if (!request.signal.aborted) {
        lock.current = false;
        setBusy(null);
      }
    }
  }
  function refresh() {
    setConfirmRefresh(false);
    void perform(
      "Refreshing names…",
      (signal) => loadNames({ limit: 25 }, signal),
      (result) => {
        setRows(mergeNames([], result.items));
        setCursor(result.nextCursor);
        setLoaded(true);
        setDrafts({});
        setBlocked([]);
        setRowErrors({});
        setNewDraft(null);
        setSuccess({ message: "Names refreshed." });
      },
    );
  }
  return (
    <section className="server-names-page" aria-labelledby="server-title">
      <h1 id="server-title">Server Names</h1>
      <p>Display names for the current authorized venue.</p>
      <p id="server-hint">
        Use 1–120 characters after trimming spaces. Duplicate names are allowed.
      </p>
      <p>
        Unsaved edits stay on this page only and are lost when you navigate away
        or reload.
      </p>
      {dirty && <p>Unsaved changes</p>}
      {busy && <p role="status">{busy}</p>}
      {error && (
        <div role="alert" id="server-error" tabIndex={-1} ref={alertRef}>
          {error.message}
        </div>
      )}
      {success && (
        <p role="status" tabIndex={-1} ref={successRef}>
          {success.message}
        </p>
      )}
      <div className="server-actions">
        {loaded && (
          <button
            ref={addRef}
            type="button"
            disabled={busy !== null || newOpen || confirmRefresh}
            onClick={() => {
              setError(null);
              setSuccess(null);
              setNewDraft("");
            }}
          >
            Add new name
          </button>
        )}
        <button
          type="button"
          ref={refreshRef}
          disabled={busy !== null || confirmRefresh}
          onClick={() => (dirty ? setConfirmRefresh(true) : refresh())}
        >
          Refresh names
        </button>
      </div>
      {confirmRefresh && (
        <fieldset aria-label="Discard unsaved edits and refresh?">
          <legend>Discard unsaved edits and refresh?</legend>
          <p>
            Refreshing will discard your unsaved edits after the list loads
            successfully.
          </p>
          <button
            type="button"
            ref={keepRef}
            onClick={() => {
              keepFocus.current = true;
              setConfirmRefresh(false);
            }}
          >
            Keep editing
          </button>
          <button type="button" onClick={refresh}>
            Discard edits and refresh
          </button>
        </fieldset>
      )}
      {loaded && (
        <>
          {newDraft !== null && (
            <form
              aria-label="Add new name"
              onSubmit={(event) => {
                event.preventDefault();
                if (nameValidation(newDraft)) return;
                void perform(
                  "Creating name…",
                  (signal) =>
                    createName({ displayName: newDraft.trim() }, signal),
                  (result) => {
                    setRows((current) => mergeNames(current, [result]));
                    setNewDraft(null);
                    setSuccess({ message: "Name created." });
                  },
                );
              }}
            >
              <fieldset disabled={busy !== null || confirmRefresh}>
                <legend>Add new name</legend>
                <label htmlFor="server-new">New name</label>
                <input
                  id="server-new"
                  ref={newRef}
                  value={newDraft}
                  onChange={(event) => setNewDraft(event.target.value)}
                  aria-invalid={nameValidation(newDraft) !== null}
                  aria-describedby="server-hint server-new-validation"
                />
                <p id="server-new-validation">
                  {nameValidation(newDraft) ?? "Name is valid."}
                </p>
                <button
                  type="submit"
                  disabled={nameValidation(newDraft) !== null}
                >
                  Create name
                </button>
                <button
                  type="button"
                  onClick={() => {
                    cancelFocus.current = true;
                    setNewDraft(null);
                  }}
                >
                  Cancel new name
                </button>
              </fieldset>
            </form>
          )}
          {rows.length === 0 ? (
            <p>No Server Names yet. Add a name to begin.</p>
          ) : (
            <ol aria-label="Server Names">
              {rows.map((row, index) => {
                const value = drafts[row.id] ?? row.displayName;
                const changed = value.trim() !== row.displayName;
                const validation = nameValidation(value);
                const inputId = `server-${row.id}`;
                return (
                  <li key={row.id}>
                    <form
                      aria-label={`Edit name ${index + 1}`}
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (!changed || validation || blocked.includes(row.id))
                          return;
                        void perform(
                          "Saving name…",
                          (signal) =>
                            saveName(
                              row.id,
                              {
                                displayName: value.trim(),
                                version: row.version,
                              },
                              signal,
                            ),
                          (result) => {
                            setRows((current) =>
                              current.map((name) =>
                                name.id === row.id ? result : name,
                              ),
                            );
                            setDrafts((current) => {
                              const next = { ...current };
                              delete next[row.id];
                              return next;
                            });
                            setRowErrors((current) => {
                              const next = { ...current };
                              delete next[row.id];
                              return next;
                            });
                            setSuccess({ message: "Name saved." });
                          },
                          row.id,
                        );
                      }}
                    >
                      <fieldset disabled={busy !== null || confirmRefresh}>
                        <legend className="visually-hidden">
                          Edit name {index + 1}
                        </legend>
                        <label htmlFor={inputId}>Server name {index + 1}</label>
                        <input
                          id={inputId}
                          value={value}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [row.id]: event.target.value,
                            }))
                          }
                          aria-invalid={validation !== null}
                          aria-describedby={`server-hint ${inputId}-state${rowErrors[row.id] ? ` ${inputId}-error` : ""}${error?.row === row.id ? " server-error" : ""}`}
                        />
                        <p id={`${inputId}-state`}>
                          {validation ??
                            (changed ? "Unsaved changes" : "Saved")}
                          {blocked.includes(row.id)
                            ? " — Refresh required before saving."
                            : ""}
                        </p>
                        {rowErrors[row.id] && (
                          <p id={`${inputId}-error`}>{rowErrors[row.id]}</p>
                        )}
                        <button
                          type="submit"
                          disabled={
                            !changed ||
                            validation !== null ||
                            blocked.includes(row.id)
                          }
                          aria-label={`Save changes for name ${index + 1}`}
                        >
                          Save changes
                        </button>
                      </fieldset>
                    </form>
                  </li>
                );
              })}
            </ol>
          )}
          {cursor ? (
            <button
              type="button"
              disabled={busy !== null || confirmRefresh}
              onClick={() =>
                void perform(
                  "Loading more names…",
                  (signal) => loadNames({ limit: 25, cursor }, signal),
                  (result) => {
                    setRows((current) => mergeNames(current, result.items));
                    setCursor(result.nextCursor);
                  },
                )
              }
            >
              Load more names
            </button>
          ) : (
            <p>End of results</p>
          )}
        </>
      )}
    </section>
  );
}
