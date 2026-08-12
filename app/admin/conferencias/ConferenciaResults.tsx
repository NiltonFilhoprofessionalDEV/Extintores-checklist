"use client";

import { CHECKLIST_EXPORT_COLUMN_LABELS } from "@/lib/checklist/export-labels";
import {
  HIDRANTE_ACTIVE_ITEM_KEYS,
  HIDRANTE_ITEM_LABELS,
} from "@/lib/checklist/hidrante-types";
import { CHECKLIST_ITEM_KEYS } from "@/lib/checklist/types";
import type { ChecklistQuestion } from "@/lib/checklist/default-questions";
import { parseChecklistValuesFromObservacoes } from "@/lib/checklist/parse-legacy-observacoes";
import type { ConferenciaExportStatus } from "@/lib/export/conferencia-historico";
import type { HidranteVencimentoRow } from "@/lib/hidrantes/vencimento-mangueiras";
import {
  subtituloLocalExtintor,
  subtituloLocalHidrante,
  tituloEquipamento,
  type TipoEquipamento,
} from "@/lib/inventario/equipamento-padrao";

export type ConferenciaItem = {
  id: string;
  tipo: TipoEquipamento;
  data_conferencia: string;
  conferente: string;
  codigo: string;
  setor: string;
  local_detalhado: string;
  tipoEquip?: string;
  tamanho?: string;
  numInmetro?: string;
  capacidadeExtintora?: string;
  pavimento?: string;
  manutencao_2_nivel: string | null;
  manutencao_3_nivel: string | null;
  hidrante: HidranteVencimentoRow | null;
  checklistRaw: Record<string, unknown>;
  exportStatus: ConferenciaExportStatus;
  observacaoExibicao: string;
};

const STATUS_META: Record<
  ConferenciaExportStatus,
  { label: string; badge: string; accent: string }
> = {
  conforme: {
    label: "Conforme",
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    accent: "bg-emerald-500",
  },
  alerta: {
    label: "Não conforme",
    badge: "bg-amber-50 text-amber-800 ring-amber-200",
    accent: "bg-amber-500",
  },
  vencido: {
    label: "Vencido",
    badge: "bg-rose-50 text-rose-700 ring-rose-200",
    accent: "bg-rose-500",
  },
};

