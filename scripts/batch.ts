// Runs many matches headless and reports pacing and dial effects.
// Usage: npm run batch -- [matchesPerRow]
import { createMatch, simulate, defaultDials, defaultChaseCalls, PLACEHOLDER_TEAMS, type ChaseCalls, type Dials, type MatchState } from '../src/sim';

const N = Number(process.argv[2] ?? 300);

function run(seed: number, d0: Dials, d1: Dials, c0 = defaultChaseCalls(), c1 = defaultChaseCalls()): MatchState {
  return simulate(createMatch({ seed, teams: PLACEHOLDER_TEAMS, dials: [d0, d1], chaseCalls: [c0, c1] }));
}

/** Per chase: who led, whether it was caught, who caught it, and how long it lasted. */
function chases(m: MatchState) {
  const out: { leader: number; caught: boolean; catcher: number | null; seconds: number }[] = [];
  let cur: { leader: number; start: number } | null = null;
  for (const e of m.events) {
    if (e.type === 'snitchSighted') cur = { leader: e.team!, start: e.t };
    if (cur && (e.type === 'snitchLost' || e.type === 'snitchCaught')) {
      const caught = e.type === 'snitchCaught';
      out.push({ leader: cur.leader, caught, catcher: caught ? e.team! : null, seconds: e.t - cur.start });
      cur = null;
    }
  }
  return out;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const goalsFor = (m: MatchState, team: 0 | 1) => m.events.filter((e) => e.type === 'goal' && e.team === team).length;
const pct = (x: number) => `${(x * 100).toFixed(0)}%`;

// Baseline: both teams on default dials.
const base: MatchState[] = [];
for (let i = 0; i < N; i++) base.push(run(1000 + i, defaultDials(), defaultDials()));
const lengths = base.map((m) => m.t / 60);
const goals = base.map((m) => m.events.filter((e) => e.type === 'goal').length);
const caught = base.filter((m) => m.events.some((e) => e.type === 'snitchCaught'));
const decided = caught.filter((m) => {
  const catcher = m.events.find((e) => e.type === 'snitchCaught')!.team!;
  const without = [...m.score] as [number, number];
  without[catcher] -= 150;
  return m.winner === catcher && without[catcher] <= without[1 - catcher];
});
const count = (type: string) => base.reduce((n, m) => n + m.events.filter((e) => e.type === type).length, 0) / N;

console.log(`Baseline, ${N} matches, both teams on default dials`);
console.table({
  'median length (min)': median(lengths).toFixed(1),
  'shortest / longest (min)': `${Math.min(...lengths).toFixed(1)} / ${Math.max(...lengths).toFixed(1)}`,
  'goals per match (median)': median(goals),
  'saves per match': count('save').toFixed(1),
  'Bludger hits per match': count('bludgerHit').toFixed(1),
  'Snitch sightings per match': count('snitchSighted').toFixed(1),
  'ended by Snitch catch': pct(caught.length / N),
  'Snitch catch flipped the result': pct(decided.length / N),
  'home win rate': pct(base.filter((m) => m.winner === 0).length / N),
});

const allChases = base.flatMap(chases);
const caughtChases = allChases.filter((c) => c.caught);
console.log('\nSnitch chases (baseline)');
console.table({
  'chases per match': (allChases.length / N).toFixed(1),
  'median chase length (s)': median(allChases.map((c) => c.seconds)).toFixed(1),
  'chases ending in a catch': pct(caughtChases.length / allChases.length),
  'catches made by the leader': pct(caughtChases.filter((c) => c.catcher === c.leader).length / caughtChases.length),
});

// Dial sweeps: home changes one dial, away stays on defaults.
const dialNames: (keyof Dials)[] = ['snitchTiming', 'beaterTarget', 'attack'];
for (const dial of dialNames) {
  const rows: Record<string, Record<string, string>> = {};
  for (const v of [0, 0.25, 0.5, 0.75, 1]) {
    const ms: MatchState[] = [];
    for (let i = 0; i < N; i++) ms.push(run(5000 + i, { ...defaultDials(), [dial]: v }, defaultDials()));
    const hits = (team: 0 | 1, role: string) =>
      ms.reduce((n, m) => n + m.events.filter((e) => e.type === 'bludgerHit' && e.team === team && m.players[e.player!].def.role === role).length, 0) / N;
    rows[`${dial} = ${v}`] = {
      'home win': pct(ms.filter((m) => m.winner === 0).length / N),
      'home goals': (ms.reduce((n, m) => n + goalsFor(m, 0), 0) / N).toFixed(1),
      'away goals': (ms.reduce((n, m) => n + goalsFor(m, 1), 0) / N).toFixed(1),
      'home catches': pct(ms.filter((m) => m.events.some((e) => e.type === 'snitchCaught' && e.team === 0)).length / N),
      'length (min)': median(ms.map((m) => m.t / 60)).toFixed(1),
      'home hits on Seeker': hits(0, 'seeker').toFixed(2),
      'home hits on Chasers': hits(0, 'chaser').toFixed(2),
    };
  }
  console.log(`\nSweep: home ${dial}, away on defaults`);
  console.table(rows);
}

// Chase calls: home tries each call, away keeps playing normally.
const callSets: [string, ChaseCalls][] = [
  ['play, 0 blockers', { beaters: 'play', blockers: 0 }],
  ['escort, 0 blockers', { beaters: 'escort', blockers: 0 }],
  ['attack, 0 blockers', { beaters: 'attack', blockers: 0 }],
  ['play, 1 blocker', { beaters: 'play', blockers: 1 }],
  ['play, 2 blockers', { beaters: 'play', blockers: 2 }],
  ['attack, 2 blockers', { beaters: 'attack', blockers: 2 }],
];
const callRows: Record<string, Record<string, string>> = {};
for (const [name, calls] of callSets) {
  const ms: MatchState[] = [];
  for (let i = 0; i < N; i++) ms.push(run(9000 + i, defaultDials(), defaultDials(), calls));
  const cs = ms.flatMap(chases);
  const homeLed = cs.filter((c) => c.leader === 0);
  const awayLed = cs.filter((c) => c.leader === 1);
  const rate = (xs: typeof cs, team: number) => pct(xs.filter((c) => c.catcher === team).length / Math.max(1, xs.length));
  callRows[name] = {
    'home win': pct(ms.filter((m) => m.winner === 0).length / N),
    'home catch when home leads': rate(homeLed, 0),
    'away catch when away leads': rate(awayLed, 1),
    'home goals': (ms.reduce((n, m) => n + goalsFor(m, 0), 0) / N).toFixed(1),
    'away goals': (ms.reduce((n, m) => n + goalsFor(m, 1), 0) / N).toFixed(1),
  };
}
console.log('\nSweep: home chase calls, away plays normally');
console.table(callRows);
