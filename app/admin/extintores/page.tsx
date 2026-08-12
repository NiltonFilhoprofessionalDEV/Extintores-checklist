"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { formatDateOnlyPt, parseCalendarDateAsLocal } from "@/lib/date/date-only";
import { COLUNAS_PADRAO, tituloEquipamento, type TipoEquipamento } from "@/lib/inventario/equipamento-padrao";
import { exportInventarioCompleto, type HidranteInventarioCompletoRow } from "@/lib/export/excel";
import { exportInventarioPdf } from "@/lib/export/pdf";

import { getCurrentSession, getProfileBySession, type UserRole } from "@/lib/auth/profile";
import { isInventoryReadOnlyRole } from "@/lib/auth/roles";
import { useActiveBase } from "@/lib/auth/active-base-context";
import { fetchBaseFloors } from "@/lib/auth/bases";
import InventarioTipoTabs from "@/src/components/InventarioTipoTabs";
import ExportActions from "@/src/components/ExportActions";
import ModalCloseButton from "@/src/components/ModalCloseButton";
import RowActionsMenu from "@/src/components/RowActionsMenu";

type HidranteRow = HidranteInventarioCompletoRow;

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
  coord_x: number | null;
  coord_y: number | null;
  created_at: string;
};

type FormData = Omit<ExtintorRow, "id" | "coord_x" | "coord_y" | "created_at">;

type HidranteFormData = {
  codigo: string;
  pavimento: string;
  local_detalhado: string;
  quantidade_mangueiras: string;
  teste_hidrostatico_m1: string;
  teste_hidrostatico_m2: string;
  teste_hidrostatico_m3: string;
  teste_hidrostatico_m4: string;
  quantidade_chaves_storz: string;
  quantidade_esguichos: string;
};

const EMPTY_FORM: FormData = {
  codigo: "",
  setor: "",
  local_detalhado: "",
  num_inmetro: "",
  num_cilindro: "",
  tipo: "",
  tamanho: "",
  capacidade_extintora: "",
  manutencao_2_nivel: "",
  manutencao_3_nivel: "",
  pavimento: "",
};

