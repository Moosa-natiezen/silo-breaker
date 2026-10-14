"use client";

import { createAuthClient } from "better-auth/react";

/**
 * Better Auth React client.
 * Same-origin by default; NEXT_PUBLIC_APP_URL overrides when the app is
 * served from a different origin.
 */
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || undefined,
});

export const { signIn, signUp, signOut, useSession } = authClient;
