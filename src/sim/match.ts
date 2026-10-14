import rulesJson from '../data/rules.json';
import { Rng } from './rng';
import * as V from './vec';
import { clampN, lerpN } from './vec';
import type {
  ChaseCalls,
  ChaseState,
  Dials,
  MatchEvent,
  MatchEventType,
  PlayerState,
  QuaffleState,
  BludgerState,
  SnitchState,
  Role,
  TeamDef,
  TeamSide,
  Vec3,
} from './types';

export const RULES = rulesJson;
export const DT = RULES.tickSeconds;
const P = RULES.pitch;

export interface MatchState {
  t: number;
  rng: Rng;
  teams: [TeamDef, TeamDef];
  players: PlayerState[];
  quaffle: QuaffleState;
  bludgers: BludgerState[];
  snitch: SnitchState;
  score: [number, number];
  dials: [Dials, Dials];
  aiTeams: TeamSide[];
  aiTimer: number;
  seekerChasing: [boolean, boolean];
  /** Non-null during the Snitch chase, the match's second phase. */
  chase: ChaseState | null;
  chaseCalls: [ChaseCalls, ChaseCalls];
  /** Seconds each team's Seeker stays shaken after a failed chase. */
  shakenFor: [number, number];
  restartTimer: number;
  events: MatchEvent[];
  over: boolean;
  winner: TeamSide | null;
}

export interface MatchOptions {
  seed: number;
  teams: [TeamDef, TeamDef];
  dials?: [Dials, Dials];
  chaseCalls?: [ChaseCalls, ChaseCalls];
  /** Teams whose dials are set by the opponent-manager AI. */
  aiTeams?: TeamSide[];
}

// ---------- geometry helpers ----------

export const other = (t: TeamSide): TeamSide => (t === 0 ? 1 : 0);
/** Team 0 attacks towards +x, team 1 towards -x. */
export const attackDir = (t: TeamSide): number => (t === 0 ? 1 : -1);
/** x position of the hoops a team defends. */
export const hoopX = (defending: TeamSide): number =>
  -attackDir(defending) * (P.length / 2 - RULES.hoops.inset);
export function hoops(defending: TeamSide): Vec3[] {
  const x = hoopX(defending);
  return RULES.hoops.heights.map((h, i) => V.v3(x, h, (i - 1) * RULES.hoops.spacing));
}

export function clampToPitch(pos: Vec3): Vec3 {
  const a = P.length / 2 + P.margin;
  const b = P.width / 2 + P.margin;
  const e = (pos.x / a) ** 2 + (pos.z / b) ** 2;
  if (e > 1) {
    const f = 1 / Math.sqrt(e);
    pos.x *= f;
    pos.z *= f;
  }
  pos.y = clampN(pos.y, 1, P.maxHeight);
  return pos;
}

export const defaultDials = (): Dials => ({ snitchTiming: 0.5, beaterTarget: 0.5, attack: 0.5 });
export const defaultChaseCalls = (): ChaseCalls => ({ beaters: 'play', blockers: 0 });

const byRole = (s: MatchState, team: TeamSide, role: Role) =>
  s.players.filter((p) => p.team === team && p.def.role === role);
const seekerOf = (s: MatchState, team: TeamSide) => byRole(s, team, 'seeker')[0];
const keeperOf = (s: MatchState, team: TeamSide) => byRole(s, team, 'keeper')[0];
const active = (p: PlayerState) => p.stunnedFor <= 0;

function randomDir(rng: Rng, vertical = 0.4): Vec3 {
  return V.norm(V.v3(rng.range(-1, 1), rng.range(-vertical, vertical), rng.range(-1, 1)));
}

function emit(s: MatchState, type: MatchEventType, text: string, team?: TeamSide, player?: number) {
  s.events.push({ t: s.t, type, text, team, player });
}

const teamName = (s: MatchState, t: TeamSide) => s.teams[t].name;

// ---------- setup ----------

const REQUIRED: Record<Role, number> = { chaser: 3, beater: 2, keeper: 1, seeker: 1 };

function startPos(team: TeamSide, role: Role, k: number): Vec3 {
  const dir = attackDir(team);
  switch (role) {
    case 'keeper':
      return V.v3(hoopX(team) + dir * RULES.keeper.guardDistance, 12, 0);
    case 'chaser':
      return V.v3(-dir * 15, 8, (k - 1) * 12);
    case 'beater':
      return V.v3(-dir * 25, 10, k === 0 ? -15 : 15);
    case 'seeker':
      return V.v3(-dir * 10, RULES.seeker.patrolHeight, 0);
  }
}

