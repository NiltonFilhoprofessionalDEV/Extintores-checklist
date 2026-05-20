import type { Session } from "@supabase/supabase-js";
import { ROLE_LABELS } from "@/lib/auth/roles";
import type { Profile } from "@/lib/auth/profile";

/** Rótulos de função que não devem ser gravados como nome do conferente. */
const CARGO_LABELS = new Set([
  ...Object.values(ROLE_LABELS),
  "Conferente",
  "Usuário",
  "Usuario",
  "Usuário comum",
]);

function normalizeNome(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function isCargoLabel(nome: string): boolean {
  const n = normalizeNome(nome);
  if (!n) return false;
  return CARGO_LABELS.has(n);
}

function nomeFromUserMetadata(session: Session): string {
  const meta = session.user.user_metadata ?? {};
  const candidates = [meta.full_name, meta.name, meta.nome, meta.display_name];
  for (const c of candidates) {
    if (typeof c === "string") {
      const n = normalizeNome(c);
      if (n && !isCargoLabel(n)) return n;
    }
  }
  return "";
}

function nomeFromEmail(session: Session): string {
  const email = session.user.email ?? "";
  const local = email.split("@")[0]?.replace(/[._-]+/g, " ").trim();
  return local ? normalizeNome(local) : "";
}

/**
 * Nome da pessoa para o campo conferente (nunca o rótulo do cargo/perfil).
 */
export function resolveConferenteNome(
  session: Session | null,
  profile: Profile | null,
  typed?: string,
): string {
  const typedNorm = typed ? normalizeNome(typed) : "";
  if (typedNorm && !isCargoLabel(typedNorm)) return typedNorm;

  const fromProfile = profile?.nome ? normalizeNome(profile.nome) : "";
  if (fromProfile && !isCargoLabel(fromProfile)) return fromProfile;

  if (session) {
    const fromMeta = nomeFromUserMetadata(session);
    if (fromMeta) return fromMeta;

    const fromEmail = nomeFromEmail(session);
    if (fromEmail) return fromEmail;
  }

  if (typedNorm) return typedNorm;
  if (fromProfile) return fromProfile;

  return "";
}
