// Desenha o cartão de progresso (1080×1350) num <canvas>. Sem imagens do jogo:
// os padrões dos camos são redesenhados com as mesmas cores e formas da app.
import type { CamoDisplayState } from '../../lib/progress';
import { camoPattern, type CamoPattern } from '../camos/camoPattern';
import type { CellLevel } from '../camos/seals';
import {
  CARD_HEIGHT,
  CARD_PADDING,
  CARD_WIDTH,
  cellPosition,
  fitText,
  gridLayout,
  matrixCell,
} from './cardLayout';

export interface CardTile {
  camoId: string;
  name: string;
  state: CamoDisplayState;
  /** 0..1 quando o requisito é conhecido. */
  fraction: number | null;
}

export interface CardMatrixRow {
  label: string;
  cells: CellLevel[];
}

export interface CardSeal {
  label: string;
  patternId: string;
  complete: boolean;
  fraction: number;
}

export interface CardInput {
  title: string;
  subtitle: string;
  unlocked: number;
  total: number;
  /** Cartão de uma arma: os camos. */
  tiles?: CardTile[];
  /** Cartão global: armas × camos. */
  matrix?: CardMatrixRow[];
  seals: CardSeal[];
  playerName: string | null;
  date: Date;
}

const COLORS = {
  bg: '#09090b',
  panel: '#18181b',
  border: '#27272a',
  text: '#fafafa',
  muted: '#a1a1aa',
  faint: '#52525b',
  accent: '#34d399',
  accentDark: '#059669',
};