export function createMatch(o: MatchOptions): MatchState {
  const players: PlayerState[] = [];
  ([0, 1] as TeamSide[]).forEach((team) => {
    const counts: Record<Role, number> = { chaser: 0, beater: 0, keeper: 0, seeker: 0 };
    for (const def of o.teams[team].players) {
      const k = counts[def.role]++;
      players.push({ id: players.length, team, def, pos: startPos(team, def.role, k), vel: V.v3(), stunnedFor: 0 });
    }
    for (const role of Object.keys(REQUIRED) as Role[]) {
      if (counts[role] !== REQUIRED[role]) {
        throw new Error(`${o.teams[team].name} needs ${REQUIRED[role]} ${role}(s), has ${counts[role]}`);
      }
    }
  });

  const rng = new Rng(o.seed);
  return {
    t: 0,
    rng,
    teams: o.teams,
    players,
    quaffle: { pos: V.v3(0, 10, 0), vel: V.v3(), holder: null, flight: null, noGrabFor: 0 },
    bludgers: [
      { pos: V.v3(0, 6, -6), vel: V.v3(), flight: null, cooldown: 0 },
      { pos: V.v3(0, 6, 6), vel: V.v3(), flight: null, cooldown: 0 },
    ],
    snitch: {
      pos: V.v3(rng.range(-40, 40), 15, rng.range(-15, 15)),
      vel: V.v3(),
      visibleFor: 0,
      seenBy: [false, false],
      wanderTimer: 0,
    },
    score: [0, 0],
    dials: o.dials ?? [defaultDials(), defaultDials()],
    aiTeams: o.aiTeams ?? [],
    aiTimer: 0,
    seekerChasing: [false, false],
    chase: null,
    chaseCalls: o.chaseCalls ?? [defaultChaseCalls(), defaultChaseCalls()],
    shakenFor: [0, 0],
    restartTimer: 0,
    events: [],
    over: false,
    winner: null,
  };
}

export function setDials(s: MatchState, team: TeamSide, dials: Partial<Dials>): void {
  const d = { ...s.dials[team], ...dials };
  s.dials[team] = {
    snitchTiming: clampN(d.snitchTiming, 0, 1),
    beaterTarget: clampN(d.beaterTarget, 0, 1),
    attack: clampN(d.attack, 0, 1),
  };
}

export function setChaseCalls(s: MatchState, team: TeamSide, calls: Partial<ChaseCalls>): void {
  s.chaseCalls[team] = { ...s.chaseCalls[team], ...calls };
}

/** True while this team's Seeker is in the chase. */
const chasing = (s: MatchState, team: TeamSide) => s.chase !== null && s.seekerChasing[team];

/** Chasers this team has sent to block the rival Seeker, nearest first. */
function blockersOf(s: MatchState, team: TeamSide): PlayerState[] {
  const n = s.chaseCalls[team].blockers;
  if (!n || !chasing(s, other(team))) return [];
  const rival = seekerOf(s, other(team));
  const q = s.quaffle;
  return byRole(s, team, 'chaser')
    .filter((c) => active(c) && c.id !== q.holder && c.id !== q.flight?.receiver)
    .sort((a, b) => V.dist(a.pos, rival.pos) - V.dist(b.pos, rival.pos))
    .slice(0, n);
}

// ---------- main step ----------

export function step(s: MatchState): void {
  if (s.over) return;
  s.t += DT;
  s.restartTimer = Math.max(0, s.restartTimer - DT);
  s.shakenFor = [Math.max(0, s.shakenFor[0] - DT), Math.max(0, s.shakenFor[1] - DT)];
  updateAi(s);
  updateSeekerIntent(s);
  for (const p of s.players) {
    if (p.stunnedFor > 0) p.stunnedFor = Math.max(0, p.stunnedFor - DT);
    movePlayer(s, p, targetFor(s, p));
  }
  updateQuaffle(s);
  updateBludgers(s);
  updateSnitch(s);
  if (!s.over && s.t >= RULES.match.capSeconds) endMatch(s, 'Time cap reached.');
}

/** Run a whole match without rendering. */
export function simulate(s: MatchState): MatchState {
  while (!s.over) step(s);
  return s;
}

function endMatch(s: MatchState, reason: string) {
  s.over = true;
  s.winner = s.score[0] === s.score[1] ? null : s.score[0] > s.score[1] ? 0 : 1;
  const result =
    s.winner === null ? 'Draw' : `${teamName(s, s.winner)} win`;
  emit(s, 'end', `${reason} ${result}, ${s.score[0]} to ${s.score[1]}.`);
}

