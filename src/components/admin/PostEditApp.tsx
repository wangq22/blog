import MDEditor from '@uiw/react-md-editor';
import { useEffect, useRef, useState } from 'react';
import {
  adminFetchCategories,
  adminFetchPostById,
  adminInsertPost,
  adminUpdatePost,
  adminUploadMedia,
  adminUploadMarkdownText,
  adminDeleteMedia,
} from '../../lib/adminApi';
import { mediaUrl } from '../../lib/api';

function slugify(s: string): string {
  const t = (s || 'post')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return t || 'post';
}

/** 旧站 pages/admin/PostEdit.tsx 的移植:query ?id= 代替 location.state,修复 Author 不受控 bug */
/** R2 版:封面走文件上传拿 cover_key,正文保存时自动推 R2 拿 content_key,D1 只存 key */
export default function PostEditApp() {
  const [id, setId] = useState<string | null>(null);
  const [post, setPost] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [saveNote, setSaveNote] = useState('');
  const coverInputRef = useRef<HTMLInputElement>(null);
  const mdInputRef = useRef<HTMLInputElement>(null);
  // 保存成功后才删旧 R2 对象(取消不丢图)
  const initialCoverKeyRef = useRef('');
  const initialContentKeyRef = useRef('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pid = params.get('id');
    setId(pid);
    if (!pid) {
      setPost({
        title: '',
        category: '',
        tags: [],
        cover_image: '',
        cover_key: '',
        content_key: '',
        author: '',
        date: new Date().toISOString(),
        excerpt: '',
        word_count: 0,
        read_time: 0,
        content: '',
      });
    } else {
      adminFetchPostById(pid)
        .then((p) => {
          let tags: string[] = p.tags ?? [];
          if (typeof tags === 'string') {
            try {
              tags = JSON.parse(tags);
            } catch {
              tags = [];
            }
          }
          initialCoverKeyRef.current = p.cover_key || '';
          initialContentKeyRef.current = p.content_key || '';
          setPost({ ...p, tags });
        })
        .catch((e) => console.error(e));
    }
    adminFetchCategories()
      .then(setCategories)
      .catch(() => {});
  }, []);

  const addTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      setPost((prev: any) => (prev ? { ...prev, tags: [...(prev.tags ?? []), tagInput.trim()] } : prev));
      setTagInput('');
    }
  };
  const removeTag = (tag: string) => {
    setPost((prev: any) => (prev ? { ...prev, tags: (prev.tags ?? []).filter((t: string) => t !== tag) } : prev));
  };

  const coverPreview = post
    ? post.cover_key
      ? mediaUrl(post.cover_key)
      : post.cover_image || ''
    : '';

  const handleCoverFile = async (f: File | undefined) => {
    if (!f || !post) return;
    setCoverUploading(true);
    try {
      const r = await adminUploadMedia(f, 'cover');
      // 旧 key 等保存成功再删(见 savePost),取消不丢图;连续换图产生的中间 key 保存时一起不管,仅多一个孤儿对象
      setPost({ ...post, cover_key: r.key, cover_image: '' });
    } catch (e: any) {
      alert(e?.message || 'Cover upload failed');
    } finally {
      setCoverUploading(false);
    }
  };

  const handleImportMd = async (f: File | undefined) => {
    if (!f || !post) return;
    try {
      const text = await f.text();
      setPost((prev: any) => (prev ? { ...prev, content: text } : prev));
    } catch {
      alert('Read .md failed');
    }
  };

  const savePost = async () => {
    if (!post) return;
    setSaving(true);
    setSaveNote('');
    try {
      const text: string = post.content || '';
      const plain = text.replace(/[#>*`\[\]\(\)!-]/g, '');
      const wc = plain.trim() ? plain.trim().split(/\s+/).length : 0;
      let content_key: string = post.content_key || '';
      const oldContentKey = post.content_key || '';
      // 正文推 R2(每次新 key,成功后删旧 key 防泄漏)
      if (text.trim()) {
        setSaveNote('Uploading markdown to R2…');
        const fname = `${slugify(post.title)}.md`;
        const r = await adminUploadMarkdownText(text, fname);
        content_key = r.key;
      } else {
        content_key = '';
      }
      const finalCoverKey: string = post.cover_key || '';
      const toSave = {
        ...post,
        word_count: wc,
        read_time: Math.floor(wc / 200),
        content_key,
        // 有 key 就不再往 D1 写全文(后端也会忽略 content)
        content: content_key ? '' : text,
        cover_key: finalCoverKey,
        cover_image: finalCoverKey ? '' : post.cover_image || '',
      };
      setSaveNote('Saving post…');
      if (!id) {
        await adminInsertPost(toSave);
        alert('Post created!');
        window.location.href = '/admin/posts/';
      } else {
        await adminUpdatePost(toSave);
        // 成功后清孤儿:正文每次新 key,封面换图后旧 key
        if (oldContentKey && oldContentKey !== content_key) {
          adminDeleteMedia(oldContentKey).catch(() => {});
        }
        if (initialCoverKeyRef.current && initialCoverKeyRef.current !== finalCoverKey) {
          adminDeleteMedia(initialCoverKeyRef.current).catch(() => {});
          initialCoverKeyRef.current = finalCoverKey;
        }
        initialContentKeyRef.current = content_key;
        setPost((prev: any) => (prev ? { ...prev, content_key, content: text } : prev));
        alert('Post updated!');
      }
    } catch (e: any) {
      alert(e?.message || 'Failed to save post');
    } finally {
      setSaving(false);
      setSaveNote('');
    }
  };

  if (!post) return <p className="opacity-60">Loading…</p>;

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">{id ? 'Edit Post' : 'New Post'}</h1>
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
        <div className="bg-base-200 border border-base-300 rounded-xl p-4">
          <fieldset className="fieldset">
            <legend className="fieldset-legend">Post Metadata</legend>
            <label className="label">Title</label>
            <input
              className="input w-full"
              value={post.title ?? ''}
              onChange={(e) => setPost({ ...post, title: e.target.value })}
              placeholder="Enter title"
            />
            <label className="label mt-2">Excerpt (SEO description)</label>
            <input
              className="input w-full"
              value={post.excerpt ?? ''}
              onChange={(e) => setPost({ ...post, excerpt: e.target.value })}
              placeholder="150 chars summary"
            />
            <p className="text-xs opacity-60 mt-1">{(post.excerpt || '').length}/160</p>
            <label className="label mt-2">Author</label>
            <input
              className="input w-full"
              value={post.author ?? ''}
              onChange={(e) => setPost({ ...post, author: e.target.value })}
              placeholder="Name"
            />
            <label className="label mt-2">Category</label>
            <select
              className="select w-full"
              value={post.category || ''}
              onChange={(e) => setPost({ ...post, category: e.target.value })}
            >
              <option value="">Select category</option>
              {categories.map((cat: any) => (
                <option key={cat.name} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>
            <label className="label mt-2">Tags</label>
            <input
              className="input input-bordered w-full"
              value={tagInput}
              placeholder="Press enter to add tag"
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={addTag}
            />
            <div className="flex gap-2 flex-wrap mt-2">
              {(post.tags ?? []).map((tag: string) => (
                <div key={tag} className="badge badge-info gap-1 cursor-pointer">
                  {tag}
                  <span onClick={() => removeTag(tag)}>✕</span>
                </div>
              ))}
            </div>
          </fieldset>
        </div>
        <div className="bg-base-100 border border-base-300 rounded-xl p-4 space-y-3">
          <div>
            <label className="label">
              <span className="label-text">Cover Image (R2)</span>
            </label>
            <div className="flex gap-2">
              <input
                ref={coverInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml"
                className="file-input file-input-bordered w-full"
                onChange={(e) => handleCoverFile(e.target.files?.[0])}
              />
              {post.cover_key && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setPost({ ...post, cover_key: '', cover_image: '' })}
                >
                  Clear
                </button>
              )}
            </div>
            {coverUploading && <p className="text-xs opacity-60 mt-1">Uploading cover…</p>}
            {post.cover_key && (
              <p className="text-xs opacity-60 mt-1 break-all">key: {post.cover_key}</p>
            )}
            <label className="label mt-2">
              <span className="label-text">Cover URL (legacy,仅老文章手动填)</span>
            </label>
            <input
              className="input input-bordered w-full"
              value={post.cover_image ?? ''}
              onChange={(e) => setPost({ ...post, cover_image: e.target.value })}
              placeholder="https://… (有 R2 封面时忽略)"
            />
            {coverPreview && (
              <img src={coverPreview} alt="" className="mt-3 h-40 rounded-lg object-cover" />
            )}
          </div>
          <div>
            <label className="label">
              <span className="label-text">Markdown (正文存 R2,保存时自动上传)</span>
            </label>
            <div className="flex gap-2 items-center">
              <input
                ref={mdInputRef}
                type="file"
                accept=".md,.markdown,.txt"
                className="file-input file-input-bordered w-full"
                onChange={(e) => handleImportMd(e.target.files?.[0])}
              />
            </div>
            {post.content_key && (
              <p className="text-xs opacity-60 mt-1 break-all">key: {post.content_key}</p>
            )}
          </div>
        </div>
      </div>
      <div className="divider" />
      <div data-color-mode="light">
        <MDEditor
          value={post.content}
          onChange={(value) => setPost((prev: any) => (prev ? { ...prev, content: value || '' } : prev))}
        />
      </div>
      <div className="divider" />
      <div className="flex gap-2 items-center">
        <a href="/admin/posts/" className="btn btn-ghost">
          Cancel
        </a>
        {saveNote && <span className="text-xs opacity-60">{saveNote}</span>}
        <button className="btn btn-primary ml-auto" onClick={savePost} disabled={saving || coverUploading}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
