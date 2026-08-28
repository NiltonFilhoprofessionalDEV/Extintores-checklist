"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import type { ExtintorStockConfig } from "@/lib/estoque/compatibility";
import { formatExtintorConfigLabel } from "@/lib/estoque/compatibility";
import { toDateInputValue } from "@/lib/inventario/inventory-form";
import FormDrawer from "@/src/components/inventory/FormDrawer";
import { FormField, FormSection, fieldControlClass } from "@/src/components/inventory/FormPrimitives";
import { formatEquipmentIdentifier } from "@/lib/map/marker-label";

type StockOption = {
  id: string;
  tipo: string;
  tamanho: string;
  capacidade_extintora: string;
  quantidade: number;
  manutencao_2_nivel: string | null;
  manutencao_3_nivel: string | null;
};

export type SubstituirLocationContext = {
  pavimento?: string | null;
  setor?: string;
  local_detalhado?: string;
};

type SubstituirEquipamentoDrawerProps = {
  extintorId: string;
  codigo: string;
  expectedConfig: ExtintorStockConfig;
  locationContext?: SubstituirLocationContext;
  activeBaseId: string | null;
  saving: boolean;
  presentation?: "drawer" | "sheet";
  onClose: () => void;
  onConfirm: (payload: {
    estoque_id: string;
    num_inmetro: string;
    num_cilindro: string | null;
    manutencao_2_nivel: string | null;
    manutencao_3_nivel: string | null;
  }) => void;
};

type Step = "form" | "confirm";

function formatStockOptionSubtitle(opt: StockOption): string {
  const cap = opt.capacidade_extintora.trim();
  const qtd = `${opt.quantidade} disponível${opt.quantidade !== 1 ? "s" : ""}`;
  return cap ? `${cap} · ${qtd}` : qtd;
}

