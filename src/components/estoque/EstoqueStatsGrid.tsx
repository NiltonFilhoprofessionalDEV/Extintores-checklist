import { buildStockStatsByTipo } from "@/lib/estoque/stock-stats";

type EstoqueRow = {
  tipo: string;
  tamanho: string;
  capacidade_extintora: string;
  quantidade: number;
};

const TOTAL_ACCENT = "#0f766e";
const TIPO_ACCENT = "#64748b";

type EstoqueStatsGridProps = {
  items: EstoqueRow[];
};

function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <article className="estoque-stat" style={{ ["--estoque-stat-accent" as string]: accent }}>
      <p className="estoque-stat__label">{label}</p>
      <p className="estoque-stat__value">{value}</p>
    </article>
  );
}

export default function EstoqueStatsGrid({ items }: EstoqueStatsGridProps) {
  const stats = buildStockStatsByTipo(items);

  return (
    <div className="estoque-stats">
      <StatCard label="Total disponível" value={stats.total} accent={TOTAL_ACCENT} />
      {stats.porTipo.map((row) => (
        <StatCard key={row.tipo} label={row.tipo} value={row.quantidade} accent={TIPO_ACCENT} />
      ))}
    </div>
  );
}
