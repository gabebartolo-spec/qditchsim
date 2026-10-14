# Quidditch Sim: Development Plan

Source: [brainstorm of 2026-10-14](brainstorms/2026-10-14-quidditch-sim.md). Every design
decision here comes from that session. Anything not yet decided is marked
**Director decision** and must be settled by the director before the work that depends
on it starts. Technical suggestions are marked **Recommendation** and can be overruled.

---

## 1. What we are building

A free, fan-made quidditch management sim with the stylised, simple beauty of Golden Lap.
You play a team manager. You start with a Hogwarts house team, win your way to the pro
league, and build a dynasty. Matches play out in a stylised isometric view, and you
steer them live with three tactical dials.

### Guiding rules
These come straight from the director's decisions and apply to every phase.

1. **Core test.** Every feature must make the climb from house team to pro dynasty more
   meaningful. If it doesn't, cut it.
2. **The look comes first.** The visual style is the main thing borrowed from Golden Lap.
   A feature that looks cluttered is not finished.
3. **Prove the match first.** No management layer is built until a single match is fun.
4. **Free fan project.** Harry Potter names are used. The game is never sold, and no
   monetisation of any kind is added (no ads, donations-for-content or paid builds).
5. **Simplicity.** When two versions of a feature serve the core test equally, build the
   one with fewer systems, numbers and screens.

---

## 2. Phase overview

| Phase | Goal | Exit gate |
|---|---|---|
| 0. Foundations | Set the vision, the look and the tech | Director signs off on the vision doc and art direction |
| 1. One-match prototype | One playable, fun match | Director playtests and calls the match fun |
| 2. Match polish | Dynamic camera moments and feel | Director signs off on the camera moments |
| 3. Hogwarts career | A full school career | A complete Hogwarts career is playable start to finish |
| 4. Step up to the pros | The carry-over from Hogwarts to pro | Reputation, players and skills carry over correctly |
| 5. Pro league | A full pro dynasty | A multi-season pro career is playable |
| 6. Fan release | Free public build | Release checklist complete |

Phases run in order. Each one ends with a director playtest. A later phase does not start
until its gate is passed.

---

## 3. Phase 0: Foundations

**Goal:** settle what can't be guessed before code is written.

### Tasks
- **Vision doc** (`docs/00_VISION.md`): the vision, the pillars, the hard rules and the
  core test, in the director's words. The brainstorm supplies the core test and the
  fan-project rule.
- **Art direction sheet:** palette, line and shape style, how players, brooms, hoops, the
  pitch and the stands are drawn, and the UI typography. Golden Lap is the reference.
- **Engine and stack choice.** Decided: the game is built in HTML and runs in the
  browser. The engine within that is still open.
- **Repo setup:** project skeleton, build script, a CLAUDE.md with the hard rules,
  and a basic CI build.
- **Fan-project notice:** a README line saying this is an unofficial, non-commercial fan
  work and isn't affiliated with Warner Bros. or J.K. Rowling.

### Director decisions
- The look. Palette, era feel and how characters and the pitch are drawn.
- The engine. **Recommendation:** Three.js with a fixed orthographic camera for the
  match, plain HTML and CSS for the management screens, and TypeScript built with Vite.
  This fits if the art is flat, geometric shapes. If the director wants hand-drawn 2D
  sprites, Phaser is the better fit.
- Platforms. Decided: browser, hosted on itch.io. Whether it also needs to work on
  phones is still open.
- Whether the takedown risk of a fan project is accepted. This was raised but not
  confirmed.

### Exit gate
Vision doc and art direction sheet are written and signed off by the director.

---

## 4. Phase 1: One-match prototype

**Goal:** prove that one match is fun to watch and to steer. Dynamic camera moments are
deliberately left out of this phase.

### 4.1 Match simulation
- Two teams of seven: three Chasers, two Beaters, one Keeper and one Seeker.
- The Quaffle: Chasers pass, carry and shoot. Goals are worth 10 points.
- Bludgers: Beaters hit them at targets. A hit disrupts or knocks a player out of a
  play.
- The Snitch: it appears, moves and can be spotted and chased. A catch is worth 150
  points and ends the match.
- Fouls and rules: in scope for this phase.
- **Recommendation:** run the sim on a fixed tick, separate from rendering, with a
  seeded random number generator. This makes matches replayable for debugging and
  balancing, and lets matches be simulated without drawing them later for
  background fixtures in career mode.

**Director decision:** which fouls and rules are in, and how penalties work.

### 4.2 Player stats and traits
In scope for this phase.

**Director decision:** which stats exist for each position, which traits exist, and how
they affect the three dials. Keep the list short enough to read at a glance.

### 4.3 The three tactical dials
Each dial can be changed at any time, live, while the match runs.

| Dial | What it controls |
|---|---|
| Snitch timing | When the Seeker goes for the Snitch, versus holding off until the score is closer |
| Beater targets | Whether Beaters hit the enemy Seeker, the Chasers, or a mix |
| Attack versus defend | How far the Chasers push forward, versus protecting the Keeper |

**Director decisions:**
- Whether each dial is a slider, a few fixed settings, or something else.
- How the dial UI fits the look without covering the match.
- Whether the match runs in real time, sped up, or with a speed control.

### 4.4 Isometric match view
- A stylised isometric pitch with three hoops at each end.
- All fourteen players, the Quaffle, two Bludgers and the Snitch are drawn on the pitch.
- **Ground shadows** show how high each player is flying.
- A minimal scoreboard and match clock.
- How the Snitch is shown: **director decision**. It's tiny and hard to spot in the
  books, which could be a feature or a readability problem.

### 4.5 Opponent AI
The opposing manager sets and adjusts its own dials, so the match is a contest of
decisions, not just stats.

