import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((ent) => {
    const p = path.join(dir, ent.name);
    return ent.isDirectory() ? walk(p) : [p];
  });
}
const tests = walk('tests').filter((p) => p.endsWith('.test.mjs'));
assert.ok(tests.length > 0, 'no tests found');
for (const file of tests) {
  const text = fs.readFileSync(file, 'utf8');
  assert.match(text, /TEST_METADATA|defineTestMetadata/, `missing metadata in ${file}`);
  assert.match(text, /runtimeMutation:\s*'NONE'/, `missing runtimeMutation NONE in ${file}`);
}
console.log('TEST_METADATA=PASS');
