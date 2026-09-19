export interface ClassEvent {
  id: string;
  /** Monday = 0, Sunday = 6. */
  weekday: number;
  code: string;
  title: string;
  kind: 'Lecture' | 'Discussion' | 'Laboratory';
  start: string;
  end: string;
  room: string;
}

/**
 * The source screenshot showed the week of 2026-08-31. The classes recur on
 * these weekdays, so the calendar can move between weeks without shipping the
 * screenshot itself.
 */
export const SCHEDULE_WEEK_START = '2026-08-31';

export const CLASS_SCHEDULE: ClassEvent[] = [
  {
    id: 'stats-250-100-mon',
    weekday: 0,
    code: 'STATS 250-100',
    title: 'Lecture',
    kind: 'Lecture',
    start: '10:00',
    end: '11:30',
    room: 'Central Campus Classroom BLDG 1420',
  },
  {
    id: 'stats-250-103-mon',
    weekday: 0,
    code: 'STATS 250-103',
    title: 'Laboratory',
    kind: 'Laboratory',
    start: '13:00',
    end: '14:30',
    room: 'East Hall B760',
  },
  {
    id: 'eecs-280-004-mon',
    weekday: 0,
    code: 'EECS 280-004',
    title: 'Lecture',
    kind: 'Lecture',
    start: '14:30',
    end: '16:00',
    room: 'Alumni Memorial 061',
  },
  {
    id: 'eecs-280-012-tue',
    weekday: 1,
    code: 'EECS 280-012',
    title: 'Laboratory',
    kind: 'Laboratory',
    start: '08:30',
    end: '10:30',
    room: 'Dow Herbert H Building 1017',
  },
  {
    id: 'eecs-203-005-tue',
    weekday: 1,
    code: 'EECS 203-005',
    title: 'Lecture',
    kind: 'Lecture',
    start: '12:00',
    end: '13:30',
    room: 'Ford Motor Co Robotics Bldg 1050',
  },
  {
    id: 'astro-102-006-tue',
    weekday: 1,
    code: 'ASTRO 102-006',
    title: 'Lecture',
    kind: 'Lecture',
    start: '14:30',
    end: '16:00',
    room: 'Weiser Hall 182',
  },
  {
    id: 'astro-102-010-wed',
    weekday: 2,
    code: 'ASTRO 102-010',
    title: 'Discussion',
    kind: 'Discussion',
    start: '09:00',
    end: '10:00',
    room: 'Angell Hall Tisch Hall 5180B',
  },
  {
    id: 'stats-250-100-wed',
    weekday: 2,
    code: 'STATS 250-100',
    title: 'Lecture',
    kind: 'Lecture',
    start: '10:00',
    end: '11:30',
    room: 'Central Campus Classroom BLDG 1420',
  },
  {
    id: 'eecs-280-004-wed',
    weekday: 2,
    code: 'EECS 280-004',
    title: 'Lecture',
    kind: 'Lecture',
    start: '14:30',
    end: '16:00',
    room: 'Alumni Memorial 061',
  },
  {
    id: 'eecs-203-005-thu',
    weekday: 3,
    code: 'EECS 203-005',
    title: 'Lecture',
    kind: 'Lecture',
    start: '12:00',
    end: '13:30',
    room: 'Ford Motor Co Robotics Bldg 1050',
  },
  {
    id: 'astro-102-006-thu',
    weekday: 3,
    code: 'ASTRO 102-006',
    title: 'Lecture',
    kind: 'Lecture',
    start: '14:30',
    end: '16:00',
    room: 'Weiser Hall 182',
  },
  {
    id: 'eecs-203-051-fri',
    weekday: 4,
    code: 'EECS 203-051',
    title: 'Discussion',
    kind: 'Discussion',
    start: '10:00',
    end: '11:30',
    room: 'Ross School of Business Bldg 0420',
  },
];

export const CALENDAR_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
