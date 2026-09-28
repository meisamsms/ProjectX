import { randomBytes } from "node:crypto";

/** RFC 9562 UUIDv7; identifiers reveal creation time and never establish access. */
export function newPeopleId(now = Date.now()): string {
  if (!Number.isSafeInteger(now) || now < 0 || now > 0xffffffffffff)
    throw new RangeError("Invalid UUIDv7 timestamp");
  const bytes = randomBytes(16);
  for (let i = 5; i >= 0; i--) {
    bytes[i] = now & 0xff;
    now = Math.floor(now / 256);
  }
  bytes[6] = (bytes.readUInt8(6) & 0x0f) | 0x70;
  bytes[8] = (bytes.readUInt8(8) & 0x3f) | 0x80;
  const h = bytes.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
