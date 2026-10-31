import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Pool } from "pg";
import specification from "../../../../packages/contracts/openapi.json" with {
  type: "json",
};
import {
  type CreatePublicReservation,
  createPublicReservation,
  type PublicAvailabilityQuery,
  ReservationError,
  searchPublicAvailability,
} from "./service.js";

export interface PublicReservationsRateLimitConfig {
  readonly maxRequests?: number;
  readonly windowMs?: number;
  readonly now?: () => number;
}

export interface PublicReservationsDependencies {
  /** Non-owner login inheriting projectx_people_runtime. */
  readonly runtimePool: Pool;
  /** Required canonical Host authority (e.g. from staffAuth.config.origin). */
  readonly expectedHost: string;
  /** Per-IP + venueSlug rate-limit configuration. */
  readonly rateLimit?: PublicReservationsRateLimitConfig;
}

function expand(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(expand);
  if (typeof value !== "object" || value === null) return value;
  if ("$ref" in value && typeof value.$ref === "string") {
    const key = value.$ref.replace(
      "#/components/schemas/",
      "",
    ) as keyof typeof specification.components.schemas;
    if (!(key in specification.components.schemas))
      throw new Error("Unknown Public Reservation contract");
    return expand(specification.components.schemas[key]);
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, expand(item)]),
  );
}

const schemas = specification.components.schemas;
const responses = {
  400: expand(schemas.ApiError),
  403: expand(schemas.ApiError),
  404: expand(schemas.ApiError),
  409: expand(schemas.ApiError),
  429: expand(schemas.ApiError),
  500: expand(schemas.ApiError),
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const hostPattern = /^[a-zA-Z0-9.-]+(?::[0-9]{1,5})?$/;

function validSlug(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 3 &&
    value.length <= 64 &&
    slugPattern.test(value)
  );
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^20\d{2}-\d{2}-\d{2}$/.test(value))
    return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function validInstant(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.000)?Z$/.test(value)
  )
    return false;
  const parsed = new Date(value);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString() ===
      value.replace(/Z$/, value.includes(".") ? "Z" : ".000Z")
  );
}

function validPartySize(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 50
  );
}

function validText(value: unknown, max: number): string | null {
  if (
    typeof value !== "string" ||
    value.length > max * 2 ||
    Array.from(value).some((character) => {
      const code = character.codePointAt(0) ?? 0;
      return (
        code < 32 ||
        (code >= 127 && code <= 159) ||
        (code >= 0xd800 && code <= 0xdfff)
      );
    })
  )
    return null;
  const normalized = value.trim();
  if (!normalized || Array.from(normalized).length > max) return null;
  return normalized;
}

