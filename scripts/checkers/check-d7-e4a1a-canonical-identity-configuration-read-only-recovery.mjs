import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const files = Object.freeze({
  historical: 'D7_E3G_PartialStateReadOnlyDiagnostic.js',
  fingerprint: 'D7_B_BoundedReadOnlyCandidateDiscovery.js',
  plan: 'D7_E_OwnerApprovedOneCandidateProductionPilot.js',
  test: 'tests/unit/d7-e4a1a-canonical-identity-configuration-read-only-recovery.test.mjs',
  docs: 'docs/phases/D7_E4A1A_CANONICAL_IDENTITY_CONFIGURATION_READ_ONLY_RECOVERY.md',
  checker: 'scripts/checkers/check-d7-e4a1a-canonical-identity-configuration-read-only-recovery.mjs',
  packageJson: 'package.json',
  aggregate: 'scripts/test/run-all-checks.mjs'
});

const knownGuardDirty = Object.freeze(['GUARD.bat', '_guard/']);

function fail(code) {
  console.error(`D7_E4A1A_CANONICAL_IDENTITY_RECOVERY_CHECK=FAIL:${code}`);
  process.exit(1);
}

function read(path) {
  if (!fs.existsSync(path)) fail(`MISSING_${path.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase()}`);
  return fs.readFileSync(path, 'utf8');
}

function normalized(path) {
  return String(path || '').replace(/\\/g, '/');
}

function assertIncludes(text, expected, code) {
  if (!text.includes(expected)) fail(code);
}

function assertMatches(text, pattern, code) {
  if (!pattern.test(text)) fail(code);
}

function assertNoRawHashInDocumentation(text) {
  if (/\b[a-f0-9]{64}\b/i.test(text)) fail('RAW_SHA256_LITERAL_IN_PHASE_DOCUMENTATION');
}

function assertHistoricalConstant(text, name) {
  const expression = new RegExp(`const\\s+${name}\\s*=\\s*'([a-f0-9]{64})';`);
  const match = expression.exec(text);
  if (!match) fail(`HISTORICAL_VALUE_NOT_FULL_SHA256_${name}`);
  return match[1];
}

function assertDirtyScope() {
  const allowed = new Set([
    files.test,
    files.docs,
    files.checker,
    files.packageJson,
    files.aggregate,
    'scripts/checkers/check-d7-e4a1-bounded-firestore-identity-cardinality-read-only-proof.mjs',
    'scripts/checkers/check-d7-e3i-exact-production-conflict-forensic-and-safe-reconciliation-plan.mjs',
    'scripts/checkers/check-d7-e3v-exact-post-hoc-attribution-read-only-diagnostic.mjs',
    'tests/unit/d7-e3v-exact-post-hoc-attribution-read-only-diagnostic.test.mjs',
    'tests/unit/d7-e4a1b-owner-configure-canonical-properties.test.mjs',
    'scripts/checkers/check-d7-e4a1b-owner-configure-canonical-properties.mjs',
    'docs/00_INDEX.md',
    'docs/07_WORK_LOG.md',
    'docs/08_DECISION_LOG.md',
    'docs/09_VALIDATION_LOG.md',
    'docs/99_NEXT_AI_HANDOFF.md',
    'docs/phases/D7_E4A1B_OWNER_CONFIGURE_CANONICAL_PROPERTIES.md'
  ]);
  const status = execFileSync('git', ['status', '--short'], { encoding: 'utf8' });
  const unexpected = status.split(/\r?\n/).filter(Boolean).map(line => normalized(line.slice(3))).filter(path => path && !knownGuardDirty.some(item => path === item || path.startsWith(item)) && !allowed.has(path));
  if (unexpected.length) fail(`UNEXPECTED_DIRTY_FILE_${unexpected[0].replace(/[^A-Za-z0-9]+/g, '_').toUpperCase()}`);
}

