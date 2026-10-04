import type { operations } from "../../packages/contracts/generated/api";
type List =
  operations["listServerNames"]["responses"][200]["content"]["application/json"];
export const serverRoute = "/manager/oceansatarthurs/manage/servernames/edit";
export const serverName: List["items"][number] = {
  id: "00000000-0000-4000-8000-000000000001",
  displayName: "Synthetic server",
  version: 1,
};
export function serverList(
  items: List["items"] = [serverName],
  nextCursor: string | null = null,
): List {
  return { items, nextCursor };
}
