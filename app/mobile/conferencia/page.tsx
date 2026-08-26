"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { TipoEquipamento } from "@/lib/inventario/equipamento-padrao";
import type { ExtintorImportRecord } from "@/lib/rf01/import-parser";
import ChecklistForm from "@/src/components/ChecklistForm";
import HidranteChecklistForm from "@/src/components/HidranteChecklistForm";
import ModalCloseButton from "@/src/components/ModalCloseButton";
import { EquipmentStatusIcon } from "@/src/components/EquipmentIcons";
import InspecaoEquipmentCard, { type InspecaoCardStatus } from "@/src/components/mobile/InspecaoEquipmentCard";
import { formatEquipmentIdentifier } from "@/lib/map/marker-label";
import InspecaoDraftPrompt from "@/src/components/mobile/InspecaoDraftPrompt";
import InspecaoFiltersPanel from "@/src/components/mobile/InspecaoFiltersPanel";
import InspecaoStatusTabs from "@/src/components/mobile/InspecaoStatusTabs";
import InspecaoTipoSelector from "@/src/components/mobile/InspecaoTipoSelector";
import { fetchChecklistQuestionsForBase } from "@/lib/checklist/questions-client";
import {
  CHECKLIST_INITIAL,
  CHECKLIST_ITEM_KEYS,
  buildChecklistAnswersJson,
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
  buildHidranteAnswersJson,
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
import {
  clearInspecaoDraft,
  getInspecaoDraftIndexEntry,
  getLatestInspecaoDraft,
  isDraftIncomplete,
  loadInspecaoDraft,
  type DraftIndexEntry,
  type InspecaoDraftField,
  type InspecaoDraftKind,
} from "@/lib/inspecao/draft-storage";
import { useInspecaoDraftPersistence } from "@/lib/inspecao/use-inspecao-draft-persistence";
import {
  countActiveInspecaoFilters,
  DEFAULT_INSPECAO_FILTERS,
  type InspecaoFilters,
  type InspecaoOrdenacao,
  type InspecaoStatusFilter,
  type InspecaoStatusTab,
} from "@/lib/inspecao/filter-types";

type ExtintorMobile = Pick<
  ExtintorImportRecord,
  "codigo" | "setor" | "local_detalhado" | "num_inmetro" | "tipo" | "tamanho"
> & {
  id: string;
  pavimento: string | null;
  manutencao_2_nivel: string | null;
  manutencao_3_nivel: string | null;
  capacidade_extintora: string;
  num_cilindro?: string | null;
};

type HidranteMobile = HidranteImportRow & { id: string };

const EXTINTORES_CACHE_KEY = "extintores_cache_v1";
const HIDRANTES_CACHE_KEY = "hidrantes_cache_v1";
const PENDING_CHECKLISTS_KEY = "pending_checklists_v1";
const PENDING_HIDRANTE_CHECKLISTS_KEY = "pending_hidrante_checklists_v1";

type ChecklistFieldDef = InspecaoDraftField;

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

function matchesExtintorSearch(item: ExtintorMobile, q: string): boolean {
  if (!q) return true;
  const fields = [
    item.codigo,
    item.setor,
    item.local_detalhado,
    item.pavimento,
    item.tipo,
    item.tamanho,
    item.num_inmetro,
    item.num_cilindro,
    item.capacidade_extintora,
  ];
  return fields.some((value) => (value ?? "").toLowerCase().includes(q));
}

function matchesHidranteSearch(item: HidranteMobile, q: string): boolean {
  if (!q) return true;
  const fields = [item.codigo, item.pavimento, item.local_detalhado];
  return fields.some((value) => (value ?? "").toLowerCase().includes(q));
}

function matchesStatusFilter(
  conferido: boolean,
  temNc: boolean,
  status: InspecaoStatusFilter,
): boolean {
  if (status === "all") return true;
  if (status === "pendente") return !conferido;
  if (status === "concluido") return conferido && !temNc;
  if (status === "nao_conforme") return temNc;
  return true;
}

function sortExtintores(list: ExtintorMobile[], ordenacao: InspecaoOrdenacao): ExtintorMobile[] {
  const sorted = [...list];
  if (ordenacao === "codigo") {
    sorted.sort((a, b) => compareCodigo(a.codigo, b.codigo));
  } else if (ordenacao === "setor") {
    sorted.sort((a, b) =>
      (a.local_detalhado || a.setor).localeCompare(b.local_detalhado || b.setor, "pt-BR"),
    );
  } else {
    sorted.sort((a, b) =>
      (a.pavimento ?? "").localeCompare(b.pavimento ?? "", "pt-BR") || compareCodigo(a.codigo, b.codigo),
    );
  }
  return sorted;
}

function sortHidrantes(list: HidranteMobile[], ordenacao: InspecaoOrdenacao): HidranteMobile[] {
  const sorted = [...list];
  if (ordenacao === "codigo") {
    sorted.sort((a, b) => compareCodigo(a.codigo, b.codigo));
  } else if (ordenacao === "setor") {
    sorted.sort((a, b) => a.local_detalhado.localeCompare(b.local_detalhado, "pt-BR"));
  } else {
    sorted.sort((a, b) =>
      (a.pavimento ?? "").localeCompare(b.pavimento ?? "", "pt-BR") || compareCodigo(a.codigo, b.codigo),
    );
  }
  return sorted;
}

export default function MobileConferenciaPage() {
  const pathname = usePathname();
  const isAdminLista = pathname?.includes("/admin/inspecoes-lista") ?? false;
  const { ready, activeBaseId } = useActiveBase();
  const [tipoAtivo, setTipoAtivo] = useState<TipoEquipamento>("extintor");
  const [extintores, setExtintores] = useState<ExtintorMobile[]>([]);
  const [hidrantes, setHidrantes] = useState<HidranteMobile[]>([]);
  const [filter, setFilter] = useState("");
  const [advancedFilters, setAdvancedFilters] = useState<InspecaoFilters>(DEFAULT_INSPECAO_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [tab, setTab] = useState<InspecaoStatusTab>("todas");
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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [extintorChecklistFields, setExtintorChecklistFields] = useState<ChecklistFieldDef[]>([]);
  const [hidranteChecklistFields, setHidranteChecklistFields] = useState<ChecklistFieldDef[]>([]);
  const [activeExtintorFields, setActiveExtintorFields] = useState<ChecklistFieldDef[]>([]);
  const [activeHidranteFields, setActiveHidranteFields] = useState<ChecklistFieldDef[]>([]);
  const [messageIsError, setMessageIsError] = useState(false);
  const [draftSavedVisible, setDraftSavedVisible] = useState(false);
  const [pendingDraftEntry, setPendingDraftEntry] = useState<DraftIndexEntry | null>(null);

  const supabase = useMemo(() => getSupabaseClient(), []);
  const draftSavedTimerRef = useRef<number | null>(null);

  const handleDraftSaved = useCallback(() => {
    setDraftSavedVisible(true);
    if (draftSavedTimerRef.current !== null) {
      window.clearTimeout(draftSavedTimerRef.current);
    }
    draftSavedTimerRef.current = window.setTimeout(() => setDraftSavedVisible(false), 2200);
  }, []);

  useInspecaoDraftPersistence({
    active: Boolean(selected),
    userId: currentUserId,
    baseId: activeBaseId,
    kind: "extintor",
    equipmentId: selected?.id ?? null,
    equipmentCodigo: selected?.codigo ?? null,
    checklistData: checklist,
    activeFields: activeExtintorFields,
    onDraftSaved: handleDraftSaved,
  });

  useInspecaoDraftPersistence({
    active: Boolean(selectedHidrante),
    userId: currentUserId,
    baseId: activeBaseId,
    kind: "hidrante",
    equipmentId: selectedHidrante?.id ?? null,
    equipmentCodigo: selectedHidrante?.codigo ?? null,
    checklistData: hidranteChecklist,
    activeFields: activeHidranteFields,
    onDraftSaved: handleDraftSaved,
  });

  useEffect(() => {
    if (selected || selectedHidrante) {
      document.body.dataset.inspectionActive = "true";
    } else {
      delete document.body.dataset.inspectionActive;
    }
    return () => {
      delete document.body.dataset.inspectionActive;
    };
  }, [selected, selectedHidrante]);

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

  const extPendentesCount = useMemo(
    () => extintores.filter((item) => !conferidosNoMesIds.has(item.id)).length,
    [extintores, conferidosNoMesIds],
  );

  const extConcluidasCount = extintores.length - extPendentesCount;

  const hidPendentesCount = useMemo(
    () => hidrantes.filter((item) => !conferidosHidranteMesIds.has(item.id)).length,
    [hidrantes, conferidosHidranteMesIds],
  );

  const hidConcluidasCount = hidrantes.length - hidPendentesCount;

  const pavimentos = useMemo(() => {
    const list = tipoAtivo === "extintor" ? extintores : hidrantes;
    return [...new Set(list.map((item) => item.pavimento).filter(Boolean) as string[])].sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    );
  }, [tipoAtivo, extintores, hidrantes]);

  const tiposAgente = useMemo(() => {
    return [...new Set(extintores.map((item) => item.tipo).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    );
  }, [extintores]);

  const capacidades = useMemo(() => {
    return [...new Set(extintores.map((item) => item.tamanho).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    );
  }, [extintores]);

  const activeFilterCount = countActiveInspecaoFilters(advancedFilters);

  useEffect(() => {
    if (!ready || !activeBaseId) return;

    const load = async () => {
      await getCurrentSession();
      const { data, error } = await supabase
        .from("extintores")
        .select(
          "id,codigo,setor,local_detalhado,num_inmetro,num_cilindro,tipo,tamanho,pavimento,manutencao_2_nivel,manutencao_3_nivel,capacidade_extintora",
        )
        .eq("base_id", activeBaseId)
        .eq("active", true)
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
        .eq("active", true)
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
        setCurrentUserId(session.user.id);
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

        const latest = getLatestInspecaoDraft(session.user.id);
        if (latest && latest.baseId === activeBaseId) {
          setPendingDraftEntry(latest);
        }
      } catch {
        // sem bloqueio de fluxo caso falhe
      }
    };
    void loadConferente();
  }, [activeBaseId]);

  const visiveis = useMemo(() => {
    const q = filter.toLowerCase().trim();
    let list = extintoresOrdenados;

    if (tab === "pendentes") list = list.filter((i) => !conferidosNoMesIds.has(i.id));
    if (tab === "concluidas") list = list.filter((i) => conferidosNoMesIds.has(i.id));

    list = list.filter((item) => {
      if (!matchesExtintorSearch(item, q)) return false;
      if (advancedFilters.pavimento && item.pavimento !== advancedFilters.pavimento) return false;
      if (advancedFilters.tipo && item.tipo !== advancedFilters.tipo) return false;
      if (advancedFilters.capacidade && item.tamanho !== advancedFilters.capacidade) return false;

      const conferido = conferidosNoMesIds.has(item.id);
      const ultimo = ultimoChecklistMes.get(item.id);
      const temNc = ultimo ? checklistTemNaoConformidade(ultimo) : false;
      if (!matchesStatusFilter(conferido, temNc, advancedFilters.status)) return false;

      return true;
    });

    return sortExtintores(list, advancedFilters.ordenacao);
  }, [
    extintoresOrdenados,
    filter,
    tab,
    conferidosNoMesIds,
    ultimoChecklistMes,
    advancedFilters,
  ]);

  const visiveisHidrantes = useMemo(() => {
    const q = filter.toLowerCase().trim();
    let list = hidrantesOrdenados;

    if (tab === "pendentes") list = list.filter((i) => !conferidosHidranteMesIds.has(i.id));
    if (tab === "concluidas") list = list.filter((i) => conferidosHidranteMesIds.has(i.id));

    list = list.filter((item) => {
      if (!matchesHidranteSearch(item, q)) return false;
      if (advancedFilters.pavimento && item.pavimento !== advancedFilters.pavimento) return false;

      const conferido = conferidosHidranteMesIds.has(item.id);
      const ultimo = ultimoChecklistHidranteMes.get(item.id);
      const temNc = ultimo
        ? hidranteChecklistTemNaoConformidade(ultimo as Record<string, string | null>)
        : false;
      if (!matchesStatusFilter(conferido, temNc, advancedFilters.status)) return false;

      return true;
    });

    return sortHidrantes(list, advancedFilters.ordenacao);
  }, [
    hidrantesOrdenados,
    filter,
    tab,
    conferidosHidranteMesIds,
    ultimoChecklistHidranteMes,
    advancedFilters,
  ]);

  function openExtintor(item: ExtintorMobile) {
    const fields =
      extintorChecklistFields.length > 0 ? extintorChecklistFields : defaultExtintorFields();
    setActiveExtintorFields(fields);
    setMessage("");
    setMessageIsError(false);

    if (currentUserId && activeBaseId) {
      const draft = loadInspecaoDraft(currentUserId, "extintor", item.id);
      if (draft && draft.baseId === activeBaseId) {
        setSelected(item);
        setChecklist(draft.checklistData as ChecklistData);
        setActiveExtintorFields(draft.activeFields);
        setPendingDraftEntry(null);
        return;
      }
    }

    setSelected(item);
    setChecklist({
      ...CHECKLIST_INITIAL,
      conferente: conferenteNome,
      detalhesNaoConformidade: {},
    });
  }

  function openHidrante(item: HidranteMobile) {
    const fields =
      hidranteChecklistFields.length > 0 ? hidranteChecklistFields : defaultHidranteFields();
    setActiveHidranteFields(fields);
    setMessage("");
    setMessageIsError(false);

    if (currentUserId && activeBaseId) {
      const draft = loadInspecaoDraft(currentUserId, "hidrante", item.id);
      if (draft && draft.baseId === activeBaseId) {
        setSelectedHidrante(item);
        setHidranteChecklist(draft.checklistData as HidranteChecklistData);
        setActiveHidranteFields(draft.activeFields);
        setPendingDraftEntry(null);
        return;
      }
    }

    setSelectedHidrante(item);
    setHidranteChecklist({
      ...HIDRANTE_CHECKLIST_INITIAL,
      conferente: conferenteNome,
      detalhesNaoConformidade: {},
    });
  }

  function getEquipmentDraftProgress(kind: InspecaoDraftKind, equipmentId: string) {
    if (!currentUserId || !activeBaseId) return null;
    const entry = getInspecaoDraftIndexEntry(currentUserId, kind, equipmentId);
    if (!entry || entry.baseId !== activeBaseId) return null;
    if (entry.totalCount <= 0 || entry.answeredCount >= entry.totalCount) return null;
    return { answered: entry.answeredCount, total: entry.totalCount };
  }

  function closeExtintorModal() {
    setSelected(null);
    if (currentUserId) {
      const latest = getLatestInspecaoDraft(currentUserId);
      if (latest && latest.baseId === activeBaseId) {
        setPendingDraftEntry(latest);
        if (isDraftIncomplete(latest)) {
          setMessage("Inspeção em andamento. Seu progresso foi salvo e poderá ser retomado depois.");
          setMessageIsError(false);
          setTimeout(() => setMessage(""), 4500);
        }
      }
    }
  }

  function closeHidranteModal() {
    setSelectedHidrante(null);
    if (currentUserId) {
      const latest = getLatestInspecaoDraft(currentUserId);
      if (latest && latest.baseId === activeBaseId) {
        setPendingDraftEntry(latest);
        if (isDraftIncomplete(latest)) {
          setMessage("Inspeção em andamento. Seu progresso foi salvo e poderá ser retomado depois.");
          setMessageIsError(false);
          setTimeout(() => setMessage(""), 4500);
        }
      }
    }
  }

  function handleContinueDraft() {
    if (!pendingDraftEntry || !currentUserId) return;
    const entry = pendingDraftEntry;
    if (entry.kind === "extintor") {
      const item = extintores.find((row) => row.id === entry.equipmentId);
      if (item) openExtintor(item);
    } else {
      const item = hidrantes.find((row) => row.id === entry.equipmentId);
      if (item) openHidrante(item);
    }
    setPendingDraftEntry(null);
  }

  function handleDiscardDraft() {
    if (!pendingDraftEntry || !currentUserId) return;
    const confirmed = window.confirm(
      "Descartar inspeção não finalizada? Os dados preenchidos serão perdidos.",
    );
    if (!confirmed) return;
    clearInspecaoDraft(currentUserId, pendingDraftEntry.kind, pendingDraftEntry.equipmentId);
    setPendingDraftEntry(null);
  }

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
        if (currentUserId) clearInspecaoDraft(currentUserId, "extintor", selected.id);
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
      if (currentUserId) clearInspecaoDraft(currentUserId, "extintor", selected.id);
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
        if (currentUserId) clearInspecaoDraft(currentUserId, "hidrante", selectedHidrante.id);
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
      if (currentUserId) clearInspecaoDraft(currentUserId, "hidrante", selectedHidrante.id);
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
        answers_json: buildChecklistAnswersJson(data),
        observacoes: data.observacoes?.trim() || null,
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
        answers_json: buildHidranteAnswersJson(data),
        observacoes: data.observacoes?.trim() || null,
      });
      return next;
    });
  }

  function handleTipoChange(tipo: TipoEquipamento) {
    setTipoAtivo(tipo);
    setFilter("");
    setTab("todas");
    setAdvancedFilters(DEFAULT_INSPECAO_FILTERS);
    setSelected(null);
    setSelectedHidrante(null);
    setMessage("");
  }

  const tipoPendentes = tipoAtivo === "extintor" ? extPendentesCount : hidPendentesCount;
  const tipoConcluidas = tipoAtivo === "extintor" ? extConcluidasCount : hidConcluidasCount;
  const tipoTotal = tipoAtivo === "extintor" ? extintores.length : hidrantes.length;
  const resultCount = tipoAtivo === "extintor" ? visiveis.length : visiveisHidrantes.length;

  return (
    <div className="space-y-3">
      <header className="space-y-1">
        <h1 className="text-xl font-extrabold tracking-tight text-[var(--fc-text-primary)] lg:text-2xl">
          {isAdminLista ? "Checklist" : "Inspeções"}
        </h1>
        <p className="text-sm text-[var(--fc-text-secondary)]">
          {extintores.length} extintores · {hidrantes.length} hidrantes
        </p>
        {tipoTotal > 0 ? (
          <p className="text-xs font-semibold text-[var(--fc-text-secondary)]">
            {tipoConcluidas} concluídas · {tipoPendentes} pendentes
          </p>
        ) : null}
      </header>

      {pendingDraftEntry && !selected && !selectedHidrante ? (
        <InspecaoDraftPrompt
          equipmentCodigo={formatEquipmentIdentifier(pendingDraftEntry.kind, pendingDraftEntry.equipmentCodigo)}
          kindLabel={pendingDraftEntry.kind === "extintor" ? "Extintor" : "Hidrante"}
          answeredCount={pendingDraftEntry.answeredCount}
          totalCount={pendingDraftEntry.totalCount}
          onContinue={handleContinueDraft}
          onDiscard={handleDiscardDraft}
        />
      ) : null}

      <InspecaoTipoSelector
        value={tipoAtivo}
        extintoresCount={extintores.length}
        hidrantesCount={hidrantes.length}
        onChange={handleTipoChange}
      />

      <div className="flex gap-2">
        <div className="flex min-h-[var(--fc-input-height)] flex-1 items-center gap-2 rounded-[var(--fc-radius-lg)] border border-[var(--fc-border)] bg-[var(--fc-surface)] px-3">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-slate-400" strokeWidth={1.75} aria-hidden>
            <circle cx="11" cy="11" r="8" />
            <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="search"
            placeholder={
              tipoAtivo === "extintor" ? "Buscar extintor..." : "Buscar hidrante..."
            }
            className="min-w-0 flex-1 bg-transparent text-sm text-[var(--fc-text-primary)] placeholder:text-[var(--fc-text-secondary)] focus:outline-none"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          className={`map-toolbar__filters${activeFilterCount > 0 ? " is-active" : ""}`}
          aria-label={activeFilterCount > 0 ? `Filtros • ${activeFilterCount}` : "Filtros"}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
            <path strokeLinecap="round" d="M4 8h10M18 8h2M4 16h2M10 16h10" />
            <circle cx="16" cy="8" r="2.25" />
            <circle cx="8" cy="16" r="2.25" />
          </svg>
          <span>Filtros</span>
          {activeFilterCount > 0 ? (
            <span className="map-toolbar__badge">{activeFilterCount}</span>
          ) : null}
        </button>
      </div>

      <InspecaoStatusTabs
        value={tab}
        todasCount={tipoTotal}
        pendentesCount={tipoPendentes}
        concluidasCount={tipoConcluidas}
        onChange={setTab}
      />

      {message ? (
        <div
          className={`rounded-[var(--fc-radius-lg)] border px-4 py-3 text-sm font-semibold ${
            messageIsError
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-emerald-100 bg-emerald-50 text-emerald-800"
          }`}
        >
          {message}
        </div>
      ) : null}

      <div className="inspecao-card-grid space-y-2 lg:space-y-0">
        {tipoAtivo === "extintor" && visiveis.length === 0 && (
          <div className="rounded-[var(--fc-radius-lg)] border border-[var(--fc-border)] bg-[var(--fc-surface)] px-4 py-10 text-center text-sm text-[var(--fc-text-secondary)]">
            Nenhum extintor encontrado.
          </div>
        )}

        {tipoAtivo === "hidrante" && visiveisHidrantes.length === 0 && (
          <div className="rounded-[var(--fc-radius-lg)] border border-[var(--fc-border)] bg-[var(--fc-surface)] px-4 py-10 text-center text-sm text-[var(--fc-text-secondary)]">
            Nenhum hidrante encontrado.
          </div>
        )}

        {tipoAtivo === "extintor" &&
          visiveis.map((item) => {
            const conferidoNoMes = conferidosNoMesIds.has(item.id);
            const ultimo = ultimoChecklistMes.get(item.id);
            const temNc = ultimo ? checklistTemNaoConformidade(ultimo) : false;
            const manutVencida =
              isVencido(item.manutencao_2_nivel) || isVencido(item.manutencao_3_nivel);
            const testeN2Vencido = isDataVencida(item.manutencao_2_nivel);

            const cardStatus: InspecaoCardStatus = temNc
              ? "nao_conforme"
              : manutVencida || testeN2Vencido
                ? "vencido"
                : conferidoNoMes
                  ? "concluido"
                  : "pendente";

            return (
              <InspecaoEquipmentCard
                key={item.id}
                codigo={formatEquipmentIdentifier("extintor", item.codigo)}
                localDetalhado={item.local_detalhado}
                metaLine={`${item.pavimento ?? "—"} · ${item.tipo} · ${item.tamanho}`}
                status={cardStatus}
                aviso={
                  manutVencida ? "Atenção: manutenção nível 2 ou 3 vencida" : null
                }
                icon={<EquipmentStatusIcon kind="extintor" />}
                draftProgress={getEquipmentDraftProgress("extintor", item.id)}
                onClick={() => openExtintor(item)}
              />
            );
          })}

        {tipoAtivo === "hidrante" &&
          visiveisHidrantes.map((item) => {
            const conferidoNoMes = conferidosHidranteMesIds.has(item.id);
            const ultimo = ultimoChecklistHidranteMes.get(item.id);
            const temNc = ultimo
              ? hidranteChecklistTemNaoConformidade(ultimo as Record<string, string | null>)
              : false;
            const mangueiraVencida = hidranteTemMangueiraVencida(item);

            const cardStatus: InspecaoCardStatus = temNc
              ? "nao_conforme"
              : mangueiraVencida
                ? "vencido"
                : conferidoNoMes
                  ? "concluido"
                  : "pendente";

            return (
              <InspecaoEquipmentCard
                key={item.id}
                codigo={formatEquipmentIdentifier("hidrante", item.codigo)}
                localDetalhado={item.local_detalhado}
                metaLine={formatHidranteMetaLine(item)}
                status={cardStatus}
                aviso={
                  mangueiraVencida
                    ? "Atenção: mangueira com teste hidrostático vencido"
                    : null
                }
                icon={<EquipmentStatusIcon kind="hidrante" />}
                draftProgress={getEquipmentDraftProgress("hidrante", item.id)}
                onClick={() => openHidrante(item)}
              />
            );
          })}
      </div>

      <InspecaoFiltersPanel
        open={filtersOpen}
        tipo={tipoAtivo}
        filters={advancedFilters}
        pavimentos={pavimentos}
        tipos={tiposAgente}
        capacidades={capacidades}
        resultCount={resultCount}
        onChange={setAdvancedFilters}
        onClear={() => setAdvancedFilters(DEFAULT_INSPECAO_FILTERS)}
        onClose={() => setFiltersOpen(false)}
      />

      {selected && (
        <div className="modal-layer fixed inset-0 z-[var(--z-modal)] flex flex-col bg-white lg:bg-slate-950/40 lg:p-6">
          <div className="checklist-modal-shell relative flex-1 overflow-y-auto px-4 pb-2 pt-4 lg:px-6 lg:py-5">
            <ModalCloseButton onClick={closeExtintorModal} className="absolute right-3 top-3 z-10" />
            <ChecklistForm
              data={checklist}
              onChange={setChecklist}
              onSubmit={submitChecklist}
              onCancel={closeExtintorModal}
              isSaving={saving}
              draftSavedVisible={draftSavedVisible}
              fields={activeExtintorFields}
              cabecalho={{
                codigo: selected.codigo,
                pavimento: selected.pavimento,
                local_detalhado: selected.local_detalhado,
                num_inmetro: selected.num_inmetro,
                num_cilindro: selected.num_cilindro ?? null,
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
        <div className="modal-layer fixed inset-0 z-[var(--z-modal)] flex flex-col bg-white lg:bg-slate-950/40 lg:p-6">
          <div className="checklist-modal-shell relative flex-1 overflow-y-auto px-4 pb-2 pt-4 lg:px-6 lg:py-5">
            <ModalCloseButton onClick={closeHidranteModal} className="absolute right-3 top-3 z-10" />
            <HidranteChecklistForm
              data={hidranteChecklist}
              onChange={setHidranteChecklist}
              onSubmit={submitHidranteChecklist}
              onCancel={closeHidranteModal}
              isSaving={saving}
              draftSavedVisible={draftSavedVisible}
              fields={activeHidranteFields}
              hidrante={selectedHidrante}
            />
          </div>
        </div>
      )}
    </div>
  );
}
