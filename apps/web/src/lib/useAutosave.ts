import { useCallback, useEffect, useRef, useState } from 'react';

export type AutosaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

/**
 * Texto com gravação automática: grava `delay` ms depois da última alteração
 * e, se o componente desmontar com alterações por gravar, grava logo.
 */
export function useAutosave(initial: string, save: (value: string) => Promise<unknown>, delay = 800) {
  const [value, setValue] = useState(initial);
  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ value: initial, saved: initial, save });
  useEffect(() => {
    latest.current.save = save;
  });

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const { value: current, saved } = latest.current;
    if (current === saved) return;
    setStatus('saving');
    latest.current.saved = current;
    latest.current
      .save(current)
      .then(() => setStatus((s) => (s === 'saving' ? 'saved' : s)))
      .catch(() => {
        latest.current.saved = saved;
        setStatus('error');
      });
  }, []);

  const onChange = useCallback(
    (next: string) => {
      setValue(next);
      latest.current.value = next;
      setStatus('pending');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, delay);
    },
    [delay, flush],
  );

  // Ao desmontar (ou mudar de camo), gravar o que ficou por gravar.
  useEffect(() => flush, [flush]);

  return { value, onChange, status, flush };
}

export function autosaveLabel(status: AutosaveStatus): string {
  switch (status) {
    case 'pending':
    case 'saving':
      return 'A guardar…';
    case 'saved':
      return 'Guardado';
    case 'error':
      return 'Erro ao guardar';
    default:
      return '';
  }
}
