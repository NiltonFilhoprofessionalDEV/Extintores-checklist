"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { parseSpreadsheet, REQUIRED_HEADERS, type ExtintorImportRecord } from "@/lib/rf01/import-parser";
import {
  parseHidranteSpreadsheet,
  HIDRANTE_REQUIRED_HEADERS,
  type HidranteImportRow,
} from "@/lib/rf01/hidrante-import-parser";
import { getSupabaseClient } from "@/lib/supabase/client";
import AuthGuard from "@/src/components/AuthGuard";

const ACCEPTED_FILES = ".xlsx,.csv";

type ImportStatus = "idle" | "parsing" | "ready" | "uploading" | "success" | "error";

type DestinoImport = "extintores" | "hidrantes";

export default function ImportacaoPage() {
  const [destino, setDestino] = useState<DestinoImport>("extintores");
  const [status, setStatus] = useState<ImportStatus>("idle");
  const [rowsExtintor, setRowsExtintor] = useState<ExtintorImportRecord[]>([]);
  const [rowsHidrante, setRowsHidrante] = useState<HidranteImportRow[]>([]);
  const [missingHeaders, setMissingHeaders] = useState<string[]>([]);
  const [hidranteSkipped, setHidranteSkipped] = useState(0);
  const [message, setMessage] = useState("");

  const disabled = status === "parsing" || status === "uploading";

  const previewExtintores = useMemo(() => rowsExtintor.slice(0, 8), [rowsExtintor]);
  const previewHidrantes = useMemo(() => rowsHidrante.slice(0, 8), [rowsHidrante]);

  function resetRows() {
    setRowsExtintor([]);
    setRowsHidrante([]);
    setHidranteSkipped(0);
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setStatus("parsing");
    setMissingHeaders([]);
    resetRows();
    setMessage("");

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
        setStatus("ready");
        setMessage(`${parsed.records.length} registros prontos para importação (extintores).`);
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
      setStatus("ready");
      let msg = `${parsed.records.length} hidrantes prontos para importação.`;
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
    if (destino === "extintores") {
      if (rowsExtintor.length === 0) return;
      setStatus("uploading");
      setMessage("");

      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from("extintores")
        .insert(rowsExtintor as unknown as Record<string, unknown>[]);

      if (error) {
        setStatus("error");
        setMessage(`Erro ao importar no Supabase: ${error.message}`);
        return;
      }

      setStatus("success");
      setMessage(`${rowsExtintor.length} extintores importados com sucesso.`);
      return;
    }

    if (rowsHidrante.length === 0) return;
    setStatus("uploading");
    setMessage("");

    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("hidrantes")
      .insert(rowsHidrante as unknown as Record<string, unknown>[]);

    if (error) {
      setStatus("error");
      const base = `Erro ao importar hidrantes: ${error.message}`;
      const schemaHint =
        /column of ['"]hidrantes['"]/i.test(error.message) ||
        /schema cache/i.test(error.message) ||
        /could not find the/i.test(error.message);
      setMessage(
        schemaHint
          ? `${base}\n\nO banco ainda não tem todas as colunas da planilha. No Supabase → SQL Editor, execute o bloco com comentário "Colunas da planilha RF01 hidrantes" no arquivo docs/migration_mapa_recursos.sql (vários ALTER TABLE … ADD COLUMN IF NOT EXISTS).`
          : base,
      );
      return;
    }

    setStatus("success");
    let msg = `${rowsHidrante.length} hidrantes importados com sucesso.`;
    if (hidranteSkipped > 0) msg += ` (${hidranteSkipped} linha(s) tinham sido ignoradas na validação por falta de código.)`;
    setMessage(msg);
  }

  const readyCount = destino === "extintores" ? rowsExtintor.length : rowsHidrante.length;

  return (
    <AuthGuard allowedRoles={["admin"]}>
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-6 py-10">
        <header className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wider text-amber-700">RF01 - Importação de Dados</p>
          <h1 className="text-3xl font-bold text-slate-900">Importar planilha</h1>
          <p className="max-w-3xl text-slate-600">
            <strong>Extintores:</strong> modelo RF01 com colunas de extintores.{" "}
            <strong>Hidrantes:</strong> planilha própria com os cabeçalhos padronizados listados abaixo (.xlsx ou .csv).
          </p>
        </header>

        <section className="surface-card p-6">
          <p className="mb-2 text-sm font-semibold text-slate-800">Destino da importação</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                destino === "extintores" ? "brand-gradient text-white" : "border border-slate-200 bg-slate-50 text-slate-700"
              }`}
              onClick={() => {
                setDestino("extintores");
                setStatus("idle");
                resetRows();
                setMissingHeaders([]);
                setMessage("");
              }}
            >
              Extintores
            </button>
            <button
              type="button"
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                destino === "hidrantes" ? "brand-gradient text-white" : "border border-slate-200 bg-slate-50 text-slate-700"
              }`}
              onClick={() => {
                setDestino("hidrantes");
                setStatus("idle");
                resetRows();
                setMissingHeaders([]);
                setMessage("");
              }}
            >
              Hidrantes
            </button>
          </div>
        </section>

        <section className="surface-card p-6">
          <label htmlFor="spreadsheet" className="mb-3 block text-sm font-medium text-slate-700">
            Selecione a planilha
          </label>
          <input
            id="spreadsheet"
            name="spreadsheet"
            type="file"
            accept={ACCEPTED_FILES}
            className="block w-full rounded-lg border border-slate-300 bg-slate-50 p-2 text-sm text-slate-700"
            onChange={handleFileChange}
            disabled={disabled}
          />

          <div className="mt-4 rounded-lg bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-800">Campos obrigatórios (cabeçalhos)</p>
            <ul className="mt-2 grid grid-cols-1 gap-1 text-sm text-slate-600 md:grid-cols-2">
              {(destino === "extintores"
                ? REQUIRED_HEADERS
                : [...HIDRANTE_REQUIRED_HEADERS]
              ).map((header) => (
                <li key={header}>- {header}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-slate-500">
              Coluna Pavimento: o cabeçalho Setor em planilhas antigas continua sendo aceito.
            </p>
            {destino === "hidrantes" && (
              <p className="mt-3 text-xs text-slate-500">
                Datas podem vir como célula de data do Excel ou texto. Quantidades como número ou texto com dígitos.
                Traço no cabeçalho das datas de teste hidrostático pode ser hífen (-) ou travessão (–).
                Também aceitamos os cabeçalhos curtos do export do Google Forms (ex.: CÓDIGO, PAVIMENTO, LOCAL DETALHADO, datas M-1 a M-4, QUANTIDADE DE ESGUICHO). Colunas extras (Carimbo de data/hora, Observação) são ignoradas.
              </p>
            )}
          </div>

          {missingHeaders.length > 0 && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              Colunas ausentes: {missingHeaders.join(", ")}
            </div>
          )}

          {message && (
            <div className="mt-4 whitespace-pre-line rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              {message}
            </div>
          )}

          <button
            type="button"
            className="brand-gradient mt-4 inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={status !== "ready"}
            onClick={() => void handleImport()}
          >
            {status === "uploading" ? "Importando..." : "Importar para Supabase"}
          </button>
        </section>

        <section className="surface-card p-6">
          <h2 className="text-lg font-semibold text-slate-900">Pré-visualização ({readyCount})</h2>
          <div className="mt-4 overflow-x-auto">
            {destino === "extintores" ? (
              <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600">
                    <th className="px-2 py-2">Código</th>
                    <th className="px-2 py-2">Pavimento</th>
                    <th className="px-2 py-2">Local Detalhado</th>
                    <th className="px-2 py-2">Número Inmetro</th>
                    <th className="px-2 py-2">Tipo</th>
                    <th className="px-2 py-2">Tamanho</th>
                    <th className="px-2 py-2">Capacidade Extintora</th>
                  </tr>
                </thead>
                <tbody>
                  {previewExtintores.map((row, idx) => (
                    <tr key={`${row.codigo}-${idx}`} className="border-b border-slate-100">
                      <td className="px-2 py-2">{row.codigo}</td>
                      <td className="px-2 py-2">{row.setor}</td>
                      <td className="px-2 py-2">{row.local_detalhado}</td>
                      <td className="px-2 py-2">{row.num_inmetro}</td>
                      <td className="px-2 py-2">{row.tipo}</td>
                      <td className="px-2 py-2">{row.tamanho}</td>
                      <td className="px-2 py-2">{row.capacidade_extintora}</td>
                    </tr>
                  ))}
                  {rowsExtintor.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-2 py-6 text-center text-zinc-500">
                        Nenhum dado carregado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600">
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
