import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase/client";

let authReadyPromise: Promise<void> | null = null;
let sessionRequestInFlight: Promise<Session | null> | null = null;

function isSessionExpired(session: Session): boolean {
  if (!session.expires_at) return false;
  return session.expires_at * 1000 <= Date.now() + 30_000;
}

function isInvalidSessionError(error: { status?: number; message?: string }): boolean {
  const message = (error.message ?? "").toLowerCase();
  return (
    error.status === 401 ||
    message.includes("jwt") ||
    message.includes("invalid") ||
    message.includes("expired") ||
    message.includes("session not found")
  );
}

/** Aguarda o Supabase restaurar a sessão do localStorage (INITIAL_SESSION). */
export function waitForAuthReady(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (authReadyPromise) return authReadyPromise;

  authReadyPromise = new Promise((resolve) => {
    const supabase = getSupabaseClient();
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "INITIAL_SESSION") {
        subscription.unsubscribe();
        finish();
      }
    });

    void supabase.auth.getSession().finally(() => {
      window.setTimeout(finish, 0);
    });

    window.setTimeout(() => {
      subscription.unsubscribe();
      finish();
    }, 4_000);
  });

  return authReadyPromise;
}

async function resolveCurrentSession(): Promise<Session | null> {
  await waitForAuthReady();

  const supabase = getSupabaseClient();
  const { data: cached } = await supabase.auth.getSession();
  let session = cached.session;

  if (session && isSessionExpired(session)) {
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (!refreshError && refreshed.session) {
      session = refreshed.session;
    }
  }

  if (session) return session;

  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) {
      if (isInvalidSessionError(userError)) return null;
      const { data: retry } = await supabase.auth.getSession();
      return retry.session;
    }
    if (!userData.user) return null;

    const { data: final } = await supabase.auth.getSession();
    return final.session;
  } catch {
    const { data: fallback } = await supabase.auth.getSession();
    return fallback.session;
  }
}

/** Sessão atual: prioriza localStorage e só invalida em logout ou JWT inválido. */
export async function getCurrentSession(): Promise<Session | null> {
  if (!sessionRequestInFlight) {
    sessionRequestInFlight = resolveCurrentSession().finally(() => {
      sessionRequestInFlight = null;
    });
  }
  return sessionRequestInFlight;
}

/** Encerra a sessão apenas quando o usuário pede logout. */
export async function signOutCurrentUser(): Promise<void> {
  const supabase = getSupabaseClient();
  await supabase.auth.signOut();
}
