"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  parseSpreadsheet,
  REQUIRED_HEADERS,
  type ExtintorImportRecord,
} from "@/lib/rf01/import-parser";
import { getSupabaseClient } from "@/lib/supabase/client";
import AuthGuard from "@/src/components/AuthGuard";

const ACCEPTED_FILES = ".xlsx,.csv";

type ImportStatus = "idle" | "parsing" | "ready" | "uploading" | "success" | "error";

export default function ImportacaoPage() {
  const [status, setStatus] = useState<ImportStatus>("idle");
  const [rows, setRows] = useState<ExtintorImportRecord[]>([]);
  const [missingHeaders, setMissingHeaders] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  const disabled = status === "parsing" || status === "uploading";

  const previewRows = useMemo(() => rows.slice(0, 8), [rows]);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setStatus("parsing");
    setMissingHeaders([]);
    setRows([]);
    setMessage("");

    try {
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

      setRows(parsed.records);
      setStatus("ready");
      setMessage(`${parsed.records.length} registros prontos para importação.`);
    } catch {
      setStatus("error");
      setMessage("Falha ao processar o arquivo. Verifique o formato e tente novamente.");
    }
  }

  async function handleImport() {
    if (rows.length === 0) return;

    setStatus("uploading");
    setMessage("");

    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("extintores")
      .insert(rows as unknown as Record<string, unknown>[]);

    if (error) {
      setStatus("error");
      setMessage(`Erro ao importar no Supabase: ${error.message}`);
      return;
    }

    setStatus("success");
    setMessage(`${rows.length} registros importados com sucesso.`);
  }

  return (
    <AuthGuard allowedRoles={["admin"]}>
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-6 py-10">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wider text-amber-700">
          RF01 - Importação de Dados
        </p>
        <h1 className="text-3xl font-bold text-zinc-900">Importar planilha de extintores</h1>
        <p className="max-w-3xl text-zinc-600">
          Faça upload de um arquivo <strong>.xlsx</strong> ou <strong>.csv</strong>, valide os
          campos obrigatórios e envie os registros para o Supabase.
        </p>
      </header>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <label htmlFor="spreadsheet" className="mb-3 block text-sm font-medium text-zinc-700">
          Selecione a planilha
        </label>
        <input
          id="spreadsheet"
          name="spreadsheet"
          type="file"
          accept={ACCEPTED_FILES}
          className="block w-full rounded-lg border border-zinc-300 bg-zinc-50 p-2 text-sm"
          onChange={handleFileChange}
          disabled={disabled}
        />

        <div className="mt-4 rounded-lg bg-zinc-50 p-4">
          <p className="text-sm font-semibold text-zinc-800">Campos obrigatórios</p>
          <ul className="mt-2 grid grid-cols-1 gap-1 text-sm text-zinc-600 md:grid-cols-2">
            {REQUIRED_HEADERS.map((header) => (
              <li key={header}>- {header}</li>
            ))}
          </ul>
        </div>

        {missingHeaders.length > 0 && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Colunas ausentes: {missingHeaders.join(", ")}
          </div>
        )}

        {message && (
          <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
            {message}
          </div>
        )}

        <button
          type="button"
          className="mt-4 inline-flex items-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={status !== "ready"}
          onClick={handleImport}
        >
          {status === "uploading" ? "Importando..." : "Importar para Supabase"}
        </button>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Pré-visualização ({rows.length})</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-zinc-600">
                <th className="px-2 py-2">Código</th>
                <th className="px-2 py-2">Setor</th>
                <th className="px-2 py-2">Local Detalhado</th>
                <th className="px-2 py-2">Número Inmetro</th>
                <th className="px-2 py-2">Tipo</th>
                <th className="px-2 py-2">Tamanho</th>
                <th className="px-2 py-2">Capacidade Extintora</th>
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, idx) => (
                <tr key={`${row.codigo}-${idx}`} className="border-b border-zinc-100">
                  <td className="px-2 py-2">{row.codigo}</td>
                  <td className="px-2 py-2">{row.setor}</td>
                  <td className="px-2 py-2">{row.local_detalhado}</td>
                  <td className="px-2 py-2">{row.num_inmetro}</td>
                  <td className="px-2 py-2">{row.tipo}</td>
                  <td className="px-2 py-2">{row.tamanho}</td>
                  <td className="px-2 py-2">{row.capacidade_extintora}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-2 py-6 text-center text-zinc-500">
                    Nenhum dado carregado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

        <footer className="text-sm text-zinc-500">
          <Link href="/admin/dashboard" className="underline">
            Voltar para dashboard
          </Link>
        </footer>
      </main>
    </AuthGuard>
  );
}
