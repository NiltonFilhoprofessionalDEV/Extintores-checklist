"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useActiveBase } from "@/lib/auth/active-base-context";
import { resolveFloorImageUrl } from "@/lib/auth/bases";
import { getSupabaseClient } from "@/lib/supabase/client";

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

export default function AdminMapasSetoresPage() {
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
      setMessage(error instanceof Error ? error.message : "Falha ao carregar mapas/setores.");
    } finally {
      setLoading(false);
    }
  }, [callApi, ready, activeBaseId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

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
      setMessage("Mapa/setor criado. Ele já aparece no cadastro de extintores e no mapeamento.");
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
      setMessage("Mapa/setor atualizado.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao atualizar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Excluir este mapa/setor?")) return;
    setSaving(true);
    setMessage("");
    try {
      await callApi("/api/admin/floors", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setMessage("Mapa/setor excluído.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao excluir.");
    } finally {
      setSaving(false);
    }
  }

  if (!ready) {
    return <p className="text-sm text-slate-500">Carregando base…</p>;
  }

  if (!activeBaseId) {
    return (
      <section className="section-card p-5">
        <p className="text-sm text-slate-600">Selecione uma base ativa para configurar mapas e setores.</p>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-2xl font-black tracking-tight text-slate-950">Mapas e Setores</h2>
        <p className="mt-1 text-sm text-slate-500">
          Base ativa: <strong>{activeBase?.nome ?? "—"}</strong>. Cada item vira um mapa no
          Mapeamento e uma opção no menu <strong>Setor</strong> ao cadastrar extintores/hidrantes.
        </p>
      </div>

      <form onSubmit={handleCreate} className="section-card space-y-3 p-5">
        <h3 className="text-lg font-black text-slate-950">Novo mapa / setor</h3>
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
        <h3 className="mb-4 text-lg font-black text-slate-950">Cadastrados</h3>
        {loading ? (
          <p className="text-sm text-slate-500">Carregando…</p>
        ) : floors.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nenhum mapa/setor nesta base. Adicione o primeiro acima para liberar o dropdown de setores.
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
    </section>
  );
}
