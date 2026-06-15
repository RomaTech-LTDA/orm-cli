/**
 * @file migrations-create.js
 * @description Registers the `migration:create <name>` CLI command.
 *
 * This command inspects the entity metadata registered via decorators and
 * generates a new migration JSON file that describes the current schema as
 * `up` (apply) and `down` (rollback) operations.
 *
 * The migration file is written to `config.migrationsPath` and named with a
 * UTC timestamp prefix to guarantee lexicographic ordering, e.g.:
 *   `20240615120000_AddUsersTable.migration.json`
 */

import { MigrationService } from '@romatech/orm';
import { loadEntityModules, loadOrmConfig } from '../config.js';

/**
 * Registers the `migration:create <name>` command onto a Commander program.
 *
 * Command usage:
 * ```
 * orm migration:create <name> [--config <path>]
 * ```
 *
 * The command will:
 * 1. Load `orm.config.js` (or the path supplied via `--config`).
 * 2. Pre-load all entity modules listed in `config.entities` so their
 *    decorators fire and metadata is available.
 * 3. Instantiate `MigrationService` and call `createMigration(name)` which
 *    reads the current entity metadata and writes the JSON file.
 * 4. Print the generated migration name to stdout.
 *
 * Note: this command does **not** connect to the database — entity metadata
 * is derived entirely from the in-memory decorator registry, so no live DB
 * connection is needed.
 *
 * @param {import('commander').Command} program
 *   The root Commander `Command` instance to attach the sub-command to.
 * @returns {void}
 */
export function registerMigrationCreateCommand(program) {
  program
    .command('migration:create <name>')
    .description('Create a new migration file based on the current entity metadata')
    .option('-c, --config <path>', 'Path to config file')
    .action(async (name, options) => {
      // Load and merge the ORM configuration with defaults.
      const config = await loadOrmConfig(options.config);

      // Import entity modules so decorator metadata is registered before
      // MigrationService inspects it via getEntityMetadata().
      await loadEntityModules(config);

      // MigrationService reads decorator metadata and writes the JSON file;
      // no live database connection is required for this step.
      const service = new MigrationService(config.provider, config.migrationsPath);
      const migrationName = await service.createMigration(name);

      console.log(`Migration '${migrationName}' created.`);
    });
}
