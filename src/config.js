/**
 * @file config.js
 * @description Utilities for loading the ORM configuration file and
 * pre-loading entity modules so that decorator-based metadata is registered
 * before any migration or scaffold operation inspects it.
 */

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
 *   Glob-compatible paths (relative to `process.cwd()`) pointing to compiled
 *   entity modules that must be imported so their decorators run and register
 *   entity metadata before migrations are inspected.
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
  for (const entityPath of config.entities ?? []) {
    const resolvedPath = path.resolve(process.cwd(), entityPath);
    await import(pathToFileURL(resolvedPath).href);
  }
}
