"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  type AccessibleBase,
  fetchAccessibleBasesForUser,
  resolveActiveBaseId,
  storeActiveBaseId,
} from "@/lib/auth/bases";
import { getCurrentSession, getProfileBySession, type Profile } from "@/lib/auth/profile";

type ActiveBaseContextValue = {
  ready: boolean;
  profile: Profile | null;
  accessibleBases: AccessibleBase[];
  activeBaseId: string | null;
  activeBase: AccessibleBase | null;
  setActiveBaseId: (baseId: string) => void;
  refresh: () => Promise<void>;
};

const ActiveBaseContext = createContext<ActiveBaseContextValue | null>(null);

export function ActiveBaseProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [accessibleBases, setAccessibleBases] = useState<AccessibleBase[]>([]);
  const [activeBaseId, setActiveBaseIdState] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const session = await getCurrentSession();
    if (!session) {
      setProfile(null);
      setAccessibleBases([]);
      setActiveBaseIdState(null);
      setReady(true);
      return;
    }

    const nextProfile = await getProfileBySession(session);
    if (!nextProfile) {
      setProfile(null);
      setAccessibleBases([]);
      setActiveBaseIdState(null);
      setReady(true);
      return;
    }

    const bases = await fetchAccessibleBasesForUser(nextProfile.id, nextProfile.base_id);
    const resolved = resolveActiveBaseId(bases, nextProfile.base_id, nextProfile.role);
    if (resolved) storeActiveBaseId(resolved);

    setProfile(nextProfile);
    setAccessibleBases(bases);
    setActiveBaseIdState(resolved);
    setReady(true);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setActiveBaseId = useCallback(
    (baseId: string) => {
      if (!accessibleBases.some((b) => b.id === baseId)) return;
      storeActiveBaseId(baseId);
      setActiveBaseIdState(baseId);
    },
    [accessibleBases],
  );

  const activeBase = useMemo(
    () => accessibleBases.find((b) => b.id === activeBaseId) ?? null,
    [accessibleBases, activeBaseId],
  );

  const value = useMemo<ActiveBaseContextValue>(
    () => ({
      ready,
      profile,
      accessibleBases,
      activeBaseId,
      activeBase,
      setActiveBaseId,
      refresh,
    }),
    [ready, profile, accessibleBases, activeBaseId, activeBase, setActiveBaseId, refresh],
  );

  return <ActiveBaseContext.Provider value={value}>{children}</ActiveBaseContext.Provider>;
}

export function useActiveBase(): ActiveBaseContextValue {
  const ctx = useContext(ActiveBaseContext);
  if (!ctx) {
    throw new Error("useActiveBase must be used within ActiveBaseProvider");
  }
  return ctx;
}

/** Safe hook when provider may be absent (returns null context). */
export function useOptionalActiveBase(): ActiveBaseContextValue | null {
  return useContext(ActiveBaseContext);
}
