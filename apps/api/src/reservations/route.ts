import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Pool } from "pg";
import specification from "../../../../packages/contracts/openapi.json" with {
  type: "json",
};
import { PeopleAccessDenied } from "../people/authorization/context.js";
import {
  type AvailabilityQuery,
  type CreateReservation,
  type LifecycleTransition,
  type ModifyReservation,
  type ReservationScope,
  ReservationError,
  cancelReservation,
  checkInReservation,
  createReservation,
  getReservation,
  listReservations,
  modifyReservation,
  searchAvailability,
  seatReservation,
} from "./service.js";

export interface ReservationsDependencies {
  /** Server-side verified identity and selected venue; never resolved from query/body/headers. */
  readonly resolveTrustedScope: (
    request: FastifyRequest,
  ) => Promise<ReservationScope | null>;
  /** Non-owner login inheriting projectx_people_runtime. */
  readonly runtimePool: Pool;
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
      throw new Error("Unknown Staff Reservation contract");
    return expand(specification.components.schemas[key]);
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, expand(item)]),
  );
}

const schemas = specification.components.schemas;
const responses = {
  400: expand(schemas.ApiError),
  401: expand(schemas.ApiError),
  403: expand(schemas.ApiError),
  404: expand(schemas.ApiError),
  409: expand(schemas.ApiError),
  500: expand(schemas.ApiError),
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

function validRevision(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 2147483646
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
  "tableId",
  "shiftId",
  "startsAt",
  "guestName",
  "guestEmail",
  "idempotencyKey",
] as const;

const modifyKeys = [
  "expectedRevision",
  "idempotencyKey",
  "date",
  "startsAt",
  "tableId",
  "shiftId",
  "partySize",
] as const;

const transitionKeys = ["expectedRevision", "idempotencyKey"] as const;

export function registerReservations(
  app: FastifyInstance,
  dependencies?: ReservationsDependencies,
) {
  const base = "/api/v1/staff/reservations";
  const idParamSchema = {
    type: "object",
    required: ["id"],
    properties: { id: { type: "string", format: "uuid" } },
    additionalProperties: false,
  } as const;

  function error(
    reply: FastifyReply,
    request: FastifyRequest,
    status: number,
    code: string,
    message: string,
  ) {
    return reply.status(status).send({ code, message, requestId: request.id });
  }

  const invalid = (request: FastifyRequest, reply: FastifyReply) =>
    error(reply, request, 400, "INVALID_REQUEST", "Invalid request");

  async function execute(
    request: FastifyRequest,
    reply: FastifyReply,
    action: (scope: ReservationScope, pool: Pool) => Promise<unknown>,
    status = 200,
  ) {
    const scope = await dependencies?.resolveTrustedScope(request);
    if (!scope || !dependencies)
      return error(
        reply,
        request,
        401,
        "UNAUTHENTICATED",
        "Authentication required",
      );
    try {
      return reply
        .status(status)
        .send(await action(scope, dependencies.runtimePool));
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
            "Reservation capacity conflict",
          );
        if (caught.code === "IDEMPOTENCY_CONFLICT")
          return error(
            reply,
            request,
            409,
            "IDEMPOTENCY_CONFLICT",
            "Idempotency key conflict",
          );
        if (caught.code === "VERSION_CONFLICT")
          return error(
            reply,
            request,
            409,
            "VERSION_CONFLICT",
            "Reservation revision conflict",
          );
        if (caught.code === "INVALID_STATE")
          return error(
            reply,
            request,
            409,
            "INVALID_STATE",
            "Invalid reservation state transition",
          );
      }
      if (
        caught instanceof PeopleAccessDenied ||
        (typeof caught === "object" &&
          caught !== null &&
          "code" in caught &&
          caught.code === "42501")
      )
        return error(
          reply,
          request,
          403,
          "FORBIDDEN",
          "Reservation access denied",
        );
      request.log.error(
        { event: "staff.reservation.failed", requestId: request.id },
        "staff reservation request failed",
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

  app.get<{ Querystring: AvailabilityQuery }>(
    `${base}/availability`,
    {
      schema: {
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
          200: expand(schemas.StaffReservationAvailabilityResponse),
          ...responses,
        },
      },
      preValidation: async (request, reply) => {
        const query = new URL(request.raw.url ?? "", "http://localhost")
          .searchParams;
        const allowed = ["date", "partySize", "fromMinute", "toMinute"];
        const dateRaw = query.get("date");
        const partyRaw = query.get("partySize");
        const fromRaw = query.get("fromMinute");
        const toRaw = query.get("toMinute");
        if (
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
      execute(request, reply, async (scope, pool) => ({
        items: await searchAvailability(pool, scope, request.query),
      })),
  );

  app.get<{ Querystring: { date: string; limit?: number } }>(
    base,
    {
      schema: {
        querystring: {
          type: "object",
          additionalProperties: false,
          required: ["date"],
          properties: {
            date: { type: "string", pattern: "^20\\d{2}-\\d{2}-\\d{2}$" },
            limit: { type: "integer", minimum: 1, maximum: 500 },
          },
        },
        response: {
          200: expand(schemas.StaffReservationListResponse),
          ...responses,
        },
      },
      preValidation: async (request, reply) => {
        const query = new URL(request.raw.url ?? "", "http://localhost")
          .searchParams;
        const dateRaw = query.get("date");
        const limitRaw = query.get("limit");
        if (
          [...query.keys()].some(
            (key) =>
              !["date", "limit"].includes(key) ||
              query.getAll(key).length !== 1,
          ) ||
          !validDate(dateRaw) ||
          (limitRaw !== null &&
            (!/^[1-9][0-9]{0,2}$/.test(limitRaw) || Number(limitRaw) > 500))
        )
          return invalid(request, reply);
      },
    },
    (request, reply) =>
      execute(request, reply, async (scope, pool) => ({
        items: await listReservations(
          pool,
          scope,
          request.query.date,
          request.query.limit ?? 100,
        ),
      })),
  );

  app.post<{ Body: CreateReservation }>(
    base,
    {
      schema: {
        body: expand(schemas.CreateStaffReservationRequest),
        response: { 201: expand(schemas.StaffReservation), ...responses },
      },
      preValidation: async (request, reply) => {
        const body = request.body;
        if (
          new URL(request.raw.url ?? "", "http://localhost").search.length ||
          !isExactObject(body, createKeys) ||
          !validDate(body.date) ||
          !validPartySize(body.partySize) ||
          typeof body.tableId !== "string" ||
          !uuid.test(body.tableId) ||
          typeof body.shiftId !== "string" ||
          !uuid.test(body.shiftId) ||
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
        (scope, pool) => createReservation(pool, scope, request.body),
        201,
      ),
  );

  app.get<{ Params: { id: string } }>(
    `${base}/:id`,
    {
      schema: {
        params: idParamSchema,
        response: { 200: expand(schemas.StaffReservation), ...responses },
      },
      preValidation: async (request, reply) => {
        if (
          new URL(request.raw.url ?? "", "http://localhost").search.length ||
          !uuid.test(request.params.id)
        )
          return invalid(request, reply);
      },
    },
    (request, reply) =>
      execute(request, reply, (scope, pool) =>
        getReservation(pool, scope, request.params.id),
      ),
  );

  app.patch<{
    Params: { id: string };
    Body: Omit<ModifyReservation, "reservationId">;
  }>(
    `${base}/:id`,
    {
      schema: {
        params: idParamSchema,
        body: expand(schemas.ModifyStaffReservationRequest),
        response: { 200: expand(schemas.StaffReservation), ...responses },
      },
      preValidation: async (request, reply) => {
        const body = request.body;
        if (
          new URL(request.raw.url ?? "", "http://localhost").search.length ||
          !uuid.test(request.params.id) ||
          !isExactObject(body, modifyKeys) ||
          !validRevision(body.expectedRevision) ||
          typeof body.idempotencyKey !== "string" ||
          !uuid.test(body.idempotencyKey) ||
          !validDate(body.date) ||
          !validInstant(body.startsAt) ||
          typeof body.tableId !== "string" ||
          !uuid.test(body.tableId) ||
          typeof body.shiftId !== "string" ||
          !uuid.test(body.shiftId) ||
          !validPartySize(body.partySize)
        )
          return invalid(request, reply);
      },
    },
    (request, reply) =>
      execute(request, reply, (scope, pool) =>
        modifyReservation(pool, scope, {
          reservationId: request.params.id,
          ...request.body,
        }),
      ),
  );

  const validateTransition = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) => {
    const body = request.body;
    if (
      new URL(request.raw.url ?? "", "http://localhost").search.length ||
      !uuid.test(request.params.id) ||
      !isExactObject(body, transitionKeys) ||
      !validRevision(body.expectedRevision) ||
      typeof body.idempotencyKey !== "string" ||
      !uuid.test(body.idempotencyKey)
    )
      return invalid(request, reply);
  };

  app.post<{
    Params: { id: string };
    Body: Omit<LifecycleTransition, "reservationId">;
  }>(
    `${base}/:id/check-in`,
    {
      schema: {
        params: idParamSchema,
        body: expand(schemas.TransitionStaffReservationRequest),
        response: { 200: expand(schemas.StaffReservation), ...responses },
      },
      preValidation: validateTransition,
    },
    (request, reply) =>
      execute(request, reply, (scope, pool) =>
        checkInReservation(pool, scope, {
          reservationId: request.params.id,
          ...request.body,
        }),
      ),
  );

  app.post<{
    Params: { id: string };
    Body: Omit<LifecycleTransition, "reservationId">;
  }>(
    `${base}/:id/seat`,
    {
      schema: {
        params: idParamSchema,
        body: expand(schemas.TransitionStaffReservationRequest),
        response: { 200: expand(schemas.StaffReservation), ...responses },
      },
      preValidation: validateTransition,
    },
    (request, reply) =>
      execute(request, reply, (scope, pool) =>
        seatReservation(pool, scope, {
          reservationId: request.params.id,
          ...request.body,
        }),
      ),
  );

  app.post<{ Params: { id: string } }>(
    `${base}/:id/cancel`,
    {
      schema: {
        params: idParamSchema,
        response: { 200: expand(schemas.StaffReservation), ...responses },
      },
      preValidation: async (request, reply) => {
        const body = request.body;
        if (
          new URL(request.raw.url ?? "", "http://localhost").search.length ||
          !uuid.test(request.params.id) ||
          (body !== undefined &&
            (typeof body !== "object" ||
              body === null ||
              Array.isArray(body) ||
              Object.keys(body).length > 0))
        )
          return invalid(request, reply);
      },
    },
    (request, reply) =>
      execute(request, reply, (scope, pool) =>
        cancelReservation(pool, scope, request.params.id),
      ),
  );
}
