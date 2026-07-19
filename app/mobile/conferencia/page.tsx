"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";
import InventarioTipoTabs from "@/src/components/InventarioTipoTabs";
import type { TipoEquipamento } from "@/lib/inventario/equipamento-padrao";
import type { ExtintorImportRecord } from "@/lib/rf01/import-parser";
import ChecklistForm from "@/src/components/ChecklistForm";
import HidranteChecklistForm from "@/src/components/HidranteChecklistForm";
import ModalCloseButton from "@/src/components/ModalCloseButton";
import { fetchChecklistQuestionsForBase } from "@/lib/checklist/questions-client";
import {
  CHECKLIST_INITIAL,
  buildChecklistAnswersJson,
  checklistTemNaoConformidade,
  isDataVencida,
  mergeObservacoesComNaoConformidades,
  type ChecklistData,
} from "@/lib/checklist/types";
import { buildObservacoesLegadoApenasNaoConformidades } from "@/lib/checklist/parse-legacy-observacoes";
import {
  HIDRANTE_CHECKLIST_INITIAL,
  buildHidranteAnswersJson,
  hidranteChecklistTemNaoConformidade,
  mergeHidranteObservacoes,
  type HidranteChecklistData,
} from "@/lib/checklist/hidrante-types";
import type { HidranteImportRow } from "@/lib/rf01/hidrante-import-parser";
import { hidranteTemMangueiraVencida } from "@/lib/hidrantes/vencimento-mangueiras";
import { isCargoLabel, resolveConferenteNome } from "@/lib/auth/conferente";
import { getCurrentSession, getProfileBySession } from "@/lib/auth/profile";
import { parseCalendarDateAsLocal } from "@/lib/date/date-only";
import { getLocalCalendarMonthUtcIsoRange } from "@/lib/date/local-month-range";
import {
  fetchChecklistsExtintoresDoMes,
  fetchChecklistsHidrantesDoMes,
  type ChecklistExtintorMesRow as ChecklistMesRow,
  type ChecklistHidranteMesRow,
} from "@/lib/supabase/checklists-do-mes";
import { useActiveBase } from "@/lib/auth/active-base-context";

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

type HidranteMobile = HidranteImportRow & { id: string };

const EXTINTORES_CACHE_KEY = "extintores_cache_v1";
const HIDRANTES_CACHE_KEY = "hidrantes_cache_v1";
const PENDING_CHECKLISTS_KEY = "pending_checklists_v1";
const PENDING_HIDRANTE_CHECKLISTS_KEY = "pending_hidrante_checklists_v1";

function compareCodigo(a: string, b: string) {
  return a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" });
}

function isVencido(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const date = parseCalendarDateAsLocal(dateStr);
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date < today;
}

function HidranteIcon({ variant }: { variant: "ok" | "pendente" | "alerta" }) {
  const palette =
    variant === "alerta"
      ? { bg: "#fee2e2", fg: "var(--forest)" }
      : variant === "pendente"
        ? { bg: "#fef3c7", fg: "#d97706" }
        : { bg: "#dcfce7", fg: "#16a34a" };

  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ background: palette.bg }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="8" y="4" width="8" height="3" rx="1" fill={palette.fg} />
        <rect x="10" y="7" width="4" height="10" rx="1.5" fill={palette.fg} />
        <path d="M6 17h12v2H6z" fill={palette.fg} fillOpacity="0.85" />
        <circle cx="8" cy="19.5" r="1" fill={palette.fg} />
        <circle cx="16" cy="19.5" r="1" fill={palette.fg} />
      </svg>
    </div>
  );
}

function formatHidranteMetaLine(item: HidranteMobile): string {
  const parts: string[] = [];
  if (item.pavimento) parts.push(item.pavimento);
  if (item.quantidade_mangueiras != null) parts.push(`${item.quantidade_mangueiras} mang.`);
  if (item.quantidade_esguichos != null) parts.push(`${item.quantidade_esguichos} esg.`);
  return parts.length > 0 ? parts.join(" · ") : "Detalhes não informados";
}

type InspecaoListaItemProps = {
  ordem: number;
  codigo: string;
  localDetalhado: string;
  metaLine: string;
  avisoVencimento?: string | null;
  conferidoNoMes: boolean;
  temNc: boolean;
  icon: ReactNode;
  onClick: () => void;
};