// ---------- opponent manager AI ----------

function updateAi(s: MatchState) {
  s.aiTimer -= DT;
  if (s.aiTimer > 0) return;
  s.aiTimer = RULES.ai.intervalSeconds;
  const j = () => s.rng.range(-RULES.ai.jitter, RULES.ai.jitter);
  for (const team of s.aiTeams) {
    const diff = s.score[team] - s.score[other(team)];
    const snitchTiming = diff >= 0 ? 0.75 : diff > -RULES.points.snitch ? 0.55 : 0.2;
    const enemyLeads = diff < 0;
    const beaterTarget = s.seekerChasing[other(team)] || (enemyLeads && s.t > 600) ? 0.8 : 0.35;
    const attack = diff < 0 ? 0.7 : diff > 30 ? 0.35 : 0.5;
    setDials(s, team, { snitchTiming: snitchTiming + j(), beaterTarget: beaterTarget + j(), attack: attack + j() });
    if (s.chase) aiChaseCalls(s, team);
  }
}

function aiChaseCalls(s: MatchState, team: TeamSide) {
  const ours = s.seekerChasing[team] || s.chase?.leader === team;
  const theirs = s.seekerChasing[other(team)] || s.chase?.leader === other(team);
  if (ours && !theirs) setChaseCalls(s, team, { beaters: 'escort', blockers: 0 });
  else if (theirs && !ours) setChaseCalls(s, team, { beaters: 'attack', blockers: s.rng.chance(0.5) ? 2 : 1 });
  else setChaseCalls(s, team, { beaters: s.rng.chance(0.5) ? 'attack' : 'escort', blockers: s.rng.chance(0.5) ? 1 : 0 });
}

// ---------- movement ----------

const maxSpeed = (p: PlayerState) => RULES.movement.baseSpeed + p.def.speed * RULES.movement.speedPerPoint;

function movePlayer(s: MatchState, p: PlayerState, target: Vec3) {
  let mul = 1;
  if (!active(p)) {
    target = V.v3(p.pos.x, 2, p.pos.z);
    mul = 0.3;
  } else if (s.quaffle.holder === p.id) {
    mul = RULES.movement.carrierSpeedFactor;
  } else if (p.def.role === 'seeker' && chasing(s, p.team) && isBlocked(s, p)) {
    mul = RULES.chase.blockSlowFactor;
  }
  const max = maxSpeed(p) * mul;
  const d = V.sub(target, p.pos);
  const dl = V.len(d);
  const desiredSpeed = Math.min(max, dl * RULES.movement.arriveGain);
  const desired = dl > 1e-6 ? V.scale(d, desiredSpeed / dl) : V.v3();
  p.vel = V.lerp(p.vel, desired, Math.min(1, RULES.movement.accel * DT));
  p.pos = clampToPitch(V.add(p.pos, V.scale(p.vel, DT)));
}

/** A chasing Seeker is slowed when an opposing player is in their path. */
function isBlocked(s: MatchState, sk: PlayerState): boolean {
  return s.players.some(
    (o) => o.team !== sk.team && o.def.role !== 'seeker' && active(o) && V.dist(o.pos, sk.pos) < RULES.chase.blockRange,
  );
}

function possession(s: MatchState): TeamSide | null {
  const q = s.quaffle;
  if (q.holder !== null) return s.players[q.holder].team;
  if (q.flight) return s.players[q.flight.thrower].team;
  return null;
}

function targetFor(s: MatchState, p: PlayerState): Vec3 {
  switch (p.def.role) {
    case 'chaser':
      return chaserTarget(s, p);
    case 'keeper':
      return keeperTarget(s, p);
    case 'beater':
      return beaterTarget(s, p);
    case 'seeker':
      return seekerTarget(s, p);
  }
}

