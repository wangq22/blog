import { marked } from 'marked';
import hljs from 'highlight.js';

/**
 * 构建时把后端返回的 markdown 转为 HTML(SSG,爬虫可见)。
 * 保持与旧站 react-markdown + remark-gfm + rehype-highlight 观感一致。
 */
marked.setOptions({ gfm: true, breaks: true });

const renderer = {
  code({ text, lang }: { text: string; lang?: string }) {
    let highlighted: string;
    try {
      highlighted = lang && hljs.getLanguage(lang)
        ? hljs.highlight(text, { language: lang }).value
        : hljs.highlightAuto(text).value;
    } catch {
      highlighted = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }
    const cls = lang ? `hljs language-${lang}` : 'hljs';
    return `<pre><code class="${cls}">${highlighted}</code></pre>\n`;
  },
  // 图片默认懒加载 + 异步解码(性能优化,不影响 SEO)
  image({ href, title, text }: { href: string; title?: string | null; text: string }) {
    const t = title ? ` title="${title}"` : '';
    return `<img src="${href}" alt="${text || ''}"${t} loading="lazy" decoding="async" />`;
  },
  // 外链加 rel(安全),标题锚点加 id(SEO/可分享)
  link({ href, title, text }: { href: string; title?: string | null; text: string }) {
    const isExternal = /^https?:\/\//.test(href || '');
    const rel = isExternal ? ' rel="noopener noreferrer"' : '';
    const target = isExternal ? ' target="_blank"' : '';
    const t = title ? ` title="${title}"` : '';
    return `<a href="${href}"${t}${rel}${target}>${text}</a>`;
  },
  heading({ tokens, depth }: any) {
    const text = this.parser.parseInline(tokens);
    const slug = String(text)
      .toLowerCase()
      .replace(/<[^>]+>/g, '')
      .replace(/[^\w\u4e00-\u9fa5\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 80);
    return `<h${depth} id="${slug}"><a href="#${slug}" aria-hidden="true" class="heading-anchor">#</a> ${text}</h${depth}>\n`;
  },
} as any;

marked.use({ renderer } as any);

export function renderMarkdown(md: string): string {
  if (!md) return '';
  return marked.parse(md) as string;
}

/** 从 markdown/excerpt 生成干净的 description(150-160 字符最佳) */
export function toDescription(excerpt?: string, content?: string, maxLen = 160): string {
  const raw = (excerpt?.trim() || content?.replace(/[#>*`\[\]\(\)!-]/g, '').trim() || '').replace(
    /\s+/g,
    ' ',
  );
  if (raw.length <= maxLen) return raw;
  return `${raw.slice(0, maxLen - 1).trim()}…`;
}