function SubstituirShell({
  presentation,
  title,
  description,
  onClose,
  footer,
  children,
}: {
  presentation: "drawer" | "sheet";
  title: string;
  description: string;
  onClose: () => void;
  footer: ReactNode;
  children: ReactNode;
}) {
  if (presentation === "drawer") {
    return (
      <FormDrawer
        eyebrow="Substituição"
        title={title}
        description={description}
        onClose={onClose}
        footer={footer}
      >
        {children}
      </FormDrawer>
    );
  }

  return (
    <div
      className="modal-layer fixed inset-0 z-[5000] flex items-end bg-black/40"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex h-[100dvh] max-h-[100dvh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:max-h-[min(92dvh,720px)]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="substituir-sheet-title"
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-zinc-300" />
        </div>
        <header className="border-b border-slate-100 px-5 pb-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Substituição</p>
          <h2 id="substituir-sheet-title" className="mt-1 text-lg font-bold text-slate-900">
            {title}
          </h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        <footer className="border-t border-slate-100 px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
          {footer}
        </footer>
      </div>
    </div>
  );
}

function LocationBlock({ locationContext }: { locationContext?: SubstituirLocationContext }) {
  const floor = locationContext?.pavimento?.trim() || locationContext?.setor?.trim();
  const local = locationContext?.local_detalhado?.trim();

  if (!floor && !local) return null;

  return (
    <div className="mt-3 border-t border-slate-200/80 pt-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Local</p>
      {floor ? <p className="mt-1 text-sm font-semibold text-slate-800">{floor}</p> : null}
      {local ? <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{local}</p> : null}
    </div>
  );
}

export default function SubstituirEquipamentoDrawer({
  extintorId,
  codigo,
  expectedConfig,
  locationContext,
  activeBaseId,
  saving,
  presentation = "drawer",
  onClose,
  onConfirm,
}: SubstituirEquipamentoDrawerProps) {
  const [options, setOptions] = useState<StockOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [numInmetro, setNumInmetro] = useState("");
  const [numCilindro, setNumCilindro] = useState("");
  const [manut2, setManut2] = useState("");
  const [manut3, setManut3] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [step, setStep] = useState<Step>("form");

  const supabase = useMemo(() => getSupabaseClient(), []);
  const pointLabel = formatEquipmentIdentifier("extintor", codigo);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setLoadError("");
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) throw new Error("Sessão não encontrada.");

        const params = new URLSearchParams({ extintor_id: extintorId });
        const response = await fetch(`/api/admin/estoque?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            ...(activeBaseId ? { "X-Active-Base-Id": activeBaseId } : {}),
          },
        });

        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
          items?: StockOption[];
        };

        if (cancelled) return;

        if (!response.ok) {
          setLoadError(payload.error ?? "Erro ao consultar estoque.");
          setOptions([]);
        } else {
          setOptions(payload.items ?? []);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Erro ao consultar estoque.");
          setOptions([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase, activeBaseId, extintorId]);

  const selected = options.find((o) => o.id === selectedId);

  useEffect(() => {
    if (!selected) return;
    setManut2(toDateInputValue(selected.manutencao_2_nivel));
    setManut3(toDateInputValue(selected.manutencao_3_nivel));
  }, [selectedId, selected]);

  function selectOption(id: string) {
    setSelectedId(id);
    setErrors((prev) => {
      const next = { ...prev };
      delete next.estoque;
      return next;
    });
  }

  function validateForm() {
    const nextErrors: Record<string, string> = {};
    if (!selectedId) nextErrors.estoque = "Selecione um equipamento do estoque.";
    if (!numInmetro.trim()) nextErrors.num_inmetro = "Nº do INMETRO é obrigatório.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  function handlePrimaryAction() {
    if (step === "confirm") {
      if (!selectedId) return;
      onConfirm({
        estoque_id: selectedId,
        num_inmetro: numInmetro.trim(),
        num_cilindro: numCilindro.trim() || null,
        manutencao_2_nivel: manut2.trim() || null,
        manutencao_3_nivel: manut3.trim() || null,
      });
      return;
    }

    if (!validateForm()) return;
    setStep("confirm");
  }

  const footer =
    step === "confirm" ? (
      <div className={`inv-drawer__footer-actions ${presentation === "sheet" ? "flex-col" : ""}`}>
        <button
          type="button"
          className="btn-secondary w-full sm:w-auto"
          onClick={() => setStep("form")}
          disabled={saving}
        >
          Voltar
        </button>
        <button type="button" className="btn-primary w-full sm:w-auto" onClick={handlePrimaryAction} disabled={saving}>
          {saving ? "Substituindo..." : "Confirmar substituição"}
        </button>
      </div>
    ) : (
      <div className={`inv-drawer__footer-actions ${presentation === "sheet" ? "flex-col" : ""}`}>
        <button type="button" className="btn-secondary w-full sm:w-auto" onClick={onClose} disabled={saving}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn-primary w-full sm:w-auto"
          onClick={handlePrimaryAction}
          disabled={saving || loading || options.length === 0}
        >
          Revisar substituição
        </button>
      </div>
    );

  const title = step === "confirm" ? `Substituir ${pointLabel}?` : "Substituir extintor";
  const description =
    step === "confirm"
      ? "O equipamento retirado será substituído pelo equipamento selecionado do estoque."
      : `Escolha um equipamento compatível para instalar no ponto ${pointLabel}.`;

  return (
    <SubstituirShell
      presentation={presentation}
      title={title}
      description={description}
      onClose={onClose}
      footer={footer}
    >
      {step === "confirm" && selected ? (
        <div className="space-y-4">
          <div className="inv-detail-summary rounded-xl bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-900">Extintor retirado: {pointLabel}</p>
            <LocationBlock locationContext={locationContext} />
          </div>

          <div className="inv-detail-summary rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Equipamento</p>
            <p className="mt-1 text-sm font-bold text-slate-900">{formatExtintorConfigLabel(selected)}</p>
            <p className="mt-0.5 text-sm text-slate-600">{selected.tamanho}</p>
            <p className="mt-2 text-sm text-slate-700">
              <span className="font-semibold text-slate-800">INMETRO:</span> {numInmetro.trim()}
            </p>
            {numCilindro.trim() ? (
              <p className="mt-1 text-sm text-slate-700">
                <span className="font-semibold text-slate-800">Cilindro:</span> {numCilindro.trim()}
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          <div className="inv-detail-summary mb-4 rounded-xl bg-slate-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Extintor retirado</p>
            <p className="mt-1 text-sm font-bold text-slate-900">{pointLabel}</p>
            <LocationBlock locationContext={locationContext} />
            <div className="mt-3 border-t border-slate-200/80 pt-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Configuração necessária</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{formatExtintorConfigLabel(expectedConfig)}</p>
              {expectedConfig.capacidade_extintora.trim() ? (
                <p className="mt-0.5 text-sm text-slate-600">{expectedConfig.capacidade_extintora.trim()}</p>
              ) : null}
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-slate-500">Consultando estoque compatível...</p>
          ) : loadError ? (
            <p className="text-sm text-red-600">{loadError}</p>
          ) : options.length === 0 ? (
            <p className="text-sm text-amber-700">
              Não há equipamentos compatíveis disponíveis no estoque.
            </p>
          ) : (
            <FormSection title="Equipamentos disponíveis">
              <p className="inv-field--full mb-3 text-xs text-slate-500">
                Toque no equipamento que será instalado neste ponto.
              </p>
              {errors.estoque ? (
                <p className="inv-field--full mb-2 text-xs font-semibold text-red-600">{errors.estoque}</p>
              ) : null}
              <div className="inv-field--full grid gap-2">
                {options.map((opt) => {
                  const active = selectedId === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      className={`min-h-[44px] rounded-xl border p-3 text-left transition ${
                        active
                          ? "border-[var(--orange)] bg-orange-50 ring-2 ring-[var(--orange)]/30"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      }`}
                      onClick={() => selectOption(opt.id)}
                      aria-pressed={active}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900">{formatExtintorConfigLabel(opt)}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{formatStockOptionSubtitle(opt)}</p>
                        </div>
                        {active ? (
                          <span className="shrink-0 rounded-full bg-[var(--orange)] px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                            Selecionado
                          </span>
                        ) : (
                          <span className="shrink-0 text-xs font-bold text-[var(--orange)]">Selecionar</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </FormSection>
          )}

          {selected ? (
            <FormSection title="Equipamento físico">
              <p className="inv-field--full mb-2 text-xs text-slate-500">
                Informe o INMETRO e, se houver, o cilindro do equipamento que está sendo instalado.
              </p>
              <FormField id="sub-inmetro" label="Nº do INMETRO" required error={errors.num_inmetro}>
                <input
                  className={fieldControlClass(errors.num_inmetro)}
                  value={numInmetro}
                  onChange={(event) => {
                    setNumInmetro(event.target.value);
                    setErrors((prev) => {
                      const next = { ...prev };
                      delete next.num_inmetro;
                      return next;
                    });
                  }}
                  autoComplete="off"
                />
              </FormField>

              <FormField id="sub-cilindro" label="Nº do cilindro">
                <input
                  className={fieldControlClass()}
                  value={numCilindro}
                  onChange={(event) => setNumCilindro(event.target.value)}
                  autoComplete="off"
                />
              </FormField>

              <FormField id="sub-manut2" label="Próx. manutenção 2º nível">
                <input type="date" className={fieldControlClass()} value={manut2} onChange={(e) => setManut2(e.target.value)} />
              </FormField>

              <FormField id="sub-manut3" label="Próx. manutenção 3º nível">
                <input type="date" className={fieldControlClass()} value={manut3} onChange={(e) => setManut3(e.target.value)} />
              </FormField>
            </FormSection>
          ) : null}
        </>
      )}

      <input type="hidden" value={extintorId} readOnly />
    </SubstituirShell>
  );
}
