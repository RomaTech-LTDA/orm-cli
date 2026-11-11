# Changelog

All notable changes to @romatech/orm-cli will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [2.1.0] - 2026-11-11

### Fixed
- `entities` patterns such as `./dist/entities/*.js` (the README example) are now expanded (`*`, `?`, `**`); they used to be imported literally and failed with `ERR_MODULE_NOT_FOUND`. A pattern that matches no file, or that ends in `**` instead of a file name pattern, is reported as an error.
- Entity patterns keep UNC roots (`\\server\share\...`) and descend into symbolic links / junctions to directories; `**` stops at a link cycle.
- `orm --version` reports the package version instead of a hard-coded `1.0.0`.

### Changed
- Requires `@romatech/orm` `^2.1.0` (peer dependency): incremental migrations, entity registry shared with a globally installed CLI, migration names from the database validated before `downgrade-database`.
- With `@romatech/orm` 2.1.0, `orm migration:create` fails with "No model changes" and writes no file when the entities did not change.
- README: warning that migrations created with 2.0.0 drop every table when reverted.
- Standardized `index.html` landing page (GitHub Pages) with new template: header, hero, quick start, features grid, install command, footer.
- CI (`ci.yml`) runs `npm ci`, tests, `npm audit --omit=dev` and `npm pack --dry-run` on Node 22 and 24 with read-only permissions; the publish workflow uses Node 22 and `npm ci`, and refuses to publish when the latest `@romatech/orm` on npm is older than the peer range in `package.json` (it used to lower the range to whatever was published).

### Added
- Unit tests (`npm test`).
