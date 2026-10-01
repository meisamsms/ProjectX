import Fastify, { type FastifyInstance } from "fastify";
import type { Config } from "./config.js";
import {
  type PeopleAccountsReadDependencies,
  registerPeopleAccountsRead,
} from "./people/accounts-read/route.js";
import {
  type PeopleAddUserDependencies,
  registerPeopleAddUser,
} from "./people/add-user/route.js";

export function createApp(
  config: Config,
  options?: {
    peopleAccountsRead?: PeopleAccountsReadDependencies;
    peopleAddUser?: PeopleAddUserDependencies;
  },
): FastifyInstance {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      redact: {
        paths: [
          "req.headers.authorization",
          "req.headers.cookie",
          "*.password",
          "*.token",
          "*.secret",
          "*.databaseUrl",
        ],
        censor: "[REDACTED]",
      },
    },
    genReqId: () => crypto.randomUUID(),
  });
  app.setErrorHandler((error, request, reply) => {
    const safeError =
      error instanceof Error ? error : new Error("Unknown error");
    request.log.error({ err: { name: safeError.name } }, "request failed");
    const code =
      typeof error === "object" && error !== null && "statusCode" in error
        ? Number(error.statusCode)
        : 500;
    const status = code >= 400 && code < 500 ? code : 500;
    return reply.status(status).send({
      code: status === 500 ? "INTERNAL_ERROR" : "INVALID_REQUEST",
      message:
        status === 500 ? "An unexpected error occurred" : "Invalid request",
      requestId: request.id,
    });
  });
  app.setNotFoundHandler((request, reply) =>
    reply.status(404).send({
      code: "NOT_FOUND",
      message: "Resource not found",
      requestId: request.id,
    }),
  );
  app.get(
    "/health",
    {
      schema: {
        response: {
          200: {
            type: "object",
            required: ["status"],
            properties: { status: { type: "string", const: "ok" } },
            additionalProperties: false,
          },
        },
      },
    },
    async () => ({ status: "ok" }),
  );
  registerPeopleAccountsRead(app, options?.peopleAccountsRead);
  registerPeopleAddUser(app, options?.peopleAddUser);
  return app;
}
