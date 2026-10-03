import type { operations } from "../../packages/contracts/generated/api";
type List =
  operations["listBookedByNames"]["responses"][200]["content"]["application/json"];
export const bookedRoute = "/manager/oceansatarthurs/manage/bookedbynames/edit";
export const bookedName: List["items"][number] = {
  id: "00000000-0000-4000-8000-000000000001",
  displayName: "Synthetic host",
  version: 1,
};
export function bookedList(
  items: List["items"] = [bookedName],
  nextCursor: string | null = null,
): List {
  return { items, nextCursor };
}
