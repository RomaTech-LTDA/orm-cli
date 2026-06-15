/**
 * @file scaffold.js
 * @description Registers the `scaffold` CLI command.
 *
 * This command connects to an existing database, reads the live schema
 * (tables and columns), and generates:
 *  - One TypeScript entity class file per table in `config.outputDir`.
 *  - A single `DbContext` subclass file in `config.contextDir` that exposes
 *    a typed `DbSet<T>` getter for every generated entity.
 *
 * It is intended as a starting point when adopting RomaTech ORM against an
 * existing database — the generated files should be reviewed and adjusted
 * before being committed.
 */

import { ScaffoldService } from '@romatech/orm';
import { loadOrmConfig } from '../config.js';

/**
 * Registers the `scaffold` command onto a Commander program.
 *
 * Command usage:
 * ```
 * orm scaffold [--config <path>]
 * ```
 *
 * The command will:
 * 1. Load `orm.config.js` (or the path supplied via `--config`).
 * 2. Open a database connection via `config.provider.connect()`.
 * 3. Invoke `ScaffoldService.generateEntitiesFromDb()` which:
 *    a. Queries the database for all table names.
 *    b. Queries each table for its column definitions.
 *    c. Writes a `<PascalCaseTableName>.ts` entity file per table.
 *    d. Writes a `<contextName>.ts` DbContext file that imports all entities.
 * 4. Disconnect from the database (always, even on error).
 *
 * Output directories (`outputDir`, `contextDir`) are created automatically
 * if they do not already exist.
 *
 * The database connection is always closed in the `finally` block so that
 * failures during scaffolding do not leave dangling connections.
 *
 * @param {import('commander').Command} program
 *   The root Commander `Command` instance to attach the sub-command to.
 * @returns {void}
 */
export function registerScaffoldCommand(program) {
  program
    .command('scaffold')
    .description('Reverse-engineer entities and DbContext from an existing database')
    .option('-c, --config <path>', 'Path to config file')
    .action(async (options) => {
      // Load and merge the ORM configuration with defaults.
      const config = await loadOrmConfig(options.config);

      // Connect to the database so ScaffoldService can query the live schema.
      await config.provider.connect(config.connectionString ?? '');
      try {
        const service = new ScaffoldService(config.provider);

        // Generate entity files and the DbContext using the configured output
        // directories and context class name.
        await service.generateEntitiesFromDb(
          config.outputDir,
          config.contextDir,
          config.contextName
        );

        console.log('Scaffold complete.');
      } finally {
        // Always disconnect, swallowing any disconnect error to avoid masking
        // the original scaffold error if one was thrown above.
        await config.provider.disconnect().catch(() => {});
      }
    });
}