### 4.6 Playtest and balance
- A debug overlay showing dial settings, stats and sim events.
- A batch mode that sims hundreds of matches and reports score spreads, match length and
  how often the Snitch catch decides the result.
- **Recommendation:** check that each dial actually changes outcomes. A dial that
  doesn't change outcomes fails the core test.

### Exit gate
The director plays several matches and says:
- the match is fun to watch,
- the dials create real choices,
- the look matches the art direction.

If any of these fails, iterate in Phase 1. Do not move on.

---

## 5. Phase 2: Match polish

**Goal:** add the dynamic camera moments and the feel of a big match.

### Tasks
- Camera cutaways triggered by goals, Snitch sightings and Bludger hits.
- Smooth transitions from the isometric view to each cutaway and back.
- Rules that stop cutaways from firing too often or hiding a decision the player needs to
  make.
- Sound and crowd reactions, if the director wants them.

### Director decisions
- What each cutaway looks like: angle, length and framing.
- Whether play pauses, slows or continues during a cutaway.
- Whether the player can turn cutaways off.
- Sound and music: wanted or not, and what style.

### Exit gate
The director signs off on the camera moments in play.

---

## 6. Phase 3: Hogwarts career

**Goal:** a full school career that passes the core test on its own.

### Tasks
- **Houses and the House Cup:** the four houses, a season of fixtures and a trophy.
- **Students:** players who join, develop each year and then graduate.
- **Training and development:** how students improve between matches.
- **Manager reputation:** a value that grows with results and is visible to the player.
- **Manager skills:** skills the manager earns over time, for example better tactics or
  scouting.
- **Season loop screens:** squad, fixtures, standings and match preview, all in the
  Golden Lap style.
- **Save and load.**
- **Background matches:** other house matches simulated without being drawn, using the
  Phase 1 sim.

### Director decisions
- Do you manage one house for a whole career, or can you move between houses?
- How many years a Hogwarts career lasts, and what "winning there" means to unlock the
  pros.
- How new students arrive: random, scouted or chosen.
- Which manager skills exist and how they're earned.
- Whether school life such as exams, injuries or the Hospital Wing affects players.

### Exit gate
A full Hogwarts career, from first season to qualifying for the pros, is playable start
to finish and passes the director playtest.

---

## 7. Phase 4: Step up to the pros

**Goal:** make the move from Hogwarts to the pro league the emotional peak of the
dynasty.

### Tasks
- **Reputation carries over:** your Hogwarts record decides which pro clubs offer you a
  job.
- **Players carry over:** students you developed graduate and can be signed by your pro
  club.
- **Manager skills carry over** into the pro game.
- **The transition moment:** a screen or sequence marking the step up.

### Director decisions
- Whether you choose your pro club or are offered one.
- Whether graduates always come with you, or other clubs can sign them first.
- What happens if you don't win at Hogwarts. Is it game over, a retry, or a lesser path?

### Exit gate
All three carry-overs work in play, and the transition feels earned.

---

## 8. Phase 5: Pro league

**Goal:** a multi-season pro dynasty.

### Tasks
- **League and clubs:** the pro league structure and its clubs.
- **Transfers and contracts:** signing, selling and releasing players.
- **Club finances:** whatever money the manager handles.
- **Long-term arc:** player ageing, retirement, legends and a club history screen that
  records your dynasty.
- **Possibly a world stage,** for example the Quidditch World Cup.

### Director decisions
- Which league to use. The books name the British and Irish Quidditch League. Decide
  whether to use canon clubs only or add invented ones.
- How deep the finances go. The simplicity rule argues for shallow.
- Whether there's an end to a career, or it runs forever.
- Whether international or World Cup play is in scope.

### Exit gate
A multi-season pro career is playable, and the dynasty history shows the full climb from
house team to pro titles.

---

## 9. Phase 6: Fan release

**Goal:** a free public build that keeps the fan-project rule.

### Release checklist
- [ ] Unofficial fan work notice in the game, the README and the download page.
- [ ] No monetisation of any kind.
- [ ] No official Warner Bros. or Harry Potter logos or copied artwork. Use original art
      only.
- [ ] Build distributed free on itch.io as an HTML game: a zip with `index.html` at the
      root, using only relative asset paths.
- [ ] A plan for a takedown request, such as renaming to original names, already drafted.

Decided: the game is hosted on itch.io.

---

## 10. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Rights takedown | The project can't be distributed | Keep it free, use original art only, and keep names easy to swap |
| Scope creep | The project never ships | Phase gates, and the core test applied to every feature |
| Match isn't fun | Nothing else matters | Phase 1 is a hard gate before any career work |
| Height is hard to read in isometric | Matches confuse the player | Ground shadows, tested early in Phase 1 |
| The Snitch decides every match | The dials feel pointless | Balance with batch sims in Phase 1 |
| Two projects at once | ARD and this split the director's time | Reuse ARD's tech, and keep each phase small |

---

## 11. Engineering recommendations
Technical suggestions that keep the design rules safe. The director can overrule any.

- **Keep the sim separate from rendering.** The same match code then powers drawn
  matches, background fixtures and batch balancing.
- **Put content in data.** Players, houses, clubs, names and rules go in data files,
  not code. This also makes a rename easy if a takedown happens.
- **Make sims deterministic** with seeded randomness, so any match can be replayed
  exactly.
- **Write automated tests for the rules,** including scoring, the Snitch ending the
  match, and carry-over between stages.

---

## 12. Next actions
1. Director writes or dictates the vision doc and the art direction for Phase 0.
2. Director chooses the engine and platforms.
3. Phase 0 tasks are assigned. Building starts only once the director assigns them.
