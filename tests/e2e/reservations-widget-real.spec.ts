import { expect, test } from "@playwright/test";

test("real PostgreSQL guest booking appears in authenticated staff book", async ({
  page,
  context,
}) => {
  test.skip(
    process.env.PROJECTX_REAL_WIDGET_TEST !== "1",
    "Requires disposable PostgreSQL and explicit local test proxy",
  );
  test.setTimeout(90000);
  const { createApp } = await import("../../apps/api/src/app");
  const { loadConfig } = await import("../../apps/api/src/config");
  const { newPeopleId } = await import(
    "../../apps/api/src/people/persistence/id"
  );
  const { postgresStaffStore } = await import(
    "../../apps/api/src/staff-auth/store"
  );
  const { hash, secret, SESSION_COOKIE } = await import(
    "../../apps/api/src/staff-auth/credentials"
  );
  const { config } = await import("../../apps/api/tests/staff-auth/fixtures");
  const { adminPool, freshPeopleFixture, startRuntime, stopRuntime } =
    await import("../../apps/api/tests/people/fixtures/runtime");
  const date = `${new Date().getUTCFullYear() + 2}-01-15`;
  let app: ReturnType<typeof createApp> | undefined;
  let runtime: Awaited<ReturnType<typeof startRuntime>> | undefined;
  try {
    const f = await freshPeopleFixture();
    runtime = await startRuntime();
    await adminPool.query(
      "GRANT projectx_staff_auth_runtime TO projectx_people_test_login",
    );
    for (const permission of [
      "reservation.read",
      "reservation.create",
      "reservation.update",
      "reservation.checkin",
      "reservation.seat",
      "reservation.cancel",
    ])
      await adminPool.query(
        `INSERT INTO projectx_test.venue_permission_grants(id,organization_id,venue_id,venue_access_id,permission_id,granted_by_user_id) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
        [
          newPeopleId(),
          f.orgA,
          f.a1,
          f.orgAdminAccess,
          permission,
          f.identities.orgA.user,
        ],
      );
    await adminPool.query(
      "INSERT INTO projectx_test.reservation_venue_settings(organization_id,venue_id,timezone,public_slug,public_booking_enabled) VALUES($1,$2,'UTC','oak-grill',true)",
      [f.orgA, f.a1],
    );
    await adminPool.query(
      "INSERT INTO projectx_test.reservation_tables(id,organization_id,venue_id,label,capacity,active) VALUES($1,$2,$3,'Test table',4,true)",
      [newPeopleId(), f.orgA, f.a1],
    );
    await adminPool.query(
      "INSERT INTO projectx_test.reservation_shifts VALUES($1,$2,$3,$4,720,1020,60,15,1,6)",
      [newPeopleId(), f.orgA, f.a1, date],
    );
    const store = postgresStaffStore(runtime);
    const credential = secret();
    const session = await store.issue(
      {
        issuer: "https://fixture.invalid",
        subject: "orgA",
        authenticatedAt: null,
      },
      hash(credential),
      null,
    );
    if (!session || "denial" in session)
      throw new Error("Synthetic staff session unavailable");
    const localConfig = { ...config, origin: "http://127.0.0.1:4173" };
    app = createApp(loadConfig({ NODE_ENV: "test", LOG_LEVEL: "silent" }), {
      staffAuth: {
        config: localConfig,
        store,
        runtimePool: runtime,
        oidc: {
          authorize: async () => {
            throw Error("Unexpected OIDC");
          },
          callback: async () => {
            throw Error("Unexpected OIDC");
          },
        },
      },
      publicReservations: {
        runtimePool: runtime,
        expectedHost: "127.0.0.1:4173",
      },
    });
    await app.listen({ host: "127.0.0.1", port: 3001 });
    let sentBody: string | null = null;
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        request.url().endsWith("/api/v1/public/venues/oak-grill/reservations")
      )
        sentBody = request.postData();
    });
    await page.goto("/book/oak-grill");
    await page.getByLabel("Date").fill(date);
    await page.getByRole("button", { name: "Find available times" }).click();
    const time = page.getByLabel("Time (UTC)");
    await expect(time).toBeVisible();
    const value = await time.locator("option").nth(1).getAttribute("value");
    if (!value) throw Error("No real availability");
    const raceValue = await time.locator("option").last().getAttribute("value");
    if (!raceValue || raceValue === value)
      throw Error("No independent race slot");
    await time.selectOption(value);
    await page.getByLabel("Name").fill("Synthetic Guest");
    await page.getByLabel("Email").fill("guest@example.invalid");
    await page.getByRole("button", { name: "Book reservation" }).click();
    await expect(
      page.getByRole("heading", { name: "Reservation booked" }),
    ).toBeVisible();
    if (!sentBody) throw Error("Missing guest submission");
    const apiResults = await page.evaluate(
      async ({ body, raceStart }) => {
        const payload = JSON.parse(body);
        const post = (input: unknown) =>
          fetch("/api/v1/public/venues/oak-grill/reservations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
          });
        const original = await post(payload);
        const replay = await original.json();
        const conflict = await post({ ...payload, partySize: 3 });
        const occupied = await post({
          ...payload,
          idempotencyKey: crypto.randomUUID(),
        });
        const race = await Promise.all([
          post({
            ...payload,
            startsAt: raceStart,
            idempotencyKey: crypto.randomUUID(),
          }),
          post({
            ...payload,
            startsAt: raceStart,
            idempotencyKey: crypto.randomUUID(),
          }),
        ]);
        const staff = await fetch("/api/v1/staff/reservations");
        const unknown = await fetch(
          `/api/v1/public/venues/other-venue/availability?date=${payload.date}&partySize=2`,
        );
        return {
          replay,
          original: original.status,
          conflict: conflict.status,
          occupied: occupied.status,
          race: race.map((x) => x.status).sort(),
          staff: staff.status,
          unknown: unknown.status,
        };
      },
      { body: sentBody, raceStart: raceValue },
    );
    expect(apiResults.original).toBe(201);
    expect(apiResults.replay.confirmationDelivery).toBe("NONE");
    expect(apiResults.conflict).toBe(409);
    expect(apiResults.occupied).toBe(409);
    expect(apiResults.race).toEqual([201, 409]);
    expect([401, 403]).toContain(apiResults.staff);
    expect(apiResults.unknown).toBe(404);
    const guestRows = await adminPool.query(
      "SELECT booking_source,created_by_user_id FROM projectx_test.reservations WHERE venue_id=$1",
      [f.a1],
    );
    expect(guestRows.rows).toHaveLength(2);
    expect(
      guestRows.rows.every(
        (row) =>
          row.booking_source === "PUBLIC_WIDGET" &&
          row.created_by_user_id === null,
      ),
    ).toBe(true);
    await context.addCookies([
      {
        name: SESSION_COOKIE,
        value: credential,
        domain: "127.0.0.1",
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
      },
    ]);
    await page.goto(`/manager/oceansatarthurs/reservations/day/${date}`);
    await expect(
      page.getByRole("heading", { name: "Reservations Day Book" }),
    ).toBeVisible();
    await expect(page.getByText("Synthetic Guest").first()).toBeVisible();
    const limited = await page.evaluate(async (day) => {
      let status = 0;
      for (let i = 0; i < 40; i++) {
        status = (
          await fetch(
            `/api/v1/public/venues/oak-grill/availability?date=${day}&partySize=2`,
          )
        ).status;
        if (status === 429) break;
      }
      return status;
    }, date);
    expect(limited).toBe(429);
  } finally {
    await app?.close();
    if (runtime) await stopRuntime();
    else await adminPool.end();
  }
});