function formatDateTime(value: string): string {
  if (!value) return "Data não informada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data não informada";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "Não informado";
  const [year, month, day] = value.slice(0, 10).split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function formatKey(key: string): string {
  return key
    .replace(/^custom_/, "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function answerLabel(value: unknown): { text: string; className: string } {
  if (value === "conforme") return { text: "Conforme", className: "bg-emerald-50 text-emerald-700" };
  if (value === "nao_conforme") return { text: "Não conforme", className: "bg-rose-50 text-rose-700" };
  if (value === "nao_aplica") return { text: "Não se aplica", className: "bg-slate-100 text-slate-600" };
  return { text: "Não informado", className: "bg-slate-100 text-slate-500" };
}

const EXTINTOR_SHORT_LABELS: Record<string, string> = {
  ...CHECKLIST_EXPORT_COLUMN_LABELS,
};

const HIDRANTE_SHORT_LABELS: Record<string, string> = {
  identificacao_sinalizacao: "Identificação e sinalização",
  documentacao_acesso: "Validade dos testes hidrostáticos",
  mangueira_esguicho: "Mangueiras e acessórios",
  acesso_desobstruido: "Acesso desobstruído",
  gabinete_caixa: "Abrigo / gabinete",
  valvulas_registros: "Válvulas e registros",
  pressao_abastecimento: "Pressão e abastecimento",
  hidrante_integridade: "Integridade do hidrante",
};

function configuredLabel(question: ChecklistQuestion, kind: TipoEquipamento): string {
  const known =
    kind === "extintor"
      ? EXTINTOR_SHORT_LABELS[question.item_key]
      : HIDRANTE_SHORT_LABELS[question.item_key];
  if (known) return known;
  const label = question.label.replace(/\?+$/, "").trim();
  return label.length > 64 ? `${label.slice(0, 61).trimEnd()}…` : label;
}

function parseAnswersJson(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value !== "string") return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function getAnswerRows(item: ConferenciaItem, questions: ChecklistQuestion[]) {
  const raw = item.checklistRaw;
  const extras = parseAnswersJson(raw.answers_json);
  const legacy =
    item.tipo === "extintor"
      ? parseChecklistValuesFromObservacoes(String(raw.observacoes ?? ""))
      : {};
  const fallbackQuestions = (
    item.tipo === "extintor" ? CHECKLIST_ITEM_KEYS : HIDRANTE_ACTIVE_ITEM_KEYS
  ).map((key, index) => ({
    item_key: key,
    label:
      item.tipo === "extintor"
        ? CHECKLIST_EXPORT_COLUMN_LABELS[key as keyof typeof CHECKLIST_EXPORT_COLUMN_LABELS]
        : HIDRANTE_ITEM_LABELS[key as keyof typeof HIDRANTE_ITEM_LABELS],
    active: true,
    sort_order: index,
  }));
  const visibleQuestions = questions.length > 0 ? questions : fallbackQuestions;

  return visibleQuestions.map((question) => {
    const key = question.item_key;
    let value = extras[key] ?? raw[key] ?? legacy[key as keyof typeof legacy];
    if (value == null && item.exportStatus === "conforme") value = "conforme";
    return {
      key,
      label: configuredLabel(question, item.tipo) || formatKey(key),
      ...answerLabel(value),
    };
  });
}

function localDescription(item: ConferenciaItem): string {
  return item.tipo === "extintor"
    ? subtituloLocalExtintor(item.setor, item.local_detalhado)
    : subtituloLocalHidrante(item.pavimento ?? null, item.local_detalhado);
}

export function ConferenciaCard({
  item,
  teamLabel,
  onOpen,
}: {
  item: ConferenciaItem;
  teamLabel: string;
  onOpen: () => void;
}) {
  const status = STATUS_META[item.exportStatus];

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative w-full overflow-hidden rounded-[1.25rem] border border-[var(--border)] bg-white p-5 text-left shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[var(--shadow-lift)] focus:outline-none focus:ring-2 focus:ring-[var(--orange)]/25"
      aria-haspopup="dialog"
    >
      <span className={`absolute inset-y-4 left-0 w-1 rounded-r-full ${status.accent}`} />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-extrabold text-[var(--ink)]">
              {tituloEquipamento(item.codigo, item.tipo)}
            </h3>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${status.badge}`}>
              {status.label}
            </span>
          </div>
          <p className="mt-1 truncate text-sm text-[var(--muted-foreground)]">{localDescription(item)}</p>
        </div>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--muted)] text-slate-500 transition group-hover:bg-[var(--orange-soft)] group-hover:text-[var(--orange-deep)]">
          →
        </span>
      </div>

      <div className="mt-5 grid gap-3 border-t border-[var(--border)] pt-4 sm:grid-cols-3">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Realizada em</p>
          <p className="mt-1 text-xs font-bold text-slate-700">{formatDateTime(item.data_conferencia)}</p>
        </div>
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Conferente</p>
          <p className="mt-1 truncate text-xs font-bold text-slate-700">{item.conferente || "Não informado"}</p>
        </div>
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Equipe</p>
          <p className="mt-1 text-xs font-bold text-slate-700">{teamLabel || "Não definida"}</p>
        </div>
      </div>
    </button>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#fafafa] px-3 py-2.5">
      <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-700">{value || "Não informado"}</p>
    </div>
  );
}

export function ConferenciaDetailModal({
  item,
  teamLabel,
  questions,
  onClose,
}: {
  item: ConferenciaItem;
  teamLabel: string;
  questions: ChecklistQuestion[];
  onClose: () => void;
}) {
  const status = STATUS_META[item.exportStatus];
  const answers = getAnswerRows(item, questions);

  return (
    <div
      className="modal-layer fixed inset-0 flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="inspection-detail-title"
      onClick={onClose}
    >
      <article
        className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[1.75rem] bg-white shadow-2xl sm:rounded-[1.75rem]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-5 sm:px-6">
          <div>
            <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${status.badge}`}>
              {status.label}
            </span>
            <h2 id="inspection-detail-title" className="mt-2 text-2xl font-extrabold text-[var(--ink)]">
              {tituloEquipamento(item.codigo, item.tipo)}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">{localDescription(item)}</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-[var(--muted)] text-xl text-slate-600" aria-label="Fechar detalhes">×</button>
        </header>

        <div className="overflow-y-auto px-5 py-5 sm:px-6">
          <section>
            <p className="page-eyebrow">Dados da inspeção</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <DetailField label="Data e hora" value={formatDateTime(item.data_conferencia)} />
              <DetailField label="Conferente" value={item.conferente || "Não informado"} />
              <DetailField label="Equipe" value={teamLabel || "Não definida"} />
            </div>
          </section>

          <section className="mt-6">
            <p className="page-eyebrow">Equipamento</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {item.tipo === "extintor" ? (
                <>
                  <DetailField label="Código" value={item.codigo} />
                  <DetailField label="Setor" value={item.setor} />
                  <DetailField label="Local detalhado" value={item.local_detalhado} />
                  <DetailField label="Pavimento" value={item.pavimento ?? "Não informado"} />
                  <DetailField label="Nº do INMETRO" value={item.numInmetro ?? "Não informado"} />
                  <DetailField label="Tipo / tamanho" value={[item.tipoEquip, item.tamanho].filter(Boolean).join(" · ")} />
                  <DetailField label="Capacidade extintora" value={item.capacidadeExtintora ?? "Não informado"} />
                  <DetailField label="Manutenção 2º nível" value={formatDate(item.manutencao_2_nivel)} />
                  <DetailField label="Manutenção 3º nível" value={formatDate(item.manutencao_3_nivel)} />
                </>
              ) : (
                <>
                  <DetailField label="Código" value={item.codigo} />
                  <DetailField label="Pavimento" value={item.pavimento ?? "Não informado"} />
                  <DetailField label="Local detalhado" value={item.local_detalhado} />
                  <DetailField label="Mangueiras" value={String(item.hidrante?.quantidade_mangueiras ?? "Não informado")} />
                  <DetailField label="Chaves Storz" value={String(item.hidrante?.quantidade_chaves_storz ?? "Não informado")} />
                  <DetailField label="Esguichos" value={String(item.hidrante?.quantidade_esguichos ?? "Não informado")} />
                  <DetailField label="Teste hidrostático M-1" value={formatDate(item.hidrante?.teste_hidrostatico_m1)} />
                  <DetailField label="Teste hidrostático M-2" value={formatDate(item.hidrante?.teste_hidrostatico_m2)} />
                  <DetailField label="Teste hidrostático M-3" value={formatDate(item.hidrante?.teste_hidrostatico_m3)} />
                  <DetailField label="Teste hidrostático M-4" value={formatDate(item.hidrante?.teste_hidrostatico_m4)} />
                </>
              )}
            </div>
          </section>

          <section className="mt-6">
            <p className="page-eyebrow">Respostas do checklist</p>
            <div className="mt-3 divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)]">
              {answers.map((answer) => (
                <div key={answer.key} className="flex items-center justify-between gap-4 bg-white px-4 py-3">
                  <p className="text-sm font-semibold leading-snug text-slate-700">{answer.label}</p>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${answer.className}`}>
                    {answer.text}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-6">
            <p className="page-eyebrow">Observações e apontamentos</p>
            <p className="mt-3 whitespace-pre-line rounded-2xl bg-[var(--muted)] p-4 text-sm leading-relaxed text-slate-700">
              {item.observacaoExibicao || "Nenhuma observação registrada."}
            </p>
          </section>
        </div>

        <footer className="border-t border-[var(--border)] p-4">
          <button type="button" className="btn-primary w-full" onClick={onClose}>Fechar</button>
        </footer>
      </article>
    </div>
  );
}
