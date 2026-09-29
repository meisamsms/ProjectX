import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Pool } from "pg";
import { PeopleAccessDenied } from "../authorization/context.js";
import {
  listPeopleAccounts,
  type PeopleRosterScope,
  type RosterQuery,
} from "./list.js";

export interface PeopleAccountsReadDependencies {
  /** Server-side verified identity and selected organization. Never resolve from query/body. */
  readonly resolveTrustedScope: (
    request: FastifyRequest,
  ) => Promise<PeopleRosterScope | null>;
  /** A non-owner login inheriting projectx_people_runtime, never the migration pool. */
  readonly runtimePool: Pool;
}

const errorSchema = {
  type: "object",
  required: ["code", "message", "requestId"],
  additionalProperties: false,
  properties: {
    code: { type: "string" },
    message: { type: "string" },
    requestId: { type: "string" },
  },
} as const;
const responseSchema = {
  type: "object",
  required: ["items", "nextCursor"],
  additionalProperties: false,
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        required: [
          "id",
          "name",
          "jobTitle",
          "emailNotificationsEnabled",
          "accessLevels",
        ],
        additionalProperties: false,
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: ["string", "null"] },
          jobTitle: { type: ["string", "null"] },
          emailNotificationsEnabled: { type: ["boolean", "null"] },
          accessLevels: { type: "array", items: { type: "string" } },
        },
      },
    },
    nextCursor: { type: ["string", "null"] },
  },
} as const;
const allowedQueryKeys = new Set(["accessLevel", "cursor", "limit"]);

export function registerPeopleAccountsRead(
  app: FastifyInstance,
  dependencies?: PeopleAccountsReadDependencies,
) {
  app.get<{ Querystring: RosterQuery }>(
    "/api/v1/people/accounts",
    {
      schema: {
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            accessLevel: {
              type: "string",
              minLength: 1,
              maxLength: 120,
              pattern: "\\S",
            },
            cursor: { type: "string", format: "uuid" },
            limit: { type: "integer", minimum: 1, maximum: 100 },
          },
        },
        response: {
          200: responseSchema,
          400: errorSchema,
          401: errorSchema,
          403: errorSchema,
          500: errorSchema,
        },
      },
      preValidation: async (request, reply) => {
        // Fastify's default Ajv configuration removes unknown query keys before
        // additionalProperties can reject them. Check the raw URL at this route.
        const url = new URL(request.raw.url ?? "", "http://localhost");
        if (
          [...url.searchParams.keys()].some((key) => !allowedQueryKeys.has(key))
        )
          return reply.status(400).send({
            code: "INVALID_REQUEST",
            message: "Invalid request",
            requestId: request.id,
          });
      },
    },
    async (request, reply) => {
      if (!dependencies)
        return reply.status(401).send({
          code: "UNAUTHENTICATED",
          message: "Authentication required",
          requestId: request.id,
        });
      const scope = await dependencies.resolveTrustedScope(request);
      if (!scope)
        return reply.status(401).send({
          code: "UNAUTHENTICATED",
          message: "Authentication required",
          requestId: request.id,
        });
      try {
        return await listPeopleAccounts(
          dependencies.runtimePool,
          scope,
          request.query,
        );
      } catch (error) {
        if (!(error instanceof PeopleAccessDenied)) throw error;
        return reply.status(403).send({
          code: "FORBIDDEN",
          message: "People access denied",
          requestId: request.id,
        });
      }
    },
  );
}
