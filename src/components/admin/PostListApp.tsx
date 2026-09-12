import { useEffect, useState } from 'react';
import { adminFetchPostList, adminDeletePost } from '../../lib/adminApi';
import { mediaUrl } from '../../lib/api';

function coverOf(post: any): string {
  if (post?.cover_key) return mediaUrl(post.cover_key);
  return '';
}

/** 旧站 pages/admin/PostList.tsx 的移植:修复删除后不刷新 + 补 key */
export default function PostListApp() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    adminFetchPostList(1, 50)
      .then((res) => setPosts(res.data ?? []))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this post?')) return;
    try {
      await adminDeletePost(id);
      load();
    } catch {
      alert('Delete failed');
    }
  };

  if (loading) return <p className="opacity-60">Loading…</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Posts ({posts.length})</h1>
        <a href="/admin/edit/" className="btn btn-primary btn-sm">
          + Add Post
        </a>
      </div>
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Tags</th>
              <th>Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post: any) => (
              <tr key={String(post._id)}>
                <td>
                  <div className="flex items-center gap-3">
                    {coverOf(post) && (
                      <div className="avatar">
                        <div className="mask mask-squircle h-12 w-12">
                          <img src={coverOf(post)} alt="" />
                        </div>
                      </div>
                    )}
                    <div>
                      <div className="font-bold">{post.title}</div>
                      <div className="text-sm opacity-50">{post.category}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {(Array.isArray(post.tags)
                      ? post.tags
                      : typeof post.tags === 'string'
                        ? JSON.parse(post.tags || '[]')
                        : []
                    ).map((tag: string) => (
                      <span key={tag} className="badge badge-soft badge-info">
                        {tag}
                      </span>
                    ))}
                  </div>
                </td>
                <td>
                  {post.date
                    ? new Date(post.date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : ''}
                </td>
                <td className="whitespace-nowrap">
                  <a
                    href={`/admin/edit/?id=${encodeURIComponent(String(post._id))}`}
                    className="btn btn-sm btn-ghost"
                  >
                    Edit
                  </a>
                  <button
                    className="btn btn-sm btn-ghost text-error"
                    onClick={() => handleDelete(String(post._id))}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
