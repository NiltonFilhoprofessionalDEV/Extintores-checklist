"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

type ExtintorRow = {
  id: string;
  codigo: string;
  setor: string;
  local_detalhado: string;
  num_inmetro: string;
  tipo: string;
  tamanho: string;
  capacidade_extintora: string;
  manutencao_2_nivel: string | null;
  manutencao_3_nivel: string | null;
  pavimento: string | null;
  coord_x: number | null;
  coord_y: number | null;
};

type FormData = Omit<ExtintorRow, "id" | "coord_x" | "coord_y">;

const EMPTY_FORM: FormData = {
  codigo: "",
  setor: "",
  local_detalhado: "",
  num_inmetro: "",
  tipo: "",
  tamanho: "",
  capacidade_extintora: "",
  manutencao_2_nivel: "",
  manutencao_3_nivel: "",
  pavimento: "",
};

type ModalMode = "create" | "edit";

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
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#E02020] focus:outline-none focus:ring-2 focus:ring-[#E02020]/20";

const TAMANHOS_POR_TIPO: Record<string, string[]> = {
  "Água": ["10 L"],
  "PQS ABC": ["4 kg", "6 kg", "8 kg", "9 kg", "12 kg", "20 kg", "30 kg", "50 kg"],
  "PQS BC": ["4 kg", "6 kg", "8 kg", "9 kg", "12 kg", "20 kg", "30 kg", "50 kg"],
  "Espuma Mecânica": ["9 L", "50 L"],
  CO2: ["4 kg", "6 kg", "10 kg", "20 kg", "25 kg", "30 kg", "50 kg"],
};

