import MDEditor from '@uiw/react-md-editor';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  adminDeleteMedia,
  adminFetchCategories,
  adminFetchPostById,
  adminInsertPost,
  adminUpdatePost,
  adminUploadMarkdownText,
  adminUploadMedia,
} from '../../lib/adminApi';
import { mediaUrl } from '../../lib/api';
import AdminIcon from './AdminIcon';

function slugify(value: string): string {
  const slug = (value || 'post')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return slug || 'post';
}

function toDateTimeLocal(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export default function PostEditApp() {
  const [id, setId] = useState<string | null>(null);
  const [post, setPost] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [saveNote, setSaveNote] = useState('');
  const [formError, setFormError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [colorMode, setColorMode] = useState<'light' | 'dark'>('light');
  const mdInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const initialCoverKeyRef = useRef('');
  const initialContentKeyRef = useRef('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const postId = params.get('id');
    setId(postId);
    if (!postId) {
      setPost({
        title: '',
        category: '',
        tags: [],
        cover_key: '',
        content_key: '',
        date: new Date().toISOString(),
        excerpt: '',
        word_count: 0,
        read_time: 0,
        content: '',
      });
    } else {
      adminFetchPostById(postId)
        .then((result) => {
          let tags: string[] = result.tags ?? [];
          if (typeof tags === 'string') {
            try {
              tags = JSON.parse(tags);
            } catch {
              tags = [];
            }
          }
          initialCoverKeyRef.current = result.cover_key || '';
          initialContentKeyRef.current = result.content_key || '';
          setPost({ ...result, tags });
        })
        .catch((reason: unknown) => {
          setLoadError(reason instanceof Error ? reason.message : 'Could not load this article.');
        });
    }

    adminFetchCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    const update = () => setColorMode(html.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
    update();
    const observer = new MutationObserver(update);
    observer.observe(html, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  const contentStats = useMemo(() => {
    const text = String(post?.content || '');
    const plain = text.replace(/[#>*`\[\]()!_-]/g, ' ').trim();
    const words = plain ? plain.split(/\s+/).length : 0;
    return { words, readTime: words ? Math.max(1, Math.ceil(words / 200)) : 0 };
  }, [post?.content]);

  const addTag = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    const tag = tagInput.trim();
    if (!tag) return;
    event.preventDefault();
    setPost((current: any) => {
      if (!current || current.tags?.includes(tag)) return current;
      return { ...current, tags: [...(current.tags ?? []), tag] };
    });
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    setPost((current: any) => current ? { ...current, tags: (current.tags ?? []).filter((item: string) => item !== tag) } : current);
  };

  const coverPreview = post?.cover_key ? mediaUrl(post.cover_key) : '';

  const handleCoverFile = async (file: File | undefined) => {
    if (!file || !post) return;
    setCoverUploading(true);
    setFormError('');
    try {
      const result = await adminUploadMedia(file, 'cover');
      setPost((current: any) => current ? { ...current, cover_key: result.key } : current);
    } catch (reason: unknown) {
      setFormError(reason instanceof Error ? reason.message : 'Cover upload failed.');
    } finally {
      setCoverUploading(false);
      if (coverInputRef.current) coverInputRef.current.value = '';
    }
  };

  const handleImportMd = async (file: File | undefined) => {
    if (!file || !post) return;
    setFormError('');
    try {
      const text = await file.text();
      setPost((current: any) => current ? { ...current, content: text } : current);
    } catch {
      setFormError('Could not read this Markdown file.');
    } finally {
      if (mdInputRef.current) mdInputRef.current.value = '';
    }
  };

  const savePost = async () => {
    if (!post) return;
    if (!post.title?.trim()) {
      setFormError('Add a title before saving.');
      return;
    }
    const text = String(post.content || '');
    if (!text.trim()) {
      setFormError('Add some article content before saving.');
      return;
    }

    setSaving(true);
    setSaveNote('');
    setFormError('');
    try {
      const oldContentKey = initialContentKeyRef.current || post.content_key || '';
      setSaveNote('Uploading Markdown…');
      const uploaded = await adminUploadMarkdownText(text, `${slugify(post.title)}.md`);
      const contentKey = uploaded.key;
      const coverKey = String(post.cover_key || '');
      const toSave = {
        ...(id ? { _id: Number(id) } : {}),
        title: post.title.trim(),
        excerpt: post.excerpt?.trim() || '',
        date: post.date,
        category: post.category || '',
        content_key: contentKey,
        cover_key: coverKey || null,
        tags: post.tags ?? [],
        word_count: contentStats.words,
        read_time: Math.floor(contentStats.words / 200),
      };

      setSaveNote('Saving article…');
      if (!id) {
        await adminInsertPost(toSave);
        window.location.href = '/admin/posts/';
      } else {
        await adminUpdatePost(toSave);
        if (oldContentKey && oldContentKey !== contentKey) adminDeleteMedia(oldContentKey).catch(() => {});
        if (initialCoverKeyRef.current && initialCoverKeyRef.current !== coverKey) {
          adminDeleteMedia(initialCoverKeyRef.current).catch(() => {});
          initialCoverKeyRef.current = coverKey;
        }
        initialContentKeyRef.current = contentKey;
        setPost((current: any) => current ? { ...current, content_key: contentKey, content: text } : current);
        setSaveNote('Changes saved.');
        window.setTimeout(() => setSaveNote(''), 2600);
      }
    } catch (reason: unknown) {
      setFormError(reason instanceof Error ? reason.message : 'Failed to save article.');
      setSaveNote('');
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <div className="rounded-xl border border-error/20 bg-error/5 px-6 py-14 text-center">
        <p className="font-medium">This article could not be opened.</p>
        <p className="mt-2 text-sm text-error">{loadError}</p>
        <a href="/admin/posts/" className="btn btn-sm mt-5">Back to library</a>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="space-y-5" aria-label="Loading editor">
        <span className="skeleton block h-12 w-64 bg-base-200" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <span className="skeleton block h-[38rem] w-full bg-base-200" />
          <span className="skeleton block h-96 w-full bg-base-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="pb-8">
      <header className="flex flex-col gap-5 border-b border-base-300 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <a href="/admin/posts/" className="mb-4 inline-flex items-center gap-2 text-sm text-base-content/50 transition-colors hover:text-primary">
            <AdminIcon name="arrow-left" className="h-4 w-4" />
            Article library
          </a>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Writing desk</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{id ? 'Edit article' : 'Create an article'}</h1>
        </div>
        <div className="flex items-center gap-2">
          {id && (
            <a href={`/post/${encodeURIComponent(id)}/`} className="btn btn-ghost btn-sm">
              Preview live
              <AdminIcon name="external" className="h-4 w-4" />
            </a>
          )}
          <span className="flex items-center gap-2 text-xs font-medium text-base-content/45">
            <span className={`h-2 w-2 rounded-full ${id ? 'bg-success' : 'bg-warning'}`} />
            {id ? 'Published article' : 'New draft'}
          </span>
        </div>
      </header>

      <div className="mt-8 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_330px]">
        <main className="min-w-0 space-y-6">
          <section className="overflow-hidden rounded-xl border border-base-300 bg-base-100 shadow-sm" aria-labelledby="article-content-heading">
            <div className="border-b border-base-300 p-5 sm:p-6">
              <h2 id="article-content-heading" className="sr-only">Article content</h2>
              <input
                className="w-full border-0 bg-transparent text-2xl font-semibold tracking-tight outline-none placeholder:text-base-content/25 sm:text-3xl"
                value={post.title ?? ''}
                onChange={(event) => setPost({ ...post, title: event.target.value })}
                placeholder="Untitled article"
                aria-label="Article title"
                maxLength={180}
              />
              <div className="mt-5 border-t border-base-300 pt-4">
                <label className="text-xs font-semibold uppercase tracking-[0.14em] text-base-content/40" htmlFor="post-excerpt">Excerpt</label>
                <textarea
                  id="post-excerpt"
                  className="mt-2 min-h-16 w-full resize-none border-0 bg-transparent text-sm leading-6 outline-none placeholder:text-base-content/30"
                  value={post.excerpt ?? ''}
                  onChange={(event) => setPost({ ...post, excerpt: event.target.value.slice(0, 160) })}
                  placeholder="A concise description for search results and article previews…"
                  maxLength={160}
                />
                <p className="mt-1 text-right text-xs tabular-nums text-base-content/35">{String(post.excerpt || '').length}/160</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-base-300 bg-base-200/35 px-4 py-3 sm:px-6">
              <div className="flex items-center gap-2 text-sm font-medium">
                <AdminIcon name="edit" className="h-4 w-4 text-primary" />
                Markdown editor
              </div>
              <div className="flex items-center gap-4 text-xs tabular-nums text-base-content/45">
                <span>{contentStats.words.toLocaleString()} words</span>
                <span>{contentStats.readTime || 0} min read</span>
                <button type="button" className="inline-flex items-center gap-1.5 font-medium transition-colors hover:text-primary" onClick={() => mdInputRef.current?.click()}>
                  <AdminIcon name="upload" className="h-3.5 w-3.5" />
                  Import .md
                </button>
                <input ref={mdInputRef} type="file" accept=".md,.markdown,.txt" className="hidden" onChange={(event) => handleImportMd(event.target.files?.[0])} />
              </div>
            </div>

            <div className="admin-markdown-editor" data-color-mode={colorMode}>
              <MDEditor
                value={post.content}
                height={620}
                visibleDragbar={false}
                onChange={(value) => setPost((current: any) => current ? { ...current, content: value || '' } : current)}
              />
            </div>
          </section>
        </main>

        <aside className="space-y-4 xl:sticky xl:top-24">
          <section className="rounded-xl border border-base-300 bg-base-100 p-5 shadow-sm" aria-labelledby="publishing-heading">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><AdminIcon name="calendar" className="h-4 w-4" /></span>
              <div>
                <h2 id="publishing-heading" className="font-semibold">Publishing</h2>
                <p className="text-xs text-base-content/45">Organize where and when it appears.</p>
              </div>
            </div>
            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium">Category</span>
                <select className="select select-bordered w-full" value={post.category || ''} onChange={(event) => setPost({ ...post, category: event.target.value })}>
                  <option value="">Uncategorized</option>
                  {categories.map((category: any) => <option key={category.name} value={category.name}>{category.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium">Publish date</span>
                <input
                  className="input input-bordered w-full"
                  type="datetime-local"
                  value={toDateTimeLocal(post.date)}
                  onChange={(event) => setPost({ ...post, date: event.target.value ? new Date(event.target.value).toISOString() : post.date })}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium">Tags</span>
                <input className="input input-bordered w-full" value={tagInput} placeholder="Type a tag and press Enter" onChange={(event) => setTagInput(event.target.value)} onKeyDown={addTag} />
              </label>
              {(post.tags ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {(post.tags ?? []).map((tag: string) => (
                    <button key={tag} type="button" className="badge badge-soft badge-info gap-1" onClick={() => removeTag(tag)} title="Remove tag">
                      {tag}<span aria-hidden="true">×</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-base-300 bg-base-100 shadow-sm" aria-labelledby="cover-heading">
            <div className="p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary/10 text-secondary"><AdminIcon name="image" className="h-4 w-4" /></span>
                <div>
                  <h2 id="cover-heading" className="font-semibold">Cover image</h2>
                  <p className="text-xs text-base-content/45">Optional article artwork.</p>
                </div>
              </div>
            </div>
            <div className="border-t border-base-300">
              {coverPreview ? (
                <img src={coverPreview} alt="Article cover preview" className="aspect-[16/9] w-full object-cover" />
              ) : (
                <div className="flex aspect-[16/9] items-center justify-center bg-base-200/60 text-base-content/25">
                  <AdminIcon name="image" className="h-8 w-8" />
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 p-4">
              <button type="button" className="btn btn-sm flex-1" onClick={() => coverInputRef.current?.click()} disabled={coverUploading}>
                {coverUploading ? <span className="loading loading-spinner loading-xs" /> : <AdminIcon name="upload" className="h-4 w-4" />}
                {coverPreview ? 'Replace' : 'Upload'}
              </button>
              {post.cover_key && (
                <button type="button" className="btn btn-square btn-ghost btn-sm text-error" onClick={() => setPost({ ...post, cover_key: '' })} aria-label="Remove cover" title="Remove cover">
                  <AdminIcon name="trash" className="h-4 w-4" />
                </button>
              )}
              <input ref={coverInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml" className="hidden" onChange={(event) => handleCoverFile(event.target.files?.[0])} />
            </div>
          </section>

          {(formError || saveNote) && (
            <div className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${formError ? 'border-error/20 bg-error/5 text-error' : 'border-success/20 bg-success/5 text-success'}`} role="status">
              <AdminIcon name={formError ? 'sparkles' : 'check'} className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{formError || saveNote}</span>
            </div>
          )}

          <div className="grid grid-cols-[auto_1fr] gap-2 border-t border-base-300 pt-4">
            <a href="/admin/posts/" className="btn btn-ghost">Cancel</a>
            <button className="btn btn-primary" type="button" onClick={savePost} disabled={saving || coverUploading}>
              {saving ? <span className="loading loading-spinner loading-sm" /> : <AdminIcon name="check" className="h-4 w-4" />}
              {saving ? 'Saving…' : id ? 'Save changes' : 'Publish article'}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
