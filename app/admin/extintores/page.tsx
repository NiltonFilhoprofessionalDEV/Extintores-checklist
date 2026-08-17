"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { formatDateOnlyPt, parseCalendarDateAsLocal } from "@/lib/date/date-only";
import { COLUNAS_PADRAO, type TipoEquipamento } from "@/lib/inventario/equipamento-padrao";
import { exportInventarioCompleto, type HidranteInventarioCompletoRow } from "@/lib/export/excel";
import { exportInventarioPdf } from "@/lib/export/pdf";
import {
  EMPTY_EXTINTOR_FORM,
  EMPTY_HIDRANTE_FORM,
  HIDRANTE_TESTE_M_CAMPOS,
  SETORES_FALLBACK,
  buildHidranteSavePayload,
  clampQuantidadeMangueirasString,
  parseQuantidadeMangueiras,
  toDateInputValue,
  toUppercaseLabel,
  validateExtintorForm,
  validateHidranteForm,
  type ExtintorFormData,
  type HidranteFormData,
} from "@/lib/inventario/inventory-form";
import {
  floorsFromLabels,
  resolveFloorSelectValue,
  type FloorSelectOption,
} from "@/lib/inventario/resolve-floor-select";

import { getCurrentSession, getProfileBySession, type UserRole } from "@/lib/auth/profile";
import { isAdminLikeRole, isInventoryReadOnlyRole } from "@/lib/auth/roles";
import { SOFT_DELETE_CONFIRM_PHRASE } from "@/lib/audit/write-audit-log";
import { useActiveBase } from "@/lib/auth/active-base-context";
import { fetchBaseFloors } from "@/lib/auth/bases";
import InventarioTipoTabs from "@/src/components/InventarioTipoTabs";
import ExportActions from "@/src/components/ExportActions";
import ModalCloseButton from "@/src/components/ModalCloseButton";
import RowActionsMenu from "@/src/components/RowActionsMenu";
import FormDrawer from "@/src/components/inventory/FormDrawer";
import ExtintorInventoryForm from "@/src/components/inventory/ExtintorInventoryForm";
import HidranteInventoryForm from "@/src/components/inventory/HidranteInventoryForm";
import {
  EquipmentCode,
  InventoryEmptyState,
  MaintenanceCell,
  PositionBadge,
} from "@/src/components/inventory/InventoryVisuals";
import { formatEquipmentIdentifier } from "@/lib/map/marker-label";

type HidranteRow = HidranteInventarioCompletoRow & { floor_id?: string | null };

type ExtintorRow = {
  id: string;
  codigo: string;
  setor: string;
  local_detalhado: string;
  num_inmetro: string;
  num_cilindro: string | null;
  tipo: string;
  tamanho: string;
  capacidade_extintora: string;
  manutencao_2_nivel: string | null;
  manutencao_3_nivel: string | null;
  pavimento: string | null;
  floor_id?: string | null;
  coord_x: number | null;
  coord_y: number | null;
  created_at: string;
};

type ModalMode = "create" | "edit";
type ModalEntity = "extintor" | "hidrante";

type DetalheView =
  | { tipo: "extintor"; item: ExtintorRow }
  | { tipo: "hidrante"; item: HidranteRow };

function DetalheCampo({
  label,
  value,
  valueClassName = "",
  className = "",
}: {
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
  className?: string;
}) {
  return (
    <div className={`inv-detail-field ${className}`.trim()}>
      <p className="inv-detail-field__label">{label}</p>
      <p className={`inv-detail-field__value ${valueClassName}`.trim()}>{value}</p>
    </div>
  );
}

const TH = "px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500";
const TH_COMPACT = "px-2 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500";

