import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { loadServerConfig, type NovaUser } from "./workspace-config";

export const AUTH_COOKIE_NAME = "nova_user";

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
  const userId = cookieStore.get(AUTH_COOKIE_NAME)?.value;
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
  response.cookies.set(AUTH_COOKIE_NAME, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
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