function main() {
  assertDirtyScope();
  const historical = read(files.historical);
  const fingerprint = read(files.fingerprint);
  const plan = read(files.plan);
  const test = read(files.test);
  const docs = read(files.docs);
  const packageJson = read(files.packageJson);
  const aggregate = read(files.aggregate);

  const candidate = assertHistoricalConstant(historical, 'D7_E3G_EXPECTED_CANDIDATE_FINGERPRINT_');
  const xml = assertHistoricalConstant(historical, 'D7_E3G_EXPECTED_XML_SHA256_');
  const pdf = assertHistoricalConstant(historical, 'D7_E3G_EXPECTED_PDF_SHA256_');
  const attachmentSet = assertHistoricalConstant(historical, 'D7_E3G_EXPECTED_ATTACHMENT_SET_SHA256_');
  if (new Set([candidate, xml, pdf, attachmentSet]).size !== 4) fail('HISTORICAL_HASHES_NOT_DISTINCT');

  assertMatches(plan, /invoiceIdentityHash\s*:\s*candidateFingerprint/, 'INVOICE_IDENTITY_NOT_CANONICAL_CANDIDATE_FINGERPRINT');
  assertMatches(fingerprint, /D7_B_FINGERPRINT_SCHEMA_VERSION_[\s\S]*?encodeD7BComponent_\('invoiceKeyHash', identity\.invoiceKeyHash\)[\s\S]*?encodeD7BComponent_\('hashIndexHash', identity\.hashIndexHash\)[\s\S]*?encodeD7BComponent_\('xmlSha256', candidate\.xml\.sha256\)[\s\S]*?encodeD7BComponent_\('pdfSha256', candidate\.pdf\.sha256\)[\s\S]*?encodeD7BComponent_\('messageIdHash', candidate\.message\.messageIdHash\)[\s\S]*?\.join\('\\n'\)/, 'FINGERPRINT_V1_COMPONENT_ORDER_NOT_PROVEN');
  assertMatches(fingerprint, /attachmentSetSha\s*=\s*sha256D7BText_\(\[[\s\S]*?encodeD7BComponent_\('xmlSha256', candidate\.xml\.sha256\)[\s\S]*?encodeD7BComponent_\('pdfSha256', candidate\.pdf\.sha256\)[\s\S]*?\.join\('\\n'\)\)/, 'ATTACHMENT_SET_ALGORITHM_NOT_PROVEN');
  assertMatches(fingerprint, /return String\(n\.length\) \+ ':' \+ n \+ '=' \+ String\(v\.length\) \+ ':' \+ v;/, 'COMPONENT_ENCODING_NOT_PROVEN');
  assertMatches(fingerprint, /Utilities\.computeDigest\(Utilities\.DigestAlgorithm\.SHA_256/, 'SHA256_IMPLEMENTATION_NOT_PROVEN');

  for (const expected of [
    'D7_E3G_EXPECTED_CANDIDATE_FINGERPRINT_',
    'D7_E3G_EXPECTED_XML_SHA256_',
    'D7_E3G_EXPECTED_PDF_SHA256_',
    'D7_E3G_EXPECTED_ATTACHMENT_SET_SHA256_',
    'CANDIDATE_FINGERPRINT_MATCH',
    'XML_SOURCE_SHA256_MATCH',
    'PDF_SOURCE_SHA256_MATCH',
    'ATTACHMENT_SET_SHA256_MATCH'
  ]) assertIncludes(historical, expected, `HISTORICAL_EVIDENCE_MISSING_${expected.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase()}`);

  assertNoRawHashInDocumentation(docs);
  for (const expected of [
    'MODE=READ_ONLY_CANONICAL_CONFIGURATION_RECOVERY_NO_SCRIPT_PROPERTY_MUTATION',
    'CANONICAL_PROPERTIES_PRESENT_AT_START=NO_OWNER_ATTESTED',
    'SOURCE_OF_TRUTH_LEVEL=1_IMMUTABLE_TRUSTED_LOCAL_HISTORICAL_EVIDENCE',
    'PRIVATE_OWNER_ARTIFACT=OUTSIDE_REPOSITORY_NOT_COMMITTED',
    'D7_E4A1B_OWNER_CONFIGURE_CANONICAL_PROPERTIES',
    'PRODUCTION_MUTATION=NONE'
  ]) assertIncludes(docs, expected, `DOCS_MISSING_${expected.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase()}`);

  assertIncludes(test, 'canonical historical evidence retains four distinct full SHA-256 values', 'TEST_COVERAGE_MISSING');
  assertIncludes(packageJson, 'check:d7-e4a1a-canonical-identity-recovery', 'PACKAGE_COMMAND_MISSING');
  assertIncludes(aggregate, 'check-d7-e4a1a-canonical-identity-configuration-read-only-recovery.mjs', 'AGGREGATE_COMMAND_MISSING');
  console.log('D7_E4A1A_CANONICAL_IDENTITY_RECOVERY_CHECK=PASS');
}

main();
