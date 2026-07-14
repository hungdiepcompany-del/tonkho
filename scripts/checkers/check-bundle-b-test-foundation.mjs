import fs from 'node:fs';
import assert from 'node:assert/strict';

const required = [
  'package.json',
  'tests/harness/load-gas-source.mjs',
  'tests/harness/gas-stubs.mjs',
  'tests/harness/fixture-loader.mjs',
  'tests/harness/test-metadata.mjs',
  'fixtures/README.md',
  'artifacts/test/b01-testability-inventory.json',
  'artifacts/test/b01-fixture-inventory.json',
  'artifacts/test/bundle-b-test-matrix.json',
  'docs/phases/BUNDLE_B_LOCAL_TEST_FOUNDATION.md',
];
for (const file of required) assert.ok(fs.existsSync(file), `missing ${file}`);
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
for (const script of ['test', 'test:unit', 'test:bugs', 'test:static', 'test:schemas', 'check']) assert.ok(pkg.scripts[script], `missing script ${script}`);
console.log('BUNDLE_B_TEST_FOUNDATION=PASS');
