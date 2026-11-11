/**
 * Produces a Vercel Build Output (v3) bundle:
 *   .vercel/output/static            → the built SPA (served from Vercel's CDN)
 *   .vercel/output/functions/api.func → the Express API bundled into one ESM file
 *
 * Bundling ourselves keeps the deployment deterministic: no framework detection,
 * and the exact same server code that runs locally and in tests.
 * Run after `vite build` (see the `build:vercel` npm script).
 */
import { build } from 'esbuild';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';

const OUT = '.vercel/output';
const FUNCTION_DIR = `${OUT}/functions/api.func`;

const SECURITY_HEADERS = {
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'X-Frame-Options': 'DENY',
};

await rm(OUT, { recursive: true, force: true });
await mkdir(`${OUT}/static`, { recursive: true });
await cp('dist/client', `${OUT}/static`, { recursive: true });

await mkdir(FUNCTION_DIR, { recursive: true });
await build({
  entryPoints: ['server/vercel.ts'],
  outfile: `${FUNCTION_DIR}/index.mjs`,
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  // PGlite is only used for local development; pg-native is an optional pg add-on.
  external: ['@electric-sql/pglite', 'pg-native'],
  banner: {
    js: [
      "import { createRequire as __createRequire } from 'node:module';",
      "import { fileURLToPath as __fileURLToPath } from 'node:url';",
      "import { dirname as __dirnameOf } from 'node:path';",
      'const require = __createRequire(import.meta.url);',
      'const __filename = __fileURLToPath(import.meta.url);',
      'const __dirname = __dirnameOf(__filename);',
    ].join('\n'),
  },
  legalComments: 'none',
  logLevel: 'warning',
});

await writeFile(
  `${FUNCTION_DIR}/.vc-config.json`,
  JSON.stringify(
    { runtime: 'nodejs22.x', handler: 'index.mjs', launcherType: 'Nodejs', shouldAddHelpers: false, maxDuration: 30 },
    null,
    2,
  ),
);
await writeFile(`${FUNCTION_DIR}/package.json`, JSON.stringify({ type: 'module' }));

await writeFile(
  `${OUT}/config.json`,
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: '/(.*)', headers: SECURITY_HEADERS, continue: true },
        { src: '/assets/(.*)', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' }, continue: true },
        { src: '/api/(.*)', dest: '/api' },
        { handle: 'filesystem' },
        { src: '/(.*)', dest: '/index.html' },
      ],
    },
    null,
    2,
  ),
);

console.log('Vercel build output written to .vercel/output');
