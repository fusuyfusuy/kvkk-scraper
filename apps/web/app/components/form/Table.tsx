import type { ReactNode } from 'react';

export interface TableColumn<T> {
  key: string;
  header: ReactNode;
  render?: (row: T) => ReactNode;
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  empty?: ReactNode;
}

export function Table<T>({ columns, rows, empty }: TableProps<T>) {
  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className="px-4 py-3 text-left font-medium tracking-wide">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-500">
                {empty ?? 'No data'}
              </td>
            </tr>
          ) : (
            rows.map((row, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                {columns.map((col) => {
                  const cell = col.render
                    ? col.render(row)
                    : ((row as Record<string, unknown>)[col.key] as ReactNode);
                  return (
                    <td key={col.key} className="px-4 py-3 text-gray-700">
                      {cell}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