function validEmail(value: unknown): boolean {
  const normalized = validText(value, 254);
  return normalized !== null && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

function isExactObject(
  body: unknown,
  keys: readonly string[],
): body is Record<string, unknown> {
  if (typeof body !== "object" || body === null || Array.isArray(body))
    return false;
  const present = Object.keys(body);
  return (
    present.length === keys.length &&
    present.every((key) => keys.includes(key)) &&
    keys.every((key) => key in body)
  );
}

const createKeys = [
  "date",
  "partySize",
  "startsAt",
  "guestName",
  "guestEmail",
  "idempotencyKey",
] as const;

const slugParamSchema = {
  type: "object",
  required: ["venueSlug"],
  properties: {
    venueSlug: {
      type: "string",
      minLength: 3,
      maxLength: 64,
      pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
    },
  },
  additionalProperties: false,
} as const;

export function registerPublicReservations(
  app: FastifyInstance,
  dependencies?: PublicReservationsDependencies,
) {
  const base = "/api/v1/public/venues/:venueSlug";
  const maxRequests = dependencies?.rateLimit?.maxRequests ?? 30;
  const windowMs = dependencies?.rateLimit?.windowMs ?? 60_000;
  const now = dependencies?.rateLimit?.now ?? (() => Date.now());
  const buckets = new Map<string, { tokens: number; updatedAt: number }>();
  if (
    !Number.isInteger(maxRequests) ||
    maxRequests < 1 ||
    !Number.isFinite(windowMs) ||
    windowMs <= 0
  )
    throw new Error("Invalid public rate limit configuration");
  const expectedHost = dependencies?.expectedHost;
  let canonicalHost: string | undefined;
  try {
    if (expectedHost && hostPattern.test(expectedHost)) {
      const parsed = new URL(`https://${expectedHost}`);
      if (parsed.host.toLowerCase() === expectedHost.toLowerCase())
        canonicalHost = parsed.host.toLowerCase();
    }
  } catch {
    /* Invalid configuration fails closed for every request. */
  }

  function setHeaders(reply: FastifyReply) {
    reply
      .header("Cache-Control", "no-store")
      .header("Referrer-Policy", "no-referrer");
  }

  app.addHook("onSend", async (request, reply) => {
    if (request.raw.url?.startsWith("/api/v1/public/")) {
      setHeaders(reply);
    }
  });

  function error(
    reply: FastifyReply,
    request: FastifyRequest,
    status: number,
    code: string,
    message: string,
  ) {
    setHeaders(reply);
    return reply.status(status).send({ code, message, requestId: request.id });
  }

  const invalid = (request: FastifyRequest, reply: FastifyReply) =>
    error(reply, request, 400, "INVALID_REQUEST", "Invalid request");

  function verifyRequestBoundary(
    request: FastifyRequest<{ Params: { venueSlug: string } }>,
    reply: FastifyReply,
  ): boolean {
    setHeaders(reply);
    if (
      request.headers["x-forwarded-host"] !== undefined ||
      request.headers.forwarded !== undefined
    ) {
      error(reply, request, 403, "FORBIDDEN", "Forbidden request host");
      return false;
    }
    const host = request.headers.host;
    if (
      !canonicalHost ||
      typeof host !== "string" ||
      !hostPattern.test(host) ||
      host.toLowerCase() !== canonicalHost ||
      request.raw.rawHeaders.filter(
        (_, index) =>
          index % 2 === 0 &&
          request.raw.rawHeaders[index]?.toLowerCase() === "host",
      ).length !== 1 ||
      (request.headers[":authority"] !== undefined &&
        request.headers[":authority"] !== host)
    ) {
      error(reply, request, 403, "FORBIDDEN", "Forbidden request host");
      return false;
    }
    const origin = request.headers.origin;
    if (origin !== undefined) {
      if (typeof origin !== "string") {
        error(reply, request, 403, "FORBIDDEN", "Forbidden request origin");
        return false;
      }
      try {
        const parsed = new URL(origin);
        if (
          !["http:", "https:"].includes(parsed.protocol) ||
          parsed.origin !== origin ||
          parsed.host.toLowerCase() !== canonicalHost
        ) {
          error(reply, request, 403, "FORBIDDEN", "Forbidden request origin");
          return false;
        }
      } catch {
        error(reply, request, 403, "FORBIDDEN", "Forbidden request origin");
        return false;
      }
    }
    const rawSlug = request.params?.venueSlug;
    const slugKey = validSlug(rawSlug) ? rawSlug : "__invalid__";
    const currentTime = now();
    const key = `${request.ip}:${slugKey}`;
    if (!buckets.has(key) && buckets.size >= 4096) {
      for (const [key, bucket] of buckets) {
        // Only fully refilled buckets can be discarded without granting extra tokens.
        if (
          bucket.tokens +
            (Math.max(0, currentTime - bucket.updatedAt) * maxRequests) /
              windowMs >=
          maxRequests
        )
          buckets.delete(key);
      }
      if (buckets.size >= 4096) {
        error(reply, request, 429, "RATE_LIMITED", "Too many requests");
        return false;
      }
    }
    const current = buckets.get(key);
    const tokens = current
      ? Math.min(
          maxRequests,
          current.tokens +
            (Math.max(0, currentTime - current.updatedAt) * maxRequests) /
              windowMs,
        )
      : maxRequests;
    buckets.set(key, {
      tokens: Math.max(0, tokens - (tokens >= 1 ? 1 : 0)),
      updatedAt: Math.max(current?.updatedAt ?? currentTime, currentTime),
    });
    if (tokens < 1) {
      error(reply, request, 429, "RATE_LIMITED", "Too many requests");
      return false;
    }
    return true;
  }

  async function execute(
    request: FastifyRequest,
    reply: FastifyReply,
    action: (pool: Pool) => Promise<unknown>,
    status = 200,
  ) {
    if (!dependencies?.runtimePool)
      return error(
        reply,
        request,
        500,
        "INTERNAL_ERROR",
        "An unexpected error occurred",
      );
    try {
      setHeaders(reply);
      return reply.status(status).send(await action(dependencies.runtimePool));
    } catch (caught) {
      if (caught instanceof ReservationError) {
        if (caught.code === "INVALID_INPUT") return invalid(request, reply);
        if (caught.code === "ACCESS_DENIED")
          return error(
            reply,
            request,
            403,
            "FORBIDDEN",
            "Reservation access denied",
          );
        if (caught.code === "NOT_FOUND")
          return error(reply, request, 404, "NOT_FOUND", "Resource not found");
        if (caught.code === "CAPACITY_CONFLICT")
          return error(
            reply,
            request,
            409,
            "CAPACITY_CONFLICT",
            "Selected time is no longer available",
          );
        if (caught.code === "IDEMPOTENCY_CONFLICT")
          return error(
            reply,
            request,
            409,
            "IDEMPOTENCY_CONFLICT",
            "Idempotency key conflict",
          );
      }
      request.log.error(
        { event: "public.reservation.failed", requestId: request.id },
        "public reservation request failed",
      );
      return error(
        reply,
        request,
        500,
        "INTERNAL_ERROR",
        "An unexpected error occurred",
      );
    }
  }

  app.get<{
    Params: { venueSlug: string };
    Querystring: Omit<PublicAvailabilityQuery, "venueSlug">;
  }>(
    `${base}/availability`,
    {
      schema: {
        params: slugParamSchema,
        querystring: {
          type: "object",
          additionalProperties: false,
          required: ["date", "partySize"],
          properties: {
            date: { type: "string", pattern: "^20\\d{2}-\\d{2}-\\d{2}$" },
            partySize: { type: "integer", minimum: 1, maximum: 50 },
            fromMinute: { type: "integer", minimum: 0, maximum: 1439 },
            toMinute: { type: "integer", minimum: 1, maximum: 1440 },
          },
        },
        response: {
          200: expand(schemas.PublicReservationAvailabilityResponse),
          400: responses[400],
          403: responses[403],
          404: responses[404],
          429: responses[429],
          500: responses[500],
        },
      },
      preValidation: async (request, reply) => {
        if (!verifyRequestBoundary(request, reply)) return;
        const query = new URL(request.raw.url ?? "", "http://localhost")
          .searchParams;
        const allowed = ["date", "partySize", "fromMinute", "toMinute"];
        const dateRaw = query.get("date");
        const partyRaw = query.get("partySize");
        const fromRaw = query.get("fromMinute");
        const toRaw = query.get("toMinute");
        if (
          !validSlug(request.params.venueSlug) ||
          [...query.keys()].some(
            (key) => !allowed.includes(key) || query.getAll(key).length !== 1,
          ) ||
          !validDate(dateRaw) ||
          !partyRaw ||
          !/^(?:[1-9]|[1-4][0-9]|50)$/.test(partyRaw) ||
          (fromRaw !== null &&
            (!/^(?:0|[1-9][0-9]{0,3})$/.test(fromRaw) ||
              Number(fromRaw) > 1439)) ||
          (toRaw !== null &&
            (!/^[1-9][0-9]{0,3}$/.test(toRaw) || Number(toRaw) > 1440)) ||
          (fromRaw !== null ? Number(fromRaw) : 0) >=
            (toRaw !== null ? Number(toRaw) : 1440)
        )
          return invalid(request, reply);
      },
    },
    (request, reply) =>
      execute(request, reply, (pool) =>
        searchPublicAvailability(pool, {
          venueSlug: request.params.venueSlug,
          ...request.query,
        }),
      ),
  );

  app.post<{
    Params: { venueSlug: string };
    Body: Omit<CreatePublicReservation, "venueSlug">;
  }>(
    `${base}/reservations`,
    {
      schema: {
        params: slugParamSchema,
        body: expand(schemas.CreatePublicReservationRequest),
        response: {
          201: expand(schemas.PublicReservationConfirmation),
          ...responses,
        },
      },
      preValidation: async (request, reply) => {
        if (!verifyRequestBoundary(request, reply)) return;
        const body = request.body;
        if (
          !validSlug(request.params.venueSlug) ||
          new URL(request.raw.url ?? "", "http://localhost").search.length ||
          !isExactObject(body, createKeys) ||
          !validDate(body.date) ||
          !validPartySize(body.partySize) ||
          !validInstant(body.startsAt) ||
          validText(body.guestName, 120) === null ||
          !validEmail(body.guestEmail) ||
          typeof body.idempotencyKey !== "string" ||
          !uuid.test(body.idempotencyKey)
        )
          return invalid(request, reply);
      },
    },
    (request, reply) =>
      execute(
        request,
        reply,
        (pool) =>
          createPublicReservation(pool, {
            venueSlug: request.params.venueSlug,
            ...request.body,
          }),
        201,
      ),
  );
}
