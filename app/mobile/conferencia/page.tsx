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
import { EquipmentStatusIcon } from "@/src/components/EquipmentIcons";
import { fetchChecklistQuestionsForBase } from "@/lib/checklist/questions-client";
import {
  CHECKLIST_INITIAL,
  CHECKLIST_ITEM_KEYS,
  checklistTemNaoConformidade,
  getChecklistAnswer,
  isDataVencida,
  type ChecklistData,
  type ChecklistItemKey,
} from "@/lib/checklist/types";
import { DEFAULT_EXTINTOR_QUESTION_LABELS } from "@/lib/checklist/default-questions";
import {
  buildExtintorChecklistPayload,
  buildHidranteChecklistPayload,
  insertExtintorChecklist,
  insertHidranteChecklist,
} from "@/lib/checklist/insert-checklist";
import {
  HIDRANTE_ACTIVE_ITEM_KEYS,
  HIDRANTE_CHECKLIST_INITIAL,
  HIDRANTE_ITEM_LABELS,
  getHidranteAnswer,
  hidranteChecklistTemNaoConformidade,
  type HidranteChecklistData,
  type HidranteItemKey,
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

type ChecklistFieldDef = { key: string; label: string };

function defaultExtintorFields(): ChecklistFieldDef[] {
  return CHECKLIST_ITEM_KEYS.map((key) => ({
    key,
    label: DEFAULT_EXTINTOR_QUESTION_LABELS[key],
  }));
}

function defaultHidranteFields(): ChecklistFieldDef[] {
  return HIDRANTE_ACTIVE_ITEM_KEYS.map((key) => ({
    key,
    label: HIDRANTE_ITEM_LABELS[key as HidranteItemKey],
  }));
}

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
  const [extintorChecklistFields, setExtintorChecklistFields] = useState<ChecklistFieldDef[]>([]);
  const [hidranteChecklistFields, setHidranteChecklistFields] = useState<ChecklistFieldDef[]>([]);
  const [activeExtintorFields, setActiveExtintorFields] = useState<ChecklistFieldDef[]>([]);
  const [activeHidranteFields, setActiveHidranteFields] = useState<ChecklistFieldDef[]>([]);
  const [messageIsError, setMessageIsError] = useState(false);

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
    if (!selected) {
      setMessageIsError(true);
      setMessage("Selecione um extintor para inspecionar.");
      return;
    }

    setSaving(true);
    setMessage("");
    setMessageIsError(false);

    try {
      let baseId = activeBaseId;
      if (!baseId) {
        const { data: extRow } = await supabase
          .from("extintores")
          .select("base_id")
          .eq("id", selected.id)
          .maybeSingle();
        baseId = extRow?.base_id ? String(extRow.base_id) : null;
      }

      if (!baseId) {
        setMessageIsError(true);
        setMessage("Base ativa não encontrada. Selecione uma base e tente novamente.");
        return;
      }

      const session = await getCurrentSession();
      if (!session) {
        setMessageIsError(true);
        setMessage("Sessão expirada. Faça login novamente para salvar a inspeção.");
        return;
      }

      const profile = await getProfileBySession(session).catch(() => null);
      const conferente =
        resolveConferenteNome(session, profile, checklist.conferente) || conferenteNome.trim();
      if (!conferente) {
        setMessageIsError(true);
        setMessage("Informe o nome do conferente.");
        return;
      }

      const fields =
        activeExtintorFields.length > 0 ? activeExtintorFields : defaultExtintorFields();
      const fieldLabels = Object.fromEntries(fields.map((field) => [field.key, field.label]));

      const offline = typeof navigator !== "undefined" && !navigator.onLine;
      if (offline) {
        const payload = buildExtintorChecklistPayload({
          extintorId: selected.id,
          baseId,
          conferente,
          data: checklist,
          fieldKeys: fields.map((field) => field.key),
          fieldLabels,
        });
        const raw = window.localStorage.getItem(PENDING_CHECKLISTS_KEY);
        const queue = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
        queue.push(payload);
        window.localStorage.setItem(PENDING_CHECKLISTS_KEY, JSON.stringify(queue));
        markExtintorConferidoLocal(selected.id, checklist, String(payload.data_conferencia));
        setMessage("Sem internet: conferência salva localmente e será sincronizada ao reconectar.");
        setSelected(null);
        setChecklist({ ...CHECKLIST_INITIAL, conferente: conferenteNome, detalhesNaoConformidade: {} });
        setTimeout(() => setMessage(""), 4500);
        return;
      }

      const { ok, error, payload } = await insertExtintorChecklist(supabase, {
        extintorId: selected.id,
        baseId,
        conferente,
        data: checklist,
        fieldKeys: fields.map((field) => field.key),
        fieldLabels,
      });

      if (!ok) {
        setMessageIsError(true);
        setMessage(`Erro ao salvar: ${error?.message ?? "Falha desconhecida"}`);
        return;
      }

      markExtintorConferidoLocal(selected.id, checklist, String(payload.data_conferencia));
      setMessage(`✓ Inspeção registrada para ${selected.codigo}`);
      setSelected(null);
      setChecklist({ ...CHECKLIST_INITIAL, conferente: conferenteNome, detalhesNaoConformidade: {} });
      setTimeout(() => setMessage(""), 4000);
    } catch (err) {
      setMessageIsError(true);
      setMessage(err instanceof Error ? err.message : "Erro inesperado ao salvar a inspeção.");
    } finally {
      setSaving(false);
    }
  }

  async function submitHidranteChecklist(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedHidrante) {
      setMessageIsError(true);
      setMessage("Selecione um hidrante para inspecionar.");
      return;
    }

    setSaving(true);
    setMessage("");
    setMessageIsError(false);

    try {
      let baseId = activeBaseId;
      if (!baseId) {
        const { data: hidRow } = await supabase
          .from("hidrantes")
          .select("base_id")
          .eq("id", selectedHidrante.id)
          .maybeSingle();
        baseId = hidRow?.base_id ? String(hidRow.base_id) : null;
      }

      if (!baseId) {
        setMessageIsError(true);
        setMessage("Base ativa não encontrada. Selecione uma base e tente novamente.");
        return;
      }

      const session = await getCurrentSession();
      if (!session) {
        setMessageIsError(true);
        setMessage("Sessão expirada. Faça login novamente para salvar a inspeção.");
        return;
      }

      const profile = await getProfileBySession(session).catch(() => null);
      const conferente =
        resolveConferenteNome(session, profile, hidranteChecklist.conferente) ||
        conferenteNome.trim();
      if (!conferente) {
        setMessageIsError(true);
        setMessage("Informe o nome do conferente.");
        return;
      }

      const fields =
        activeHidranteFields.length > 0 ? activeHidranteFields : defaultHidranteFields();
      const fieldLabels = Object.fromEntries(fields.map((field) => [field.key, field.label]));

      const offline = typeof navigator !== "undefined" && !navigator.onLine;
      if (offline) {
        const payload = buildHidranteChecklistPayload({
          hidranteId: selectedHidrante.id,
          baseId,
          conferente,
          data: hidranteChecklist,
          fieldKeys: fields.map((field) => field.key),
          fieldLabels,
        });
        const raw = window.localStorage.getItem(PENDING_HIDRANTE_CHECKLISTS_KEY);
        const queue = raw ? (JSON.parse(raw) as Array<Record<string, unknown>>) : [];
        queue.push(payload);
        window.localStorage.setItem(PENDING_HIDRANTE_CHECKLISTS_KEY, JSON.stringify(queue));
        markHidranteConferidoLocal(
          selectedHidrante.id,
          hidranteChecklist,
          String(payload.data_conferencia),
        );
        setMessage("Sem internet: inspeção do hidrante salva localmente.");
        setSelectedHidrante(null);
        setHidranteChecklist({
          ...HIDRANTE_CHECKLIST_INITIAL,
          conferente: conferenteNome,
          detalhesNaoConformidade: {},
        });
        setTimeout(() => setMessage(""), 4500);
        return;
      }

      const { ok, error, payload } = await insertHidranteChecklist(supabase, {
        hidranteId: selectedHidrante.id,
        baseId,
        conferente,
        data: hidranteChecklist,
        fieldKeys: fields.map((field) => field.key),
        fieldLabels,
      });

      if (!ok) {
        setMessageIsError(true);
        setMessage(`Erro ao salvar: ${error?.message ?? "Falha desconhecida"}`);
        return;
      }

      markHidranteConferidoLocal(
        selectedHidrante.id,
        hidranteChecklist,
        String(payload.data_conferencia),
      );
      setMessage(`✓ Inspeção registrada para ${selectedHidrante.codigo}`);
      setSelectedHidrante(null);
      setHidranteChecklist({
        ...HIDRANTE_CHECKLIST_INITIAL,
        conferente: conferenteNome,
        detalhesNaoConformidade: {},
      });
      setTimeout(() => setMessage(""), 4000);
    } catch (err) {
      setMessageIsError(true);
      setMessage(err instanceof Error ? err.message : "Erro inesperado ao salvar a inspeção.");
    } finally {
      setSaving(false);
    }
  }
  function markExtintorConferidoLocal(
    extintorId: string,
    data: ChecklistData,
    dataConferencia: string,
  ) {
    setConferidosNoMesIds((prev) => new Set([...prev, extintorId]));
    setUltimoChecklistMes((prev) => {
      const next = new Map(prev);
      next.set(extintorId, {
        extintor_id: extintorId,
        data_conferencia: dataConferencia,
        local_correto: getChecklistAnswer(data, "local_correto"),
        dados_corretos: getChecklistAnswer(data, "dados_corretos"),
        sinalizacao_correta: getChecklistAnswer(data, "sinalizacao_correta"),
        mangueira_status: getChecklistAnswer(data, "mangueira_status"),
        bico_difusor_status: getChecklistAnswer(data, "bico_difusor_status"),
        alca_gatilho_status: getChecklistAnswer(data, "alca_gatilho_status"),
        medidor_pressao_status: getChecklistAnswer(data, "medidor_pressao_status"),
        cilindro_status: getChecklistAnswer(data, "cilindro_status"),
      });
      return next;
    });
  }

  function markHidranteConferidoLocal(
    hidranteId: string,
    data: HidranteChecklistData,
    dataConferencia: string,
  ) {
    setConferidosHidranteMesIds((prev) => new Set([...prev, hidranteId]));
    setUltimoChecklistHidranteMes((prev) => {
      const next = new Map(prev);
      next.set(hidranteId, {
        hidrante_id: hidranteId,
        data_conferencia: dataConferencia,
        acesso_desobstruido: getHidranteAnswer(data, "acesso_desobstruido"),
        identificacao_sinalizacao: getHidranteAnswer(data, "identificacao_sinalizacao"),
        mangueira_esguicho: getHidranteAnswer(data, "mangueira_esguicho"),
        valvulas_registros: getHidranteAnswer(data, "valvulas_registros"),
        pressao_abastecimento: getHidranteAnswer(data, "pressao_abastecimento"),
        gabinete_caixa: getHidranteAnswer(data, "gabinete_caixa"),
        hidrante_integridade: getHidranteAnswer(data, "hidrante_integridade"),
        documentacao_acesso: getHidranteAnswer(data, "documentacao_acesso"),
      });
      return next;
    });
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
        <div
          className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold ${
            messageIsError
              ? "border-red-200 bg-red-50 text-red-800"
              : "status-success-soft border-green-100"
          }`}
        >
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
                icon={<EquipmentStatusIcon kind="extintor" variant={variant} />}
                onClick={() => {
                  setActiveExtintorFields(
                    extintorChecklistFields.length > 0
                      ? extintorChecklistFields
                      : defaultExtintorFields(),
                  );
                  setSelected(item);
                  setChecklist({
                    ...CHECKLIST_INITIAL,
                    conferente: conferenteNome,
                    detalhesNaoConformidade: {},
                  });
                  setMessage("");
                  setMessageIsError(false);
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
                icon={<EquipmentStatusIcon kind="hidrante" variant={variant} />}
                onClick={() => {
                  setActiveHidranteFields(
                    hidranteChecklistFields.length > 0
                      ? hidranteChecklistFields
                      : defaultHidranteFields(),
                  );
                  setSelectedHidrante(item);
                  setHidranteChecklist({
                    ...HIDRANTE_CHECKLIST_INITIAL,
                    conferente: conferenteNome,
                    detalhesNaoConformidade: {},
                  });
                  setMessage("");
                  setMessageIsError(false);
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
              fields={activeExtintorFields}
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
              fields={activeHidranteFields}
              hidrante={selectedHidrante}
            />
          </div>
        </div>
      )}
    </div>
  );
}
