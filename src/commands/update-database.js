/**
 * @file update-database.js
 * @description Registers the `update-database` CLI command.
 *
 * This command reads all migration JSON files from `config.migrationsPath`,
 * compares them against the provider's migration history table, and applies
 * every pending migration in chronological (timestamp) order.
 *
 * An optional `--to` flag limits the run to migrations up to and including
 * the named target, allowing incremental, controlled schema updates.
 */

import { MigrationService } from '@romatech/orm';
import { loadEntityModules, loadOrmConfig } from '../config.js';

/**
 * Registers the `update-database` command onto a Commander program.
 *
 * Command usage:
 * ```
 * orm update-database [--to <migration>] [--config <path>]
 * ```
 *
 * The command will:
 * 1. Load `orm.config.js` (or the path supplied via `--config`).
 * 2. Pre-load all entity modules listed in `config.entities`.
 * 3. Open a database connection via `config.provider.connect()`.
 * 4. Apply all pending migrations (or those up to `--to`, inclusive) using
 *    `MigrationService.updateDatabase()`.
 * 5. Disconnect from the database (always, even on error).
 *
 * The database connection is always closed in the `finally` block so that
 * partial failures do not leave dangling connections.
 *
 * @param {import('commander').Command} program
 *   The root Commander `Command` instance to attach the sub-command to.
 * @returns {void}
 */
export function registerUpdateDatabaseCommand(program) {
  program
    .command('update-database')
    .description('Apply pending migrations to update the database schema')
    .option('-t, --to <migration>', 'Target migration to apply (inclusive)')
    .option('-c, --config <path>', 'Path to config file')
    .action(async (options) => {
      // Load and merge the ORM configuration with defaults.
      const config = await loadOrmConfig(options.config);

      // Import entity modules so decorator metadata is available if needed.
      await loadEntityModules(config);

      // Open the database connection before applying migrations.
      await config.provider.connect(config.connectionString ?? '');
      try {
        const service = new MigrationService(config.provider, config.migrationsPath);

        // Pass options.to (may be undefined) to apply all pending migrations
        // or stop at the specified target migration name.
        await service.updateDatabase(options.to);

        console.log('Database updated successfully.');
      } finally {
        // Always disconnect, swallowing any disconnect error to avoid masking
        // the original migration error if one was thrown above.
        await config.provider.disconnect().catch(() => {});
      }
    });
}
