// Atalhos de teclado do ecrã de uma arma (docs/CAMOS.md, secção 2).

export type ShortcutAction =
  | { type: 'move'; dx: number; dy: number }
  | { type: 'toggle-panel' }
  | { type: 'count'; delta: number }
  | { type: 'toggle-done' }
  | { type: 'toggle-pin' }
  | { type: 'close' }
  | { type: 'help' };

export interface KeyLike {
  key: string;
  code?: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  /** Elemento com foco: os atalhos ficam desligados dentro de campos de texto. */
  target?: { tagName?: string; isContentEditable?: boolean; type?: string } | null;
}

const TEXT_INPUT_TYPES = new Set(['text', 'number', 'search', 'email', 'url', 'tel', 'password', '']);

export function isTypingTarget(target: KeyLike['target']): boolean {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName?.toUpperCase();
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return tag === 'INPUT' && TEXT_INPUT_TYPES.has((target.type ?? '').toLowerCase());
}

/**
 * Converte uma tecla numa ação, ou null se não for atalho.
 * "+" com Shift soma 10; no teclado português "Shift" + "+" dá "*", por isso aceita-se também.
 */
export function shortcutFor(event: KeyLike): ShortcutAction | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  // Esc fecha o painel mesmo com o foco num campo de texto.
  if (event.key === 'Escape') return { type: 'close' };
  if (isTypingTarget(event.target)) return null;

  switch (event.key) {
    case 'ArrowLeft':
      return { type: 'move', dx: -1, dy: 0 };
    case 'ArrowRight':
      return { type: 'move', dx: 1, dy: 0 };
    case 'ArrowUp':
      return { type: 'move', dx: 0, dy: -1 };
    case 'ArrowDown':
      return { type: 'move', dx: 0, dy: 1 };
    case 'Enter':
      return { type: 'toggle-panel' };
    case '+':
    case '=':
      return { type: 'count', delta: event.shiftKey ? 10 : 1 };
    case '*':
      return event.code === 'BracketRight' || event.shiftKey ? { type: 'count', delta: 10 } : null;
    case '-':
      return { type: 'count', delta: -1 };
    case 'c':
    case 'C':
      return { type: 'toggle-done' };
    case 'p':
    case 'P':
      return { type: 'toggle-pin' };
    case '?':
      return { type: 'help' };
    default:
      return null;
  }
}

/** Nova posição na grelha depois de uma seta, presa aos limites. */
export function moveIndex(current: number, dx: number, dy: number, total: number, columns: number): number {
  if (total === 0) return 0;
  const cols = Math.max(1, columns);
  const next = current + dx + dy * cols;
  return Math.min(Math.max(next, 0), total - 1);
}

export const SHORTCUT_HELP: { keys: string; action: string }[] = [
  { keys: 'Setas', action: 'Navegar entre camos' },
  { keys: 'Enter', action: 'Abrir/fechar o painel do camo' },
  { keys: '+ / -', action: 'Contador +1 / -1' },
  { keys: 'Shift + +', action: 'Contador +10' },
  { keys: 'C', action: 'Alternar "Concluído"' },
  { keys: 'P', action: 'Afixar/desafixar a arma' },
  { keys: 'Esc', action: 'Fechar painel' },
  { keys: '?', action: 'Mostrar esta lista' },
];
