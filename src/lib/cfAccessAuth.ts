/**
 * Cloudflare Access (SaaS OIDC) 登录封装,替代此前的 keycloak-js。
 *
 * Access 侧配置(ZT Dashboard > Access > Applications > SaaS application > OIDC):
 *   Issuer:      https://<team>.cloudflareaccess.com/cdn-cgi/access/sso/oidc/<client-id>
 *   Discovery:   {issuer}/.well-known/openid-configuration
 *   Authorization:{issuer}/authorization (浏览器前通道跳转,无 CORS 问题)
 *   Redirect URLs 里必须加上: https://blog.charlie-cloud.me/admin/callback/
 *   Scopes 建议: openid email profile
 *   Flow: Authorization Code + PKCE(公开 SPA,不需要 client_secret,不把它放前端)
 *
 * 注意:Access 的 /token 端点不返回 CORS 头,浏览器不能直调(会报 CORS blocked,
 * 真实错误也被盖住)。所以 code→token 交换与 refresh 统一走自家后端 BFF 代换:
 *   POST {PUBLIC_API_BASE}/auth/exchange {code, code_verifier, redirect_uri}
 *   POST {PUBLIC_API_BASE}/auth/refresh  {refresh_token}
 * 后端(blog_back_wasm/src/route/auth.rs)服务端代发请求,无 CORS 限制;如配了
 * CF_ACCESS_CLIENT_SECRET 还会自动升级为机密客户端模式。
 *
 * 前端只需要两个公开变量:
 *   PUBLIC_CF_ACCESS_TEAM_DOMAIN (例 https://xxx.cloudflareaccess.com,结尾不带 /)
 *   PUBLIC_CF_ACCESS_CLIENT_ID   (Access SaaS 应用的 Client ID,即 issuer 末段)
 */

export interface CfAccessConfig {
  teamDomain: string;
  clientId: string;
  issuer: string;
  authorizationEndpoint: string;
  redirectUri: string;
}

function apiBase(): string {
  const base =
    (import.meta as any).env?.PUBLIC_API_BASE || 'https://blog-api.charlie-cloud.me/api';
  return String(base).replace(/\/$/, '');
}

export function getCfAccessConfig(): CfAccessConfig | null {
  const env = (import.meta as any).env ?? {};
  const rawTeam: string = env.PUBLIC_CF_ACCESS_TEAM_DOMAIN || '';
  const clientId: string = env.PUBLIC_CF_ACCESS_CLIENT_ID || '';
  if (!rawTeam || !clientId) return null;
  const teamDomain = String(rawTeam).replace(/\/$/, '');
  const issuer = `${teamDomain}/cdn-cgi/access/sso/oidc/${clientId}`;
  const site: string = env.PUBLIC_SITE_URL || window.location.origin;
  const redirectUri = `${String(site).replace(/\/$/, '')}/admin/callback/`;
  return {
    teamDomain,
    clientId,
    issuer,
    authorizationEndpoint: `${issuer}/authorization`,
    redirectUri,
  };
}

// ---------- storage keys(保持 'token' = id_token,兼容现有 adminApi.ts) ----------
const K_ID_TOKEN = 'token';
const K_ACCESS_TOKEN = 'cf_access_token';
const K_REFRESH_TOKEN = 'cf_refresh_token';
const K_EXPIRES_AT = 'cf_expires_at';
const K_EMAIL = 'cf_email';
const K_VERIFIER = 'cf_pkce_verifier';
const K_STATE = 'cf_oauth_state';
const K_RETURN_TO = 'cf_return_to';

function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomString(len = 64): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return b64url(bytes);
}

async function pkceChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return b64url(new Uint8Array(digest));
}

/** 解 JWT payload(不验签,验签由后端 JWKS 完成) */
export function decodeJwtPayload(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(b64));
  } catch {
    return null;
  }
}

export function getStoredIdToken(): string | null {
  try {
    return localStorage.getItem(K_ID_TOKEN);
  } catch {
    return null;
  }
}

export function getStoredEmail(): string | null {
  try {
    return localStorage.getItem(K_EMAIL);
  } catch {
    return null;
  }
}