const EMPTY_HIDRANTE_FORM: HidranteFormData = {
  codigo: "",
  pavimento: "",
  local_detalhado: "",
  quantidade_mangueiras: "",
  teste_hidrostatico_m1: "",
  teste_hidrostatico_m2: "",
  teste_hidrostatico_m3: "",
  teste_hidrostatico_m4: "",
  quantidade_chaves_storz: "",
  quantidade_esguichos: "",
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
    <div className={`rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3 ${className}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-1 text-sm font-semibold text-slate-900 ${valueClassName}`}>{value}</p>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "field-control";

const LOCALE_PT_BR = "pt-BR";

function toUppercaseLabel(value: string): string {
  return value.trim().toLocaleUpperCase(LOCALE_PT_BR);
}

const SETORES_FALLBACK = [
  "SUBSOLO",
  "TÉRREO",
  "PAVIMENTO 1",
  "GALERIA TÉCNICA",
  "PAVIMENTO TÉCNICO",
  "TECA",
  "TPS 1",
  "SCI",
  "GUARITAS/CENTRAL DE RESÍDUOS",
] as const;

const TIPOS_EXTINTOR = ["ÁGUA", "PQS ABC", "PQS BC", "ESPUMA MECÂNICA", "CO2"] as const;

const TAMANHOS_POR_TIPO: Record<string, string[]> = {
  ÁGUA: ["10 L"],
  "PQS ABC": ["4 kg", "6 kg", "8 kg", "9 kg", "12 kg", "20 kg", "30 kg", "50 kg"],
  "PQS BC": ["4 kg", "6 kg", "8 kg", "9 kg", "12 kg", "20 kg", "30 kg", "50 kg"],
  "ESPUMA MECÂNICA": ["9 L", "50 L"],
  CO2: ["4 kg", "6 kg", "10 kg", "20 kg", "25 kg", "30 kg", "50 kg"],
};

const MANGUEIRA_OPCOES = [0, 1, 2, 3, 4] as const;

const HIDRANTE_TESTE_M_CAMPOS: { key: keyof Pick<HidranteFormData, "teste_hidrostatico_m1" | "teste_hidrostatico_m2" | "teste_hidrostatico_m3" | "teste_hidrostatico_m4">; label: string }[] = [
  { key: "teste_hidrostatico_m1", label: "Mangueira 1 (M-1)" },
  { key: "teste_hidrostatico_m2", label: "Mangueira 2 (M-2)" },
  { key: "teste_hidrostatico_m3", label: "Mangueira 3 (M-3)" },
  { key: "teste_hidrostatico_m4", label: "Mangueira 4 (M-4)" },
];

function parseQuantidadeMangueiras(value: string): number {
  if (value.trim() === "") return 0;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(4, n);
}

function clampQuantidadeMangueirasString(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const n = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  if (!Number.isFinite(n) || n < 0) return "0";
  return String(Math.min(4, n));
}

function parseOptionalIntField(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number.parseInt(trimmed, 10);
  return Number.isFinite(n) ? n : null;
}

function buildHidranteSavePayload(form: HidranteFormData) {
  const qtd = parseQuantidadeMangueiras(form.quantidade_mangueiras);
  return {
    codigo: form.codigo.trim(),
    pavimento: form.pavimento.trim() || null,
    local_detalhado: form.local_detalhado.trim(),
    quantidade_mangueiras: qtd,
    teste_hidrostatico_m1: qtd >= 1 ? form.teste_hidrostatico_m1.trim() || null : null,
    teste_hidrostatico_m2: qtd >= 2 ? form.teste_hidrostatico_m2.trim() || null : null,
    teste_hidrostatico_m3: qtd >= 3 ? form.teste_hidrostatico_m3.trim() || null : null,
    teste_hidrostatico_m4: qtd >= 4 ? form.teste_hidrostatico_m4.trim() || null : null,
    quantidade_chaves_storz: parseOptionalIntField(form.quantidade_chaves_storz),
    quantidade_esguichos: parseOptionalIntField(form.quantidade_esguichos),
  };
}

export default function AdminExtintoresPage() {
  const { ready, activeBaseId } = useActiveBase();
  const [extintores, setExtintores] = useState<ExtintorRow[]>([]);
  const [hidrantes, setHidrantes] = useState<HidranteRow[]>([]);
  const [setores, setSetores] = useState<string[]>([...SETORES_FALLBACK]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [filterHidrante, setFilterHidrante] = useState("");
  const [tipoLista, setTipoLista] = useState<TipoEquipamento>("extintor");
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [modalEntity, setModalEntity] = useState<ModalEntity>("extintor");
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [formHidrante, setFormHidrante] = useState<HidranteFormData>(EMPTY_HIDRANTE_FORM);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExtintorRow | null>(null);
  const [deleteTargetHidrante, setDeleteTargetHidrante] = useState<HidranteRow | null>(null);
  const [detalheView, setDetalheView] = useState<DetalheView | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actorRole, setActorRole] = useState<UserRole>("admin");

  const readOnly = isInventoryReadOnlyRole(actorRole);

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

    const selectWithCilindro =
      "id,codigo,setor,local_detalhado,num_inmetro,num_cilindro,tipo,tamanho,capacidade_extintora,manutencao_2_nivel,manutencao_3_nivel,pavimento,coord_x,coord_y,created_at";
    const selectLegacy =
      "id,codigo,setor,local_detalhado,num_inmetro,tipo,tamanho,capacidade_extintora,manutencao_2_nivel,manutencao_3_nivel,pavimento,coord_x,coord_y,created_at";

    let extData: ExtintorRow[] | null = null;
    const primary = await supabase
      .from("extintores")
      .select(selectWithCilindro)
      .eq("base_id", activeBaseId)
      .order("codigo", { ascending: true });

    if (primary.error && /num_cilindro|schema cache|column/i.test(primary.error.message)) {
      const fallback = await supabase
        .from("extintores")
        .select(selectLegacy)
        .eq("base_id", activeBaseId)
        .order("codigo", { ascending: true });
      extData = ((fallback.data ?? []) as ExtintorRow[]).map((row) => ({
        ...row,
        num_cilindro: row.num_cilindro ?? null,
      }));
    } else {
      extData = (primary.data ?? []) as ExtintorRow[];
    }

    const [hidRes, floors] = await Promise.all([
      supabase
        .from("hidrantes")
        .select(
          "id,codigo,pavimento,local_detalhado,quantidade_mangueiras,teste_hidrostatico_m1,teste_hidrostatico_m2,teste_hidrostatico_m3,teste_hidrostatico_m4,quantidade_chaves_storz,quantidade_esguichos,coord_x,coord_y,created_at",
        )
        .eq("base_id", activeBaseId)
        .order("codigo", { ascending: true }),
      fetchBaseFloors(activeBaseId).catch(() => []),
    ]);
    const floorLabels = floors.map((f) => f.label).filter(Boolean);
    setSetores(floorLabels.length > 0 ? floorLabels : [...SETORES_FALLBACK]);
    const rows = [...(extData ?? [])].sort((a, b) =>
      a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true, sensitivity: "base" }),
    );
    const hidRows = ((hidRes.data ?? []) as HidranteRow[]).sort((a, b) =>
      a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true, sensitivity: "base" }),
    );
    setExtintores(rows);
    setHidrantes(hidRows);
    setLoading(false);
  }, [supabase, ready, activeBaseId]);

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

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditId(null);
    setModalEntity("extintor");
    setModalMode("create");
    setFeedback(null);
  }

  function openCreateHidrante() {
    setFormHidrante(EMPTY_HIDRANTE_FORM);
    setEditId(null);
    setModalEntity("hidrante");
    setModalMode("create");
    setFeedback(null);
  }

  function openEdit(e: ExtintorRow) {
    setForm({
      codigo: e.codigo,
      setor: toUppercaseLabel(e.setor),
      local_detalhado: e.local_detalhado,
      num_inmetro: e.num_inmetro,
      num_cilindro: e.num_cilindro ?? "",
      tipo: toUppercaseLabel(e.tipo),
      tamanho: e.tamanho,
      capacidade_extintora: e.capacidade_extintora,
      manutencao_2_nivel: e.manutencao_2_nivel ?? "",
      manutencao_3_nivel: e.manutencao_3_nivel ?? "",
      pavimento: e.pavimento ?? "",
    });
    setEditId(e.id);
    setModalEntity("extintor");
    setModalMode("edit");
    setFeedback(null);
  }

  function openEditHidrante(h: HidranteRow) {
    const qtdStr = clampQuantidadeMangueirasString(h.quantidade_mangueiras);
    const qtd = parseQuantidadeMangueiras(qtdStr);
    setFormHidrante({
      codigo: h.codigo,
      pavimento: h.pavimento ? toUppercaseLabel(h.pavimento) : "",
      local_detalhado: h.local_detalhado,
      quantidade_mangueiras: qtdStr,
      teste_hidrostatico_m1: qtd >= 1 ? (h.teste_hidrostatico_m1 ?? "") : "",
      teste_hidrostatico_m2: qtd >= 2 ? (h.teste_hidrostatico_m2 ?? "") : "",
      teste_hidrostatico_m3: qtd >= 3 ? (h.teste_hidrostatico_m3 ?? "") : "",
      teste_hidrostatico_m4: qtd >= 4 ? (h.teste_hidrostatico_m4 ?? "") : "",
      quantidade_chaves_storz: h.quantidade_chaves_storz != null ? String(h.quantidade_chaves_storz) : "",
      quantidade_esguichos: h.quantidade_esguichos != null ? String(h.quantidade_esguichos) : "",
    });
    setEditId(h.id);
    setModalEntity("hidrante");
    setModalMode("edit");
    setFeedback(null);
  }

  function closeModal() {
    setModalMode(null);
    setEditId(null);
  }

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

  function set(key: keyof FormData, value: string) {
    setForm((p) => ({ ...p, [key]: value }));
  }

  function setHidrante(key: keyof HidranteFormData, value: string) {
    setFormHidrante((p) => ({ ...p, [key]: value }));
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
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    const setorLabel = toUppercaseLabel(form.setor);
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
      // Alinha com o pavimento do mapa (mesmo nome do setor em Configurações da Base)
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
      setSaving(false);
      setFeedback({
        type: "err",
        msg: `Erro: ${err instanceof Error ? err.message : "Falha ao salvar."}`,
      });
      return;
    }

    setSaving(false);

    setFeedback({
      type: "ok",
      msg: modalMode === "create" ? "Extintor cadastrado com sucesso!" : "Extintor atualizado com sucesso!",
    });
    await load();
    if (modalMode === "create") setForm(EMPTY_FORM);
    setTimeout(() => { closeModal(); setFeedback(null); }, 1200);
  }

  async function handleSubmitHidrante(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    const payload = buildHidranteSavePayload(formHidrante);

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
      setSaving(false);
      setFeedback({
        type: "err",
        msg: `Erro: ${err instanceof Error ? err.message : "Falha ao salvar."}`,
      });
      return;
    }

    setSaving(false);
    setFeedback({
      type: "ok",
      msg: modalMode === "create" ? "Hidrante cadastrado com sucesso!" : "Hidrante atualizado com sucesso!",
    });
    await load();
    if (modalMode === "create") setFormHidrante(EMPTY_HIDRANTE_FORM);
    setTimeout(() => { closeModal(); setFeedback(null); }, 1200);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await callInventoryApi("/api/admin/extintores", {
        method: "DELETE",
        body: JSON.stringify({ id: deleteTarget.id }),
      });
    } catch (err) {
      setDeleting(false);
      alert(`Erro ao excluir: ${err instanceof Error ? err.message : "Falha na requisição."}`);
      return;
    }
    setDeleting(false);
    setDeleteTarget(null);
    await load();
  }

  async function handleDeleteHidrante() {
    if (!deleteTargetHidrante) return;
    setDeleting(true);
    try {
      await callInventoryApi("/api/admin/hidrantes", {
        method: "DELETE",
        body: JSON.stringify({ id: deleteTargetHidrante.id }),
      });
    } catch (err) {
      setDeleting(false);
      alert(`Erro ao excluir: ${err instanceof Error ? err.message : "Falha na requisição."}`);
      return;
    }
    setDeleting(false);
    setDeleteTargetHidrante(null);
    await load();
  }

  function formatDate(d: string | null) {
    return formatDateOnlyPt(d);
  }

  function isExpired(d: string | null) {
    if (!d) return false;
    const date = parseCalendarDateAsLocal(d);
    if (!date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    return date < today;
  }

  return (
    <div className="space-y-5">
      <div className="professional-card reveal-up p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div>
            <p className="page-eyebrow">Inventário</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[var(--ink)]">Extintores e hidrantes</h1>
            <p className="mt-2 text-sm font-medium text-[var(--muted-foreground)]">
              {extintores.length} extintor{extintores.length !== 1 ? "es" : ""} e {hidrantes.length} hidrante
              {hidrantes.length !== 1 ? "s" : ""} cadastrados.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ExportActions
              disabled={loading || (extintores.length === 0 && hidrantes.length === 0)}
              onExcel={() => exportInventarioCompleto(extintores, hidrantes)}
              onPdf={() => exportInventarioPdf(extintores, hidrantes)}
            />
            {tipoLista === "extintor" && !readOnly && (
              <button
                type="button"
                onClick={openCreate}
                className="btn-primary"
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Novo Extintor
              </button>
            )}
            {tipoLista === "hidrante" && !readOnly && (
              <button
                type="button"
                onClick={openCreateHidrante}
                className="btn-primary"
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Novo Hidrante
              </button>
            )}
          </div>
        </div>
      </div>

      <InventarioTipoTabs
        value={tipoLista}
        onChange={setTipoLista}
        extintoresCount={extintores.length}
        hidrantesCount={hidrantes.length}
      />

      {tipoLista === "extintor" && (
        <>
      <div className="professional-card flex items-center gap-2 px-4 py-3">
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#9ca3af" strokeWidth={2}>
          <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="search"
          placeholder="Buscar extintor por código, setor, local, tipo ou INMETRO..."
          className="flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        {filter && (
          <button type="button" onClick={() => setFilter("")} className="text-xs text-slate-400 hover:text-slate-600">
            Limpar
          </button>
        )}
      </div>

      {/* Table */}
      <div className="professional-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-7 w-7 animate-spin rounded-full border-4 border-[var(--neon)] border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-slate-400">
            {filter ? "Nenhum extintor encontrado para o filtro." : "Nenhum extintor cadastrado ainda."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="modern-table">
              <thead>
                <tr className="text-left">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{COLUNAS_PADRAO.codigo}</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{COLUNAS_PADRAO.setor} / {COLUNAS_PADRAO.localDetalhado}</th>
                  <th className="hidden px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 md:table-cell">{COLUNAS_PADRAO.tipo} / {COLUNAS_PADRAO.tamanho}</th>
                  <th className="hidden px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 lg:table-cell">{COLUNAS_PADRAO.numInmetro}</th>
                  <th className="hidden px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 lg:table-cell">{COLUNAS_PADRAO.venctoN2}</th>
                  <th className="hidden px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 xl:table-cell">{COLUNAS_PADRAO.mapa}</th>
                  {!readOnly && (
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{COLUNAS_PADRAO.acoes}</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((e) => (
                  <tr
                    key={e.id}
                    className="cursor-pointer border-b border-slate-100 transition hover:bg-slate-50"
                    onClick={() => openDetalheExtintor(e)}
                  >
                    <td className="px-4 py-3 font-bold text-slate-900">{e.codigo}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{e.setor}</p>
                      <p className="text-xs text-slate-400">{e.local_detalhado}</p>
                    </td>
                    <td className="hidden px-4 py-3 text-slate-600 md:table-cell">
                      {e.tipo} {e.tamanho}
                    </td>
                    <td className="hidden px-4 py-3 text-slate-600 lg:table-cell">{e.num_inmetro}</td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      <span
                        className="text-xs font-medium"
                        style={{ color: isExpired(e.manutencao_2_nivel) ? "#b91c1c" : "#374151" }}
                      >
                        {formatDate(e.manutencao_2_nivel)}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 xl:table-cell">
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
                        style={
                          e.coord_x != null
                            ? { background: "#dcfce7", color: "#15803d" }
                            : { background: "#f2f4f7", color: "#667085" }
                        }
                      >
                        {e.coord_x != null ? "Posicionado" : "Sem posição"}
                      </span>
                    </td>
                    <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                      {!readOnly && (
                        <RowActionsMenu
                          label={`extintor ${e.codigo}`}
                          onEdit={() => openEdit(e)}
                          onDelete={() => setDeleteTarget(e)}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
        </>
      )}

      {tipoLista === "hidrante" && (
        <>
      <div className="professional-card flex items-center gap-2 px-4 py-3">
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#9ca3af" strokeWidth={2}>
          <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="search"
          placeholder="Buscar hidrante por código, pavimento ou local..."
          className="flex-1 bg-transparent text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
          value={filterHidrante}
          onChange={(e) => setFilterHidrante(e.target.value)}
        />
        {filterHidrante && (
          <button type="button" onClick={() => setFilterHidrante("")} className="text-xs text-slate-400 hover:text-slate-600">
            Limpar
          </button>
        )}
      </div>

      <div className="professional-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-7 w-7 animate-spin rounded-full border-4 border-[var(--neon)] border-t-transparent" />
          </div>
        ) : filteredHidrantes.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-slate-400">
            {filterHidrante ? "Nenhum hidrante encontrado para o filtro." : "Nenhum hidrante cadastrado ainda."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="modern-table">
              <thead>
                <tr className="text-left">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{COLUNAS_PADRAO.codigo}</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{COLUNAS_PADRAO.pavimento}</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{COLUNAS_PADRAO.localDetalhado}</th>
                  <th className="hidden px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 md:table-cell">
                    {COLUNAS_PADRAO.mangueiras}
                  </th>
                  <th className="hidden px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 lg:table-cell">
                    {COLUNAS_PADRAO.mapa}
                  </th>
                  {!readOnly && (
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{COLUNAS_PADRAO.acoes}</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredHidrantes.map((h) => (
                  <tr
                    key={h.id}
                    className="cursor-pointer border-b border-slate-100 transition hover:bg-slate-50"
                    onClick={() => openDetalheHidrante(h)}
                  >
                    <td className="px-4 py-3 font-bold text-slate-900">{h.codigo}</td>
                    <td className="px-4 py-3 text-slate-600">{h.pavimento ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{h.local_detalhado || "—"}</td>
                    <td className="hidden px-4 py-3 text-slate-600 md:table-cell">{h.quantidade_mangueiras ?? "—"}</td>
                    <td className="hidden px-4 py-3 lg:table-cell">
                      <span
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
                        style={
                          h.coord_x != null
                            ? { background: "#dcfce7", color: "#15803d" }
                            : { background: "#f2f4f7", color: "#667085" }
                        }
                      >
                        {h.coord_x != null ? "Posicionado" : "Sem posição"}
                      </span>
                    </td>
                    <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                      {!readOnly && (
                        <RowActionsMenu
                          label={`hidrante ${h.codigo}`}
                          onEdit={() => openEditHidrante(h)}
                          onDelete={() => setDeleteTargetHidrante(h)}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
        </>
      )}

      {/* Create / Edit Modal */}
      {modalMode && modalEntity === "extintor" && (
        <div className="modal-layer fixed inset-0 flex items-center justify-center bg-[var(--forest)]/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl shadow-[var(--forest)]/30">
            {/* Modal header */}
            <div
              className="flex items-center justify-between bg-[var(--forest)] px-6 py-4 text-white"
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-white/70">
                  {modalMode === "create" ? "Cadastro Manual" : "Editar Extintor"}
                </p>
                <h2 className="text-lg font-black text-white">
                  {modalMode === "create" ? "Novo Extintor" : form.codigo}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/30 text-white hover:bg-white/10"
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="max-h-[75vh] overflow-y-auto px-6 py-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                <Field label="Código" required>
                  <input required className={inputCls} placeholder="Ex: EXT-001" value={form.codigo} onChange={(e) => set("codigo", e.target.value)} />
                </Field>

                <Field label="Nº INMETRO" required>
                  <input required className={inputCls} placeholder="Número do INMETRO" value={form.num_inmetro} onChange={(e) => set("num_inmetro", e.target.value)} />
                </Field>

                <Field label={COLUNAS_PADRAO.numCilindro}>
                  <input
                    className={inputCls}
                    placeholder="Número do cilindro"
                    value={form.num_cilindro ?? ""}
                    onChange={(e) => set("num_cilindro", e.target.value)}
                  />
                </Field>

                <Field label="Setor" required>
                  <select
                    required
                    className={`${inputCls} uppercase`}
                    value={form.setor}
                    onChange={(e) => set("setor", e.target.value)}
                  >
                    <option value="">Selecione o setor...</option>
                    {setores.map((setor) => (
                      <option key={setor} value={setor}>
                        {setor}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Local Detalhado" required>
                  <input required className={`${inputCls} sm:col-span-2`} placeholder="Descrição detalhada do local" value={form.local_detalhado} onChange={(e) => set("local_detalhado", e.target.value)} />
                </Field>

                <Field label="Tipo" required>
                  <select
                    required
                    className={`${inputCls} uppercase`}
                    value={form.tipo}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        tipo: e.target.value,
                        tamanho: "",
                      }))
                    }
                  >
                    <option value="">Selecione o tipo...</option>
                    {TIPOS_EXTINTOR.map((tipo) => (
                      <option key={tipo} value={tipo}>
                        {tipo}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Tamanho" required>
                  <select
                    required
                    className={inputCls}
                    value={form.tamanho}
                    onChange={(e) => set("tamanho", e.target.value)}
                    disabled={!form.tipo}
                  >
                    <option value="">
                      {form.tipo ? "Selecione o tamanho..." : "Selecione um tipo primeiro"}
                    </option>
                    {(TAMANHOS_POR_TIPO[form.tipo] ?? []).map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Capacidade Extintora" required>
                  <input
                    required
                    readOnly={modalMode === "edit"}
                    className={
                      modalMode === "edit"
                        ? `${inputCls} cursor-not-allowed bg-slate-50 text-slate-500`
                        : inputCls
                    }
                    placeholder="Ex: 4kg ABC"
                    value={form.capacidade_extintora}
                    onChange={(e) => set("capacidade_extintora", e.target.value)}
                  />
                </Field>

                <div className="sm:col-span-2">
                  <div className="mb-2 border-t border-slate-100 pt-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Datas de Manutenção
                    </p>
                  </div>
                </div>

                <Field label="Vencimento Manutenção Nível 2">
                  <input
                    type="date"
                    className={inputCls}
                    value={form.manutencao_2_nivel ?? ""}
                    onChange={(e) => set("manutencao_2_nivel", e.target.value)}
                  />
                </Field>

                <Field label="Vencimento Manutenção Nível 3">
                  <input
                    type="date"
                    className={inputCls}
                    value={form.manutencao_3_nivel ?? ""}
                    onChange={(e) => set("manutencao_3_nivel", e.target.value)}
                  />
                </Field>
              </div>

              {feedback && (
                <div
                  className="mt-4 rounded-xl px-4 py-3 text-sm font-semibold"
                  style={
                    feedback.type === "ok"
                      ? { background: "#dcfce7", color: "#15803d" }
                      : { background: "#fee2e2", color: "#b91c1c" }
                  }
                >
                  {feedback.msg}
                </div>
              )}

              <div className="mt-5 flex gap-3 border-t border-slate-100 pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary flex-1"
                >
                  {saving
                    ? "Salvando..."
                    : modalMode === "create"
                      ? "Cadastrar Extintor"
                      : "Salvar Alterações"}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalMode && modalEntity === "hidrante" && (
        <div className="modal-layer fixed inset-0 flex items-center justify-center bg-[var(--forest)]/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl shadow-[var(--forest)]/30">
            <div className="flex items-center justify-between bg-[var(--forest)] px-6 py-4 text-white">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-white/70">
                  {modalMode === "create" ? "Cadastro Manual" : "Editar Hidrante"}
                </p>
                <h2 className="text-lg font-black text-white">
                  {modalMode === "create" ? "Novo Hidrante" : formHidrante.codigo}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/30 text-white hover:bg-white/10"
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmitHidrante} className="max-h-[75vh] overflow-y-auto px-6 py-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Código do Local" required>
                  <input
                    required
                    className={inputCls}
                    placeholder="Ex: HID-001"
                    value={formHidrante.codigo}
                    onChange={(e) => setHidrante("codigo", e.target.value)}
                  />
                </Field>

                <Field label="Pavimento">
                  <select
                    className={`${inputCls} uppercase`}
                    value={formHidrante.pavimento}
                    onChange={(e) => setHidrante("pavimento", e.target.value)}
                  >
                    <option value="">Selecione o pavimento...</option>
                    {setores.map((setor) => (
                      <option key={setor} value={setor}>
                        {setor}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Localização Detalhada" required>
                  <input
                    required
                    className={inputCls}
                    placeholder="Descrição detalhada do local"
                    value={formHidrante.local_detalhado}
                    onChange={(e) => setHidrante("local_detalhado", e.target.value)}
                  />
                </Field>

                <Field label="Quantidade de Mangueiras">
                  <select
                    required
                    className={inputCls}
                    value={formHidrante.quantidade_mangueiras}
                    onChange={(e) => setQuantidadeMangueiras(e.target.value)}
                  >
                    <option value="" disabled>
                      Selecione a quantidade...
                    </option>
                    {MANGUEIRA_OPCOES.map((n) => (
                      <option key={n} value={String(n)}>
                        {n}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Quantidade de Chaves Storz">
                  <input
                    type="number"
                    min={0}
                    className={inputCls}
                    placeholder="Ex: 2"
                    value={formHidrante.quantidade_chaves_storz}
                    onChange={(e) => setHidrante("quantidade_chaves_storz", e.target.value)}
                  />
                </Field>

                <Field label="Quantidade de Esguichos">
                  <input
                    type="number"
                    min={0}
                    className={inputCls}
                    placeholder="Ex: 1"
                    value={formHidrante.quantidade_esguichos}
                    onChange={(e) => setHidrante("quantidade_esguichos", e.target.value)}
                  />
                </Field>

                <div className="sm:col-span-2">
                  <div className="mb-2 border-t border-slate-100 pt-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Datas do Último Teste Hidrostático
                    </p>
                    {parseQuantidadeMangueiras(formHidrante.quantidade_mangueiras) === 0 && (
                      <p className="mt-1 text-sm text-slate-500">
                        Nenhuma mangueira cadastrada — não há datas de teste a informar.
                      </p>
                    )}
                  </div>
                </div>

                {HIDRANTE_TESTE_M_CAMPOS.slice(0, parseQuantidadeMangueiras(formHidrante.quantidade_mangueiras)).map(
                  ({ key, label }) => (
                    <Field key={key} label={label}>
                      <input
                        type="date"
                        className={inputCls}
                        value={formHidrante[key]}
                        onChange={(e) => setHidrante(key, e.target.value)}
                      />
                    </Field>
                  ),
                )}
              </div>

              {feedback && (
                <div
                  className="mt-4 rounded-xl px-4 py-3 text-sm font-semibold"
                  style={
                    feedback.type === "ok"
                      ? { background: "#dcfce7", color: "#15803d" }
                      : { background: "#fee2e2", color: "#b91c1c" }
                  }
                >
                  {feedback.msg}
                </div>
              )}

              <div className="mt-5 flex gap-3 border-t border-slate-100 pt-4">
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving
                    ? "Salvando..."
                    : modalMode === "create"
                      ? "Cadastrar Hidrante"
                      : "Salvar Alterações"}
                </button>
                <button type="button" onClick={closeModal} className="btn-secondary">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detalheView && (
        <div className="modal-layer fixed inset-0 flex items-center justify-center bg-[var(--forest)]/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl shadow-[var(--forest)]/30">
            <div className="flex items-center justify-between bg-[var(--forest)] px-6 py-4 text-white">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-white/70">
                  Detalhes do equipamento
                </p>
                <h2 className="text-lg font-black text-white">
                  {tituloEquipamento(detalheView.item.codigo, detalheView.tipo)}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeDetalhe}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/30 text-white hover:bg-white/10"
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="max-h-[75vh] overflow-y-auto px-6 py-5">
              {detalheView.tipo === "extintor" ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <DetalheCampo label={COLUNAS_PADRAO.codigo} value={detalheView.item.codigo} />
                  <DetalheCampo label={COLUNAS_PADRAO.setor} value={detalheView.item.setor || "—"} />
                  <DetalheCampo
                    label={COLUNAS_PADRAO.localDetalhado}
                    value={detalheView.item.local_detalhado || "—"}
                    className="sm:col-span-2"
                  />
                  <DetalheCampo label={COLUNAS_PADRAO.pavimento} value={detalheView.item.pavimento || "—"} />
                  <DetalheCampo label={COLUNAS_PADRAO.numInmetro} value={detalheView.item.num_inmetro || "—"} />
                  <DetalheCampo
                    label={COLUNAS_PADRAO.numCilindro}
                    value={detalheView.item.num_cilindro || "—"}
                  />
                  <DetalheCampo label={COLUNAS_PADRAO.tipo} value={detalheView.item.tipo || "—"} />
                  <DetalheCampo label={COLUNAS_PADRAO.tamanho} value={detalheView.item.tamanho || "—"} />
                  <DetalheCampo
                    label="Capacidade Extintora"
                    value={detalheView.item.capacidade_extintora || "—"}
                  />
                  <DetalheCampo
                    label={COLUNAS_PADRAO.venctoN2}
                    value={formatDate(detalheView.item.manutencao_2_nivel)}
                    valueClassName={isExpired(detalheView.item.manutencao_2_nivel) ? "text-red-700" : ""}
                  />
                  <DetalheCampo
                    label="Vencto. manutenção N3"
                    value={formatDate(detalheView.item.manutencao_3_nivel)}
                    valueClassName={isExpired(detalheView.item.manutencao_3_nivel) ? "text-red-700" : ""}
                  />
                  <DetalheCampo label="Cadastrado em" value={formatDate(detalheView.item.created_at)} />
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <DetalheCampo label={COLUNAS_PADRAO.codigo} value={detalheView.item.codigo} />
                  <DetalheCampo label={COLUNAS_PADRAO.pavimento} value={detalheView.item.pavimento || "—"} />
                  <DetalheCampo
                    label={COLUNAS_PADRAO.localDetalhado}
                    value={detalheView.item.local_detalhado || "—"}
                    className="sm:col-span-2"
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

              <div className="mt-5 flex gap-3">
                {!readOnly && (
                  <button type="button" onClick={editarFromDetalhe} className="btn-primary flex-1">
                    Editar
                  </button>
                )}
                <button type="button" onClick={closeDetalhe} className={`btn-secondary ${readOnly ? "flex-1" : ""}`}>
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="modal-layer fixed inset-0 flex items-center justify-center bg-[var(--forest)]/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl shadow-[var(--forest)]/30">
            <div className="mb-4 flex items-start justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="var(--forest)" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <ModalCloseButton onClick={() => setDeleteTarget(null)} />
            </div>
            <h3 className="text-base font-bold text-slate-900">Excluir extintor?</h3>
            <p className="mt-1 text-sm text-slate-500">
              <strong>{deleteTarget.codigo}</strong> — {deleteTarget.local_detalhado}
            </p>
            <p className="mt-1 text-xs text-red-600">
              Todos os checklists deste extintor também serão excluídos. Essa ação não pode ser desfeita.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="btn-primary flex-1"
              >
                {deleting ? "Excluindo..." : "Sim, excluir"}
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="btn-secondary"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTargetHidrante && (
        <div className="modal-layer fixed inset-0 flex items-center justify-center bg-[var(--forest)]/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl shadow-[var(--forest)]/30">
            <div className="mb-4 flex items-start justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="var(--forest)" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <ModalCloseButton onClick={() => setDeleteTargetHidrante(null)} />
            </div>
            <h3 className="text-base font-bold text-slate-900">Excluir hidrante?</h3>
            <p className="mt-1 text-sm text-slate-500">
              <strong>{deleteTargetHidrante.codigo}</strong> — {deleteTargetHidrante.local_detalhado}
            </p>
            <p className="mt-1 text-xs text-red-600">
              Todas as conferências deste hidrante também serão excluídas. Essa ação não pode ser desfeita.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={handleDeleteHidrante}
                disabled={deleting}
                className="btn-primary flex-1"
              >
                {deleting ? "Excluindo..." : "Sim, excluir"}
              </button>
              <button
                type="button"
                onClick={() => setDeleteTargetHidrante(null)}
                className="btn-secondary"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

