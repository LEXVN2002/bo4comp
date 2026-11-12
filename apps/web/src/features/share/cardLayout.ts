// Medidas do cartão de partilha (docs/CAMOS.md, secção 7). Lógica pura, testável sem canvas.

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1350;
export const CARD_PADDING = 72;

export interface GridLayout {
  cols: number;
  rows: number;
  cell: number;
  gap: number;
  width: number;
  height: number;
}

/** Grelha de `count` células quadradas em `cols` colunas, a ocupar `areaWidth`. */
export function gridLayout(count: number, cols: number, areaWidth: number, gap: number): GridLayout {
  const c = Math.max(1, Math.min(cols, Math.max(count, 1)));
  const cell = Math.floor((areaWidth - gap * (c - 1)) / c);
  const rows = Math.ceil(count / c);
  return {
    cols: c,
    rows,
    cell,
    gap,
    width: c * cell + (c - 1) * gap,
    height: rows === 0 ? 0 : rows * cell + (rows - 1) * gap,
  };
}

/** Posição (canto superior esquerdo) da célula `i`. */
export function cellPosition(layout: GridLayout, i: number): { x: number; y: number } {
  const col = i % layout.cols;
  const row = Math.floor(i / layout.cols);
  return { x: col * (layout.cell + layout.gap), y: row * (layout.cell + layout.gap) };
}

/**
 * Tamanho da célula da matriz global (armas × camos) para caber em `maxWidth` × `maxHeight`.
 * Nunca maior que `maxCell`.
 */
export function matrixCell(
  rows: number,
  cols: number,
  maxWidth: number,
  maxHeight: number,
  gap: number,
  maxCell = 40,
): number {
  if (rows === 0 || cols === 0) return maxCell;
  const byWidth = (maxWidth - gap * (cols - 1)) / cols;
  const byHeight = (maxHeight - gap * (rows - 1)) / rows;
  return Math.max(4, Math.floor(Math.min(byWidth, byHeight, maxCell)));
}

function slug(text: string): string {
  return (
    text
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'progresso'
  );
}

/** Ex.: bo4-saug-9mm-2026-11-12.png (data local). */
export function shareFileName(title: string, date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `bo4-${slug(title)}-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.png`;
}

/** Corta um texto com "…" até caber, usando a função de medida dada (ctx.measureText). */
export function fitText(text: string, maxWidth: number, measure: (t: string) => number): string {
  if (measure(text) <= maxWidth) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (measure(`${text.slice(0, mid)}…`) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return `${text.slice(0, lo)}…`;
}
