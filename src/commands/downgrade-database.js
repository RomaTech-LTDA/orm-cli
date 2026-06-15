/**
 * @file downgrade-database.js
 * @description Registers the `downgrade-database` CLI command.
 *
 * This command reverts applied migrations in reverse-chronological order.
 * Without `--to` it rolls back only the most recently applied migration.
 * With `--to <migration>` it reverts every migration that was applied
 * **after** the named target, leaving the target itself in place.
 */

import { MigrationService } from '@romatech/orm';
import { loadEntityModules, loadOrmConfig } from '../config.js';

/**
 * Registers the `downgrade-database` command onto a Commander program.
 *
 * Command usage:
 * ```
 * orm downgrade-database [--to <migration>] [--config <path>]
 * ```
 *
 * The command will:
 * 1. Load `orm.config.js` (or the path supplied via `--config`).
 * 2. Pre-load all entity modules listed in `config.entities`.
 * 3. Open a database connection via `config.provider.connect()`.
 * 4. Revert migrations using `MigrationService.downgradeDatabase()`:
 *    - Without `--to`: rolls back the single most recent applied migration.
 *    - With `--to <name>`: rolls back all migrations applied after `<name>`
 *      (i.e. `<name>` becomes the new "last applied" migration).
 * 5. Disconnect from the database (always, even on error).
 *
 * The database connection is always closed in the `finally` block so that
 * partial failures do not leave dangling connections.
 *
 * @param {import('commander').Command} program
 *   The root Commander `Command` instance to attach the sub-command to.
 * @returns {void}
 */
export function registerDowngradeDatabaseCommand(program) {
  program
    .command('downgrade-database')
    .description('Revert the database to the last applied migration or to a specified target')
    .option('-t, --to <migration>', 'Target migration to downgrade to (exclusive)')
    .option('-c, --config <path>', 'Path to config file')
    .action(async (options) => {
      // Load and merge the ORM configuration with defaults.
      const config = await loadOrmConfig(options.config);

      // Import entity modules so decorator metadata is available if needed.
      await loadEntityModules(config);

      // Open the database connection before reverting migrations.
      await config.provider.connect(config.connectionString ?? '');
      try {
        const service = new MigrationService(config.provider, config.migrationsPath);

        // Pass options.to (may be undefined) to revert only the last migration
        // or all migrations down to (but not including) the specified target.
        await service.downgradeDatabase(options.to);

        console.log('Database downgraded successfully.');
      } finally {
        // Always disconnect, swallowing any disconnect error to avoid masking
        // the original migration error if one was thrown above.
        await config.provider.disconnect().catch(() => {});
      }
    });
}
