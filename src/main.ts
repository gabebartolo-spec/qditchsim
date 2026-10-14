import { createMatch, step, setDials, setChaseCalls, DT, PLACEHOLDER_TEAMS, type MatchState } from './sim';
import { MatchView, snapshot, type Snapshot } from './render/matchView';
import { Hud } from './ui/hud';

const canvas = document.querySelector<HTMLCanvasElement>('#match')!;
const labelHost = document.querySelector<HTMLElement>('#labels')!;

const newSeed = () => (Math.random() * 2 ** 31) | 0;
const params = new URLSearchParams(location.search);
let seed = params.has('seed') ? Number(params.get('seed')) : newSeed();

// The player manages team 0. The opponent manager AI sets team 1's dials.
let state: MatchState = createMatch({ seed, teams: PLACEHOLDER_TEAMS, aiTeams: [1] });
let prev: Snapshot = snapshot(state);
let speed = 1;
let lastSpeed = 1;
let debug = false;
let acc = 0;

const view = new MatchView(canvas, labelHost, state);
const hud = new Hud({
  onDial: (d) => setDials(state, 0, d),
  onChaseCalls: (c) => setChaseCalls(state, 0, c),
  onSpeed: (s) => {
    if (s < 0) s = speed === 0 ? lastSpeed : 0; // Space toggles pause.
    if (s > 0) lastSpeed = s;
    speed = s;
    hud.setSpeed(speed);
  },
  onDebug: () => {
    debug = !debug;
    view.setDebug(debug);
    hud.setDebugVisible(debug);
  },
  onAgain: () => {
    seed = newSeed();
    state = createMatch({ seed, teams: PLACEHOLDER_TEAMS, aiTeams: [1] });
    prev = snapshot(state);
    acc = 0;
    hud.reset(state);
  },
});
hud.reset(state);
hud.setSpeed(speed);

window.addEventListener('resize', () => view.resize());
view.resize();

const MAX_STEPS_PER_FRAME = 200;
let last = performance.now();
function frame(now: number) {
  const realDt = Math.min(0.25, (now - last) / 1000);
  last = now;
  acc += realDt * speed;
  let steps = 0;
  while (acc >= DT && !state.over && steps < MAX_STEPS_PER_FRAME) {
    prev = snapshot(state);
    const wasChase = state.chase !== null;
    step(state);
    acc -= DT;
    steps++;
    // PROVISIONAL: drop to 1x when a chase starts so the manager can make chase calls.
    if (!wasChase && state.chase !== null && speed > 1) {
      speed = 1;
      hud.setSpeed(speed);
      acc = 0;
      break;
    }
  }
  if (state.over) acc = 0;
  view.render(prev, state, state.over ? 1 : Math.min(1, acc / DT));
  hud.update(state, seed, debug);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
