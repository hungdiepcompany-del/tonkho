import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { defineTestMetadata } from '../harness/test-metadata.mjs';

const TEST_METADATA = defineTestMetadata({
  testClass: 'REGRESSION_INVARIANT',
  sourceFiles: ['docs/phases/D7_E4A1B_OWNER_CONFIGURE_CANONICAL_PROPERTIES.md'],
  ownerPolicyRequired: true,
  runtimeMutation: 'NONE'
});

const docs = fs.readFileSync('docs/phases/D7_E4A1B_OWNER_CONFIGURE_CANONICAL_PROPERTIES.md', 'utf8');

test('canonical configuration closeout retains only sanitized verification evidence', () => {
  assert.equal(TEST_METADATA.runtimeMutation, 'NONE');
  assert.doesNotMatch(docs, /\b[a-f0-9]{64}\b/i);
  for (const expected of [
    'CANONICAL_PROPERTY_COUNT=5',
    'ALL_CANONICAL_PROPERTIES_MATCH_PRIVATE_ARTIFACT=YES',
    'OWNER_MARKER_PRESENT=NO',
    'CODEX_SCRIPT_PROPERTY_MUTATION_COUNT=0',
    'D7_E4A1_QUERY_EXECUTED=NO',
    'PRODUCTION_MUTATION=CODEX_NONE'
  ]) assert.ok(docs.includes(expected), expected);
});
