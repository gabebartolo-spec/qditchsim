# Quidditch Sim: project rules

The director designs this game. AI helps build it but does not make design decisions.
Anything marked **Director decision** in `docs/DEVELOPMENT_PLAN.md` must not be decided
in code or docs without the director.

## Always loaded

Claude Code imports these core documents in full at every session start (the `@` lines below),
so they are part of this file: read them as rules, never skim or skip them.

@docs/DEVELOPMENT_PLAN.md
@docs/PHASE1_PROVISIONAL.md

## Hard rules
- **Core test:** every feature must make the climb from house team to pro dynasty more
  meaningful.
- **Free fan project:** never add monetisation of any kind. No official logos or copied
  artwork. Keep the fan-work notice in the README and in the game.
- **Prove the match first:** no career or management code until the director signs off
  that one match is fun (Phase 1 gate).
- **The look is the director's:** never invent final art, palette or style. Placeholder
  art must be neutral grey and labelled as placeholder.
- **Desktop browser first.** Phones are not a target yet.
- **itch.io build:** all asset paths stay relative (`base: './'` in Vite).

## Engineering conventions
- Keep the match simulation separate from rendering. Sim code goes in `src/sim/` and
  must not import Three.js or touch the DOM.
- Make sims deterministic with a seeded random number generator.
- Put content (players, houses, clubs, names, rules) in data files, not code.
- Use HTML and CSS for menus and management screens. Use Three.js only for the match.

## Checks before pushing
```
npm run typecheck
npm test
npm run build
```
Use `npm run batch` to check balance after changing anything in `src/data/rules.json`.
