export interface ReviewItem {
  id: number;
  task_id: number;
  title: string;
  scheduled_start: string;
  scheduled_end: string;
  estimated_minutes: number;
  prompted_at: string;
  status: 'pending' | 'completed' | 'deferred' | 'skipped';
}

export interface LearningNote {
  content: string;
  updated_at?: string;
}

export function apiRoot(base: string): string {
  return String(base || 'https://blog-api.charlie-cloud.me/api').replace(/\/$/, '');
}

export function formatShortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function authHeaders(): HeadersInit {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    const message = typeof body === 'object' && body && 'error' in body ? String((body as { error: unknown }).error) : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return body as T;
}
