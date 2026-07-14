import fs from 'node:fs';
import path from 'node:path';

export function fixturePath(...parts) {
  return path.join(process.cwd(), 'fixtures', ...parts);
}

export function readFixtureText(...parts) {
  return fs.readFileSync(fixturePath(...parts), 'utf8');
}

export function readFixtureJson(...parts) {
  return JSON.parse(readFixtureText(...parts));
}
