"use client";

import RowActionsMenu from "@/src/components/RowActionsMenu";
import { formatExtintorConfigLabel } from "@/lib/estoque/compatibility";

export type EstoqueStockRow = {
  id: string;
  tipo: string;
  tamanho: string;
  capacidade_extintora: string;
  quantidade: number;
  manutencao_2_nivel: string | null;
  manutencao_3_nivel: string | null;
};

type EstoqueStockTableProps = {
  items: EstoqueStockRow[];
  readOnly: boolean;
  canDelete: boolean;
  onEdit: (row: EstoqueStockRow) => void;
  onDelete: (row: EstoqueStockRow) => void;
};

export default function EstoqueStockTable({
  items,
  readOnly,
  canDelete,
  onEdit,
  onDelete,
}: EstoqueStockTableProps) {
  return (
    <div className="estoque-table-wrap">
      <table className="estoque-table">
        <thead>
          <tr>
            <th>Tipo</th>
            <th>Classe</th>
            <th>Capacidade</th>
            <th>Quantidade disponível</th>
            {!readOnly && <th>Ações</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.id}>
              <td className="estoque-table__tipo">{row.tipo}</td>
              <td>{row.capacidade_extintora}</td>
              <td>{row.tamanho}</td>
              <td className="estoque-table__qty">
                {row.quantidade} disponível{row.quantidade !== 1 ? "s" : ""}
              </td>
              {!readOnly && (
                <td>
                  <RowActionsMenu
                    label={formatExtintorConfigLabel(row)}
                    onEdit={() => onEdit(row)}
                    onDelete={canDelete ? () => onDelete(row) : undefined}
                  />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
