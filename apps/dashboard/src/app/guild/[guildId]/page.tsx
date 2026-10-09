'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

type GuildSettings = {
  id: string | null;
  locale: string;
  timezone: string;
  prefix: string | null;
  updatedAt: string | null;
};

type ApiError = { error?: { message?: string } };
const configuredApiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
const apiBase = (
  configuredApiBase ||
  (process.env.NODE_ENV === 'development' ? 'http://localhost:4000/api/v1' : '')
).replace(/\/$/, '');

const defaultSettings: GuildSettings = {
  id: null,
  locale: 'en-US',
  timezone: 'UTC',
  prefix: null,
  updatedAt: null,
};

async function readApiError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as ApiError;
  return body.error?.message ?? `Request failed (${response.status})`;
}

export default function GuildSettingsPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const [settings, setSettings] = useState<GuildSettings>(defaultSettings);
  const [prefix, setPrefix] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError('');
    if (!apiBase) {
      setError('NEXT_PUBLIC_API_BASE_URL must be configured for this deployment.');
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(`${apiBase}/guilds/${encodeURIComponent(guildId)}/settings`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(await readApiError(response));
      const body = (await response.json()) as { data: GuildSettings };
      setSettings(body.data);
      setPrefix(body.data.prefix ?? '');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load server settings.');
    } finally {
      setLoading(false);
    }
  }, [guildId]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const saveSettings = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSaved('');
    if (!apiBase) {
      setError('NEXT_PUBLIC_API_BASE_URL must be configured for this deployment.');
      setSaving(false);
      return;
    }

    try {
      const response = await fetch(`${apiBase}/guilds/${encodeURIComponent(guildId)}/settings`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locale: settings.locale,
          timezone: settings.timezone,
          prefix: prefix.trim() || null,
        }),
      });
      if (!response.ok) throw new Error(await readApiError(response));
      const body = (await response.json()) as { data: GuildSettings };
      setSettings(body.data);
      setPrefix(body.data.prefix ?? '');
      setSaved('Server settings saved.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save server settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="settings-page">
      <header className="settings-header">
        <a className="brand" href="/">
          <span className="brand-mark">V</span> VREEO
        </a>
        <a className="settings-back" href="/">
          ← Back to servers
        </a>
      </header>
      <section className="settings-content">
        <p className="eyebrow">SERVER CONFIGURATION</p>
        <h1>Server settings</h1>
        <p className="muted">Configure the basic defaults used by VREEO for this Discord server.</p>
        <div className="guild-id-chip">
          Server ID <code>{guildId}</code>
        </div>

        {loading ? (
          <div className="settings-card">
            <p className="muted">Loading settings and verifying server access…</p>
          </div>
        ) : (
          <form className="settings-card" onSubmit={saveSettings}>
            {error && (
              <div className="error-banner" role="alert">
                {error}
              </div>
            )}
            {saved && (
              <div className="success-banner" role="status">
                {saved}
              </div>
            )}
            <label className="settings-field">
              <span>Default locale</span>
              <select
                value={settings.locale}
                onChange={(event) =>
                  setSettings((current) => ({ ...current, locale: event.target.value }))
                }
                required
              >
                <option value="en-US">English (US)</option>
                <option value="id-ID">Bahasa Indonesia</option>
                <option value="en-GB">English (UK)</option>
                <option value="es-ES">Español</option>
                <option value="fr-FR">Français</option>
              </select>
              <small>Used for localized VREEO messages where supported.</small>
            </label>
            <label className="settings-field">
              <span>Time zone</span>
              <input
                value={settings.timezone}
                onChange={(event) =>
                  setSettings((current) => ({ ...current, timezone: event.target.value }))
                }
                placeholder="Asia/Jakarta"
                maxLength={64}
                required
              />
              <small>Use an IANA time zone, such as Asia/Jakarta or UTC.</small>
            </label>
            <label className="settings-field">
              <span>Legacy command prefix</span>
              <input
                value={prefix}
                onChange={(event) => setPrefix(event.target.value)}
                placeholder="!"
                maxLength={20}
              />
              <small>
                Optional. Slash commands remain the primary command interface in VREEO V1.
              </small>
            </label>
            <div className="settings-actions">
              <span className="muted">
                {settings.updatedAt
                  ? `Last saved ${new Date(settings.updatedAt).toLocaleString()}`
                  : 'Using default settings'}
              </span>
              <button className="settings-save" type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        )}
        <p className="settings-security">
          Changes are authorized against your current Discord Manage Server permissions and written
          to the audit log.
        </p>
      </section>
    </main>
  );
}
