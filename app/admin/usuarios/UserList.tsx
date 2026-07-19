"use client";

import { ROLE_LABELS, TEAM_LABELS } from "@/lib/auth/roles";
import type { UserItem } from "./user-types";

type UserListProps = {
  users: UserItem[];
  currentUserId: string | null;
  canActOn: (user: UserItem) => boolean;
  onEdit: (user: UserItem) => void;
  onDelete: (user: UserItem) => void;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0]?.slice(0, 2).toUpperCase() || "?";
  return `${parts[0][0]}${parts.at(-1)?.[0]}`.toUpperCase();
}

function formatCreatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data não informada";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function UserList({
  users,
  currentUserId,
  canActOn,
  onEdit,
  onDelete,
}: UserListProps) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {users.map((user) => {
        const manageable = canActOn(user);
        const isCurrentUser = user.id === currentUserId;

        return (
          <article
            key={user.id}
            className="group relative flex items-center gap-4 rounded-[1.25rem] border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-soft)] transition hover:border-slate-300"
          >
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--orange-soft)] text-sm font-extrabold text-[var(--orange-deep)]">
              {initials(user.nome)}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-sm font-extrabold text-[var(--ink)]">{user.nome}</h3>
                {isCurrentUser && (
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                    Você
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs font-semibold text-slate-600">{ROLE_LABELS[user.role]}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                <span>{user.team ? `Equipe ${TEAM_LABELS[user.team]}` : "Sem equipe"}</span>
                <span aria-hidden>·</span>
                <span>Criado em {formatCreatedAt(user.created_at)}</span>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span
                className={`hidden rounded-full px-2.5 py-1 text-[11px] font-bold sm:inline-flex ${
                  user.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                }`}
              >
                {user.active ? "Ativo" : "Inativo"}
              </span>

              {manageable && (
                <details name="user-actions" className="relative">
                  <summary
                    className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-full border border-[var(--border)] bg-white text-xl font-bold leading-none text-slate-500 transition hover:bg-[var(--muted)] hover:text-[var(--ink)] [&::-webkit-details-marker]:hidden"
                    aria-label={`Ações de ${user.nome}`}
                    title="Mais ações"
                  >
                    ⋮
                  </summary>
                  <div className="absolute right-0 top-12 z-20 w-40 overflow-hidden rounded-2xl border border-[var(--border)] bg-white p-1.5 shadow-xl">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.currentTarget.closest("details")?.removeAttribute("open");
                        onEdit(user);
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-bold text-slate-700 hover:bg-[var(--muted)]"
                    >
                      <span aria-hidden>✎</span>
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.currentTarget.closest("details")?.removeAttribute("open");
                        onDelete(user);
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-bold text-rose-700 hover:bg-rose-50"
                    >
                      <span aria-hidden>⌫</span>
                      Excluir
                    </button>
                  </div>
                </details>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
