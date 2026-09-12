import { useEffect, useState, type ReactNode } from 'react';
import {
  getCfAccessConfig,
  getStoredEmail,
  getValidIdToken,
  handleCallback,
  login,
  logout,
} from '../../lib/cfAccessAuth';

/**
 * 后台鉴权守卫:Cloudflare Access SaaS OIDC(Authorization Code + PKCE)。
 * client:only 使用,不参与 SSG,不影响 SEO。
 * token 存 localStorage 'token'(= Access id_token),adminApi.ts 直接沿用。
 */
export default function AuthGuard({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'authed' | 'unauthed' | 'misconfig'>('loading');
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cfg = getCfAccessConfig();
      if (!cfg) {
        setStatus('misconfig');
        return;
      }
      const qs = new URLSearchParams(window.location.search);
      // Access 回调可能落到任意 /admin/* 页,统一在此处理 code
      if (qs.get('code')) {
        try {
          const returnTo = await handleCallback();
          if (cancelled) return;
          setEmail(getStoredEmail());
          setStatus('authed');
          // 洗掉地址栏里的 code/state
          window.history.replaceState({}, '', window.location.pathname);
          if (returnTo && returnTo !== window.location.pathname) {
            window.location.href = returnTo;
          }
        } catch (e: any) {
          if (!cancelled) {
            setError(e?.message || 'Login callback failed');
            setStatus('unauthed');
          }
        }
        return;
      }
      const token = await getValidIdToken();
      if (cancelled) return;
      if (token) {
        setEmail(getStoredEmail());
        setStatus('authed');
      } else {
        setStatus('unauthed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === 'loading') {
    return (
      <div className="p-10 text-center">
        <span className="loading loading-spinner loading-lg" />
        <p className="mt-2 opacity-60">Checking login…</p>
      </div>
    );
  }

  if (status === 'misconfig') {
    return (
      <div className="p-10 text-center space-y-4">
        <p className="font-semibold">Admin login is not configured.</p>
        <p className="text-sm opacity-60">
          Missing <code>PUBLIC_CF_ACCESS_TEAM_DOMAIN</code> /{' '}
          <code>PUBLIC_CF_ACCESS_CLIENT_ID</code>. Check <code>.env</code>.
        </p>
        <p>
          <a href="/" className="link link-hover text-sm">
            ← Back to blog
          </a>
        </p>
      </div>
    );
  }

  if (status === 'unauthed') {
    return (
      <div className="p-10 text-center space-y-4">
        <p>Admin area requires login.</p>
        {error && <p className="text-sm text-error">{error}</p>}
        <button className="btn btn-primary" onClick={() => login()}>
          Login with Cloudflare Access
        </button>
        <p>
          <a href="/" className="link link-hover text-sm">
            ← Back to blog
          </a>
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-end items-center gap-3 mb-4">
        {email && <span className="text-sm opacity-60">{email}</span>}
        <button
          className="btn btn-sm btn-ghost"
          onClick={() => {
            logout();
            window.location.href = '/admin/';
          }}
        >
          Logout
        </button>
      </div>
      {children}
    </div>
  );
}
