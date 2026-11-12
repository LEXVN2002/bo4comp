import { describe, expect, it } from 'vitest';
import { CARD_PADDING, CARD_WIDTH, cellPosition, fitText, gridLayout, matrixCell, shareFileName } from './cardLayout';

describe('gridLayout', () => {
  it('17 camos em 6 colunas cabem na largura útil do cartão', () => {
    const area = CARD_WIDTH - 2 * CARD_PADDING;
    const g = gridLayout(17, 6, area, 20);
    expect(g).toMatchObject({ cols: 6, rows: 3 });
    expect(g.width).toBeLessThanOrEqual(area);
    expect(g.cell).toBe(Math.floor((area - 100) / 6));
    expect(cellPosition(g, 7)).toEqual({ x: g.cell + 20, y: g.cell + 20 });
  });

  it('casos limite: poucas células e zero', () => {
    expect(gridLayout(2, 6, 600, 10).cols).toBe(2);
    expect(gridLayout(0, 6, 600, 10)).toMatchObject({ rows: 0, height: 0 });
  });
});

describe('matrixCell', () => {
  it('cabe na largura e na altura e não passa do máximo', () => {
    const cell = matrixCell(26, 17, 560, 800, 4);
    expect(17 * cell + 16 * 4).toBeLessThanOrEqual(560);
    expect(26 * cell + 25 * 4).toBeLessThanOrEqual(800);
    expect(matrixCell(2, 2, 1000, 1000, 4, 40)).toBe(40);
  });
});

describe('shareFileName', () => {
  it('nome sem acentos nem espaços, com a data local', () => {
    expect(shareFileName('Saug 9mm', new Date(2026, 10, 12))).toBe('bo4-saug-9mm-2026-11-12.png');
    expect(shareFileName('Progresso global', new Date(2026, 0, 5))).toBe('bo4-progresso-global-2026-01-05.png');
    expect(shareFileName('???', new Date(2026, 0, 5))).toBe('bo4-progresso-2026-01-05.png');
  });
});

describe('fitText', () => {
  const measure = (t: string) => t.length * 10;
  it('mantém o texto que cabe e corta com reticências o que não cabe', () => {
    expect(fitText('Saug', 100, measure)).toBe('Saug');
    const cut = fitText('Hellion Salvo comprido', 100, measure);
    expect(cut.endsWith('…')).toBe(true);
    expect(measure(cut)).toBeLessThanOrEqual(100);
  });
});
