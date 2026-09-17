import { useMemo } from 'react';
import { Table } from 'antd';
import type { Breakpoint } from 'antd';
import type { Row, RowData, Table as TanstackTable } from '@tanstack/react-table';

/**
 * Metadata tambahan per kolom TanStack. Dipakai `DataTable` untuk menerjemahkan
 * ke prop antd (mis. `responsive` — kolom disembunyikan di bawah breakpoint).
 */
declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- generic nama wajib identik dengan deklarasi asli TanStack
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Sembunyikan kolom saat viewport < breakpoint (prop antd Table `responsive`). */
    responsive?: Breakpoint[];
    /** Pin kolom saat tabel melebar (prop antd Table `fixed`) — kolom aksi
     *  pakai `'right'` supaya tombol selalu terlihat tanpa scroll horizontal. */
    fixed?: 'left' | 'right';
  }
}

export interface DataTableProps<TData> {
  table: TanstackTable<TData>;
  /** Harus konsisten dengan `getRowId` di opsi `useReactTable` (mis. `(row) => String(row.id)`). */
  rowKey: (record: TData) => string;
  loading?: boolean;
  size?: 'small' | 'middle' | 'large';
  footer?: () => React.ReactNode;
}

function renderDefaultCell(value: unknown): React.ReactNode {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

/**
 * Bridge generic: TanStack Table (state, kolom, cell render) → antd `<Table>`
 * (render DOM). Kolom didefinisikan dengan columnHelper TanStack di halaman
 * fitur; komponen ini hanya menerjemahkannya ke prop `columns` antd.
 *
 * Responsif:
 * - `scroll.x = 'max-content'` + `tableLayout="fixed"` → kolom mempertahankan
 *   lebar yang didefinisikan dan tabel menampilkan scroll horizontal saat
 *   melebihi container (tanpa ini antd justru menyempitkan kolom).
 * - Kolom yang lebar/kurang penting bisa ditandai `meta: { responsive }`
 *   di definisi kolom (mis. `['lg']` = hanya tampil >= lg).
 * - Kolom kunci (identity/action) ditandai `meta: { fixed: 'left' | 'right' }`
 *   → di-pin antd saat scroll horizontal, mis. kolom aksi `'right'` agar
 *   tombol selalu terjangkau tanpa menggulir ke ujung kanan.
 *
 * Konvensi: `rowKey` (dan `getRowId` di tabel) = `String(record.id)` — ULID
 * item (docs/api Section 19).
 */
export function DataTable<TData>({ table, rowKey, loading, size = 'middle', footer }: DataTableProps<TData>) {
  const rowsById = table.getRowModel().rowsById;

  const columns = useMemo(() => {
    return table
      .getAllColumns()
      .filter((column) => column.getIsVisible())
      .map((column) => {
        const def = column.columnDef;
        const customWidth = typeof def.size === 'number' && def.size !== 150;
        const responsive = def.meta?.responsive;
        const fixed = def.meta?.fixed;
        return {
          key: column.id,
          title: (typeof def.header === 'string' ? def.header : def.id) ?? column.id,
          width: customWidth ? def.size : undefined,
          ellipsis: customWidth,
          ...(responsive && responsive.length > 0 ? { responsive } : {}),
          ...(fixed ? { fixed } : {}),
          render: (_: unknown, record: TData) => {
            const row: Row<TData> | undefined = rowsById[rowKey(record)];
            if (!row) return null;
            const cell = row.getVisibleCells().find((c) => c.column.id === column.id);
            if (typeof def.cell === 'function') {
              // cell.getContext() sudah berisi { table, row, column, getValue, renderValue } — tepat
              // sesuai ekspektasi ColumnDef.cell; bridge ini menyerahkan render ke definisi kolom.
              return (def.cell as (context: unknown) => React.ReactNode)(cell?.getContext() as unknown);
            }
            return renderDefaultCell(cell?.getValue());
          },
        };
      });
  }, [table, rowKey, rowsById]);

  return (
    <Table<TData>
      rowKey={rowKey}
      columns={columns}
      dataSource={table.getRowModel().rows.map((row) => row.original)}
      loading={loading}
      pagination={false}
      size={size}
      footer={footer}
      scroll={{ x: 'max-content' }}
      tableLayout="fixed"
    />
  );
}