import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const files = Object.freeze({
  source: 'D7_E4C_ExactPreconditionDiagnostic.js',
  runtime: 'D7_E4B_ExactFirestoreReconciliationRuntime.js',
  test: 'tests/unit/d7-e4c-exact-precondition-diagnostic.test.mjs',
  packageJson: 'package.json',
  aggregate: 'scripts/test/run-all-checks.mjs'
});

function read(path) {
  assert.equal(fs.existsSync(path), true, `missing ${path}`);
  return fs.readFileSync(path, 'utf8');
}

function main() {
  const source = read(files.source);
  const runtime = read(files.runtime);
  const test = read(files.test);
  const packageJson = JSON.parse(read(files.packageJson));
  const aggregate = read(files.aggregate);

  for (const id of Array.from({ length: 34 }, (_, index) => `P${String(index + 1).padStart(2, '0')}`)) assert.match(source, new RegExp(`'${id}'`));
  for (const token of ['EXACT_TRUE', 'CONTRADICTORY_EVIDENCE', 'MISSING_EVIDENCE', 'UNKNOWN_OUTCOME', 'INCOMPLETE_LISTING', 'MALFORMED_EVIDENCE', 'UPSTREAM_UNDELIVERABLE']) assert.match(source, new RegExp(`'${token}'`));
  for (const token of ['EXACT_EVIDENCE', 'CONTRADICTORY_EVIDENCE', 'MISSING_EVIDENCE', 'UNKNOWN_EVIDENCE', 'INCOMPLETE_EVIDENCE', 'MALFORMED_EVIDENCE', 'UPSTREAM_UNDELIVERABLE']) assert.match(source, new RegExp(`'${token}'`));
  assert.match(source, /function evaluateD7E4BInitialPreconditions_\(/);
  assert.match(source, /function createD7E4CExactPreconditionDiagnosticRunner_\(/);
  assert.match(runtime, /evaluateD7E4BInitialPreconditions_\(authorization, snapshot, expected\)/);
  assert.match(runtime, /readOutcomeUnknown: true, readOutcomeUndeliverable: true/);
  assert.doesNotMatch(source, /\b(?:LockService|PropertiesService|UrlFetchApp|GmailApp|DriveApp|SpreadsheetApp|ScriptApp|createD7E4B|createLock|createStore|reconcile)\b/);
  assert.doesNotMatch(source, /^function\s+runD7E4C/m);
  assert.match(test, /all-pass fixture returns ordered 34\/34/);
  assert.match(test, /isolated non-pass is enumerated/);
  assert.equal(packageJson.scripts['check:d7-e4c-exact-precondition-diagnostic'], 'node scripts/checkers/check-d7-e4c-exact-precondition-diagnostic.mjs');
  assert.match(aggregate, /check-d7-e4c-exact-precondition-diagnostic\.mjs/);
  execFileSync('node', ['--test', files.test], { stdio: 'inherit' });
  console.log('D7_E4C_EXACT_PRECONDITION_DIAGNOSTIC_CHECK=PASS');
}

main();
