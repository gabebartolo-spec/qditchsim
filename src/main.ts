import * as THREE from 'three';
import { createIsoCamera, resizeIsoCamera } from './render/isoCamera';

// Technical placeholder for Phase 0. It proves the isometric camera and the
// ground-shadow height cue work. None of these shapes or colours are the game's look.

const canvas = document.querySelector<HTMLCanvasElement>('#match');
if (!canvas) throw new Error('Missing #match canvas');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x222222);

const camera = createIsoCamera(90, window.innerWidth / window.innerHeight);

// Placeholder pitch: a flat grey oval. Real dimensions and art come later.
const pitch = new THREE.Mesh(
  new THREE.CircleGeometry(1, 64),
  new THREE.MeshBasicMaterial({ color: 0x555555 }),
);
pitch.scale.set(60, 30, 1);
pitch.rotation.x = -Math.PI / 2;
scene.add(pitch);

// Placeholder flyer with a ground shadow. The gap between them shows height.
const flyer = new THREE.Mesh(
  new THREE.SphereGeometry(1.5, 16, 12),
  new THREE.MeshBasicMaterial({ color: 0xcccccc }),
);
const shadow = new THREE.Mesh(
  new THREE.CircleGeometry(1.5, 24),
  new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }),
);
shadow.rotation.x = -Math.PI / 2;
shadow.position.y = 0.01;
scene.add(flyer, shadow);

function resize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  resizeIsoCamera(camera, w / h);
}
window.addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();
  const x = Math.cos(t * 0.5) * 40;
  const z = Math.sin(t * 0.5) * 18;
  const height = 6 + Math.sin(t * 1.3) * 5;
  flyer.position.set(x, height, z);
  shadow.position.set(x, 0.01, z);
  // Shadow shrinks as the flyer climbs, so height reads at a glance.
  const s = 1.2 - height / 20;
  shadow.scale.set(s, s, 1);
  renderer.render(scene, camera);
});