function isExpiredSoon(bufferSec = 60): boolean {
  try {
    const exp = Number(localStorage.getItem(K_EXPIRES_AT) || '0');
    if (!exp) {
      const t = getStoredIdToken();
      if (!t) return true;
      const p = decodeJwtPayload(t);
      if (!p?.exp) return false;
      return p.exp * 1000 - Date.now() < bufferSec * 1000;
    }
    return exp - Date.now() < bufferSec * 1000;
  } catch {
    return true;
  }
}

/** 发起登录:跳到 Access 授权页 */
export async function login(returnTo?: string): Promise<void> {
  const cfg = getCfAccessConfig();
  if (!cfg) throw new Error('Missing PUBLIC_CF_ACCESS_TEAM_DOMAIN / PUBLIC_CF_ACCESS_CLIENT_ID');
  const verifier = randomString(64);
  const challenge = await pkceChallenge(verifier);
  const state = randomString(32);
  sessionStorage.setItem(K_VERIFIER, verifier);
  sessionStorage.setItem(K_STATE, state);
  sessionStorage.setItem(K_RETURN_TO, returnTo || window.location.pathname + window.location.search);
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
  });
  window.location.href = `${cfg.authorizationEndpoint}?${params.toString()}`;
}

/** 用 refresh_token 换新 token(走后端 BFF 代换,成功返回 id_token) */
async function tryRefresh(): Promise<string | null> {
  const refreshToken = localStorage.getItem(K_REFRESH_TOKEN);
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${apiBase()}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) {
      clearTokens();
      return null;
    }
    const data = await res.json();
    if (data?.id_token) persistTokens(data);
    return data?.id_token ?? null;
  } catch {
    return null;
  }
}

function persistTokens(data: any): void {
  if (data.id_token) localStorage.setItem(K_ID_TOKEN, data.id_token);
  if (data.access_token) localStorage.setItem(K_ACCESS_TOKEN, data.access_token);
  if (data.refresh_token) localStorage.setItem(K_REFRESH_TOKEN, data.refresh_token);
  if (data.expires_in) localStorage.setItem(K_EXPIRES_AT, String(Date.now() + Number(data.expires_in) * 1000));
  const payload = data.id_token ? decodeJwtPayload(data.id_token) : null;
  const email = payload?.email || payload?.preferred_username || payload?.upn || '';
  if (email) localStorage.setItem(K_EMAIL, email);
}

export function clearTokens(): void {
  for (const k of [K_ID_TOKEN, K_ACCESS_TOKEN, K_REFRESH_TOKEN, K_EXPIRES_AT, K_EMAIL]) {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  }
}

/**
 * 处理授权回调 (?code= & state=)。成功返回登录后应回跳的地址。
 * code 换 token 走后端 BFF 代换(浏览器直调 Access /token 会被 CORS 拦掉)。
 */
export async function handleCallback(): Promise<string> {
  const cfg = getCfAccessConfig();
  if (!cfg) throw new Error('Missing Cloudflare Access env config');
  const qs = new URLSearchParams(window.location.search);
  const code = qs.get('code');
  const state = qs.get('state');
  const err = qs.get('error');
  if (err) throw new Error(`Access login failed: ${err} ${qs.get('error_description') || ''}`);
  if (!code) throw new Error('Missing code in callback');
  const expectState = sessionStorage.getItem(K_STATE);
  if (expectState && state && expectState !== state) throw new Error('State mismatch, login aborted');
  const verifier = sessionStorage.getItem(K_VERIFIER);
  if (!verifier) throw new Error('Missing PKCE verifier (session expired?), please login again');

  const res = await fetch(`${apiBase()}/auth/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      code_verifier: verifier,
      redirect_uri: cfg.redirectUri,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Token exchange failed: ${res.status} ${text.slice(0, 800)}`);
  }
  const data = await res.json();
  persistTokens(data);
  sessionStorage.removeItem(K_VERIFIER);
  sessionStorage.removeItem(K_STATE);
  const returnTo = sessionStorage.getItem(K_RETURN_TO) || '/admin/';
  sessionStorage.removeItem(K_RETURN_TO);
  return returnTo.startsWith('/') ? returnTo : '/admin/';
}

/** 拿一个可用的 id_token(未过期直接返回;快过期则尝试 refresh)。 */
export async function getValidIdToken(): Promise<string | null> {
  if (!getCfAccessConfig()) return null;
  const t = getStoredIdToken();
  if (!t) return null;
  if (!isExpiredSoon(60)) return t;
  return tryRefresh();
}

export function logout(): void {
  clearTokens();
}
