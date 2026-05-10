import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import process from 'node:process';

const args = process.argv.slice(2);
const skipBuild = args.includes('--skip-build');
const preview = args.includes('--preview');
const allowOversize = args.includes('--allow-oversize');
const forwardedArgs = args.filter(
  (arg) => arg !== '--skip-build' && arg !== '--preview' && arg !== '--allow-oversize'
);

const FREE_PLAN_WORKER_LIMIT_BYTES = 3 * 1024 * 1024;

function formatMiB(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

function getLargestWorkerModule() {
  const ssrAssetsDir = join(process.cwd(), 'dist', 'server', 'ssr', 'assets');
  const entries = readdirSync(ssrAssetsDir, { withFileTypes: true });
  let largest = null;

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.js')) {
      continue;
    }

    const filePath = join(ssrAssetsDir, entry.name);
    const size = statSync(filePath).size;

    if (!largest || size > largest.size) {
      largest = { filePath, size };
    }
  }

  return largest;
}

if (!skipBuild) {
  execFileSync('npm', ['run', 'build'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}

if (!allowOversize) {
  try {
    const largestModule = getLargestWorkerModule();

    if (largestModule && largestModule.size > FREE_PLAN_WORKER_LIMIT_BYTES) {
      const relativePath = largestModule.filePath.replace(`${process.cwd()}\\`, '');
      console.error(
        [
          'Deploy blocked before upload: generated Worker module exceeds Cloudflare free-plan limit (3 MiB).',
          `Largest module: ${relativePath} (${formatMiB(largestModule.size)}).`,
          'Options:',
          '  1) Upgrade Cloudflare Workers plan (up to 10 MiB).',
          '  2) Reduce server bundle size and rebuild.',
          '  3) Bypass this local guard with --allow-oversize (Cloudflare may still reject).',
        ].join('\n')
      );
      process.exit(1);
    }
  } catch {
    // Skip guard when build artifacts are unavailable; Wrangler will report canonical errors.
  }
}

const wranglerEntry = createRequire(import.meta.url).resolve('wrangler');
const wranglerArgs = ['deploy'];

if (preview) {
  wranglerArgs.push('--env', 'preview');
}

wranglerArgs.push(...forwardedArgs);

execFileSync(process.execPath, [resolve(wranglerEntry), ...wranglerArgs], {
  cwd: process.cwd(),
  stdio: 'inherit',
});