import { Ajv } from "ajv";

export interface Config {
  NODE_ENV: "development" | "test" | "staging" | "production";
  HOST: string;
  PORT: number;
  LOG_LEVEL: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";
}

const schema = {
  type: "object",
  required: ["NODE_ENV", "HOST", "PORT", "LOG_LEVEL"],
  properties: {
    NODE_ENV: { enum: ["development", "test", "staging", "production"] },
    HOST: { type: "string", minLength: 1 },
    PORT: { type: "integer", minimum: 1, maximum: 65535 },
    LOG_LEVEL: {
      enum: ["fatal", "error", "warn", "info", "debug", "trace", "silent"],
    },
  },
  additionalProperties: false,
} as const;
const validate = new Ajv({ allErrors: true }).compile<Config>(schema);
export function loadConfig(env: NodeJS.ProcessEnv): Config {
  const config: unknown = {
    NODE_ENV: env.NODE_ENV ?? "development",
    HOST: env.HOST ?? "127.0.0.1",
    PORT: Number(env.PORT ?? "3001"),
    LOG_LEVEL: env.LOG_LEVEL ?? "info",
  };
  if (!validate(config)) throw new Error("Invalid server configuration");
  return config;
}
