import {
  dataVencimentoTeste,
  diasParaVencimentoTeste,
  isTesteHidrostaticoVencido,
} from "@/lib/checklist/types";
import { formatDateOnlyPt } from "@/lib/date/date-only";

export type HidranteVencimentoRow = {
  id: string;
  codigo: string;
  pavimento: string | null;
  local_detalhado: string;
  quantidade_mangueiras: number | null;
  teste_hidrostatico_m1: string | null;
  teste_hidrostatico_m2: string | null;
  teste_hidrostatico_m3: string | null;
  teste_hidrostatico_m4: string | null;
  coord_x: number | null;
  coord_y: number | null;
};

export type MangueiraSlot = {
  numero: number;
  ultimaRealizacao: string | null;
};

export type HidranteVencimentoStats = {
  total: number;
  vencidos: number;
  alerta30: number;
  alerta60: number;
  semPosicao: number;
};

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** Mangueiras cadastradas no hidrante (M-1 … M-n, máx. 4). */
export function listarMangueirasAtivas(h: HidranteVencimentoRow): MangueiraSlot[] {
  const qty = h.quantidade_mangueiras ?? 4;
  const n = Math.min(4, Math.max(1, qty));
  const tests: MangueiraSlot[] = [
    { numero: 1, ultimaRealizacao: h.teste_hidrostatico_m1 },
    { numero: 2, ultimaRealizacao: h.teste_hidrostatico_m2 },
    { numero: 3, ultimaRealizacao: h.teste_hidrostatico_m3 },
    { numero: 4, ultimaRealizacao: h.teste_hidrostatico_m4 },
  ];
  return tests.slice(0, n);
}

/** Pelo menos uma mangueira com teste hidrostático vencido (última realização + 1 ano). */
export function hidranteTemMangueiraVencida(h: HidranteVencimentoRow): boolean {
  return listarMangueirasAtivas(h).some((m) => isTesteHidrostaticoVencido(m.ultimaRealizacao));
}

/** Menor data de vencimento entre mangueiras com última realização registrada. */
export function earliestVencimentoMangueira(h: HidranteVencimentoRow): Date | null {
  let earliest: Date | null = null;
  for (const m of listarMangueirasAtivas(h)) {
    const venc = dataVencimentoTeste(m.ultimaRealizacao);
    if (!venc) continue;
    if (!earliest || venc.getTime() < earliest.getTime()) earliest = venc;
  }
  return earliest;
}

/** Menor quantidade de dias até o vencimento (a mangueira mais crítica). */
export function diasRestantesMangueiraCritica(h: HidranteVencimentoRow): number | null {
  const dias = listarMangueirasAtivas(h)
    .map((m) => diasParaVencimentoTeste(m.ultimaRealizacao))
    .filter((d): d is number => d !== null);
  if (dias.length === 0) return null;
  return Math.min(...dias);
}

export function formatVencimentoMangueira(iso: string | null): string {
  if (!iso) return "—";
  const d = dataVencimentoTeste(iso);
  if (!d) return "—";
  return formatDateOnlyPt(d);
}

export function computeHidranteVencimentoBuckets(
  hidrantes: HidranteVencimentoRow[],
  today: Date,
): {
  stats: HidranteVencimentoStats;
  vencidosList: HidranteVencimentoRow[];
  alerta30List: HidranteVencimentoRow[];
  alerta60List: HidranteVencimentoRow[];
  semPosicaoList: HidranteVencimentoRow[];
} {
  const in30 = addDays(today, 30);
  const in60 = addDays(today, 60);
  const vencidosList: HidranteVencimentoRow[] = [];
  const alerta30List: HidranteVencimentoRow[] = [];
  const alerta60List: HidranteVencimentoRow[] = [];
  const semPosicaoList: HidranteVencimentoRow[] = [];

  for (const h of hidrantes) {
    if (h.coord_x == null) semPosicaoList.push(h);
    if (hidranteTemMangueiraVencida(h)) {
      vencidosList.push(h);
      continue;
    }
    const venc = earliestVencimentoMangueira(h);
    if (!venc) continue;
    const dt = new Date(venc);
    dt.setHours(0, 0, 0, 0);
    if (dt >= today && dt <= in30) alerta30List.push(h);
    else if (dt > in30 && dt <= in60) alerta60List.push(h);
  }

  const sortByCodigo = (list: HidranteVencimentoRow[]) =>
    [...list].sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true }));

  return {
    stats: {
      total: hidrantes.length,
      vencidos: vencidosList.length,
      alerta30: alerta30List.length,
      alerta60: alerta60List.length,
      semPosicao: semPosicaoList.length,
    },
    vencidosList: sortByCodigo(vencidosList),
    alerta30List: sortByCodigo(alerta30List),
    alerta60List: sortByCodigo(alerta60List),
    semPosicaoList: sortByCodigo(semPosicaoList),
  };
}
