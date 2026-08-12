"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { parseSpreadsheet, downloadExtintorImportTemplate, type ExtintorImportRecord } from "@/lib/rf01/import-parser";
import {
  parseHidranteSpreadsheet,
  type HidranteImportRow,
} from "@/lib/rf01/hidrante-import-parser";
import { importSpreadsheetViaApi } from "@/lib/import/import-api-client";
import { formatSyncResultMessage, type ImportMode } from "@/lib/import/spreadsheet-sync";
import {
  COLUNAS_EXTINTOR,
  COLUNA_TITULO_CLASS_COMPACT,
} from "@/lib/inventario/equipamento-padrao";
import { useOptionalActiveBase } from "@/lib/auth/active-base-context";
import { getCurrentSession, getProfileBySession } from "@/lib/auth/profile";
import AuthGuard from "@/src/components/AuthGuard";
import { PreviewPagination, SegmentedOption } from "@/src/components/importacao/ImportacaoUi";

const ACCEPTED_FILES = ".xlsx,.csv";
const PREVIEW_PAGE_SIZE = 10;

type ImportStatus = "idle" | "parsing" | "ready" | "uploading" | "success" | "error";
type DestinoImport = "extintores" | "hidrantes";

function isDuplicateError(message: string): boolean {
  return /duplicate|unique|already exists|violates unique/i.test(message);
}

function duplicateHintForMode(mode: ImportMode): string {
  if (mode === "cadastro") {
    return "\n\nCódigos já existem na base selecionada. Confira o seletor «Base ativa» no menu ou use «Atualizar em lote».";
  }
  return "\n\nConflito de código na base selecionada. Confira se a «Base ativa» está correta e se a planilha não repete o mesmo código em linhas diferentes.";
}

