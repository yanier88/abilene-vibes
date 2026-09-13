import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { build } from 'vite';
import { guardedIOSBuild, inspectConfiguration, inspectBundle } from '../../scripts/ios-build-guard.mjs';

// Intentionally fictitious public configuration. Never contacts a Supabase service.
const valid = { VITE_SUPABASE_URL: 'https://ios-build-guard.invalid',
  VITE_SUPABASE_ANON_KEY: 'sb_publishable_FAKE_PUBLIC_TEST_CONFIGURATION_1234567890' };
const jwt = role => [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
  Buffer.from(JSON.stringify({ role })).toString('base64url'), Buffer.alloc(32, 1).toString('base64url')].join('.');
const scenarios = [
  ['both missing', {}, 'MISSING', 'MISSING'],
  ['URL missing', { VITE_SUPABASE_ANON_KEY: valid.VITE_SUPABASE_ANON_KEY }, 'MISSING', 'PRESENT'],
  ['key missing', { VITE_SUPABASE_URL: valid.VITE_SUPABASE_URL }, 'PRESENT', 'MISSING'],
  ['whitespace', { VITE_SUPABASE_URL: ' \t ', VITE_SUPABASE_ANON_KEY: '\n ' }, 'MISSING', 'MISSING'],
  ['HTTP rejected', { ...valid, VITE_SUPABASE_URL: 'http://ios-build-guard.invalid' }, 'INVALID', 'PRESENT'],
  ['malformed URL', { ...valid, VITE_SUPABASE_URL: 'https://' }, 'INVALID', 'PRESENT'],
  ['URL credentials', { ...valid, VITE_SUPABASE_URL: 'https://private:secret@ios-build-guard.invalid' }, 'INVALID', 'PRESENT'],
  ['URL query', { ...valid, VITE_SUPABASE_URL: valid.VITE_SUPABASE_URL + '?token=PRIVATE' }, 'INVALID', 'PRESENT'],
  ['invalid key', { ...valid, VITE_SUPABASE_ANON_KEY: 'INVALID_PRIVATE_SENTINEL' }, 'PRESENT', 'INVALID'],
  ['secret key rejected', { ...valid, VITE_SUPABASE_ANON_KEY: 'sb_secret_NEVER_BUNDLE_THIS_SENTINEL_123456789' }, 'PRESENT', 'INVALID'],
  ['service-role JWT rejected', { ...valid, VITE_SUPABASE_ANON_KEY: jwt('service_role') }, 'PRESENT', 'INVALID'],
];
for (const [label, env, urlStatus, keyStatus] of scenarios) {
  test(`preflight ${label}: reject before build or copy, sanitized output`, async () => {
    const lines = [];
    const code = await guardedIOSBuild({ env, loadEnvironment: () => ({}), copy: true,
      buildApp: () => assert.fail('Build must not start'), copyApp: () => assert.fail('Copy must not start'),
      report: line => lines.push(line) });
    assert.equal(code, 2);
    assert.deepEqual(lines, [`URL ${urlStatus}`, `KEY ${keyStatus}`]);
    for (const value of Object.values(env).filter(value => value.trim())) assert.ok(!lines.join('\n').includes(value));
  });
}
test('fictitious modern public key and legacy anon JWT pass structural checks', () => {
  assert.equal(inspectConfiguration(valid).valid, true);
  assert.equal(inspectConfiguration({ ...valid, VITE_SUPABASE_ANON_KEY: jwt('anon') }).valid, true);
  const normalized = inspectConfiguration({ VITE_SUPABASE_URL: '  HTTPS://ios-build-guard.invalid/ ',
    VITE_SUPABASE_ANON_KEY: ' ' + valid.VITE_SUPABASE_ANON_KEY + ' ' });
  assert.equal(normalized.url, valid.VITE_SUPABASE_URL);
  assert.equal(normalized.key, valid.VITE_SUPABASE_ANON_KEY);
});
test('truncated JWT, other JWT role, malformed payload and short publishable key are invalid', () => {
  for (const key of ['sb_publishable_short', jwt('authenticated'), jwt('anon').slice(0, -3),
    'invalid.invalid.invalid', 'eyJhbGciOiJub25lIn0.e30.unsigned']) {
    assert.equal(inspectConfiguration({ ...valid, VITE_SUPABASE_ANON_KEY: key }).keyStatus, 'INVALID');
  }
});
test('explicit empty shell value overrides configured env file', async () => {
  let ran = false;
  const code = await guardedIOSBuild({ env: { VITE_SUPABASE_ANON_KEY: ' ' }, loadEnvironment: () => valid,
    buildApp: () => { ran = true; }, report: () => {} });
  assert.equal(code, 2); assert.equal(ran, false);
});
test('lab web flag refuses physical flow before build', async () => {
  const code = await guardedIOSBuild({ env: { ...valid, VITE_APPLE_IAP_LOCAL_TEST: 'true' }, loadEnvironment: () => ({}),
    buildApp: () => assert.fail('No local lab build'), copyApp: () => assert.fail('No copy'), report: () => {} });
  assert.equal(code, 7);
});
test('build exception cannot leak env or subprocess diagnostics and never copies', async () => {
  const lines = [];
  const code = await guardedIOSBuild({ env: valid, loadEnvironment: () => ({}), copy: true,
    buildApp: () => { throw Error(Object.values(valid).join(' ')); }, copyApp: () => assert.fail('No copy'),
    report: line => lines.push(line) });
  assert.equal(code, 3); assert.deepEqual(lines, ['URL PRESENT', 'KEY PRESENT']);
});

