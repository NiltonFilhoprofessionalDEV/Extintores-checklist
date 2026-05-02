"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { ExtintorImportRecord } from "@/lib/rf01/import-parser";
import ChecklistForm from "@/src/components/ChecklistForm";
import {
  CHECKLIST_INITIAL,
  checklistTemNaoConformidade,
  mergeObservacoesComNaoConformidades,
  type ChecklistData,
} from "@/lib/checklist/types";
import { getCurrentSession, getProfileBySession } from "@/lib/auth/profile";
import { getLocalCalendarMonthUtcIsoRange } from "@/lib/date/local-month-range";
import {
  fetchChecklistsExtintoresDoMes,
  type ChecklistExtintorMesRow as ChecklistMesRow,
} from "@/lib/supabase/checklists-do-mes";

type ExtintorMobile = Pick<
  ExtintorImportRecord,
  "codigo" | "setor" | "local_detalhado" | "num_inmetro" | "tipo" | "tamanho"
> & {
  id: string;
  pavimento: string | null;
  manutencao_2_nivel: string | null;
  manutencao_3_nivel: string | null;
  capacidade_extintora: string;
};

const EXTINTORES_CACHE_KEY = "extintores_cache_v1";
const PENDING_CHECKLISTS_KEY = "pending_checklists_v1";

function compareCodigo(a: string, b: string) {
  return a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" });
}

function isVencido(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

function ExtintorIcon({ variant }: { variant: "ok" | "pendente" | "alerta" }) {
  const palette =
    variant === "alerta"
      ? { bg: "#fee2e2", fg: "#E02020", top: "#B51313" }
      : variant === "pendente"
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
      style={{ background: ok ? "#dcfce7" : "#fef3c7", color: ok ? "#15803d" : "#b45309" }}
    >
      {label}
    </span>
  );
}

