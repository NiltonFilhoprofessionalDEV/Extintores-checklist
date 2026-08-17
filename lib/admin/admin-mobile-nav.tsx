"use client";

import { createContext, useContext, type ReactNode } from "react";

type AdminMobileNavContextValue = {
  openMobileNav: () => void;
};

const AdminMobileNavContext = createContext<AdminMobileNavContextValue | null>(null);

export function AdminMobileNavProvider({
  value,
  children,
}: {
  value: AdminMobileNavContextValue;
  children: ReactNode;
}) {
  return <AdminMobileNavContext.Provider value={value}>{children}</AdminMobileNavContext.Provider>;
}

export function useAdminMobileNav(): AdminMobileNavContextValue | null {
  return useContext(AdminMobileNavContext);
}
