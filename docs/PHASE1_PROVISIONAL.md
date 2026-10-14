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

## The Snitch chase

**Decided by the director:** the chase is a second phase. The first Seeker to spot the
Snitch gets a head start. Quaffle play continues. The opposition can stop the chase with
Bludgers, their Seeker cutting in, and players blocking the path. The manager gets
chase-only calls. A failed chase leaves the Seeker shaken.

**Placeholders inside that structure:**

| Area | What the prototype does for now |
|---|---|
| The head start | The rival Seeker can't react for 1.5 seconds |
| Beater call | Keep playing, escort our Seeker, or attack their Seeker |
| Blocker call | Send none, one or two Chasers to block the rival Seeker |
| Blocking effect | An opposing player near a chasing Seeker slows them to 75% speed |
| Escort effect | Escorting Beaters cut the Bludger hit chance on your Seeker, but stop swinging |
| Attack effect | Attacking Beaters swing five times as often, only at the rival Seeker |
| Shaken | 90 seconds at 40% of the normal spotting chance |
| Chase speed | The game drops to 1× when a chase starts, so you can make calls |
| Chase calls persist | Your calls stay set between chases in the same match |
| The Snitch timing dial | Still decides whether your Seeker commits once the chase starts |

## Other placeholder rules

- **The Snitch stays hidden for at least 90 seconds,** and gets easier to spot as the match
  goes on.
- **After 20 minutes both Seekers dive regardless of the dial,** so a match can't stall
  forever. There's also a hard stop at 30 minutes.
- **A Bludger hit stuns a player for 4 seconds.** A carrier drops the Quaffle and a Seeker
  loses the Snitch.
- **The opponent manager** re-sets its dials every 12 seconds based on the score.

## Balance findings for the director

From `npm run batch` with 150 matches per setting and identical teams:

| Measure | Result |
|---|---|
| Median match length | About 5 minutes |
| Goals per match | About 11 in total |
| Snitch chases per match | About 2.4 |
| Median chase length | About 16 seconds |
| Chases that end in a catch | About 42% |
| Catches made by the Seeker with the head start | About 60% |
| Home win rate with equal settings | About 50%, so no side bias |

**The chase made the Snitch contested.** The head start matters, but four in ten catches
go to the Seeker who was behind, and most chases fail.

**The chase calls change results.** Home's win rate when the away team plays normally:

| Home's chase calls | Home win rate |
|---|---|
| Keep playing, no blockers | About 47% |
| Attack their Seeker | About 59% |
| Two blockers | About 55% |
| Attack and two blockers | About 66% |

**Escort is the counter to attack.** Against an attacking opponent, escorting lifts home's
win rate from about 34% to 48%.

**Still true: the catch decides the match.** The team that catches the Snitch still wins
every match, because the goal gap rarely reaches 150. The chase makes that catch earned
rather than random. Whether goals should matter more is still the director's call.

The original dials still work:
- **Beater targets** shifts hits between the enemy Seeker and the Chasers.
- **Attack** moves your goals from about 1 per match at full defence to about 10 at full
  attack.
- **Snitch timing** only matters in the rare games where a team trails badly.
