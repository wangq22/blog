// 后台专用 API(浏览器端,带 Cloudflare Access id_token,存于 localStorage 'token')
// 与旧站 services/PostService + utils/HttpClient 行为一致

const BASE =
  (import.meta as any).env?.PUBLIC_API_BASE || 'https://blog-api.charlie-cloud.me/api';

function authHeaders(): HeadersInit {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function authHeadersBinary(contentType: string): HeadersInit {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  return {
    'Content-Type': contentType,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

export async function adminFetchPostList(page = 1, page_size = 10) {
  const res = await fetch(`${BASE}/posts?page=${page}&page_size=${page_size}`, {
    headers: authHeaders(),
  });
  return handle<any>(res);
}

export async function adminFetchPostById(id: string) {
  const res = await fetch(`${BASE}/post/${id}`, { headers: authHeaders() });
  return handle<any>(res);
}

export async function adminFetchCategories() {
  const res = await fetch(`${BASE}/category`, { headers: authHeaders() });
  return handle<any[]>(res);
}

export async function adminInsertPost(post: any) {
  const res = await fetch(`${BASE}/protected/post`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(post),
  });
  return handle(res);
}

export async function adminUpdatePost(post: any) {
  const res = await fetch(`${BASE}/protected/post`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(post),
  });
  return handle(res);
}

export async function adminDeletePost(id: string) {
  const res = await fetch(`${BASE}/protected/post/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return handle(res);
}

/** R2 中转上传(需登录)。kind=cover|content,返回 {key, url(url为/api/media/...相对路径)} */
export async function adminUploadMedia(
  file: File | Blob,
  kind: 'cover' | 'content',
  filename?: string,
): Promise<{ key: string; url: string }> {
  const name =
    filename || (file instanceof File && file.name) || (kind === 'cover' ? 'cover.webp' : 'post.md');
  const ct =
    (file as File).type ||
    (kind === 'cover' ? 'application/octet-stream' : 'text/markdown; charset=utf-8');
  const res = await fetch(
    `${BASE}/protected/media?kind=${kind}&filename=${encodeURIComponent(name)}`,
    { method: 'POST', headers: authHeadersBinary(ct), body: file },
  );
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Upload failed: ${res.status} ${t.slice(0, 300)}`);
  }
  return (await res.json()) as { key: string; url: string };
}

/** 把编辑器里的 markdown 文本推到 R2(每次生成新 key,旧 key 保存成功后删除) */
export async function adminUploadMarkdownText(
  text: string,
  filename: string,
): Promise<{ key: string; url: string }> {
  const blob = new Blob([text], { type: 'text/markdown; charset=utf-8' });
  return adminUploadMedia(blob, 'content', filename);
}

export async function adminDeleteMedia(key: string) {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  const res = await fetch(`${BASE}/protected/media?key=${encodeURIComponent(key)}`, {
    method: 'DELETE',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  return handle(res);
}