async function artifact(t, { includeURL = true, includeKey = true, reachable = true, module = true } = {}) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'abilene-ios-guard-test-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'dist/assets'), { recursive: true });
  const appCode = `export const config = ${JSON.stringify([includeURL ? valid.VITE_SUPABASE_URL : '', includeKey ? valid.VITE_SUPABASE_ANON_KEY : ''])};`;
  const entry = { type: 'chunk', isEntry: true, fileName: 'assets/main.js', code: 'import("./app.js");',
    modules: {}, imports: [], dynamicImports: reachable ? ['assets/app.js'] : [] };
  const app = { type: 'chunk', isEntry: false, fileName: 'assets/app.js', code: appCode,
    modules: module ? { [join(root, 'src/App.jsx')]: {} } : {}, imports: [], dynamicImports: [] };
  await writeFile(join(root, 'dist/index.html'), '<script type="module" src="/assets/main.js"></script>');
  for (const chunk of [entry, app]) await writeFile(join(root, 'dist', chunk.fileName), chunk.code);
  return { root, result: { output: [entry, app] } };
}
for (const [label, options] of [
  ['missing URL', { includeURL: false }], ['missing key', { includeKey: false }],
  ['unreachable stale configuration', { reachable: false }], ['unrelated module marker', { module: false }],
]) {
  test(`postflight rejects ${label} before copy`, async t => {
    const { root, result } = await artifact(t, options);
    const code = await guardedIOSBuild({ root, env: valid, loadEnvironment: () => ({}), copy: true,
      buildApp: () => result, copyApp: () => assert.fail('Copy must not start'), report: () => {} });
    assert.equal(code, 4);
  });
}
test('changed on-disk artifact rejected even when compiler output has config', async t => {
  const { root, result } = await artifact(t);
  await writeFile(join(root, 'dist/assets/app.js'), 'stale build');
  assert.equal((await inspectBundle(root, result, inspectConfiguration(valid))).valid, false);
});
test('missing entry and Xcode marker cannot authorize copy', async t => {
  const { root, result } = await artifact(t);
  result.output.push({ type: 'asset', fileName: 'apple-iap-local-test.json' });
  assert.equal((await inspectBundle(root, result, inspectConfiguration(valid))).valid, false);
  result.output.pop();
  await writeFile(join(root, 'dist/index.html'), '<!-- no module entry -->');
  assert.equal((await inspectBundle(root, result, inspectConfiguration(valid))).valid, false);
});
test('successful current bundle allows copy only after postflight; copy errors are sanitized', async t => {
  const { root, result } = await artifact(t); const events = [], lines = [];
  const code = await guardedIOSBuild({ root, env: valid, loadEnvironment: () => ({}), copy: true,
    buildApp: () => { events.push('build'); return result; },
    copyApp: async () => {
      assert.equal((await inspectBundle(root, result, inspectConfiguration(valid))).valid, true);
      events.push('copy'); throw Error(valid.VITE_SUPABASE_ANON_KEY);
    }, report: line => lines.push(line) });
  assert.equal(code, 5); assert.deepEqual(events, ['build', 'copy']);
  assert.deepEqual(lines, ['URL PRESENT', 'KEY PRESENT']);
});
test('real Vite build of a temporary offline fixture incorporates fictitious configuration', async t => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'abilene-ios-guard-vite-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'src'));
  await writeFile(join(root, 'vite.config.js'), 'export default {};');
  await writeFile(join(root, 'index.html'), '<script type="module" src="/src/main.js"></script>');
  await writeFile(join(root, 'src/main.js'), 'import("./App.jsx").then(m => m.show());');
  await writeFile(join(root, 'src/App.jsx'), 'export function show(){document.body.textContent=import.meta.env.VITE_SUPABASE_URL+import.meta.env.VITE_SUPABASE_ANON_KEY}');
  const lines = []; let copied = false, buildFailure = '';
  const code = await guardedIOSBuild({ root, env: valid, loadEnvironment: () => ({}), copy: true,
    buildApp: async options => {
      try { return await build(options); }
      catch (error) {
        buildFailure = String(error.message).replaceAll(valid.VITE_SUPABASE_URL, '[URL]').replaceAll(valid.VITE_SUPABASE_ANON_KEY, '[KEY]');
        throw error;
      }
    },
    copyApp: () => { copied = true; }, report: line => lines.push(line) });
  assert.equal(code, 0, buildFailure); assert.equal(copied, true);
  assert.deepEqual(lines, ['URL PRESENT', 'KEY PRESENT']);
  assert.ok((await readFile(join(root, 'dist/index.html'), 'utf8')).includes('assets/'));
});
test('CLI rejects sensitive invalid input without echoing it', async () => {
  const exec = promisify(execFile), sentinel = 'DO_NOT_PRINT_PRIVATE_SENTINEL';
  try {
    await exec(process.execPath, [fileURLToPath(new URL('../../scripts/ios-build-guard.mjs', import.meta.url))],
      { env: { PATH: process.env.PATH, VITE_SUPABASE_URL: valid.VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY: sentinel } });
    assert.fail('Expected rejection');
  } catch (error) {
    assert.equal(error.code, 2);
    assert.equal(error.stdout, 'URL PRESENT\nKEY INVALID\n'); assert.equal(error.stderr, '');
    assert.ok(!error.stdout.includes(sentinel));
  }
});
test('generic web and Android scripts/config remain unchanged', async () => {
  const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts.build, 'vite build');
  assert.equal(pkg.scripts['build:github'], 'vite build --mode github-pages');
  assert.equal(pkg.scripts['build:android'], 'vite build && cap sync android');
  assert.equal(pkg.scripts['prepare:ios'], 'node scripts/ios-build-guard.mjs --copy');
});
