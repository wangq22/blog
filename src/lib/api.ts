// 与旧 React 前端 + Rust 后端保持一致的类型与接口
// 后端: https://blog-api.charlie-cloud.me/api (见 blog_back_wasm/src/route/*)

export interface PostPreview {
  _id?: string | number;
  title: string;
  excerpt: string;
  date: string;
  category: string;
  tags: string[];
  cover_image: string;
  // R2 keys(新文章);老文章为空,回退 cover_image/content
  content_key?: string | null;
  cover_key?: string | null;
  word_count: number;
  read_time: number;
}

export interface PostDetail extends PostPreview {
  content: string;
  author: string;
}

export interface PageMeta {
  page: number;
  page_size: number;
  total?: number;
  total_pages?: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}

export interface UserProfile {
  name: string;
  bio: string;
  avatar_url: string;
  github_url?: string;
  bilibili_url?: string;
}

export interface Tag {
  name: string;
  color_class: string;
  description?: string;
}

export interface Category {
  name: string;
  post_count: number;
  description?: string;
}

function apiBase(): string {
  // 构建时可用 import.meta.env,也兼容 process.env(astro.config 传参)
  const base =
    import.meta.env.PUBLIC_API_BASE ||
    (typeof process !== 'undefined' ? (process.env as any).PUBLIC_API_BASE : '') ||
    'https://blog-api.charlie-cloud.me/api';
  return String(base).replace(/\/$/, '');
}

export function siteUrl(): string {
  const s =
    import.meta.env.PUBLIC_SITE_URL ||
    (typeof process !== 'undefined' ? (process.env as any).PUBLIC_SITE_URL : '') ||
    'https://blog.charlie-cloud.me';
  return String(s).replace(/\/$/, '');
}

export function siteName(): string {
  return (
    import.meta.env.PUBLIC_SITE_NAME ||
    (typeof process !== 'undefined' ? (process.env as any).PUBLIC_SITE_NAME : '') ||
    "Charlie Wang's Blog"
  );
}

async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    headers: { Accept: 'application/json' },
    ...init,
  });
  if (!res.ok) {
    throw new Error(`API ${path} failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

/** 兼容后端 tags 可能是 JSON 字符串的情况 */
function normalizeTags(input: any): string[] {
  if (Array.isArray(input)) return input.map(String);
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      // fallthrough
    }
    return input
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizePost<T extends PostPreview>(p: T): T {
  return { ...p, tags: normalizeTags((p as any).tags) };
}

export async function fetchUserProfile(): Promise<UserProfile> {
  try {
    return await getJson<UserProfile>('/user');
  } catch {
    return {
      name: "Charlie Wang's Blog",
      bio: '',
      avatar_url: '/icon-512.png',
    };
  }
}

export async function fetchPostList(page = 1, page_size = 10): Promise<Paginated<PostPreview>> {
  const raw = await getJson<Paginated<PostPreview>>(
    `/posts?page=${page}&page_size=${page_size}`,
  );
  return { ...raw, data: (raw.data ?? []).map(normalizePost) };
}

/** 分页拉全量(后端 meta 没有 total,只能翻页到不足一页为止) */
export async function fetchAllPosts(page_size = 50): Promise<PostPreview[]> {
  const all: PostPreview[] = [];
  let page = 1;
  for (let i = 0; i < 50; i++) {
    const res = await fetchPostList(page, page_size);
    if (!res.data.length) break;
    all.push(...res.data);
    if (res.data.length < page_size) break;
    // 后端若返回 total_pages 则提前收敛
    if (res.meta?.total_pages && page >= res.meta.total_pages) break;
    page += 1;
  }
  return all;
}

export async function fetchPostById(id: string | number): Promise<PostDetail> {
  const raw = await getJson<PostDetail>(`/post/${id}`);
  return normalizePost(raw);
}

export async function fetchArchive(params?: { tag?: string; category?: string }): Promise<PostDetail[]> {
  const qs = new URLSearchParams();
  if (params?.tag) qs.set('tag', params.tag);
  if (params?.category) qs.set('category', params.category);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const raw = await getJson<PostDetail[]>(`/archive${suffix}`);
  return (raw ?? []).map(normalizePost);
}

export async function fetchTags(): Promise<Tag[]> {
  try {
    return await getJson<Tag[]>('/tags');
  } catch {
    return [];
  }
}

export async function fetchCategories(): Promise<Category[]> {
  try {
    return await getJson<Category[]>('/category');
  } catch {
    return [];
  }
}

export function postId(p: PostPreview): string {
  return String(p._id ?? '');
}

export function postUrl(p: PostPreview): string {
  return `/post/${postId(p)}/`;
}

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

/** 供 sitemap/rss 用的绝对地址(已是 http(s) 则原样返回) */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  const s = siteUrl();
  return `${s}${path.startsWith('/') ? path : `/${path}`}`;
}

/** R2 key -> Worker 代理绝对地址,兼容已带 /api/media/ 前缀或裸 key */
export function mediaUrl(key: string): string {
  const k = String(key || '').trim();
  if (!k) return '';
  if (/^https?:\/\//.test(k)) return k;
  if (k.startsWith('/api/media/')) return `${apiBase()}${k.slice(4)}`;
  const clean = k.replace(/^\/+/, '').replace(/^api\/media\//, '');
  return `${apiBase()}/media/${clean}`;
}

/** 封面解析优先级:cover_key > /api/media/相对路径 > 裸key长相 > 原cover_image */
export function resolveCoverImage(p: PostPreview): string {
  const key = (p as any).cover_key as string | undefined;
  if (key && key.trim()) return mediaUrl(key);
  const img = p.cover_image || '';
  if (!img) return '';
  if (/^https?:\/\//.test(img)) return img;
  if (img.startsWith('/api/media/')) return `${apiBase()}${img.slice(4)}`;
  // 裸 key 长相:covers/xxx / posts/xxx(无空格、无前导/)
  if (/^(covers|posts)\//.test(img.replace(/^\/+/, ''))) return mediaUrl(img);
  if (img.startsWith('/')) return img;
  return img;
}
