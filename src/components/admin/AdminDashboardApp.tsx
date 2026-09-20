import { useEffect, useMemo, useState } from 'react';
import {
  adminFetchAllPosts,
  adminFetchCategories,
  adminFetchUserProfile,
} from '../../lib/adminApi';
import type { PostPreview, UserProfile } from '../../lib/api';

type DashboardData = {
  posts: PostPreview[];
  categories: Array<{ name?: string; post_count?: number }>;
  profile: UserProfile | null;
};

const actions = [
  {
    href: '/admin/edit/',
    title: 'Write a new post',
    description: 'Open the Markdown editor and turn the next idea into a draft.',
    label: 'Create',
    icon: 'edit',
    accent: 'bg-primary text-primary-content',
  },
  {
    href: '/admin/posts/',
    title: 'Manage articles',
    description: 'Review the archive, update an article, or remove old content.',
    label: 'Browse',
    icon: 'stack',
    accent: 'bg-info/15 text-info',
  },
  {
    href: '/admin/schedule/',
    title: 'Plan your schedule',
    description: 'Organize tasks around class and check the latest results.',
    label: 'Plan',
    icon: 'calendar',
    accent: 'bg-warning/15 text-warning',
  },
  {
    href: '/admin/profile/',
    title: 'Polish your profile',
    description: 'Keep your public bio, links, location, and details current.',
    label: 'Update',
    icon: 'user',
    accent: 'bg-secondary/15 text-secondary',
  },
] as const;

function Icon({ name, className = 'h-5 w-5' }: { name: string; className?: string }) {
  const common = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  if (name === 'edit') {
    return (
      <svg {...common}>
        <path d="M13.5 6.5l4 4M4 20l4.2-.9L19 6.3a2.8 2.8 0 0 0-4-4L4.9 12.4 4 20Z" />
        <path d="M12 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-7" />
      </svg>
    );
  }
  if (name === 'stack') {
    return (
      <svg {...common}>
        <path d="m12 3-9 5 9 5 9-5-9-5Z" />
        <path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
      </svg>
    );
  }
  if (name === 'calendar') {
    return (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
      </svg>
    );
  }
  if (name === 'user') {
    return (
      <svg {...common}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </svg>
    );
  }
  if (name === 'arrow') {
    return (
      <svg {...common}>
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    );
  }
  if (name === 'external') {
    return (
      <svg {...common}>
        <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      </svg>
    );
  }
  return null;
}

function formatDate(value?: string, compact = false) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US',
    compact
      ? { month: 'short', day: 'numeric' }
      : { month: 'short', day: 'numeric', year: 'numeric' },
  ).format(date);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: value >= 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value);
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function LoadingMetric() {
  return <span className="skeleton block h-8 w-16 bg-base-300" aria-hidden="true" />;
}

