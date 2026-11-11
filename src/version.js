/**
 * @file version.js
 * @description Exposes the version declared in this package's package.json,
 * so `orm --version` always matches the installed release.
 */

import { readFileSync } from 'node:fs';

/** Version of the installed @romatech/orm-cli package. */
export const packageVersion = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf-8')
).version;
