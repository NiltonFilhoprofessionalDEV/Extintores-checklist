import type { UserRole, UserTeam } from "@/lib/auth/roles";

export type UserItem = {
  id: string;
  nome: string;
  role: UserRole;
  team: UserTeam | null;
  active: boolean;
  base_id: string | null;
  created_at: string;
};
