"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useActiveBase } from "@/lib/auth/active-base-context";
import { resolveFloorImageUrl } from "@/lib/auth/bases";
import { getSupabaseClient } from "@/lib/supabase/client";
import {
  defaultQuestionsForKind,
  makeUniqueQuestionKey,
  type ChecklistKind,
  type ChecklistQuestion,
} from "@/lib/checklist/default-questions";

type FloorItem = {
  id: string;
  base_id: string;
  key: string;
  label: string;
  sort_order: number;
  image_path: string;
  image_width: number;
  image_height: number;
};

function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth || 14042;
      const height = img.naturalHeight || 9934;
      URL.revokeObjectURL(url);
      resolve({ width, height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler a imagem."));
    };
    img.src = url;
  });
}

export default function AdminConfiguracoesPage() {
  const { ready, activeBaseId, activeBase } = useActiveBase();
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [floors, setFloors] = useState<FloorItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [label, setLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editFile, setEditFile] = useState<File | null>(null);

  const [checklistModalOpen, setChecklistModalOpen] = useState(false);
  const [checklistKind, setChecklistKind] = useState<ChecklistKind>("extintor");
  const [questions, setQuestions] = useState<ChecklistQuestion[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [savingQuestions, setSavingQuestions] = useState(false);
  const [newQuestionLabel, setNewQuestionLabel] = useState("");

  const callApi = useCallback(
    async <T,>(url: string, init?: RequestInit) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão não encontrada.");
      if (!activeBaseId) throw new Error("Selecione uma base ativa.");

      const response = await fetch(url, {
        ...init,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "X-Active-Base-Id": activeBaseId,
          ...(init?.headers ?? {}),
        },
      });

      const text = await response.text();
      let payload: (T & { error?: string }) | null = null;
      try {
        payload = text ? (JSON.parse(text) as T & { error?: string }) : null;
      } catch {
        payload = null;
      }
      if (!response.ok) {
        throw new Error(payload?.error ?? text ?? "Falha na requisição.");
      }
      if (!payload) throw new Error("Resposta inválida.");
      return payload;
    },
    [supabase, activeBaseId],
  );

  const load = useCallback(async () => {
    if (!ready || !activeBaseId) return;
    setLoading(true);
    try {
      const payload = await callApi<{ floors: FloorItem[] }>("/api/admin/floors");
      setFloors(payload.floors);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao carregar configurações.");
    } finally {
      setLoading(false);
    }
  }, [callApi, ready, activeBaseId]);

  const loadQuestions = useCallback(async () => {
    if (!ready || !activeBaseId) return;
    setLoadingQuestions(true);
    try {
      const payload = await callApi<{ questions: ChecklistQuestion[] }>(
        `/api/admin/checklist-questions?kind=${checklistKind}`,
      );
      setQuestions(payload.questions);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao carregar perguntas do checklist.");
    } finally {
      setLoadingQuestions(false);
    }
  }, [callApi, ready, activeBaseId, checklistKind]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    if (!checklistModalOpen) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadQuestions();
  }, [checklistModalOpen, loadQuestions]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!file) {
      setMessage("Selecione a imagem do mapa.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const dims = await readImageDimensions(file);
      const body = new FormData();
      body.set("label", label);
      body.set("sort_order", String(floors.length));
      body.set("image_width", String(dims.width));
      body.set("image_height", String(dims.height));
      body.set("file", file);
      await callApi("/api/admin/floors", { method: "POST", body });
      setLabel("");
      setFile(null);
      setMessage("Setor/mapa criado. Já aparece no cadastro e no mapeamento.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao criar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editingId) return;
    setSaving(true);
    setMessage("");
    try {
      const body = new FormData();
      body.set("id", editingId);
      body.set("label", editLabel);
      if (editFile) {
        const dims = await readImageDimensions(editFile);
        body.set("file", editFile);
        body.set("image_width", String(dims.width));
        body.set("image_height", String(dims.height));
      }
      await callApi("/api/admin/floors", { method: "PATCH", body });
      setEditingId(null);
      setEditFile(null);
      setMessage("Setor/mapa atualizado.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao atualizar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Excluir este setor/mapa?")) return;
    setSaving(true);
    setMessage("");
    try {
      await callApi("/api/admin/floors", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setMessage("Setor/mapa excluído.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao excluir.");
    } finally {
      setSaving(false);
    }
  }

  function openChecklistModal(kind: ChecklistKind) {
    setChecklistKind(kind);
    setNewQuestionLabel("");
    setChecklistModalOpen(true);
  }

  function updateQuestion(index: number, patch: Partial<ChecklistQuestion>) {
    setQuestions((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function removeQuestion(index: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  }

  function addQuestion() {
    const labelText = newQuestionLabel.trim();
    if (!labelText) return;
    const key = makeUniqueQuestionKey(
      labelText,
      questions.map((q) => q.item_key),
    );
    setQuestions((prev) => [
      ...prev,
      {
        item_key: key,
        label: labelText,
        active: true,
        sort_order: prev.length,
      },
    ]);
    setNewQuestionLabel("");
  }

  function restoreDefaults() {
    if (!window.confirm("Restaurar as perguntas padrão deste checklist?")) return;
    setQuestions(defaultQuestionsForKind(checklistKind));
  }

  async function handleSaveQuestions(event: React.FormEvent) {
    event.preventDefault();
    if (questions.length === 0) {
      setMessage("O checklist precisa ter ao menos uma pergunta.");
      return;
    }
    setSavingQuestions(true);
    setMessage("");
    try {
      const normalized = questions.map((q, index) => ({
        ...q,
        label: q.label.trim(),
        sort_order: index,
      }));
      await callApi("/api/admin/checklist-questions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: checklistKind, questions: normalized }),
      });
      setMessage(
        `Checklist de ${checklistKind === "extintor" ? "extintor" : "hidrante"} atualizado só nesta base.`,
      );
      setChecklistModalOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao salvar perguntas.");
    } finally {
      setSavingQuestions(false);
    }
  }

  if (!ready) {
    return <p className="text-sm text-slate-500">Carregando base…</p>;
  }

  if (!activeBaseId) {
    return (
      <section className="section-card p-5">
        <p className="text-sm text-slate-600">
          Selecione uma base ativa para configurar setores, mapas e checklists.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-2xl font-black tracking-tight text-slate-950">Configurações da Base</h2>
        <p className="mt-1 text-sm text-slate-500">
          Base ativa: <strong>{activeBase?.nome ?? "—"}</strong>. Aqui o administrador define setores/mapas
          e as perguntas dos checklists usadas nas inspeções desta base.
        </p>
      </div>

      <div className="section-card space-y-3 p-5">
        <h3 className="text-lg font-black text-slate-950">Checklists de inspeção</h3>
        <p className="text-sm text-slate-500">
          Edite as perguntas de extintor e hidrante. As mudanças valem apenas para esta base.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-primary"
            onClick={() => openChecklistModal("extintor")}
          >
            Editar checklist de Extintor
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => openChecklistModal("hidrante")}
          >
            Editar checklist de Hidrante
          </button>
        </div>
      </div>

      <form onSubmit={handleCreate} className="section-card space-y-3 p-5">
        <h3 className="text-lg font-black text-slate-950">Novo setor / mapa</h3>
        <input
          className="field-control"
          required
          placeholder="Nome do setor (ex.: Térreo, TECA, Subsolo)"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
        />
        <label className="block text-sm text-slate-700">
          Imagem da planta (JPG, PNG ou WebP)
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            required
            className="mt-1 block w-full text-sm"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "Salvando…" : "Adicionar"}
        </button>
      </form>

      {message && (
        <p className="surface-muted rounded-2xl p-3 text-sm font-medium text-slate-700">{message}</p>
      )}

      <div className="section-card p-5">
        <h3 className="mb-4 text-lg font-black text-slate-950">Setores e mapas cadastrados</h3>
        {loading ? (
          <p className="text-sm text-slate-500">Carregando…</p>
        ) : floors.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nenhum setor/mapa nesta base. Adicione o primeiro acima para liberar o dropdown de setores.
          </p>
        ) : (
          <div className="space-y-3">
            {floors.map((floor) => {
              const preview = resolveFloorImageUrl(floor.image_path);
              const isEditing = editingId === floor.id;
              return (
                <div
                  key={floor.id}
                  className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"
                >
                  <div className="flex flex-wrap gap-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={preview}
                      alt={floor.label}
                      className="h-24 w-36 rounded-xl border border-slate-200 object-cover bg-white"
                    />
                    <div className="min-w-0 flex-1 space-y-2">
                      {isEditing ? (
                        <form onSubmit={handleSaveEdit} className="space-y-2">
                          <input
                            className="field-control"
                            required
                            value={editLabel}
                            onChange={(event) => setEditLabel(event.target.value)}
                          />
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="block w-full text-sm"
                            onChange={(event) => setEditFile(event.target.files?.[0] ?? null)}
                          />
                          <div className="flex gap-2">
                            <button type="submit" className="btn-primary" disabled={saving}>
                              Salvar
                            </button>
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => {
                                setEditingId(null);
                                setEditFile(null);
                              }}
                            >
                              Cancelar
                            </button>
                          </div>
                        </form>
                      ) : (
                        <>
                          <p className="font-bold text-slate-950">{floor.label}</p>
                          <p className="text-xs text-slate-500">
                            Ordem {floor.sort_order} · {floor.image_width}×{floor.image_height}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700"
                              onClick={() => {
                                setEditingId(floor.id);
                                setEditLabel(floor.label);
                                setEditFile(null);
                              }}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className="rounded-xl bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700"
                              onClick={() => void handleDelete(floor.id)}
                            >
                              Excluir
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {checklistModalOpen && (
        <div
          className="fixed inset-0 z-[1200] flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => !savingQuestions && setChecklistModalOpen(false)}
        >
          <form
            onSubmit={handleSaveQuestions}
            className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
              <div>
                <h3 className="text-lg font-black text-slate-950">
                  Editar checklist — {checklistKind === "extintor" ? "Extintor" : "Hidrante"}
                </h3>
                <p className="text-xs text-slate-500">
                  Adicione, remova ou edite perguntas. Vale só para {activeBase?.nome ?? "esta base"}.
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-sm font-semibold text-slate-600"
                onClick={() => setChecklistModalOpen(false)}
                disabled={savingQuestions}
              >
                Fechar
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["extintor", "Extintor"],
                    ["hidrante", "Hidrante"],
                  ] as const
                ).map(([kind, labelKind]) => (
                  <button
                    key={kind}
                    type="button"
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold ${
                      checklistKind === kind
                        ? "brand-gradient text-white"
                        : "border border-slate-200 bg-white text-slate-700"
                    }`}
                    onClick={() => setChecklistKind(kind)}
                  >
                    {labelKind}
                  </button>
                ))}
                <button
                  type="button"
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600"
                  onClick={restoreDefaults}
                >
                  Restaurar padrão
                </button>
              </div>

              {loadingQuestions ? (
                <p className="text-sm text-slate-500">Carregando perguntas…</p>
              ) : (
                <div className="space-y-3">
                  {questions.map((question, index) => (
                    <div
                      key={`${question.item_key}-${index}`}
                      className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50/70 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Pergunta {index + 1}
                        </p>
                        <div className="flex flex-wrap items-center gap-3">
                          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                            <input
                              type="checkbox"
                              checked={question.active}
                              onChange={(event) =>
                                updateQuestion(index, { active: event.target.checked })
                              }
                            />
                            Ativa
                          </label>
                          <button
                            type="button"
                            className="text-xs font-bold text-red-600"
                            onClick={() => removeQuestion(index)}
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                      <textarea
                        className="field-control min-h-[88px]"
                        required
                        value={question.label}
                        onChange={(event) => updateQuestion(index, { label: event.target.value })}
                        placeholder="Texto da pergunta"
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 space-y-2">
                <p className="text-sm font-bold text-slate-800">Adicionar campo</p>
                <textarea
                  className="field-control min-h-[72px]"
                  placeholder="Digite a nova pergunta..."
                  value={newQuestionLabel}
                  onChange={(event) => setNewQuestionLabel(event.target.value)}
                />
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={addQuestion}
                  disabled={!newQuestionLabel.trim()}
                >
                  + Adicionar pergunta
                </button>
              </div>
            </div>

            <div className="flex gap-2 border-t border-slate-100 px-4 py-3 sm:px-5">
              <button
                type="submit"
                className="btn-primary flex-1"
                disabled={savingQuestions || loadingQuestions || questions.length === 0}
              >
                {savingQuestions ? "Salvando…" : "Salvar checklist"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={savingQuestions}
                onClick={() => setChecklistModalOpen(false)}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