const FONT = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const CELL_FILL: Record<CellLevel, string> = {
  empty: '#27272a',
  low: '#022c22',
  mid: '#065f46',
  high: '#059669',
  done: '#10b981',
};

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Preenche o retângulo (já recortado) com o padrão do camo. `unit` escala o desenho. */
function fillPattern(ctx: CanvasRenderingContext2D, p: CamoPattern, x: number, y: number, size: number, unit: number) {
  const { a, b, c } = p.colors;
  ctx.save();
  ctx.translate(x, y);
  switch (p.kind) {
    case 'stripes': {
      ctx.fillStyle = c;
      ctx.fillRect(0, 0, size, size);
      ctx.translate(size / 2, size / 2);
      ctx.rotate(((p.angle - 90) * Math.PI) / 180);
      const band = 15 * unit;
      for (let o = -size * 1.5; o < size * 1.5; o += band) {
        ctx.fillStyle = a;
        ctx.fillRect(o, -size, 6 * unit, size * 2);
        ctx.fillStyle = b;
        ctx.fillRect(o + 6 * unit, -size, 6 * unit, size * 2);
      }
      break;
    }
    case 'checks': {
      const s = 7 * unit;
      for (let i = 0; i * s < size; i++) {
        for (let j = 0; j * s < size; j++) {
          ctx.fillStyle = (i + j) % 2 === 0 ? a : b;
          ctx.fillRect(i * s, j * s, s, s);
        }
      }
      break;
    }
    case 'dots': {
      ctx.fillStyle = c;
      ctx.fillRect(0, 0, size, size);
      const s = 12 * unit;
      const r = 3.4 * unit;
      for (let i = 0; i * s <= size + s; i++) {
        for (let j = 0; j * s <= size + s; j++) {
          ctx.fillStyle = a;
          ctx.beginPath();
          ctx.arc(i * s, j * s, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = b;
          ctx.beginPath();
          ctx.arc(i * s + s / 2, j * s + s / 2, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
    case 'waves': {
      ctx.fillStyle = b;
      ctx.fillRect(0, 0, size, size);
      const w = 16 * unit;
      const h = 10 * unit;
      for (let i = 0; i * w <= size + w; i++) {
        for (let j = 0; j * h <= size + h; j++) {
          ctx.fillStyle = a;
          ctx.beginPath();
          ctx.arc(i * w + w / 2, j * h + h * 1.2, w * 0.3, Math.PI, 0);
          ctx.fill();
          ctx.fillStyle = c;
          ctx.beginPath();
          ctx.arc(i * w + w / 2, j * h - h * 0.2, w * 0.3, 0, Math.PI);
          ctx.fill();
        }
      }
      break;
    }
    case 'diamonds': {
      ctx.fillStyle = c;
      ctx.fillRect(0, 0, size, size);
      const s = 12 * unit;
      for (let i = 0; i * s <= size + s; i++) {
        for (let j = 0; j * s <= size + s; j++) {
          ctx.fillStyle = (i + j) % 2 === 0 ? a : b;
          ctx.beginPath();
          ctx.moveTo(i * s, j * s - s / 2);
          ctx.lineTo(i * s + s / 2, j * s);
          ctx.lineTo(i * s, j * s + s / 2);
          ctx.lineTo(i * s - s / 2, j * s);
          ctx.closePath();
          ctx.fill();
        }
      }
      break;
    }
  }
  ctx.restore();
}

function drawLock(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  ctx.save();
  ctx.fillStyle = 'rgba(244,244,245,0.9)';
  ctx.strokeStyle = 'rgba(244,244,245,0.9)';
  ctx.lineWidth = s * 0.12;
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.1, s * 0.22, Math.PI, 0);
  ctx.stroke();
  roundRect(ctx, cx - s * 0.32, cy - s * 0.1, s * 0.64, s * 0.5, s * 0.08);
  ctx.fill();
  ctx.restore();
}

function drawCheck(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.save();
  ctx.fillStyle = COLORS.accent;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = COLORS.bg;
  ctx.lineWidth = r * 0.28;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.45, cy);
  ctx.lineTo(cx - r * 0.1, cy + r * 0.35);
  ctx.lineTo(cx + r * 0.5, cy - r * 0.35);
  ctx.stroke();
  ctx.restore();
}

function drawTile(ctx: CanvasRenderingContext2D, tile: CardTile, x: number, y: number, size: number) {
  const radius = size * 0.1;
  ctx.save();
  roundRect(ctx, x, y, size, size, radius);
  ctx.clip();
  ctx.globalAlpha = tile.state === 'locked' ? 0.25 : tile.state === 'in_progress' ? 0.7 : 1;
  fillPattern(ctx, camoPattern(tile.camoId), x, y, size, size / 64);
  ctx.globalAlpha = 1;
  if (tile.state === 'in_progress' && tile.fraction !== null && tile.fraction > 0) {
    const h = size * 0.08;
    ctx.fillStyle = 'rgba(9,9,11,0.75)';
    ctx.fillRect(x, y + size - h, size, h);
    ctx.fillStyle = COLORS.accent;
    ctx.fillRect(x, y + size - h, size * Math.min(tile.fraction, 1), h);
  }
  ctx.restore();

  // Contorno: néon nos concluídos.
  ctx.save();
  roundRect(ctx, x, y, size, size, radius);
  if (tile.state === 'done') {
    ctx.shadowColor = 'rgba(52,211,153,0.7)';
    ctx.shadowBlur = size * 0.15;
    ctx.strokeStyle = COLORS.accent;
    ctx.lineWidth = size * 0.04;
  } else {
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 2;
  }
  ctx.stroke();
  ctx.restore();

  if (tile.state === 'locked') drawLock(ctx, x + size / 2, y + size / 2, size * 0.4);
  if (tile.state === 'done') drawCheck(ctx, x + size - size * 0.16, y + size * 0.16, size * 0.11);
}

function drawProgressBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fraction: number) {
  ctx.fillStyle = COLORS.border;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  if (fraction > 0) {
    ctx.fillStyle = COLORS.accent;
    roundRect(ctx, x, y, Math.max(w * Math.min(fraction, 1), h), h, h / 2);
    ctx.fill();
  }
}

export function renderCard(canvas: HTMLCanvasElement, input: CardInput): void {
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D não disponível neste browser.');
  const area = CARD_WIDTH - 2 * CARD_PADDING;
  const left = CARD_PADDING;
  const measure = (t: string) => ctx.measureText(t).width;

  // Fundo com um brilho suave no topo.
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  const glow = ctx.createRadialGradient(CARD_WIDTH / 2, -200, 50, CARD_WIDTH / 2, -200, 900);
  glow.addColorStop(0, 'rgba(16,185,129,0.25)');
  glow.addColorStop(1, 'rgba(16,185,129,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // Cabeçalho.
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COLORS.accent;
  ctx.font = `600 28px ${FONT}`;
  ctx.fillText('BO4 ZOMBIES · CAMOS', left, CARD_PADDING + 24);
  ctx.fillStyle = COLORS.text;
  ctx.font = `800 76px ${FONT}`;
  ctx.fillText(fitText(input.title, area, measure), left, CARD_PADDING + 112);
  ctx.fillStyle = COLORS.muted;
  ctx.font = `400 32px ${FONT}`;
  ctx.fillText(fitText(input.subtitle, area, measure), left, CARD_PADDING + 160);

  // Percentagem e barra.
  const fraction = input.total === 0 ? 0 : input.unlocked / input.total;
  const pct = `${Math.floor(fraction * 100)}%`;
  ctx.fillStyle = COLORS.text;
  ctx.font = `800 64px ${FONT}`;
  ctx.fillText(pct, left, CARD_PADDING + 250);
  const pctWidth = measure(pct);
  ctx.fillStyle = COLORS.muted;
  ctx.font = `400 30px ${FONT}`;
  ctx.fillText(`${input.unlocked} de ${input.total} camos`, left + pctWidth + 20, CARD_PADDING + 250);
  drawProgressBar(ctx, left, CARD_PADDING + 274, area, 16, fraction);

  // Conteúdo central.
  const top = CARD_PADDING + 330;
  const footerTop = CARD_HEIGHT - CARD_PADDING - 190;
  if (input.tiles) {
    const grid = gridLayout(input.tiles.length, 6, area, 20);
    const labelH = 34;
    // Centrar a grelha (com os nomes) no espaço entre a barra e os selos.
    const contentH = grid.height + grid.rows * labelH;
    const offset = Math.max(0, Math.floor((footerTop - 50 - top - contentH) / 2));
    input.tiles.forEach((tile, i) => {
      const pos = cellPosition(grid, i);
      const y = top + offset + pos.y + Math.floor(i / grid.cols) * labelH;
      drawTile(ctx, tile, left + pos.x, y, grid.cell);
      ctx.fillStyle = tile.state === 'done' ? COLORS.text : COLORS.muted;
      ctx.font = `500 20px ${FONT}`;
      ctx.fillText(fitText(tile.name, grid.cell, measure), left + pos.x, y + grid.cell + 26);
    });
  } else if (input.matrix) {
    const labelW = 230;
    const cols = input.matrix[0]?.cells.length ?? 0;
    const gap = 4;
    const cell = matrixCell(input.matrix.length, cols, area - labelW, footerTop - top - 20, gap, 34);
    input.matrix.forEach((row, r) => {
      const y = top + r * (cell + gap);
      ctx.fillStyle = COLORS.muted;
      ctx.font = `400 ${Math.min(22, Math.max(12, cell * 0.7))}px ${FONT}`;
      ctx.textBaseline = 'middle';
      ctx.fillText(fitText(row.label, labelW - 16, measure), left, y + cell / 2);
      row.cells.forEach((level, c) => {
        ctx.fillStyle = CELL_FILL[level];
        roundRect(ctx, left + labelW + c * (cell + gap), y, cell, cell, Math.max(2, cell * 0.15));
        ctx.fill();
      });
    });
    ctx.textBaseline = 'alphabetic';
  }

  // Selos de classe.
  ctx.fillStyle = COLORS.muted;
  ctx.font = `600 22px ${FONT}`;
  ctx.fillText('SELOS DE CLASSE', left, footerTop);
  const sealSize = 56;
  const sealGap = (area - input.seals.length * sealSize) / Math.max(input.seals.length - 1, 1);
  input.seals.forEach((seal, i) => {
    const x = left + i * (sealSize + sealGap);
    const y = footerTop + 20;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + sealSize / 2, y + sealSize / 2, sealSize / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.globalAlpha = seal.complete ? 1 : 0.2;
    fillPattern(ctx, camoPattern(seal.patternId), x, y, sealSize, 0.9);
    ctx.restore();
    if (seal.complete) {
      ctx.save();
      ctx.strokeStyle = COLORS.accent;
      ctx.lineWidth = 3;
      ctx.shadowColor = 'rgba(52,211,153,0.7)';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(x + sealSize / 2, y + sealSize / 2, sealSize / 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = seal.complete ? COLORS.text : COLORS.faint;
    ctx.font = `500 16px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(fitText(seal.label, sealSize + sealGap - 6, measure), x + sealSize / 2, y + sealSize + 24);
    ctx.fillStyle = COLORS.faint;
    ctx.fillText(seal.complete ? '★' : `${Math.floor(seal.fraction * 100)}%`, x + sealSize / 2, y + sealSize + 46);
    ctx.textAlign = 'left';
  });

  // Rodapé: nome de jogador e data.
  ctx.fillStyle = COLORS.border;
  ctx.fillRect(left, CARD_HEIGHT - CARD_PADDING - 50, area, 2);
  ctx.font = `600 28px ${FONT}`;
  ctx.fillStyle = COLORS.text;
  ctx.fillText(fitText(input.playerName?.trim() || 'Jogador', area * 0.6, measure), left, CARD_HEIGHT - CARD_PADDING);
  ctx.fillStyle = COLORS.muted;
  ctx.font = `400 26px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText(input.date.toLocaleDateString('pt-PT'), CARD_WIDTH - CARD_PADDING, CARD_HEIGHT - CARD_PADDING);
  ctx.textAlign = 'left';
}

/** Gera o PNG do cartão. */
export function renderCardBlob(input: CardInput): Promise<Blob> {
  const canvas = document.createElement('canvas');
  renderCard(canvas, input);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Não foi possível gerar a imagem.'))), 'image/png'),
  );
}
