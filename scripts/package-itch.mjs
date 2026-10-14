// Zips dist/ into build/qditchsim-itch.zip with index.html at the zip root,
// which is the layout itch.io expects for an HTML game.
import { mkdirSync, existsSync, rmSync } from 'node:fs';
import { zip } from 'bestzip';

if (!existsSync('dist/index.html')) {
  console.error('dist/index.html not found. Run `npm run build` first.');
  process.exit(1);
}
mkdirSync('build', { recursive: true });
const out = 'build/qditchsim-itch.zip';
rmSync(out, { force: true });
await zip({ source: '*', destination: '../' + out, cwd: 'dist' });
console.log(`Wrote ${out}. Upload it to itch.io as an HTML project.`);
