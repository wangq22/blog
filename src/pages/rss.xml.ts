import { fetchAllPosts, absoluteUrl, siteName, postUrl } from '../lib/api';
import { toDescription } from '../lib/markdown';

export const prerender = true;

export async function GET() {
  const name = siteName();
  let posts: Awaited<ReturnType<typeof fetchAllPosts>> = [];
  try {
    posts = await fetchAllPosts(50);
  } catch {
    posts = [];
  }
  const sorted = [...posts].sort((a, b) => +new Date(b.date) - +new Date(a.date)).slice(0, 50);
  const items = sorted
    .map((p) => {
      const link = absoluteUrl(postUrl(p));
      const desc = toDescription(p.excerpt, undefined).replace(/&/g, '&amp;').replace(/</g, '&lt;');
      const title = p.title.replace(/&/g, '&amp;').replace(/</g, '&lt;');
      const pubDate = new Date(p.date).toUTCString();
      return `    <item>\n      <title>${title}</title>\n      <link>${link}</link>\n      <guid>${link}</guid>\n      <pubDate>${pubDate}</pubDate>\n      <description>${desc}</description>\n${(p.tags || []).map((t) => `      <category>${String(t).replace(/</g, '&lt;')}</category>`).join('\n')}\n    </item>`;
    })
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n  <channel>\n    <title>${name}</title>\n    <link>${absoluteUrl('/')}</link>\n    <description>Latest articles from ${name}</description>\n    <language>en</language>\n${items}\n  </channel>\n</rss>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
