import { useEffect, useMemo, useState } from 'react';
import { adminDeletePost, adminFetchAllPosts } from '../../lib/adminApi';
import { mediaUrl, type PostPreview } from '../../lib/api';
import AdminIcon from './AdminIcon';

function coverOf(post: PostPreview): string {
  return post.cover_key ? mediaUrl(post.cover_key) : '';
}

function tagsOf(post: PostPreview): string[] {
  const rawTags: unknown = post.tags;
  if (Array.isArray(rawTags)) return rawTags.map(String).filter(Boolean);
  if (typeof rawTags === 'string') {
    try {
      const parsed = JSON.parse(rawTags);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      return rawTags.split(',').map((tag: string) => tag.trim()).filter(Boolean);
    }
  }
  return [];
}

function formatDate(value?: string) {
  if (!value) return 'No date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export default function PostListApp() {
  const [posts, setPosts] = useState<PostPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [deletingId, setDeletingId] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    adminFetchAllPosts()
      .then((result) => setPosts(result))
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : 'Could not load your articles.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const sortedPosts = useMemo(
    () => [...posts].sort((a, b) => +new Date(b.date) - +new Date(a.date)),
    [posts],
  );

  const visiblePosts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return sortedPosts;
    return sortedPosts.filter((post) =>
      [post.title, post.excerpt, post.category, ...tagsOf(post)]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [query, sortedPosts]);

  const categories = new Set(posts.map((post) => post.category).filter(Boolean)).size;
  const totalWords = posts.reduce((sum, post) => sum + (Number(post.word_count) || 0), 0);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete “${title}”? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      await adminDeletePost(id);
      setPosts((current) => current.filter((post) => String(post._id) !== id));
    } catch {
      alert('Delete failed');
    } finally {
      setDeletingId('');
    }
  };

  return (
    <div className="pb-8">
      <header className="flex flex-col gap-6 border-b border-base-300 pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Publishing</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Article library</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-base-content/55">
            Find, edit, and maintain every article from one focused workspace.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/archive/" className="btn btn-ghost">
            View archive
            <AdminIcon name="external" className="h-4 w-4" />
          </a>
          <a href="/admin/edit/" className="btn btn-primary">
            <AdminIcon name="plus" className="h-4 w-4" />
            New article
          </a>
        </div>
      </header>

      <section className="grid divide-y divide-base-300 border-b border-base-300 sm:grid-cols-3 sm:divide-x sm:divide-y-0" aria-label="Library summary">
        <div className="py-5 sm:px-6 sm:first:pl-0">
          <p className="text-xs font-medium uppercase tracking-wider text-base-content/40">Articles</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{loading ? '—' : posts.length}</p>
        </div>
        <div className="py-5 sm:px-6">
          <p className="text-xs font-medium uppercase tracking-wider text-base-content/40">Categories</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{loading ? '—' : categories}</p>
        </div>
        <div className="py-5 sm:px-6">
          <p className="text-xs font-medium uppercase tracking-wider text-base-content/40">Published words</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{loading ? '—' : totalWords.toLocaleString('en-US')}</p>
        </div>
      </section>

      <section className="mt-8" aria-labelledby="post-list-heading">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="post-list-heading" className="text-xl font-semibold">All articles</h2>
            <p className="mt-1 text-xs text-base-content/45">
              {query ? `${visiblePosts.length} matching ${visiblePosts.length === 1 ? 'result' : 'results'}` : 'Newest articles appear first'}
            </p>
          </div>
          <label className="input input-bordered flex w-full items-center gap-2 bg-base-100 sm:w-72">
            <AdminIcon name="search" className="h-4 w-4 text-base-content/40" />
            <input
              type="search"
              className="grow"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search articles…"
              aria-label="Search articles"
            />
          </label>
        </div>

        <div className="overflow-hidden rounded-xl border border-base-300 bg-base-100 shadow-sm">
          <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(180px,.7fr)_140px_88px] gap-4 border-b border-base-300 bg-base-200/50 px-5 py-3 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-base-content/45 lg:grid">
            <span>Article</span>
            <span>Tags</span>
            <span>Published</span>
            <span className="text-right">Actions</span>
          </div>

          {loading ? (
            <div className="divide-y divide-base-300" aria-label="Loading articles">
              {[0, 1, 2, 3, 4].map((item) => (
                <div key={item} className="flex items-center gap-4 px-5 py-4">
                  <span className="skeleton h-12 w-16 shrink-0 bg-base-200" />
                  <span className="min-w-0 flex-1 space-y-2">
                    <span className="skeleton block h-4 w-2/3 bg-base-200" />
                    <span className="skeleton block h-3 w-1/3 bg-base-200" />
                  </span>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="px-6 py-14 text-center">
              <p className="font-medium">The library could not be loaded.</p>
              <p className="mt-1 text-sm text-error/80">{error}</p>
              <button className="btn btn-sm mt-5" type="button" onClick={load}>Try again</button>
            </div>
          ) : visiblePosts.length ? (
            <ol className="divide-y divide-base-300">
              {visiblePosts.map((post) => {
                const tags = tagsOf(post);
                const id = String(post._id ?? '');
                const cover = coverOf(post);
                return (
                  <li key={id} className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-4 transition-colors hover:bg-base-200/45 sm:px-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(180px,.7fr)_140px_88px]">
                    <div className="flex min-w-0 items-center gap-3.5">
                      <div className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-base-300 bg-base-200 text-base-content/30">
                        {cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : <AdminIcon name="file" className="h-5 w-5" />}
                      </div>
                      <div className="min-w-0">
                        <a href={`/admin/edit/?id=${encodeURIComponent(id)}`} className="block truncate font-medium transition-colors group-hover:text-primary">
                          {post.title}
                        </a>
                        <p className="mt-1 truncate text-xs text-base-content/45">
                          {post.category || 'Uncategorized'}
                          {Number(post.read_time) > 0 ? ` · ${post.read_time} min read` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="hidden min-w-0 flex-wrap gap-1.5 lg:flex">
                      {tags.slice(0, 3).map((tag) => <span key={tag} className="badge badge-sm badge-ghost">{tag}</span>)}
                      {tags.length > 3 && <span className="text-xs text-base-content/40">+{tags.length - 3}</span>}
                      {!tags.length && <span className="text-xs text-base-content/35">No tags</span>}
                    </div>

                    <time className="hidden text-sm text-base-content/55 lg:block" dateTime={post.date}>{formatDate(post.date)}</time>

                    <div className="flex items-center justify-end gap-1">
                      <a
                        href={`/admin/edit/?id=${encodeURIComponent(id)}`}
                        className="btn btn-square btn-ghost btn-sm"
                        aria-label={`Edit ${post.title}`}
                        title="Edit article"
                      >
                        <AdminIcon name="edit" className="h-4 w-4" />
                      </a>
                      <button
                        type="button"
                        className="btn btn-square btn-ghost btn-sm text-error"
                        onClick={() => handleDelete(id, post.title)}
                        disabled={deletingId === id}
                        aria-label={`Delete ${post.title}`}
                        title="Delete article"
                      >
                        {deletingId === id ? <span className="loading loading-spinner loading-xs" /> : <AdminIcon name="trash" className="h-4 w-4" />}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className="px-6 py-16 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <AdminIcon name={query ? 'search' : 'file'} />
              </span>
              <p className="mt-4 font-medium">{query ? 'No matching articles' : 'Your library is empty'}</p>
              <p className="mt-1 text-sm text-base-content/50">
                {query ? 'Try a title, category, or tag.' : 'Create your first article to get started.'}
              </p>
              {!query && <a href="/admin/edit/" className="btn btn-primary btn-sm mt-5">New article</a>}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
