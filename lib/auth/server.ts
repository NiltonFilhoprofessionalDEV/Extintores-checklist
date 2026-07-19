import { getUserManagerFromRequest } from "@/lib/auth/user-management-server";

/** @deprecated Use getUserManagerFromRequest — mantido para compatibilidade. */
export async function getAdminUserIdFromRequest(request: Request) {
  const manager = await getUserManagerFromRequest(request);
  return manager?.role === "admin" || manager?.role === "admin_corporativo" ? manager.id : null;
}

export { getUserManagerFromRequest } from "@/lib/auth/user-management-server";
