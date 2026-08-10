import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { defineTestMetadata } from '../harness/test-metadata.mjs';

const TEST_METADATA = defineTestMetadata({
  testClass: 'REGRESSION_INVARIANT',
  sourceFiles: [
    'D7_E3G_PartialStateReadOnlyDiagnostic.js',
    'D7_B_BoundedReadOnlyCandidateDiscovery.js',
    'D7_E_OwnerApprovedOneCandidateProductionPilot.js'
  ],
  ownerPolicyRequired: true,
  runtimeMutation: 'NONE'
});

const historical = fs.readFileSync('D7_E3G_PartialStateReadOnlyDiagnostic.js', 'utf8');
const fingerprint = fs.readFileSync('D7_B_BoundedReadOnlyCandidateDiscovery.js', 'utf8');
const plan = fs.readFileSync('D7_E_OwnerApprovedOneCandidateProductionPilot.js', 'utf8');

function fullHistoricalSha(name) {
  const match = new RegExp(`const\\s+${name}\\s*=\\s*'([a-f0-9]{64})';`).exec(historical);
  assert.ok(match, `${name} must remain a full SHA-256 value`);
  return match[1];
}

test('canonical historical evidence retains four distinct full SHA-256 values', () => {
  assert.equal(TEST_METADATA.runtimeMutation, 'NONE');
  const values = [
    fullHistoricalSha('D7_E3G_EXPECTED_CANDIDATE_FINGERPRINT_'),
    fullHistoricalSha('D7_E3G_EXPECTED_XML_SHA256_'),
    fullHistoricalSha('D7_E3G_EXPECTED_PDF_SHA256_'),
    fullHistoricalSha('D7_E3G_EXPECTED_ATTACHMENT_SET_SHA256_')
  ];
  assert.equal(new Set(values).size, 4);
});

test('D7-E plan binds canonical invoice identity to the candidate fingerprint', () => {
  assert.match(plan, /invoiceIdentityHash\s*:\s*candidateFingerprint/);
});

test('D7-B fingerprint and attachment-set encodings remain deterministic', () => {
  assert.match(fingerprint, /D7_B_FINGERPRINT_SCHEMA_VERSION_[\s\S]*?encodeD7BComponent_\('invoiceKeyHash', identity\.invoiceKeyHash\)[\s\S]*?encodeD7BComponent_\('hashIndexHash', identity\.hashIndexHash\)[\s\S]*?encodeD7BComponent_\('xmlSha256', candidate\.xml\.sha256\)[\s\S]*?encodeD7BComponent_\('pdfSha256', candidate\.pdf\.sha256\)[\s\S]*?encodeD7BComponent_\('messageIdHash', candidate\.message\.messageIdHash\)[\s\S]*?\.join\('\\n'\)/);
  assert.match(fingerprint, /attachmentSetSha\s*=\s*sha256D7BText_\(\[[\s\S]*?encodeD7BComponent_\('xmlSha256', candidate\.xml\.sha256\)[\s\S]*?encodeD7BComponent_\('pdfSha256', candidate\.pdf\.sha256\)[\s\S]*?\.join\('\\n'\)\)/);
  assert.match(fingerprint, /return String\(n\.length\) \+ ':' \+ n \+ '=' \+ String\(v\.length\) \+ ':' \+ v;/);
  assert.match(fingerprint, /Utilities\.computeDigest\(Utilities\.DigestAlgorithm\.SHA_256/);
});
