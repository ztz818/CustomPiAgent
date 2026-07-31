import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { loadServerConfig, type NovaUser } from "./workspace-config";

export const AUTH_COOKIE_NAME = "nova_user";
const AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function authSecret(): string {
  if (process.env.NOVA_AUTH_SECRET) return process.env.NOVA_AUTH_SECRET;
  const users = loadServerConfig().users
    .map((user) => `${user.id}:${user.accessCode ?? ""}:${user.passwordHash ?? ""}`)
    .sort();
  return createHmac("sha256", "nova-cookie-secret-v1").update(users.join("\n")).digest("hex");
}

function signature(value: string): string {
  return createHmac("sha256", authSecret()).update(value).digest("base64url");
}

function createSessionValue(userId: string): string {
  const expiresAt = Math.floor(Date.now() / 1000) + AUTH_COOKIE_MAX_AGE_SECONDS;
  const payload = `${Buffer.from(userId, "utf8").toString("base64url")}.${expiresAt}`;
  return `${payload}.${signature(payload)}`;
}

function readSessionValue(value: string): string | null {
  const [encodedUserId, expiresAtText, providedSignature, extra] = value.split(".");
  if (!encodedUserId || !expiresAtText || !providedSignature || extra) return null;
  const expiresAt = Number(expiresAtText);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) return null;

  const expectedSignature = signature(`${encodedUserId}.${expiresAtText}`);
  const provided = Buffer.from(providedSignature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;

  try {
    return Buffer.from(encodedUserId, "base64url").toString("utf8") || null;
  } catch {
    return null;
  }
}

export interface CurrentUser {
  id: string;
  username: string;
}

export function publicUser(user: NovaUser): CurrentUser {
  return { id: user.id, username: user.username };
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (process.env.NOVA_AUTH_DISABLED === "true") {
    const config = loadServerConfig();
    const user = config.users.find((candidate) => candidate.id === config.auth.defaultUser);
    return user ? publicUser(user) : { id: config.auth.defaultUser, username: config.auth.defaultUser };
  }

  const cookieStore = await cookies();
  const sessionValue = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!sessionValue) return null;
  const userId = readSessionValue(sessionValue);
  if (!userId) return null;

  const user = loadServerConfig().users.find((candidate) => candidate.id === userId);
  return user ? publicUser(user) : null;
}

export async function requireCurrentUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function setAuthCookie(response: NextResponse, userId: string): void {
  response.cookies.set(AUTH_COOKIE_NAME, createSessionValue(userId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
  });
}

export function clearAuthCookie(response: NextResponse): void {
  response.cookies.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
