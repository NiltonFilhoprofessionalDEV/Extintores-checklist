"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { ExtintorImportRecord } from "@/lib/rf01/import-parser";
import ChecklistForm from "@/src/components/ChecklistForm";
import { CHECKLIST_INITIAL, type ChecklistData } from "@/lib/checklist/types";
import { getCurrentSession, getProfileBySession } from "@/lib/auth/profile";

type ExtintorMobile = Pick<
  ExtintorImportRecord,
  "codigo" | "setor" | "local_detalhado" | "num_inmetro" | "tipo" | "tamanho"
> & {
  id: string;
  pavimento: string | null;
  manutencao_2_nivel: string | null;
};

const SETOR_ORDEM = [
  "Subsolo",
  "Térreo",
  "Pavimento 1",
  "Galeria Técnica",
  "Pavimento Técnico",
] as const;

function isVencido(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

function ExtintorIcon({ color }: { color: "green" | "red" | "amber" }) {
  const palette =
    color === "red"
      ? { bg: "#fee2e2", fg: "#E02020", top: "#B51313" }
      : color === "amber"
        ? { bg: "#fef3c7", fg: "#d97706", top: "#b45309" }
        : { bg: "#dcfce7", fg: "#16a34a", top: "#15803d" };

  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ background: palette.bg }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="9" y="6" width="6" height="13" rx="3" fill={palette.fg} />
        <path d="M15 10h4l1 2h-5" fill={palette.fg} />
        <rect x="8" y="4" width="8" height="2" rx="1" fill={palette.top} fillOpacity="0.7" />
      </svg>
    </div>
  );
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ background: ok ? "#dcfce7" : "#fee2e2", color: ok ? "#15803d" : "#b91c1c" }}
    >
      {label}
    </span>
  );
}

