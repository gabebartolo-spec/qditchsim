import { describe, expect, it } from 'vitest';
import { createMatch, simulate, setDials, RULES, PLACEHOLDER_TEAMS, type TeamDef } from './index';

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
});
