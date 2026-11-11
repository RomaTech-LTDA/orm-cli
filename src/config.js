/**
 * @file config.js
 * @description Utilities for loading the ORM configuration file and
 * pre-loading entity modules so that decorator-based metadata is registered
 * before any migration or scaffold operation inspects it.
 */

import { readdir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * @typedef {Object} OrmConfig
 * @property {import('@romatech/orm').IDbProvider} provider
 *   Required. An instantiated database provider that implements `IDbProvider`.
 * @property {string} [connectionString]
 *   Optional connection string that overrides the provider's own connection
 *   configuration when passed to `provider.connect()`.
 * @property {string} [migrationsPath]
 *   Directory where migration JSON files are stored and read from.
 *   Defaults to `'./migrations'`.
 * @property {string} [outputDir]
 *   Directory where scaffolded entity TypeScript files are written.
 *   Defaults to `'entities'`.
 * @property {string} [contextDir]
 *   Directory where the scaffolded `DbContext` file is written.
 *   Defaults to `'.'` (project root).
 * @property {string} [contextName]
 *   Class name used for the generated `DbContext` subclass.
 *   Defaults to `'AppDbContext'`.
 * @property {string[]} [entities]
 *   Paths or wildcard patterns (`*`, `?`, `**`; relative to `process.cwd()`)
 *   pointing to compiled entity modules that must be imported so their
 *   decorators run and register entity metadata before migrations are
 *   inspected. See {@link resolveEntityPaths}.
 */

/**
 * Loads the ORM configuration file and returns a fully-merged config object
 * with defaults applied for every optional property.
 *
 * The config file is resolved relative to `process.cwd()`. It may export its
 * object as a default export, a named `config` export, or as the module
 * namespace itself (CommonJS-style bare export).
 *
 * @param {string} [configPath='orm.config.js']
 *   Path to the config file, relative to the current working directory.
 *   Can be overridden via the `--config` CLI option.
 * @returns {Promise<OrmConfig>} The resolved and merged ORM configuration.
 * @throws {Error} If the file cannot be imported or does not export a
 *   `provider` instance.
 *
 * @example
 * const config = await loadOrmConfig();           // uses ./orm.config.js
 * const config = await loadOrmConfig('my.config.js'); // custom path
 */
export async function loadOrmConfig(configPath = 'orm.config.js') {
  // Resolve to an absolute path so dynamic import works regardless of cwd.
  const resolvedPath = path.resolve(process.cwd(), configPath);

  // Use pathToFileURL so the path is treated as a file URL on all platforms,
  // which is required for ESM dynamic imports on Windows (backslashes).
  const configModule = await import(pathToFileURL(resolvedPath).href);

  // Support three common export styles: default, named `config`, or bare module.
  const config = configModule.default ?? configModule.config ?? configModule;

  if (!config.provider) {
    throw new Error(`ORM config '${resolvedPath}' must export a 'provider' instance.`);
  }

  // Merge caller-supplied values over the built-in defaults.
  return {
    migrationsPath: './migrations',
    outputDir: 'entities',
    contextDir: '.',
    contextName: 'AppDbContext',
    entities: [],
    connectionString: '',
    ...config
  };
}

/**
 * Dynamically imports each entity module listed in `config.entities` so that
 * their class decorators (`@Entity`, `@Column`, `@PrimaryKey`) execute and
 * register the entity metadata in the global decorator registry.
 *
 * This step must happen before `MigrationService.createMigration()` or any
 * operation that inspects `getEntityMetadata()`, otherwise no entities will
 * be found and the generated migration will be empty.
 *
 * Paths are resolved relative to `process.cwd()` and converted to file URLs
 * for cross-platform ESM compatibility.
 *
 * @param {OrmConfig} config The loaded ORM configuration object.
 * @returns {Promise<void>}
 *
 * @example
 * const config = await loadOrmConfig();
 * await loadEntityModules(config); // entities array: ['./dist/entities/*.js']
 */
export async function loadEntityModules(config) {
  for (const resolvedPath of await resolveEntityPaths(config.entities ?? [])) {
    await import(pathToFileURL(resolvedPath).href);
  }
}

/**
 * Expands the `entities` entries into absolute file paths.
 *
 * Entries without wildcards are resolved as-is. Entries with wildcards support
 * `*` and `?` inside a path segment and `**` for any number of directories
 * (e.g. `./dist/entities/*.js`, `./dist/**\/*.entity.js`). Names starting with
 * `.` only match a segment that also starts with `.`. Matches are returned in
 * sorted order, without duplicates.
 *
 * @param {string[]} patterns Paths or patterns relative to `cwd`.
 * @param {string} [cwd=process.cwd()] Base directory.
 * @returns {Promise<string[]>} Absolute file paths.
 * @throws {Error} If a pattern with wildcards matches no file — a typo there
 *   would otherwise silently produce migrations without those entities.
 */
export async function resolveEntityPaths(patterns, cwd = process.cwd()) {
  const result = [];

  for (const pattern of patterns) {
    const absolute = path.resolve(cwd, pattern);
    const split = splitPattern(absolute);

    if (!split) {
      result.push(absolute);
      continue;
    }

    if (split.segments[split.segments.length - 1] === '**') {
      throw new Error(`Entity pattern '${pattern}' must end with a file name pattern (e.g. '**/*.js').`);
    }

    const matches = (await expandSegments(split.base, split.segments, new Set())).sort();

    if (matches.length === 0) {
      throw new Error(`Entity pattern '${pattern}' did not match any file (resolved to '${absolute}').`);
    }

    result.push(...matches);
  }

  return [...new Set(result)];
}

/** Returns true when a path segment contains a wildcard. */
function hasWildcard(segment) {
  return /[*?]/.test(segment);
}

/**
 * Splits an absolute pattern into the directory before the first wildcard
 * segment and the remaining segments. The root (`/`, `C:\`, or a UNC root
 * such as `\\server\share\`) is kept intact.
 *
 * @internal Exported for tests (`src/config.js` is not a package export).
 * @param {string} absolute Absolute path or pattern.
 * @param {typeof path} [pathImpl=path] `path`, `path.win32` or `path.posix`.
 * @returns {{ base: string, segments: string[] } | undefined}
 *   `undefined` when the pattern has no wildcard.
 */
export function splitPattern(absolute, pathImpl = path) {
  const { root } = pathImpl.parse(absolute);
  const separators = pathImpl.sep === '/' ? /\/+/ : /[\\/]+/;
  const segments = absolute.slice(root.length).split(separators).filter(Boolean);
  const firstMagic = segments.findIndex(hasWildcard);

  if (firstMagic === -1) {
    return undefined;
  }

  return {
    base: pathImpl.join(root, ...segments.slice(0, firstMagic)),
    segments: segments.slice(firstMagic)
  };
}

/**
 * Returns true when `entry` is a directory, or a symbolic link / junction
 * that points to one.
 */
async function isDirectoryEntry(entry, fullPath) {
  if (entry.isDirectory()) return true;
  if (!entry.isSymbolicLink()) return false;
  return (await stat(fullPath).catch(() => undefined))?.isDirectory() ?? false;
}

/** Converts a single path segment with `*` / `?` into an anchored RegExp. */
function segmentToRegExp(segment) {
  const source = [...segment]
    .map(char => (char === '*' ? '.*' : char === '?' ? '.' : char.replace(/[.+^${}()|[\]\\]/g, '\\$&')))
    .join('');
  return new RegExp(`^${source}$`);
}

/** Lists a directory, returning an empty list when it does not exist. */
async function readDirectory(directory) {
  try {
    return await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return [];
    throw error;
  }
}

/**
 * Recursively matches the remaining pattern segments below `directory`.
 *
 * `visited` holds the real paths that `**` already walked, so a symbolic link
 * or junction pointing back to an ancestor cannot cause an endless walk.
 */
async function expandSegments(directory, segments, visited) {
  const [head, ...rest] = segments;

  if (head === '**') {
    const real = await realpath(directory).catch(() => directory);
    if (visited.has(real)) return [];
    visited.add(real);

    const matches = await expandSegments(directory, rest, visited);
    for (const entry of await readDirectory(directory)) {
      const next = path.join(directory, entry.name);
      if (!entry.name.startsWith('.') && entry.name !== 'node_modules' && await isDirectoryEntry(entry, next)) {
        matches.push(...await expandSegments(next, segments, visited));
      }
    }
    return matches;
  }

  if (!hasWildcard(head)) {
    const next = path.join(directory, head);
    if (rest.length > 0) return expandSegments(next, rest, visited);
    const entry = await stat(next).catch(() => undefined);
    return entry?.isFile() ? [next] : [];
  }

  const matcher = segmentToRegExp(head);
  const matches = [];

  for (const entry of await readDirectory(directory)) {
    if (!matcher.test(entry.name) || (entry.name.startsWith('.') && !head.startsWith('.'))) {
      continue;
    }

    const next = path.join(directory, entry.name);
    if (rest.length > 0) {
      if (await isDirectoryEntry(entry, next)) matches.push(...await expandSegments(next, rest, visited));
    } else if (entry.isFile() || (entry.isSymbolicLink() && (await stat(next).catch(() => undefined))?.isFile())) {
      matches.push(next);
    }
  }

  return matches;
}