export default function AdminExtintoresPage() {
  const [extintores, setExtintores] = useState<ExtintorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExtintorRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const supabase = useMemo(() => getSupabaseClient(), []);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("extintores")
      .select(
        "id,codigo,setor,local_detalhado,num_inmetro,tipo,tamanho,capacidade_extintora,manutencao_2_nivel,manutencao_3_nivel,pavimento,coord_x,coord_y",
      )
      .order("codigo", { ascending: true });
    const rows = ((data ?? []) as ExtintorRow[]).sort((a, b) =>
      a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true, sensitivity: "base" }),
    );
    setExtintores(rows);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = filter.toLowerCase().trim();
    if (!q) return extintores;
    return extintores.filter(
      (e) =>
        e.codigo.toLowerCase().includes(q) ||
        e.setor.toLowerCase().includes(q) ||
        e.local_detalhado.toLowerCase().includes(q) ||
        e.num_inmetro.toLowerCase().includes(q) ||
        e.tipo.toLowerCase().includes(q),
    );
  }, [extintores, filter]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditId(null);
    setModalMode("create");
    setFeedback(null);
  }

  function openEdit(e: ExtintorRow) {
    setForm({
      codigo: e.codigo,
      setor: e.setor,
      local_detalhado: e.local_detalhado,
      num_inmetro: e.num_inmetro,
      tipo: e.tipo,
      tamanho: e.tamanho,
      capacidade_extintora: e.capacidade_extintora,
      manutencao_2_nivel: e.manutencao_2_nivel ?? "",
      manutencao_3_nivel: e.manutencao_3_nivel ?? "",
      pavimento: e.pavimento ?? "",
    });
    setEditId(e.id);
    setModalMode("edit");
    setFeedback(null);
  }

  function closeModal() {
    setModalMode(null);
    setEditId(null);
  }

  function set(key: keyof FormData, value: string) {
    setForm((p) => ({ ...p, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    const payload = {
      codigo: form.codigo.trim(),
      setor: form.setor.trim(),
      local_detalhado: form.local_detalhado.trim(),
      num_inmetro: form.num_inmetro.trim(),
      tipo: form.tipo.trim(),
      tamanho: form.tamanho.trim(),
      capacidade_extintora: form.capacidade_extintora.trim(),
      manutencao_2_nivel: form.manutencao_2_nivel?.trim() || null,
      manutencao_3_nivel: form.manutencao_3_nivel?.trim() || null,
      pavimento: form.pavimento?.trim() || null,
    };

    let error;
    if (modalMode === "create") {
      ({ error } = await supabase.from("extintores").insert(payload as unknown as Record<string, unknown>));
    } else {
      ({ error } = await supabase.from("extintores").update(payload as unknown as Record<string, unknown>).eq("id", editId!));
    }

    setSaving(false);
    if (error) {
      setFeedback({ type: "err", msg: `Erro: ${error.message}` });
      return;
    }

    setFeedback({
      type: "ok",
      msg: modalMode === "create" ? "Extintor cadastrado com sucesso!" : "Extintor atualizado com sucesso!",
    });
    await load();
    if (modalMode === "create") setForm(EMPTY_FORM);
    setTimeout(() => { closeModal(); setFeedback(null); }, 1200);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from("extintores").delete().eq("id", deleteTarget.id);
    setDeleting(false);
    if (error) { alert(`Erro ao excluir: ${error.message}`); return; }
    setDeleteTarget(null);
    await load();
  }

  function formatDate(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("pt-BR");
  }

  function isExpired(d: string | null) {
    if (!d) return false;
    return new Date(d) < new Date();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Extintores</h1>
          <p className="text-sm text-gray-500">{extintores.length} extintor{extintores.length !== 1 ? "es" : ""} cadastrado{extintores.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-sm"
          style={{ background: "linear-gradient(90deg, #E02020, #B51313)" }}
        >
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Novo Extintor
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#9ca3af" strokeWidth={2}>
          <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="search"
          placeholder="Buscar por código, setor, local, tipo ou INMETRO..."
          className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        {filter && (
          <button type="button" onClick={() => setFilter("")} className="text-xs text-gray-400 hover:text-gray-600">
            Limpar
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-7 w-7 animate-spin rounded-full border-4 border-[#E02020] border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-gray-400">
            {filter ? "Nenhum extintor encontrado para o filtro." : "Nenhum extintor cadastrado ainda."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Código</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Setor / Local</th>
                  <th className="hidden px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 md:table-cell">Tipo / Tamanho</th>
                  <th className="hidden px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 lg:table-cell">Nº INMETRO</th>
                  <th className="hidden px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 lg:table-cell">Vencto. N2</th>
                  <th className="hidden px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 xl:table-cell">Mapa</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-bold text-gray-900">{e.codigo}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{e.setor}</p>
                      <p className="text-xs text-gray-400">{e.local_detalhado}</p>
                    </td>
                    <td className="hidden px-4 py-3 text-gray-600 md:table-cell">
                      {e.tipo} {e.tamanho}
                    </td>
                    <td className="hidden px-4 py-3 text-gray-600 lg:table-cell">{e.num_inmetro}</td>
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
                            : { background: "#f3f4f6", color: "#6b7280" }
                        }
                      >
                        {e.coord_x != null ? "Posicionado" : "Sem posição"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(e)}
                          className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(e)}
                          className="rounded-lg border border-red-100 px-2.5 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50"
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            {/* Modal header */}
            <div
              className="flex items-center justify-between px-6 py-4"
              style={{ background: "linear-gradient(90deg, #E02020, #B51313)" }}
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-white/70">
                  {modalMode === "create" ? "Cadastro Manual" : "Editar Extintor"}
                </p>
                <h2 className="text-lg font-extrabold text-white">
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

                <Field label="Setor" required>
                  <select required className={inputCls} value={form.setor} onChange={(e) => set("setor", e.target.value)}>
                    <option value="">Selecione o setor...</option>
                    <option value="Subsolo">Subsolo</option>
                    <option value="Térreo">Térreo</option>
                    <option value="Pavimento 1">Pavimento 1</option>
                    <option value="Galeria Técnica">Galeria Técnica</option>
                    <option value="Pavimento Técnico">Pavimento Técnico</option>
                  </select>
                </Field>

                <Field label="Local Detalhado" required>
                  <input required className={`${inputCls} sm:col-span-2`} placeholder="Descrição detalhada do local" value={form.local_detalhado} onChange={(e) => set("local_detalhado", e.target.value)} />
                </Field>

                <Field label="Tipo" required>
                  <select
                    required
                    className={inputCls}
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
                    <option value="Água">Água</option>
                    <option value="PQS ABC">PQS ABC</option>
                    <option value="PQS BC">PQS BC</option>
                    <option value="Espuma Mecânica">Espuma Mecânica</option>
                    <option value="CO2">CO2</option>
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
                  <input required className={inputCls} placeholder="Ex: 4kg ABC" value={form.capacidade_extintora} onChange={(e) => set("capacidade_extintora", e.target.value)} />
                </Field>

                <div className="sm:col-span-2">
                  <div className="mb-2 border-t border-gray-100 pt-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
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

              <div className="mt-5 flex gap-3 border-t border-gray-100 pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-xl py-3 text-sm font-bold text-white disabled:opacity-60"
                  style={{ background: "linear-gradient(90deg, #E02020, #B51313)" }}
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
                  className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-600"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#E02020" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-gray-900">Excluir extintor?</h3>
            <p className="mt-1 text-sm text-gray-500">
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
                className="flex-1 rounded-xl py-3 text-sm font-bold text-white disabled:opacity-60"
                style={{ background: "linear-gradient(90deg, #E02020, #B51313)" }}
              >
                {deleting ? "Excluindo..." : "Sim, excluir"}
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-600"
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

