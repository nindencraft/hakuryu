import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getConfig } from "./config.server";
import { readCookie, SESSION_COOKIE, verifySession, type SessionUser } from "./session.server";

/**
 * Cliente com service role para o banco existente do bot do Discord.
 * Só é usado dentro de handlers de server functions / server routes.
 */
export function getDb(): SupabaseClient {
  const { supabaseUrl, supabaseServiceKey } = getConfig();
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (
          supabaseServiceKey.startsWith("sb_") &&
          headers.get("Authorization") === `Bearer ${supabaseServiceKey}`
        ) {
          headers.delete("Authorization");
        }
        headers.set("apikey", supabaseServiceKey);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

export async function currentUser(request: Request): Promise<SessionUser | null> {
  const token = readCookie(request.headers.get("cookie"), SESSION_COOKIE);
  return verifySession(token);
}

export function dbError(error: { message: string; code?: string } | null): never {
  const message = error?.message ?? "Erro desconhecido no banco de dados";
  throw new Error(message);
}
