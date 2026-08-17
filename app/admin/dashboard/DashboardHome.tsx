"use client";

import Link from "next/link";
import type { EmpresaTab } from "@/lib/dashboard/empresa-filter";
import { EMPRESA_TABS } from "@/lib/dashboard/empresa-filter";
import { ExtinguisherIcon, HydrantIcon } from "@/src/components/EquipmentIcons";
import AdminNavIcon from "@/src/components/admin/AdminNavIcon";
import type { AdminNavItem } from "@/src/components/admin/admin-nav";

export type DashStatus = { conforme: number; naoConforme: number; pendente: number; total: number };

export type DashFaixa = {
  key: string;
  label: string;
  value: number;
  onClick: () => void;
};

export type DashAlert = {
  key: string;
  label: string;
  count: number;
  tone: "bad" | "warn" | "slate";
  onClick: () => void;
};

export type DashUpcoming = {
  id: string;
  codigo: string;
  tipo: string;
  local: string;
  vencimento: string;
  dias: string;
  status: "Vencido" | "Próximo";
};

export type DashRecent = {
  id: string;
  codigo: string;
  meta: string;
  local: string;
  when: string;
  ok: boolean;
};

type HydroBucket = "vencido" | "d30" | "d60" | "d90" | "d120";

type DashboardHomeProps = {
  mesLegenda: string;
  showEmpresaTabs: boolean;
  empresaTab: EmpresaTab;
  onEmpresaTab: (tab: EmpresaTab) => void;
  onRefresh: () => void;
  kpis: {
    extintores: number;
    hidrantes: number;
    inspecoesMes: number;
    naoConformidades: number;
    vencidos: number;
  };
  onNcClick: () => void;
  onVencidosClick: () => void;
  faixas: DashFaixa[];
  extStatus: DashStatus;
  hidStatus: DashStatus;
  hidro: { vencido: number; d30: number; d60: number; d90: number; d120: number; emDia: number; total: number };
  onHydroSelect: (bucket: HydroBucket) => void;
  alerts: DashAlert[];
  upcoming: DashUpcoming[];
  onSeeUpcoming: () => void;
  recent: DashRecent[];
  quickLinks: AdminNavItem[];
  extSemPosicao: number;
  hidSemPosicao: number;
};

const FAIXA_TONE: Record<string, string> = {
  alerta30: "amber",
  alerta60: "yellow",
  alerta90: "lime",
  alerta120: "green",
  alerta180: "teal",
  alerta360: "blue",
  semPosicao: "slate",
};

