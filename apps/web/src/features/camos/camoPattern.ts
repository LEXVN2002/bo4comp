// Padrões dos camos gerados em CSS a partir do id (sem imagens do jogo).
// O mesmo id dá sempre o mesmo padrão; ids diferentes dão padrões variados.
import type { CSSProperties } from 'react';

/** Hash FNV-1a de 32 bits: simples, rápido e estável entre browsers. */
export function hashString(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export const PATTERN_KINDS = ['stripes', 'checks', 'dots', 'waves', 'diamonds'] as const;
export type PatternKind = (typeof PATTERN_KINDS)[number];

export interface CamoPattern {
  kind: PatternKind;
  hueA: number;
  hueB: number;
  angle: number;
  style: CSSProperties;
}

export function camoPattern(id: string): CamoPattern {
  const h = hashString(id);
  const kind = PATTERN_KINDS[h % PATTERN_KINDS.length]!;
  const hueA = (h >>> 3) % 360;
  const hueB = (hueA + 40 + ((h >>> 12) % 140)) % 360;
  const angle = ((h >>> 20) % 8) * 22.5;
  const a = `hsl(${hueA} 55% 42%)`;
  const b = `hsl(${hueB} 60% 30%)`;
  const c = `hsl(${hueA} 45% 18%)`;

  let style: CSSProperties;
  switch (kind) {
    case 'stripes':
      style = { backgroundImage: `repeating-linear-gradient(${angle}deg, ${a} 0 6px, ${b} 6px 12px, ${c} 12px 15px)` };
      break;
    case 'checks':
      style = {
        backgroundColor: b,
        backgroundImage: `conic-gradient(${a} 25%, transparent 0 50%, ${a} 0 75%, transparent 0)`,
        backgroundSize: '14px 14px',
      };
      break;
    case 'dots':
      style = {
        backgroundColor: c,
        backgroundImage: `radial-gradient(${a} 28%, transparent 30%), radial-gradient(${b} 28%, transparent 30%)`,
        backgroundSize: '12px 12px',
        backgroundPosition: '0 0, 6px 6px',
      };
      break;
    case 'waves':
      style = {
        backgroundColor: b,
        backgroundImage: `radial-gradient(circle at 50% 120%, ${a} 30%, transparent 32%), radial-gradient(circle at 50% -20%, ${c} 30%, transparent 32%)`,
        backgroundSize: '16px 10px',
      };
      break;
    case 'diamonds':
      style = {
        backgroundColor: c,
        backgroundImage: `linear-gradient(${angle + 45}deg, ${a} 25%, transparent 25% 75%, ${a} 75%), linear-gradient(${angle - 45}deg, ${b} 25%, transparent 25% 75%, ${b} 75%)`,
        backgroundSize: '12px 12px',
      };
      break;
  }
  return { kind, hueA, hueB, angle, style };
}
