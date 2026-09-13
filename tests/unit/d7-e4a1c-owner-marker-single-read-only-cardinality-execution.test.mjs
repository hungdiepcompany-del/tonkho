import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { defineTestMetadata } from '../harness/test-metadata.mjs';
import { phase0CandidateScope } from '../../scripts/checkers/check-ai-governance-bootstrap.mjs';
import { d7E4A1CAllowedDirtyScope } from '../../scripts/checkers/check-d7-e4a1c-owner-marker-single-read-only-cardinality-execution.mjs';

const TEST_METADATA = defineTestMetadata({
  testClass: 'REGRESSION_INVARIANT',
  sourceFiles: ['docs/phases/D7_E4A1C_OWNER_MARKER_AND_SINGLE_READ_ONLY_CARDINALITY_EXECUTION.md'],
  ownerPolicyRequired: true,
  runtimeMutation: 'NONE'
});

const docs = fs.readFileSync('docs/phases/D7_E4A1C_OWNER_MARKER_AND_SINGLE_READ_ONLY_CARDINALITY_EXECUTION.md', 'utf8');

test('single cardinality closeout retains only sanitized evidence and no rerun authorization', () => {
  assert.equal(TEST_METADATA.runtimeMutation, 'NONE');
  assert.doesNotMatch(docs, /\b[a-f0-9]{64}\b/i);
  for (const expected of [
    'D7_E4A1_AUTHORIZED_EXECUTION_COUNT=1',
    'D7_E4A1_RERUN=NO',
    'OWNER_MARKER_PRESENT_AFTER_EXECUTION=NO',
    'EXACT_MATCHING_JOB_COUNT=1',
    'DUPLICATE_MATCHING_JOB_ABSENCE_PROVEN=YES',
    'RECONCILIATION_EXECUTED=NO',
    'PRODUCTION_DATA_MUTATION=NONE',
    'SHEET_ROW_CREATOR=UNKNOWN'
  ]) assert.ok(docs.includes(expected), expected);
});

test('D7-E4A1C composes the frozen exact Phase 0 candidate scope', () => {
  assert.equal(Object.isFrozen(d7E4A1CAllowedDirtyScope), true);
  for (const file of phase0CandidateScope) assert.equal(d7E4A1CAllowedDirtyScope.includes(file), true, file);
});
