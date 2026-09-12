import { useEffect, useState } from 'react';
import { getCfAccessConfig, handleCallback } from '../../lib/cfAccessAuth';

/** /admin/callback/ 专用:完成 code→token 交换后跳回原管理页 */
export default function AuthCallback() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        if (!getCfAccessConfig()) throw new Error('Missing Cloudflare Access env config');
        if (!new URLSearchParams(window.location.search).get('code')) {
          window.location.href = '/admin/';
          return;
        }
        const returnTo = await handleCallback();
        window.location.href = returnTo;
      } catch (e: any) {
        setError(e?.message || 'Login failed');
      }
    })();
  }, []);

  if (error) {
    return (
      <div className="p-10 text-center space-y-4">
        <p className="text-error">Login failed: {error}</p>
        <p>
          <a href="/admin/" className="btn btn-primary btn-sm">
            Back to admin login
          </a>
        </p>
      </div>
    );
  }
  return (
    <div className="p-10 text-center">
      <span className="loading loading-spinner loading-lg" />
      <p className="mt-2 opacity-60">Completing Cloudflare Access login…</p>
    </div>
  );
}
