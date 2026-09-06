import { siteUrl } from '../lib/api';

export const prerender = true;

export async function GET() {
  const site = siteUrl();
  const body = `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /search/?q=\nSitemap: ${site}/sitemap-index.xml\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
