import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadEntityModules, resolveEntityPaths, splitPattern } from '../src/config.js';
import { packageVersion } from '../src/version.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'romatech-orm-cli-test-'));
test.after(() => fs.rmSync(root, { recursive: true, force: true }));

function write(relative, content = '') {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return file;
}

const marker = name => `globalThis.__loadedEntities = [...(globalThis.__loadedEntities ?? []), ${JSON.stringify(name)}];\n`;

write('dist/entities/user.js', marker('user'));
write('dist/entities/order.js', marker('order'));
write('dist/entities/user.js.map', '{}');
write('dist/entities/.hidden.js', marker('hidden'));
write('dist/modules/billing/invoice.entity.js', marker('invoice'));
write('dist/modules/billing/helper.js', marker('helper'));

const rel = file => path.relative(root, file).split(path.sep).join('/');

test('README pattern ./dist/entities/*.js loads every entity module', async () => {
  const previous = process.cwd();
  process.chdir(root);
  try {
    globalThis.__loadedEntities = [];
    await loadEntityModules({ entities: ['./dist/entities/*.js'] });
    assert.deepEqual([...globalThis.__loadedEntities].sort(), ['order', 'user']);
  } finally {
    process.chdir(previous);
  }
});

test('** matches nested directories', async () => {
  const files = await resolveEntityPaths(['./dist/**/*.entity.js'], root);
  assert.deepEqual(files.map(rel), ['dist/modules/billing/invoice.entity.js']);
});

test('plain paths are resolved without globbing and duplicates are removed', async () => {
  const files = await resolveEntityPaths(['dist/entities/user.js', './dist/entities/u?er.js'], root);
  assert.deepEqual(files.map(rel), ['dist/entities/user.js']);
});

test('a wildcard pattern that matches nothing is an error, not an empty migration', async () => {
  await assert.rejects(resolveEntityPaths(['./dist/entitys/*.js'], root), /did not match any file/);
});

test('a pattern ending in ** is a clear error, not a TypeError', async () => {
  await assert.rejects(resolveEntityPaths(['./dist/**'], root), /must end with a file name pattern/);
});

test('--version reports the package.json version', () => {
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf-8'));
  assert.equal(packageVersion, pkg.version);
});

test('UNC and drive-letter roots are kept when a pattern is split', () => {
  assert.deepEqual(splitPattern(String.raw`\\server\share\dist\*.js`, path.win32), {
    base: String.raw`\\server\share\dist`,
    segments: ['*.js']
  });
  assert.deepEqual(splitPattern(String.raw`C:\app\dist\**\*.js`, path.win32), {
    base: String.raw`C:\app\dist`,
    segments: ['**', '*.js']
  });
  assert.deepEqual(splitPattern(String.raw`C:\*.js`, path.win32), { base: 'C:' + path.win32.sep, segments: ['*.js'] });
  assert.deepEqual(splitPattern('/srv/app/*/x.js', path.posix), { base: '/srv/app', segments: ['*', 'x.js'] });
  assert.deepEqual(splitPattern('/*.js', path.posix), { base: '/', segments: ['*.js'] });
  assert.equal(splitPattern('/srv/app/user.js', path.posix), undefined);
});

// Junctions need no privileges on Windows; elsewhere a directory symlink.
const linkRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'romatech-orm-cli-link-'));
test.after(() => fs.rmSync(linkRoot, { recursive: true, force: true }));
const linkFile = relative => {
  const file = path.join(linkRoot, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '');
};
const linkDir = (target, relative) => {
  fs.mkdirSync(path.dirname(path.join(linkRoot, relative)), { recursive: true });
  fs.symlinkSync(path.join(linkRoot, target), path.join(linkRoot, relative), process.platform === 'win32' ? 'junction' : 'dir');
};
linkFile('shared/entities/account.entity.js');
linkFile('app/dist/local/user.entity.js');
linkDir('shared/entities', 'app/dist/linked');
linkDir('shared', 'shared/entities/loop'); // cycle back to an ancestor
const relLink = file => path.relative(linkRoot, file).split(path.sep).join('/');

test('wildcards and ** descend into symlinked directories', async () => {
  const deep = await resolveEntityPaths(['./app/dist/**/*.entity.js'], linkRoot);
  assert.deepEqual(deep.map(relLink), ['app/dist/linked/account.entity.js', 'app/dist/local/user.entity.js']);

  const shallow = await resolveEntityPaths(['./app/dist/*/account.entity.js'], linkRoot);
  assert.deepEqual(shallow.map(relLink), ['app/dist/linked/account.entity.js']);
});

test('** stops at a symlink cycle', async () => {
  const files = await resolveEntityPaths(['./shared/**/*.entity.js'], linkRoot);
  assert.deepEqual(files.map(relLink), ['shared/entities/account.entity.js']);
});
