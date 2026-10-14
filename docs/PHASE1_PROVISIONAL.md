# Phase 1: provisional choices awaiting the director

The one-match prototype needed values for things the director hasn't decided yet. Each one
below is a **placeholder**, not a decision. Approve, change or replace them. Tuning numbers
live in `src/data/rules.json` and team data in `src/data/teams.json`, so most changes are
data edits, not code changes.

## Director decisions still open

| Area | What the prototype does for now | Where |
|---|---|---|
| The look | Neutral greys, primitive shapes, system font | `src/render/matchView.ts`, `src/style.css` |
| Player stats and traits | Two stats, `speed` and `skill`, each 1 to 10. Every player is 5. No traits. | `src/data/teams.json` |
| Fouls and penalties | **Not implemented.** No fouls exist yet. | — |
| Dial form | Three sliders from 0 to 1 | `index.html` |
| Dial UI placement | Bottom-right panel | `src/style.css` |
| How the Snitch is shown | Hidden until sighted, then a small white ball | `src/render/matchView.ts` |
| Match speed | Real time at 1×, with pause, 2×, 4× and 8× | `index.html`, `src/main.ts` |
| Team names | "Home" and "Away" | `src/data/teams.json` |
| Pitch and hoop sizes | 150 by 55 metre oval; hoops at 12, 15 and 12 metres | `src/data/rules.json` |

## How the three dials work right now

These are placeholder rules. The director decides what each dial should mean.

- **Snitch timing.** Sets how far ahead your team must be after a catch before your Seeker
  dives. At "Hold off" the Seeker only dives while you're level or ahead. In the middle it
  dives whenever a catch would win. At "Go now" it always dives. While holding off, the
  Seeker shadows the Snitch and marks the enemy Seeker, which halves their catch chance.
- **Beater targets.** The chance that each Beater swing goes at the enemy Seeker rather
  than a Chaser. Beaters prefer the Quaffle carrier when they target Chasers.
- **Chasers: defend to attack.** Moves the support Chasers forward or back, widens the
  shooting range and raises how often they shoot. Below 0.35 one Chaser stays back as a
  safety.

## Other placeholder rules

- **The Snitch stays hidden for at least 90 seconds,** and gets easier to spot as the match
  goes on.
- **After 20 minutes both Seekers dive regardless of the dial,** so a match can't stall
  forever. There's also a hard stop at 30 minutes.
- **A Bludger hit stuns a player for 4 seconds.** A carrier drops the Quaffle and a Seeker
  loses the Snitch.
- **The opponent manager** re-sets its dials every 12 seconds based on the score.

## Balance findings for the director

From `npm run batch` with 120 to 150 matches per setting and identical teams:

| Measure | Result |
|---|---|
| Median match length | About 5 minutes |
| Goals per match | About 13 in total |
| Bludger hits per match | About 35 |
| Home win rate with equal dials | About 50%, so no side bias |
| Matches won by the team that caught the Snitch | **100%** |

**The Snitch decides every match.** With about 13 goals in a match, teams are rarely 15
goals apart, so the 150-point catch always wins. This makes the Snitch timing dial matter
only in rare games, and makes Chaser play feel secondary. Options for the director to
consider: more goals per match, a smaller Snitch value, or accept it as part of the
fiction. This is a design call, so it hasn't been changed.

The other two dials do change results:
- **Beater targets** shifts hits clearly between the enemy Seeker and the Chasers.
- **Attack** moves your goals from about 1 per match at full defence to about 10 at full
  attack.
