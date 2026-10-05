import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Pool } from "pg";
import { bindVerifiedPeopleIdentity } from "../people/authorization/context.js";
import type { StaffAuthConfig } from "./config.js";
import {
  cookieCredential,
  csrfFor,
  equalSecret,
  hash,
  LOGIN_COOKIE,
  secret,
  secureCookie,
  SESSION_COOKIE,
} from "./credentials.js";
import type { StaffOidc } from "./oidc.js";
import type { StaffSession, StaffSessionStore } from "./store.js";

export interface StaffAuthDependencies {
  readonly config: StaffAuthConfig;
  readonly oidc: StaffOidc;
  readonly store: StaffSessionStore;
  readonly runtimePool: Pool;
}
export function registerStaffAuth(
  app: FastifyInstance,
  deps: StaffAuthDependencies,
) {
  const sessions = new WeakMap<FastifyRequest, StaffSession>();
  const base = "/api/v1/staff-auth";
  const fail = (req: FastifyRequest, reply: FastifyReply, status: number) =>
    reply.code(status).send({
      code:
        status === 401
          ? "UNAUTHENTICATED"
          : status === 409
            ? "CONFLICT"
            : status === 400
              ? "INVALID_REQUEST"
              : "FORBIDDEN",
      message:
        status === 401
          ? "Authentication required"
          : status === 409
            ? "Session context changed"
            : "Request denied",
      requestId: req.id,
    });
  const credential = (req: FastifyRequest) =>
    cookieCredential(req.headers.cookie, SESSION_COOKIE);
  function originAllowed(req: FastifyRequest): boolean {
    if (req.headers.origin !== undefined)
      return req.headers.origin === deps.config.origin;
    try {
      return (
        typeof req.headers.referer === "string" &&
        new URL(req.headers.referer).origin === deps.config.origin
      );
    } catch {
      return false;
    }
  }
  function csrfAllowed(req: FastifyRequest, cookie: string): boolean {
    const token = req.headers["x-projectx-csrf"];
    return (
      originAllowed(req) &&
      typeof token === "string" &&
      /^[0-9a-f]{64}$/.test(token) &&
      equalSecret(token, csrfFor(cookie))
    );
  }
  app.addHook("onRequest", async (req, reply) => {
    const path = (req.raw.url ?? "").split("?")[0] ?? "";
    if (!path.startsWith("/api/v1/people/") && !path.startsWith(base)) return;
    reply
      .header("Cache-Control", "no-store")
      .header("Referrer-Policy", "no-referrer");
    if (
      req.headers.host !== new URL(deps.config.origin).host ||
      req.headers["x-forwarded-host"] !== undefined
    )
      return fail(req, reply, 403);
    if (path === `${base}/login` || path === `${base}/callback`) return;
    const cookie = credential(req);
    if (!cookie) return fail(req, reply, 401);
    const session = await deps.store.read(hash(cookie), false);
    // Idempotent local logout still requires a well-formed credential and session-bound CSRF.
    if (!session && path === `${base}/logout` && req.method === "POST") {
      if (!csrfAllowed(req, cookie)) return fail(req, reply, 403);
      return;
    }
    if (!session || "denial" in session) {
      reply.header("Set-Cookie", secureCookie(SESSION_COOKIE, "", true));
      return fail(
        req,
        reply,
        session && "denial" in session && session.denial === "DISABLED"
          ? 403
          : 401,
      );
    }
    sessions.set(req, session);
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      if (!csrfAllowed(req, cookie)) return fail(req, reply, 403);
      if (!path.startsWith(base)) {
        const version = req.headers["x-projectx-context-version"];
        if (
          typeof version !== "string" ||
          !/^[1-9][0-9]*$/.test(version) ||
          Number(version) !== session.contextVersion
        )
          return fail(req, reply, 409);
        // Provider assurance mapping has no controlled verification yet. High-risk writes fail closed.
        if (req.method === "POST" && path === "/api/v1/people/accounts")
          return fail(req, reply, 403);
      }
    }
    if (path.startsWith("/api/v1/people/")) {
      if (
        !session.organizationId ||
        ((path.includes("booked-by-names") || path.includes("server-names")) &&
          !session.venueId)
      )
        return fail(req, reply, 403);
    }
  });
  app.addHook("onResponse", async (req, reply) => {
    // GET polling is not interactive activity. Expiry cannot be extended beyond absolute limit.
    if (
      ["POST", "PUT", "PATCH", "DELETE"].includes(req.method) &&
      reply.statusCode < 400 &&
      sessions.has(req)
    ) {
      // Only successful mutations may refresh idle activity; logout stays revoked.
      const cookie = credential(req);
      if (cookie) {
        try {
          await deps.store.read(hash(cookie), true);
        } catch {
          req.log.warn(
            { event: "staff.activity.store_unavailable", requestId: req.id },
            "staff authentication",
          );
        }
      }
    }
  });
  app.get(`${base}/login`, async (req, reply) => {
    if (new URL(req.raw.url ?? "", deps.config.origin).search)
      return fail(req, reply, 400);
    const transaction = {
      state: secret(),
      nonce: secret(),
      verifier: secret(),
    };
    const browser = secret();
    const url = await deps.oidc.authorize(transaction);
    await deps.store.startLogin(hash(browser), transaction);
    reply.header("Set-Cookie", secureCookie(LOGIN_COOKIE, browser));
    req.log.info(
      { event: "staff.login.started", requestId: req.id },
      "staff authentication",
    );
    return reply.redirect(url);
  });
  app.get(`${base}/callback`, async (req, reply) => {
    const browser = cookieCredential(req.headers.cookie, LOGIN_COOKIE);
    reply.header("Set-Cookie", secureCookie(LOGIN_COOKIE, "", true));
    try {
      if (!browser) return fail(req, reply, 401);
      const transaction = await deps.store.consumeLogin(hash(browser));
      if (!transaction) return fail(req, reply, 401);
      const url = new URL(req.raw.url ?? "", deps.config.origin);
      if (
        [...url.searchParams.keys()].some(
          (k) =>
            !["code", "state", "iss", "error", "error_description"].includes(
              k,
            ) || url.searchParams.getAll(k).length !== 1,
        )
      )
        return fail(req, reply, 401);
      const proof = await deps.oidc.callback(url, transaction);
      const next = secret(),
        old = credential(req);
      const session = await deps.store.issue(
        proof,
        hash(next),
        old ? hash(old) : null,
      );
      if (!session || "denial" in session) return fail(req, reply, 403);
      reply.header("Set-Cookie", [
        secureCookie(LOGIN_COOKIE, "", true),
        secureCookie(SESSION_COOKIE, next),
      ]);
      req.log.info(
        {
          event: "staff.login.succeeded",
          requestId: req.id,
          userId: session.userId,
        },
        "staff authentication",
      );
      return reply.redirect(`${deps.config.origin}/`);
    } catch {
      req.log.warn(
        { event: "staff.login.denied", requestId: req.id },
        "staff authentication",
      );
      return fail(req, reply, 401);
    }
  });
  app.get(`${base}/session`, async (req, reply) => {
    const session = sessions.get(req),
      cookie = credential(req);
    if (!session || !cookie) return fail(req, reply, 401);
    return { ...session, csrfToken: csrfFor(cookie) };
  });
  app.post(`${base}/logout`, async (req, reply) => {
    const cookie = credential(req);
    if (!cookie) return fail(req, reply, 401);
    await deps.store.revoke(hash(cookie));
    reply.header("Set-Cookie", secureCookie(SESSION_COOKIE, "", true));
    req.log.info(
      { event: "staff.logout.succeeded", requestId: req.id },
      "staff authentication",
    );
    return reply.code(204).send();
  });
  app.post<{
    Body: {
      organizationId: string;
      venueId: string | null;
      contextVersion: number;
    };
  }>(
    `${base}/context`,
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          required: ["organizationId", "venueId", "contextVersion"],
          properties: {
            organizationId: { type: "string", format: "uuid" },
            venueId: {
              anyOf: [{ type: "string", format: "uuid" }, { type: "null" }],
            },
            contextVersion: { type: "integer", minimum: 1 },
          },
        },
      },
      preValidation: async (req, reply) => {
        if (
          typeof req.body !== "object" ||
          req.body === null ||
          Object.keys(req.body).some(
            (k) => !["organizationId", "venueId", "contextVersion"].includes(k),
          )
        )
          return fail(req, reply, 400);
      },
    },
    async (req, reply) => {
      const cookie = credential(req);
      if (!cookie) return fail(req, reply, 401);
      const result = await deps.store.switch(
        hash(cookie),
        req.body.organizationId,
        req.body.venueId,
        req.body.contextVersion,
      );
      if (!result) return fail(req, reply, 401);
      if ("denial" in result)
        return fail(req, reply, result.denial === "STALE" ? 409 : 403);
      req.log.info(
        {
          event: "staff.context.changed",
          requestId: req.id,
          userId: result.userId,
        },
        "staff authentication",
      );
      return { ...result, csrfToken: csrfFor(cookie) };
    },
  );
  return {
    async resolveOrganization(req: FastifyRequest) {
      const s = sessions.get(req);
      return s?.organizationId
        ? {
            identity: bindVerifiedPeopleIdentity(s.userId),
            organizationId: s.organizationId,
          }
        : null;
    },
    async resolveVenue(req: FastifyRequest) {
      const s = sessions.get(req);
      return s?.organizationId && s.venueId
        ? {
            identity: bindVerifiedPeopleIdentity(s.userId),
            organizationId: s.organizationId,
            venueId: s.venueId,
          }
        : null;
    },
  };
}
