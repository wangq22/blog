import MDEditor from '@uiw/react-md-editor';
import { useEffect, useState } from 'react';
import {
  adminFetchCategories,
  adminFetchPostById,
  adminInsertPost,
  adminUpdatePost,
} from '../../lib/adminApi';

/** 旧站 pages/admin/PostEdit.tsx 的移植:query ?id= 代替 location.state,修复 Author 不受控 bug */
export default function PostEditApp() {
  const [id, setId] = useState<string | null>(null);
  const [post, setPost] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);

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

  const savePost = async () => {
    if (!post) return;
    setSaving(true);
    try {
      const plain = (post.content || '').replace(/[#>*`\[\]\(\)!-]/g, '');
      const wc = plain.trim() ? plain.trim().split(/\s+/).length : 0;
      const toSave = { ...post, word_count: wc, read_time: Math.floor(wc / 200) };
      if (!id) {
        await adminInsertPost(toSave);
        alert('Post created!');
        window.location.href = '/admin/posts/';
      } else {
        await adminUpdatePost(toSave);
        alert('Post updated!');
      }
    } catch {
      alert('Failed to save post');
    } finally {
      setSaving(false);
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
        <div className="bg-base-100 border border-base-300 rounded-xl p-4">
          <label className="label">
            <span className="label-text">Cover Image URL</span>
          </label>
          <input
            className="input input-bordered w-full"
            value={post.cover_image ?? ''}
            onChange={(e) => setPost({ ...post, cover_image: e.target.value })}
          />
          {post.cover_image && (
            <img src={post.cover_image} alt="" className="mt-3 h-40 rounded-lg object-cover" />
          )}
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
      <div className="flex gap-2">
        <a href="/admin/posts/" className="btn btn-ghost">
          Cancel
        </a>
        <button className="btn btn-primary ml-auto" onClick={savePost} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
