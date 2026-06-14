import { CHECKLIST_EXPORT_COLUMN_LABELS } from "@/lib/checklist/export-labels";
import {
  HIDRANTE_ITEM_KEYS,
  HIDRANTE_ITEM_LABELS,
  type HidranteItemKey,
} from "@/lib/checklist/hidrante-types";
import {
  LEGACY_PREFIXES,
  parseChecklistValuesFromObservacoes,
} from "@/lib/checklist/parse-legacy-observacoes";
import { CHECKLIST_ITEM_KEYS, type ChecklistItemKey } from "@/lib/checklist/types";

export type BlocoNaoConformidade = {
  titulo: string;
  descricao: string;
};

/** Blocos `[Não conforme — …]` gravados em `observacoes` no envio do formulário. */
export function extrairBlocosNaoConformidadeObservacoes(
  observacoes: string | null | undefined,
): BlocoNaoConformidade[] {
  if (!observacoes?.trim()) return [];

  const blocos: BlocoNaoConformidade[] = [];
  const regex = /\[Não conforme — ([^\]]+)\]\s*([\s\S]*?)(?=\n\n---\n\n|\[Não conforme —|$)/g;

  for (const match of observacoes.matchAll(regex)) {
    const titulo = match[1]?.trim() ?? "";
    const descricao = match[2]?.trim() ?? "";
    if (titulo) blocos.push({ titulo, descricao });
  }

  return blocos;
}

const ROTULOS_NC_EXTINTOR: Record<ChecklistItemKey, string[]> = {
  local_correto: ["Localização", CHECKLIST_EXPORT_COLUMN_LABELS.local_correto],
  dados_corretos: ["Identificação e Rotulagem", CHECKLIST_EXPORT_COLUMN_LABELS.dados_corretos],
  sinalizacao_correta: ["Sinalização", CHECKLIST_EXPORT_COLUMN_LABELS.sinalizacao_correta],
  mangueira_status: ["Mangueira", CHECKLIST_EXPORT_COLUMN_LABELS.mangueira_status],
  bico_difusor_status: ["Bico/Difusor", CHECKLIST_EXPORT_COLUMN_LABELS.bico_difusor_status],
  alca_gatilho_status: ["Componentes de Acionamento", CHECKLIST_EXPORT_COLUMN_LABELS.alca_gatilho_status],
  medidor_pressao_status: ["Indicador de Pressão", CHECKLIST_EXPORT_COLUMN_LABELS.medidor_pressao_status],
  cilindro_status: ["Cilindro", CHECKLIST_EXPORT_COLUMN_LABELS.cilindro_status],
};

function expandirPartesTexto(texto: string): string[] {
  const fila = [texto.trim()];
  const saida: string[] = [];

  while (fila.length > 0) {
    const atual = fila.pop()?.trim() ?? "";
    if (!atual) continue;

    if (atual.includes("|") || atual.includes("｜")) {
      for (const pedaco of atual.split(/\s*[|｜]\s*/)) {
        const p = pedaco.trim();
        if (p) fila.push(p);
      }
      continue;
    }

    if (atual.includes("\n\n---\n\n")) {
      for (const pedaco of atual.split(/\n\n---\n\n/)) {
        const p = pedaco.trim();
        if (p) fila.push(p);
      }
      continue;
    }

    saida.push(atual);
  }

  return saida;
}

