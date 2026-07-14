import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const tokenPrefix = ['ya', '29'].join('');
const forbidden = [
  new RegExp('hungdiepcompany' + '@' + 'gmail[.]com', 'i'),
  new RegExp('100103' + '5198'),
  new RegExp(tokenPrefix + '[.]'),
  new RegExp(['refresh', 'token'].join('_'), 'i'),
  new RegExp(['private', 'key'].join('_'), 'i'),
  new RegExp('BEGIN ' + 'PRIVATE KEY'),
  new RegExp('script[.]google[.]com' + '/macros', 'i'),
];
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((ent) => {
    const p = path.join(dir, ent.name);
    return ent.isDirectory() ? walk(p) : [p];
  });
}
for (const file of walk('fixtures')) {
  const text = fs.readFileSync(file, 'utf8');
  for (const rx of forbidden) assert.doesNotMatch(text, rx, `sensitive fixture marker in ${file}`);
}
console.log('SENSITIVE_FIXTURES=NO');
