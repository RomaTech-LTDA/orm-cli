#!/usr/bin/env node

/**
 * @romatech/orm-cli — Entry point for the RomaTech ORM command-line interface.
 *
 * Registers all available commands and parses CLI arguments using Commander.js.
 *
 * Usage:
 *   orm migration:create <name>   — Create a new migration file
 *   orm update-database           — Apply pending migrations
 *   orm downgrade-database        — Revert the last (or target) migration
 *   orm scaffold                  — Generate entities from an existing DB
 */

import { Command } from 'commander';
import { registerScaffoldCommand } from './commands/scaffold.js';
import { registerMigrationCreateCommand } from './commands/migrations-create.js';
import { registerUpdateDatabaseCommand } from './commands/update-database.js';
import { registerDowngradeDatabaseCommand } from './commands/downgrade-database.js';

const program = new Command();

program
    .name('orm')
    .description('RomaTech ORM CLI — Manage migrations and scaffold entities')
    .version('1.0.0');

// Register all commands
registerScaffoldCommand(program);
registerMigrationCreateCommand(program);
registerUpdateDatabaseCommand(program);
registerDowngradeDatabaseCommand(program);

// Parse and execute
program.parseAsync(process.argv);