function pct(part: number, total: number): string {
  if (total <= 0) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

function donut(status: DashStatus): string {
  const total = Math.max(status.total, 1);
  const conforme = (status.conforme / total) * 100;
  const naoConforme = (status.naoConforme / total) * 100;
  return `conic-gradient(#22c55e 0 ${conforme}%, #ef4444 ${conforme}% ${conforme + naoConforme}%, #f59e0b ${conforme + naoConforme}% 100%)`;
}

function OutlineIcon({ name }: { name: "check" | "alert" | "clock" }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (name === "check") {
    return <svg {...common}><path d="M9 5H6a2 2 0 0 0-2 2v13h16V7a2 2 0 0 0-2-2h-3M9 5a3 3 0 0 1 6 0M9 5h6m-7 8 2.5 2.5L16 10" /></svg>;
  }
  if (name === "alert") {
    return <svg {...common}><path d="M12 9v4m0 4h.01M10.3 4.2 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z" /></svg>;
  }
  return <svg {...common}><circle cx="12" cy="12" r="8.25" /><path d="M12 8v5l3 1.5" /></svg>;
}

export default function DashboardHome({
  mesLegenda,
  showEmpresaTabs,
  empresaTab,
  onEmpresaTab,
  onRefresh,
  kpis,
  onNcClick,
  onVencidosClick,
  faixas,
  extStatus,
  hidStatus,
  hidro,
  onHydroSelect,
  alerts,
  upcoming,
  onSeeUpcoming,
  recent,
  quickLinks,
  extSemPosicao,
  hidSemPosicao,
}: DashboardHomeProps) {
  const hidroTotal = Math.max(hidro.total, 1);
  const barWidth = (value: number) => `${(value / hidroTotal) * 100}%`;
  const visibleAlerts = alerts.filter((alert) => alert.count > 0);

  return (
    <div className="dash-page">
      <div className="dash-intro">
        <div>
          <h1>Dashboard</h1>
          <p>Visão consolidada de extintores, hidrantes, conferências e manutenções.</p>
        </div>
      </div>

      <div className="dash-filters">
        {showEmpresaTabs
          ? EMPRESA_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`dash-chip${empresaTab === tab.id ? " is-active" : ""}`}
                onClick={() => onEmpresaTab(tab.id)}
              >
                {tab.label}
              </button>
            ))
          : null}
        <span className="dash-chip is-period">{mesLegenda}</span>
        <button type="button" className="dash-refresh" onClick={onRefresh}>
          Atualizar dados
        </button>
      </div>

      <section className="dash-kpis" aria-label="Indicadores">
        <article className="dash-kpi dash-kpi--blue">
          <span className="dash-kpi__icon"><ExtinguisherIcon size={18} /></span>
          <p className="dash-kpi__label">Total de extintores</p>
          <p className="dash-kpi__value">{kpis.extintores}</p>
          <p className="dash-kpi__hint">Inventário ativo</p>
        </article>
        <article className="dash-kpi dash-kpi--orange">
          <span className="dash-kpi__icon"><HydrantIcon size={18} /></span>
          <p className="dash-kpi__label">Total de hidrantes</p>
          <p className="dash-kpi__value">{kpis.hidrantes}</p>
          <p className="dash-kpi__hint">Inventário ativo</p>
        </article>
        <article className="dash-kpi dash-kpi--green">
          <span className="dash-kpi__icon"><OutlineIcon name="check" /></span>
          <p className="dash-kpi__label">Inspeções realizadas</p>
          <p className="dash-kpi__value">{kpis.inspecoesMes}</p>
          <p className="dash-kpi__hint">Neste mês</p>
        </article>
        <button type="button" className="dash-kpi dash-kpi--red is-clickable" onClick={onNcClick}>
          <span className="dash-kpi__icon"><OutlineIcon name="alert" /></span>
          <p className="dash-kpi__label">Não conformidades</p>
          <p className="dash-kpi__value">{kpis.naoConformidades}</p>
          <p className="dash-kpi__hint">Ações necessárias</p>
        </button>
        <button type="button" className="dash-kpi dash-kpi--amber is-clickable" onClick={onVencidosClick}>
          <span className="dash-kpi__icon"><OutlineIcon name="clock" /></span>
          <p className="dash-kpi__label">Vencidos</p>
          <p className="dash-kpi__value">{kpis.vencidos}</p>
          <p className="dash-kpi__hint">Extintores e hidrantes</p>
        </button>
      </section>

      <div className="dash-grid">
        <div className="dash-main">
          <section className="dash-card">
            <div className="dash-card__head">
              <h2 className="dash-card__title">Vencimento de manutenção</h2>
              <Link href="/admin/extintores" className="dash-link">
                Ver todos
              </Link>
            </div>
            <div className="dash-faixas">
              {faixas.map((faixa) => (
                <button
                  key={faixa.key}
                  type="button"
                  className={`dash-faixa dash-faixa--${FAIXA_TONE[faixa.key] ?? "slate"}`}
                  onClick={faixa.onClick}
                >
                  <span className="dash-faixa__value">{faixa.value}</span>
                  <span className="dash-faixa__label">{faixa.label}</span>
                </button>
              ))}
            </div>
          </section>

          <div className="dash-status-grid">
            <section className="dash-card">
              <h2 className="dash-card__title">Distribuição por status — Extintores</h2>
              <div className="dash-status">
                <div className="dash-donut" style={{ background: donut(extStatus) }}>
                  <div className="dash-donut__hole">
                    <strong>{extStatus.total}</strong>
                    <span>Total</span>
                  </div>
                </div>
                <div className="dash-legend">
                  <p><i style={{ background: "#22c55e" }} />Conforme {extStatus.conforme} ({pct(extStatus.conforme, extStatus.total)})</p>
                  <p><i style={{ background: "#ef4444" }} />Não conforme {extStatus.naoConforme} ({pct(extStatus.naoConforme, extStatus.total)})</p>
                  <p><i style={{ background: "#f59e0b" }} />Pendente {extStatus.pendente} ({pct(extStatus.pendente, extStatus.total)})</p>
                  <p><i style={{ background: "#94a3b8" }} />Sem posição {extSemPosicao}</p>
                </div>
              </div>
            </section>

            <section className="dash-card">
              <h2 className="dash-card__title">Distribuição por status — Hidrantes</h2>
              <div className="dash-status">
                <div className="dash-donut" style={{ background: donut(hidStatus) }}>
                  <div className="dash-donut__hole">
                    <strong>{hidStatus.total}</strong>
                    <span>Total</span>
                  </div>
                </div>
                <div className="dash-legend">
                  <p><i style={{ background: "#22c55e" }} />Conforme {hidStatus.conforme} ({pct(hidStatus.conforme, hidStatus.total)})</p>
                  <p><i style={{ background: "#ef4444" }} />Não conforme {hidStatus.naoConforme} ({pct(hidStatus.naoConforme, hidStatus.total)})</p>
                  <p><i style={{ background: "#f59e0b" }} />Pendente {hidStatus.pendente} ({pct(hidStatus.pendente, hidStatus.total)})</p>
                  <p><i style={{ background: "#94a3b8" }} />Sem posição {hidSemPosicao}</p>
                </div>
              </div>
            </section>
          </div>

          <section className="dash-card">
            <h2 className="dash-card__title">Testes hidrostáticos</h2>
            <div className="dash-bar" aria-hidden>
              <span style={{ width: barWidth(hidro.vencido), background: "#ef4444" }} />
              <span style={{ width: barWidth(hidro.d30), background: "#f59e0b" }} />
              <span style={{ width: barWidth(hidro.d60), background: "#eab308" }} />
              <span style={{ width: barWidth(hidro.d90), background: "#84cc16" }} />
              <span style={{ width: barWidth(hidro.d120), background: "#22c55e" }} />
              <span style={{ width: barWidth(hidro.emDia), background: "#16a34a" }} />
            </div>
            <div className="dash-legend dash-legend--hydro">
              <button type="button" onClick={() => onHydroSelect("vencido")}>
                <i style={{ background: "#ef4444" }} />Vencido {hidro.vencido}
              </button>
              <button type="button" onClick={() => onHydroSelect("d30")}>
                <i style={{ background: "#f59e0b" }} />30 dias {hidro.d30}
              </button>
              <button type="button" onClick={() => onHydroSelect("d60")}>
                <i style={{ background: "#eab308" }} />60 dias {hidro.d60}
              </button>
              <button type="button" onClick={() => onHydroSelect("d90")}>
                <i style={{ background: "#84cc16" }} />90 dias {hidro.d90}
              </button>
              <button type="button" onClick={() => onHydroSelect("d120")}>
                <i style={{ background: "#22c55e" }} />120 dias {hidro.d120}
              </button>
              <p><i style={{ background: "#16a34a" }} />Em dia {hidro.emDia}</p>
            </div>
          </section>

          <section className="dash-card">
            <div className="dash-card__head">
              <h2 className="dash-card__title">Manutenções próximas a vencer</h2>
              <button type="button" className="dash-link" onClick={onSeeUpcoming}>
                Ver todas
              </button>
            </div>
            {upcoming.length === 0 ? (
              <p className="dash-muted mt-3">Nenhuma manutenção urgente neste recorte.</p>
            ) : (
              <div className="dash-list">
                {upcoming.map((row) => (
                  <article key={row.id} className="dash-row">
                    <span className="dash-code">{row.codigo}</span>
                    <span className="dash-muted">
                      {row.tipo} · {row.local}
                      <span className="dash-when">{row.vencimento}</span>
                    </span>
                    <span className={`dash-badge ${row.status === "Vencido" ? "dash-badge--bad" : "dash-badge--warn"}`}>
                      {row.status === "Vencido" ? `${row.dias} vencido` : row.dias}
                    </span>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="dash-card">
            <h2 className="dash-card__title">Últimas conferências</h2>
            {recent.length === 0 ? (
              <p className="dash-muted mt-3">Nenhuma conferência neste mês.</p>
            ) : (
              <div className="dash-list">
                {recent.map((row) => (
                  <article key={row.id} className="dash-row">
                    <span className="dash-code">{row.codigo}</span>
                    <span className="dash-muted">
                      {row.meta} · {row.local}
                      <span className="dash-when">{row.when}</span>
                    </span>
                    <span className={`dash-badge ${row.ok ? "dash-badge--ok" : "dash-badge--bad"}`}>
                      {row.ok ? "Conforme" : "Não conforme"}
                    </span>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="dash-side">
          <section className="dash-card">
            <h2 className="dash-card__title">Alertas prioritários</h2>
            {visibleAlerts.length === 0 ? (
              <p className="dash-muted mt-3">Nenhum alerta no momento.</p>
            ) : (
              visibleAlerts.map((alert) => (
                <button key={alert.key} type="button" className={`dash-alert dash-alert--${alert.tone}`} onClick={alert.onClick}>
                  <span>{alert.label}</span>
                  <span className="dash-alert__count">{alert.count}</span>
                </button>
              ))
            )}
          </section>

          <section className="dash-card">
            <h2 className="dash-card__title">Resumo rápido</h2>
            <div className="dash-summary">
              <p><i className="dash-dot dash-dot--ok" /><span>Extintores conformes</span><strong>{extStatus.conforme} ({pct(extStatus.conforme, extStatus.total)})</strong></p>
              <p><i className="dash-dot dash-dot--ok" /><span>Hidrantes conformes</span><strong>{hidStatus.conforme} ({pct(hidStatus.conforme, hidStatus.total)})</strong></p>
              <p><i className="dash-dot dash-dot--ok" /><span>Testes hidrostáticos em dia</span><strong>{hidro.emDia} ({pct(hidro.emDia, hidro.total)})</strong></p>
              <p><i className="dash-dot dash-dot--mute" /><span>Sem posição no mapa</span><strong>{extSemPosicao + hidSemPosicao}</strong></p>
            </div>
          </section>

          {quickLinks.length > 0 ? (
            <section className="dash-card">
              <h2 className="dash-card__title">Acessos rápidos</h2>
              <div className="dash-quick">
                {quickLinks.map((item) => (
                  <Link key={item.href} href={item.href} className="dash-quick__item">
                    <span className="dash-quick__icon"><AdminNavIcon name={item.icon} size={16} /></span>
                    <span>{item.label}</span>
                    <span className="dash-quick__chevron" aria-hidden>›</span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
