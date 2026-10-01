import type { components } from "@projectx/contracts/api";
import type { FastifyInstance } from "fastify";
import {
  PeopleAccessDenied,
  withAuthorizedPeopleTransaction,
} from "../authorization/context.js";
import type { PeopleAddUserDependencies } from "./route.js";
import { apiErrorSchema, optionsResponseSchema } from "./schema.js";

export function registerPeopleAddUserOptions(
  app: FastifyInstance,
  dependencies?: PeopleAddUserDependencies,
) {
  app.get(
    "/api/v1/people/accounts/options",
    {
      schema: {
        response: {
          200: optionsResponseSchema,
          400: apiErrorSchema,
          401: apiErrorSchema,
          403: apiErrorSchema,
          500: apiErrorSchema,
        },
      },
      preValidation: async (request, reply) => {
        if (
          new URL(request.raw.url ?? "", "http://localhost").searchParams.size >
          0
        )
          return reply.status(400).send({
            code: "INVALID_REQUEST",
            message: "Invalid request",
            requestId: request.id,
          });
      },
    },
    async (request, reply) => {
      const scope = await dependencies?.resolveTrustedScope(request);
      if (!dependencies || !scope)
        return reply.status(401).send({
          code: "UNAUTHENTICATED",
          message: "Authentication required",
          requestId: request.id,
        });
      try {
        return await withAuthorizedPeopleTransaction(
          dependencies.runtimePool,
          scope.identity,
          { organizationId: scope.organizationId, permissionId: "user.manage" },
          async (client) => {
            const result = await client.query<{
              options: components["schemas"]["PeopleAddUserOptions"];
            }>("SELECT people_add_user_options() options");
            if (!result.rows[0]) throw new Error("Missing People options");
            return result.rows[0].options;
          },
        );
      } catch (error) {
        if (
          error instanceof PeopleAccessDenied ||
          (typeof error === "object" &&
            error !== null &&
            "code" in error &&
            error.code === "42501")
        )
          return reply.status(403).send({
            code: "FORBIDDEN",
            message: "People access denied",
            requestId: request.id,
          });
        throw error;
      }
    },
  );
}
