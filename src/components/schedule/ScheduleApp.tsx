import { useEffect, useMemo, useState } from 'react';
import type { ClassEvent } from '../../data/schedule';
import { CALENDAR_DAYS } from '../../data/schedule';
import './schedule.css';

type TaskStatus = 'planned' | 'in_progress' | 'awaiting_review' | 'done' | 'skipped' | 'cancelled';

interface Reaction {
  emoji: string;
  count: number;
}

interface PublicTask {
  id: number;
  title: string;
  notes?: string;
  scheduled_start: string;
  scheduled_end: string;
  estimated_minutes: number;
  status: TaskStatus;
  ai_reason?: string;
  reactions: Reaction[];
}

interface ReviewItem {
  id: number;
  task_id: number;
  title: string;
  scheduled_start: string;
  scheduled_end: string;
  estimated_minutes: number;
  prompted_at: string;
  status: 'pending' | 'completed' | 'deferred' | 'skipped';
}

interface LearningNote {
  content: string;
  updated_at?: string;
}

interface ScheduleAppProps {
  classes: ClassEvent[];
  weekStart: string;
  apiBase: string;
}

const CALENDAR_START = 8 * 60;
const CALENDAR_END = 18 * 60;
const CALENDAR_HEIGHT = 660;
const EMOJIS = ['👏', '🔥', '💡', '🚀', '☕'];
const PUBLIC_TASK_STATUSES = new Set<TaskStatus>(['planned', 'in_progress', 'awaiting_review']);

function apiRoot(base: string): string {
  return String(base || 'https://blog-api.charlie-cloud.me/api').replace(/\/$/, '');
}

function mondayOf(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(12, 0, 0, 0);
  const day = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - day);
  return copy;
}

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function formatWeek(start: Date): string {
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  return `${start.toLocaleDateString('en-US', options)} – ${end.toLocaleDateString('en-US', options)}`;
}

function formatShortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function authHeaders(): HeadersInit {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function readJson<T>(response: Response): Promise<T> {
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

function statusLabel(status: TaskStatus): string {
  return {
    planned: 'Planned',
    in_progress: 'In progress',
    awaiting_review: 'Ready for review',
    done: 'Done',
    skipped: 'Skipped',
    cancelled: 'Cancelled',
  }[status];
}

function classColor(event: ClassEvent): string {
  if (event.code.startsWith('EECS')) return 'schedule-event--blue';
  if (event.code.startsWith('STATS')) return 'schedule-event--mint';
  return 'schedule-event--violet';
}

function taskColor(task: PublicTask): string {
  if (task.status === 'awaiting_review') return 'schedule-task--amber';
  if (task.status === 'in_progress') return 'schedule-task--rose';
  return 'schedule-task--slate';
}

function getTaskReaction(task: PublicTask, emoji: string): number {
  return task.reactions?.find((reaction) => reaction.emoji === emoji)?.count ?? 0;
}

export default function ScheduleApp({ classes, weekStart, apiBase }: ScheduleAppProps) {
  const api = apiRoot(apiBase);
  const [currentWeek, setCurrentWeek] = useState(() => mondayOf(new Date()));
  const [tasks, setTasks] = useState<PublicTask[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [learning, setLearning] = useState<LearningNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [ownerLoading, setOwnerLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [deadline, setDeadline] = useState('');
  const [reviewDrafts, setReviewDrafts] = useState<Record<number, { outcome: 'completed' | 'deferred' | 'skipped'; spent: string; summary: string; nextStart: string }>>({});

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date(currentWeek);
    date.setDate(date.getDate() + index);
    return date;
  }), [currentWeek]);

  const timeLabels = useMemo(() => Array.from({ length: 11 }, (_, index) => CALENDAR_START + index * 60), []);

  async function refreshTasks() {
    const response = await fetch(`${api}/schedule/tasks`, { headers: { Accept: 'application/json' } });
    const data = await readJson<PublicTask[]>(response);
    setTasks((data ?? []).filter((task) => PUBLIC_TASK_STATUSES.has(task.status)));
  }

  async function refreshOwnerData() {
    if (typeof localStorage === 'undefined' || !localStorage.getItem('token')) {
      setReviews([]);
      setLearning(null);
      return;
    }
    const response = await fetch(`${api}/protected/schedule/reviews`, { headers: authHeaders() });
    if (response.status === 401) {
      setReviews([]);
      setLearning(null);
      return;
    }
    const data = await readJson<{ reviews: ReviewItem[]; learning?: LearningNote | null }>(response);
    setReviews(data.reviews ?? []);
    setLearning(data.learning ?? null);
  }

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      await Promise.all([refreshTasks(), refreshOwnerData()]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load the schedule.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // The page is a live island: keep the due-review queue fresh while it is open.
    const timer = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  function changeWeek(offset: number) {
    const next = new Date(currentWeek);
    next.setDate(next.getDate() + offset * 7);
    setCurrentWeek(next);
  }

  function resetWeek() {
    setCurrentWeek(mondayOf(new Date()));
  }

  async function addTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;
    setOwnerLoading(true);
    setError('');
    setNotice('AI is finding a class-safe time…');
    try {
      const response = await fetch(`${api}/protected/schedule/tasks`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          title: title.trim(),
          notes: notes.trim(),
          deadline: deadline ? new Date(deadline).toISOString() : null,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      const result = await readJson<{ task: PublicTask; ai?: { reason?: string } }>(response);
      setTitle('');
      setNotes('');
      setDeadline('');
      setNotice(result.ai?.reason ? `Scheduled: ${result.ai.reason}` : 'Task scheduled.');
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not add the task.');
      setNotice('');
    } finally {
      setOwnerLoading(false);
    }
  }

  async function reactToTask(taskId: number, emoji: string) {
    try {
      const response = await fetch(`${api}/schedule/tasks/${taskId}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ emoji }),
      });
      const data = await readJson<{ reactions: Reaction[] }>(response);
      setTasks((current) => current.map((task) => task.id === taskId ? { ...task, reactions: data.reactions ?? task.reactions } : task));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not add the reaction.');
    }
  }

  function reviewDraft(review: ReviewItem) {
    return reviewDrafts[review.id] ?? { outcome: 'completed', spent: String(review.estimated_minutes), summary: '', nextStart: '' };
  }

  function setReviewDraft(reviewId: number, patch: Partial<ReturnType<typeof reviewDraft>>) {
    setReviewDrafts((current) => ({
      ...current,
      [reviewId]: { ...reviewDraft(reviews.find((review) => review.id === reviewId)!), ...patch },
    }));
  }

  async function saveReview(review: ReviewItem) {
    const draft = reviewDraft(review);
    setOwnerLoading(true);
    setError('');
    setNotice('Saving the review and updating the scheduling notes…');
    try {
      const response = await fetch(`${api}/protected/schedule/reviews/${review.id}`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          outcome: draft.outcome,
          spent_minutes: Number(draft.spent) || 0,
          summary: draft.summary.trim(),
          next_start: draft.nextStart ? new Date(draft.nextStart).toISOString() : null,
        }),
      });
      const data = await readJson<{ learning?: LearningNote | null }>(response);
      setLearning(data.learning ?? learning);
      setNotice('Review saved. The next AI schedule will use what you learned.');
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save the review.');
      setNotice('');
    } finally {
      setOwnerLoading(false);
    }
  }

  const taskCount = tasks.length;
  const hasToken = typeof window !== 'undefined' && Boolean(localStorage.getItem('token'));
  const defaultWeek = parseDateOnly(weekStart);

  return (
    <div className="schedule-app">
      <section className="schedule-hero">
        <div>
          <p className="schedule-eyebrow">A week with room to think</p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">My Schedule</h1>
          <p className="mt-3 max-w-2xl text-base-content/70 leading-relaxed">
            Classes stay fixed. The open hours become a small, AI-assisted todo list that learns from how the work actually went.
          </p>
        </div>
        <div className="schedule-hero-chip">
          <span className="schedule-pulse" aria-hidden="true" />
          <span>Live island</span>
        </div>
      </section>

      <section className="card bg-base-100 shadow schedule-card" aria-labelledby="calendar-heading">
        <div className="card-body p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="schedule-kicker">Fixed commitments</p>
              <h2 id="calendar-heading" className="card-title text-2xl">Class calendar</h2>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => changeWeek(-1)} aria-label="Previous week">←</button>
              <button type="button" className="btn btn-sm btn-soft" onClick={resetWeek}>This week</button>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => changeWeek(1)} aria-label="Next week">→</button>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-base-content/60">
            <span>{formatWeek(currentWeek)}</span>
            <span className="hidden sm:inline">·</span>
            <span>Recurring weekly from {defaultWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>

          <div className="schedule-calendar-scroll mt-5">
            <div className="schedule-calendar" style={{ '--calendar-height': `${CALENDAR_HEIGHT}px` } as React.CSSProperties}>
              <div className="schedule-calendar-head schedule-time-head">Time</div>
              {weekDays.map((day, index) => (
                <div className={`schedule-day-head ${dateKey(day) === dateKey(new Date()) ? 'schedule-day-head--today' : ''}`} key={dateKey(day)}>
                  <span>{CALENDAR_DAYS[index]}</span>
                  <strong>{day.getDate()}</strong>
                </div>
              ))}
              <div className="schedule-calendar-body">
                <div className="schedule-time-rail" aria-hidden="true">
                  {timeLabels.map((minutes) => (
                    <span key={minutes} style={{ top: `${((minutes - CALENDAR_START) / (CALENDAR_END - CALENDAR_START)) * 100}%` }}>
                      {String(Math.floor(minutes / 60)).padStart(2, '0')}:00
                    </span>
                  ))}
                </div>
                {weekDays.map((day, dayIndex) => (
                  <div className="schedule-day-track" key={dateKey(day)}>
                    {timeLabels.map((minutes) => (
                      <span className="schedule-hour-line" key={minutes} style={{ top: `${((minutes - CALENDAR_START) / (CALENDAR_END - CALENDAR_START)) * 100}%` }} />
                    ))}
                    {classes.filter((item) => item.weekday === dayIndex).map((item) => {
                      const top = ((timeToMinutes(item.start) - CALENDAR_START) / (CALENDAR_END - CALENDAR_START)) * 100;
                      const height = ((timeToMinutes(item.end) - timeToMinutes(item.start)) / (CALENDAR_END - CALENDAR_START)) * 100;
                      return (
                        <article
                          className={`schedule-event ${classColor(item)}`}
                          key={item.id}
                          style={{ top: `${top}%`, height: `${height}%` }}
                          title={`${item.code} · ${item.start}–${item.end} · ${item.room}`}
                        >
                          <strong>{item.code}</strong>
                          <span>{item.title}</span>
                          <small>{item.start}–{item.end}</small>
                          <small className="schedule-location">{item.room}</small>
                        </article>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-base-content/60">
            <span className="inline-flex items-center gap-1.5"><i className="schedule-legend schedule-legend--blue" /> EECS</span>
            <span className="inline-flex items-center gap-1.5"><i className="schedule-legend schedule-legend--mint" /> STATS</span>
            <span className="inline-flex items-center gap-1.5"><i className="schedule-legend schedule-legend--violet" /> ASTRO</span>
          </div>
        </div>
      </section>

      <section className="schedule-task-layout" aria-labelledby="todo-heading">
        <div className="card bg-base-100 shadow schedule-card">
          <div className="card-body p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="schedule-kicker">Open hours</p>
                <h2 id="todo-heading" className="card-title text-2xl">Todo, with breathing room</h2>
                <p className="mt-2 text-sm text-base-content/65">{taskCount ? `${taskCount} active ${taskCount === 1 ? 'task' : 'tasks'}` : 'Nothing scheduled yet.'} · Friends can leave a little encouragement.</p>
              </div>
              <span className="badge badge-soft badge-primary">AI planner</span>
            </div>

            {loading && <div className="loading loading-spinner loading-md mt-8" aria-label="Loading tasks" />}
            {!loading && tasks.length === 0 && <div className="schedule-empty mt-6"><span aria-hidden="true">✦</span><p>Your open time is clear. Add the first task when you are ready.</p></div>}
            <div className="mt-5 space-y-3">
              {tasks.map((task) => (
                <article className="schedule-task" key={task.id}>
                  <div className={`schedule-task-marker ${taskColor(task)}`} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold truncate">{task.title}</h3>
                      <span className="badge badge-sm badge-ghost">{statusLabel(task.status)}</span>
                    </div>
                    <p className="mt-1 text-sm text-base-content/65">{formatShortDate(task.scheduled_start)} · {task.estimated_minutes} min</p>
                    {task.ai_reason && <p className="mt-2 text-sm text-base-content/70"><span className="font-medium">Why this slot:</span> {task.ai_reason}</p>}
                    <div className="mt-3 flex flex-wrap gap-1.5" aria-label="React to this task">
                      {EMOJIS.map((emoji) => (
                        <button type="button" className="schedule-reaction" key={emoji} onClick={() => reactToTask(task.id, emoji)} title={`React ${emoji}`}>
                          <span>{emoji}</span><small>{getTaskReaction(task, emoji) || ''}</small>
                        </button>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card bg-base-100 shadow schedule-card">
            <div className="card-body p-4 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="schedule-kicker">Owner view</p>
                  <h2 className="card-title text-xl">Add a task</h2>
                </div>
                {!hasToken && <a className="btn btn-xs btn-ghost" href="/admin/">Sign in</a>}
              </div>
              <form className="mt-4 space-y-3" onSubmit={addTask}>
                <input className="input input-bordered w-full" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What needs your attention?" maxLength={160} required />
                <textarea className="textarea textarea-bordered w-full" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="A little context helps the planner…" rows={3} maxLength={1000} />
                <label className="form-control">
                  <span className="label-text text-xs">Optional deadline</span>
                  <input className="input input-bordered input-sm" type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} />
                </label>
                <button className="btn btn-primary w-full" type="submit" disabled={ownerLoading || !title.trim()}>
                  {ownerLoading ? <span className="loading loading-spinner loading-sm" /> : 'Plan it around class'}
                </button>
              </form>
              <p className="mt-3 text-xs text-base-content/55">Active task titles and times are visible to visitors; your notes stay private.</p>
            </div>
          </div>

          {reviews.length > 0 && (
            <div className="card bg-base-100 shadow schedule-card" aria-labelledby="review-heading">
              <div className="card-body p-4 sm:p-6">
                <p className="schedule-kicker">Second queue</p>
                <h2 id="review-heading" className="card-title text-xl">How did it go?</h2>
                <p className="mt-2 text-sm text-base-content/65">These tasks reached their planned time. A quick note teaches the next schedule.</p>
                <div className="mt-4 space-y-4">
                  {reviews.map((review) => {
                    const draft = reviewDraft(review);
                    return (
                      <div className="schedule-review" key={review.id}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-semibold">{review.title}</h3>
                            <p className="mt-1 text-xs text-base-content/60">Planned {formatShortDate(review.scheduled_start)} · {review.estimated_minutes} min</p>
                          </div>
                          <span className="badge badge-warning badge-sm">Needs review</span>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <label className="form-control col-span-1">
                            <span className="label-text text-xs">Result</span>
                            <select className="select select-bordered select-sm" value={draft.outcome} onChange={(event) => setReviewDraft(review.id, { outcome: event.target.value as typeof draft.outcome })}>
                              <option value="completed">Completed</option>
                              <option value="deferred">Need more time</option>
                              <option value="skipped">Skipped</option>
                            </select>
                          </label>
                          <label className="form-control col-span-1">
                            <span className="label-text text-xs">Minutes spent</span>
                            <input className="input input-bordered input-sm" type="number" min="0" max="1440" value={draft.spent} onChange={(event) => setReviewDraft(review.id, { spent: event.target.value })} />
                          </label>
                        </div>
                        {draft.outcome === 'deferred' && <label className="form-control mt-2"><span className="label-text text-xs">Try again at</span><input className="input input-bordered input-sm" type="datetime-local" value={draft.nextStart} onChange={(event) => setReviewDraft(review.id, { nextStart: event.target.value })} /></label>}
                        <textarea className="textarea textarea-bordered mt-2 w-full" rows={2} maxLength={500} value={draft.summary} onChange={(event) => setReviewDraft(review.id, { summary: event.target.value })} placeholder="One or two sentences about the time it took…" />
                        <button type="button" className="btn btn-sm btn-outline mt-2 w-full" disabled={ownerLoading} onClick={() => saveReview(review)}>Save reflection</button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {learning?.content && (
            <div className="schedule-learning rounded-box p-4" aria-label="AI scheduling notes">
              <p className="schedule-kicker">The planner remembers</p>
              <p className="mt-2 text-sm leading-relaxed">{learning.content}</p>
              {learning.updated_at && <p className="mt-2 text-xs opacity-60">Updated {formatTime(learning.updated_at)}</p>}
            </div>
          )}
        </div>
      </section>

      {(notice || error) && <div className={`toast toast-end toast-bottom z-50 ${error ? 'schedule-toast-error' : ''}`} role="status"><div className={`alert ${error ? 'alert-error' : 'alert-success'} shadow-lg`}><span>{error || notice}</span><button type="button" className="btn btn-xs btn-ghost" onClick={() => { setError(''); setNotice(''); }}>×</button></div></div>}
    </div>
  );
}
