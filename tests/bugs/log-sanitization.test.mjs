
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';

const TEST_METADATA = defineTestMetadata({ testClass: 'REGRESSION_INVARIANT', sourceFiles: ['utils.js'], ownerPolicyRequired: false, runtimeMutation: 'NONE' });

test('C05: debugLog sanitizes raw email body, email, tax code, and URL query', () => {
  const logs = [];
  const gas = loadGasSource({
    files: ['utils.js'],
    exportNames: ['debugLog_'],
    stubs: {
      CONFIG: { DEBUG_LOG: true },
      Logger: { log: (msg) => logs.push(String(msg)) },
    },
  });
  gas.call('debugLog_', 'Customer tax 0100000001 email buyer@example.test https://example.test/invoice?token=secret raw body '.repeat(8));
  const out = logs.join('\n');
  assert.doesNotMatch(out, /buyer@example\.test/);
  assert.doesNotMatch(out, /0100000001/);
  assert.doesNotMatch(out, /token=secret/);
  assert.match(out, /\[EMAIL\]/);
  assert.match(out, /\[QUERY_REDACTED\]/);
});
