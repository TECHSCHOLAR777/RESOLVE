import { useEffect, useId, useState, type ReactNode } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useSettings, getThemePreference, setThemePreference, type ThemePreference, type ViewMode } from '../../lib/settings';
import { clearRuns, useHistory } from '../../lib/history';
import PageHeader, { focusRing } from './PageHeader';

function Group({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-card shadow-sm">
      <header className="border-b border-line-soft px-5 py-3.5">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      </header>
      <div className="divide-y divide-line-soft">{children}</div>
    </section>
  );
}

function Row({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <label id={id} className="text-sm font-medium text-ink">
          {label}
        </label>
        {hint && <p className="mt-0.5 max-w-md text-xs text-muted">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Switch({ checked, onChange, labelledBy }: { checked: boolean; onChange: (v: boolean) => void; labelledBy: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 cursor-pointer rounded-full transition-colors ${focusRing} ${checked ? 'bg-[#2563EB]' : 'bg-line-strong'}`}
    >
      <span
        aria-hidden
        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`}
      />
    </button>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  labelledBy,
}: {
  value: T;
  options: { id: T; label: string; icon?: ReactNode }[];
  onChange: (v: T) => void;
  labelledBy: string;
}) {
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="inline-flex rounded-lg border border-line bg-sunken p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors ${focusRing} ${
            value === o.id ? 'bg-card text-ink shadow-sm' : 'text-muted hover:text-ink'
          }`}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

const btn = `inline-flex h-9 cursor-pointer items-center rounded-lg border border-line bg-raised px-3.5 text-sm font-medium text-body transition-colors hover:border-line-strong hover:text-ink ${focusRing}`;

export default function SettingsPage() {
  const uid = useId();
  const { settings, update, reset } = useSettings();
  const history = useHistory();
  const [theme, setTheme] = useState<ThemePreference>(() => getThemePreference());
  const [layerDraft, setLayerDraft] = useState(settings.defaultLayer);
  const [confirm, setConfirm] = useState<null | 'history' | 'reset'>(null);

  useEffect(() => setLayerDraft(settings.defaultLayer), [settings.defaultLayer]);

  const chooseTheme = (t: ThemePreference) => {
    setThemePreference(t);
    setTheme(t);
  };
  const id = (s: string) => `${uid}-${s}`;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <PageHeader title="Settings" subtitle="Preferences are stored in this browser and applied the next time a view opens." />

      <div className="mt-6 flex flex-col gap-5">
        <Group title="Appearance">
          <Row id={id('theme')} label="Theme" hint="System follows your operating system setting.">
            <Segmented<ThemePreference>
              labelledBy={id('theme')}
              value={theme}
              onChange={chooseTheme}
              options={[
                { id: 'light', label: 'Light', icon: <Sun size={13} aria-hidden /> },
                { id: 'dark', label: 'Dark', icon: <Moon size={13} aria-hidden /> },
                { id: 'system', label: 'System', icon: <Monitor size={13} aria-hidden /> },
              ]}
            />
          </Row>
        </Group>

        <Group title="Viewer">
          <Row id={id('view')} label="Default view mode" hint="Auto shows input and output stacked or side by side depending on the screen. Split uses a swipe slider.">
            <Segmented<ViewMode>
              labelledBy={id('view')}
              value={settings.viewMode}
              onChange={(v) => update({ viewMode: v })}
              options={[
                { id: 'auto', label: 'Stacked / side by side' },
                { id: 'split', label: 'Split slider' },
              ]}
            />
          </Row>
          <Row id={id('layer')} label="Default layer" hint="Layer id shown first after a run, for example output, confidence or ndvi. Unknown ids fall back to the output image.">
            <input
              aria-labelledby={id('layer')}
              value={layerDraft}
              onChange={(e) => setLayerDraft(e.target.value)}
              onBlur={() => update({ defaultLayer: layerDraft.trim() || 'output' })}
              onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
              spellCheck={false}
              className={`h-9 w-44 rounded-lg border border-line bg-card px-3 font-mono text-sm text-ink ${focusRing}`}
            />
          </Row>
          <Row id={id('labels')} label="Show corner labels" hint="Input and output captions on the image viewer.">
            <Switch labelledBy={id('labels')} checked={settings.showCornerLabels} onChange={(v) => update({ showCornerLabels: v })} />
          </Row>
        </Group>

        <Group title="Processing">
          <Row id={id('auto')} label="Return to workspace when done" hint="Leave the live processing page automatically once a run finishes.">
            <Switch labelledBy={id('auto')} checked={settings.autoReturnToWorkspace} onChange={(v) => update({ autoReturnToWorkspace: v })} />
          </Row>
          <Row id={id('log')} label="Expand telemetry log" hint="Show the processing log open by default.">
            <Switch labelledBy={id('log')} checked={settings.telemetryExpanded} onChange={(v) => update({ telemetryExpanded: v })} />
          </Row>
        </Group>

        <Group title="Data">
          <Row id={id('hist')} label="Run history" hint={`${history.length} ${history.length === 1 ? 'entry' : 'entries'} stored in this browser.`}>
            <button type="button" className={btn} disabled={history.length === 0} onClick={() => setConfirm('history')}>
              Clear history
            </button>
          </Row>
          <Row id={id('reset')} label="Reset settings" hint="Restore the defaults on this page. Theme is also set back to System.">
            <button type="button" className={btn} onClick={() => setConfirm('reset')}>
              Reset settings
            </button>
          </Row>
        </Group>
      </div>

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setConfirm(null)}>
          <div role="alertdialog" aria-modal="true" aria-label="Confirm" onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-xl border border-line bg-card p-5 shadow-xl">
            <h2 className="text-base font-semibold text-ink">{confirm === 'history' ? 'Clear run history?' : 'Reset all settings?'}</h2>
            <p className="mt-1.5 text-sm text-muted">
              {confirm === 'history' ? `This removes ${history.length} stored ${history.length === 1 ? 'entry' : 'entries'} from this browser.` : 'All preferences return to their defaults.'}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" autoFocus className={btn} onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={`h-9 cursor-pointer rounded-lg bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 ${focusRing}`}
                onClick={() => {
                  if (confirm === 'history') clearRuns();
                  else {
                    reset();
                    chooseTheme('system');
                  }
                  setConfirm(null);
                }}
              >
                {confirm === 'history' ? 'Clear history' : 'Reset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