function partesObservacao(observacoes: string): string[] {
  const semBlocos = observacoes
    .replace(/\[Não conforme —[\s\S]*?(?=\n\n---\n\n|\[Não conforme —|$)/g, "")
    .replace(/Itens com não conformidade:[\s\S]*/gi, "")
    .trim();

  if (!semBlocos) return [];
  return expandirPartesTexto(semBlocos);
}

/** Mantém só o que o conferente digitou, sem eco legado embutido no mesmo trecho. */
function extrairSomenteTextoUsuario(texto: string): string {
  let t = texto.trim();
  if (!t) return "";

  t = t.replace(/^O que o conferente informou:\s*/i, "").trim();
  t = t.replace(/^Descrição informada:\s*/i, "").trim();

  const partes = expandirPartesTexto(t);
  const livres = partes
    .map((p) => p.replace(/^O que o conferente informou:\s*/i, "").trim())
    .filter((p) => p.length > 0 && !segmentoEhEcoLegado(p));

  return livres.join(" ").trim();
}

const STATUS_AUTOMATICOS =
  /^(conforme|nao_conforme|nao_aplica|nao conforme|não conforme|não se aplica)$/i;

/** Trecho automático do checklist (eco legado, status ou resumo sem texto do conferente). */
function segmentoEhEcoLegado(segmento: string): boolean {
  const t = segmento.trim();
  if (!t) return true;
  if (t.startsWith("[Não conforme")) return true;

  for (const { prefixes } of LEGACY_PREFIXES) {
    for (const prefix of prefixes) {
      if (!t.includes(prefix)) continue;
      const valor = t.slice(t.indexOf(prefix) + prefix.length).trim().toLowerCase();
      if (STATUS_AUTOMATICOS.test(valor)) return true;
    }
  }

  if (/^[^:]+:\s*(conforme|nao_conforme|nao_aplica)\s*$/i.test(t)) return true;
  if (/^[^:]+:\s*não\s*conforme\s*\.?\s*$/i.test(t)) return true;
  if (/^[^:]+:\s*nao\s*conforme\s*\.?\s*$/i.test(t)) return true;
  if (/:\s*conforme\b/i.test(t) && LEGACY_PREFIXES.some(({ prefixes }) => prefixes.some((p) => t.includes(p)))) {
    return true;
  }
  if (/:\s*nao_aplica\b/i.test(t) && LEGACY_PREFIXES.some(({ prefixes }) => prefixes.some((p) => t.includes(p)))) {
    return true;
  }

  const subpartes = expandirPartesTexto(t);
  if (subpartes.length > 1 && subpartes.every((p) => segmentoEhEcoLegado(p))) return true;

  return false;
}

function extrairDescricaoInformada(segmento: string): string {
  const match = segmento.match(/Descrição informada:\s*(.+)/i);
  return match?.[1]?.replace(/\*\*/g, "").trim() ?? "";
}

function ncKeysExtintor(
  row: Partial<Record<ChecklistItemKey, string | null>>,
  observacoes: string | null | undefined,
): ChecklistItemKey[] {
  const parsed = parseChecklistValuesFromObservacoes(observacoes);
  return CHECKLIST_ITEM_KEYS.filter(
    (k) => row[k] === "nao_conforme" || parsed[k] === "nao_conforme",
  );
}

function ncKeysHidrante(
  row: Partial<Record<HidranteItemKey, string | null>>,
): HidranteItemKey[] {
  return HIDRANTE_ITEM_KEYS.filter((k) => row[k] === "nao_conforme");
}

function partesComDetalhesLegados(observacoes: string | null | undefined): {
  comentariosLivres: string[];
  detalhesLegado: string[];
} {
  if (!observacoes?.trim()) return { comentariosLivres: [], detalhesLegado: [] };

  const detalhesLegado: string[] = [];
  const comentariosLivres: string[] = [];

  for (const parte of partesObservacao(observacoes)) {
    const descricaoInformada = extrairDescricaoInformada(parte);
    if (descricaoInformada) {
      detalhesLegado.push(descricaoInformada);
      continue;
    }
    if (segmentoEhEcoLegado(parte)) continue;

    const textoUsuario = extrairSomenteTextoUsuario(parte);
    if (textoUsuario) comentariosLivres.push(textoUsuario);
  }

  return { comentariosLivres, detalhesLegado };
}

function blocoCorrespondeItemExtintor(bloco: BlocoNaoConformidade, key: ChecklistItemKey): boolean {
  const titulo = bloco.titulo.toLowerCase();
  return ROTULOS_NC_EXTINTOR[key].some((alias) => {
    const a = alias.toLowerCase();
    return titulo.includes(a) || a.includes(titulo);
  });
}

function blocoCorrespondeItemHidrante(bloco: BlocoNaoConformidade, key: HidranteItemKey): boolean {
  const label = HIDRANTE_ITEM_LABELS[key].toLowerCase();
  const titulo = bloco.titulo.toLowerCase();
  return titulo.includes(label.slice(0, 48)) || label.includes(titulo);
}

function consumirBloco(
  blocos: BlocoNaoConformidade[],
  usados: Set<number>,
  matcher: (b: BlocoNaoConformidade) => boolean,
): string {
  for (let i = 0; i < blocos.length; i++) {
    if (usados.has(i)) continue;
    if (!matcher(blocos[i])) continue;
    usados.add(i);
    return blocos[i].descricao;
  }
  return "";
}

/** Texto digitado pelo conferente fora dos ecos automáticos do checklist. */
export function extrairComentariosLivresConferente(observacoes: string | null | undefined): string[] {
  return partesComDetalhesLegados(observacoes).comentariosLivres;
}

function tituloCurtoHidrante(key: HidranteItemKey): string {
  const label = HIDRANTE_ITEM_LABELS[key];
  const antesPergunta = label.split("?")[0]?.trim();
  if (!antesPergunta) return label;
  return antesPergunta.length > 72 ? `${antesPergunta.slice(0, 72)}…` : antesPergunta;
}

/**
 * Um único texto de observações: só não conformidades (+ descrição) e comentários livres, em linguagem simples.
 */
export function formatarObservacaoConferenciaExtintor(
  row: Partial<Record<ChecklistItemKey, string | null>>,
  observacoes: string | null,
): string {
  const blocos = extrairBlocosNaoConformidadeObservacoes(observacoes);
  const usados = new Set<number>();
  const { comentariosLivres, detalhesLegado } = partesComDetalhesLegados(observacoes);
  const comentariosRestantes = [...comentariosLivres];
  const filaDetalhesLegado = [...detalhesLegado];

  const ncKeys = ncKeysExtintor(row, observacoes);
  const linhas: string[] = [];

  if (ncKeys.length > 0) {
    ncKeys.forEach((key, index) => {
      let detalhe = extrairSomenteTextoUsuario(
        consumirBloco(blocos, usados, (b) => blocoCorrespondeItemExtintor(b, key)),
      );

      if (!detalhe && filaDetalhesLegado.length > 0) {
        detalhe = extrairSomenteTextoUsuario(filaDetalhesLegado.shift() ?? "");
      }

      if (!detalhe && comentariosRestantes.length === 1 && ncKeys.length === 1) {
        detalhe = extrairSomenteTextoUsuario(comentariosRestantes[0] ?? "");
        comentariosRestantes.length = 0;
      } else if (!detalhe && index === 0 && comentariosRestantes.length > 0 && ncKeys.length === 1) {
        detalhe = extrairSomenteTextoUsuario(comentariosRestantes.shift() ?? "");
      }

      const rotulo = CHECKLIST_EXPORT_COLUMN_LABELS[key];
      if (detalhe) linhas.push(`• ${detalhe}`);
      else linhas.push(`• ${rotulo}`);
      if (index < ncKeys.length - 1) linhas.push("");
    });
  }

  for (let i = 0; i < blocos.length; i++) {
    if (usados.has(i)) continue;
    const detalhe = extrairSomenteTextoUsuario(blocos[i].descricao);
    if (detalhe) linhas.push(`• ${detalhe}`);
    else linhas.push(`• ${blocos[i].titulo}`);
    usados.add(i);
  }

  const comentariosFinais = comentariosRestantes
    .map((c) => extrairSomenteTextoUsuario(c))
    .filter(Boolean);

  if (comentariosFinais.length > 0) {
    if (linhas.length > 0) linhas.push("");
    comentariosFinais.forEach((c) => linhas.push(`• ${c}`));
  }

  return linhas.join("\n");
}

export function formatarObservacaoConferenciaHidrante(
  row: Partial<Record<HidranteItemKey, string | null>>,
  observacoes: string | null,
): string {
  const blocos = extrairBlocosNaoConformidadeObservacoes(observacoes);
  const usados = new Set<number>();
  const { comentariosLivres, detalhesLegado } = partesComDetalhesLegados(observacoes);
  const comentariosRestantes = [...comentariosLivres];
  const filaDetalhesLegado = [...detalhesLegado];

  const ncKeys = ncKeysHidrante(row);
  const linhas: string[] = [];

  if (ncKeys.length > 0) {
    ncKeys.forEach((key, index) => {
      let detalhe = extrairSomenteTextoUsuario(
        consumirBloco(blocos, usados, (b) => blocoCorrespondeItemHidrante(b, key)),
      );

      if (!detalhe && filaDetalhesLegado.length > 0) {
        detalhe = extrairSomenteTextoUsuario(filaDetalhesLegado.shift() ?? "");
      }

      if (!detalhe && comentariosRestantes.length === 1 && ncKeys.length === 1) {
        detalhe = extrairSomenteTextoUsuario(comentariosRestantes[0] ?? "");
        comentariosRestantes.length = 0;
      } else if (!detalhe && index === 0 && comentariosRestantes.length > 0 && ncKeys.length === 1) {
        detalhe = extrairSomenteTextoUsuario(comentariosRestantes.shift() ?? "");
      }

      const rotulo = tituloCurtoHidrante(key);
      if (detalhe) linhas.push(`• ${detalhe}`);
      else linhas.push(`• ${rotulo}`);
      if (index < ncKeys.length - 1) linhas.push("");
    });
  }

  for (let i = 0; i < blocos.length; i++) {
    if (usados.has(i)) continue;
    const detalhe = extrairSomenteTextoUsuario(blocos[i].descricao);
    if (detalhe) linhas.push(`• ${detalhe}`);
    else linhas.push(`• ${blocos[i].titulo}`);
    usados.add(i);
  }

  const comentariosFinais = comentariosRestantes
    .map((c) => extrairSomenteTextoUsuario(c))
    .filter(Boolean);

  if (comentariosFinais.length > 0) {
    if (linhas.length > 0) linhas.push("");
    comentariosFinais.forEach((c) => linhas.push(`• ${c}`));
  }

  return linhas.join("\n");
}

/** Compatível com exportação de status (sem eco legado). */
export function montarObservacaoExtintorConferencia(
  row: Partial<Record<ChecklistItemKey, string | null>>,
  observacoes: string | null,
): string {
  return formatarObservacaoConferenciaExtintor(row, observacoes);
}

export function montarObservacaoHidranteConferencia(
  row: Partial<Record<HidranteItemKey, string | null>>,
  observacoes: string | null,
): string {
  return formatarObservacaoConferenciaHidrante(row, observacoes);
}