export default function MobileConferenciaPage() {
  const [extintores, setExtintores] = useState<ExtintorMobile[]>([]);
  const [filter, setFilter] = useState("");
  const [tab, setTab] = useState<"todas" | "pendentes" | "concluidas">("todas");
  const [selected, setSelected] = useState<ExtintorMobile | null>(null);
  const [checklist, setChecklist] = useState<ChecklistData>(CHECKLIST_INITIAL);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [conferidosNoMesIds, setConferidosNoMesIds] = useState<Set<string>>(new Set());
  const [conferenteNome, setConferenteNome] = useState("");

  const supabase = useMemo(() => getSupabaseClient(), []);

  const currentMonthRange = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { start: start.toISOString(), end: end.toISOString() };
  }, []);

  useEffect(() => {
    const load = async () => {
      const [{ data, error }, monthly] = await Promise.all([
        supabase
          .from("extintores")
          .select("id,codigo,setor,local_detalhado,num_inmetro,tipo,tamanho,pavimento,manutencao_2_nivel")
          .order("codigo", { ascending: true }),
        supabase
          .from("checklists")
          .select("extintor_id,data_conferencia")
          .gte("data_conferencia", currentMonthRange.start)
          .lt("data_conferencia", currentMonthRange.end),
      ]);

      if (!error) setExtintores((data ?? []) as ExtintorMobile[]);

      if (!monthly.error) {
        const set = new Set<string>();
        for (const row of (monthly.data ?? []) as Array<{ extintor_id: string }>) {
          if (row.extintor_id) set.add(row.extintor_id);
        }
        setConferidosNoMesIds(set);
      }
    };
    void load();
  }, [supabase, currentMonthRange.start, currentMonthRange.end]);

  useEffect(() => {
    const channel = supabase
      .channel("mobile-conferencia-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "checklists" },
        () => {
          void supabase
            .from("checklists")
            .select("extintor_id,data_conferencia")
            .gte("data_conferencia", currentMonthRange.start)
            .lt("data_conferencia", currentMonthRange.end)
            .then(({ data, error }) => {
              if (error) return;
              const set = new Set<string>();
              for (const row of (data ?? []) as Array<{ extintor_id: string }>) {
                if (row.extintor_id) set.add(row.extintor_id);
              }
              setConferidosNoMesIds(set);
            });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentMonthRange.end, currentMonthRange.start, supabase]);

  useEffect(() => {
    const loadConferente = async () => {
      try {
        const session = await getCurrentSession();
        if (!session) return;
        const profile = await getProfileBySession(session);
        const nome = profile?.nome?.trim() ?? "";
        if (!nome) return;
        setConferenteNome(nome);
        setChecklist((prev) => ({ ...prev, conferente: prev.conferente || nome }));
      } catch {
        // sem bloqueio de fluxo caso falhe
      }
    };
    void loadConferente();
  }, []);

  const filtered = useMemo(() => {
    const q = filter.toLowerCase().trim();
    let list = extintores;
    if (tab === "pendentes") list = list.filter((i) => !conferidosNoMesIds.has(i.id));
    if (tab === "concluidas") list = list.filter((i) => conferidosNoMesIds.has(i.id));
    if (!q) return list;
    return list.filter(
      (item) =>
        item.codigo.toLowerCase().includes(q) ||
        item.setor.toLowerCase().includes(q) ||
        item.local_detalhado.toLowerCase().includes(q),
    );
  }, [extintores, filter, tab, conferidosNoMesIds]);

  const groupedBySetor = useMemo(() => {
    const groups = new Map<string, ExtintorMobile[]>();
    for (const item of filtered) {
      const key = item.setor?.trim() || "Sem setor";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }

    const preferred = SETOR_ORDEM.filter((setor) => groups.has(setor)).map((setor) => [
      setor,
      groups.get(setor)!,
    ] as const);

    const others = Array.from(groups.entries())
      .filter(([setor]) => !SETOR_ORDEM.includes(setor as (typeof SETOR_ORDEM)[number]))
      .sort(([a], [b]) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));

    return [...preferred, ...others];
  }, [filtered]);

  async function submitChecklist(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);

    const payloadNovo = {
      extintor_id: selected.id,
      data_conferencia: new Date().toISOString(),
      conferente: checklist.conferente.trim(),
      status_lacre: checklist.alca_gatilho_status === "conforme",
      status_manometro: checklist.medidor_pressao_status === "conforme",
      local_correto: checklist.local_correto,
      dados_corretos: checklist.dados_corretos,
      sinalizacao_correta: checklist.sinalizacao_correta,
      mangueira_status: checklist.mangueira_status,
      bico_difusor_status: checklist.bico_difusor_status,
      alca_gatilho_status: checklist.alca_gatilho_status,
      medidor_pressao_status: checklist.medidor_pressao_status,
      cilindro_status: checklist.cilindro_status,
      observacoes: checklist.observacoes.trim() || null,
    } as unknown as Record<string, unknown>;

    const { error } = await supabase.from("checklists").insert(payloadNovo);
    let finalError = error;

    if (error?.message?.includes("schema cache") || error?.message?.includes("column")) {
      const observacoesLegado = [
        checklist.observacoes.trim(),
        `Local correto conforme mapa: ${checklist.local_correto ?? ""}`,
        `Dados do extintor corretos: ${checklist.dados_corretos ?? ""}`,
        `Sinalização correta: ${checklist.sinalizacao_correta ?? ""}`,
        `Mangueira em boas condições: ${checklist.mangueira_status ?? ""}`,
        `Bico/Difusor em boas condições: ${checklist.bico_difusor_status ?? ""}`,
        `Alça/Gatilho/Lacre/Pino em boas condições: ${checklist.alca_gatilho_status ?? ""}`,
        `Medidor de pressão correto: ${checklist.medidor_pressao_status ?? ""}`,
        `Cilindro em boas condições: ${checklist.cilindro_status ?? ""}`,
      ]
        .filter(Boolean)
        .join(" | ");

      const payloadLegado = {
        extintor_id: selected.id,
        data_conferencia: new Date().toISOString(),
        conferente: checklist.conferente.trim(),
        status_lacre: checklist.alca_gatilho_status === "conforme",
        status_manometro: checklist.medidor_pressao_status === "conforme",
        observacoes: observacoesLegado || null,
      } as unknown as Record<string, unknown>;

      const retry = await supabase.from("checklists").insert(payloadLegado);
      finalError = retry.error;
    }

    setSaving(false);
    if (finalError) {
      setMessage(`Erro ao salvar: ${finalError.message}`);
      return;
    }

    setConferidosNoMesIds((prev) => new Set([...prev, selected.id]));
    setMessage(`✓ Inspeção registrada para ${selected.codigo}`);
    setSelected(null);
    setChecklist({ ...CHECKLIST_INITIAL, conferente: conferenteNome });
    setTimeout(() => setMessage(""), 4000);
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <div className="px-4 py-4" style={{ background: "linear-gradient(90deg, #E02020, #B51313)" }}>
          <h2 className="text-lg font-bold text-white">Inspeções</h2>
          <p className="text-xs text-white/70">{extintores.length} extintores cadastrados</p>
        </div>
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#9ca3af" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" />
              <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="search"
              placeholder="Buscar por código, setor ou local..."
              className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
        </div>
        <div className="flex border-t border-gray-100">
          {(["todas", "pendentes", "concluidas"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className="flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors"
              style={{
                color: tab === t ? "#E02020" : "#6b7280",
                borderBottom: tab === t ? "2px solid #E02020" : "2px solid transparent",
              }}
            >
              {t === "todas" ? "Todas" : t === "pendentes" ? "Pendentes" : "Concluídas"}
            </button>
          ))}
        </div>
      </div>

      {message && (
        <div className="flex items-center gap-2 rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
          {message}
        </div>
      )}

      <div className="space-y-4">
        {filtered.length === 0 && (
          <div className="rounded-2xl bg-white px-4 py-10 text-center text-sm text-gray-400 shadow-sm">
            Nenhum extintor encontrado.
          </div>
        )}

        {groupedBySetor.map(([setor, items]) => (
          <section key={setor} className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">{setor}</h3>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
                {items.length}
              </span>
            </div>

            {items.map((item) => {
              const vencido = isVencido(item.manutencao_2_nivel);
              const conferidoNoMes = conferidosNoMesIds.has(item.id);
              const iconColor: "green" | "red" | "amber" = vencido
                ? "red"
                : conferidoNoMes
                  ? "green"
                  : "amber";

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSelected(item);
                    setChecklist({ ...CHECKLIST_INITIAL, conferente: conferenteNome });
                    setMessage("");
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3.5 text-left shadow-sm active:scale-[0.98] transition-transform"
                >
                  <ExtintorIcon color={iconColor} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-bold text-gray-900">{item.codigo}</p>
                      {conferidoNoMes ? (
                        <StatusBadge ok={true} label="Conferido no mês" />
                      ) : (
                        <StatusBadge ok={false} label="Não conferido no mês" />
                      )}
                    </div>
                    <p className="truncate text-xs text-gray-500">{item.local_detalhado}</p>
                    <p className="mt-0.5 text-[11px] text-gray-400">
                      {item.setor}
                      {item.pavimento ? ` · ${item.pavimento}` : ""} · {item.tipo} {item.tamanho}
                    </p>
                    {!conferidoNoMes && (
                      <p className="mt-1 text-[11px] font-semibold text-amber-600">
                        Pendente de conferência mensal
                      </p>
                    )}
                  </div>
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#d1d5db" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              );
            })}
          </section>
        ))}
      </div>

      {selected && (
        <div className="fixed inset-0 z-[1000] flex items-end bg-black/50">
          <div
            className="w-full rounded-t-3xl bg-white px-5 pt-5 shadow-2xl"
            style={{ maxHeight: "95vh", overflowY: "auto", paddingBottom: "env(safe-area-inset-bottom, 20px)" }}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-200" />
            <ChecklistForm
              data={checklist}
              onChange={setChecklist}
              onSubmit={submitChecklist}
              onCancel={() => setSelected(null)}
              isSaving={saving}
              extintor={{
                codigo: selected.codigo,
                local_detalhado: selected.local_detalhado,
                tipo: selected.tipo,
                tamanho: selected.tamanho,
                setor: selected.setor,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

