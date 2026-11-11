import { SESSION_MODES, type SessionMode } from '@bo4/shared';
import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { describeError } from '../../lib/errors';
import { SESSION_MODE_LABELS } from '../../lib/labels';
import type { Catalog, WeaponRow } from '../catalog/queries';
import type { SessionWithStats } from './queries';
import {
  parseSessionForm,
  type FieldErrors,
  type RecordSessionPayload,
  type SessionFormValues,
} from './sessionSchema';
import { WeaponPicker } from './WeaponPicker';

export function emptySessionValues(defaults: Pick<SessionFormValues, 'mapId' | 'mode' | 'players'>): SessionFormValues {
  return { ...defaults, round: '', notes: '', weapons: [] };
}

/** Valores do formulário a partir de uma sessão guardada (para editar). */
export function sessionToFormValues(session: SessionWithStats): SessionFormValues {
  const mode = SESSION_MODES.find((m) => m === session.mode) ?? 'normal';
  return {
    mapId: session.map_id,
    mode,
    players: String(session.players),
    round: String(session.round_reached),
    notes: session.notes ?? '',
    weapons: session.session_weapon_stats.map((s) => ({
      weaponId: s.weapon_id,
      kills: String(s.kills),
      headshots: String(s.headshots),
    })),
  };
}

interface Props {
  catalog: Catalog;
  initialValues: SessionFormValues;
  submitLabel: string;
  pendingLabel: string;
  onSubmit: (payload: RecordSessionPayload) => Promise<void>;
  /** Depois de gravar, limpa ronda/armas/notas mas mantém mapa, modo e jogadores. */
  resetOnSuccess?: boolean;
  /** Chamado em cada alteração (ex.: para esconder a mensagem "gravada"). */
  onEdit?: () => void;
  footer?: ReactNode;
}

export function SessionForm({
  catalog,
  initialValues,
  submitLabel,
  pendingLabel,
  onSubmit,
  resetOnSuccess = false,
  onEdit,
  footer,
}: Props) {
  const [values, setValues] = useState<SessionFormValues>(initialValues);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);

  const chosen = useMemo(() => new Set(values.weapons.map((w) => w.weaponId)), [values.weapons]);

  function update<K extends keyof SessionFormValues>(key: K, value: SessionFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    onEdit?.();
  }

  function addWeapon(weapon: WeaponRow) {
    update('weapons', [...values.weapons, { weaponId: weapon.id, kills: '', headshots: '' }]);
    setLastAdded(weapon.id);
  }

  function updateWeapon(index: number, field: 'kills' | 'headshots', value: string) {
    update(
      'weapons',
      values.weapons.map((w, i) => (i === index ? { ...w, [field]: value } : w)),
    );
  }

  function removeWeapon(index: number) {
    update(
      'weapons',
      values.weapons.filter((_, i) => i !== index),
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const parsed = parseSessionForm(values);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }
    setErrors({});
    setSubmitError(null);
    setPending(true);
    try {
      await onSubmit(parsed.payload);
      if (resetOnSuccess) {
        setValues((v) => emptySessionValues({ mapId: v.mapId, mode: v.mode, players: v.players }));
        setLastAdded(null);
      }
    } catch (error) {
      setSubmitError(error);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Mapa" error={errors.mapId}>
          <select value={values.mapId} onChange={(e) => update('mapId', e.target.value)} className="input">
            {catalog.maps.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Modo" error={errors.mode}>
          <select
            value={values.mode}
            onChange={(e) => update('mode', e.target.value as SessionMode)}
            className="input"
          >
            {SESSION_MODES.map((m) => (
              <option key={m} value={m}>
                {SESSION_MODE_LABELS[m]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Ronda alcançada" error={errors.round}>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={values.round}
            onChange={(e) => update('round', e.target.value)}
            className="input"
            autoFocus
          />
        </Field>

        <fieldset>
          <legend className="text-sm text-zinc-300">Jogadores</legend>
          <div className="mt-1 grid grid-cols-4 gap-1" role="radiogroup">
            {['1', '2', '3', '4'].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={values.players === n}
                onClick={() => update('players', n)}
                className={`rounded-md border py-2 text-sm transition-colors ${
                  values.players === n
                    ? 'border-emerald-600 bg-emerald-600/20 text-emerald-100'
                    : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-zinc-100'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          {errors.players && <p className="mt-1 text-xs text-red-400">{errors.players}</p>}
        </fieldset>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-zinc-300">Armas usadas</h2>
        <WeaponPicker weapons={catalog.weapons} exclude={chosen} onPick={addWeapon} />

        {values.weapons.length > 0 ? (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-zinc-400">
                <tr>
                  <th className="px-3 py-2 font-medium">Arma</th>
                  <th className="w-24 px-2 py-2 font-medium">Kills</th>
                  <th className="w-24 px-2 py-2 font-medium">Headshots</th>
                  <th className="w-10" aria-label="Remover" />
                </tr>
              </thead>
              <tbody>
                {values.weapons.map((row, i) => {
                  const name = catalog.weaponsById.get(row.weaponId)?.name ?? row.weaponId;
                  const rowErrors = [
                    errors[`weapons.${i}.kills`],
                    errors[`weapons.${i}.headshots`],
                    errors[`weapons.${i}.weaponId`],
                  ].filter(Boolean);
                  return (
                    <tr key={row.weaponId} className="border-t border-zinc-800 align-top">
                      <td className="px-3 py-2">
                        {name}
                        {rowErrors.map((msg) => (
                          <p key={msg} className="text-xs text-red-400">
                            {msg}
                          </p>
                        ))}
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          aria-label={`Kills com ${name}`}
                          value={row.kills}
                          onChange={(e) => updateWeapon(i, 'kills', e.target.value)}
                          autoFocus={row.weaponId === lastAdded}
                          className="input px-2 py-1.5"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          aria-label={`Headshots com ${name}`}
                          value={row.headshots}
                          onChange={(e) => updateWeapon(i, 'headshots', e.target.value)}
                          className="input px-2 py-1.5"
                        />
                      </td>
                      <td className="px-1 py-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => removeWeapon(i)}
                          aria-label={`Remover ${name}`}
                          className="rounded-md px-2 py-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-zinc-500">
            Opcional. As kills e headshots de cada arma somam aos contadores de camos.
          </p>
        )}
      </div>

      <Field label="Notas (opcional)" error={errors.notes}>
        <textarea rows={2} value={values.notes} onChange={(e) => update('notes', e.target.value)} className="input" />
      </Field>

      {submitError != null && (
        <p role="alert" className="text-sm text-red-400">
          Não foi possível gravar a sessão: {describeError(submitError)}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary w-full sm:w-auto">
          {pending ? pendingLabel : submitLabel}
        </button>
        {footer}
      </div>
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="text-zinc-300">{label}</span>
      <span className="mt-1 block">{children}</span>
      {error && <span className="mt-1 block text-xs text-red-400">{error}</span>}
    </label>
  );
}
