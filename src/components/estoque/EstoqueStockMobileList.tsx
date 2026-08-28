"use client";

import { useState } from "react";
import RowActionsMenu from "@/src/components/RowActionsMenu";
import EstoqueMobileActionsSheet from "@/src/components/estoque/EstoqueMobileActionsSheet";
import type { EstoqueStockRow } from "@/src/components/estoque/EstoqueStockTable";
import { formatExtintorConfigLabel } from "@/lib/estoque/compatibility";

type EstoqueStockMobileListProps = {
  items: EstoqueStockRow[];
  readOnly: boolean;
  canDelete: boolean;
  onEdit: (row: EstoqueStockRow) => void;
  onDelete: (row: EstoqueStockRow) => void;
};

export default function EstoqueStockMobileList({
  items,
  readOnly,
  canDelete,
  onEdit,
  onDelete,
}: EstoqueStockMobileListProps) {
  const [sheetRow, setSheetRow] = useState<EstoqueStockRow | null>(null);

  return (
    <>
      <div className="estoque-mobile-list">
        {items.map((row) => (
          <article key={row.id} className="estoque-stock-card">
            <div className="estoque-stock-card__head">
              <p className="estoque-stock-card__tipo">{row.tipo}</p>
              {!readOnly && (
                <>
                  <button
                    type="button"
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[var(--border)] bg-white text-xl font-bold leading-none text-slate-500 md:hidden"
                    aria-label={`Ações de ${formatExtintorConfigLabel(row)}`}
                    onClick={() => setSheetRow(row)}
                  >
                    ⋮
                  </button>
                  <div className="hidden md:block">
                    <RowActionsMenu
                      label={formatExtintorConfigLabel(row)}
                      onEdit={() => onEdit(row)}
                      onDelete={canDelete ? () => onDelete(row) : undefined}
                    />
                  </div>
                </>
              )}
            </div>

            <div className="estoque-stock-card__grid">
              <div>
                <p className="estoque-stock-card__field-label">Classe</p>
                <p className="estoque-stock-card__field-value">{row.capacidade_extintora}</p>
              </div>
              <div>
                <p className="estoque-stock-card__field-label">Capacidade</p>
                <p className="estoque-stock-card__field-value">{row.tamanho}</p>
              </div>
            </div>

            <div className="estoque-stock-card__qty-block">
              <p className="estoque-stock-card__field-label">Disponível</p>
              <p className="estoque-stock-card__qty-value">
                {row.quantidade} unidade{row.quantidade !== 1 ? "s" : ""}
              </p>
            </div>
          </article>
        ))}
      </div>

      {sheetRow && !readOnly && (
        <EstoqueMobileActionsSheet
          label={formatExtintorConfigLabel(sheetRow)}
          onClose={() => setSheetRow(null)}
          onEdit={() => {
            onEdit(sheetRow);
            setSheetRow(null);
          }}
          onDelete={
            canDelete
              ? () => {
                  onDelete(sheetRow);
                  setSheetRow(null);
                }
              : undefined
          }
        />
      )}
    </>
  );
}