function chaserTarget(s: MatchState, p: PlayerState): Vec3 {
  const q = s.quaffle;
  const team = p.team;
  const dir = attackDir(team);
  const atk = s.dials[team].attack;
  const mates = byRole(s, team, 'chaser');
  const poss = possession(s);

  if (q.holder === p.id) {
    const oppX = hoopX(other(team));
    return V.v3(oppX - dir * RULES.shoot.approachDistance, 13, Math.sin(s.t * 0.7 + p.id) * 8);
  }
  if (q.flight && q.flight.receiver === p.id) return q.flight.to;

  // Chase call: blockers leave the Quaffle game to cut off the rival Seeker.
  if (blockersOf(s, team).includes(p)) {
    const rival = seekerOf(s, other(team));
    return V.lerp(rival.pos, s.snitch.pos, 0.3);
  }

  if (poss === team) {
    const ref = q.holder !== null ? q.pos : q.flight!.to;
    const others = mates.filter((m) => m.id !== q.holder);
    const k = others.indexOf(p);
    if (atk < 0.35 && k === others.length - 1) return V.v3(ref.x - dir * 18, 10, 0);
    const side = k % 2 === 0 ? -1 : 1;
    return clampToPitch(V.v3(ref.x + dir * lerpN(-8, 18, atk), 11 + k * 2, ref.z + side * 14));
  }

  const sorted = [...mates].sort((a, b) => V.dist(a.pos, q.pos) - V.dist(b.pos, q.pos));
  const k = sorted.indexOf(p);
  const ownX = hoopX(team);
  if (poss === other(team)) {
    if (k === 0) return q.pos;
    if (k === 1) return atk >= 0.35 ? V.add(q.pos, V.v3(0, 2, 3)) : V.lerp(q.pos, V.v3(ownX, 12, 0), 0.4);
    return V.v3(ownX + dir * lerpN(15, 45, atk), 12, q.pos.z * 0.5);
  }
  // Loose Quaffle: the two nearest race for it.
  if (k < 2) return q.pos;
  return clampToPitch(V.v3(q.pos.x - dir * 15, 10, q.pos.z * 0.5));
}

function keeperTarget(s: MatchState, p: PlayerState): Vec3 {
  const q = s.quaffle;
  const dir = attackDir(p.team);
  const sp = RULES.hoops.spacing;
  return V.v3(
    hoopX(p.team) + dir * RULES.keeper.guardDistance,
    clampN(q.pos.y, 9, 16),
    clampN(q.pos.z * 0.3, -sp, sp),
  );
}

function beaterTarget(s: MatchState, p: PlayerState): Vec3 {
  const beaters = byRole(s, p.team, 'beater');
  const b = s.bludgers[beaters.indexOf(p) % s.bludgers.length];
  const q = s.quaffle;
  const call = s.chaseCalls[p.team].beaters;
  if (call === 'escort' && chasing(s, p.team)) {
    const own = seekerOf(s, p.team);
    return V.add(own.pos, V.v3(0, 1, beaters.indexOf(p) === 0 ? -2.5 : 2.5));
  }
  if (call === 'attack' && chasing(s, other(p.team))) {
    const rival = seekerOf(s, other(p.team));
    if (!b.flight && V.dist(p.pos, b.pos) < RULES.bludger.engageDistance) return b.pos;
    return V.lerp(rival.pos, b.pos, 0.5);
  }
  const protect =
    q.holder !== null && s.players[q.holder].team === p.team ? s.players[q.holder] : seekerOf(s, p.team);
  if (!b.flight && V.dist(p.pos, b.pos) < RULES.bludger.engageDistance) return b.pos;
  return V.lerp(protect.pos, b.pos, 0.5);
}

function seekerTarget(s: MatchState, p: PlayerState): Vec3 {
  const sn = s.snitch;
  if (sn.visibleFor > 0) {
    if (s.seekerChasing[p.team]) return sn.pos;
    const enemy = seekerOf(s, other(p.team));
    // Holding off: mark the enemy Seeker if they dive, otherwise shadow the Snitch at a distance.
    if (s.seekerChasing[other(p.team)]) return V.add(enemy.pos, V.v3(0, 1, 1.5));
    if (sn.seenBy[p.team]) {
      return V.add(sn.pos, V.scale(V.norm(V.sub(p.pos, sn.pos)), RULES.seeker.shadowDistance));
    }
  }
  const a = s.t * 0.08 + p.team * Math.PI;
  return V.v3(Math.cos(a) * P.length * 0.3, RULES.seeker.patrolHeight, Math.sin(a) * P.width * 0.3);
}

// ---------- Seeker decisions (the Snitch timing dial) ----------

