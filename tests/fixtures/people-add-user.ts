import type { components } from "../../packages/contracts/generated/api";
export function first<T>(items: T[]): T {
  const item = items[0];
  if (!item) throw new Error("Missing synthetic fixture");
  return item;
}
export const options: components["schemas"]["PeopleAddUserOptions"] = {
  organizationRoles: [
    {
      id: "00000000-0000-4000-8000-000000000101",
      name: "Synthetic organization role",
    },
  ],
  organizationPermissions: [
    {
      id: "user.read",
      description: "Read synthetic roster",
      scope: "ORGANIZATION",
    },
    {
      id: "user.read.self",
      description: "Read own synthetic profile",
      scope: "SELF",
    },
  ],
  venues: [
    {
      id: "00000000-0000-4000-8000-000000000201",
      name: "Synthetic venue",
      roles: [
        {
          id: "00000000-0000-4000-8000-000000000301",
          name: "Synthetic venue role",
        },
      ],
      permissions: [
        {
          id: "venue.read",
          description: "Read synthetic venue",
          scope: "VENUE",
        },
      ],
    },
  ],
};
export const created: components["schemas"]["CreatePeopleAccountResponse"] = {
  provisioningId: "00000000-0000-4000-8000-000000000401",
  userId: "00000000-0000-4000-8000-000000000402",
  membershipId: "00000000-0000-4000-8000-000000000403",
  status: "PENDING",
};
