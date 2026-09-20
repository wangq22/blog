import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  apiRoot,
  authHeaders,
  formatShortDate,
  formatTime,
  readJson,
  type LearningNote,
  type OwnerTask,
  type OwnerTaskStatus,
  type ReviewItem,
} from './scheduleApi';
import './schedule.css';

type ReviewOutcome = 'completed' | 'deferred' | 'skipped';

interface ReviewDraft {
  outcome: ReviewOutcome;
  spent: string;
  summary: string;
  nextStart: string;
}

interface ScheduleOwnerAppProps {
  apiBase: string;
}

const ACTIVE_STATUSES = new Set<OwnerTaskStatus>(['planned', 'in_progress', 'awaiting_review']);

function statusLabel(status: OwnerTaskStatus): string {
  return {
    planned: 'Planned',
    in_progress: 'In progress',
    awaiting_review: 'Needs review',
    done: 'Completed',
    skipped: 'Skipped',
    cancelled: 'Cancelled',
  }[status];
}

function statusBadge(status: OwnerTaskStatus): string {
  if (status === 'done') return 'badge-success';
  if (status === 'skipped' || status === 'cancelled') return 'badge-ghost';
  if (status === 'awaiting_review') return 'badge-warning';
  return 'badge-primary';
}

function toDateTimeLocal(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export default function ScheduleOwnerApp({ apiBase }: ScheduleOwnerAppProps) {
  const api = apiRoot(apiBase);
  const [tasks, setTasks] = useState<OwnerTask[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [learning, setLearning] = useState<LearningNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [ownerLoading, setOwnerLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [deadline, setDeadline] = useState('');
  const [reviewDrafts, setReviewDrafts] = useState<Record<number, ReviewDraft>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editDeadline, setEditDeadline] = useState('');
  const [editReplan, setEditReplan] = useState(false);

  const activeTasks = useMemo(() => tasks.filter((task) => ACTIVE_STATUSES.has(task.status)), [tasks]);
  const historyTasks = useMemo(() => tasks.filter((task) => !ACTIVE_STATUSES.has(task.status)), [tasks]);

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const [taskResponse, reviewResponse] = await Promise.all([
        fetch(`${api}/protected/schedule/tasks`, { headers: authHeaders() }),
        fetch(`${api}/protected/schedule/reviews`, { headers: authHeaders() }),
      ]);
      if (taskResponse.status === 401 || reviewResponse.status === 401) {
        throw new Error('Your admin session expired. Please log in again.');
      }
      const [taskData, reviewData] = await Promise.all([
        readJson<{ tasks: OwnerTask[]; learning?: LearningNote | null }>(taskResponse),
        readJson<{ reviews: ReviewItem[]; learning?: LearningNote | null }>(reviewResponse),
      ]);
      setTasks(taskData.tasks ?? []);
      setReviews(reviewData.reviews ?? []);
      setLearning(taskData.learning ?? reviewData.learning ?? null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load the owner schedule.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  async function addTask(event: FormEvent<HTMLFormElement>) {
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
      const result = await readJson<{ ai?: { reason?: string } }>(response);
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

  function startEditing(task: OwnerTask) {
    setEditingId(task.id);
    setEditTitle(task.title);
    setEditNotes(task.notes ?? '');
    setEditDeadline(toDateTimeLocal(task.deadline));
    setEditReplan(false);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditTitle('');
    setEditNotes('');
    setEditDeadline('');
    setEditReplan(false);
  }

  async function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editingId === null || !editTitle.trim()) return;
    setOwnerLoading(true);
    setError('');
    setNotice(editReplan ? 'Updating the task and asking AI for a new slot…' : 'Saving task changes…');
    try {
      const response = await fetch(`${api}/protected/schedule/tasks/${editingId}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          title: editTitle.trim(),
          notes: editNotes.trim(),
          deadline: editDeadline ? new Date(editDeadline).toISOString() : null,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          replan: editReplan,
        }),
      });
      const result = await readJson<{ ai?: { reason?: string } }>(response);
      cancelEditing();
      setNotice(result.ai?.reason ? `Task updated: ${result.ai.reason}` : 'Task updated.');
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update the task.');
      setNotice('');
    } finally {
      setOwnerLoading(false);
    }
  }

  async function deleteTask(task: OwnerTask) {
    if (!window.confirm(`Delete “${task.title}”? This also removes its review and emoji history.`)) return;
    setOwnerLoading(true);
    setError('');
    try {
      const response = await fetch(`${api}/protected/schedule/tasks/${task.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      await readJson<{ ok: boolean }>(response);
      if (editingId === task.id) cancelEditing();
      setNotice('Task deleted.');
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not delete the task.');
      setNotice('');
    } finally {
      setOwnerLoading(false);
    }
  }

  async function refreshLearning() {
    setOwnerLoading(true);
    setError('');
    setNotice('AI is reviewing your previous outcomes…');
    try {
      const response = await fetch(`${api}/protected/schedule/learning`, {
        method: 'POST',
        headers: authHeaders(),
      });
      const data = await readJson<{ learning?: LearningNote | null }>(response);
      setLearning(data.learning ?? null);
      setNotice(data.learning?.content ? 'Previous experience updated.' : 'There is not enough review history yet.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not refresh the previous experience.');
      setNotice('');
    } finally {
      setOwnerLoading(false);
    }
  }

  function reviewDraft(review: ReviewItem): ReviewDraft {
    return reviewDrafts[review.id] ?? {
      outcome: 'completed',
      spent: String(review.estimated_minutes),
      summary: '',
      nextStart: '',
    };
  }

  function updateReviewDraft(review: ReviewItem, patch: Partial<ReviewDraft>) {
    setReviewDrafts((current) => ({
      ...current,
      [review.id]: { ...reviewDraft(review), ...patch },
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

  function renderTask(task: OwnerTask) {
    const editing = editingId === task.id;
    const canReplan = task.status === 'planned' || task.status === 'in_progress';
    return (
      <article className="schedule-task" key={task.id}>
        <div className="schedule-task-marker schedule-task--slate" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="font-semibold break-words">{task.title}</h4>
                <span className={`badge badge-sm ${statusBadge(task.status)}`}>{statusLabel(task.status)}</span>
              </div>
              <p className="mt-1 text-xs text-base-content/60">Scheduled {formatShortDate(task.scheduled_start)} · {task.estimated_minutes} min</p>
              {task.deadline && <p className="mt-1 text-xs text-base-content/60">Deadline {formatShortDate(task.deadline)}</p>}
            </div>
            <div className="flex shrink-0 gap-1">
              <button type="button" className="btn btn-xs btn-ghost" onClick={() => (editing ? cancelEditing() : startEditing(task))} disabled={ownerLoading}>{editing ? 'Cancel' : 'Edit'}</button>
              <button type="button" className="btn btn-xs btn-ghost text-error" onClick={() => deleteTask(task)} disabled={ownerLoading}>Delete</button>
            </div>
          </div>
          {task.ai_reason && <p className="mt-2 text-sm text-base-content/70"><span className="font-medium">Why this slot:</span> {task.ai_reason}</p>}
          {(task.status === 'done' || task.status === 'skipped') && <p className="mt-2 text-sm text-base-content/65">{task.actual_minutes ?? 0} min spent{task.completion_summary ? ` · ${task.completion_summary}` : ''}</p>}

          {editing && (
            <form className="mt-4 space-y-3 border-t border-base-content/10 pt-4" onSubmit={saveTask}>
              <input className="input input-bordered input-sm w-full" value={editTitle} onChange={(event) => setEditTitle(event.target.value)} maxLength={160} required aria-label="Task title" />
              <textarea className="textarea textarea-bordered textarea-sm w-full" value={editNotes} onChange={(event) => setEditNotes(event.target.value)} rows={3} maxLength={1000} placeholder="Private notes" aria-label="Task notes" />
              <label className="form-control">
                <span className="label-text text-xs">Deadline</span>
                <input className="input input-bordered input-sm" type="datetime-local" value={editDeadline} onChange={(event) => setEditDeadline(event.target.value)} />
              </label>
              {canReplan && (
                <label className="label cursor-pointer justify-start gap-2 px-0">
                  <input className="checkbox checkbox-sm" type="checkbox" checked={editReplan} onChange={(event) => setEditReplan(event.target.checked)} />
                  <span className="label-text text-xs">Ask AI to find a new slot</span>
                </label>
              )}
              <button className="btn btn-sm btn-primary w-full" type="submit" disabled={ownerLoading || !editTitle.trim()}>{ownerLoading ? <span className="loading loading-spinner loading-sm" /> : 'Save changes'}</button>
            </form>
          )}
        </div>
      </article>
    );
  }

  return (
    <section className="pb-8" aria-labelledby="schedule-owner-heading">
      <header className="overflow-hidden rounded-2xl border border-neutral/10 bg-neutral text-neutral-content shadow-sm">
        <div className="grid lg:grid-cols-[1fr_auto]">
          <div className="border-l-4 border-primary px-6 py-8 sm:px-9 sm:py-10">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">AI planning studio</p>
            <h1 id="schedule-owner-heading" className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Owner schedule</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-content/60">Plan work around class, keep task details current, and teach the planner from every outcome.</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <a className="btn btn-primary btn-sm" href="#add-schedule-task">Add a task</a>
              <a className="btn btn-sm border-neutral-content/20 bg-transparent text-neutral-content hover:border-neutral-content/40 hover:bg-neutral-content/10" href="/schedule/">View public schedule ↗</a>
            </div>
          </div>
          <div className="grid grid-cols-3 divide-x divide-neutral-content/10 border-t border-neutral-content/10 lg:min-w-[330px] lg:border-l lg:border-t-0">
            <div className="flex flex-col justify-end px-4 py-6 sm:px-6">
              <p className="text-2xl font-semibold tabular-nums">{loading ? '—' : activeTasks.length}</p>
              <p className="mt-1 text-[0.65rem] font-medium uppercase tracking-wider text-neutral-content/45">Active</p>
            </div>
            <div className="flex flex-col justify-end px-4 py-6 sm:px-6">
              <p className="text-2xl font-semibold tabular-nums">{loading ? '—' : reviews.length}</p>
              <p className="mt-1 text-[0.65rem] font-medium uppercase tracking-wider text-neutral-content/45">Reviews</p>
            </div>
            <div className="flex flex-col justify-end px-4 py-6 sm:px-6">
              <p className="text-2xl font-semibold tabular-nums">{loading ? '—' : tasks.filter((task) => task.status === 'done').length}</p>
              <p className="mt-1 text-[0.65rem] font-medium uppercase tracking-wider text-neutral-content/45">Done</p>
            </div>
          </div>
        </div>
      </header>

      <div className="schedule-task-layout schedule-owner-layout">
        <div className="space-y-4">
          <div id="add-schedule-task" className="card scroll-mt-24 border-l-4 border-l-primary bg-base-100 shadow-sm schedule-card">
            <div className="card-body p-4 sm:p-6">
              <p className="schedule-kicker">Owner view</p>
              <h3 className="card-title text-xl">Add a task</h3>
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

          <div className="card bg-base-100 shadow-sm schedule-card" aria-labelledby="task-manager-heading">
            <div className="card-body p-4 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="schedule-kicker">Task manager</p>
                  <h3 id="task-manager-heading" className="card-title text-xl">Current and previous tasks</h3>
                </div>
                <span className="badge badge-soft">{tasks.length} total</span>
              </div>
              {loading && <div className="loading loading-spinner loading-md mt-5" aria-label="Loading tasks" />}
              {!loading && tasks.length === 0 && <div className="schedule-empty mt-4"><span aria-hidden="true">✦</span><p>No tasks yet.</p></div>}
              {!loading && activeTasks.length > 0 && <div className="mt-4 space-y-3"><p className="text-xs font-bold uppercase tracking-wider text-base-content/55">Active</p>{activeTasks.map(renderTask)}</div>}
              {!loading && historyTasks.length > 0 && <div className="mt-5 space-y-3"><p className="text-xs font-bold uppercase tracking-wider text-base-content/55">History</p>{historyTasks.map(renderTask)}</div>}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card bg-base-100 shadow-sm schedule-card" aria-labelledby="review-heading">
            <div className="card-body p-4 sm:p-6">
              <p className="schedule-kicker">Second queue</p>
              <h3 id="review-heading" className="card-title text-xl">How did it go?</h3>
              <p className="mt-2 text-sm text-base-content/65">These tasks reached their planned time. A quick note teaches the next schedule.</p>
              {loading && <div className="loading loading-spinner loading-md mt-5" aria-label="Loading reviews" />}
              {!loading && reviews.length === 0 && <div className="schedule-empty mt-4"><span aria-hidden="true">✓</span><p>No tasks are waiting for review.</p></div>}
              {!loading && reviews.length > 0 && <div className="mt-4 space-y-4">
                {reviews.map((review) => {
                  const draft = reviewDraft(review);
                  return (
                    <div className="schedule-review" key={review.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="font-semibold">{review.title}</h4>
                          <p className="mt-1 text-xs text-base-content/60">Planned {formatShortDate(review.scheduled_start)} · {review.estimated_minutes} min</p>
                        </div>
                        <span className="badge badge-warning badge-sm">Needs review</span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <label className="form-control col-span-1">
                          <span className="label-text text-xs">Result</span>
                          <select className="select select-bordered select-sm" value={draft.outcome} onChange={(event) => updateReviewDraft(review, { outcome: event.target.value as ReviewOutcome })}>
                            <option value="completed">Completed</option>
                            <option value="deferred">Need more time</option>
                            <option value="skipped">Skipped</option>
                          </select>
                        </label>
                        <label className="form-control col-span-1">
                          <span className="label-text text-xs">Minutes spent</span>
                          <input className="input input-bordered input-sm" type="number" min="0" max="1440" value={draft.spent} onChange={(event) => updateReviewDraft(review, { spent: event.target.value })} />
                        </label>
                      </div>
                      {draft.outcome === 'deferred' && <label className="form-control mt-2"><span className="label-text text-xs">Try again at</span><input className="input input-bordered input-sm" type="datetime-local" value={draft.nextStart} onChange={(event) => updateReviewDraft(review, { nextStart: event.target.value })} /></label>}
                      <textarea className="textarea textarea-bordered mt-2 w-full" rows={2} maxLength={500} value={draft.summary} onChange={(event) => updateReviewDraft(review, { summary: event.target.value })} placeholder="One or two sentences about the time it took…" />
                      <button type="button" className="btn btn-sm btn-outline mt-2 w-full" disabled={ownerLoading} onClick={() => saveReview(review)}>Save reflection</button>
                    </div>
                  );
                })}
              </div>}
            </div>
          </div>

          <div className="schedule-learning rounded-xl p-5" aria-label="AI previous scheduling experience">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="schedule-kicker">Previous experience</p>
                <h3 className="font-semibold">What the planner remembers</h3>
              </div>
              <button type="button" className="btn btn-xs btn-ghost" onClick={refreshLearning} disabled={ownerLoading}>Refresh with AI</button>
            </div>
            {learning?.content ? (
              <>
                <p className="mt-3 text-sm leading-relaxed">{learning.content}</p>
                <p className="mt-2 text-xs opacity-60">
                  {learning.updated_at && <>Updated {formatTime(learning.updated_at)}</>}
                  {learning.ai_model && <> · {learning.ai_model}</>}
                </p>
              </>
            ) : <p className="mt-3 text-sm text-base-content/65">Complete a review and the planner will write down a reusable scheduling lesson.</p>}
          </div>
        </div>
      </div>

      {(notice || error) && <div className={`toast toast-end toast-bottom z-50 ${error ? 'schedule-toast-error' : ''}`} role="status"><div className={`alert ${error ? 'alert-error' : 'alert-success'} shadow-lg`}><span>{error || notice}</span><button type="button" className="btn btn-xs btn-ghost" onClick={() => { setError(''); setNotice(''); }}>×</button></div></div>}
    </section>
  );
}
