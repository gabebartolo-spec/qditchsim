import type { ChaseCalls, Dials, MatchEvent, MatchState } from '../sim';

const $ = <T extends HTMLElement>(sel: string) => {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`Missing ${sel}`);
  return el;
};

/** Events worth showing in the feed. Turnovers and misses only appear in the debug log. */
const FEED_TYPES = new Set(['goal', 'save', 'bludgerHit', 'snitchSighted', 'seekerDive', 'snitchLost', 'snitchCaught']);

export const formatClock = (t: number) => {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export interface HudCallbacks {
  onDial(dials: Partial<Dials>): void;
  onChaseCalls(calls: Partial<ChaseCalls>): void;
  onSpeed(speed: number): void;
  onDebug(): void;
  onAgain(): void;
}

export class Hud {
  private feed = $<HTMLOListElement>('#feed');
  private shownEvents = 0;
  private dialKeys: (keyof Dials)[] = ['snitchTiming', 'beaterTarget', 'attack'];

  constructor(cb: HudCallbacks) {
    for (const key of this.dialKeys) {
      $<HTMLInputElement>(`#dial-${key}`).addEventListener('input', (e) => {
        cb.onDial({ [key]: Number((e.target as HTMLInputElement).value) });
      });
    }
    document.querySelectorAll<HTMLButtonElement>('[data-beaters]').forEach((b) =>
      b.addEventListener('click', () => cb.onChaseCalls({ beaters: b.dataset.beaters as ChaseCalls['beaters'] })),
    );
    document.querySelectorAll<HTMLButtonElement>('[data-blockers]').forEach((b) =>
      b.addEventListener('click', () => cb.onChaseCalls({ blockers: Number(b.dataset.blockers) as ChaseCalls['blockers'] })),
    );
    document.querySelectorAll<HTMLButtonElement>('#speed [data-speed]').forEach((b) =>
      b.addEventListener('click', () => cb.onSpeed(Number(b.dataset.speed))),
    );
    $('#debug-toggle').addEventListener('click', cb.onDebug);
    $('#again').addEventListener('click', cb.onAgain);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'd' || e.key === 'D') cb.onDebug();
      if (e.key === ' ') {
        e.preventDefault();
        cb.onSpeed(-1);
      }
    });
  }

  reset(s: MatchState) {
    this.feed.innerHTML = '';
    this.shownEvents = 0;
    $('#home-name').textContent = s.teams[0].name;
    $('#away-name').textContent = s.teams[1].name;
    for (const key of this.dialKeys) $<HTMLInputElement>(`#dial-${key}`).value = String(s.dials[0][key]);
    $('#end').hidden = true;
  }

  setSpeed(speed: number) {
    document.querySelectorAll<HTMLButtonElement>('#speed [data-speed]').forEach((b) =>
      b.setAttribute('aria-pressed', String(Number(b.dataset.speed) === speed)),
    );
  }

  setDebugVisible(on: boolean) {
    $('#debug').hidden = !on;
    $('#debug-toggle').setAttribute('aria-pressed', String(on));
  }

  update(s: MatchState, seed: number, debug: boolean) {
    $('#score').textContent = `${s.score[0]} – ${s.score[1]}`;
    $('#clock').textContent = formatClock(s.t);

    for (; this.shownEvents < s.events.length; this.shownEvents++) {
      const e = s.events[this.shownEvents];
      if (FEED_TYPES.has(e.type)) this.pushFeed(e);
    }

    const inChase = s.chase !== null && !s.over;
    $('#chase-calls').hidden = !inChase;
    $('#chase-banner').hidden = !inChase;
    if (inChase) {
      const leader = s.teams[s.chase!.leader].name;
      $('#chase-banner').textContent = `Snitch chase! ${leader} Seeker has the head start`;
      const calls = s.chaseCalls[0];
      document.querySelectorAll<HTMLButtonElement>('[data-beaters]').forEach((b) =>
        b.setAttribute('aria-pressed', String(b.dataset.beaters === calls.beaters)),
      );
      document.querySelectorAll<HTMLButtonElement>('[data-blockers]').forEach((b) =>
        b.setAttribute('aria-pressed', String(Number(b.dataset.blockers) === calls.blockers)),
      );
    }

    if (s.over && $('#end').hidden) {
      $('#end-title').textContent =
        s.winner === null ? 'Draw' : s.winner === 0 ? `${s.teams[0].name} win` : `${s.teams[1].name} win`;
      $('#end-text').textContent = `${s.teams[0].name} ${s.score[0]} – ${s.score[1]} ${s.teams[1].name}, after ${formatClock(s.t)}.`;
      $('#end').hidden = false;
    }

    if (debug) {
      const d = (x: Dials) => `snitch ${x.snitchTiming.toFixed(2)}  beaters ${x.beaterTarget.toFixed(2)}  attack ${x.attack.toFixed(2)}`;
      const recent = s.events.slice(-8).map((e) => `${formatClock(e.t)} ${e.type}: ${e.text}`);
      $('#debug').textContent = [
        `seed ${seed}   t ${s.t.toFixed(1)}s`,
        `${s.teams[0].name}: ${d(s.dials[0])}`,
        `${s.teams[1].name} (AI): ${d(s.dials[1])}`,
        `Snitch ${s.snitch.visibleFor > 0 ? `visible ${s.snitch.visibleFor.toFixed(1)}s` : 'hidden'}  chasing ${s.seekerChasing}`,
        `Chase ${s.chase ? `led by ${s.teams[s.chase.leader].name}` : 'none'}  calls ${JSON.stringify(s.chaseCalls)}`,
        `Shaken ${s.shakenFor.map((x) => x.toFixed(0)).join(' / ')}s`,
        `Quaffle holder ${s.quaffle.holder === null ? '-' : s.players[s.quaffle.holder].def.name}`,
        '',
        ...recent,
      ].join('\n');
    }
  }

  private pushFeed(e: MatchEvent) {
    const li = document.createElement('li');
    const time = document.createElement('time');
    time.textContent = formatClock(e.t);
    li.append(time, e.text);
    this.feed.prepend(li);
    while (this.feed.children.length > 8) this.feed.lastElementChild?.remove();
  }
}
