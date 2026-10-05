import Fastify, { LogController, type FastifyInstance } from "fastify";
import type { Writable } from "node:stream";
import type { Config } from "./config.js";
import {
  registerStaffAuth,
  type StaffAuthDependencies,
} from "./staff-auth/routes.js";
import {
  type PeopleServerDependencies,
  registerPeopleServer,
} from "./people/server-names/route.js";
import {
  type PeopleBookedByDependencies,
  registerPeopleBookedBy,
} from "./people/booked-by/route.js";
import { registerPeopleAddUserOptions } from "./people/add-user/options.js";
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
    loggerStream?: Writable;
    staffAuth?: StaffAuthDependencies;
    peopleAccountsRead?: PeopleAccountsReadDependencies;
    peopleAddUser?: PeopleAddUserDependencies;
    peopleBookedBy?: PeopleBookedByDependencies;
    peopleServer?: PeopleServerDependencies;
  },
): FastifyInstance {
  const app = Fastify({
    logController: new LogController({ disableRequestLogging: true }),
    logger: {
      ...(options?.loggerStream ? { stream: options.loggerStream } : {}),
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
  const staff = options?.staffAuth
    ? registerStaffAuth(app, options.staffAuth)
    : undefined;
  const pool = options?.staffAuth?.runtimePool;
  const organization =
    staff && pool
      ? { runtimePool: pool, resolveTrustedScope: staff.resolveOrganization }
      : undefined;
  const venue =
    staff && pool
      ? { runtimePool: pool, resolveTrustedScope: staff.resolveVenue }
      : undefined;
  registerPeopleAccountsRead(app, organization ?? options?.peopleAccountsRead);
  registerPeopleAddUser(app, organization ?? options?.peopleAddUser);
  registerPeopleAddUserOptions(app, organization ?? options?.peopleAddUser);
  registerPeopleBookedBy(app, venue ?? options?.peopleBookedBy);
  registerPeopleServer(app, venue ?? options?.peopleServer);
  return app;
}
