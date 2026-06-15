# @romatech/orm-cli

<p align="center">
  <img src="logo.png" width="120" alt="RomaTech ORM CLI" />
</p>

Command-line interface for [@romatech/orm](https://www.npmjs.com/package/@romatech/orm).

Manage migrations and scaffold entities directly from your terminal.

---

## Installation

### Global (recommended)

```bash
npm install -g @romatech/orm-cli
```

### Local (project-level)

```bash
npm install --save-dev @romatech/orm-cli
npx orm --help
```

---

## Configuration

Create an `orm.config.js` (or `orm.config.mjs`) at your project root:

```js
// orm.config.js
import { MsSqlProvider } from '@romatech/orm-providers-mssql';

export default {
    // Required — the database provider instance
    provider: new MsSqlProvider({
        server: 'localhost',
        database: 'MyDb',
        user: 'sa',
        password: 'yourPassword',
        options: { trustServerCertificate: true }
    }),

    // Optional — override the connection string (takes precedence over config object)
    connectionString: '',

    // Optional — directory where migration JSON files are stored
    migrationsPath: './migrations',

    // Optional — output directory for scaffolded entity files
    outputDir: 'src/entities',

    // Optional — output directory for the scaffolded DbContext
    contextDir: 'src/context',

    // Optional — class name for the scaffolded DbContext
    contextName: 'AppDbContext',

    // Optional — entity module paths to pre-load (so decorators register metadata)
    entities: ['./dist/entities/*.js']
};
```

> **Tip:** The CLI uses ESM dynamic imports, so you can use any provider package.

---

## Commands

### `orm migration:create <name>`

Generates a new migration JSON file based on the current entity metadata.

```bash
orm migration:create InitialCreate
orm migration:create AddProductsTable
orm migration:create -c path/to/orm.config.js AddIndex
```

**Output:**

```
Migration '20260605120000_InitialCreate' created.
```

The file is written to `migrationsPath` (default: `./migrations/`).

---

### `orm update-database`

Connects to the database and applies all pending migrations in chronological order.

```bash
orm update-database
orm update-database --to 20260605120000_AddUsersTable
```

| Option | Description |
|--------|-------------|
| `-t, --to <migration>` | Apply up to this migration (inclusive) |
| `-c, --config <path>` | Path to config file (default: `orm.config.js`) |

---

### `orm downgrade-database`

Reverts the most recently applied migration, or reverts down to a specified target.

```bash
orm downgrade-database
orm downgrade-database --to 20260605120000_Initial
```

| Option | Description |
|--------|-------------|
| `-t, --to <migration>` | Revert everything after this migration (exclusive) |
| `-c, --config <path>` | Path to config file |

---

### `orm scaffold`

Connects to the database, reads the schema, and generates TypeScript entity
files and a DbContext.

```bash
orm scaffold
orm scaffold -c path/to/orm.config.js
```

| Option | Description |
|--------|-------------|
| `-c, --config <path>` | Path to config file |

**Generated files:**

```
src/entities/User.ts
src/entities/Product.ts
src/entities/Order.ts
src/context/AppDbContext.ts
```

Each entity file includes `@Entity`, `@PrimaryKey`, and `@Column` decorators
auto-detected from the database column metadata.

---

## Workflow Example

```bash
# 1. Build your TypeScript project so entities are compiled
npm run build

# 2. Create a migration from the current entity state
orm migration:create InitialCreate

# 3. Apply the migration to the database
orm update-database

# 4. Later, add a new entity and create another migration
orm migration:create AddOrdersTable
orm update-database

# 5. Oops, revert the last migration
orm downgrade-database
```

---

## Config File Resolution

The CLI looks for the config file in this order:

1. Explicit path via `--config` / `-c` flag
2. `orm.config.js` in the current working directory

The config file must export (default or named) an object with at minimum a `provider` property.

---

## Requirements

- Node.js >= 18
- A provider package matching your database
- A compiled `orm.config.js` (ESM/CJS) at your project root

---

## License

MIT © RomaTech / Leandro Romanelli