function updateSeekerIntent(s: MatchState) {
  const sn = s.snitch;
  const prev: [boolean, boolean] = [...s.seekerChasing];
  for (const team of [0, 1] as TeamSide[]) {
    const sk = seekerOf(s, team);
    let chase = false;
    if (sn.visibleFor > 0 && active(sk)) {
      // Head start: the rival Seeker reacts a moment after the spotter.
      const reacted = !s.chase || s.chase.leader === team || s.t >= s.chase.startedAt + RULES.chase.rivalReactionSeconds;
      const sees =
        reacted && (sn.seenBy[team] || V.dist(sk.pos, sn.pos) < RULES.snitch.noticeDistance || prev[other(team)]);
      if (sees) {
        sn.seenBy[team] = true;
        const margin = s.score[team] + RULES.points.snitch - s.score[other(team)];
        // Dial 0: only catch while level or ahead. 0.5: catch if it wins. 1: always catch.
        const required = (0.5 - s.dials[team].snitchTiming) * RULES.snitch.marginRange;
        chase = margin >= required || s.t >= RULES.snitch.forceChaseAfter;
      }
    }
    if (chase && !prev[team]) emit(s, 'seekerDive', `${teamName(s, team)} Seeker dives for the Snitch!`, team, sk.id);
    s.seekerChasing[team] = chase;
  }
}

// ---------- Quaffle ----------

function nearestOpponentDist(s: MatchState, p: PlayerState): number {
  let best = Infinity;
  for (const o of s.players) {
    if (o.team === p.team || !active(o) || (o.def.role !== 'chaser' && o.def.role !== 'keeper')) continue;
    best = Math.min(best, V.dist(o.pos, p.pos));
  }
  return best;
}

