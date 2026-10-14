# Quidditch Sim

A stylised quidditch management sim, inspired by Golden Lap. You manage a Hogwarts house
team, win your way to the pro league, and build a dynasty.

> **Unofficial fan project.** This is a free, non-commercial fan work. It is not
> affiliated with, endorsed by or connected to Warner Bros., Wizarding World Digital or
> J.K. Rowling. Harry Potter, Hogwarts, Quidditch and related names are trademarks of
> their owners. The game will never be sold or monetised.

## Status
Phase 1, the one-match prototype. You manage the Home team through a full match, steering
it live with three tactical dials, against an AI opponent. All art and many rules are
placeholders, listed in [docs/PHASE1_PROVISIONAL.md](docs/PHASE1_PROVISIONAL.md).

Controls: drag the dials, use the speed buttons or Space to pause, and press D for the
debug overlay. Add `?seed=123` to the URL to replay a specific match.

- [Development plan](docs/DEVELOPMENT_PLAN.md)
- [Concept brainstorm](docs/brainstorms/2026-10-14-quidditch-sim.md)

## Tech
Three.js for the match view, plain HTML and CSS for menus, TypeScript, built with Vite.
Targets desktop browsers first. Hosted on itch.io.

## Commands
Requires Node 20 or later.

```
npm install
npm run dev           # local dev server with hot reload
npm run typecheck     # TypeScript checks
npm test              # rule tests
npm run batch         # sim hundreds of matches and report balance
npm run build         # production build into dist/
npm run package:itch  # build, then zip into build/qditchsim-itch.zip
```

## Publishing to itch.io
1. Run `npm run package:itch`.
2. On itch.io, create a project and set **Kind of project** to **HTML**.
3. Upload `build/qditchsim-itch.zip` and tick **This file will be played in the browser**.
4. Set the viewport to 1280 by 720 and enable the fullscreen button.
