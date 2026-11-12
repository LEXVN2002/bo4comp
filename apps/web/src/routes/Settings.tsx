import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type ChangeEvent } from 'react';
import { ErrorMessage, Loading } from '../components/QueryState';
import { useCatalog } from '../features/catalog/queries';
import { useEasterEggs } from '../features/easter-eggs/queries';
import { backupFileName, parseBackup, type Backup, type BackupSummary, type CatalogIds } from '../features/settings/backup';
import { describeError } from '../lib/errors';
import { formatDateTime } from '../lib/format';
import { getSupabase } from '../lib/supabase';

type ImportState =
  | { kind: 'idle' }
  | { kind: 'invalid'; fileName: string; errors: string[] }
  | { kind: 'ready'; fileName: string; backup: Backup; summary: BackupSummary }
  | { kind: 'importing'; fileName: string; backup: Backup; summary: BackupSummary }
  | { kind: 'done'; summary: BackupSummary }
  | { kind: 'error'; fileName: string; backup: Backup; summary: BackupSummary; message: string };

export default function Settings() {
  const catalog = useCatalog();
  const eggs = useEasterEggs();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [importState, setImportState] = useState<ImportState>({ kind: 'idle' });

  if (catalog.isPending || eggs.isPending) return <Loading />;
  if (catalog.isError) return <ErrorMessage error={catalog.error} onRetry={() => catalog.refetch()} />;
  if (eggs.isError) return <ErrorMessage error={eggs.error} onRetry={() => eggs.refetch()} />;

  const catalogIds: CatalogIds = {
    maps: new Set(catalog.data.maps.map((m) => m.id)),
    weapons: new Set(catalog.data.weapons.map((w) => w.id)),
    camos: new Set(catalog.data.camos.map((c) => c.id)),
    challenges: new Set(catalog.data.challenges.map((c) => c.id)),
    easterEggs: new Set(eggs.data.map((e) => e.id)),
    steps: new Set(eggs.data.flatMap((e) => e.easter_egg_steps.map((s) => s.id))),
  };

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      const { data, error } = await getSupabase().rpc('export_progress');
      if (error) throw error;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = backupFileName(new Date());
      a.click();
      // Revogar logo a seguir ao clique pode cancelar o download nalguns browsers.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setExportError(describeError(error));
    } finally {
      setExporting(false);
    }
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ''; // permite escolher o mesmo ficheiro outra vez
    if (!file) return;
    const result = parseBackup(await file.text(), catalogIds);
    setImportState(
      result.ok
        ? { kind: 'ready', fileName: file.name, backup: result.backup, summary: result.summary }
        : { kind: 'invalid', fileName: file.name, errors: result.errors },
    );
  }

  async function handleImport(fileName: string, backup: Backup, summary: BackupSummary) {
    setImportState({ kind: 'importing', fileName, backup, summary });
    const { error } = await getSupabase().rpc('import_progress', { p_data: backup });
    if (error) {
      setImportState({ kind: 'error', fileName, backup, summary, message: describeError(error) });
      return;
    }
    // Todo o progresso mudou: descartar caches (o catálogo não muda).
    await queryClient.invalidateQueries({
      predicate: (q) => q.queryKey[0] !== 'catalog' && q.queryKey[0] !== 'easter-eggs',
    });
    setImportState({ kind: 'done', summary });
  }

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Definições</h1>

      <section className="card space-y-3 p-4" aria-labelledby="export-title">
        <h2 id="export-title" className="font-semibold">
          Exportar progresso
        </h2>
        <p className="text-sm text-zinc-400">
          Descarrega um ficheiro JSON com todo o teu progresso: camos, easter eggs, desafios e sessões. Guarda-o
          como backup.
        </p>
        <button type="button" onClick={handleExport} disabled={exporting} className="btn-primary">
          {exporting ? 'A exportar…' : 'Exportar JSON'}
        </button>
        {exportError && (
          <p role="alert" className="text-sm text-red-400">
            Não foi possível exportar: {exportError}
          </p>
        )}
      </section>

      <section className="card space-y-3 p-4" aria-labelledby="import-title">
        <h2 id="import-title" className="font-semibold">
          Importar progresso
        </h2>
        <p className="text-sm text-zinc-400">
          Repõe um backup exportado por esta app.{' '}
          <strong className="text-amber-300">Substitui todo o teu progresso atual</strong> pelo do ficheiro.
        </p>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          onChange={handleFile}
          className="sr-only"
          aria-label="Escolher ficheiro de backup"
        />
        <button type="button" onClick={() => fileInput.current?.click()} className="btn-secondary">
          Escolher ficheiro…
        </button>

        {importState.kind === 'invalid' && (
          <div role="alert" className="rounded-md border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">
            <p className="font-medium">Não é possível importar {importState.fileName}:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {importState.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        {(importState.kind === 'ready' || importState.kind === 'importing' || importState.kind === 'error') && (
          <div className="space-y-3 rounded-md border border-amber-800/60 bg-amber-950/30 p-3 text-sm">
            <p>
              <span className="font-medium">{importState.fileName}</span>, exportado em{' '}
              {formatDateTime(importState.summary.exportedAt)}:
            </p>
            <SummaryList summary={importState.summary} />
            <p className="text-amber-200">
              Ao importar, o teu progresso atual é apagado e substituído por este. Esta ação não se pode desfazer:
              exporta primeiro se quiseres guardar o estado atual.
            </p>
            {importState.kind === 'error' && (
              <p role="alert" className="text-red-400">
                Não foi possível importar: {importState.message}. O teu progresso não foi alterado.
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setImportState({ kind: 'idle' })}
                disabled={importState.kind === 'importing'}
                className="btn-secondary"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleImport(importState.fileName, importState.backup, importState.summary)}
                disabled={importState.kind === 'importing'}
                className="btn-primary bg-amber-600 hover:bg-amber-500 focus-visible:ring-amber-400"
              >
                {importState.kind === 'importing' ? 'A importar…' : 'Substituir e importar'}
              </button>
            </div>
          </div>
        )}

        {importState.kind === 'done' && (
          <div role="status" className="rounded-md border border-emerald-800 bg-emerald-950/40 p-3 text-sm text-emerald-100">
            <p className="font-medium">Progresso importado.</p>
            <SummaryList summary={importState.summary} />
          </div>
        )}
      </section>
    </section>
  );
}

function SummaryList({ summary }: { summary: BackupSummary }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-zinc-300 sm:grid-cols-3">
      <li>{summary.sessions} sessões</li>
      <li>
        {summary.unlockedCamos} camos desbloqueados ({summary.camoRows} com progresso)
      </li>
      <li>{summary.steps} passos de easter eggs</li>
      <li>{summary.completions} conclusões de easter eggs</li>
      <li>{summary.challenges} desafios</li>
    </ul>
  );
}
