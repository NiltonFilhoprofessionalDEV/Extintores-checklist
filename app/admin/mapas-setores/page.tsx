"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Rota antiga — redireciona para Configurações da Base. */
export default function MapasSetoresRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/configuracoes");
  }, [router]);

  return <p className="text-sm text-slate-500">Redirecionando para Configurações da Base…</p>;
}
