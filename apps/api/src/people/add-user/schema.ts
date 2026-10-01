import specification from "../../../../../packages/contracts/openapi.json" with {
  type: "json",
};

/** Expand the small, non-recursive versioned contract for Fastify's serializer. */
function expand(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(expand);
  if (typeof value !== "object" || value === null) return value;
  if ("$ref" in value && typeof value.$ref === "string") {
    const name = value.$ref.replace("#/components/schemas/", "");
    if (!(name in specification.components.schemas))
      throw new Error("Unknown People contract schema");
    return expand(
      specification.components.schemas[
        name as keyof typeof specification.components.schemas
      ],
    );
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, expand(item)]),
  );
}

export const permissionArraySchema = {
  type: "array",
  maxItems: 22,
  uniqueItems: true,
  items: specification.components.schemas.PeoplePermissionId,
} as const;
export const optionsResponseSchema = expand(
  specification.components.schemas.PeopleAddUserOptions,
);
export const apiErrorSchema = expand(specification.components.schemas.ApiError);
