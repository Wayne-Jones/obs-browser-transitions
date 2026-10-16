// Build the deployable site into `public/`:
//   1. wipe `public/`
//   2. compile `src/scripts/**` to `public/js` with the native TypeScript compiler
//   3. copy the static assets (css + html) from `src/` into `public/`
//
// Run with: `pnpm build` (see package.json).
import { execSync } from 'node:child_process';
import { cpSync, rmSync } from 'node:fs';
import { delimiter, resolve } from 'node:path';

const publicDir = resolve('public');
const staticAssets = ['css', 'overlays', 'transitions'] as const;

rmSync(publicDir, { recursive: true, force: true });

// Make the locally installed `tsc` findable even when this is run directly
// (`node scripts/build.ts`) rather than through pnpm.
const binDir = resolve('node_modules', '.bin');
execSync('tsc -p .', {
  stdio: 'inherit',
  env: { ...process.env, PATH: `${binDir}${delimiter}${process.env.PATH ?? ''}` },
});

for (const asset of staticAssets) {
  cpSync(resolve('src', asset), resolve(publicDir, asset), { recursive: true });
}

console.log(`Built public/ (js + ${staticAssets.join(', ')})`);