export default function AdminExtintoresPage() {
  const { ready, activeBaseId } = useActiveBase();
  const [extintores, setExtintores] = useState<ExtintorRow[]>([]);
  const [hidrantes, setHidrantes] = useState<HidranteRow[]>([]);
  const [floors, setFloors] = useState<FloorSelectOption[]>(floorsFromLabels(SETORES_FALLBACK));
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [filterHidrante, setFilterHidrante] = useState("");
  const [tipoLista, setTipoLista] = useState<TipoEquipamento>("extintor");
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [modalEntity, setModalEntity] = useState<ModalEntity>("extintor");
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<ExtintorFormData>(EMPTY_EXTINTOR_FORM);
  const [formHidrante, setFormHidrante] = useState<HidranteFormData>(EMPTY_HIDRANTE_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [detalheView, setDetalheView] = useState<DetalheView | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actorRole, setActorRole] = useState<UserRole>("admin");
  const [showInactive, setShowInactive] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [pendingSoftDeleteIds, setPendingSoftDeleteIds] = useState<string[]>([]);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [filtersMenuOpen, setFiltersMenuOpen] = useState(false);
  const floorFieldTouchedRef = useRef(false);
  const savingRef = useRef(false);

  const readOnly = isInventoryReadOnlyRole(actorRole);
  const canSoftDelete = isAdminLikeRole(actorRole);
  const today = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);

  const supabase = useMemo(() => getSupabaseClient(), []);

  const callInventoryApi = useCallback(
    async (url: string, init?: RequestInit) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão não encontrada.");

      const response = await fetch(url, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          ...(activeBaseId ? { "X-Active-Base-Id": activeBaseId } : {}),
          ...(init?.headers ?? {}),
        },
      });

      const responseText = await response.text();
      let payload: { error?: string } | null = null;
      try {
        payload = responseText ? (JSON.parse(responseText) as { error?: string }) : null;
      } catch {
        payload = null;
      }

      if (!response.ok) {
        throw new Error(payload?.error ?? responseText ?? "Falha na requisição.");
      }
    },
    [supabase, activeBaseId],
  );

  const load = useCallback(async () => {
    if (!ready || !activeBaseId) return;
    setLoading(true);

    const selectWithFloor =
      "id,codigo,setor,local_detalhado,num_inmetro,num_cilindro,tipo,tamanho,capacidade_extintora,manutencao_2_nivel,manutencao_3_nivel,pavimento,floor_id,coord_x,coord_y,created_at,active";
    const selectWithCilindro =
      "id,codigo,setor,local_detalhado,num_inmetro,num_cilindro,tipo,tamanho,capacidade_extintora,manutencao_2_nivel,manutencao_3_nivel,pavimento,coord_x,coord_y,created_at,active";
    const selectLegacy =
      "id,codigo,setor,local_detalhado,num_inmetro,tipo,tamanho,capacidade_extintora,manutencao_2_nivel,manutencao_3_nivel,pavimento,coord_x,coord_y,created_at";

    let extData: ExtintorRow[] | null = null;
    const extQuery = supabase
      .from("extintores")
      .select(selectWithFloor)
      .eq("base_id", activeBaseId)
      .eq("active", !showInactive)
      .order("codigo", { ascending: true });

    let { data: extRows, error: extError } = await extQuery;

    if (extError && /active|schema cache|column/i.test(extError.message)) {
      const retry = await supabase
        .from("extintores")
        .select(selectWithFloor)
        .eq("base_id", activeBaseId)
        .order("codigo", { ascending: true });
      extRows = retry.data as typeof extRows;
      extError = retry.error;
    }

    if (extError && /floor_id|schema cache|column/i.test(extError.message)) {
      let retry = await supabase
        .from("extintores")
        .select(selectWithCilindro)
        .eq("base_id", activeBaseId)
        .eq("active", !showInactive)
        .order("codigo", { ascending: true });
      if (retry.error && /active|schema cache|column/i.test(retry.error.message)) {
        retry = await supabase
          .from("extintores")
          .select(selectWithCilindro)
          .eq("base_id", activeBaseId)
          .order("codigo", { ascending: true });
      }
      extRows = retry.data as typeof extRows;
      extError = retry.error;
    }

    if (extError && /num_cilindro|schema cache|column/i.test(extError.message)) {
      const fallback = await supabase
        .from("extintores")
        .select(selectLegacy)
        .eq("base_id", activeBaseId)
        .order("codigo", { ascending: true });
      extData = ((fallback.data ?? []) as ExtintorRow[]).map((row) => ({
        ...row,
        num_cilindro: row.num_cilindro ?? null,
        floor_id: row.floor_id ?? null,
      }));
    } else {
      extData = ((extRows ?? []) as ExtintorRow[]).map((row) => ({
        ...row,
        floor_id: row.floor_id ?? null,
      }));
    }

    const hidSelectWithFloor =
      "id,codigo,pavimento,local_detalhado,quantidade_mangueiras,teste_hidrostatico_m1,teste_hidrostatico_m2,teste_hidrostatico_m3,teste_hidrostatico_m4,quantidade_chaves_storz,quantidade_esguichos,coord_x,coord_y,created_at,active,floor_id";
    const hidSelect =
      "id,codigo,pavimento,local_detalhado,quantidade_mangueiras,teste_hidrostatico_m1,teste_hidrostatico_m2,teste_hidrostatico_m3,teste_hidrostatico_m4,quantidade_chaves_storz,quantidade_esguichos,coord_x,coord_y,created_at,active";

    const hidRes = await supabase
      .from("hidrantes")
      .select(hidSelectWithFloor)
      .eq("base_id", activeBaseId)
      .eq("active", !showInactive)
      .order("codigo", { ascending: true });
    let hidDataRaw = hidRes.data as Array<Record<string, unknown>> | null;
    let hidError = hidRes.error;
    if (hidError && /floor_id|schema cache|column/i.test(hidError.message)) {
      const retry = await supabase
        .from("hidrantes")
        .select(hidSelect)
        .eq("base_id", activeBaseId)
        .eq("active", !showInactive)
        .order("codigo", { ascending: true });
      hidDataRaw = retry.data as Array<Record<string, unknown>> | null;
      hidError = retry.error;
    }
    if (hidError && /active|schema cache|column/i.test(hidError.message)) {
      const hidFallback = await supabase
        .from("hidrantes")
        .select(
          "id,codigo,pavimento,local_detalhado,quantidade_mangueiras,teste_hidrostatico_m1,teste_hidrostatico_m2,teste_hidrostatico_m3,teste_hidrostatico_m4,quantidade_chaves_storz,quantidade_esguichos,coord_x,coord_y,created_at",
        )
        .eq("base_id", activeBaseId)
        .order("codigo", { ascending: true });
      hidDataRaw = (hidFallback.data ?? []).map((row) => ({ ...row, active: true }));
    }

    const baseFloors = await fetchBaseFloors(activeBaseId).catch(() => []);
    const floorOptions: FloorSelectOption[] =
      baseFloors.length > 0
        ? baseFloors.map((floor) => ({ id: floor.id, key: floor.key, label: floor.label }))
        : floorsFromLabels(SETORES_FALLBACK);
    setFloors(floorOptions);

    const rows = [...(extData ?? [])].sort((a, b) =>
      a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true, sensitivity: "base" }),
    );
    const hidRows = ((hidDataRaw ?? []) as HidranteRow[]).sort((a, b) =>
      a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true, sensitivity: "base" }),
    );
    setExtintores(rows);
    setHidrantes(hidRows);
    setSelectedIds([]);
    setLoading(false);
  }, [supabase, ready, activeBaseId, showInactive]);

  useEffect(() => {
    if (!ready || !activeBaseId) return;
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load, ready, activeBaseId]);

  useEffect(() => {
    const loadProfile = async () => {
      const session = await getCurrentSession();
      if (!session) return;
      const profile = await getProfileBySession(session);
      if (profile) setActorRole(profile.role);
    };
    void loadProfile();
  }, []);

  const filtered = useMemo(() => {
    const q = filter.toLowerCase().trim();
    if (!q) return extintores;
    return extintores.filter(
      (e) =>
        e.codigo.toLowerCase().includes(q) ||
        e.setor.toLowerCase().includes(q) ||
        e.local_detalhado.toLowerCase().includes(q) ||
        e.num_inmetro.toLowerCase().includes(q) ||
        (e.num_cilindro ?? "").toLowerCase().includes(q) ||
        e.tipo.toLowerCase().includes(q),
    );
  }, [extintores, filter]);

  const filteredHidrantes = useMemo(() => {
    const q = filterHidrante.toLowerCase().trim();
    if (!q) return hidrantes;
    return hidrantes.filter(
      (h) =>
        h.codigo.toLowerCase().includes(q) ||
        (h.pavimento ?? "").toLowerCase().includes(q) ||
        h.local_detalhado.toLowerCase().includes(q),
    );
  }, [hidrantes, filterHidrante]);

  const searchValue = tipoLista === "extintor" ? filter : filterHidrante;
  const setSearchValue = tipoLista === "extintor" ? setFilter : setFilterHidrante;

  function openCreate() {
    floorFieldTouchedRef.current = false;
    setForm(EMPTY_EXTINTOR_FORM);
    setFormErrors({});
    setEditId(null);
    setModalEntity("extintor");
    setModalMode("create");
    setFeedback(null);
  }

  function openCreateHidrante() {
    floorFieldTouchedRef.current = false;
    setFormHidrante(EMPTY_HIDRANTE_FORM);
    setFormErrors({});
    setEditId(null);
    setModalEntity("hidrante");
    setModalMode("create");
    setFeedback(null);
  }

  function openEdit(e: ExtintorRow) {
    floorFieldTouchedRef.current = false;
    const setor = resolveFloorSelectValue(floors, e);
    setForm({
      codigo: e.codigo,
      setor,
      local_detalhado: e.local_detalhado,
      num_inmetro: e.num_inmetro,
      num_cilindro: e.num_cilindro ?? "",
      tipo: toUppercaseLabel(e.tipo),
      tamanho: e.tamanho,
      capacidade_extintora: e.capacidade_extintora,
      manutencao_2_nivel: toDateInputValue(e.manutencao_2_nivel),
      manutencao_3_nivel: toDateInputValue(e.manutencao_3_nivel),
      pavimento: e.pavimento ?? "",
    });
    setFormErrors({});
    setEditId(e.id);
    setModalEntity("extintor");
    setModalMode("edit");
    setFeedback(null);
  }

  function openEditHidrante(h: HidranteRow) {
    floorFieldTouchedRef.current = false;
    const qtdStr = clampQuantidadeMangueirasString(h.quantidade_mangueiras);
    const qtd = parseQuantidadeMangueiras(qtdStr);
    setFormHidrante({
      codigo: h.codigo,
      pavimento: resolveFloorSelectValue(floors, h),
      local_detalhado: h.local_detalhado,
      quantidade_mangueiras: qtdStr,
      teste_hidrostatico_m1: qtd >= 1 ? toDateInputValue(h.teste_hidrostatico_m1) : "",
      teste_hidrostatico_m2: qtd >= 2 ? toDateInputValue(h.teste_hidrostatico_m2) : "",
      teste_hidrostatico_m3: qtd >= 3 ? toDateInputValue(h.teste_hidrostatico_m3) : "",
      teste_hidrostatico_m4: qtd >= 4 ? toDateInputValue(h.teste_hidrostatico_m4) : "",
      quantidade_chaves_storz: h.quantidade_chaves_storz != null ? String(h.quantidade_chaves_storz) : "",
      quantidade_esguichos: h.quantidade_esguichos != null ? String(h.quantidade_esguichos) : "",
    });
    setFormErrors({});
    setEditId(h.id);
    setModalEntity("hidrante");
    setModalMode("edit");
    setFeedback(null);
  }

  const closeModal = useCallback(() => {
    if (savingRef.current) return;
    setModalMode(null);
    setEditId(null);
    setFormErrors({});
  }, []);

  function openDetalheExtintor(item: ExtintorRow) {
    setDetalheView({ tipo: "extintor", item });
  }

  function openDetalheHidrante(item: HidranteRow) {
    setDetalheView({ tipo: "hidrante", item });
  }

  function closeDetalhe() {
    setDetalheView(null);
  }

  function editarFromDetalhe() {
    if (!detalheView) return;
    if (detalheView.tipo === "extintor") {
      openEdit(detalheView.item);
    } else {
      openEditHidrante(detalheView.item);
    }
    closeDetalhe();
  }

  function set(key: keyof ExtintorFormData, value: string) {
    setForm((p) => ({ ...p, [key]: value }));
    setFormErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function setHidrante(key: keyof HidranteFormData, value: string) {
    setFormHidrante((p) => ({ ...p, [key]: value }));
    setFormErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function setQuantidadeMangueiras(value: string) {
    const qtd = parseQuantidadeMangueiras(value);
    setFormHidrante((prev) => {
      const next = { ...prev, quantidade_mangueiras: value };
      if (qtd < 1) next.teste_hidrostatico_m1 = "";
      if (qtd < 2) next.teste_hidrostatico_m2 = "";
      if (qtd < 3) next.teste_hidrostatico_m3 = "";
      if (qtd < 4) next.teste_hidrostatico_m4 = "";
      return next;
    });
    setFormErrors((prev) => {
      if (!prev.quantidade_mangueiras) return prev;
      const next = { ...prev };
      delete next.quantidade_mangueiras;
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errors = validateExtintorForm(form);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setFeedback(null);

    const setorLabel = toUppercaseLabel(
      resolveFloorSelectValue(floors, { setor: form.setor, pavimento: form.pavimento }) || form.setor,
    );
    const payload = {
      codigo: form.codigo.trim(),
      setor: setorLabel,
      local_detalhado: form.local_detalhado.trim(),
      num_inmetro: form.num_inmetro.trim(),
      num_cilindro: form.num_cilindro?.trim() || null,
      tipo: toUppercaseLabel(form.tipo),
      tamanho: form.tamanho.trim(),
      capacidade_extintora: form.capacidade_extintora.trim(),
      manutencao_2_nivel: form.manutencao_2_nivel?.trim() || null,
      manutencao_3_nivel: form.manutencao_3_nivel?.trim() || null,
      pavimento: form.pavimento?.trim() || setorLabel || null,
    };

    try {
      if (modalMode === "create") {
        await callInventoryApi("/api/admin/extintores", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      } else {
        await callInventoryApi("/api/admin/extintores", {
          method: "PATCH",
          body: JSON.stringify({ id: editId, ...payload }),
        });
      }
    } catch (err) {
      savingRef.current = false;
      setSaving(false);
      setFeedback({
        type: "err",
        msg: `Erro: ${err instanceof Error ? err.message : "Falha ao salvar."}`,
      });
      return;
    }

    savingRef.current = false;
    setSaving(false);
    setFeedback({
      type: "ok",
      msg: modalMode === "create" ? "Extintor cadastrado com sucesso!" : "Extintor atualizado com sucesso!",
    });
    await load();
    if (modalMode === "create") setForm(EMPTY_EXTINTOR_FORM);
    setTimeout(() => {
      closeModal();
      setFeedback(null);
    }, 1200);
  }

  async function handleSubmitHidrante(e: React.FormEvent) {
    e.preventDefault();
    const errors = validateHidranteForm(formHidrante);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setFeedback(null);

    const pavimento =
      resolveFloorSelectValue(floors, { pavimento: formHidrante.pavimento }) || formHidrante.pavimento;
    const payload = buildHidranteSavePayload({ ...formHidrante, pavimento });

    try {
      if (modalMode === "create") {
        await callInventoryApi("/api/admin/hidrantes", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      } else {
        await callInventoryApi("/api/admin/hidrantes", {
          method: "PATCH",
          body: JSON.stringify({ id: editId, ...payload }),
        });
      }
    } catch (err) {
      savingRef.current = false;
      setSaving(false);
      setFeedback({
        type: "err",
        msg: `Erro: ${err instanceof Error ? err.message : "Falha ao salvar."}`,
      });
      return;
    }

    savingRef.current = false;
    setSaving(false);
    setFeedback({
      type: "ok",
      msg: modalMode === "create" ? "Hidrante cadastrado com sucesso!" : "Hidrante atualizado com sucesso!",
    });
    await load();
    if (modalMode === "create") setFormHidrante(EMPTY_HIDRANTE_FORM);
    setTimeout(() => {
      closeModal();
      setFeedback(null);
    }, 1200);
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function selectAllVisible() {
    const ids = tipoLista === "extintor" ? filtered.map((e) => e.id) : filteredHidrantes.map((h) => h.id);
    setSelectedIds(ids);
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelectedIds([]);
  }

  function enterSelectionMode(firstId?: string) {
    setSelectionMode(true);
    setSelectedIds(firstId ? [firstId] : []);
  }

  function openRestoreOne(id: string) {
    setPendingSoftDeleteIds([id]);
    setConfirmPhrase("");
    setBulkConfirmOpen(true);
  }

  function openBulkSoftDelete() {
    if (selectedIds.length === 0) return;
    setPendingSoftDeleteIds(selectedIds);
    setConfirmPhrase("");
    setBulkConfirmOpen(true);
  }

  async function confirmSoftDeleteOrRestore() {
    if (pendingSoftDeleteIds.length === 0) return;
    const mode = showInactive ? "restore" : "soft_delete";
    if (mode === "soft_delete") {
      const typed = confirmPhrase.trim().toLocaleUpperCase("pt-BR");
      if (typed !== SOFT_DELETE_CONFIRM_PHRASE) {
        setFeedback({
          type: "err",
          msg: `Digite exatamente: ${SOFT_DELETE_CONFIRM_PHRASE}`,
        });
        return;
      }
    }

    setDeleting(true);
    setFeedback(null);
    try {
      await callInventoryApi("/api/admin/inventario/soft-delete", {
        method: "POST",
        body: JSON.stringify({
          tipo: tipoLista,
          ids: pendingSoftDeleteIds,
          mode,
          confirmacao: mode === "soft_delete" ? SOFT_DELETE_CONFIRM_PHRASE : undefined,
        }),
      });
      setBulkConfirmOpen(false);
      setPendingSoftDeleteIds([]);
      setConfirmPhrase("");
      setSelectedIds([]);
      setSelectionMode(false);
      setFeedback({
        type: "ok",
        msg:
          mode === "soft_delete"
            ? "Itens removidos da lista. Você pode recuperá-los em Status → Inativos."
            : "Itens recuperados com sucesso.",
      });
      await load();
    } catch (err) {
      setFeedback({
        type: "err",
        msg: err instanceof Error ? err.message : "Falha ao processar.",
      });
    } finally {
      setDeleting(false);
    }
  }

  function formatDate(d: string | null) {
    return formatDateOnlyPt(d);
  }

  function isExpired(d: string | null) {
    if (!d) return false;
    const date = parseCalendarDateAsLocal(d);
    if (!date) return false;
    const todayLocal = new Date();
    todayLocal.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    return date < todayLocal;
  }

  const hasActiveSearch = Boolean(searchValue.trim());
  const drawerOpen = Boolean(modalMode);

  return (
    <div className="inv-page">
      <div className="professional-card inv-header">
        <div>
          <p className="page-eyebrow">Inventário</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[var(--ink)]">Extintores e hidrantes</h1>
          <p className="mt-2 text-sm font-medium text-[var(--muted-foreground)]">
            {extintores.length} extintor{extintores.length !== 1 ? "es" : ""} e {hidrantes.length} hidrante
            {hidrantes.length !== 1 ? "s" : ""} cadastrados.
          </p>
        </div>
        <div className="inv-header__actions">
          <ExportActions
            disabled={loading || (extintores.length === 0 && hidrantes.length === 0)}
            onExcel={() => exportInventarioCompleto(extintores, hidrantes)}
            onPdf={() => exportInventarioPdf(extintores, hidrantes)}
          />
          {tipoLista === "extintor" && !readOnly && (
            <button type="button" onClick={openCreate} className="btn-primary">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Novo Extintor
            </button>
          )}
          {tipoLista === "hidrante" && !readOnly && (
            <button type="button" onClick={openCreateHidrante} className="btn-primary">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Novo Hidrante
            </button>
          )}
        </div>
      </div>

      <InventarioTipoTabs
        tone="quiet"
        value={tipoLista}
        onChange={(value) => {
          setTipoLista(value);
          exitSelectionMode();
        }}
        extintoresCount={extintores.length}
        hidrantesCount={hidrantes.length}
      />

      <div className="professional-card inv-toolbar">
        {canSoftDelete && (
          <div className="inv-toolbar__status">
            <button
              type="button"
              className="btn-secondary text-xs"
              onClick={() => {
                setStatusMenuOpen((open) => !open);
                setFiltersMenuOpen(false);
              }}
              aria-haspopup="listbox"
              aria-expanded={statusMenuOpen}
            >
              Status: {showInactive ? "Inativos" : "Ativos"}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {statusMenuOpen && (
              <div className="inv-menu" role="listbox">
                <button
                  type="button"
                  role="option"
                  aria-selected={!showInactive}
                  onClick={() => {
                    setShowInactive(false);
                    exitSelectionMode();
                    setStatusMenuOpen(false);
                  }}
                >
                  Ativos
                </button>
                <button
                  type="button"
                  role="option"
                  aria-selected={showInactive}
                  onClick={() => {
                    setShowInactive(true);
                    exitSelectionMode();
                    setStatusMenuOpen(false);
                  }}
                >
                  Inativos
                </button>
              </div>
            )}
          </div>
        )}

        <div className="inv-toolbar__search">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#9ca3af" strokeWidth={2} aria-hidden>
            <circle cx="11" cy="11" r="8" />
            <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="search"
            placeholder={
              tipoLista === "extintor"
                ? "Buscar equipamento por código, setor, local, tipo ou INMETRO..."
                : "Buscar equipamento por código, pavimento ou local..."
            }
            aria-label="Buscar equipamento"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
          />
          {searchValue ? (
            <button type="button" onClick={() => setSearchValue("")} className="text-xs font-semibold text-slate-400 hover:text-slate-600">
              Limpar
            </button>
          ) : null}
        </div>

        {canSoftDelete && (
          <div className="inv-toolbar__filters">
            <button
              type="button"
              className="btn-secondary text-xs"
              onClick={() => {
                setFiltersMenuOpen((open) => !open);
                setStatusMenuOpen(false);
              }}
              aria-haspopup="menu"
              aria-expanded={filtersMenuOpen}
            >
              Filtros
            </button>
            {filtersMenuOpen && (
              <div className="inv-menu inv-menu--right" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  className={selectionMode ? "is-active" : ""}
                  onClick={() => {
                    if (selectionMode) exitSelectionMode();
                    else enterSelectionMode();
                    setFiltersMenuOpen(false);
                  }}
                >
                  {selectionMode ? "Sair da seleção" : "Selecionar itens"}
                </button>
                {hasActiveSearch ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setSearchValue("");
                      setFiltersMenuOpen(false);
                    }}
                  >
                    Limpar busca
                  </button>
                ) : null}
              </div>
            )}
          </div>
        )}

        {selectionMode && !showInactive && canSoftDelete && (
          <div className="inv-bulk">
            <button type="button" className="btn-secondary text-xs" onClick={selectAllVisible}>
              Selecionar todos
            </button>
            <button type="button" className="btn-secondary text-xs" onClick={exitSelectionMode}>
              Cancelar seleção
            </button>
            {selectedIds.length > 0 && (
              <>
                <button type="button" className="btn-secondary text-xs" onClick={clearSelection}>
                  Limpar ({selectedIds.length})
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-red-600 px-3 py-2 text-xs font-bold text-white"
                  onClick={openBulkSoftDelete}
                >
                  Apagar selecionados ({selectedIds.length})
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {feedback && !modalMode && (
        <p
          className={`rounded-2xl px-4 py-3 text-sm font-medium ${
            feedback.type === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"
          }`}
        >
          {feedback.msg}
        </p>
      )}

      {tipoLista === "extintor" && (
        <div className="professional-card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-7 w-7 animate-spin rounded-full border-4 border-[var(--neon)] border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <InventoryEmptyState
              title={filter ? "Nenhum extintor encontrado" : "Nenhum extintor cadastrado ainda."}
              description={
                filter
                  ? "Tente alterar os filtros ou o termo pesquisado."
                  : "Cadastre o primeiro extintor para começar o inventário."
              }
              actionLabel={filter ? "Limpar filtros" : undefined}
              onAction={filter ? () => setFilter("") : undefined}
            />
          ) : (
            <>
              <div className="inv-cards">
                {filtered.map((e) => (
                  <div key={e.id} className="inv-card">
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openDetalheExtintor(e)}>
                      <EquipmentCode kind="extintor" codigo={e.codigo} />
                      <p className="inv-place__floor mt-1">{e.setor}</p>
                      <p className="inv-place__local">{e.local_detalhado}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <PositionBadge positioned={e.coord_x != null} />
                        <MaintenanceCell date={e.manutencao_2_nivel} today={today} />
                      </div>
                    </button>
                    <div className="shrink-0">
                      {canSoftDelete && selectionMode && !showInactive ? (
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(e.id)}
                          onChange={() => toggleSelected(e.id)}
                          aria-label={`Selecionar ${e.codigo}`}
                        />
                      ) : !readOnly && showInactive && canSoftDelete ? (
                        <button
                          type="button"
                          onClick={() => openRestoreOne(e.id)}
                          className="grid h-9 w-9 place-items-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700"
                          aria-label={`Recuperar extintor ${e.codigo}`}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12a9 9 0 1 0 3-6.7" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4v5h5" />
                          </svg>
                        </button>
                      ) : !readOnly ? (
                        <RowActionsMenu
                          label={`extintor ${e.codigo}`}
                          onEdit={() => openEdit(e)}
                          onSelect={canSoftDelete ? () => enterSelectionMode(e.id) : undefined}
                          onDelete={
                            canSoftDelete
                              ? () => {
                                  setPendingSoftDeleteIds([e.id]);
                                  setConfirmPhrase("");
                                  setBulkConfirmOpen(true);
                                }
                              : undefined
                          }
                        />
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              <div className="inv-table-wrap">
                <table className="modern-table inv-table">
                  <thead>
                    <tr>
                      {canSoftDelete && selectionMode && !showInactive && <th className={TH_COMPACT}>Sel.</th>}
                      <th className={TH}>{COLUNAS_PADRAO.codigoCurto}</th>
                      <th className={TH}>
                        {COLUNAS_PADRAO.pavimento} / {COLUNAS_PADRAO.localDetalhado}
                      </th>
                      <th className={`hidden lg:table-cell ${TH}`}>
                        {COLUNAS_PADRAO.tipo} / {COLUNAS_PADRAO.tamanho}
                      </th>
                      <th className={`hidden lg:table-cell ${TH}`}>{COLUNAS_PADRAO.numInmetro}</th>
                      <th className={`hidden lg:table-cell ${TH}`}>{COLUNAS_PADRAO.venctoN2}</th>
                      <th className={`hidden xl:table-cell ${TH}`}>{COLUNAS_PADRAO.mapa}</th>
                      {!readOnly && <th className={TH}>{COLUNAS_PADRAO.acoes}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((e) => (
                      <tr key={e.id} onClick={() => openDetalheExtintor(e)}>
                        {canSoftDelete && selectionMode && !showInactive && (
                          <td className="px-3 py-3" onClick={(event) => event.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(e.id)}
                              onChange={() => toggleSelected(e.id)}
                              aria-label={`Selecionar ${e.codigo}`}
                            />
                          </td>
                        )}
                        <td className="px-4 py-3">
                          <EquipmentCode kind="extintor" codigo={e.codigo} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="inv-place">
                            <p className="inv-place__floor">{e.setor}</p>
                            <p className="inv-place__local">{e.local_detalhado}</p>
                          </div>
                        </td>
                        <td className="hidden px-4 py-3 text-slate-600 lg:table-cell">
                          {e.tipo} {e.tamanho}
                        </td>
                        <td className="hidden px-4 py-3 text-slate-600 lg:table-cell">{e.num_inmetro}</td>
                        <td className="hidden px-4 py-3 lg:table-cell">
                          <MaintenanceCell date={e.manutencao_2_nivel} today={today} />
                        </td>
                        <td className="hidden px-4 py-3 xl:table-cell">
                          <PositionBadge positioned={e.coord_x != null} />
                        </td>
                        <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                          {!readOnly && showInactive && canSoftDelete ? (
                            <button
                              type="button"
                              onClick={() => openRestoreOne(e.id)}
                              className="grid h-9 w-9 place-items-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100"
                              aria-label={`Recuperar extintor ${e.codigo}`}
                              title="Recuperar"
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12a9 9 0 1 0 3-6.7" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4v5h5" />
                              </svg>
                            </button>
                          ) : !readOnly ? (
                            <RowActionsMenu
                              label={`extintor ${e.codigo}`}
                              onEdit={() => openEdit(e)}
                              onSelect={canSoftDelete ? () => enterSelectionMode(e.id) : undefined}
                              onDelete={
                                canSoftDelete
                                  ? () => {
                                      setPendingSoftDeleteIds([e.id]);
                                      setConfirmPhrase("");
                                      setBulkConfirmOpen(true);
                                    }
                                  : undefined
                              }
                            />
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {tipoLista === "hidrante" && (
        <div className="professional-card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-7 w-7 animate-spin rounded-full border-4 border-[var(--neon)] border-t-transparent" />
            </div>
          ) : filteredHidrantes.length === 0 ? (
            <InventoryEmptyState
              title={filterHidrante ? "Nenhum hidrante encontrado" : "Nenhum hidrante cadastrado ainda."}
              description={
                filterHidrante
                  ? "Tente alterar os filtros ou o termo pesquisado."
                  : "Cadastre o primeiro hidrante para começar o inventário."
              }
              actionLabel={filterHidrante ? "Limpar filtros" : undefined}
              onAction={filterHidrante ? () => setFilterHidrante("") : undefined}
            />
          ) : (
            <>
              <div className="inv-cards">
                {filteredHidrantes.map((h) => (
                  <div key={h.id} className="inv-card">
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openDetalheHidrante(h)}>
                      <EquipmentCode kind="hidrante" codigo={h.codigo} />
                      <p className="inv-place__floor mt-1">{h.pavimento ?? "—"}</p>
                      <p className="inv-place__local">{h.local_detalhado || "—"}</p>
                      <div className="mt-2">
                        <PositionBadge positioned={h.coord_x != null} />
                      </div>
                    </button>
                    <div className="shrink-0">
                      {canSoftDelete && selectionMode && !showInactive ? (
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(h.id)}
                          onChange={() => toggleSelected(h.id)}
                          aria-label={`Selecionar ${h.codigo}`}
                        />
                      ) : !readOnly && showInactive && canSoftDelete ? (
                        <button
                          type="button"
                          onClick={() => openRestoreOne(h.id)}
                          className="grid h-9 w-9 place-items-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700"
                          aria-label={`Recuperar hidrante ${h.codigo}`}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12a9 9 0 1 0 3-6.7" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4v5h5" />
                          </svg>
                        </button>
                      ) : !readOnly ? (
                        <RowActionsMenu
                          label={`hidrante ${h.codigo}`}
                          onEdit={() => openEditHidrante(h)}
                          onSelect={canSoftDelete ? () => enterSelectionMode(h.id) : undefined}
                          onDelete={
                            canSoftDelete
                              ? () => {
                                  setPendingSoftDeleteIds([h.id]);
                                  setConfirmPhrase("");
                                  setBulkConfirmOpen(true);
                                }
                              : undefined
                          }
                        />
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              <div className="inv-table-wrap">
                <table className="modern-table inv-table">
                  <thead>
                    <tr>
                      {canSoftDelete && selectionMode && !showInactive && <th className={TH_COMPACT}>Sel.</th>}
                      <th className={TH}>{COLUNAS_PADRAO.codigoCurto}</th>
                      <th className={TH}>{COLUNAS_PADRAO.pavimento}</th>
                      <th className={TH}>{COLUNAS_PADRAO.localDetalhado}</th>
                      <th className={`hidden lg:table-cell ${TH}`}>{COLUNAS_PADRAO.mangueiras}</th>
                      <th className={`hidden lg:table-cell ${TH}`}>{COLUNAS_PADRAO.mapa}</th>
                      {!readOnly && <th className={TH}>{COLUNAS_PADRAO.acoes}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHidrantes.map((h) => (
                      <tr key={h.id} onClick={() => openDetalheHidrante(h)}>
                        {canSoftDelete && selectionMode && !showInactive && (
                          <td className="px-3 py-3" onClick={(event) => event.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(h.id)}
                              onChange={() => toggleSelected(h.id)}
                              aria-label={`Selecionar ${h.codigo}`}
                            />
                          </td>
                        )}
                        <td className="px-4 py-3">
                          <EquipmentCode kind="hidrante" codigo={h.codigo} />
                        </td>
                        <td className="px-4 py-3 text-slate-600">{h.pavimento ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-600">{h.local_detalhado || "—"}</td>
                        <td className="hidden px-4 py-3 text-slate-600 lg:table-cell">
                          {h.quantidade_mangueiras ?? "—"}
                        </td>
                        <td className="hidden px-4 py-3 lg:table-cell">
                          <PositionBadge positioned={h.coord_x != null} />
                        </td>
                        <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                          {!readOnly && showInactive && canSoftDelete ? (
                            <button
                              type="button"
                              onClick={() => openRestoreOne(h.id)}
                              className="grid h-9 w-9 place-items-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100"
                              aria-label={`Recuperar hidrante ${h.codigo}`}
                              title="Recuperar"
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12a9 9 0 1 0 3-6.7" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4v5h5" />
                              </svg>
                            </button>
                          ) : !readOnly ? (
                            <RowActionsMenu
                              label={`hidrante ${h.codigo}`}
                              onEdit={() => openEditHidrante(h)}
                              onSelect={canSoftDelete ? () => enterSelectionMode(h.id) : undefined}
                              onDelete={
                                canSoftDelete
                                  ? () => {
                                      setPendingSoftDeleteIds([h.id]);
                                      setConfirmPhrase("");
                                      setBulkConfirmOpen(true);
                                    }
                                  : undefined
                              }
                            />
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {drawerOpen && modalEntity === "extintor" && (
        <FormDrawer
          eyebrow={modalMode === "create" ? "Novo extintor" : "Editar extintor"}
          title={modalMode === "create" ? "Cadastrar extintor" : `Extintor ${form.codigo || ""}`.trim()}
          description={
            modalMode === "create"
              ? "Preencha as informações para adicionar um novo extintor ao inventário."
              : "Atualize as informações cadastrais deste equipamento."
          }
          onClose={closeModal}
          footer={
            <>
              <button type="button" onClick={closeModal} className="btn-secondary" disabled={saving}>
                Cancelar
              </button>
              <button type="submit" form="inv-extintor-form" disabled={saving} className="btn-primary">
                {saving ? "Salvando..." : modalMode === "create" ? "Cadastrar extintor" : "Salvar alterações"}
              </button>
            </>
          }
        >
          <form id="inv-extintor-form" noValidate onSubmit={(event) => void handleSubmit(event)}>
            <ExtintorInventoryForm
              mode={modalMode ?? "create"}
              form={form}
              floors={floors}
              errors={formErrors}
              onChange={set}
              onTipoChange={(tipo) =>
                setForm((prev) => ({
                  ...prev,
                  tipo,
                  tamanho: "",
                }))
              }
              onPavimentoChange={(value) => {
                floorFieldTouchedRef.current = true;
                set("setor", value);
              }}
            />
            {feedback ? (
              <div className={`inv-form-feedback ${feedback.type === "ok" ? "inv-form-feedback--ok" : "inv-form-feedback--err"}`}>
                {feedback.msg}
              </div>
            ) : null}
          </form>
        </FormDrawer>
      )}

      {drawerOpen && modalEntity === "hidrante" && (
        <FormDrawer
          eyebrow={modalMode === "create" ? "Novo hidrante" : "Editar hidrante"}
          title={modalMode === "create" ? "Cadastrar hidrante" : `Hidrante ${formHidrante.codigo || ""}`.trim()}
          description={
            modalMode === "create"
              ? "Preencha as informações para adicionar um novo hidrante ao inventário."
              : "Atualize as informações cadastrais deste equipamento."
          }
          onClose={closeModal}
          footer={
            <>
              <button type="button" onClick={closeModal} className="btn-secondary" disabled={saving}>
                Cancelar
              </button>
              <button type="submit" form="inv-hidrante-form" disabled={saving} className="btn-primary">
                {saving ? "Salvando..." : modalMode === "create" ? "Cadastrar hidrante" : "Salvar alterações"}
              </button>
            </>
          }
        >
          <form id="inv-hidrante-form" noValidate onSubmit={(event) => void handleSubmitHidrante(event)}>
            <HidranteInventoryForm
              form={formHidrante}
              floors={floors}
              errors={formErrors}
              onChange={setHidrante}
              onPavimentoChange={(value) => {
                floorFieldTouchedRef.current = true;
                setHidrante("pavimento", value);
              }}
              onQuantidadeMangueiras={setQuantidadeMangueiras}
            />
            {feedback ? (
              <div className={`inv-form-feedback ${feedback.type === "ok" ? "inv-form-feedback--ok" : "inv-form-feedback--err"}`}>
                {feedback.msg}
              </div>
            ) : null}
          </form>
        </FormDrawer>
      )}

      {detalheView && !modalMode && (
        <FormDrawer
          eyebrow={detalheView.tipo === "extintor" ? "Detalhes do extintor" : "Detalhes do hidrante"}
          title={formatEquipmentIdentifier(detalheView.tipo, detalheView.item.codigo)}
          description={
            detalheView.tipo === "extintor"
              ? [detalheView.item.setor, detalheView.item.local_detalhado].filter(Boolean).join(" · ") ||
                "Informações cadastrais deste equipamento."
              : [detalheView.item.pavimento, detalheView.item.local_detalhado].filter(Boolean).join(" · ") ||
                "Informações cadastrais deste equipamento."
          }
          onClose={closeDetalhe}
          footer={
            <>
              <button type="button" onClick={closeDetalhe} className="btn-secondary">
                Fechar
              </button>
              {!readOnly ? (
                <button type="button" onClick={editarFromDetalhe} className="btn-primary">
                  Editar
                </button>
              ) : null}
            </>
          }
        >
          {detalheView.tipo === "extintor" ? (
            <div className="inv-detail-grid">
              <DetalheCampo label={COLUNAS_PADRAO.codigo} value={detalheView.item.codigo} />
              <DetalheCampo
                label={COLUNAS_PADRAO.pavimento}
                value={detalheView.item.setor || detalheView.item.pavimento || "—"}
              />
              <DetalheCampo
                label={COLUNAS_PADRAO.localDetalhado}
                value={detalheView.item.local_detalhado || "—"}
                className="inv-detail-field--full"
              />
              <DetalheCampo label={COLUNAS_PADRAO.numInmetro} value={detalheView.item.num_inmetro || "—"} />
              <DetalheCampo label={COLUNAS_PADRAO.numCilindro} value={detalheView.item.num_cilindro || "—"} />
              <DetalheCampo label={COLUNAS_PADRAO.tipo} value={detalheView.item.tipo || "—"} />
              <DetalheCampo label={COLUNAS_PADRAO.tamanho} value={detalheView.item.tamanho || "—"} />
              <DetalheCampo
                label={COLUNAS_PADRAO.capacidadeExtintora}
                value={detalheView.item.capacidade_extintora || "—"}
                className="inv-detail-field--full"
              />
              <DetalheCampo
                label={COLUNAS_PADRAO.venctoN2}
                value={formatDate(detalheView.item.manutencao_2_nivel)}
                valueClassName={isExpired(detalheView.item.manutencao_2_nivel) ? "text-red-700" : ""}
              />
              <DetalheCampo
                label={COLUNAS_PADRAO.venctoN3}
                value={formatDate(detalheView.item.manutencao_3_nivel)}
                valueClassName={isExpired(detalheView.item.manutencao_3_nivel) ? "text-red-700" : ""}
              />
              <DetalheCampo label="Cadastrado em" value={formatDate(detalheView.item.created_at)} />
            </div>
          ) : (
            <div className="inv-detail-grid">
              <DetalheCampo label={COLUNAS_PADRAO.codigoCurto} value={detalheView.item.codigo} />
              <DetalheCampo label={COLUNAS_PADRAO.pavimento} value={detalheView.item.pavimento || "—"} />
              <DetalheCampo
                label={COLUNAS_PADRAO.localDetalhado}
                value={detalheView.item.local_detalhado || "—"}
                className="inv-detail-field--full"
              />
              <DetalheCampo
                label={COLUNAS_PADRAO.mangueiras}
                value={
                  detalheView.item.quantidade_mangueiras != null
                    ? String(detalheView.item.quantidade_mangueiras)
                    : "—"
                }
              />
              <DetalheCampo label="Quantidade de Chaves Storz" value={detalheView.item.quantidade_chaves_storz ?? "—"} />
              <DetalheCampo label="Quantidade de Esguichos" value={detalheView.item.quantidade_esguichos ?? "—"} />
              {HIDRANTE_TESTE_M_CAMPOS.slice(
                0,
                parseQuantidadeMangueiras(String(detalheView.item.quantidade_mangueiras ?? "")),
              ).map(({ key, label }) => (
                <DetalheCampo
                  key={key}
                  label={label}
                  value={formatDate(detalheView.item[key])}
                  valueClassName={isExpired(detalheView.item[key]) ? "text-red-700" : ""}
                />
              ))}
              <DetalheCampo label="Cadastrado em" value={formatDate(detalheView.item.created_at)} />
            </div>
          )}
        </FormDrawer>
      )}

      {bulkConfirmOpen && (
        <div className="modal-layer fixed inset-0 flex items-center justify-center bg-[var(--forest)]/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl shadow-[var(--forest)]/30">
            <div className="mb-4 flex items-start justify-between">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-full ${
                  showInactive ? "bg-emerald-100" : "bg-red-100"
                }`}
              >
                <svg
                  width="22"
                  height="22"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke={showInactive ? "#047857" : "var(--forest)"}
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </div>
              <ModalCloseButton
                onClick={() => {
                  setBulkConfirmOpen(false);
                  setPendingSoftDeleteIds([]);
                  setConfirmPhrase("");
                }}
              />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              {showInactive
                ? `Recuperar ${pendingSoftDeleteIds.length} item(ns)?`
                : `Você quer apagar ${pendingSoftDeleteIds.length} item(ns)?`}
            </h3>
            {showInactive ? (
              <p className="mt-2 text-sm text-slate-600">
                Os itens voltam a aparecer para os usuários desta base.
              </p>
            ) : (
              <>
                <p className="mt-2 text-sm text-slate-600">
                  Eles saem da lista ativa desta base. O histórico de inspeções permanece e você pode
                  recuperá-los depois na aba “Removidos”.
                </p>
                <p className="mt-3 text-sm font-semibold text-slate-800">
                  Para confirmar que você quer apagar estes itens, digite:
                </p>
                <p className="mt-1 rounded-xl bg-slate-100 px-3 py-2 font-mono text-sm font-bold text-red-700">
                  {SOFT_DELETE_CONFIRM_PHRASE}
                </p>
                <input
                  className="field-control mt-3"
                  placeholder="Digite a frase de confirmação"
                  value={confirmPhrase}
                  onChange={(event) => setConfirmPhrase(event.target.value)}
                  autoFocus
                  autoComplete="off"
                />
              </>
            )}
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setBulkConfirmOpen(false);
                  setPendingSoftDeleteIds([]);
                  setConfirmPhrase("");
                }}
                className="btn-secondary"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void confirmSoftDeleteOrRestore()}
                disabled={
                  deleting ||
                  (!showInactive &&
                    confirmPhrase.trim().toLocaleUpperCase("pt-BR") !== SOFT_DELETE_CONFIRM_PHRASE)
                }
                className="btn-primary disabled:opacity-50"
              >
                {deleting
                  ? "Processando..."
                  : showInactive
                    ? "Sim, recuperar"
                    : "Confirmar: quero apagar estes itens"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
