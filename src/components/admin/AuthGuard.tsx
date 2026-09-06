import Keycloak from 'keycloak-js';
import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * 后台鉴权守卫(旧站 AuthContext + ProtectedRoute 的 Astro 移植)。
 * client:only 使用,不参与 SSG,不影响 SEO。
 */
export default function AuthGuard({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'authed' | 'unauthed'>('loading');
  const [kc, setKc] = useState<any>(null);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    const url = (import.meta as any).env?.PUBLIC_KEYCLOAK_URL;
    const realm = (import.meta as any).env?.PUBLIC_KEYCLOAK_REALM;
    const clientId = (import.meta as any).env?.PUBLIC_KEYCLOAK_CLIENT_ID;
    if (!url || !realm || !clientId) {
      console.error('Keycloak env missing');
      setStatus('unauthed');
      return;
    }
    const keycloak: any = new Keycloak({ url, realm, clientId });
    setKc(keycloak);
    keycloak
      .init({ pkceMethod: 'S256', checkLoginIframe: false })
      .then((auth: boolean) => {
        if (auth) {
          if (keycloak.token) localStorage.setItem('token', keycloak.token);
          setStatus('authed');
        } else {
          setStatus('unauthed');
        }
      })
      .catch((e: unknown) => {
        console.error('Keycloak init failed', e);
        setStatus('unauthed');
      });
    keycloak.onTokenExpired = () => {
      keycloak
        .updateToken(30)
        .then((ok: boolean) => {
          if (ok && keycloak.token) localStorage.setItem('token', keycloak.token);
        })
        .catch(() => {
          localStorage.removeItem('token');
          keycloak.logout();
        });
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

  if (status === 'unauthed') {
    return (
      <div className="p-10 text-center space-y-4">
        <p>Admin area requires login.</p>
        <button
          className="btn btn-primary"
          onClick={() => kc?.login?.()}
        >
          Login with Keycloak
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
      <div className="flex justify-end mb-4">
        <button
          className="btn btn-sm btn-ghost"
          onClick={() => {
            localStorage.removeItem('token');
            kc?.logout?.();
          }}
        >
          Logout
        </button>
      </div>
      {children}
    </div>
  );
}
