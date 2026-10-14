import "server-only";
import { headers } from "next/headers";
import { auth } from "@/server/auth";

/** Resolve the authenticated session for the current request (or null). */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/**
 * Guard for API route handlers: returns the signed-in user or throws a
 * Response-shaped error the caller can return directly.
 */
export async function requireUser(): Promise<
  { ok: true; user: { id: string; name: string; email: string } } | { ok: false; response: Response }
> {
  const session = await getSession();
  if (!session?.user) {
    return {
      ok: false,
      response: Response.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return {
    ok: true,
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    },
  };
}
