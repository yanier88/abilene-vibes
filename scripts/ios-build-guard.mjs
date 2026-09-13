import { readFile, lstat, realpath } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { build, loadEnv } from 'vite';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const urlVariable = 'VITE_SUPABASE_URL';
const keyVariable = 'VITE_SUPABASE_ANON_KEY';
const execute = promisify(execFile);

// Structure only. Public keys are bundled into the app; this is not authentication.
function publicKey(value) {
  if (/^sb_publishable_[A-Za-z0-9_-]{16,512}$/.test(value)) return true;
  const parts = value.split('.');
  if (parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) return false;
  try {
    const decode = part => {
      const bytes = Buffer.from(part, 'base64url');
      if (bytes.toString('base64url') !== part) throw new Error('Invalid encoding');
      return JSON.parse(bytes.toString('utf8'));
    };
    const header = decode(parts[0]), payload = decode(parts[1]);
    const signature = Buffer.from(parts[2], 'base64url');
    return header?.alg === 'HS256' && (header.typ === undefined || header.typ === 'JWT') &&
      payload?.role === 'anon' && signature.length === 32 && signature.toString('base64url') === parts[2];
  } catch { return false; }
}

export function inspectConfiguration(env) {
  const rawURL = typeof env[urlVariable] === 'string' ? env[urlVariable].trim() : '';
  const key = typeof env[keyVariable] === 'string' ? env[keyVariable].trim() : '';
  let urlStatus = rawURL ? 'INVALID' : 'MISSING', url = '';
  if (rawURL && !/\s/.test(rawURL) && /^https:\/\//i.test(rawURL)) {
    try {
      const parsed = new URL(rawURL);
      if (parsed.protocol === 'https:' && parsed.hostname && !parsed.username && !parsed.password &&
          !parsed.search && !parsed.hash && parsed.pathname === '/') {
        url = parsed.origin; urlStatus = 'PRESENT';
      }
    } catch { /* Never print supplied values or parsing errors. */ }
  }
  const keyStatus = !key ? 'MISSING' : publicKey(key) ? 'PRESENT' : 'INVALID';
  return { urlStatus, keyStatus, url, key, valid: urlStatus === 'PRESENT' && keyStatus === 'PRESENT' };
}

// Check the current build's module graph AND on-disk JS, not an env marker or stale file.
export async function inspectBundle(root, result, config) {
  const invalid = { urlStatus: 'INVALID', keyStatus: 'INVALID', valid: false };
  if (!result || Array.isArray(result) || !Array.isArray(result.output)) return invalid;
  const chunks = new Map(result.output.filter(item => item.type === 'chunk').map(item => [item.fileName, item]));
  const html = await readFile(join(root, 'dist/index.html'), 'utf8');
  const scriptSources = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)]
    .map(match => match[1].replace(/^\.?\//, ''));
  const queue = [...chunks.values()].filter(chunk => chunk.isEntry && scriptSources.includes(chunk.fileName)).map(chunk => chunk.fileName);
  if (!queue.length) return invalid;
  const reachable = new Set();
  while (queue.length) {
    const name = queue.pop();
    if (reachable.has(name)) continue;
    const chunk = chunks.get(name);
    if (!chunk) return invalid;
    reachable.add(name);
    queue.push(...chunk.imports, ...chunk.dynamicImports);
  }
  const appModule = join(root, 'src/App.jsx');
  let urlPresent = false, keyPresent = false, sameChunk = false;
  for (const name of reachable) {
    // Refuse unexpected output paths and symlink chunks before reading/copying.
    if (!/^assets\/[A-Za-z0-9_.-]+\.js$/.test(name)) return invalid;
    const chunk = chunks.get(name), path = join(root, 'dist', name);
    if (!(await lstat(path)).isFile()) return invalid;
    const code = await readFile(path, 'utf8');
    if (code !== chunk.code) return invalid;
    if (!Object.hasOwn(chunk.modules, appModule)) continue;
    const hasURL = code.includes(config.url), hasKey = code.includes(config.key);
    urlPresent ||= hasURL; keyPresent ||= hasKey; sameChunk ||= hasURL && hasKey;
  }
  // A flagged local-lab bundle cannot be the normal/Sandbox physical iOS bundle.
  const localMarker = result.output.some(item => item.fileName === 'apple-iap-local-test.json');
  return { urlStatus: urlPresent ? 'PRESENT' : 'MISSING', keyStatus: keyPresent ? 'PRESENT' : 'MISSING',
    valid: sameChunk && !localMarker };
}

async function copyIOS(root) {
  // Never npx/install, Android, sync, Xcode, signing or installation.
  await execute(process.execPath, [join(projectRoot, 'node_modules/@capacitor/cli/bin/capacitor'), 'copy', 'ios'],
    { cwd: root, timeout: 60000, maxBuffer: 4 * 1024 * 1024 });
}

export async function guardedIOSBuild({ root = projectRoot, env = process.env, copy = false,
  loadEnvironment = directory => loadEnv('production', directory, 'VITE_'), buildApp = build,
  copyApp = copyIOS, report = line => process.stdout.write(line + '\n') } = {}) {
  let state = { urlStatus: 'INVALID', keyStatus: 'INVALID' };
  let exitCode = 2;
  try {
    root = await realpath(root);
    // Shell values (including intentionally empty values) take precedence over .env files.
    const effective = { ...loadEnvironment(root), ...env };
    const config = inspectConfiguration(effective); state = config;
    if (!config.valid) return 2;
    if (String(effective.VITE_APPLE_IAP_LOCAL_TEST).trim() === 'true') return 7;
    exitCode = 3;
    const result = await buildApp({ root, mode: 'production', configFile: join(root, 'vite.config.js'),
      logLevel: 'silent', clearScreen: false,
      define: {
        'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(config.url),
        'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(config.key),
        'import.meta.env.VITE_APPLE_IAP_LOCAL_TEST': JSON.stringify('false'),
      },
      build: { outDir: join(root, 'dist'), emptyOutDir: true, sourcemap: false },
    });
    exitCode = 4;
    state = await inspectBundle(root, result, config);
    if (!state.valid) return 4;
    if (copy) { exitCode = 5; await copyApp(root); }
    return 0;
  } catch {
    // Do not expose bundler/subprocess exceptions, stdout, stderr, env or key values.
    return exitCode;
  } finally {
    report(`URL ${state.urlStatus}`);
    report(`KEY ${state.keyStatus}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== '--copy')) {
    process.stdout.write('URL INVALID\nKEY INVALID\n'); process.exitCode = 6;
  } else {
    process.exitCode = await guardedIOSBuild({ copy: args[0] === '--copy' });
  }
}
