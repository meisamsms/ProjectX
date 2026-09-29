import type { AccountsQuery, AccountsResponse } from "../../api-client";
import { AccountsRequestError, getPeopleAccounts } from "../../api-client";
import { type FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";

type LoadAccounts = (
  query: AccountsQuery,
  signal?: AbortSignal,
) => Promise<AccountsResponse>;
type ViewState = "loading" | "loaded" | "unauthorized" | "forbidden" | "error";
function Placeholder({ label }: { label: string }) {
  return (
    <>
      <span className="visually-hidden">{label}</span>
      <span aria-hidden="true">—</span>
    </>
  );
}

export function AccountsPage({
  loadAccounts = getPeopleAccounts,
}: {
  loadAccounts?: LoadAccounts;
}) {
  const [draftFilter, setDraftFilter] = useState("");
  const [accessLevel, setAccessLevel] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [state, setState] = useState<ViewState>("loading");
  const [data, setData] = useState<AccountsResponse | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setState("loading");
    setData(null);
    const query: AccountsQuery = {};
    if (accessLevel) query.accessLevel = accessLevel;
    if (cursor) query.cursor = cursor;
    loadAccounts(query, controller.signal).then(
      (result) => {
        if (controller.signal.aborted) return;
        setData(result);
        setState("loaded");
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        setState(
          error instanceof AccountsRequestError && error.status === 401
            ? "unauthorized"
            : error instanceof AccountsRequestError && error.status === 403
              ? "forbidden"
              : "error",
        );
      },
    );
    return () => controller.abort();
  }, [loadAccounts, accessLevel, cursor]);

  function applyFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCursor(null);
    setAccessLevel(draftFilter.trim());
  }

  return (
    <section className="accounts-page" aria-labelledby="accounts-heading">
      <h1 id="accounts-heading">User Accounts</h1>
      <p>Organization user accounts you are authorized to view.</p>
      <div className="accounts-actions">
        <Link to="/manager/oceansatarthurs/access/user/create">Add new</Link>
        <span>Export unavailable</span>
      </div>
      <form onSubmit={applyFilter} className="accounts-filter">
        <label htmlFor="access-level">Access Level (exact role name)</label>
        <input
          id="access-level"
          value={draftFilter}
          onChange={(event) => setDraftFilter(event.target.value)}
          maxLength={120}
        />
        <button type="submit">Apply filter</button>
      </form>
      {accessLevel && <p>Access Level filter: {accessLevel}</p>}

      <div aria-live="polite" role="status">
        {state === "loading" && <p>Loading user accounts…</p>}
        {state === "unauthorized" && (
          <p>Sign in is required to view user accounts.</p>
        )}
        {state === "forbidden" && (
          <p>You do not have access to user accounts.</p>
        )}
        {state === "error" && (
          <p>User accounts are unavailable. Please try again.</p>
        )}
        {state === "loaded" && data?.items.length === 0 && (
          <p>No user accounts found.</p>
        )}
      </div>

      {state === "loaded" && data && data.items.length > 0 && (
        <>
          <div className="accounts-table-scroll">
            <table>
              <caption>Authorized user accounts</caption>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Job Title</th>
                  <th scope="col">Access Level</th>
                  <th scope="col">Additional Options</th>
                  <th scope="col">Email Notifications</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((account) => (
                  <tr key={account.id}>
                    <td>
                      {account.name ?? (
                        <Placeholder label="Name not supplied" />
                      )}
                    </td>
                    <td>
                      {account.jobTitle ?? (
                        <Placeholder label="Job title not stored" />
                      )}
                    </td>
                    <td>
                      {account.accessLevels.length ? (
                        <ul className="access-levels">
                          {account.accessLevels.map((role) => (
                            <li key={role}>{role}</li>
                          ))}
                        </ul>
                      ) : (
                        <Placeholder label="No organization role stored" />
                      )}
                    </td>
                    <td>Unavailable</td>
                    <td>
                      {account.emailNotificationsEnabled === null
                        ? "Not configured"
                        : account.emailNotificationsEnabled
                          ? "Enabled"
                          : "Disabled"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="accounts-pagination">
            {data.nextCursor ? (
              <button type="button" onClick={() => setCursor(data.nextCursor)}>
                Next page
              </button>
            ) : (
              <p>End of results</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