function buildUltimoChecklistPorExtintor(rows: ChecklistMesRow[]): Map<string, ChecklistMesRow> {
  const sorted = [...rows].sort(
    (a, b) => new Date(b.data_conferencia).getTime() - new Date(a.data_conferencia).getTime(),
  );
  const map = new Map<string, ChecklistMesRow>();
  for (const row of sorted) {
    if (!map.has(row.extintor_id)) map.set(row.extintor_id, row);
  }
  return map;
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
  const [ultimoChecklistMes, setUltimoChecklistMes] = useState<Map<string, ChecklistMesRow>>(new Map());
  const [conferenteNome, setConferenteNome] = useState("");

  const supabase = useMemo(() => getSupabaseClient(), []);

  const currentMonthRange = useMemo(() => getLocalCalendarMonthUtcIsoRange(), []);

  const extintoresOrdenados = useMemo(() => {
    return [...extintores].sort((a, b) => compareCodigo(a.codigo, b.codigo));
  }, [extintores]);

  const ordemGlobalPorId = useMemo(() => {
    const m = new Map<string, number>();
    extintoresOrdenados.forEach((e, i) => m.set(e.id, i + 1));
    return m;
  }, [extintoresOrdenados]);

  useEffect(() => {
    const load = async () => {
      await getCurrentSession();
      const { data, error } = await supabase
        .from("extintores")
        .select(
          "id,codigo,setor,local_detalhado,num_inmetro,tipo,tamanho,pavimento,manutencao_2_nivel,manutencao_3_nivel,capacidade_extintora",
        )
        .order("codigo", { ascending: true });

      if (!error) {
        const loaded = (data ?? []) as ExtintorMobile[];
        setExtintores(loaded);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(EXTINTORES_CACHE_KEY, JSON.stringify(loaded));
        }
      } else if (typeof window !== "undefined") {
        const cached = window.localStorage.getItem(EXTINTORES_CACHE_KEY);
        if (cached) {
          setExtintores(JSON.parse(cached) as ExtintorMobile[]);
          setMessage("Sem internet: exibindo dados salvos localmente.");
        }
      }

      const { ok, rows } = await fetchChecklistsExtintoresDoMes(
        supabase,
        currentMonthRange.startIso,
        currentMonthRange.endInclusiveIso,
      );
      if (ok) {
        setConferidosNoMesIds(new Set(rows.map((r) => r.extintor_id).filter(Boolean)));
        setUltimoChecklistMes(buildUltimoChecklistPorExtintor(rows));
      }
    };
    void load();
  }, [supabase, currentMonthRange.startIso, currentMonthRange.endInclusiveIso]);

  async function flushPendingChecklists() {
    if (typeof window === "undefined") return;
    if (!navigator.onLine) return;

    const raw = window.localStorage.getItem(PENDING_CHECKLISTS_KEY);
    if (!raw) return;

    const queue = JSON.parse(raw) as Array<Record<string, unknown>>;
    if (queue.length === 0) return;

    const stillPending: Array<Record<string, unknown>> = [];
    const syncedExtintorIds = new Set<string>();
    let syncedCount = 0;

    for (const payload of queue) {
      const { error } = await supabase
        .from("checklists")
        .insert(payload as unknown as Record<string, unknown>);
      if (error) {
        stillPending.push(payload);
      } else {
        syncedCount += 1;
        const id = payload.extintor_id as string | undefined;
        if (id) syncedExtintorIds.add(id);
      }
    }

    window.localStorage.setItem(PENDING_CHECKLISTS_KEY, JSON.stringify(stillPending));

    if (syncedExtintorIds.size > 0) {
      setConferidosNoMesIds((prev) => new Set([...prev, ...Array.from(syncedExtintorIds)]));
    }

    if (syncedCount > 0) {
      setMessage(
        `${syncedCount} conferência${syncedCount > 1 ? "s" : ""} sincronizada${
          syncedCount > 1 ? "s" : ""
        } com sucesso.`,
      );
      setTimeout(() => setMessage(""), 3500);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void flushPendingChecklists();
    }, 0);
    const handleOnline = () => {
      void flushPendingChecklists();
    };
    window.addEventListener("online", handleOnline);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("online", handleOnline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("mobile-conferencia-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "checklists" },
        () => {
          void fetchChecklistsExtintoresDoMes(
            supabase,
            currentMonthRange.startIso,
            currentMonthRange.endInclusiveIso,
          ).then(({ ok, rows }) => {
            if (!ok) return;
            setConferidosNoMesIds(new Set(rows.map((r) => r.extintor_id).filter(Boolean)));
            setUltimoChecklistMes(buildUltimoChecklistPorExtintor(rows));
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentMonthRange.endInclusiveIso, currentMonthRange.startIso, supabase]);

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

  const visiveis = useMemo(() => {
    const q = filter.toLowerCase().trim();
    let list = extintoresOrdenados;
    if (tab === "pendentes") list = list.filter((i) => !conferidosNoMesIds.has(i.id));
    if (tab === "concluidas") list = list.filter((i) => conferidosNoMesIds.has(i.id));
    if (!q) return list;
    return list.filter(
      (item) =>
        item.codigo.toLowerCase().includes(q) ||
        item.setor.toLowerCase().includes(q) ||
        item.local_detalhado.toLowerCase().includes(q),
    );
  }, [extintoresOrdenados, filter, tab, conferidosNoMesIds]);

  async function submitChecklist(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);

    const observacoesFinal = mergeObservacoesComNaoConformidades(checklist);

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
      observacoes: observacoesFinal || null,
    } as unknown as Record<string, unknown>;

    let finalError: { message?: string } | null = null;
    if (typeof navigator !== "undefined" && navigator.onLine) {
      const { error } = await supabase.from("checklists").insert(payloadNovo);
      finalError = error;
    } else {
      finalError = { message: "offline" };
    }

    if (
      finalError?.message?.includes("schema cache") ||
      finalError?.message?.includes("column")
    ) {
      const observacoesLegado = [
        observacoesFinal,
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
      const offline = typeof navigator !== "undefined" && !navigator.onLine;
      if (offline && typeof window !== "undefined") {
        const raw = window.localStorage.getItem(PENDING_CHECKLISTS_KEY);
        const queue = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
        queue.push(payloadNovo);
        window.localStorage.setItem(PENDING_CHECKLISTS_KEY, JSON.stringify(queue));

        setConferidosNoMesIds((prev) => new Set([...prev, selected.id]));
        setUltimoChecklistMes((prev) => {
          const next = new Map(prev);
          next.set(selected.id, {
            extintor_id: selected.id,
            data_conferencia: String(payloadNovo.data_conferencia),
            local_correto: checklist.local_correto,
            dados_corretos: checklist.dados_corretos,
            sinalizacao_correta: checklist.sinalizacao_correta,
            mangueira_status: checklist.mangueira_status,
            bico_difusor_status: checklist.bico_difusor_status,
            alca_gatilho_status: checklist.alca_gatilho_status,
            medidor_pressao_status: checklist.medidor_pressao_status,
            cilindro_status: checklist.cilindro_status,
          });
          return next;
        });
        setMessage("Sem internet: conferência salva localmente e será sincronizada ao reconectar.");
        setSelected(null);
        setChecklist({ ...CHECKLIST_INITIAL, conferente: conferenteNome, detalhesNaoConformidade: {} });
        setTimeout(() => setMessage(""), 4500);
        return;
      }

      setMessage(`Erro ao salvar: ${finalError.message}`);
      return;
    }

    setConferidosNoMesIds((prev) => new Set([...prev, selected.id]));
    setUltimoChecklistMes((prev) => {
      const next = new Map(prev);
      next.set(selected.id, {
        extintor_id: selected.id,
        data_conferencia: new Date().toISOString(),
        local_correto: checklist.local_correto,
        dados_corretos: checklist.dados_corretos,
        sinalizacao_correta: checklist.sinalizacao_correta,
        mangueira_status: checklist.mangueira_status,
        bico_difusor_status: checklist.bico_difusor_status,
        alca_gatilho_status: checklist.alca_gatilho_status,
        medidor_pressao_status: checklist.medidor_pressao_status,
        cilindro_status: checklist.cilindro_status,
      });
      return next;
    });
    setMessage(`✓ Inspeção registrada para ${selected.codigo}`);
    setSelected(null);
    setChecklist({ ...CHECKLIST_INITIAL, conferente: conferenteNome, detalhesNaoConformidade: {} });
    setTimeout(() => setMessage(""), 4000);
  }

  return (
    <div className="space-y-4">
      <div className="surface-card overflow-hidden">
        <div className="brand-gradient px-4 py-4">
          <h2 className="text-lg font-bold text-white">Inspeções</h2>
          <p className="text-xs text-white/70">{extintores.length} extintores cadastrados</p>
        </div>
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#9ca3af" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" />
              <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="search"
              placeholder="Buscar por código, setor ou local..."
              className="flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>
        </div>
        <div className="flex border-t border-slate-100">
          {(["todas", "pendentes", "concluidas"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className="flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors"
              style={{
                color: tab === t ? "#B42318" : "#667085",
                borderBottom: tab === t ? "2px solid #B42318" : "2px solid transparent",
              }}
            >
              {t === "todas" ? "Todas" : t === "pendentes" ? "Pendentes" : "Concluídas"}
            </button>
          ))}
        </div>
      </div>

      {message && (
        <div className="status-success-soft flex items-center gap-2 rounded-xl border border-green-100 px-4 py-3 text-sm font-semibold">
          {message}
        </div>
      )}

      <div className="space-y-2">
        {visiveis.length === 0 && (
          <div className="surface-card px-4 py-10 text-center text-sm text-slate-400">
            Nenhum extintor encontrado.
          </div>
        )}

        {visiveis.map((item) => {
          const ordem = ordemGlobalPorId.get(item.id) ?? 0;
          const conferidoNoMes = conferidosNoMesIds.has(item.id);
          const ultimo = ultimoChecklistMes.get(item.id);
          const temNc = ultimo ? checklistTemNaoConformidade(ultimo) : false;
          const manutVencida = isVencido(item.manutencao_2_nivel) || isVencido(item.manutencao_3_nivel);

          const variant: "ok" | "pendente" | "alerta" = temNc ? "alerta" : conferidoNoMes ? "ok" : "pendente";

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setSelected(item);
                setChecklist({ ...CHECKLIST_INITIAL, conferente: conferenteNome, detalhesNaoConformidade: {} });
                setMessage("");
              }}
              className="surface-card flex w-full items-center gap-3 px-4 py-3.5 text-left transition-transform active:scale-[0.98]"
            >
              <div className="flex w-9 shrink-0 flex-col items-center justify-center">
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Nº</span>
                <span className="text-base font-bold text-slate-700">{ordem}</span>
              </div>
              <ExtintorIcon variant={variant} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-bold text-gray-900">{item.codigo}</p>
                  {temNc ? (
                    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                      <span aria-hidden>⚠</span> Não conformidade
                    </span>
                  ) : conferidoNoMes ? (
                    <StatusBadge ok={true} label="Conferido no mês" />
                  ) : (
                    <StatusBadge ok={false} label="Pendente no mês" />
                  )}
                </div>
                <p className="truncate text-xs text-gray-500">{item.local_detalhado}</p>
                <p className="mt-0.5 text-[11px] text-gray-400">
                  {item.setor}
                  {item.pavimento ? ` · ${item.pavimento}` : ""} · {item.tipo} {item.tamanho}
                </p>
                {manutVencida && (
                  <p className="mt-1 text-[11px] font-medium text-amber-700">Atenção: manutenção nível 2 ou 3 vencida</p>
                )}
              </div>
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#d1d5db" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          );
        })}
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
              cabecalho={{
                codigo: selected.codigo,
                pavimento: selected.pavimento,
                local_detalhado: selected.local_detalhado,
                num_inmetro: selected.num_inmetro,
                tipo: selected.tipo,
                tamanho: selected.tamanho,
                capacidade_extintora: selected.capacidade_extintora ?? "",
                manutencao_2_nivel: selected.manutencao_2_nivel,
                manutencao_3_nivel: selected.manutencao_3_nivel,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
