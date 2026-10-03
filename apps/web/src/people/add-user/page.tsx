import { type FormEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  type AddUserOptions,
  type AddUserRequest,
  AddUserRequestError,
  createPeopleAccount,
  getAddUserOptions,
} from "./client";

const accountsRoute = "/manager/oceansatarthurs/access/user/list";
type PermissionId = NonNullable<
  AddUserRequest["organizationPermissionIds"]
>[number];
type VenueChoice = AddUserRequest["venues"][number];
const emptyProfile = () => ({
  firstName: "",
  lastName: "",
  email: "",
  jobTitle: "",
  notifications: "null",
  suspended: false,
});
function toggle<T>(values: T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}
function safeError(error: unknown, options = false) {
  const status = error instanceof AddUserRequestError ? error.status : 0;
  if (status === 401) return "Sign in is required to add users.";
  if (status === 403)
    return "You do not have access to add users or assign these selections.";
  if (options)
    return "Add User options are unavailable. Please reload to try again.";
  if (status === 400)
    return "Check the form and your selections, then try again.";
  if (status === 409)
    return "Account creation conflicted with an existing request. Review the details before trying again.";
  return "Account creation could not be confirmed. Retry unchanged details to reuse the same request.";
}

export function AddUserPage({
  loadOptions = getAddUserOptions,
  createAccount = createPeopleAccount,
}: {
  loadOptions?: typeof getAddUserOptions;
  createAccount?: typeof createPeopleAccount;
}) {
  const navigate = useNavigate();
  const [options, setOptions] = useState<AddUserOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [profile, setProfile] = useState(emptyProfile);
  const [roles, setRoles] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<PermissionId[]>([]);
  const [venues, setVenues] = useState<VenueChoice[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const errorRef = useRef<HTMLParagraphElement>(null);
  const successRef = useRef<HTMLParagraphElement>(null);
  const submitting = useRef(false);
  const boundary = useRef<{ fingerprint: string; key: string } | null>(null);
  const mutation = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setOptions(null);
    setLoadError("");
    loadOptions(controller.signal).then(
      (data) => {
        if (controller.signal.aborted) return;
        setOptions(data);
        setLoading(false);
      },
      (reason: unknown) => {
        if (controller.signal.aborted) return;
        setLoadError(safeError(reason, true));
        setLoading(false);
      },
    );
    return () => {
      controller.abort();
      mutation.current?.abort();
    };
  }, [loadOptions]);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  useEffect(() => {
    if (success) successRef.current?.focus();
  }, [success]);

  async function submit(event: FormEvent<HTMLFormElement>, another: boolean) {
    event.preventDefault();
    if (submitting.current || !options?.organizationRoles.length) return;
    setError("");
    setSuccess("");
    if (!roles.length || venues.some((venue) => !venue.roleIds.length)) {
      setError(
        "Select at least one organization access level and one access level for each selected venue.",
      );
      return;
    }
    const nullable = (value: string) => value.trim() || null;
    const body: AddUserRequest = {
      email: profile.email.trim(),
      firstName: nullable(profile.firstName),
      lastName: nullable(profile.lastName),
      jobTitle: nullable(profile.jobTitle),
      emailNotificationsEnabled:
        profile.notifications === "null"
          ? null
          : profile.notifications === "true",
      suspended: profile.suspended,
      organizationRoleIds: [...roles].sort(),
      organizationPermissionIds: [...permissions].sort(),
      venues: venues
        .map((venue) => ({
          ...venue,
          roleIds: [...venue.roleIds].sort(),
          permissionIds: [...(venue.permissionIds ?? [])].sort(),
        }))
        .sort((a, b) => a.venueId.localeCompare(b.venueId)),
    };
    const fingerprint = JSON.stringify(body);
    if (boundary.current?.fingerprint !== fingerprint)
      boundary.current = { fingerprint, key: crypto.randomUUID() };
    submitting.current = true;
    setPending(true);
    const controller = new AbortController();
    mutation.current = controller;
    try {
      await createAccount(body, boundary.current.key, controller.signal);
      if (controller.signal.aborted) return;
      if (another) {
        setProfile(emptyProfile());
        setRoles([]);
        setPermissions([]);
        setVenues([]);
        boundary.current = null;
        setSuccess(
          "Pending account created. Enter details for another user. No invitation was sent.",
        );
      } else navigate(accountsRoute);
    } catch (reason) {
      if (!controller.signal.aborted) setError(safeError(reason));
    } finally {
      submitting.current = false;
      if (!controller.signal.aborted) setPending(false);
    }
  }
  function changeVenue(
    id: string,
    update: (choice: VenueChoice) => VenueChoice,
  ) {
    setVenues((current) =>
      current.map((choice) =>
        choice.venueId === id ? update(choice) : choice,
      ),
    );
  }
  return (
    <section className="add-user-page" aria-labelledby="add-user-heading">
      <h1 id="add-user-heading">Add User</h1>
      <p>
        Create a pending ProjectX account. Email is unverified; no invitation is
        sent.
      </p>
      {!pending && <Link to={accountsRoute}>Back to User Accounts</Link>}
      <div role="status" aria-live="polite">
        {loading && <p>Loading Add User options…</p>}
        {loadError && <p>{loadError}</p>}
        {options && !options.organizationRoles.length && (
          <p>
            No organization access levels are available. Account creation is
            unavailable.
          </p>
        )}
        {pending && <p>Creating pending account…</p>}
        {success && (
          <p ref={successRef} tabIndex={-1}>
            {success}
          </p>
        )}
      </div>
      {error && (
        <p role="alert" tabIndex={-1} ref={errorRef}>
          {error}
        </p>
      )}
      {options && options.organizationRoles.length > 0 && (
        <form
          onSubmit={(event) => {
            const button = (event.nativeEvent as SubmitEvent).submitter;
            void submit(
              event,
              button instanceof HTMLButtonElement && button.value === "another",
            );
          }}
        >
          <fieldset disabled={pending}>
            <legend>Account information</legend>
            {(["firstName", "lastName", "email", "jobTitle"] as const).map(
              (key) => (
                <div className="add-user-field" key={key}>
                  <label htmlFor={`add-${key}`}>
                    {
                      {
                        firstName: "First Name",
                        lastName: "Last Name",
                        email: "Email",
                        jobTitle: "Job Title",
                      }[key]
                    }
                  </label>
                  <input
                    id={`add-${key}`}
                    type={key === "email" ? "email" : "text"}
                    required={key === "email"}
                    maxLength={key === "email" ? 254 : 120}
                    value={profile[key]}
                    onChange={(event) =>
                      setProfile({ ...profile, [key]: event.target.value })
                    }
                  />
                </div>
              ),
            )}
            <div className="add-user-field">
              <label htmlFor="add-notifications">Email Notifications</label>
              <select
                id="add-notifications"
                value={profile.notifications}
                onChange={(event) =>
                  setProfile({ ...profile, notifications: event.target.value })
                }
              >
                <option value="null">Not configured</option>
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </select>
            </div>
            <label>
              <input
                type="checkbox"
                checked={profile.suspended}
                onChange={(event) =>
                  setProfile({ ...profile, suspended: event.target.checked })
                }
              />
              Disabled at creation
            </label>
            <fieldset>
              <legend>Organization Access Level (select at least one)</legend>
              {options.organizationRoles.map((role) => (
                <label className="add-user-choice" key={role.id}>
                  <input
                    type="checkbox"
                    checked={roles.includes(role.id)}
                    onChange={() => setRoles(toggle(roles, role.id))}
                  />
                  {role.name}
                </label>
              ))}
            </fieldset>
            <fieldset>
              <legend>Granular Permissions — organization / self</legend>
              <p>
                Direct permissions are additive to roles. No role precedence is
                inferred.
              </p>
              {!options.organizationPermissions.length && (
                <p>No organization or self permissions available.</p>
              )}
              {options.organizationPermissions.map((permission) => (
                <label className="add-user-choice" key={permission.id}>
                  <input
                    type="checkbox"
                    checked={permissions.includes(permission.id)}
                    onChange={() =>
                      setPermissions(toggle(permissions, permission.id))
                    }
                  />
                  {permission.description} (
                  {permission.scope === "SELF" ? "Self" : "Organization"})
                </label>
              ))}
            </fieldset>
            <fieldset>
              <legend>Venue Access — explicit selections</legend>
              {!options.venues.length && <p>No venues available.</p>}
              {options.venues.map((venue) => {
                const choice = venues.find((item) => item.venueId === venue.id);
                return (
                  <div key={venue.id}>
                    <label className="add-user-choice">
                      <input
                        type="checkbox"
                        checked={!!choice}
                        disabled={!venue.roles.length}
                        onChange={() =>
                          setVenues((current) =>
                            choice
                              ? current.filter(
                                  (item) => item.venueId !== venue.id,
                                )
                              : [
                                  ...current,
                                  {
                                    venueId: venue.id,
                                    roleIds: [],
                                    permissionIds: [],
                                  },
                                ],
                          )
                        }
                      />
                      {venue.name}
                    </label>
                    {!venue.roles.length && (
                      <p>No access levels available for this venue.</p>
                    )}
                    {choice && (
                      <>
                        <fieldset>
                          <legend>
                            {venue.name} Access Level (select at least one)
                          </legend>
                          {venue.roles.map((role) => (
                            <label className="add-user-choice" key={role.id}>
                              <input
                                type="checkbox"
                                checked={choice.roleIds.includes(role.id)}
                                onChange={() =>
                                  changeVenue(venue.id, (item) => ({
                                    ...item,
                                    roleIds: toggle(item.roleIds, role.id),
                                  }))
                                }
                              />
                              {role.name}
                            </label>
                          ))}
                        </fieldset>
                        <fieldset>
                          <legend>{venue.name} Granular Permissions</legend>
                          {!venue.permissions.length && (
                            <p>No venue permissions available.</p>
                          )}
                          {venue.permissions.map((permission) => (
                            <label
                              className="add-user-choice"
                              key={permission.id}
                            >
                              <input
                                type="checkbox"
                                checked={
                                  choice.permissionIds?.includes(
                                    permission.id,
                                  ) ?? false
                                }
                                onChange={() =>
                                  changeVenue(venue.id, (item) => ({
                                    ...item,
                                    permissionIds: toggle(
                                      item.permissionIds ?? [],
                                      permission.id,
                                    ),
                                  }))
                                }
                              />
                              {permission.description}
                            </label>
                          ))}
                        </fieldset>
                      </>
                    )}
                  </div>
                );
              })}
            </fieldset>
            <div className="accounts-actions">
              <button type="submit" value="create">
                Create
              </button>
              <button type="submit" value="another">
                Create + Add Another
              </button>
            </div>
          </fieldset>
        </form>
      )}
      <p>
        Mobile MFA and Email Subscriptions are unavailable. Notification
        preferences do not enable email delivery.
      </p>
    </section>
  );
}
