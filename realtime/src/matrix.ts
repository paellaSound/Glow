export function cellKey(row: number, col: number): string {
  return `${row}:${col}`;
}

export function parseCellKey(key: string): { row: number; col: number } | null {
  const [rowStr, colStr] = key.split(':');
  const row = Number(rowStr);
  const col = Number(colStr);
  if (Number.isNaN(row) || Number.isNaN(col)) return null;
  return { row, col };
}

export function labelFromPosition(row: number, col: number): string {
  const rowLabel = String.fromCharCode(65 + row);
  return `${rowLabel}${col + 1}`;
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function generatePublicId(): string {
  return `dev_${Math.random().toString(36).slice(2, 10)}`;
}
