'use client';

import { useCallback, useEffect, useState } from 'react';

type DashboardUser = {
  id: string;
  discordUserId: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  locale: string | null;
};

type ApiError = { error?: { message?: string } };
type DashboardGuild = {
  id: string;
  name: string;
  iconUrl: string | null;
  owner: boolean;
  botInstalled: boolean;
};
const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1').replace(
  /\/$/,
  '',
);

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    credentials: 'include',
    headers: { Accept: 'application/json', ...init?.headers },
    cache: 'no-store',
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ApiError;
    throw new Error(body.error?.message ?? `Request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

const modules = [
  {
    icon: '🛡️',
    name: 'Moderation',
    description: 'Cases, warnings, timeouts and ban workflows.',
    state: 'Foundation planned',
  },
  {
    icon: '🧾',
    name: 'Audit logs',
    description: 'A traceable history of important server actions.',
    state: 'Foundation planned',
  },
  {
    icon: '🎫',
    name: 'Tickets',
    description: 'Private support channels and staff workflows.',
    state: 'Foundation planned',
  },
  {
    icon: '🧰',
    name: 'Auto moderation',
    description: 'Configurable rules for safer communities.',
    state: 'Foundation planned',
  },
  {
    icon: '👋',
    name: 'Welcome & roles',
    description: 'Member onboarding and role automation.',
    state: 'Foundation planned',
  },
  {
    icon: '⚙️',
    name: 'Server settings',
    description: 'Configure VREEO features per Discord server.',
    state: 'Foundation planned',
  },
];

export default function HomePage() {
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [guilds, setGuilds] = useState<DashboardGuild[]>([]);
  const [guildsLoading, setGuildsLoading] = useState(false);

  const loadUser = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiRequest<{ data: DashboardUser }>('/auth/me');
      setUser(response.data);
      setGuildsLoading(true);
      try {
        const guildResponse = await apiRequest<{ data: DashboardGuild[] }>('/guilds');
        setGuilds(guildResponse.data);
      } catch (cause) {
        setGuilds([]);
        setError(cause instanceof Error ? cause.message : 'Could not load Discord servers.');
      } finally {
        setGuildsLoading(false);
      }
    } catch (cause) {
      setUser(null);
      setGuilds([]);
      const message = cause instanceof Error ? cause.message : 'Could not reach the VREEO API.';
      if (!message.toLowerCase().includes('sign in')) setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  const signOut = async () => {
    setBusy(true);
    setError('');
    try {
      await apiRequest<void>('/auth/logout', { method: 'POST' });
      setUser(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign out failed.');
    } finally {
      setBusy(false);
    }
  };

  const startLogin = () => {
    window.location.assign(`${apiBase}/auth/discord`);
  };

  if (loading) {
    return (
      <main className="center-screen">
        <div className="loading-mark">V</div>
        <p>Connecting to VREEO…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="login-layout">
        <section className="login-copy">
          <div className="brand">
            <span className="brand-mark">V</span> VREEO
          </div>
          <div className="eyebrow">THE DISCORD MANAGEMENT PLATFORM</div>
          <h1>
            Your community.
            <br />
            <span>Under control.</span>
          </h1>
          <p className="lead">
            One connected platform for managing, protecting, and growing your Discord communities.
          </p>
          <div className="login-points">
            <div>
              <span>01</span>
              <p>One dashboard for your servers</p>
            </div>
            <div>
              <span>02</span>
              <p>Security-minded access and controls</p>
            </div>
            <div>
              <span>03</span>
              <p>Modular tools that grow with your community</p>
            </div>
          </div>
          <p className="legal">VREEO V1 · Built for Discord communities · No AI module in V1</p>
        </section>
        <section className="login-card">
          <div className="card-orb" aria-hidden="true">
            ✦
          </div>
          <p className="eyebrow">GET STARTED</p>
          <h2>Welcome to VREEO</h2>
          <p className="muted">Sign in with Discord to access your community workspace.</p>
          {error && (
            <div className="error-banner" role="alert">
              {error}
            </div>
          )}
          <button className="discord-button" onClick={startLogin}>
            {' '}
            <span className="discord-icon">◉</span> Continue with Discord{' '}
            <span aria-hidden="true">↗</span>
          </button>
          <p className="security-note">
            <span>●</span> Secure sign-in using Discord OAuth2
          </p>
          <button className="text-button" onClick={() => void loadUser()}>
            Retry connection
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="app-layout">
      <aside className="sidebar">
        <a className="brand" href="#">
          <span className="brand-mark">V</span> VREEO
        </a>
        <p className="nav-label">WORKSPACE</p>
        <a className="nav-item active" href="#overview">
          ▦ <span>Overview</span>
        </a>
        <a className="nav-item" href="#servers">
          ◈ <span>My servers</span>
        </a>
        <p className="nav-label">PLATFORM</p>
        <a className="nav-item" href="#modules">
          ◫ <span>Feature modules</span>
        </a>
        <a className="nav-item" href="#account">
          ◎ <span>Account</span>
        </a>
        <div className="sidebar-bottom">
          <div className="user-chip">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" />
            ) : (
              <span className="avatar-fallback">
                {(user.displayName ?? user.username ?? 'V').slice(0, 1).toUpperCase()}
              </span>
            )}
            <div>
              <strong>{user.displayName ?? user.username ?? 'Discord user'}</strong>
              <small>Discord account</small>
            </div>
          </div>
          <button className="signout-button" onClick={() => void signOut()} disabled={busy}>
            {busy ? 'Signing out…' : 'Sign out ↗'}
          </button>
        </div>
      </aside>
      <section className="dashboard-content" id="overview">
        <header className="topbar">
          <div>
            <span className="breadcrumb">Workspace /</span> Overview
          </div>
          <div className="connected">
            <span /> Account connected
          </div>
        </header>
        <div className="welcome-row">
          <div>
            <p className="eyebrow">YOUR CONTROL CENTER</p>
            <h1>Welcome back, {user.displayName ?? user.username ?? 'there'}.</h1>
            <p className="muted">
              Your VREEO workspace starts here. Choose a server to configure its modules.
            </p>
          </div>
          <div className="welcome-symbol">V</div>
        </div>
        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}
        <section className="stats-grid" aria-label="Workspace status">
          <article className="stat-card">
            <span className="stat-icon">◈</span>
            <p>Connected account</p>
            <strong>Discord</strong>
            <small>Identity verified</small>
          </article>
          <article className="stat-card">
            <span className="stat-icon">⌘</span>
            <p>Platform status</p>
            <strong>Foundation</strong>
            <small>Core services in development</small>
          </article>
          <article className="stat-card">
            <span className="stat-icon">⚡</span>
            <p>AI in V1</p>
            <strong>Not included</strong>
            <small>As defined in the VREEO plan</small>
          </article>
        </section>
        <section className="section-heading" id="servers">
          <div>
            <p className="eyebrow">SERVER MANAGEMENT</p>
            <h2>Your Discord servers</h2>
            <p className="muted">
              Only servers where your Discord account has Manage Server or Administrator access are
              listed.
            </p>
          </div>
          <span className="pill">{guilds.length} available</span>
        </section>
        {guildsLoading ? (
          <div className="empty-server">
            <div className="empty-icon">◈</div>
            <h3>Loading your servers…</h3>
            <p>VREEO is checking your Discord access and bot membership.</p>
          </div>
        ) : guilds.length === 0 ? (
          <div className="empty-server">
            <div className="empty-icon">◈</div>
            <h3>No manageable servers found</h3>
            <p>
              Make sure you own a server or have Manage Server / Administrator permissions, then
              reconnect Discord if you changed OAuth access.
            </p>
          </div>
        ) : (
          <div className="guild-grid">
            {guilds.map((guild) => (
              <article className="guild-card" key={guild.id}>
                {guild.iconUrl ? (
                  <img className="guild-avatar" src={guild.iconUrl} alt="" />
                ) : (
                  <div className="guild-avatar guild-fallback">
                    {guild.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="guild-details">
                  <h3>{guild.name}</h3>
                  <p>{guild.owner ? 'Server owner' : 'Manage Server access'}</p>
                  <span className={guild.botInstalled ? 'guild-state installed' : 'guild-state'}>
                    {guild.botInstalled ? '● Bot connected' : '○ Bot not connected'}
                  </span>
                </div>
                {guild.botInstalled ? (
                  <a
                    className="guild-action"
                    href={`#modules`}
                    aria-label={`Open modules for ${guild.name}`}
                  >
                    Open ↗
                  </a>
                ) : (
                  <a
                    className="guild-action"
                    href={
                      process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID
                        ? `https://discord.com/oauth2/authorize?client_id=${encodeURIComponent(process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID)}&permissions=1099511712838&scope=bot%20applications.commands&guild_id=${encodeURIComponent(guild.id)}&disable_guild_select=true`
                        : 'https://discord.com/developers/applications'
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    Add bot ↗
                  </a>
                )}
              </article>
            ))}
          </div>
        )}
        <section className="section-heading" id="modules">
          <div>
            <p className="eyebrow">MODULAR TOOLKIT</p>
            <h2>Platform modules</h2>
            <p className="muted">
              Module cards reflect planned areas; they are not presented as active features yet.
            </p>
          </div>
        </section>
        <div className="module-grid">
          {modules.map((module) => (
            <article className="module-card" key={module.name}>
              <span className="module-icon">{module.icon}</span>
              <h3>{module.name}</h3>
              <p>{module.description}</p>
              <span className="module-state">{module.state}</span>
            </article>
          ))}
        </div>
        <footer className="dashboard-footer">
          VREEO · Discord management platform <span>AI is not part of V1</span>
        </footer>
      </section>
    </main>
  );
}