function tryPass(s: MatchState, h: PlayerState): boolean {
  const q = s.quaffle;
  const dir = attackDir(h.team);
  const options = byRole(s, h.team, 'chaser').filter((m) => m.id !== h.id && active(m));
  if (!options.length) return false;
  let best = options[0];
  let bestScore = -Infinity;
  for (const m of options) {
    const score = dir * m.pos.x + Math.min(nearestOpponentDist(s, m), 12) * 1.5 + s.rng.range(0, 5);
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  const duration = Math.max(0.3, V.dist(h.pos, best.pos) / RULES.pass.speed);
  const to = clampToPitch(V.add(best.pos, V.scale(best.vel, duration)));
  q.holder = null;
  q.flight = { kind: 'pass', from: V.clone(q.pos), to, elapsed: 0, duration, thrower: h.id, receiver: best.id, hoop: null };
  return true;
}

function shoot(s: MatchState, h: PlayerState) {
  const q = s.quaffle;
  const def = other(h.team);
  const K = keeperOf(s, def);
  const targets = hoops(def);
  let bi = 0;
  let bd = -1;
  targets.forEach((hp, i) => {
    const d = V.dist(K.pos, hp) + s.rng.range(0, 3);
    if (d > bd) {
      bd = d;
      bi = i;
    }
  });
  const to = targets[bi];
  const duration = Math.max(0.3, V.dist(h.pos, to) / RULES.shoot.speed);
  q.holder = null;
  q.flight = { kind: 'shot', from: V.clone(q.pos), to, elapsed: 0, duration, thrower: h.id, receiver: null, hoop: bi };
}

function looseAt(s: MatchState, pos: Vec3, vel: Vec3, noGrab: number) {
  const q = s.quaffle;
  q.holder = null;
  q.flight = null;
  q.pos = clampToPitch(V.clone(pos));
  q.vel = vel;
  q.noGrabFor = noGrab;
}

function resolveFlight(s: MatchState) {
  const q = s.quaffle;
  const f = q.flight!;
  const thrower = s.players[f.thrower];
  q.flight = null;

  if (f.kind === 'pass') {
    for (const o of s.players) {
      if (o.team === thrower.team || !active(o) || o.def.role !== 'chaser') continue;
      if (V.dist(o.pos, f.to) < RULES.pass.interceptRange && s.rng.chance(RULES.pass.interceptChance)) {
        q.holder = o.id;
        emit(s, 'interception', `${o.def.name} intercepts.`, o.team, o.id);
        return;
      }
    }
    const r = s.players[f.receiver!];
    const catchP = RULES.pass.catchBase + thrower.def.skill * RULES.pass.catchPerSkill;
    if (active(r) && V.dist(r.pos, f.to) < 6 && s.rng.chance(catchP)) {
      q.holder = r.id;
    } else {
      looseAt(s, f.to, V.v3(0, -2, 0), 0.3);
    }
    return;
  }

  // Shot
  const def = other(thrower.team);
  const K = keeperOf(s, def);
  const missP = clampN(RULES.shoot.missBase - thrower.def.skill * RULES.shoot.missPerSkill, 0.02, 0.9);
  if (s.rng.chance(missP)) {
    emit(s, 'miss', `${thrower.def.name} misses.`, thrower.team, thrower.id);
    const bounce = V.v3(attackDir(thrower.team) * 4, -2, s.rng.range(-3, 3));
    looseAt(s, V.add(f.to, bounce), V.v3(0, -2, 0), 0.3);
    return;
  }
  const dk = V.dist(K.pos, f.to);
  const saveP = active(K)
    ? clampN(RULES.shoot.saveBase + K.def.skill * RULES.shoot.savePerSkill - dk * RULES.shoot.saveFalloff, 0.03, 0.85)
    : 0.03;
  if (s.rng.chance(saveP)) {
    q.holder = K.id;
    s.restartTimer = RULES.restart.afterSave;
    emit(s, 'save', `${K.def.name} saves!`, def, K.id);
    return;
  }
  s.score[thrower.team] += RULES.points.goal;
  q.holder = K.id;
  q.pos = V.clone(K.pos);
  s.restartTimer = RULES.restart.afterGoal;
  emit(s, 'goal', `${thrower.def.name} scores! ${s.score[0]} to ${s.score[1]}.`, thrower.team, thrower.id);
}

function updateQuaffle(s: MatchState) {
  const q = s.quaffle;

  if (q.holder !== null) {
    const h = s.players[q.holder];
    q.pos = V.add(h.pos, V.v3(0, -0.6, 0));
    q.vel = V.clone(h.vel);
    if (!active(h)) {
      looseAt(s, q.pos, V.scale(h.vel, 0.5), 0.4);
      return;
    }
    if (s.restartTimer > 0) return;

    if (h.def.role === 'keeper') {
      tryPass(s, h);
      return;
    }

    // Tackles
    for (const o of s.players) {
      if (o.team === h.team || o.def.role !== 'chaser' || !active(o)) continue;
      if (V.dist(o.pos, h.pos) > RULES.tackle.range) continue;
      const p = RULES.tackle.chancePerSecond * DT * ((2 * o.def.skill) / (o.def.skill + h.def.skill));
      if (s.rng.chance(p)) {
        q.holder = o.id;
        emit(s, 'turnover', `${o.def.name} steals the Quaffle.`, o.team, o.id);
        return;
      }
    }

    const atk = s.dials[h.team].attack;
    const dx = Math.abs(hoopX(other(h.team)) - h.pos.x);
    const range = lerpN(RULES.shoot.rangeMin, RULES.shoot.rangeMax, atk);
    if (dx < range && s.rng.chance(RULES.shoot.perSecond * DT * (0.5 + atk))) {
      shoot(s, h);
      return;
    }
    const pressured = nearestOpponentDist(s, h) < RULES.pass.pressureDistance;
    const passRate = pressured ? RULES.pass.underPressurePerSecond : RULES.pass.basePerSecond;
    if (s.rng.chance(passRate * DT)) tryPass(s, h);
    return;
  }

  if (q.flight) {
    const f = q.flight;
    f.elapsed += DT;
    const k = Math.min(1, f.elapsed / f.duration);
    q.pos = V.lerp(f.from, f.to, k);
    q.pos.y += Math.sin(Math.PI * k) * (f.kind === 'pass' ? 2 : 1);
    if (k >= 1) resolveFlight(s);
    return;
  }

  // Loose: it drops, and the nearest eligible player grabs it.
  q.vel = V.v3(q.vel.x * 0.98, q.vel.y - RULES.quaffle.gravity * DT, q.vel.z * 0.98);
  q.pos = clampToPitch(V.add(q.pos, V.scale(q.vel, DT)));
  if (q.pos.y <= 1) q.vel.y = 0;
  q.noGrabFor = Math.max(0, q.noGrabFor - DT);
  if (q.noGrabFor > 0) return;
  let grabber: PlayerState | null = null;
  let gd = RULES.quaffle.grabRange;
  for (const p of s.players) {
    if (!active(p)) continue;
    const eligible =
      p.def.role === 'chaser' ||
      (p.def.role === 'keeper' && Math.abs(p.pos.x - hoopX(p.team)) < RULES.keeper.grabZone);
    if (!eligible) continue;
    const d = V.dist(p.pos, q.pos);
    if (d < gd) {
      gd = d;
      grabber = p;
    }
  }
  if (grabber) q.holder = grabber.id;
}

// ---------- Bludgers (the Beater target dial) ----------

function chooseBludgerTarget(s: MatchState, beater: PlayerState): PlayerState | null {
  const enemy = other(beater.team);
  const maxD = RULES.bludger.maxTargetDistance;
  const seeker = seekerOf(s, enemy);
  const q = s.quaffle;
  const carrier = q.holder !== null && s.players[q.holder].team === enemy ? s.players[q.holder] : null;
  const chasers = byRole(s, enemy, 'chaser').filter((c) => active(c) && V.dist(c.pos, beater.pos) < maxD);
  chasers.sort((a, b) => V.dist(a.pos, beater.pos) - V.dist(b.pos, beater.pos));
  const chaserPick = carrier && active(carrier) && V.dist(carrier.pos, beater.pos) < maxD ? carrier : chasers[0] ?? null;
  const seekerOk = active(seeker) && V.dist(seeker.pos, beater.pos) < maxD;
  if (s.chaseCalls[beater.team].beaters === 'attack' && chasing(s, enemy)) return seekerOk ? seeker : null;
  const wantSeeker = s.rng.chance(s.dials[beater.team].beaterTarget);
  if (wantSeeker && seekerOk) return seeker;
  return chaserPick ?? (seekerOk ? seeker : null);
}

function updateBludgers(s: MatchState) {
  const B = RULES.bludger;
  for (const b of s.bludgers) {
    b.cooldown = Math.max(0, b.cooldown - DT);

    if (b.flight) {
      const f = b.flight;
      const T = s.players[f.target];
      f.elapsed += DT;
      const d = V.sub(T.pos, b.pos);
      const step = Math.min(V.len(d), B.hitSpeed * DT);
      b.pos = V.add(b.pos, V.scale(V.norm(d), step));
      if (V.dist(b.pos, T.pos) < 1.5) {
        const beater = s.players[f.beater];
        let p = B.hitBase + beater.def.skill * B.hitPerSkill - T.def.speed * B.dodgePerSpeed;
        const guarded = byRole(s, T.team, 'beater').some((g) => active(g) && V.dist(g.pos, T.pos) < B.protectRange);
        const escorted =
          T.def.role === 'seeker' &&
          chasing(s, T.team) &&
          s.chaseCalls[T.team].beaters === 'escort' &&
          byRole(s, T.team, 'beater').some((g) => active(g) && V.dist(g.pos, T.pos) < B.protectRange);
        if (escorted) p -= RULES.chase.escortReduction;
        else if (guarded) p -= B.protectReduction;
        if (active(T) && s.rng.chance(p)) {
          T.stunnedFor = B.stunSeconds;
          emit(s, 'bludgerHit', `Bludger hits ${T.def.name}!`, beater.team, T.id);
        }
        b.flight = null;
        b.vel = V.scale(randomDir(s.rng), B.freeSpeed);
        b.cooldown = B.rehitCooldown;
      } else if (f.elapsed > B.flightTimeout) {
        b.flight = null;
        b.cooldown = B.rehitCooldown;
      }
      continue;
    }

    // Free Bludger: drifts towards the nearest player.
    let nearest: PlayerState | null = null;
    let nd = Infinity;
    for (const p of s.players) {
      if (!active(p)) continue;
      const d = V.dist(p.pos, b.pos);
      if (d < nd) {
        nd = d;
        nearest = p;
      }
    }
    if (nearest) {
      const desired = V.scale(V.norm(V.sub(nearest.pos, b.pos)), B.freeSpeed);
      b.vel = V.lerp(b.vel, desired, Math.min(1, 2 * DT));
    }
    b.pos = clampToPitch(V.add(b.pos, V.scale(b.vel, DT)));
    if (b.cooldown > 0) continue;

    if (nearest && nd < 1.2 && nearest.def.role !== 'beater' && s.rng.chance(B.strayHitChance)) {
      nearest.stunnedFor = B.strayStunSeconds;
      b.cooldown = B.rehitCooldown;
      b.vel = V.scale(randomDir(s.rng), B.freeSpeed);
      emit(s, 'bludgerHit', `A stray Bludger clips ${nearest.def.name}.`, undefined, nearest.id);
      continue;
    }

    // Random order so neither team always gets first swing.
    const beaters = s.players.filter((p) => p.def.role === 'beater' && active(p));
    if (s.rng.chance(0.5)) beaters.reverse();
    for (const beater of beaters) {
      if (V.dist(beater.pos, b.pos) > B.hitRange) continue;
      const call = s.chaseCalls[beater.team].beaters;
      if (call === 'escort' && chasing(s, beater.team)) continue;
      const attacking = call === 'attack' && chasing(s, other(beater.team));
      const swingRate = B.swingPerSecond * (attacking ? RULES.chase.attackSwingMultiplier : 1);
      if (!s.rng.chance(swingRate * DT)) continue;
      const target = chooseBludgerTarget(s, beater);
      if (!target) continue;
      b.flight = { target: target.id, beater: beater.id, elapsed: 0 };
      b.cooldown = B.rehitCooldown;
      break;
    }
  }
}

// ---------- Snitch ----------

function updateSnitch(s: MatchState) {
  const sn = s.snitch;
  const S = RULES.snitch;
  const order: TeamSide[] = s.rng.chance(0.5) ? [0, 1] : [1, 0];

  if (sn.visibleFor > 0) {
    sn.visibleFor -= DT;
    sn.wanderTimer -= DT;
    if (sn.wanderTimer <= 0) {
      sn.wanderTimer = s.rng.range(0.4, 1.2);
      let threat: PlayerState | null = null;
      for (const team of [0, 1] as TeamSide[]) {
        if (!s.seekerChasing[team]) continue;
        const sk = seekerOf(s, team);
        if (!threat || V.dist(sk.pos, sn.pos) < V.dist(threat.pos, sn.pos)) threat = sk;
      }
      const away = threat ? V.norm(V.sub(sn.pos, threat.pos)) : V.v3();
      sn.vel = V.scale(V.norm(V.add(away, V.scale(randomDir(s.rng), 0.9))), S.evadeSpeed);
    }
    sn.pos = clampToPitch(V.add(sn.pos, V.scale(sn.vel, DT)));
    sn.pos.y = Math.max(3, sn.pos.y);

    for (const team of order) {
      if (!s.seekerChasing[team]) continue;
      const sk = seekerOf(s, team);
      if (!active(sk) || V.dist(sk.pos, sn.pos) > S.catchRange) continue;
      let p = S.catchChance * (0.6 + sk.def.skill * 0.08);
      const rival = seekerOf(s, other(team));
      if (active(rival) && V.dist(rival.pos, sk.pos) < S.blockRange) p *= 0.5;
      if (s.rng.chance(p)) {
        s.score[team] += RULES.points.snitch;
        emit(s, 'snitchCaught', `${teamName(s, team)} Seeker catches the Snitch!`, team, sk.id);
        endMatch(s, 'Snitch caught.');
        return;
      }
    }

    if (sn.visibleFor <= 0) {
      sn.visibleFor = 0;
      sn.seenBy = [false, false];
      // A failed chase leaves every Seeker who chased shaken: slower to spot it next time.
      const failed = ([0, 1] as TeamSide[]).filter((t) => s.seekerChasing[t]);
      for (const t of failed) s.shakenFor[t] = RULES.chase.shakenSeconds;
      const who = failed.map((t) => `${teamName(s, t)} Seeker`).join(' and ');
      emit(s, 'snitchLost', failed.length ? `The Snitch escapes. ${who} shaken.` : 'The Snitch escapes.');
      s.seekerChasing = [false, false];
      s.chase = null;
    }
    return;
  }

  // Hidden: wanders slowly until a Seeker spots it.
  if (s.t < S.hiddenForAtLeast) return;
  sn.wanderTimer -= DT;
  if (sn.wanderTimer <= 0) {
    sn.wanderTimer = s.rng.range(2, 4);
    sn.vel = V.scale(randomDir(s.rng), S.hiddenSpeed);
  }
  sn.pos = clampToPitch(V.add(sn.pos, V.scale(sn.vel, DT)));
  for (const team of order) {
    const sk = seekerOf(s, team);
    if (!active(sk)) continue;
    const shaken = s.shakenFor[team] > 0 ? RULES.chase.shakenSightFactor : 1;
    const p = S.sightPerSecond * DT * (1 + s.t / S.sightGrowthSeconds) * (0.5 + sk.def.skill / 10) * shaken;
    if (!s.rng.chance(p)) continue;
    sn.visibleFor = s.rng.range(S.visibleMin, S.visibleMax);
    sn.seenBy = [team === 0, team === 1];
    const C = RULES.chase;
    sn.pos = clampToPitch(V.add(sk.pos, V.scale(randomDir(s.rng), s.rng.range(C.spawnMin, C.spawnMax))));
    sn.pos.y = Math.max(3, sn.pos.y);
    sn.wanderTimer = 0;
    s.chase = { leader: team, startedAt: s.t };
    emit(s, 'snitchSighted', `${teamName(s, team)} Seeker spots the Snitch! The chase is on.`, team, sk.id);
    for (const t of s.aiTeams) aiChaseCalls(s, t);
    return;
  }
}
