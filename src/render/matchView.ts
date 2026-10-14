import * as THREE from 'three';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { createIsoCamera, resizeIsoCamera } from './isoCamera';
import { RULES, hoops, type MatchState, type Vec3 } from '../sim';

// PLACEHOLDER ART ONLY. Neutral greys and primitive shapes until the director defines
// the look. Two grey tones separate the teams; nothing here is a style decision.
const GREY = {
  background: 0x222222,
  pitch: 0x5a5a5a,
  hoop: 0x9a9a9a,
  home: 0xeeeeee,
  away: 0x2b2b2b,
  quaffle: 0xb5b5b5,
  bludger: 0x111111,
  snitch: 0xffffff,
  shadow: 0x000000,
};

/** Positions captured each tick so frames can be interpolated between ticks. */
export interface Snapshot {
  players: Vec3[];
  quaffle: Vec3;
  bludgers: Vec3[];
  snitch: Vec3;
}

export function snapshot(s: MatchState): Snapshot {
  const c = (v: Vec3) => ({ x: v.x, y: v.y, z: v.z });
  return {
    players: s.players.map((p) => c(p.pos)),
    quaffle: c(s.quaffle.pos),
    bludgers: s.bludgers.map((b) => c(b.pos)),
    snitch: c(s.snitch.pos),
  };
}

const ROLE_LETTER = { chaser: 'C', beater: 'B', keeper: 'K', seeker: 'S' } as const;

interface Flyer {
  body: THREE.Object3D;
  shadow: THREE.Mesh;
  baseShadow: number;
}

export class MatchView {
  private renderer: THREE.WebGLRenderer;
  private labels: CSS2DRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.OrthographicCamera;
  private players: (Flyer & { mat: THREE.MeshBasicMaterial; label: CSS2DObject })[] = [];
  private quaffle: Flyer;
  private bludgers: Flyer[] = [];
  private snitch: Flyer;
  private shadowGeo = new THREE.CircleGeometry(1, 20);

  constructor(canvas: HTMLCanvasElement, labelHost: HTMLElement, state: MatchState) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.labels = new CSS2DRenderer({ element: labelHost });
    this.scene.background = new THREE.Color(GREY.background);
    this.camera = createIsoCamera(125, window.innerWidth / window.innerHeight);

    this.buildPitch();

    for (const p of state.players) {
      const mat = new THREE.MeshBasicMaterial({ color: p.team === 0 ? GREY.home : GREY.away, transparent: true });
      const group = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.6, 1.2, 4, 8), mat);
      body.position.y = 0.9;
      const broom = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.15, 0.15), mat);
      group.add(body, broom);
      const tag = document.createElement('div');
      tag.className = 'role-label';
      tag.textContent = ROLE_LETTER[p.def.role];
      const label = new CSS2DObject(tag);
      label.position.y = 2.8;
      label.visible = false;
      group.add(label);
      this.scene.add(group);
      this.players.push({ body: group, shadow: this.addShadow(1.3), baseShadow: 1.3, mat, label });
    }

    this.quaffle = this.addBall(0.55, GREY.quaffle);
    for (let i = 0; i < state.bludgers.length; i++) this.bludgers.push(this.addBall(0.45, GREY.bludger));
    this.snitch = this.addBall(0.3, GREY.snitch);
  }

  private addShadow(size: number): THREE.Mesh {
    const m = new THREE.Mesh(
      this.shadowGeo,
      new THREE.MeshBasicMaterial({ color: GREY.shadow, transparent: true, opacity: 0.35, depthWrite: false }),
    );
    m.rotation.x = -Math.PI / 2;
    m.scale.setScalar(size);
    this.scene.add(m);
    return m;
  }

  private addBall(radius: number, color: number): Flyer {
    const body = new THREE.Mesh(new THREE.SphereGeometry(radius, 14, 10), new THREE.MeshBasicMaterial({ color }));
    this.scene.add(body);
    return { body, shadow: this.addShadow(radius * 1.2), baseShadow: radius * 1.2 };
  }

  private buildPitch() {
    const P = RULES.pitch;
    const pitch = new THREE.Mesh(new THREE.CircleGeometry(1, 80), new THREE.MeshBasicMaterial({ color: GREY.pitch }));
    pitch.scale.set(P.length / 2 + P.margin, P.width / 2 + P.margin, 1);
    pitch.rotation.x = -Math.PI / 2;
    this.scene.add(pitch);

    const hoopMat = new THREE.MeshBasicMaterial({ color: GREY.hoop });
    const r = RULES.hoops.ringRadius;
    for (const team of [0, 1] as const) {
      for (const h of hoops(team)) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.15, 8, 32), hoopMat);
        ring.position.set(h.x, h.y, h.z);
        ring.rotation.y = Math.PI / 2;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, h.y - r, 6), hoopMat);
        pole.position.set(h.x, (h.y - r) / 2, h.z);
        this.scene.add(ring, pole);
        const base = this.addShadow(0.6);
        base.position.set(h.x, 0.02, h.z);
      }
    }
  }

  setDebug(on: boolean) {
    for (const p of this.players) p.label.visible = on;
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.labels.setSize(w, h);
    resizeIsoCamera(this.camera, w / h);
  }

  private place(f: Flyer, a: Vec3, b: Vec3, alpha: number) {
    const x = a.x + (b.x - a.x) * alpha;
    const y = a.y + (b.y - a.y) * alpha;
    const z = a.z + (b.z - a.z) * alpha;
    f.body.position.set(x, y, z);
    f.shadow.position.set(x, 0.02, z);
    // Ground shadow shrinks and fades as the flyer climbs, so height reads at a glance.
    const k = Math.max(0.35, 1 - y / (RULES.pitch.maxHeight * 1.4));
    f.shadow.scale.setScalar(f.baseShadow * k);
    (f.shadow.material as THREE.MeshBasicMaterial).opacity = 0.15 + 0.25 * k;
  }

  render(prev: Snapshot, s: MatchState, alpha: number) {
    s.players.forEach((p, i) => {
      const v = this.players[i];
      this.place(v, prev.players[i], p.pos, alpha);
      if (Math.hypot(p.vel.x, p.vel.z) > 0.5) v.body.rotation.y = Math.atan2(-p.vel.z, p.vel.x);
      v.mat.opacity = p.stunnedFor > 0 ? 0.4 : 1;
    });
    this.place(this.quaffle, prev.quaffle, s.quaffle.pos, alpha);
    s.bludgers.forEach((b, i) => this.place(this.bludgers[i], prev.bludgers[i], b.pos, alpha));
    // PROVISIONAL: the Snitch is drawn only while sighted. How to show it is a director decision.
    const visible = s.snitch.visibleFor > 0;
    this.snitch.body.visible = visible;
    this.snitch.shadow.visible = visible;
    if (visible) this.place(this.snitch, prev.snitch, s.snitch.pos, alpha);

    this.renderer.render(this.scene, this.camera);
    this.labels.render(this.scene, this.camera);
  }
}
