import type { AssignmentType, UserAccessRow } from './types.js';

const baseColumns = [
  'userId',
  'userName',
  'username',
  'assignmentType',
  'sourceId',
  'sourceName',
  'viaPermissionSetId',
  'viaPermissionSetName',
] as const;

export const fieldCsvColumns = (): string[] => [...baseColumns, 'read', 'edit'];
export const objectCsvColumns = (): string[] => [
  ...baseColumns,
  'read',
  'create',
  'edit',
  'delete',
  'viewAll',
  'modifyAll',
];

const csvEscape = (value: unknown): string => {
  const text = value === null || value === undefined ? '' : String(value);
  const escaped = text.replaceAll('"', '""');
  return /[",\n\r]/.test(escaped) ? `"${escaped}"` : escaped;
};

const csvValue = (row: UserAccessRow, column: string): unknown => {
  if (column in row.access) return row.access[column as keyof typeof row.access];
  return row[column as keyof UserAccessRow] ?? '';
};

export const serializeCsv = (rows: UserAccessRow[], columns: string[]): string => {
  const lines = [columns.join(',')];
  for (const row of rows) lines.push(columns.map((column) => csvEscape(csvValue(row, column))).join(','));
  return lines.join('\n');
};

const formatVia = (assignmentType: AssignmentType, sourceName: string, viaName?: string): string => {
  if (assignmentType === 'Profile') return `Profile: ${sourceName}`;
  if (assignmentType === 'PermissionSet') return `Permission Set: ${sourceName}`;
  return viaName ? `PSG: ${sourceName} / PS: ${viaName}` : `PSG: ${sourceName}`;
};

const paddedTable = (headers: string[], rows: string[][]): string => {
  const widths = headers.map((header, idx) => Math.max(header.length, ...rows.map((row) => (row[idx] ?? '').length)));
  const render = (cells: string[]): string =>
    cells
      .map((cell, idx) => cell.padEnd(widths[idx]))
      .join('  ')
      .trimEnd();
  return [render(headers), ...rows.map(render)].join('\n');
};

export const renderFieldTable = (rows: UserAccessRow[]): string =>
  paddedTable(
    ['User Name', 'Username', 'Read', 'Edit', 'Via'],
    rows.map((row) => [
      row.userName,
      row.username,
      row.access.read ? 'yes' : 'no',
      row.access.edit ? 'yes' : 'no',
      formatVia(row.assignmentType, row.sourceName, row.viaPermissionSetName),
    ])
  );

export const renderObjectTable = (rows: UserAccessRow[]): string =>
  paddedTable(
    ['User Name', 'Username', 'R', 'C', 'E', 'D', 'VA', 'MA', 'Via'],
    rows.map((row) => {
      const access = row.access as Record<string, boolean>;
      return [
        row.userName,
        row.username,
        access.read ? 'Y' : 'N',
        access.create ? 'Y' : 'N',
        access.edit ? 'Y' : 'N',
        access.delete ? 'Y' : 'N',
        access.viewAll ? 'Y' : 'N',
        access.modifyAll ? 'Y' : 'N',
        formatVia(row.assignmentType, row.sourceName, row.viaPermissionSetName),
      ];
    })
  );
