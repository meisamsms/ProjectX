import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "__Host-projectx-session";
export const LOGIN_COOKIE = "__Host-projectx-login";
export const secret = () => randomBytes(32).toString("base64url");
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const csrfFor = (credential: string) => hash(`csrf\0${credential}`);

export function equalSecret(left: string, right: string): boolean {
  return (
    left.length === right.length &&
    timingSafeEqual(Buffer.from(left), Buffer.from(right))
  );
}

/** Reject duplicate/ambiguous credentials; no URL, body or Authorization fallback. */
export function cookieCredential(
  header: string | undefined,
  name: string,
): string | null {
  const matches = (header ?? "")
    .split(";")
    .map((x) => x.trim())
    .filter((x) => x.startsWith(`${name}=`));
  if (matches.length !== 1) return null;
  const value = matches[0]?.slice(name.length + 1) ?? "";
  return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}

export function secureCookie(
  name: string,
  value: string,
  clear = false,
): string {
  return `${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax${clear ? "; Max-Age=0" : ""}`;
}
