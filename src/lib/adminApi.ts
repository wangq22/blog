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
