import { describe, expect, it } from 'vitest';
import { createMatch, simulate, step, setDials, RULES, PLACEHOLDER_TEAMS, type TeamDef } from './index';

const play = (seed: number) => simulate(createMatch({ seed, teams: PLACEHOLDER_TEAMS, aiTeams: [1] }));

describe('match simulation', () => {
  it('is deterministic for the same seed', () => {
    const a = play(42);
    const b = play(42);
    expect(b.score).toEqual(a.score);
    expect(b.t).toBe(a.t);
    expect(b.events).toEqual(a.events);
  });

  it('produces different matches for different seeds', () => {
    const results = new Set([1, 2, 3, 4, 5].map((s) => `${play(s).score}`));
    expect(results.size).toBeGreaterThan(1);
  });

  it('always ends, and the score is goals plus the Snitch', () => {
    for (let seed = 100; seed < 130; seed++) {
      const m = play(seed);
      expect(m.over).toBe(true);
      expect(m.t).toBeLessThanOrEqual(RULES.match.capSeconds + RULES.tickSeconds);
      for (const team of [0, 1] as const) {
        const goals = m.events.filter((e) => e.type === 'goal' && e.team === team).length;
        const caught = m.events.some((e) => e.type === 'snitchCaught' && e.team === team);
        expect(m.score[team]).toBe(goals * RULES.points.goal + (caught ? RULES.points.snitch : 0));
      }
    }
  });

  it('ends the match on the Snitch catch, which is the last play', () => {
    const m = play(7);
    const catchIdx = m.events.findIndex((e) => e.type === 'snitchCaught');
    expect(catchIdx).toBeGreaterThanOrEqual(0);
    expect(m.events.slice(catchIdx + 1).map((e) => e.type)).toEqual(['end']);
  });

  it('never lets the Snitch be seen before the minimum hidden time', () => {
    for (let seed = 200; seed < 220; seed++) {
      const first = play(seed).events.find((e) => e.type === 'snitchSighted');
      if (first) expect(first.t).toBeGreaterThanOrEqual(RULES.snitch.hiddenForAtLeast);
    }
  });

  it('clamps dials to the 0 to 1 range', () => {
    const m = createMatch({ seed: 1, teams: PLACEHOLDER_TEAMS });
    setDials(m, 0, { attack: 3, snitchTiming: -1 });
    expect(m.dials[0]).toMatchObject({ attack: 1, snitchTiming: 0, beaterTarget: 0.5 });
  });

  it('rejects a team without the right positions', () => {
    const bad: TeamDef = { ...PLACEHOLDER_TEAMS[0], players: PLACEHOLDER_TEAMS[0].players.slice(1) };
    expect(() => createMatch({ seed: 1, teams: [bad, PLACEHOLDER_TEAMS[1]] })).toThrow(/keeper/);
  });

  it('starts a chase on a sighting, led by the spotting team', () => {
    const m = createMatch({ seed: 3, teams: PLACEHOLDER_TEAMS });
    while (!m.over && !m.chase) step(m);
    const sighting = m.events.find((e) => e.type === 'snitchSighted')!;
    expect(m.chase).not.toBeNull();
    expect(m.chase!.leader).toBe(sighting.team);
  });

  it('gives the spotting Seeker a head start before the rival can chase', () => {
    for (let seed = 300; seed < 320; seed++) {
      const m = createMatch({ seed, teams: PLACEHOLDER_TEAMS });
      while (!m.over && !m.chase) step(m);
      if (m.over) continue;
      const { leader, startedAt } = m.chase!;
      const rival = leader === 0 ? 1 : 0;
      while (!m.over && m.chase && m.t < startedAt + RULES.chase.rivalReactionSeconds - RULES.tickSeconds) {
        step(m);
        expect(m.seekerChasing[rival]).toBe(false);
      }
    }
  });

  it('only catches the Snitch during a chase', () => {
    for (let seed = 400; seed < 420; seed++) {
      const m = createMatch({ seed, teams: PLACEHOLDER_TEAMS });
      while (!m.over) {
        const inChase = m.chase !== null;
        step(m);
        if (m.events.at(-2)?.type === 'snitchCaught') expect(inChase).toBe(true);
      }
    }
  });

  it('shakes every Seeker who chased when the Snitch escapes', () => {
    for (let seed = 500; seed < 540; seed++) {
      const m = createMatch({ seed, teams: PLACEHOLDER_TEAMS });
      while (!m.over) {
        const chasers = [...m.seekerChasing];
        step(m);
        if (m.events.at(-1)?.type === 'snitchLost' && m.events.at(-1)!.t === m.t) {
          expect(m.chase).toBeNull();
          chasers.forEach((c, t) => {
            if (c) expect(m.shakenFor[t]).toBeCloseTo(RULES.chase.shakenSeconds, 5);
          });
          return;
        }
      }
    }
    throw new Error('No escape happened in the sampled seeds');
  });
});
