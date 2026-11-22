// Spaced repetition based on SM-2 (the algorithm behind classic Anki/SuperMemo).
// Grades: 1 = Again, 3 = Hard, 4 = Good, 5 = Easy.

export const MIN = 60 * 1000;
export const DAY = 24 * 60 * MIN;
export const GRADES = [
  { key: 'again', value: 1, label: 'Again', hotkey: '1' },
  { key: 'hard', value: 3, label: 'Hard', hotkey: '2' },
  { key: 'good', value: 4, label: 'Good', hotkey: '3' },
  { key: 'easy', value: 5, label: 'Easy', hotkey: '4' },
];

export function startOfDay(t = Date.now()) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function newState(now = Date.now()) {
  return { ease: 2.5, interval: 0, reps: 0, lapses: 0, due: now, last: null };
}

/** Returns the next scheduling state after answering with `grade`. */
export function schedule(state, grade, now = Date.now()) {
  let { ease, interval, reps, lapses } = state;

  if (grade < 3) {
    // Forgot: relearn in 10 minutes, ease drops so it comes back more often later.
    return {
      ease: Math.max(1.3, ease - 0.2),
      interval: 0,
      reps: 0,
      lapses: lapses + 1,
      due: now + 10 * MIN,
      last: now,
    };
  }

  reps += 1;
  if (reps === 1) {
    interval = grade === 3 ? 1 : grade === 5 ? 4 : 2;
  } else if (reps === 2) {
    interval = grade === 3 ? 3 : grade === 5 ? 10 : 6;
  } else {
    const mult = grade === 3 ? 1.2 : grade === 5 ? ease * 1.3 : ease;
    interval = Math.max(interval + 1, Math.round(interval * mult));
  }
  ease = Math.max(1.3, ease + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)));

  return { ease, interval, reps, lapses, due: startOfDay(now) + interval * DAY, last: now };
}

export function isDue(state, now = Date.now()) {
  return state.due <= now;
}

export function isNew(state) {
  return state.last == null;
}

/** Higher = weaker. Used to surface provisions you keep forgetting. */
export function weakness(state) {
  if (isNew(state)) return 0;
  return Math.max(0, state.lapses * 2 + (2.5 - state.ease) * 5);
}

export function formatInterval(ms) {
  if (ms < 60 * MIN) return `${Math.max(1, Math.round(ms / MIN))}m`;
  if (ms < DAY) return `${Math.round(ms / (60 * MIN))}h`;
  const d = Math.round(ms / DAY);
  if (d < 30) return `${d}d`;
  if (d < 365) return `${Math.round(d / 30)}mo`;
  return `${(d / 365).toFixed(1)}y`;
}

/** Label shown under each grade button, e.g. "10m", "1d", "6d", "2mo". */
export function nextLabel(state, grade, now = Date.now()) {
  const next = schedule(state, grade, now);
  return next.interval > 0 ? formatInterval(next.interval * DAY) : formatInterval(next.due - now);
}
