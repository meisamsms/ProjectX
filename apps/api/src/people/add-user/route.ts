import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Pool } from "pg";
import { PeopleAccessDenied } from "../authorization/context.js";
import {
  type AddUserRequest,
  type AddUserScope,
  createPendingPeopleAccount,
  PeopleCreateConflict,
  PeopleCreateInvalid,
} from "./create.js";

export interface PeopleAddUserDependencies {
  /** Server-side verified identity and selected organization. Never resolve from body. */
  readonly resolveTrustedScope: (
    request: FastifyRequest,
  ) => Promise<AddUserScope | null>;
  /** A non-owner login inheriting projectx_people_runtime. */
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
const nullableText = {
  anyOf: [
    { type: "string", minLength: 1, maxLength: 120, pattern: "\\S" },
    { type: "null" },
  ],
} as const;
const uuidArray = {
  type: "array",
  minItems: 1,
  maxItems: 50,
  uniqueItems: true,
  items: { type: "string", format: "uuid" },
} as const;
const allowedBodyKeys = new Set([
  "email",
  "firstName",
  "lastName",
  "jobTitle",
  "emailNotificationsEnabled",
  "suspended",
  "organizationRoleIds",
  "venues",
]);

export function registerPeopleAddUser(
  app: FastifyInstance,
  dependencies?: PeopleAddUserDependencies,
) {
  app.post<{
    Body: AddUserRequest;
    Headers: { "idempotency-key"?: string };
  }>(
    "/api/v1/people/accounts",
    {
      schema: {
        headers: {
          type: "object",
          required: ["idempotency-key"],
          properties: {
            "idempotency-key": {
              type: "string",
              minLength: 8,
              maxLength: 128,
              pattern: "^[A-Za-z0-9._:-]+$",
            },
          },
        },
        body: {
          type: "object",
          additionalProperties: false,
          required: [
            "email",
            "firstName",
            "lastName",
            "jobTitle",
            "emailNotificationsEnabled",
            "suspended",
            "organizationRoleIds",
            "venues",
          ],
          properties: {
            email: { type: "string", format: "email", maxLength: 254 },
            firstName: nullableText,
            lastName: nullableText,
            jobTitle: nullableText,
            emailNotificationsEnabled: {
              type: ["boolean", "null"],
            },
            suspended: { type: "boolean" },
            organizationRoleIds: uuidArray,
            venues: {
              type: "array",
              maxItems: 50,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["venueId", "roleIds"],
                properties: {
                  venueId: { type: "string", format: "uuid" },
                  roleIds: uuidArray,
                },
              },
            },
          },
        },
        response: {
          201: {
            type: "object",
            additionalProperties: false,
            required: ["provisioningId", "userId", "membershipId", "status"],
            properties: {
              provisioningId: { type: "string", format: "uuid" },
              userId: { type: "string", format: "uuid" },
              membershipId: { type: "string", format: "uuid" },
              status: { type: "string", const: "PENDING" },
            },
          },
          400: errorSchema,
          401: errorSchema,
          403: errorSchema,
          409: errorSchema,
          500: errorSchema,
        },
      },
      preValidation: async (request, reply) => {
        const url = new URL(request.raw.url ?? "", "http://localhost");
        const body = request.body;
        if (
          [...url.searchParams.keys()].length > 0 ||
          typeof body !== "object" ||
          body === null ||
          Array.isArray(body) ||
          Object.keys(body).some((key) => !allowedBodyKeys.has(key))
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
        const created = await createPendingPeopleAccount(
          dependencies.runtimePool,
          scope,
          request.body,
          request.headers["idempotency-key"] ?? "",
        );
        return reply.status(201).send(created);
      } catch (error) {
        if (error instanceof PeopleCreateInvalid)
          return reply.status(400).send({
            code: "INVALID_REQUEST",
            message: "Invalid request",
            requestId: request.id,
          });
        if (error instanceof PeopleAccessDenied)
          return reply.status(403).send({
            code: "FORBIDDEN",
            message: "People access denied",
            requestId: request.id,
          });
        if (error instanceof PeopleCreateConflict)
          return reply.status(409).send({
            code: "CONFLICT",
            message: "Account provisioning conflict",
            requestId: request.id,
          });
        throw error;
      }
    },
  );
}
