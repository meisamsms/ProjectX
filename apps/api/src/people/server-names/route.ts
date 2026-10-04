import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { Pool } from "pg";
import specification from "../../../../../packages/contracts/openapi.json" with {
  type: "json",
};
import { PeopleAccessDenied } from "../authorization/context.js";
import {
  type AddNameRequest,
  type UpdateNameRequest,
  type ListNamesQuery,
  type UpdateNamePath,
  type ServerScope,
  addServerName,
  listServerNames,
  updateServerName,
  ServerConflict,
  ServerInvalid,
  ServerNotFound,
  normalizeServerName,
} from "./service.js";

export interface PeopleServerDependencies {
  /** Server-side verified identity and selected venue; never a request DTO. */
  readonly resolveTrustedScope: (
    request: FastifyRequest,
  ) => Promise<ServerScope | null>;
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
      throw new Error("Unknown Server Names contract");
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
export function registerPeopleServer(
  app: FastifyInstance,
  dependencies?: PeopleServerDependencies,
) {
  const base = "/api/v1/people/server-names";
  function error(
    reply: FastifyReply,
    request: FastifyRequest,
    status: number,
    code: string,
    message: string,
  ) {
    return reply.status(status).send({ code, message, requestId: request.id });
  }
  const invalid = (
    request: FastifyRequest,
    reply: Parameters<typeof error>[0],
  ) => error(reply, request, 400, "INVALID_REQUEST", "Invalid request");
  async function execute(
    request: FastifyRequest,
    reply: Parameters<typeof error>[0],
    action: (scope: ServerScope, pool: Pool) => Promise<unknown>,
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
      if (caught instanceof ServerInvalid) return invalid(request, reply);
      if (
        caught instanceof PeopleAccessDenied ||
        (typeof caught === "object" &&
          caught !== null &&
          "code" in caught &&
          caught.code === "42501")
      )
        return error(reply, request, 403, "FORBIDDEN", "People access denied");
      if (caught instanceof ServerNotFound)
        return error(reply, request, 404, "NOT_FOUND", "Resource not found");
      if (caught instanceof ServerConflict)
        return error(
          reply,
          request,
          409,
          "CONFLICT",
          "Display name version conflict",
        );
      throw caught;
    }
  }
  app.get<{ Querystring: ListNamesQuery }>(
    base,
    {
      schema: {
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            limit: { type: "integer", minimum: 1, maximum: 100 },
            cursor: { type: "string", format: "uuid" },
          },
        },
        response: { 200: expand(schemas.ServerNameList), ...responses },
      },
      preValidation: async (request, reply) => {
        const query = new URL(request.raw.url ?? "", "http://localhost")
          .searchParams;
        if (
          [...query.keys()].some(
            (key) =>
              !["limit", "cursor"].includes(key) ||
              query.getAll(key).length !== 1,
          ) ||
          (query.has("limit") &&
            !/^(?:[1-9][0-9]?|100)$/.test(query.get("limit") ?? "")) ||
          (query.has("cursor") && !uuid.test(query.get("cursor") ?? ""))
        )
          return invalid(request, reply);
      },
    },
    (request, reply) =>
      execute(request, reply, (scope, pool) =>
        listServerNames(pool, scope, request.query),
      ),
  );
  const validateBody =
    (update: boolean) =>
    async (request: FastifyRequest, reply: Parameters<typeof error>[0]) => {
      const body = request.body;
      if (
        new URL(request.raw.url ?? "", "http://localhost").search.length ||
        typeof body !== "object" ||
        body === null ||
        Array.isArray(body) ||
        Object.keys(body).some(
          (key) =>
            !(update ? ["displayName", "version"] : ["displayName"]).includes(
              key,
            ),
        ) ||
        !("displayName" in body) ||
        (update && (!("version" in body) || typeof body.version !== "number"))
      )
        return invalid(request, reply);
      try {
        normalizeServerName(body.displayName);
      } catch {
        return invalid(request, reply);
      }
    };
  app.post<{ Body: AddNameRequest }>(
    base,
    {
      schema: {
        body: expand(schemas.AddServerNameRequest),
        response: { 201: expand(schemas.ServerName), ...responses },
      },
      preValidation: validateBody(false),
    },
    (request, reply) =>
      execute(
        request,
        reply,
        (scope, pool) => addServerName(pool, scope, request.body, request.id),
        201,
      ),
  );
  app.patch<{ Body: UpdateNameRequest; Params: UpdateNamePath }>(
    `${base}/:id`,
    {
      schema: {
        body: expand(schemas.UpdateServerNameRequest),
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", format: "uuid" } },
          additionalProperties: false,
        },
        response: { 200: expand(schemas.ServerName), ...responses },
      },
      preValidation: validateBody(true),
    },
    (request, reply) =>
      execute(request, reply, (scope, pool) =>
        updateServerName(
          pool,
          scope,
          request.params.id,
          request.body,
          request.id,
        ),
      ),
  );
}
