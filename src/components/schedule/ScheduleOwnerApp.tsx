import { useEffect, useState, type FormEvent } from 'react';
import {
  apiRoot,
  authHeaders,
  formatShortDate,
  formatTime,
  readJson,
  type LearningNote,
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

export default function ScheduleOwnerApp({ apiBase }: ScheduleOwnerAppProps) {
  const api = apiRoot(apiBase);
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

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${api}/protected/schedule/reviews`, { headers: authHeaders() });
      if (response.status === 401) throw new Error('Your admin session expired. Please log in again.');
      const data = await readJson<{ reviews: ReviewItem[]; learning?: LearningNote | null }>(response);
      setReviews(data.reviews ?? []);
      setLearning(data.learning ?? null);
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

  return (
    <section className="mt-8" aria-labelledby="schedule-owner-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="schedule-kicker">My Schedule</p>
          <h2 id="schedule-owner-heading" className="text-2xl font-bold">Owner controls</h2>
          <p className="mt-2 max-w-2xl text-sm text-base-content/65">Plan work around class, review completed time, and give the next AI schedule a little context.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className="btn btn-sm btn-ghost" href="/admin/">Back to dashboard</a>
          <a className="btn btn-sm btn-soft" href="/schedule/">View public schedule</a>
        </div>
      </div>

      <div className="schedule-task-layout schedule-owner-layout">
        <div className="card bg-base-100 shadow schedule-card">
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

        <div className="space-y-4">
          <div className="card bg-base-100 shadow schedule-card" aria-labelledby="review-heading">
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

          {learning?.content && (
            <div className="schedule-learning rounded-box p-4" aria-label="AI scheduling notes">
              <p className="schedule-kicker">The planner remembers</p>
              <p className="mt-2 text-sm leading-relaxed">{learning.content}</p>
              {learning.updated_at && <p className="mt-2 text-xs opacity-60">Updated {formatTime(learning.updated_at)}</p>}
            </div>
          )}
        </div>
      </div>

      <p className="mt-6"><a href="/" className="link link-hover text-sm">← Back to blog</a></p>

      {(notice || error) && <div className={`toast toast-end toast-bottom z-50 ${error ? 'schedule-toast-error' : ''}`} role="status"><div className={`alert ${error ? 'alert-error' : 'alert-success'} shadow-lg`}><span>{error || notice}</span><button type="button" className="btn btn-xs btn-ghost" onClick={() => { setError(''); setNotice(''); }}>×</button></div></div>}
    </section>
  );
}
