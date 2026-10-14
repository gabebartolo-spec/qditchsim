export type Role = 'chaser' | 'beater' | 'keeper' | 'seeker';
export type TeamSide = 0 | 1;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** PROVISIONAL stats: 1 to 10. The real stat list is a director decision. */
export interface PlayerDef {
  name: string;
  role: Role;
  speed: number;
  skill: number;
}

export interface TeamDef {
  id: string;
  name: string;
  players: PlayerDef[];
}

/** The three tactical dials, each from 0 to 1. */
export interface Dials {
  /** 0 = hold off for a better score, 1 = go for the Snitch now. */
  snitchTiming: number;
  /** 0 = Beaters target Chasers, 1 = Beaters target the Seeker. */
  beaterTarget: number;
  /** 0 = defend, 1 = attack. */
  attack: number;
}

export interface PlayerState {
  id: number;
  team: TeamSide;
  def: PlayerDef;
  pos: Vec3;
  vel: Vec3;
  stunnedFor: number;
}

export interface QuaffleFlight {
  kind: 'pass' | 'shot';
  from: Vec3;
  to: Vec3;
  elapsed: number;
  duration: number;
  thrower: number;
  receiver: number | null;
  hoop: number | null;
}

export interface QuaffleState {
  pos: Vec3;
  vel: Vec3;
  holder: number | null;
  flight: QuaffleFlight | null;
  noGrabFor: number;
}

export interface BludgerState {
  pos: Vec3;
  vel: Vec3;
  flight: { target: number; beater: number; elapsed: number } | null;
  cooldown: number;
}

export interface SnitchState {
  pos: Vec3;
  vel: Vec3;
  /** Seconds the Snitch stays visible. 0 means hidden. */
  visibleFor: number;
  seenBy: [boolean, boolean];
  wanderTimer: number;
}

export type MatchEventType =
  | 'goal'
  | 'save'
  | 'miss'
  | 'turnover'
  | 'interception'
  | 'bludgerHit'
  | 'snitchSighted'
  | 'seekerDive'
  | 'snitchLost'
  | 'snitchCaught'
  | 'end';

export interface MatchEvent {
  t: number;
  type: MatchEventType;
  text: string;
  team?: TeamSide;
  player?: number;
}