export default function AdminDashboardApp() {
  const [data, setData] = useState<DashboardData>({ posts: [], categories: [], profile: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.allSettled([adminFetchAllPosts(), adminFetchCategories(), adminFetchUserProfile()])
      .then(([postsResult, categoriesResult, profileResult]) => {
        if (!active) return;
        setData({
          posts: postsResult.status === 'fulfilled' ? postsResult.value : [],
          categories: categoriesResult.status === 'fulfilled' ? categoriesResult.value : [],
          profile: profileResult.status === 'fulfilled' ? profileResult.value : null,
        });
        if ([postsResult, categoriesResult, profileResult].some((result) => result.status === 'rejected')) {
          setError('Some dashboard data is unavailable.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const posts = useMemo(
    () => [...data.posts].sort((a, b) => +new Date(b.date) - +new Date(a.date)),
    [data.posts],
  );
  const recentPosts = posts.slice(0, 5);
  const totalWords = posts.reduce((sum, post) => sum + (Number(post.word_count) || 0), 0);
  const totalReadTime = posts.reduce((sum, post) => sum + (Number(post.read_time) || 0), 0);
  const firstName = data.profile?.name?.trim().split(/\s+/)[0] || '';
  const today = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  return (
    <div className="space-y-10 pb-8">
      <section className="relative overflow-hidden rounded-2xl border border-neutral/10 bg-neutral text-neutral-content shadow-sm">
        <div className="absolute inset-y-0 left-0 w-1 bg-primary" aria-hidden="true" />
        <div className="grid min-h-[290px] lg:grid-cols-[1.6fr_0.7fr]">
          <div className="flex flex-col justify-center px-6 py-10 sm:px-10 lg:px-12">
            <div className="mb-7 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-content/55">
              <span className="h-px w-8 bg-primary" />
              Content studio
            </div>
            <h1 className="max-w-2xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              {greeting()}{firstName ? `, ${firstName}` : ''}.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-neutral-content/65 sm:text-base">
              Your writing space is ready. Pick up an article, shape a new idea, or keep the rest of the blog in order.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href="/admin/edit/" className="btn btn-primary border-0 shadow-none">
                <Icon name="edit" />
                Start writing
              </a>
              <a href="/" className="btn border-neutral-content/20 bg-transparent text-neutral-content hover:border-neutral-content/40 hover:bg-neutral-content/10">
                View live blog
                <Icon name="external" className="h-4 w-4" />
              </a>
            </div>
          </div>
          <div className="flex flex-col justify-between border-t border-neutral-content/10 bg-neutral-content/[0.035] p-6 sm:p-8 lg:border-l lg:border-t-0">
            <div className="flex items-center gap-2 text-sm text-neutral-content/65">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
              </span>
              Workspace ready
            </div>
            <div className="mt-12 lg:mt-0">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-neutral-content/45">Today</p>
              <p className="mt-2 text-xl font-medium">{today}</p>
              <p className="mt-2 text-sm text-neutral-content/50">
                {loading ? 'Gathering your latest content…' : `${posts.length} articles in your library`}
              </p>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="alert border border-warning/25 bg-warning/10 text-sm" role="status">
          <span>Some overview data could not be loaded. Your admin shortcuts still work.</span>
        </div>
      )}

      <section aria-labelledby="overview-heading">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-base-content/45">At a glance</p>
            <h2 id="overview-heading" className="mt-1 text-2xl font-semibold tracking-tight">Content overview</h2>
          </div>
          <a href="/admin/posts/" className="hidden items-center gap-2 text-sm font-medium text-base-content/60 transition-colors hover:text-primary sm:flex">
            Full library <Icon name="arrow" className="h-4 w-4" />
          </a>
        </div>

        <div className="grid divide-y divide-base-300 border-y border-base-300 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
          <div className="px-1 py-5 sm:px-6 sm:first:pl-1">
            <p className="text-sm text-base-content/55">Published articles</p>
            <div className="mt-2 text-3xl font-semibold tabular-nums">{loading ? <LoadingMetric /> : formatNumber(posts.length)}</div>
          </div>
          <div className="px-1 py-5 sm:px-6">
            <p className="text-sm text-base-content/55">Categories</p>
            <div className="mt-2 text-3xl font-semibold tabular-nums">{loading ? <LoadingMetric /> : formatNumber(data.categories.length)}</div>
          </div>
          <div className="px-1 py-5 sm:px-6">
            <p className="text-sm text-base-content/55">Words published</p>
            <div className="mt-2 text-3xl font-semibold tabular-nums">{loading ? <LoadingMetric /> : formatNumber(totalWords)}</div>
          </div>
          <div className="px-1 py-5 sm:px-6 sm:last:pr-1">
            <p className="text-sm text-base-content/55">Reading time</p>
            <div className="mt-2 flex items-baseline gap-1.5 text-3xl font-semibold tabular-nums">
              {loading ? <LoadingMetric /> : <>{formatNumber(totalReadTime)} <span className="text-sm font-normal text-base-content/45">min</span></>}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-10 lg:grid-cols-[1.25fr_0.75fr]">
        <section aria-labelledby="recent-heading">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-base-content/45">Your library</p>
              <h2 id="recent-heading" className="mt-1 text-2xl font-semibold tracking-tight">Recent articles</h2>
            </div>
            <a href="/admin/posts/" className="btn btn-ghost btn-sm">View all</a>
          </div>

          <div className="overflow-hidden rounded-xl border border-base-300 bg-base-100 shadow-sm">
            {loading ? (
              <div className="space-y-4 p-6" aria-label="Loading recent articles">
                {[0, 1, 2, 3].map((item) => <div key={item} className="skeleton h-14 w-full bg-base-200" />)}
              </div>
            ) : recentPosts.length ? (
              <ol className="divide-y divide-base-300">
                {recentPosts.map((post, index) => (
                  <li key={String(post._id ?? `${post.title}-${index}`)}>
                    <a
                      href={`/admin/edit/?id=${encodeURIComponent(String(post._id ?? ''))}`}
                      className="group grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-4 transition-colors hover:bg-base-200/60 sm:px-6"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" aria-hidden="true" />
                          <h3 className="truncate font-medium group-hover:text-primary">{post.title}</h3>
                        </div>
                        <p className="mt-1.5 truncate pl-3.5 text-xs text-base-content/45">
                          {post.category || 'Uncategorized'} · {formatDate(post.date)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {Number(post.read_time) > 0 && (
                          <span className="hidden text-xs text-base-content/40 sm:inline">{post.read_time} min read</span>
                        )}
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg text-base-content/35 transition-colors group-hover:bg-primary group-hover:text-primary-content">
                          <Icon name="arrow" className="h-4 w-4" />
                        </span>
                      </div>
                    </a>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="px-6 py-12 text-center">
                <p className="font-medium">Your library is waiting.</p>
                <p className="mt-1 text-sm text-base-content/55">Publish the first article to see it here.</p>
                <a href="/admin/edit/" className="btn btn-primary btn-sm mt-5">Create an article</a>
              </div>
            )}
          </div>
          {!loading && posts[0] && (
            <p className="mt-3 text-xs text-base-content/40">Last published {formatDate(posts[0].date, true)}</p>
          )}
        </section>

        <section aria-labelledby="actions-heading">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-base-content/45">Shortcuts</p>
            <h2 id="actions-heading" className="mt-1 text-2xl font-semibold tracking-tight">Keep things moving</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {actions.map((action) => (
              <a
                key={action.href}
                href={action.href}
                className="group flex items-center gap-4 rounded-xl border border-base-300 bg-base-100 px-4 py-4 transition-[border-color,transform,box-shadow] hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${action.accent}`}>
                  <Icon name={action.icon} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{action.title}</span>
                  <span className="mt-0.5 block truncate text-xs text-base-content/50">{action.description}</span>
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-base-content/30 transition-colors group-hover:text-primary">
                  {action.label}
                </span>
              </a>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