function InspecaoListaItem({
  ordem,
  codigo,
  localDetalhado,
  metaLine,
  avisoVencimento,
  conferidoNoMes,
  temNc,
  icon,
  onClick,
}: InspecaoListaItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pressable flex w-full items-center gap-3 rounded-[1.35rem] border border-white/80 bg-white px-4 py-3.5 text-left shadow-[var(--shadow-soft)]"
    >
      <div className="flex w-9 shrink-0 flex-col items-center justify-center">
        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Nº</span>
        <span className="text-base font-bold text-slate-700">{ordem}</span>
      </div>
      {icon}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-bold text-gray-900">{codigo}</p>
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
        <p className="truncate text-xs text-gray-500">{localDetalhado}</p>
        <p className="mt-0.5 text-[11px] text-gray-400">{metaLine}</p>
        {avisoVencimento && (
          <p className="mt-1 text-[11px] font-medium text-amber-700">{avisoVencimento}</p>
        )}
      </div>
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#d1d5db" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

function ExtintorIcon({ variant }: { variant: "ok" | "pendente" | "alerta" }) {
  const palette =
    variant === "alerta"
      ? { bg: "#fee2e2", fg: "#e11d48", top: "#be123c" }
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

function buildUltimoChecklistPorHidrante(rows: ChecklistHidranteMesRow[]): Map<string, ChecklistHidranteMesRow> {
  const sorted = [...rows].sort(
    (a, b) => new Date(b.data_conferencia).getTime() - new Date(a.data_conferencia).getTime(),
  );
  const map = new Map<string, ChecklistHidranteMesRow>();
  for (const row of sorted) {
    if (!map.has(row.hidrante_id)) map.set(row.hidrante_id, row);
  }
  return map;
}

export default function MobileConferenciaPage() {
  const pathname = usePathname();
  const isAdminLista = pathname?.includes("/admin/inspecoes-lista") ?? false;
  const { ready, activeBaseId } = useActiveBase();
  const [tipoAtivo, setTipoAtivo] = useState<TipoEquipamento>("extintor");
  const [extintores, setExtintores] = useState<ExtintorMobile[]>([]);
  const [hidrantes, setHidrantes] = useState<HidranteMobile[]>([]);
  const [filter, setFilter] = useState("");
  const [tab, setTab] = useState<"todas" | "pendentes" | "concluidas">("todas");
  const [selected, setSelected] = useState<ExtintorMobile | null>(null);
  const [selectedHidrante, setSelectedHidrante] = useState<HidranteMobile | null>(null);
  const [checklist, setChecklist] = useState<ChecklistData>(CHECKLIST_INITIAL);
  const [hidranteChecklist, setHidranteChecklist] = useState<HidranteChecklistData>(HIDRANTE_CHECKLIST_INITIAL);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [conferidosNoMesIds, setConferidosNoMesIds] = useState<Set<string>>(new Set());
  const [ultimoChecklistMes, setUltimoChecklistMes] = useState<Map<string, ChecklistMesRow>>(new Map());
  const [conferidosHidranteMesIds, setConferidosHidranteMesIds] = useState<Set<string>>(new Set());
  const [ultimoChecklistHidranteMes, setUltimoChecklistHidranteMes] = useState<
    Map<string, ChecklistHidranteMesRow>
  >(new Map());
  const [conferenteNome, setConferenteNome] = useState("");
  const [extintorChecklistFields, setExtintorChecklistFields] = useState<
    { key: string; label: string }[]
  >([]);
  const [hidranteChecklistFields, setHidranteChecklistFields] = useState<
    { key: string; label: string }[]
  >([]);

  const supabase = useMemo(() => getSupabaseClient(), []);

  useEffect(() => {
    let cancelled = false;
    const loadQuestions = async () => {
      const [extRows, hidRows] = await Promise.all([
        fetchChecklistQuestionsForBase(activeBaseId, "extintor"),
        fetchChecklistQuestionsForBase(activeBaseId, "hidrante"),
      ]);
      if (cancelled) return;
      setExtintorChecklistFields(extRows.map((row) => ({ key: row.item_key, label: row.label })));
      setHidranteChecklistFields(hidRows.map((row) => ({ key: row.item_key, label: row.label })));
    };
    void loadQuestions();
    return () => {
      cancelled = true;
    };
  }, [activeBaseId]);

  const currentMonthRange = useMemo(() => getLocalCalendarMonthUtcIsoRange(), []);

  const extintoresOrdenados = useMemo(() => {
    return [...extintores].sort((a, b) => compareCodigo(a.codigo, b.codigo));
  }, [extintores]);

  const hidrantesOrdenados = useMemo(() => {
    return [...hidrantes].sort((a, b) => compareCodigo(a.codigo, b.codigo));
  }, [hidrantes]);

  const ordemGlobalPorId = useMemo(() => {
    const m = new Map<string, number>();
    const list = tipoAtivo === "extintor" ? extintoresOrdenados : hidrantesOrdenados;
    list.forEach((e, i) => m.set(e.id, i + 1));
    return m;
  }, [extintoresOrdenados, hidrantesOrdenados, tipoAtivo]);

  useEffect(() => {
    if (!ready || !activeBaseId) return;

    const load = async () => {
      await getCurrentSession();
      const { data, error } = await supabase
        .from("extintores")
        .select(
          "id,codigo,setor,local_detalhado,num_inmetro,tipo,tamanho,pavimento,manutencao_2_nivel,manutencao_3_nivel,capacidade_extintora",
        )
        .eq("base_id", activeBaseId)
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

      const [extCh, hidCh] = await Promise.all([
        fetchChecklistsExtintoresDoMes(
          supabase,
          currentMonthRange.startIso,
          currentMonthRange.endInclusiveIso,
          activeBaseId,
        ),
        fetchChecklistsHidrantesDoMes(
          supabase,
          currentMonthRange.startIso,
          currentMonthRange.endInclusiveIso,
          activeBaseId,
        ),
      ]);
      if (extCh.ok) {
        setConferidosNoMesIds(new Set(extCh.rows.map((r) => r.extintor_id).filter(Boolean)));
        setUltimoChecklistMes(buildUltimoChecklistPorExtintor(extCh.rows));
      }
      if (hidCh.ok) {
        setConferidosHidranteMesIds(new Set(hidCh.rows.map((r) => r.hidrante_id).filter(Boolean)));
        setUltimoChecklistHidranteMes(buildUltimoChecklistPorHidrante(hidCh.rows));
      }

      const { data: hidData, error: hidError } = await supabase
        .from("hidrantes")
        .select(
          "id,codigo,pavimento,local_detalhado,quantidade_mangueiras,teste_hidrostatico_m1,teste_hidrostatico_m2,teste_hidrostatico_m3,teste_hidrostatico_m4,quantidade_chaves_storz,quantidade_esguichos",
        )
        .eq("base_id", activeBaseId)
        .order("codigo", { ascending: true });

      if (!hidError) {
        const loadedHid = (hidData ?? []) as HidranteMobile[];
        setHidrantes(loadedHid);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(HIDRANTES_CACHE_KEY, JSON.stringify(loadedHid));
        }
      } else if (typeof window !== "undefined") {
        const cachedHid = window.localStorage.getItem(HIDRANTES_CACHE_KEY);
        if (cachedHid) setHidrantes(JSON.parse(cachedHid) as HidranteMobile[]);
      }
    };
    void load();
  }, [supabase, currentMonthRange.startIso, currentMonthRange.endInclusiveIso, ready, activeBaseId]);

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
    if (!ready || !activeBaseId) return;
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
            activeBaseId,
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
  }, [currentMonthRange.endInclusiveIso, currentMonthRange.startIso, supabase, ready, activeBaseId]);

  useEffect(() => {
    if (!ready || !activeBaseId) return;
    const channel = supabase
      .channel("mobile-conferencia-hidrantes-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "checklists_hidrantes" },
        () => {
          void fetchChecklistsHidrantesDoMes(
            supabase,
            currentMonthRange.startIso,
            currentMonthRange.endInclusiveIso,
            activeBaseId,
          ).then(({ ok, rows }) => {
            if (!ok) return;
            setConferidosHidranteMesIds(new Set(rows.map((r) => r.hidrante_id).filter(Boolean)));
            setUltimoChecklistHidranteMes(buildUltimoChecklistPorHidrante(rows));
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentMonthRange.endInclusiveIso, currentMonthRange.startIso, supabase, ready, activeBaseId]);

  useEffect(() => {
    const loadConferente = async () => {
      try {
        const session = await getCurrentSession();
        if (!session) return;
        const profile = await getProfileBySession(session);
        const nome = resolveConferenteNome(session, profile);
        if (!nome) return;
        setConferenteNome(nome);
        setChecklist((prev) => ({
          ...prev,
          conferente: !prev.conferente.trim() || isCargoLabel(prev.conferente) ? nome : prev.conferente,
        }));
        setHidranteChecklist((prev) => ({
          ...prev,
          conferente: !prev.conferente.trim() || isCargoLabel(prev.conferente) ? nome : prev.conferente,
        }));
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

  const visiveisHidrantes = useMemo(() => {
    const q = filter.toLowerCase().trim();
    let list = hidrantesOrdenados;
    if (tab === "pendentes") list = list.filter((i) => !conferidosHidranteMesIds.has(i.id));
    if (tab === "concluidas") list = list.filter((i) => conferidosHidranteMesIds.has(i.id));
    if (!q) return list;
    return list.filter(
      (item) =>
        item.codigo.toLowerCase().includes(q) ||
        (item.pavimento ?? "").toLowerCase().includes(q) ||
        item.local_detalhado.toLowerCase().includes(q),
    );
  }, [hidrantesOrdenados, filter, tab, conferidosHidranteMesIds]);

  async function submitChecklist(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || !activeBaseId) return;
    setSaving(true);

    const fieldKeys = extintorChecklistFields.map((field) => field.key);
    const fieldLabels = Object.fromEntries(
      extintorChecklistFields.map((field) => [field.key, field.label]),
    );
    const observacoesFinal = mergeObservacoesComNaoConformidades(checklist, fieldLabels);
    const answersJson = buildChecklistAnswersJson(checklist, fieldKeys);

    const session = await getCurrentSession();
    const profile = session ? await getProfileBySession(session) : null;
    const conferente =
      resolveConferenteNome(session, profile, checklist.conferente) || conferenteNome.trim();
    if (!conferente) {
      setSaving(false);
      return;
    }

    const payloadNovo = {
      extintor_id: selected.id,
      base_id: activeBaseId,
      data_conferencia: new Date().toISOString(),
      conferente,
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
      answers_json: answersJson,
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
      const observacoesLegado = buildObservacoesLegadoApenasNaoConformidades(observacoesFinal, checklist);

      const payloadLegado = {
        extintor_id: selected.id,
        base_id: activeBaseId,
        data_conferencia: new Date().toISOString(),
        conferente,
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

  async function submitHidranteChecklist(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedHidrante || !activeBaseId) return;
    setSaving(true);

    const hidFieldKeys = hidranteChecklistFields.map((field) => field.key);
    const hidFieldLabels = Object.fromEntries(
      hidranteChecklistFields.map((field) => [field.key, field.label]),
    );
    const observacoesFinal = mergeHidranteObservacoes(hidranteChecklist, hidFieldLabels);
    const answersJson = buildHidranteAnswersJson(hidranteChecklist, hidFieldKeys);
    const session = await getCurrentSession();
    const profile = session ? await getProfileBySession(session) : null;
    const conferente =
      resolveConferenteNome(session, profile, hidranteChecklist.conferente) || conferenteNome.trim();
    if (!conferente) {
      setSaving(false);
      return;
    }

    const payload = {
      hidrante_id: selectedHidrante.id,
      base_id: activeBaseId,
      data_conferencia: new Date().toISOString(),
      conferente,
      acesso_desobstruido: hidranteChecklist.acesso_desobstruido,
      identificacao_sinalizacao: hidranteChecklist.identificacao_sinalizacao,
      mangueira_esguicho: hidranteChecklist.mangueira_esguicho,
      valvulas_registros: hidranteChecklist.valvulas_registros,
      pressao_abastecimento: hidranteChecklist.pressao_abastecimento,
      gabinete_caixa: hidranteChecklist.gabinete_caixa,
      hidrante_integridade: hidranteChecklist.hidrante_integridade,
      documentacao_acesso: hidranteChecklist.documentacao_acesso,
      answers_json: answersJson,
      observacoes: observacoesFinal || null,
    } as Record<string, unknown>;

    let finalError: { message?: string } | null = null;
    if (typeof navigator !== "undefined" && navigator.onLine) {
      const { error } = await supabase.from("checklists_hidrantes").insert(payload);
      finalError = error;
    } else {
      finalError = { message: "offline" };
    }

    setSaving(false);
    if (finalError) {
      const offline = typeof navigator !== "undefined" && !navigator.onLine;
      if (offline && typeof window !== "undefined") {
        const raw = window.localStorage.getItem(PENDING_HIDRANTE_CHECKLISTS_KEY);
        const queue = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
        queue.push(payload);
        window.localStorage.setItem(PENDING_HIDRANTE_CHECKLISTS_KEY, JSON.stringify(queue));
        setConferidosHidranteMesIds((prev) => new Set([...prev, selectedHidrante.id]));
        setMessage("Sem internet: inspeção do hidrante salva localmente.");
        setSelectedHidrante(null);
        setHidranteChecklist({ ...HIDRANTE_CHECKLIST_INITIAL, conferente: conferenteNome });
        setTimeout(() => setMessage(""), 4500);
        return;
      }
      setMessage(`Erro ao salvar: ${finalError.message}`);
      return;
    }

    setConferidosHidranteMesIds((prev) => new Set([...prev, selectedHidrante.id]));
    setMessage(`✓ Inspeção registrada para ${selectedHidrante.codigo}`);
    setSelectedHidrante(null);
    setHidranteChecklist({ ...HIDRANTE_CHECKLIST_INITIAL, conferente: conferenteNome });
    setTimeout(() => setMessage(""), 4000);
  }

  function handleTipoChange(tipo: TipoEquipamento) {
    setTipoAtivo(tipo);
    setFilter("");
    setSelected(null);
    setSelectedHidrante(null);
    setMessage("");
  }

  return (
    <div className="space-y-4">
      <div className="reveal-up overflow-hidden rounded-[1.75rem] bg-white shadow-[var(--shadow-soft)]">
        <div className="relative overflow-hidden bg-[var(--forest)] px-4 py-5 text-white">
          <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-[var(--neon)]/25 blur-2xl" />
          <p className="relative text-[10px] font-black uppercase tracking-[0.24em] text-[var(--neon)]">Operação</p>
          <h2 className="font-display relative mt-1 text-xl font-extrabold tracking-tight">
            {isAdminLista ? "Checklist" : "Inspeções"}
          </h2>
          <p className="relative mt-1 text-xs font-medium text-slate-300">
            {extintores.length} extintores · {hidrantes.length} hidrantes
          </p>
        </div>
        <div className="border-b border-slate-100 px-4 py-3">
          <InventarioTipoTabs
            value={tipoAtivo}
            onChange={handleTipoChange}
            extintoresCount={extintores.length}
            hidrantesCount={hidrantes.length}
          />
        </div>
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--muted)] px-4 py-2.5">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#8a9a91" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" />
              <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="search"
              placeholder={
                tipoAtivo === "extintor"
                  ? "Buscar por código, setor ou local..."
                  : "Buscar hidrante por código, pavimento ou local..."
              }
              className="flex-1 bg-transparent text-sm text-[var(--ink)] placeholder:text-[var(--muted-foreground)] focus:outline-none"
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
                color: tab === t ? "var(--forest)" : "#667085",
                borderBottom: tab === t ? "2px solid var(--forest)" : "2px solid transparent",
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
        {tipoAtivo === "extintor" && visiveis.length === 0 && (
          <div className="surface-card px-4 py-10 text-center text-sm text-slate-400">
            Nenhum extintor encontrado.
          </div>
        )}

        {tipoAtivo === "hidrante" && visiveisHidrantes.length === 0 && (
          <div className="surface-card px-4 py-10 text-center text-sm text-slate-400">
            Nenhum hidrante encontrado.
          </div>
        )}

        {tipoAtivo === "extintor" &&
          visiveis.map((item) => {
            const ordem = ordemGlobalPorId.get(item.id) ?? 0;
            const conferidoNoMes = conferidosNoMesIds.has(item.id);
            const ultimo = ultimoChecklistMes.get(item.id);
            const temNc = ultimo ? checklistTemNaoConformidade(ultimo) : false;
            const manutVencida = isVencido(item.manutencao_2_nivel) || isVencido(item.manutencao_3_nivel);
            const testeN2Vencido = isDataVencida(item.manutencao_2_nivel);
            const variant: "ok" | "pendente" | "alerta" =
              temNc || testeN2Vencido ? "alerta" : conferidoNoMes ? "ok" : "pendente";

            return (
              <InspecaoListaItem
                key={item.id}
                ordem={ordem}
                codigo={item.codigo}
                localDetalhado={item.local_detalhado}
                metaLine={`${item.setor}${item.pavimento ? ` · ${item.pavimento}` : ""} · ${item.tipo} ${item.tamanho}`}
                avisoVencimento={
                  manutVencida ? "Atenção: manutenção nível 2 ou 3 vencida" : null
                }
                conferidoNoMes={conferidoNoMes}
                temNc={temNc}
                icon={<ExtintorIcon variant={variant} />}
                onClick={() => {
                  setSelected(item);
                  setChecklist({ ...CHECKLIST_INITIAL, conferente: conferenteNome, detalhesNaoConformidade: {} });
                  setMessage("");
                }}
              />
            );
          })}

        {tipoAtivo === "hidrante" &&
          visiveisHidrantes.map((item) => {
            const ordem = ordemGlobalPorId.get(item.id) ?? 0;
            const conferidoNoMes = conferidosHidranteMesIds.has(item.id);
            const ultimo = ultimoChecklistHidranteMes.get(item.id);
            const temNc = ultimo
              ? hidranteChecklistTemNaoConformidade(ultimo as Record<string, string | null>)
              : false;
            const mangueiraVencida = hidranteTemMangueiraVencida(item);
            const variant: "ok" | "pendente" | "alerta" =
              temNc || mangueiraVencida ? "alerta" : conferidoNoMes ? "ok" : "pendente";

            return (
              <InspecaoListaItem
                key={item.id}
                ordem={ordem}
                codigo={item.codigo}
                localDetalhado={item.local_detalhado}
                metaLine={formatHidranteMetaLine(item)}
                avisoVencimento={
                  mangueiraVencida ? "Atenção: mangueira com teste hidrostático vencido" : null
                }
                conferidoNoMes={conferidoNoMes}
                temNc={temNc}
                icon={<HidranteIcon variant={variant} />}
                onClick={() => {
                  setSelectedHidrante(item);
                  setHidranteChecklist({
                    ...HIDRANTE_CHECKLIST_INITIAL,
                    conferente: conferenteNome,
                    detalhesNaoConformidade: {},
                  });
                  setMessage("");
                }}
              />
            );
          })}
      </div>

      {selected && (
        <div className="modal-layer fixed inset-0 flex items-end bg-[var(--forest)]/60 backdrop-blur-sm">
          <div
            className="relative w-full rounded-t-3xl bg-white px-5 pt-5 shadow-2xl shadow-[var(--forest)]/30"
            style={{ maxHeight: "95vh", overflowY: "auto", paddingBottom: "env(safe-area-inset-bottom, 20px)" }}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-200" />
            <ModalCloseButton
              onClick={() => setSelected(null)}
              className="absolute right-4 top-4"
            />
            <ChecklistForm
              data={checklist}
              onChange={setChecklist}
              onSubmit={submitChecklist}
              onCancel={() => setSelected(null)}
              isSaving={saving}
              fields={extintorChecklistFields}
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

      {selectedHidrante && (
        <div className="modal-layer fixed inset-0 flex items-end bg-[var(--forest)]/60 backdrop-blur-sm">
          <div
            className="relative w-full rounded-t-3xl bg-white px-5 pt-5 shadow-2xl shadow-[var(--forest)]/30"
            style={{ maxHeight: "95vh", overflowY: "auto", paddingBottom: "env(safe-area-inset-bottom, 20px)" }}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-200" />
            <ModalCloseButton
              onClick={() => setSelectedHidrante(null)}
              className="absolute right-4 top-4"
            />
            <HidranteChecklistForm
              data={hidranteChecklist}
              onChange={setHidranteChecklist}
              onSubmit={submitHidranteChecklist}
              onCancel={() => setSelectedHidrante(null)}
              isSaving={saving}
              fields={hidranteChecklistFields}
              hidrante={selectedHidrante}
            />
          </div>
        </div>
      )}
    </div>
  );
}