function isSchemaError(message: string): boolean {
  return (
    /column of ['"]hidrantes['"]/i.test(message) ||
    /schema cache/i.test(message) ||
    /could not find the/i.test(message)
  );
}

export default function ImportacaoPage() {
  const activeBaseCtx = useOptionalActiveBase();
  const [destino, setDestino] = useState<DestinoImport>("extintores");
  const [modo, setModo] = useState<ImportMode>("cadastro");
  const [status, setStatus] = useState<ImportStatus>("idle");
  const [rowsExtintor, setRowsExtintor] = useState<ExtintorImportRecord[]>([]);
  const [rowsHidrante, setRowsHidrante] = useState<HidranteImportRow[]>([]);
  const [missingHeaders, setMissingHeaders] = useState<string[]>([]);
  const [hidranteSkipped, setHidranteSkipped] = useState(0);
  const [message, setMessage] = useState("");
  const [fileName, setFileName] = useState("");
  const [previewPage, setPreviewPage] = useState(1);

  const disabled = status === "parsing" || status === "uploading";
  const readyCount = destino === "extintores" ? rowsExtintor.length : rowsHidrante.length;
  const totalPages = Math.max(1, Math.ceil(readyCount / PREVIEW_PAGE_SIZE));
  const safePage = Math.min(previewPage, totalPages);

  const previewExtintores = useMemo(() => {
    const start = (safePage - 1) * PREVIEW_PAGE_SIZE;
    return rowsExtintor.slice(start, start + PREVIEW_PAGE_SIZE);
  }, [rowsExtintor, safePage]);

  const previewHidrantes = useMemo(() => {
    const start = (safePage - 1) * PREVIEW_PAGE_SIZE;
    return rowsHidrante.slice(start, start + PREVIEW_PAGE_SIZE);
  }, [rowsHidrante, safePage]);

  async function resolveBaseId(): Promise<string | null> {
    if (activeBaseCtx?.activeBaseId) return activeBaseCtx.activeBaseId;
    const session = await getCurrentSession();
    if (!session) return null;
    const profile = await getProfileBySession(session);
    return profile?.base_id ?? null;
  }

  function resetRows() {
    setRowsExtintor([]);
    setRowsHidrante([]);
    setHidranteSkipped(0);
    setPreviewPage(1);
  }

  function clearImportState() {
    setStatus("idle");
    resetRows();
    setMissingHeaders([]);
    setMessage("");
    setFileName("");
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setStatus("parsing");
    setMissingHeaders([]);
    resetRows();
    setMessage("");
    setFileName(file.name);

    try {
      if (destino === "extintores") {
        const parsed = await parseSpreadsheet(file);
        if (parsed.missingHeaders.length > 0) {
          setMissingHeaders(parsed.missingHeaders);
          setStatus("error");
          return;
        }
        if (parsed.records.length === 0) {
          setStatus("error");
          setMessage("A planilha está vazia.");
          return;
        }
        setRowsExtintor(parsed.records);
        setPreviewPage(1);
        setStatus("ready");
        setMessage(
          `${parsed.records.length} extintores prontos para ${modo === "cadastro" ? "cadastro" : "atualização em lote"}.`,
        );
        return;
      }

      const parsed = await parseHidranteSpreadsheet(file);
      if (parsed.missingHeaders.length > 0) {
        setMissingHeaders(parsed.missingHeaders);
        setStatus("error");
        return;
      }
      if (parsed.records.length === 0) {
        setStatus("error");
        setMessage(
          parsed.skippedSemCodigo > 0
            ? `Nenhuma linha com código do local preenchido. (${parsed.skippedSemCodigo} linha(s) ignorada(s).)`
            : "A planilha está vazia.",
        );
        return;
      }
      setRowsHidrante(parsed.records);
      setHidranteSkipped(parsed.skippedSemCodigo);
      setPreviewPage(1);
      setStatus("ready");
      let msg = `${parsed.records.length} hidrantes prontos para ${modo === "cadastro" ? "cadastro" : "atualização em lote"}.`;
      if (parsed.skippedSemCodigo > 0) {
        msg += ` ${parsed.skippedSemCodigo} linha(s) sem código foram ignoradas.`;
      }
      setMessage(msg);
    } catch {
      setStatus("error");
      setMessage("Falha ao processar o arquivo. Verifique o formato e tente novamente.");
    }
  }

  async function handleImport() {
    const baseId = await resolveBaseId();
    if (!baseId) {
      setStatus("error");
      setMessage("Base ativa não definida. Selecione uma base antes de importar.");
      return;
    }

    const session = await getCurrentSession();
    if (!session?.access_token) {
      setStatus("error");
      setMessage("Sessão expirada. Faça login novamente para importar.");
      return;
    }

    if (destino === "extintores") {
      if (rowsExtintor.length === 0) return;
      setStatus("uploading");
      setMessage("");

      const result = await importSpreadsheetViaApi({
        accessToken: session.access_token,
        activeBaseId: baseId,
        destino: "extintores",
        mode: modo,
        rows: rowsExtintor,
      });

      if (result.error) {
        setStatus("error");
        const hint = isDuplicateError(result.error) ? duplicateHintForMode(modo) : "";
        setMessage(`Erro ao importar extintores: ${result.error}${hint}`);
        return;
      }

      setStatus("success");
      setMessage(
        modo === "cadastro"
          ? `${result.inserted} extintores cadastrados com sucesso.`
          : formatSyncResultMessage(result, "extintor"),
      );
      return;
    }

    if (rowsHidrante.length === 0) return;
    setStatus("uploading");
    setMessage("");

    const result = await importSpreadsheetViaApi({
      accessToken: session.access_token,
      activeBaseId: baseId,
      destino: "hidrantes",
      mode: modo,
      rows: rowsHidrante,
    });

    if (result.error) {
      setStatus("error");
      const base = `Erro ao importar hidrantes: ${result.error}`;
      const duplicateHintMsg = isDuplicateError(result.error) ? duplicateHintForMode(modo) : "";
      const schemaHint = isSchemaError(result.error)
        ? "\n\nO banco ainda não tem todas as colunas da planilha. No Supabase → SQL Editor, execute o bloco com comentário \"Colunas da planilha RF01 hidrantes\" no arquivo docs/migration_mapa_recursos.sql (vários ALTER TABLE … ADD COLUMN IF NOT EXISTS)."
        : "";
      setMessage(`${base}${duplicateHintMsg}${schemaHint}`);
      return;
    }

    setStatus("success");
    setMessage(
      modo === "cadastro"
        ? `${result.inserted} hidrantes cadastrados com sucesso.${hidranteSkipped > 0 ? ` (${hidranteSkipped} linha(s) ignoradas por falta de código.)` : ""}`
        : formatSyncResultMessage(result, "hidrante", hidranteSkipped),
    );
  }

  return (
    <AuthGuard allowedRoles={["admin", "admin_corporativo"]}>
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-5 px-6 py-8">
        <header className="page-hero p-6">
          <div className="page-hero-content">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-[var(--neon)]">
              RF01 - Importação de Dados
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white">Importar planilha</h1>
            <p className="mt-2 max-w-3xl text-sm font-medium text-slate-300">
              Baixe o modelo, preencha e envie o arquivo (.xlsx ou .csv). Em{" "}
              <strong>Atualizar em lote</strong>, o código do equipamento é a chave.
            </p>
            {activeBaseCtx?.activeBase && (
              <p className="mt-3 text-sm font-semibold text-[var(--neon)]">
                Base ativa para importação: {activeBaseCtx.activeBase.nome}
              </p>
            )}
          </div>
        </header>

        <section className="section-card p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                Destino
              </p>
              <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                <SegmentedOption
                  value="extintores"
                  current={destino}
                  label="Extintores"
                  onSelect={(value) => {
                    setDestino(value);
                    clearImportState();
                  }}
                />
                <SegmentedOption
                  value="hidrantes"
                  current={destino}
                  label="Hidrantes"
                  onSelect={(value) => {
                    setDestino(value);
                    clearImportState();
                  }}
                />
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                Modo
              </p>
              <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                <SegmentedOption
                  value="cadastro"
                  current={modo}
                  label="Cadastrar novos"
                  onSelect={setModo}
                />
                <SegmentedOption
                  value="atualizacao"
                  current={modo}
                  label="Atualizar em lote"
                  onSelect={setModo}
                />
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                {modo === "cadastro"
                  ? "Insere só registros novos. Falha se o código já existir."
                  : "Atualiza pelo código; códigos novos são cadastrados. Mapa e histórico são preservados."}
              </p>
            </div>
          </div>
        </section>

        <section className="section-card p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
            {destino === "extintores" && (
              <div className="relative flex min-w-[220px] flex-col justify-between overflow-hidden rounded-2xl border-2 border-[var(--neon)] bg-gradient-to-br from-[var(--neon)]/15 via-white to-[var(--orange-soft)] p-4 shadow-[0_0_0_4px_rgb(255_140_0_/0.12)] sm:max-w-[260px]">
                <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-[var(--neon)]/20" />
                <div className="relative">
                  <p className="inline-flex items-center gap-1.5 rounded-full bg-[var(--ink)] px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--neon)]">
                    Passo 1 · Modelo
                  </p>
                  <p className="mt-2 text-base font-extrabold text-[var(--ink)]">Planilha padrão</p>
                  <p className="mt-1 text-xs font-medium leading-relaxed text-slate-600">
                    Baixe o modelo oficial com os cabeçalhos prontos para preencher.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-primary relative mt-4 inline-flex w-full items-center justify-center gap-2 text-sm"
                  onClick={() => downloadExtintorImportTemplate()}
                  disabled={disabled}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M12 3v12m0 0-4-4m4 4 4-4M5 19h14" />
                  </svg>
                  Download do modelo
                </button>
              </div>
            )}

            <div className="flex min-w-0 flex-1 flex-col">
              <p className="mb-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                Arquivo
              </p>
              <label
                htmlFor="spreadsheet"
                className={`group flex flex-1 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center transition hover:border-[var(--neon)] hover:bg-[var(--neon)]/5 ${
                  disabled ? "pointer-events-none opacity-60" : ""
                }`}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (disabled) return;
                  const file = event.dataTransfer.files?.[0];
                  if (!file) return;
                  const input = document.getElementById("spreadsheet") as HTMLInputElement | null;
                  if (!input) return;
                  const transfer = new DataTransfer();
                  transfer.items.add(file);
                  input.files = transfer.files;
                  void handleFileChange({
                    target: input,
                  } as React.ChangeEvent<HTMLInputElement>);
                }}
              >
                <input
                  id="spreadsheet"
                  name="spreadsheet"
                  type="file"
                  accept={ACCEPTED_FILES}
                  className="sr-only"
                  onChange={handleFileChange}
                  disabled={disabled}
                />
                <span className="text-sm font-bold text-slate-800 group-hover:text-[var(--ink)]">
                  {fileName || "Escolher arquivo"}
                </span>
                <span className="mt-1 text-xs text-slate-500">
                  {fileName ? "Clique para trocar · .xlsx ou .csv" : "Arraste ou clique · .xlsx ou .csv"}
                </span>
              </label>
            </div>
          </div>

          {missingHeaders.length > 0 && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Colunas ausentes: {missingHeaders.join(", ")}
            </div>
          )}

          {message && (
            <div className="mt-4 whitespace-pre-line rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {message}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
              disabled={status !== "ready"}
              onClick={() => void handleImport()}
            >
              {status === "uploading"
                ? modo === "atualizacao"
                  ? "Atualizando..."
                  : "Importando..."
                : modo === "atualizacao"
                  ? "Atualizar em lote"
                  : "Cadastrar novos"}
            </button>
            {status === "parsing" && (
              <span className="text-xs font-medium text-slate-500">Lendo planilha…</span>
            )}
          </div>
        </section>

        <section className="section-card p-4 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="text-lg font-black text-[var(--ink)]">Pré-visualização</h2>
            <p className="text-xs font-semibold text-slate-500">
              {readyCount} {readyCount === 1 ? "linha" : "linhas"}
            </p>
          </div>

          <div className="mt-3 overflow-x-auto">
            {destino === "extintores" ? (
              <table className="modern-table min-w-[1100px]">
                <thead>
                  <tr>
                    <th className={COLUNA_TITULO_CLASS_COMPACT}>{COLUNAS_EXTINTOR.codigo}</th>
                    <th className={COLUNA_TITULO_CLASS_COMPACT}>{COLUNAS_EXTINTOR.pavimento}</th>
                    <th className={COLUNA_TITULO_CLASS_COMPACT}>{COLUNAS_EXTINTOR.localDetalhado}</th>
                    <th className={COLUNA_TITULO_CLASS_COMPACT}>{COLUNAS_EXTINTOR.numInmetro}</th>
                    <th className={COLUNA_TITULO_CLASS_COMPACT}>{COLUNAS_EXTINTOR.numCilindro}</th>
                    <th className={COLUNA_TITULO_CLASS_COMPACT}>{COLUNAS_EXTINTOR.tipo}</th>
                    <th className={COLUNA_TITULO_CLASS_COMPACT}>{COLUNAS_EXTINTOR.tamanho}</th>
                    <th className={COLUNA_TITULO_CLASS_COMPACT}>{COLUNAS_EXTINTOR.capacidadeExtintora}</th>
                  </tr>
                </thead>
                <tbody>
                  {previewExtintores.map((row, idx) => (
                    <tr key={`${row.codigo}-${idx}`} className="border-b border-slate-100">
                      <td className="px-2 py-2">{row.codigo}</td>
                      <td className="px-2 py-2">{row.setor}</td>
                      <td className="px-2 py-2">{row.local_detalhado}</td>
                      <td className="px-2 py-2">{row.num_inmetro}</td>
                      <td className="px-2 py-2">{row.num_cilindro || "—"}</td>
                      <td className="px-2 py-2">{row.tipo}</td>
                      <td className="px-2 py-2">{row.tamanho}</td>
                      <td className="px-2 py-2">{row.capacidade_extintora}</td>
                    </tr>
                  ))}
                  {rowsExtintor.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-2 py-6 text-center text-zinc-500">
                        Nenhum dado carregado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              <table className="modern-table min-w-[1100px]">
                <thead>
                  <tr>
                    <th className="px-2 py-2">Cód. local</th>
                    <th className="px-2 py-2">Pavimento</th>
                    <th className="px-2 py-2">Localização</th>
                    <th className="px-2 py-2">Qtd mang.</th>
                    <th className="px-2 py-2">M-1</th>
                    <th className="px-2 py-2">M-2</th>
                    <th className="px-2 py-2">M-3</th>
                    <th className="px-2 py-2">M-4</th>
                    <th className="px-2 py-2">Storz</th>
                    <th className="px-2 py-2">Esguichos</th>
                  </tr>
                </thead>
                <tbody>
                  {previewHidrantes.map((row, idx) => (
                    <tr key={`${row.codigo}-${idx}`} className="border-b border-slate-100">
                      <td className="px-2 py-2">{row.codigo}</td>
                      <td className="px-2 py-2">{row.pavimento ?? "—"}</td>
                      <td className="max-w-[200px] truncate px-2 py-2" title={row.local_detalhado}>
                        {row.local_detalhado || "—"}
                      </td>
                      <td className="px-2 py-2">{row.quantidade_mangueiras ?? "—"}</td>
                      <td className="px-2 py-2">{row.teste_hidrostatico_m1 ?? "—"}</td>
                      <td className="px-2 py-2">{row.teste_hidrostatico_m2 ?? "—"}</td>
                      <td className="px-2 py-2">{row.teste_hidrostatico_m3 ?? "—"}</td>
                      <td className="px-2 py-2">{row.teste_hidrostatico_m4 ?? "—"}</td>
                      <td className="px-2 py-2">{row.quantidade_chaves_storz ?? "—"}</td>
                      <td className="px-2 py-2">{row.quantidade_esguichos ?? "—"}</td>
                    </tr>
                  ))}
                  {rowsHidrante.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-2 py-6 text-center text-zinc-500">
                        Nenhum dado carregado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          <PreviewPagination
            page={safePage}
            totalPages={totalPages}
            totalRows={readyCount}
            pageSize={PREVIEW_PAGE_SIZE}
            onPageChange={setPreviewPage}
          />
        </section>

        <footer className="text-sm text-slate-500">
          <Link href="/admin/dashboard" className="underline">
            Voltar para dashboard
          </Link>
        </footer>
      </main>
    </AuthGuard>
  );
}
