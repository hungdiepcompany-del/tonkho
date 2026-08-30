import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = process.cwd();
const activeName = 'SGDS_WRITER_AUTHORITY_V3_CONTROLLER_ENFORCED_SINGLE_WRITER_IMPLEMENTATION.md';
const matrix = 'ABCDEFGHIJKLMNOPQ'.split('');
const read = file => fs.readFileSync(file, 'utf8');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const candidateScope = [
  'docs/12_AI_WORK_LOG.md', 'docs/13_DECISION_LOG.md', 'docs/99_NEXT_AI_HANDOFF.md', 'docs/AI_WORKFLOW.md',
  'docs/exec-plans/active/SGDS_WRITER_AUTHORITY_V3_CONTROLLER_ENFORCED_SINGLE_WRITER_IMPLEMENTATION.md',
  'docs/exec-plans/completed/SGDS_WRITER_AUTHORITY_V3_INTEGRATED_REPAIR_AND_EXACT_LEASE_DISPOSITION.md',
  'package.json', 'scripts/ai/Manage-NonWriterIsolation.ps1', 'scripts/checkers/check-ai-governance-bootstrap.mjs',
  'scripts/test/run-all-checks.mjs', 'tests/fixtures/writer-authority/**', 'tests/unit/ai-governance-bootstrap.test.mjs',
  'scripts/checkers/check-no-secret.ps1',
  'scripts/checkers/check-d7-e3v-exact-post-hoc-attribution-read-only-diagnostic.mjs',
  'scripts/checkers/check-d7-e4a1-bounded-firestore-identity-cardinality-read-only-proof.mjs',
  'scripts/checkers/check-d7-e4a1a-canonical-identity-configuration-read-only-recovery.mjs',
  'scripts/checkers/check-d7-e4a1b-owner-configure-canonical-properties.mjs',
  'scripts/checkers/check-d7-e4a1c-owner-marker-single-read-only-cardinality-execution.mjs',
  'scripts/checkers/check-d7-e4a2-exact-firestore-reconciliation-plan-finalization.mjs'
];
const allowed = new Set(candidateScope.filter(item => !item.endsWith('/**')));
const inherited = new Set([
  'GUARD.bat', '_guard/PROJECT_GUARD.config.bat', '_guard/PROJECT_GUARD_ENGINE.bat', '_guard/README.md', 'docs/00_INDEX.md', 'docs/04_MASTER_PLAN.md', 'docs/07_WORK_LOG.md', 'docs/08_DECISION_LOG.md', 'docs/09_VALIDATION_LOG.md',
  'scripts/checkers/check-d7-e3v-exact-post-hoc-attribution-read-only-diagnostic.mjs', 'scripts/checkers/check-d7-e4b-exact-firestore-reconciliation-runtime.mjs',
  '.codex/agents/coder.toml', '.codex/agents/explorer.toml', '.codex/agents/reviewer.toml', '.codex/agents/verifier.toml', '.codex/config.toml', 'AGENTS.md', '_guard/deploy/DEPLOY_GOOGLE_APPS_FIREBASE.bat',
  'docs/AI_EXECUTION_ROUTING.md', 'docs/FILE_MANIFEST.md', 'docs/WORKFLOW_V2_CHANGE_SUMMARY.md', 'docs/WORKFLOW_V2_FILE_INVENTORY.md', 'docs/exec-plans/completed/D7_E4B2_POLICY_REPAIR_WRITER_LIFECYCLE_AND_MR2R_CLOSURE.md', 'docs/exec-plans/completed/D7_E4B2_PRODUCTION_EXECUTION_READINESS_AND_OWNER_GATE.md', 'docs/exec-plans/completed/SYNC_GOV1_REPO_GOVERNANCE_BOOTSTRAP.md'
]);
function values(text) { return new Map([...text.replace(/^\uFEFF/, '').matchAll(/^([A-Z][A-Z0-9_]*)=(.*)$/gm)].map(([, k, v]) => [k, v])); }
function parseTap(output) { const get = key => Number(output.match(new RegExp(`# ${key} (\\d+)`))?.[1] ?? NaN); return { tests: get('tests'), pass: get('pass'), fail: get('fail'), skip: get('skipped'), todo: get('todo'), cancelled: get('cancelled') }; }
function contractScope(contract) { const section = contract.match(/## Allowed mutation scope\r?\n([\s\S]*?)\r?\n## /)?.[1] ?? ''; return [...section.matchAll(/^- `([^`]+)`/gm)].map(([, item]) => item); }
function activeContract(base = root) {
  const dir = path.join(base, 'docs', 'exec-plans', 'active'); const files = fs.readdirSync(dir).filter(name => name.endsWith('.md')).sort();
  assert.deepEqual(files, [activeName], 'ACTIVE_CONTRACT_EXACTLY_ONE'); const contract = read(path.join(dir, activeName)); const v = values(contract);
  for (const [key, value] of Object.entries({ TASK_ID: 'SGDS_WRITER_AUTHORITY_V3_MODEL_B_BOOTSTRAP_CODER_V1', STATUS: 'ACTIVE', SELECTED_MODEL: 'MODEL_B_CONTROLLER_ENFORCED_SINGLE_WRITER', REPOSITORY_PRIMITIVE: 'MODEL_C_STYLE_ATOMIC_DURABLE_WRITER_SLOT', NON_SPOOFABLE_TASK_ATTESTATION_REQUIRED: 'false' })) assert.equal(v.get(key), value, `contract ${key}`);
  assert.deepEqual(contractScope(contract), candidateScope, 'ACTIVE_CONTRACT_CANDIDATE_SCOPE_EXACT');
}
function functionBody(source, name) {
  const start = source.indexOf(`function ${name} {`); assert.notEqual(start, -1, `missing ${name}`);
  const next = source.slice(start + 1).search(/\r?\nfunction |\r?\nswitch \(\$Action\)/); return source.slice(start, next === -1 ? source.length : start + 1 + next);
}
function helperStatic(base = root) {
  const text = read(path.join(base, 'scripts/ai/Manage-NonWriterIsolation.ps1'));
  const block = text.match(/\[ValidateSet\(([^)]*)\)\]/)?.[1] ?? ''; const actions = [...block.matchAll(/'([^']+)'/g)].map(x => x[1]);
  assert.deepEqual(actions, ['Create', 'ValidateIsolation', 'Cleanup', 'ControllerAssign', 'ControllerVerify', 'WriterComplete', 'ControllerRelease', 'InspectWriter']);
  for (const token of ['Get-CanonicalUtcMilliseconds', 'Assert-WriterState', 'Publish-JsonAtomically', 'Write-WriterStateAtomic', 'Assert-ReplayReceipt', 'RESPONSE_LOSS_AFTER_COMMIT_RECONCILE_WITH_OPERATION_ID', 'LEGACY_V2_WRITER_STATE_BLOCKS_MUTATION', 'ACTIVE_ISOLATION_BLOCKS_WRITER', 'LIVE_WRITER_STATE_BLOCKS_ISOLATION']) assert.match(text, new RegExp(token.replace(/[()]/g, '\\$&')));
  assert.doesNotMatch(block, /AcquireWriter|VerifyWriter|CompleteWriter|ReleaseWriter/);
  const dispatch = text.slice(text.lastIndexOf('switch ($Action)'));
  for (const [action, target] of [['ControllerAssign', 'Invoke-ControllerAssign'], ['ControllerVerify', 'Invoke-ControllerVerify'], ['WriterComplete', 'Invoke-WriterComplete'], ['ControllerRelease', 'Invoke-ControllerRelease'], ['InspectWriter', 'Invoke-InspectWriterV3']]) assert.match(dispatch, new RegExp(`'${action}' \\{ ${target} \\}`), `reachable dispatch ${action}`);
  assert.doesNotMatch(dispatch, /Invoke-(AcquireWriter|VerifyWriter|CompleteWriter|ReleaseWriter|InspectWriter)(?!V3)/, 'v2 dispatch reachable');
  const reachable = ['Invoke-ControllerAssign', 'Invoke-ControllerVerify', 'Invoke-WriterComplete', 'Invoke-ControllerRelease', 'Invoke-InspectWriterV3', 'Assert-WriterIsolationInterlock', 'Assert-NoLegacyWriterState', 'Read-WriterState', 'Assert-WriterState', 'Assert-WriterSlot', 'Get-OperationReceipt', 'Assert-ReplayReceipt', 'Add-OperationReceipt', 'Write-WriterStateAtomic', 'Publish-JsonAtomically', 'Read-ActiveIsolationRegistry', 'Write-ActiveIsolationRegistry', 'Clear-ActiveIsolationRegistry'];
  const forbidden = /\b(Get-ExactProcessIdentity|Get-ClaimedWriterIdentity|Test-WriterIdentityExact|Get-WriterInspection|Invoke-(AcquireWriter|VerifyWriter|CompleteWriter|ReleaseWriter|InspectWriter)(?!V3)|Get-CimInstance|Win32_Process|WriterRuntime|RuntimeSession|AcquirerRuntime)\b|\$PID\b/i;
  for (const name of reachable) assert.doesNotMatch(functionBody(text, name), forbidden, `v3 authority must not derive process/runtime identity: ${name}`);
  const envUses = [...text.matchAll(/\[Environment\]::GetEnvironmentVariable/g)].map(match => match.index); for (const index of envUses) { const before = text.slice(0, index); const owner = before.lastIndexOf('function '); const body = text.slice(owner, text.indexOf('\nfunction ', owner + 1)); assert.match(body, /function (Get-GovernanceTransitionLockTestSetting|Invoke-WriterResponseLoss|Invoke-CreationFailureInjection)/, 'environment identity outside explicit test hook'); }
}
function focusedSource(base = root) {
  const text = read(path.join(base, 'tests/unit/ai-governance-bootstrap.test.mjs'));
  assert.equal((text.match(/\btest\('/g) ?? []).length, 17, 'A_Q_TEST_COUNT_EXACT'); assert.doesNotMatch(text, /\b(?:test\.(?:skip|todo)|\.skip\(|\.todo\()/, 'A_Q_SKIP_OR_TODO_FORBIDDEN');
  for (const letter of matrix) assert.match(text, new RegExp(`test\\('${letter} `), `missing matrix ${letter}`);
  for (const token of ['spawnInvoke', 'waitForFile', 'SGDS_GOVERNANCE_TEST_LOCK_PRE_RELEASE_HOLD_MS', "OperationId: 'g-v'", 'legacy', 'malformed', 'bidirectional', 'checkStaticGovernance']) assert.match(text, new RegExp(token, 'i'));
}
export function checkStaticGovernance(base = root) { activeContract(base); helperStatic(base); focusedSource(base); return true; }
function scope() {
  const status = execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], { cwd: root, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
  for (const line of status) { const file = line.slice(3).replaceAll('\\', '/'); assert.ok(allowed.has(file) || inherited.has(file) || file.startsWith('tests/fixtures/writer-authority/'), `UNAUTHORIZED_PATH_CHANGE=${file}`); }
  assert.equal(execFileSync('git', ['diff', '--cached', '--name-only'], { cwd: root, encoding: 'utf8' }).trim(), '', 'STAGING_NONEMPTY');
  for (const file of ['D7_E4B_ExactFirestoreReconciliationRuntime.js', 'Operator_Entrypoints.js']) assert.equal(sha(read(path.join(root, file))), sha(execFileSync('git', ['show', `HEAD:${file}`], { cwd: root, encoding: 'utf8' })), `${file} changed`);
}
function focused() { const run = spawnSync(process.execPath, ['--test', 'tests/unit/ai-governance-bootstrap.test.mjs'], { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }); const out = (run.stdout || '') + (run.stderr || ''); const tap = parseTap(out); assert.equal(run.status, 0, out); assert.deepEqual(tap, { tests: 17, pass: 17, fail: 0, skip: 0, todo: 0, cancelled: 0 }, out); for (const letter of matrix) assert.match(out, new RegExp(`Subtest: ${letter} `), `missing matrix ${letter}`); return tap; }
export function checkGovernance() { checkStaticGovernance(root); const parsed = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(root, 'scripts/ai/Manage-NonWriterIsolation.ps1'), '-Action', 'InspectWriter'], { cwd: root, encoding: 'utf8' }); assert.equal(parsed.status, 0, parsed.stdout + parsed.stderr); scope(); const tap = focused(); return { tap, status: 'PASS' }; }
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) { const r = checkGovernance(); console.log(`AI_GOVERNANCE_BOOTSTRAP_CHECK=PASS TESTS=${r.tap.tests} PASS=${r.tap.pass} FAIL=${r.tap.fail} SKIP=${r.tap.skip} TODO=${r.tap.todo}`); }
