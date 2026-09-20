import { useEffect, useMemo, useState } from 'react';
import type { ClassEvent } from '../../data/schedule';
import { CALENDAR_DAYS } from '../../data/schedule';
import { apiRoot, formatShortDate, readJson } from './scheduleApi';
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

interface ScheduleAppProps {
  classes: ClassEvent[];
  weekStart: string;
  apiBase: string;
}

const CALENDAR_START = 8 * 60;
const CALENDAR_END = 22 * 60;
const CALENDAR_HEIGHT = 840;
const EMOJIS = ['👏', '🔥', '💡', '🚀', '☕'];
const PUBLIC_TASK_STATUSES = new Set<TaskStatus>(['planned', 'in_progress', 'awaiting_review']);

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

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
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

function taskDateKey(task: PublicTask): string {
  const date = new Date(task.scheduled_start);
  return Number.isNaN(date.getTime()) ? '' : dateKey(date);
}

function taskTimeRange(task: PublicTask): string {
  const formatter = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${formatter.format(new Date(task.scheduled_start))}–${formatter.format(new Date(task.scheduled_end))}`;
}

function taskCalendarColor(task: PublicTask): string {
  if (task.status === 'awaiting_review') return 'schedule-calendar-task--amber';
  if (task.status === 'in_progress') return 'schedule-calendar-task--rose';
  return 'schedule-calendar-task--slate';
}

export default function ScheduleApp({ classes, weekStart, apiBase }: ScheduleAppProps) {
  const api = apiRoot(apiBase);
  const [currentWeek, setCurrentWeek] = useState(() => mondayOf(new Date()));
  const [tasks, setTasks] = useState<PublicTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date(currentWeek);
    date.setDate(date.getDate() + index);
    return date;
  }), [currentWeek]);

  const timeLabels = useMemo(
    () => Array.from({ length: (CALENDAR_END - CALENDAR_START) / 60 + 1 }, (_, index) => CALENDAR_START + index * 60),
    [],
  );

  const tasksByDay = useMemo(() => {
    const grouped = new Map<string, PublicTask[]>();
    for (const task of tasks) {
      const key = taskDateKey(task);
      if (!key) continue;
      const dayTasks = grouped.get(key) ?? [];
      dayTasks.push(task);
      grouped.set(key, dayTasks);
    }
    return grouped;
  }, [tasks]);

  async function refreshTasks() {
    const response = await fetch(`${api}/schedule/tasks`, { headers: { Accept: 'application/json' } });
    const data = await readJson<PublicTask[]>(response);
    setTasks((data ?? []).filter((task) => PUBLIC_TASK_STATUSES.has(task.status)));
  }

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      await refreshTasks();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load the schedule.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // The page is a live island: keep the public task list fresh while it is open.
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

  const taskCount = tasks.length;
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
              <p className="schedule-kicker">Classes + scheduled tasks</p>
              <h2 id="calendar-heading" className="card-title text-2xl">Schedule calendar</h2>
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
                    {(tasksByDay.get(dateKey(day)) ?? []).map((task) => {
                      const start = new Date(task.scheduled_start);
                      const end = new Date(task.scheduled_end);
                      const startMinutes = start.getHours() * 60 + start.getMinutes() + start.getSeconds() / 60;
                      const endMinutes = end.getHours() * 60 + end.getMinutes() + end.getSeconds() / 60;
                      const clippedStart = Math.max(startMinutes, CALENDAR_START);
                      const clippedEnd = Math.min(endMinutes, CALENDAR_END);
                      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || clippedEnd <= clippedStart) return null;
                      const top = ((clippedStart - CALENDAR_START) / (CALENDAR_END - CALENDAR_START)) * 100;
                      const height = ((clippedEnd - clippedStart) / (CALENDAR_END - CALENDAR_START)) * 100;
                      return (
                        <article
                          className={`schedule-event schedule-calendar-task ${taskCalendarColor(task)}`}
                          key={`task-${task.id}`}
                          style={{ top: `${top}%`, height: `${height}%` }}
                          title={`${task.title} · ${taskTimeRange(task)} · ${task.estimated_minutes} min`}
                        >
                          <strong>{task.title}</strong>
                          <span>Task · {task.estimated_minutes} min</span>
                          <small>{taskTimeRange(task)}</small>
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
            <span className="inline-flex items-center gap-1.5"><i className="schedule-legend schedule-legend--task" /> Task</span>
          </div>
        </div>
      </section>

      <section className="mt-6" aria-labelledby="todo-heading">
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
      </section>

      {(notice || error) && <div className={`toast toast-end toast-bottom z-50 ${error ? 'schedule-toast-error' : ''}`} role="status"><div className={`alert ${error ? 'alert-error' : 'alert-success'} shadow-lg`}><span>{error || notice}</span><button type="button" className="btn btn-xs btn-ghost" onClick={() => { setError(''); setNotice(''); }}>×</button></div></div>}
    </div>
  );
}
