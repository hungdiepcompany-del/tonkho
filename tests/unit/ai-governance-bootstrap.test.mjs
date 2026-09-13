import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { defineTestMetadata } from '../harness/test-metadata.mjs';
import { assertAggregateGateOrdering, assertV6ScopeEntries, assertWindowsNoReparsePoints, authoritativeContractPreamble, checkStaticGovernance, deriveV10GuardBehaviorEvidence, interpretBatchCfgEvidence, parsePorcelainV1Z, phase0CandidateScope, reachableHeadObjectGraphIdentity, readIsolationIdentity, resolveControllerReceiptPath, validateControllerInspectionReceiptPayload } from '../../scripts/checkers/check-ai-governance-bootstrap.mjs';
import { createWindowsPowerShellEnvironment } from '../../scripts/test/powershell-module-env.mjs';

const TEST_METADATA = defineTestMetadata({ testClass: 'REGRESSION_INVARIANT', sourceFiles: ['scripts/ai/Manage-NonWriterIsolation.ps1', 'scripts/test/powershell-module-env.mjs'], ownerPolicyRequired: true, runtimeMutation: 'NONE' });
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const helper = path.join(root, 'scripts', 'ai', 'Manage-NonWriterIsolation.ps1');
const authority = 'SGDS_WRITER_AUTHORITY_V3_TEST';
const id = crypto.randomBytes(16).toString('hex');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const field = (output, name) => output.match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1] ?? '';
const gitBuffer = (repo, args) => execFileSync('git', args, { cwd: repo, encoding: null });
const gitStatusV1Z = repo => gitBuffer(repo, ['status', '--porcelain=v1', '-z', '--untracked-files=all']);
const stagedEntryIdentity = repo => `sha256:${sha(gitBuffer(repo, ['ls-files', '--stage', '-z']))}`;
const semanticIndexIdentity = repo => {
  const entries = `sha256:${sha(gitBuffer(repo, ['ls-files', '--stage', '-z']))}`;
  const patch = `sha256:${sha(gitBuffer(repo, ['diff', '--cached', '--binary', '--no-ext-diff', 'HEAD']))}`;
  return `sha256:${sha(`${entries}\n${patch}`)}`;
};

export function validateActiveContracts(base) {
  const active = path.join(base, 'docs', 'exec-plans', 'active');
  const files = fs.existsSync(active) ? fs.readdirSync(active).filter(name => name.endsWith('.md')).sort() : [];
  return files.length === 1 && files[0] === 'SGDS_PHASE0_CURRENT_STATE_NORMALIZATION_AND_PRODUCTION_RECOVERY_HANDOFF.md';
}
function fixture() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'sgds-wa3-'));
  execFileSync('git', ['init', '-q'], { cwd: repo }); execFileSync('git', ['config', 'user.email', 'test@example.invalid'], { cwd: repo }); execFileSync('git', ['config', 'user.name', 'test'], { cwd: repo });
  fs.writeFileSync(path.join(repo, 'README.md'), 'baseline\n'); execFileSync('git', ['add', 'README.md'], { cwd: repo }); execFileSync('git', ['commit', '-qm', 'baseline'], { cwd: repo });
  return repo;
}
function invoke(repo, action, values = {}, executable = 'powershell.exe') {
  const args = executable === 'powershell.exe' ? ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', helper, '-Action', action] : ['-NoProfile', '-File', helper, '-Action', action];
  const add = (key, value) => { if (value !== undefined && value !== null && value !== '') args.push(`-${key}`, String(value)); };
  add('AuthorityId', values.AuthorityId ?? authority); add('AssignmentId', values.AssignmentId ?? `${id}-assignment`); add('TaskId', values.TaskId ?? 'logical-writer-a'); add('OperationId', values.OperationId ?? `${action}-${crypto.randomUUID()}`);
  add('IsolationPurpose', values.IsolationPurpose); add('IsolationRoot', values.IsolationRoot); add('UntrackedPathPayload', values.UntrackedPathPayload); add('WriterRuntimePid', values.WriterRuntimePid);
  const run = spawnSync(executable, args, { cwd: repo, encoding: 'utf8', env: { ...process.env, ...values.env }, timeout: values.timeout ?? 15_000 });
  return { status: run.status ?? 1, output: (run.stdout || '') + (run.stderr || ''), timedOut: run.error?.code === 'ETIMEDOUT' };
}
function spawnInvoke(repo, action, values = {}) {
  const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', helper, '-Action', action, '-AuthorityId', authority, '-AssignmentId', values.AssignmentId, '-TaskId', values.TaskId ?? 'logical-writer-a', '-OperationId', values.OperationId];
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', args, { cwd: repo, env: { ...process.env, ...values.env }, windowsHide: true }); let output = '';
    child.stdout.on('data', chunk => { output += chunk; }); child.stderr.on('data', chunk => { output += chunk; }); child.on('error', reject); child.on('close', status => resolve({ status: status ?? 1, output }));
  });
}
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitForFile(file) { for (let i = 0; i < 80; i += 1) { if (fs.existsSync(file)) return; await wait(25); } throw new Error(`lock was not observed: ${file}`); }
function ok(run) { assert.equal(run.status, 0, run.output); return run; }
function lifecycle(repo, executable = 'powershell.exe', suffix = 'x') {
  const assignment = `${id}-${suffix}`;
  ok(invoke(repo, 'ControllerAssign', { AssignmentId: assignment, OperationId: `${suffix}-assign` }, executable));
  ok(invoke(repo, 'ControllerVerify', { AssignmentId: assignment, OperationId: `${suffix}-verify` }, executable));
  ok(invoke(repo, 'WriterComplete', { AssignmentId: assignment, OperationId: `${suffix}-complete` }, executable));
  return { assignment, release: () => ok(invoke(repo, 'ControllerRelease', { AssignmentId: assignment, OperationId: `${suffix}-release` }, executable)) };
}
function withRepo(body) { const repo = fixture(); try { return body(repo); } finally { if (!(body.constructor.name === 'AsyncFunction')) fs.rmSync(repo, { recursive: true, force: true }); } }
async function withAsyncRepo(body) { const repo = fixture(); try { await body(repo); } finally { fs.rmSync(repo, { recursive: true, force: true }); } }
function statePath(repo) { return path.join(repo, '.git', 'non-writer-isolation.writer-authority-v3.json'); }
function registryPath(repo) { return path.join(repo, '.git', 'non-writer-isolation.active-v3.json'); }
function indexSha(repo) { return sha(fs.readFileSync(path.join(repo, '.git', 'index'))); }
function embeddedClaspParserCommand() {
  const deploy = fs.readFileSync(path.join(root, '_guard', 'deploy', 'DEPLOY_GOOGLE_APPS_FIREBASE.bat'), 'utf8');
  const line = deploy.split(/\r?\n/).find(value => value.includes('ConvertFrom-Json') && value.includes('CLASP_SCRIPT_ID'));
  const match = line?.match(/-Command "(.+)" 2\^>nul'?\) do/);
  assert.ok(match, 'embedded .clasp.json parser command must be extractable');
  return match[1].replace(/\^([()|])/g, '$1');
}
function runEmbeddedClaspParser(claspJson) {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sgds-clasp-parser-'));
  try {
    let payload = claspJson;
    try { const parsed = JSON.parse(claspJson); if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && !Object.hasOwn(parsed, 'rootDir')) parsed.rootDir = '.'; payload = JSON.stringify(parsed); } catch { /* malformed fixtures stay malformed */ }
    fs.writeFileSync(path.join(fixtureRoot, '.clasp.json'), payload);
    const run = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', embeddedClaspParserCommand()], { cwd: fixtureRoot, encoding: 'utf8' });
    const [output = '', rootDir = ''] = (run.stdout ?? '').split('|');
    return { status: run.status ?? 1, output, rootDir };
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
}
function batchLabelBody(source, label) {
  const marker = `\r\n${label}\r\n`; const markerIndex = source.indexOf(marker); assert.notEqual(markerIndex, -1, `missing batch label ${label}`); const start = markerIndex + 2;
  const next = source.indexOf('\r\n:', start + label.length); return source.slice(start, next === -1 ? source.length : next);
}
function assertDirectDeployFixtureFailsBeforeTools(fixture, gate) {
  const deploy = fs.readFileSync(path.join(root, '_guard', 'deploy', 'DEPLOY_GOOGLE_APPS_FIREBASE.bat'), 'utf8');
  const preflight = batchLabelBody(deploy, ':AdapterPrivilegedPreflight');
  const deployAction = batchLabelBody(deploy, ':Deploy');
  const gas = batchLabelBody(deploy, ':DeployGas');
  const firebase = batchLabelBody(deploy, ':DeployFirebase');
  assert.notEqual(preflight.indexOf(gate), -1, `${fixture}: independent preflight gate missing`);
  assert.doesNotMatch(preflight, /(?:call :RequireTool|clasp\.cmd|firebase\.cmd|gcloud\.cmd)/i, `${fixture}: preflight must stop before service tools`);
  for (const [target, service] of [['gas', 'call :GasPreflight'], ['firebase', 'call :FirebasePreflight'], ['all', 'call :GasPreflight']]) {
    const start = deployAction.indexOf(`if /I "%DEPLOY_TARGET%"=="${target}" (`);
    const section = deployAction.slice(start, deployAction.indexOf('\r\n)', start) + 3);
    assert.ok(section.indexOf('call :AdapterPrivilegedPreflight') < section.indexOf(service), `${fixture}: direct ${target} path must stop before service checks`);
  }
  assert.ok(gas.indexOf('call :AdapterPrivilegedPreflight') < gas.indexOf('clasp.cmd --user "%CLASP_PROFILE%" push'), `${fixture}: gas mutation requires an independent recheck`);
  assert.ok(firebase.indexOf('call :AdapterPrivilegedPreflight') < firebase.indexOf('firebase.cmd deploy'), `${fixture}: Firebase mutation requires an independent recheck`);
}

test('A canonical numeric UTC timestamp semantics under Windows PowerShell 5.1', () => withRepo(repo => { const a = `${id}-a`; ok(invoke(repo, 'ControllerAssign', { AssignmentId: a, OperationId: 'a' })); const state = JSON.parse(fs.readFileSync(statePath(repo), 'utf8')); assert.equal(Number.isInteger(state.slot.assigned_at_utc_ms), true); assert.equal(String(state.slot.assigned_at_utc_ms).includes('T'), false); }));
test('B equivalent behavior under PowerShell 7', () => withRepo(repo => { assert.equal(spawnSync('pwsh', ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.Major'], { encoding: 'utf8' }).status, 0, 'pwsh unavailable'); const run = lifecycle(repo, 'pwsh', 'b'); run.release(); }));
test('C locale independence', () => withRepo(repo => { const a = `${id}-c`; ok(invoke(repo, 'ControllerAssign', { AssignmentId: a, OperationId: 'c', env: { LANG: 'vi-VN', LC_ALL: 'vi-VN' } })); assert.match(fs.readFileSync(statePath(repo), 'utf8'), /assigned_at_utc_ms/); }));
test('D simultaneous two-process assignment has one lock/slot winner', async () => withAsyncRepo(async repo => {
  const lock = `${statePath(repo)}.transition.lock`; const env = { SGDS_GOVERNANCE_TEST_MODE: 'OWNERSHIP_LOCK_V2', SGDS_GOVERNANCE_TEST_LOCK_PRE_RELEASE_HOLD_MS: '800' };
  const one = spawnInvoke(repo, 'ControllerAssign', { AssignmentId: `${id}-d1`, OperationId: 'd-1', env }); await waitForFile(lock);
  const two = spawnInvoke(repo, 'ControllerAssign', { AssignmentId: `${id}-d2`, OperationId: 'd-2', env }); const results = await Promise.all([one, two]);
  assert.equal(results.filter(result => result.status === 0).length, 1, results.map(result => result.output).join('\n')); assert.match(results.find(result => result.status !== 0).output, /WRITER_LEASE_TRANSITION_LOCKED|WRITER_SLOT_BLOCKED/);
}));
test('E wrong logical writer cannot Verify Complete or Release', () => withRepo(repo => { const a = `${id}-e`; ok(invoke(repo, 'ControllerAssign', { AssignmentId: a, OperationId: 'e-a' })); for (const action of ['ControllerVerify', 'WriterComplete', 'ControllerRelease']) assert.notEqual(invoke(repo, action, { AssignmentId: a, TaskId: 'wrong-logical-writer', OperationId: `e-${action}` }).status, 0); }));
test('F malformed state and registry fail closed without changing fixture index', () => withRepo(repo => { const index = indexSha(repo); fs.writeFileSync(statePath(repo), '{"magic":"bad"}'); assert.notEqual(invoke(repo, 'ControllerAssign', { AssignmentId: `${id}-f`, OperationId: 'f-state' }).status, 0); fs.rmSync(statePath(repo)); fs.writeFileSync(registryPath(repo), '{"magic":"bad"}'); const payload = Buffer.from(JSON.stringify(['README.md'])).toString('base64'); assert.notEqual(invoke(repo, 'Create', { IsolationPurpose: 'REVIEWER', UntrackedPathPayload: payload }).status, 0); assert.equal(indexSha(repo), index); }));
test('G Verify response loss requires exact semantic replay and rejects collision', () => withRepo(repo => { const a = `${id}-g`; ok(invoke(repo, 'ControllerAssign', { AssignmentId: a, OperationId: 'g-a' })); assert.notEqual(invoke(repo, 'ControllerVerify', { AssignmentId: a, OperationId: 'g-v', env: { SGDS_WRITER_AUTHORITY_V3_TEST_MODE: 'RESPONSE_LOSS_AFTER_COMMIT', SGDS_WRITER_AUTHORITY_V3_TEST_OPERATION: 'g-v' } }).status, 0); assert.equal(field(ok(invoke(repo, 'ControllerVerify', { AssignmentId: a, OperationId: 'g-v' })).output, 'STATUS'), 'RECONCILED'); assert.notEqual(invoke(repo, 'ControllerVerify', { AssignmentId: `${a}-other`, OperationId: 'g-v' }).status, 0); }));
test('H legacy and contradictory durable state block writer and isolation mutation', () => withRepo(repo => { const index = indexSha(repo); fs.writeFileSync(path.join(repo, '.git', 'non-writer-isolation.writer-lease.json'), '{legacy}'); assert.notEqual(invoke(repo, 'ControllerAssign', { AssignmentId: `${id}-h`, OperationId: 'h-a' }).status, 0); assert.notEqual(invoke(repo, 'Create', { IsolationPurpose: 'REVIEWER', UntrackedPathPayload: Buffer.from(JSON.stringify(['README.md'])).toString('base64') }).status, 0); fs.rmSync(path.join(repo, '.git', 'non-writer-isolation.writer-lease.json')); fs.writeFileSync(statePath(repo), JSON.stringify({ magic: 'syncgmaildrivesheet.writer-authority/v3', schema_version: 3, source_root: repo, git_common_directory: path.join(repo, '.git'), workspace_identity: 'wrong', revision: 0, slot: {}, operations: [] })); assert.notEqual(invoke(repo, 'ControllerAssign', { AssignmentId: `${id}-h2`, OperationId: 'h-b' }).status, 0); assert.equal(indexSha(repo), index); }));
test('I Complete response-loss replay is semantic and collision-safe', () => withRepo(repo => { const a = `${id}-i`; ok(invoke(repo, 'ControllerAssign', { AssignmentId: a, OperationId: 'i-a' })); ok(invoke(repo, 'ControllerVerify', { AssignmentId: a, OperationId: 'i-v' })); assert.notEqual(invoke(repo, 'WriterComplete', { AssignmentId: a, OperationId: 'i-complete', env: { SGDS_WRITER_AUTHORITY_V3_TEST_MODE: 'RESPONSE_LOSS_AFTER_COMMIT', SGDS_WRITER_AUTHORITY_V3_TEST_OPERATION: 'i-complete' } }).status, 0); assert.equal(field(ok(invoke(repo, 'WriterComplete', { AssignmentId: a, OperationId: 'i-complete' })).output, 'STATUS'), 'RECONCILED'); assert.notEqual(invoke(repo, 'WriterComplete', { AssignmentId: a, TaskId: 'other-writer', OperationId: 'i-complete' }).status, 0); }));
test('J Release response-loss replay binds writer and release semantics', () => withRepo(repo => { const r = lifecycle(repo, 'powershell.exe', 'j'); assert.notEqual(invoke(repo, 'ControllerRelease', { AssignmentId: r.assignment, OperationId: 'j-release', env: { SGDS_WRITER_AUTHORITY_V3_TEST_MODE: 'RESPONSE_LOSS_AFTER_COMMIT', SGDS_WRITER_AUTHORITY_V3_TEST_OPERATION: 'j-release' } }).status, 0); assert.equal(field(ok(invoke(repo, 'ControllerRelease', { AssignmentId: r.assignment, OperationId: 'j-release' })).output, 'STATUS'), 'RECONCILED'); assert.notEqual(invoke(repo, 'ControllerRelease', { AssignmentId: r.assignment, TaskId: 'other-writer', OperationId: 'j-release' }).status, 0); }));
test('K shared app-server liveness has no authority effect', () => withRepo(repo => { const a = `${id}-k`; ok(invoke(repo, 'ControllerAssign', { AssignmentId: a, OperationId: 'k-a', WriterRuntimePid: 2292 })); assert.equal(field(ok(invoke(repo, 'InspectWriter')).output, 'PROCESS_AUTHORITY'), 'NONE'); }));
test('L PID restart reuse has no authority effect', () => withRepo(repo => { const a = `${id}-l`; ok(invoke(repo, 'ControllerAssign', { AssignmentId: a, OperationId: 'l-a', WriterRuntimePid: 1 })); ok(invoke(repo, 'ControllerVerify', { AssignmentId: a, OperationId: 'l-v', WriterRuntimePid: 99999 })); }));
test('M late completion uses committed receipt and rejects an operation-id collision', () => withRepo(repo => { const a = `${id}-m`; ok(invoke(repo, 'ControllerAssign', { AssignmentId: a, OperationId: 'm-a' })); ok(invoke(repo, 'ControllerVerify', { AssignmentId: a, OperationId: 'm-v' })); assert.notEqual(invoke(repo, 'WriterComplete', { AssignmentId: a, OperationId: 'm-complete', env: { SGDS_WRITER_AUTHORITY_V3_TEST_MODE: 'RESPONSE_LOSS_AFTER_COMMIT', SGDS_WRITER_AUTHORITY_V3_TEST_OPERATION: 'm-complete' } }).status, 0); assert.equal(field(ok(invoke(repo, 'WriterComplete', { AssignmentId: a, OperationId: 'm-complete' })).output, 'STATUS'), 'RECONCILED'); assert.notEqual(invoke(repo, 'ControllerRelease', { AssignmentId: a, OperationId: 'm-complete' }).status, 0); }));
test('N complete tracked materialization preserves raw bytes, status, and index across PS5.1 and PS7', () => withRepo(repo => {
  execFileSync('git', ['config', 'core.autocrlf', 'true'], { cwd: repo });
  const cleanTracked = path.join(repo, 'tracked-clean-lf.txt');
  const upperTrackedName = 'D7_B_BoundedReadOnlyCandidateDiscovery.js';
  const underscoreTrackedName = '_debugMain.js';
  fs.writeFileSync(cleanTracked, Buffer.from('clean LF tracked file\nsecond line\n'));
  fs.writeFileSync(path.join(repo, upperTrackedName), Buffer.from('upper-case ordinal fixture\n'));
  fs.writeFileSync(path.join(repo, underscoreTrackedName), Buffer.from('underscore ordinal fixture\n'));
  execFileSync('git', ['add', 'tracked-clean-lf.txt', upperTrackedName, underscoreTrackedName], { cwd: repo });
  execFileSync('git', ['commit', '-qm', 'clean LF tracked fixture'], { cwd: repo });
  const deletedTracked = path.join(repo, 'tracked-delete.txt');
  fs.writeFileSync(deletedTracked, Buffer.from('delete from source candidate\n'));
  execFileSync('git', ['add', 'tracked-delete.txt'], { cwd: repo });
  execFileSync('git', ['commit', '-qm', 'tracked deletion fixture'], { cwd: repo });
  fs.rmSync(deletedTracked);
  const hook = path.join(repo, '.git', 'hooks', 'post-checkout');
  fs.writeFileSync(hook, "#!/bin/sh\ni=0\nwhile [ \"$i\" -lt 2048 ]; do\n  printf '%s\\r\\n' 'warning: bounded high-volume stderr EOL drain proof' >&2\n  i=$((i + 1))\ndone\nexit 0\n");
  fs.chmodSync(hook, 0o755);
  const cleanTrackedBytes = fs.readFileSync(cleanTracked); const index = indexSha(repo); const a = `${id}-n`; const readme = path.join(repo, 'README.md'); const overlay = path.join(repo, 'overlay.txt'); const nulDelimitedOverlayName = 'overlay;NUL-path.txt'; const nulDelimitedOverlay = path.join(repo, nulDelimitedOverlayName);
  assert.equal(execFileSync('git', ['config', '--get', 'core.autocrlf'], { cwd: repo, encoding: 'utf8' }).trim(), 'true');
  assert.equal(cleanTrackedBytes.includes(Buffer.from('\r\n')), false);
  fs.writeFileSync(readme, Buffer.from('baseline\nportable\n')); fs.writeFileSync(overlay, Buffer.from('overlay\n')); fs.writeFileSync(nulDelimitedOverlay, Buffer.from('NUL-delimited path fixture\n'));
  const payload = Buffer.from(JSON.stringify(['overlay.txt', nulDelimitedOverlayName])).toString('base64');
  const status = execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], { cwd: repo, encoding: 'utf8' });
  const sourceStatusV1Z = gitStatusV1Z(repo);
  ok(invoke(repo, 'ControllerAssign', { AssignmentId: a, OperationId: 'n-a' }));
  assert.notEqual(invoke(repo, 'Create', { IsolationPurpose: 'REVIEWER', UntrackedPathPayload: payload }).status, 0);
  ok(invoke(repo, 'ControllerVerify', { AssignmentId: a, OperationId: 'n-v' })); ok(invoke(repo, 'WriterComplete', { AssignmentId: a, OperationId: 'n-c' })); ok(invoke(repo, 'ControllerRelease', { AssignmentId: a, OperationId: 'n-r' }));

  for (const executable of ['powershell.exe', 'pwsh']) {
    const created = ok(invoke(repo, 'Create', { IsolationPurpose: 'REVIEWER', UntrackedPathPayload: payload }, executable));
    assert.equal(created.timedOut, false, `${executable} Create must drain high-volume stderr without timing out`);
    const isolation = field(created.output, 'ISOLATION_ROOT'); const worktree = field(created.output, 'WORKTREE_PATH');
    assert.notEqual(isolation, ''); assert.notEqual(worktree, '');
    const validated = invoke(repo, 'ValidateIsolation', { IsolationRoot: isolation }, executable);
    assert.equal(validated.timedOut, false, `${executable} ValidateIsolation must terminate`); ok(validated);
    const manifest = JSON.parse(fs.readFileSync(path.join(isolation, 'non-writer-isolation.manifest.json'), 'utf8'));
    assert.equal(manifest.schema_version, 4);
    assert.equal(manifest.magic, 'syncgmaildrivesheet.non-writer-isolation/v4');
    assert.match(manifest.reachable_head_object_graph_identity, /^sha256:[0-9a-f]{64}$/);
    assert.equal(manifest.reachable_head_object_graph_identity, reachableHeadObjectGraphIdentity(worktree, manifest.head));
    assert.equal(Object.hasOwn(manifest, 'object_database_identity'), false);
    const unreachableObject = execFileSync('git', ['hash-object', '-w', '--stdin'], { cwd: repo, encoding: 'utf8', input: `unreachable content-addressed snapshot object ${executable}\n` }).trim();
    assert.match(unreachableObject, /^[0-9a-f]{40}$/);
    assert.equal(execFileSync('git', ['rev-list', '--objects', '--no-object-names', 'HEAD'], { cwd: repo, encoding: 'utf8' }).split(/\r?\n/).includes(unreachableObject), false);
    ok(invoke(repo, 'ValidateIsolation', { IsolationRoot: isolation }, executable));
    const reachableBlob = execFileSync('git', ['rev-parse', 'HEAD:README.md'], { cwd: repo, encoding: 'utf8' }).trim();
    const commonDirectory = path.resolve(repo, execFileSync('git', ['rev-parse', '--git-common-dir'], { cwd: repo, encoding: 'utf8' }).trim());
    const reachableLooseObject = path.join(commonDirectory, 'objects', reachableBlob.slice(0, 2), reachableBlob.slice(2));
    if (fs.existsSync(reachableLooseObject)) {
      const reachableLooseBytes = fs.readFileSync(reachableLooseObject);
      fs.rmSync(reachableLooseObject);
      const missingReachable = invoke(repo, 'ValidateIsolation', { IsolationRoot: isolation }, executable);
      assert.notEqual(missingReachable.status, 0);
      assert.match(missingReachable.output, /GIT_REACHABLE_HEAD_OBJECT_(?:ENUMERATION|BATCH_CHECK)_FAILED/);
      fs.writeFileSync(reachableLooseObject, reachableLooseBytes);
      ok(invoke(repo, 'ValidateIsolation', { IsolationRoot: isolation }, executable));
    }
    execFileSync('git', ['repack', '-ad'], { cwd: repo });
    ok(invoke(repo, 'ValidateIsolation', { IsolationRoot: isolation }, executable));
    assert.ok(manifest.tracked_materialization_paths.includes('tracked-clean-lf.txt'));
    assert.ok(manifest.tracked_materialization_paths.includes('tracked-delete.txt'));
    assert.ok(manifest.tracked_materialization_paths.indexOf(upperTrackedName) < manifest.tracked_materialization_paths.indexOf(underscoreTrackedName), `${executable} must use ordinal UTF-16 ordering`);
    assert.deepEqual(manifest.tracked_materialization_paths, [...manifest.tracked_materialization_paths].sort(), `${executable} manifest paths must match JavaScript default UTF-16 ordering`);
    assert.equal(manifest.tracked_materialization_paths.length, manifest.tracked_materialization_raw_identities.length);
    assert.deepEqual(manifest.tracked_materialization_raw_identities.map(identity => identity.path), manifest.tracked_materialization_paths);
    const isolatedStatusV1Z = gitStatusV1Z(worktree);
    assert.match(manifest.linked_status_before_stat_refresh_sha256, /^sha256:[0-9a-f]{64}$/);
    assert.match(manifest.linked_status_after_stat_refresh_sha256, /^sha256:[0-9a-f]{64}$/);
    assert.notEqual(manifest.linked_status_before_stat_refresh_sha256, manifest.source_status_after_linked_stat_refresh_sha256, `${executable} must observe the pre-refresh EOL false positive`);
    assert.equal(manifest.source_status_after_linked_stat_refresh_sha256, `sha256:${sha(sourceStatusV1Z)}`);
    assert.equal(manifest.linked_status_after_stat_refresh_sha256, `sha256:${sha(isolatedStatusV1Z)}`);
    assert.deepEqual(isolatedStatusV1Z, sourceStatusV1Z, `${executable} linked XY/path status must exactly equal the source candidate after refresh`);
    assert.ok(manifest.linked_stat_refresh_path_count > 0, `${executable} must refresh the clean tracked path set through NUL stdin`);
    assert.ok([0, 1].includes(manifest.linked_stat_refresh_exit_code));
    assert.equal(manifest.linked_semantic_index_before_stat_refresh, manifest.linked_semantic_index_after_stat_refresh);
    assert.equal(manifest.linked_semantic_index_after_stat_refresh, semanticIndexIdentity(worktree));
    assert.equal(manifest.linked_staged_entries_before_stat_refresh, manifest.linked_staged_entries_after_stat_refresh);
    assert.equal(manifest.linked_staged_entries_after_stat_refresh, stagedEntryIdentity(worktree));
    assert.deepEqual(fs.readFileSync(path.join(worktree, 'README.md')), fs.readFileSync(readme));
    assert.deepEqual(fs.readFileSync(path.join(worktree, 'tracked-clean-lf.txt')), cleanTrackedBytes);
    assert.deepEqual(fs.readFileSync(path.join(worktree, 'overlay.txt')), fs.readFileSync(overlay));
    assert.deepEqual(fs.readFileSync(path.join(worktree, nulDelimitedOverlayName)), fs.readFileSync(nulDelimitedOverlay));
    assert.equal(fs.existsSync(path.join(worktree, 'tracked-delete.txt')), false);
    fs.writeFileSync(path.join(worktree, 'tracked-clean-lf.txt'), Buffer.from('isolation-only drift\n'));
    const drift = invoke(repo, 'ValidateIsolation', { IsolationRoot: isolation }, executable);
    assert.notEqual(drift.status, 0);
    assert.match(drift.output, /ISOLATED_TRACKED_RAW_IDENTITY_DRIFT/);
    fs.writeFileSync(path.join(worktree, 'tracked-clean-lf.txt'), cleanTrackedBytes);
    ok(invoke(repo, 'ValidateIsolation', { IsolationRoot: isolation }, executable));
    const manifestPath = path.join(isolation, 'non-writer-isolation.manifest.json');
    const manifestBytes = fs.readFileSync(manifestPath);
    fs.writeFileSync(manifestPath, JSON.stringify({ ...manifest, reachable_head_object_graph_identity: `sha256:${'0'.repeat(64)}` }));
    const graphDrift = invoke(repo, 'ValidateIsolation', { IsolationRoot: isolation }, executable);
    assert.notEqual(graphDrift.status, 0);
    assert.match(graphDrift.output, /GIT_REACHABLE_HEAD_OBJECT_GRAPH_DRIFT/);
    fs.writeFileSync(manifestPath, manifestBytes);
    ok(invoke(repo, 'ValidateIsolation', { IsolationRoot: isolation }, executable));
    assert.notEqual(invoke(repo, 'ControllerAssign', { AssignmentId: `${id}-n-${executable}`, OperationId: `n-a-${executable}` }, executable).status, 0);
    const cleaned = invoke(repo, 'Cleanup', { IsolationRoot: isolation }, executable);
    assert.equal(cleaned.timedOut, false, `${executable} Cleanup must terminate`); ok(cleaned);
    assert.equal(fs.existsSync(registryPath(repo)), false);
    assert.equal(execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], { cwd: repo, encoding: 'utf8' }), status);
    assert.equal(indexSha(repo), index);
  }

  const rejectedPayloads = [
    Buffer.from('["overlay.txt",]').toString('base64'),
    Buffer.from(JSON.stringify([1])).toString('base64'),
    'not*base64',
    Buffer.from([0xc3, 0x28]).toString('base64')
  ];
  for (const executable of ['powershell.exe', 'pwsh']) for (const payload of rejectedPayloads) {
    assert.notEqual(invoke(repo, 'Create', { IsolationPurpose: 'REVIEWER', UntrackedPathPayload: payload }, executable).status, 0);
    assert.equal(fs.existsSync(registryPath(repo)), false);
  }
  assert.equal(fs.existsSync(registryPath(repo)), false);
  assert.equal(execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], { cwd: repo, encoding: 'utf8' }), status);
  assert.equal(indexSha(repo), index);
}));
test('O complete lifecycle is equivalent in Windows PowerShell 5.1', () => withRepo(repo => { const r = lifecycle(repo, 'powershell.exe', 'o'); r.release(); assert.equal(field(ok(invoke(repo, 'InspectWriter')).output, 'SLOT_STATE'), 'NONE'); }));
test('P complete lifecycle is equivalent in PowerShell 7', () => withRepo(repo => { const r = lifecycle(repo, 'pwsh', 'p'); r.release(); assert.equal(field(ok(invoke(repo, 'InspectWriter', {}, 'pwsh')).output, 'SLOT_STATE'), 'NONE'); }));
test('Q checker static contract and reachable-v3 authority proof align with this matrix', () => {
  const expectedPhase0CandidateScope = [
    'scripts/ai/Manage-NonWriterIsolation.ps1',
    'scripts/checkers/check-ai-governance-bootstrap.mjs',
    'tests/unit/ai-governance-bootstrap.test.mjs',
    'scripts/test/run-all-checks.mjs',
    'scripts/checkers/check-d7-e3v-exact-post-hoc-attribution-read-only-diagnostic.mjs',
    'tests/unit/d7-e3v-exact-post-hoc-attribution-read-only-diagnostic.test.mjs',
    'scripts/checkers/check-d7-e4a1-bounded-firestore-identity-cardinality-read-only-proof.mjs',
    'tests/unit/d7-e4a1-bounded-firestore-identity-cardinality-read-only-proof.test.mjs',
    'scripts/checkers/check-d7-e4a1a-canonical-identity-configuration-read-only-recovery.mjs',
    'tests/unit/d7-e4a1a-canonical-identity-configuration-read-only-recovery.test.mjs',
    'scripts/checkers/check-d7-e4a1b-owner-configure-canonical-properties.mjs',
    'tests/unit/d7-e4a1b-owner-configure-canonical-properties.test.mjs',
    'scripts/checkers/check-d7-e4a1c-owner-marker-single-read-only-cardinality-execution.mjs',
    'tests/unit/d7-e4a1c-owner-marker-single-read-only-cardinality-execution.test.mjs',
    'scripts/checkers/check-d7-e4a2-exact-firestore-reconciliation-plan-finalization.mjs',
    'tests/unit/d7-e4a2-exact-firestore-reconciliation-plan-finalization.test.mjs',
    'docs/exec-plans/active/SGDS_WRITER_AUTHORITY_V3_CONTROLLER_ENFORCED_SINGLE_WRITER_IMPLEMENTATION.md',
    'docs/exec-plans/active/SGDS_PHASE0_CURRENT_STATE_NORMALIZATION_AND_PRODUCTION_RECOVERY_HANDOFF.md',
    'docs/exec-plans/completed/SGDS_WRITER_AUTHORITY_V3_CONTROLLER_ENFORCED_SINGLE_WRITER_IMPLEMENTATION.md',
    'docs/00_INDEX.md', 'docs/04_MASTER_PLAN.md', 'docs/12_AI_WORK_LOG.md', 'docs/13_DECISION_LOG.md', 'docs/99_NEXT_AI_HANDOFF.md', 'docs/FILE_MANIFEST.md'
  ];
  assert.equal(Object.isFrozen(phase0CandidateScope), true);
  assert.deepEqual(phase0CandidateScope, expectedPhase0CandidateScope);
  const aggregateRunner = fs.readFileSync(path.join(root, 'scripts', 'test', 'run-all-checks.mjs'), 'utf8');
  assert.equal(assertAggregateGateOrdering(aggregateRunner), true);
  const replaceExactlyOnce = (source, from, to) => {
    assert.equal(source.split(from).length - 1, 1, `aggregate mutation anchor must be unique: ${from}`);
    return source.replace(from, to);
  };
  assert.throws(() => assertAggregateGateOrdering(replaceExactlyOnce(aggregateRunner, 'runReceiptBoundGovernanceGate();\n', '')), /AGGREGATE_RECEIPT_BOUND_GATE_UNIQUE_REQUIRED/);
  assert.throws(() => assertAggregateGateOrdering(replaceExactlyOnce(aggregateRunner, 'runReceiptBoundGovernanceGate();\n', 'runReceiptBoundGovernanceGate();\nrunReceiptBoundGovernanceGate();\n')), /AGGREGATE_RECEIPT_BOUND_GATE_UNIQUE_REQUIRED/);
  const movedReceiptGate = replaceExactlyOnce(
    replaceExactlyOnce(aggregateRunner, 'runScopeGate();\nrunReceiptBoundGovernanceGate();\nconst {', 'runScopeGate();\nconst {'),
    'const commands = [',
    'runReceiptBoundGovernanceGate();\n\nconst commands = ['
  );
  assert.throws(() => assertAggregateGateOrdering(movedReceiptGate), /AGGREGATE_GOVERNANCE_GATE_ORDER_REQUIRED/);
  assert.throws(() => assertAggregateGateOrdering(replaceExactlyOnce(aggregateRunner, 'const commands = [', "const commands = [\n  ['node', ['scripts/checkers/check-ai-governance-bootstrap.mjs']],")), /AGGREGATE_GOVERNANCE_GATE_IN_LONG_COMMAND_LIST_FORBIDDEN/);
  const sourceEnvironment = {
    SystemRoot: 'C:\\Windows\\',
    PSModulePath: [
      'C:\\Alpha\\Modules\\',
      'c:\\alpha\\modules',
      '',
      'relative\\modules',
      'C:\\Beta\\Modules\\\\',
      'c:\\WINDOWS\\System32\\WindowsPowerShell\\v1.0\\Modules\\',
      'C:\\Gamma\\Modules'
    ].join(';'),
    KEEP_ME: 'unchanged'
  };
  const before = { ...sourceEnvironment };
  const environment = createWindowsPowerShellEnvironment(sourceEnvironment);
  assert.equal(environment.PSModulePath, [
    'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules',
    'C:\\Alpha\\Modules',
    'C:\\Beta\\Modules',
    'C:\\Gamma\\Modules'
  ].join(';'));
  assert.equal(environment.KEEP_ME, 'unchanged');
  assert.deepEqual(sourceEnvironment, before);
  assert.throws(
    () => createWindowsPowerShellEnvironment({ SystemRoot: 'relative-root', PSModulePath: '' }),
    /ABSOLUTE_SYSTEMROOT_REQUIRED_FOR_POWERSHELL_MODULES/
  );

  const processModulePath = process.env.PSModulePath;
  createWindowsPowerShellEnvironment(process.env);
  assert.equal(process.env.PSModulePath, processModulePath);
  const receiptContext = { sourceRoot: 'C:\\Primary', commonDirectory: 'C:\\Primary\\.git' };
  const receiptBinding = { authorityId: 'OWNER_GO_CURRENT_PHASE_TEST', assignmentId: 'CURRENT_ASSIGNMENT_TEST', writerId: '01a080f5-91bb-7e60-ad4e-fa42d61846b8' };
  const authoritativeContract = [
    '# Active contract',
    'AUTHORITY_ID=OWNER_GO_CURRENT_PHASE_TEST',
    'CURRENT_AUTHORITY_ASSIGNMENT_ID=CURRENT_ASSIGNMENT_TEST',
    'CURRENT_AUTHORITY_CODER_THREAD_ID=01a080f5-91bb-7e60-ad4e-fa42d61846b8',
    '',
    '## Historical V14 record',
    'AUTHORITY_ID=OWNER_GO_LOCAL_ONLY_ISOLATION_LINKED_INDEX_STAT_REFRESH_V14',
    'CURRENT_AUTHORITY_ASSIGNMENT_ID=HISTORICAL_ASSIGNMENT_MUST_NOT_BIND',
    'CURRENT_AUTHORITY_CODER_THREAD_ID=01a0801a-11d0-7680-9146-82877749e9c7',
    '',
    '## Historical V15 record',
    'AUTHORITY_ID=OWNER_GO_V15_AGENT_MANIFEST_V3_ALIGNMENT_EXACT_8_PATHS',
    'CURRENT_AUTHORITY_ASSIGNMENT_ID=SECOND_HISTORICAL_ASSIGNMENT_MUST_NOT_BIND',
    'CURRENT_AUTHORITY_CODER_THREAD_ID=01a08051-7e44-7d02-8b4d-16c99ce6bb18'
  ].join('\n');
  const authoritativeBinding = authoritativeContractPreamble(authoritativeContract);
  assert.deepEqual(Object.fromEntries(authoritativeBinding), {
    AUTHORITY_ID: receiptBinding.authorityId,
    CURRENT_AUTHORITY_ASSIGNMENT_ID: receiptBinding.assignmentId,
    CURRENT_AUTHORITY_CODER_THREAD_ID: receiptBinding.writerId
  });
  for (const malformed of [
    authoritativeContract.replace('AUTHORITY_ID=OWNER_GO_CURRENT_PHASE_TEST\n', ''),
    authoritativeContract.replace('AUTHORITY_ID=OWNER_GO_CURRENT_PHASE_TEST\n', 'AUTHORITY_ID=OWNER_GO_CURRENT_PHASE_TEST\nAUTHORITY_ID=duplicate\n'),
    authoritativeContract.replace('CURRENT_AUTHORITY_ASSIGNMENT_ID=CURRENT_ASSIGNMENT_TEST', 'CURRENT_AUTHORITY_ASSIGNMENT_ID='),
    authoritativeContract.replace('CURRENT_AUTHORITY_CODER_THREAD_ID=01a080f5-91bb-7e60-ad4e-fa42d61846b8\n', ''),
    authoritativeContract.replace('CURRENT_AUTHORITY_ASSIGNMENT_ID=CURRENT_ASSIGNMENT_TEST\n', 'CURRENT_AUTHORITY_ASSIGNMENT_ID=CURRENT_ASSIGNMENT_TEST\nCURRENT_AUTHORITY_ASSIGNMENT_ID=duplicate\n'),
    authoritativeContract.replace('# Active contract', 'not a contract title')
  ]) assert.throws(() => authoritativeContractPreamble(malformed), /RECEIPT_ACTIVE_PREAMBLE_(?:INVALID|BINDING_INVALID)/);
  const receiptCandidate = {
    head: 'a'.repeat(40), status_sha256: `sha256:${'b'.repeat(64)}`, index_sha256: `sha256:${'c'.repeat(64)}`, content_sha256: `sha256:${'d'.repeat(64)}`,
    manifest_content_aware_primary_worktree_state_sha256: `sha256:${'f'.repeat(64)}`,
    manifest_semantic_primary_index_identity: `sha256:${'0'.repeat(64)}`,
    manifest_canonical_tracked_diff_sha256: `sha256:${'1'.repeat(64)}`,
    manifest_reachable_head_object_graph_identity: `sha256:${'2'.repeat(64)}`
  };
  const isolatedCandidate = { head: 'a'.repeat(40), status_sha256: `sha256:${'4'.repeat(64)}`, index_sha256: `sha256:${'5'.repeat(64)}`, content_sha256: `sha256:${'6'.repeat(64)}` };
  const receiptIsolation = {
    manifest_path: 'C:\\Receipt\\non-writer-isolation.manifest.json', manifest_sha256: `sha256:${'e'.repeat(64)}`,
    isolation_root: 'C:\\Receipt', worktree_path: 'C:\\Receipt\\w', purpose: 'VERIFIER',
    manifest_source_root: receiptContext.sourceRoot, manifest_git_common_directory: receiptContext.commonDirectory, manifest_head: receiptCandidate.head,
    manifest_content_aware_primary_worktree_state_sha256: `sha256:${'f'.repeat(64)}`,
    manifest_semantic_primary_index_identity: `sha256:${'0'.repeat(64)}`,
    manifest_canonical_tracked_diff_sha256: `sha256:${'1'.repeat(64)}`,
    manifest_reachable_head_object_graph_identity: `sha256:${'2'.repeat(64)}`
  };
  const receipt = {
    magic: 'syncgmaildrivesheet.controller-inspection-receipt/v2', schema_version: 2, issued_utc_ms: 1000,
    primary_root: receiptContext.sourceRoot, git_common_directory: receiptContext.commonDirectory,
    authority_id: receiptBinding.authorityId, assignment_id: receiptBinding.assignmentId, writer_id: receiptBinding.writerId,
    inspection: { action: 'INSPECTWRITER', status: 'INSPECTED', slot_state: 'NONE', revision: 12, state_sha256: `sha256:${'3'.repeat(64)}` },
    candidate: receiptCandidate, isolated_candidate: isolatedCandidate, isolation: receiptIsolation
  };
  const receiptExpected = { now: 1001, primaryRoot: receiptContext.sourceRoot, commonDirectory: receiptContext.commonDirectory, binding: receiptBinding, localCandidate: isolatedCandidate, isolation: receiptIsolation };
  assert.equal(validateControllerInspectionReceiptPayload(receipt, receiptExpected), true);
  const receiptCopy = mutate => { const value = JSON.parse(JSON.stringify(receipt)); mutate(value); return value; };
  assert.throws(() => validateControllerInspectionReceiptPayload(receiptCopy(value => delete value.candidate), receiptExpected), /RECEIPT_SCHEMA_INVALID/);
  assert.throws(() => validateControllerInspectionReceiptPayload(receiptCopy(value => { value.issued_utc_ms = 0; }), { ...receiptExpected, now: 300001 }), /RECEIPT_STALE/);
  assert.throws(() => validateControllerInspectionReceiptPayload(receiptCopy(value => { value.isolated_candidate.head = 'z'.repeat(40); }), receiptExpected), /RECEIPT_ISOLATED_CANDIDATE_MISMATCH/);
  assert.throws(() => validateControllerInspectionReceiptPayload(receiptCopy(value => { value.isolation.purpose = 'REVIEWER'; }), receiptExpected), /RECEIPT_ISOLATION_MANIFEST_MISMATCH/);
  assert.throws(() => validateControllerInspectionReceiptPayload(receiptCopy(value => { value.inspection.slot_state = 'ACTIVE'; }), receiptExpected), /RECEIPT_INSPECTION_MISMATCH/);
  withRepo(receiptRepo => {
    for (const name of ['D7_B_BoundedReadOnlyCandidateDiscovery.js', '_debugMain.js']) fs.writeFileSync(path.join(receiptRepo, name), `${name}\n`);
    execFileSync('git', ['add', 'D7_B_BoundedReadOnlyCandidateDiscovery.js', '_debugMain.js'], { cwd: receiptRepo });
    execFileSync('git', ['commit', '-qm', 'receipt manifest fixture'], { cwd: receiptRepo });
    const trackedMaterializationPaths = ['D7_B_BoundedReadOnlyCandidateDiscovery.js', 'README.md', '_debugMain.js'];
    const manifestPath = path.join(receiptRepo, 'receipt-manifest.json');
    const fixtureSha = `sha256:${'7'.repeat(64)}`;
    const rawIdentity = relativePath => {
      const localPath = path.join(receiptRepo, ...relativePath.split('/'));
      return fs.existsSync(localPath) ? `sha256:${sha(fs.readFileSync(localPath))}` : 'missing';
    };
    const writeManifest = (paths, identities = paths.map(relativePath => ({ path: relativePath, raw_sha256: rawIdentity(relativePath) }))) => fs.writeFileSync(manifestPath, JSON.stringify({
      magic: 'syncgmaildrivesheet.non-writer-isolation/v4', schema_version: 4,
      source_root: path.join(receiptRepo, 'declared-primary-that-does-not-exist'), git_common_directory: path.join(receiptRepo, '.git'), isolation_root: receiptRepo, worktree_path: receiptRepo, purpose: 'REVIEWER', head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: receiptRepo, encoding: 'utf8' }).trim(),
      tracked_materialization_paths: paths, tracked_materialization_raw_identities: identities,
      content_aware_primary_worktree_state_sha256: fixtureSha, semantic_primary_index_identity: fixtureSha, canonical_tracked_diff_sha256: fixtureSha, reachable_head_object_graph_identity: reachableHeadObjectGraphIdentity(receiptRepo, execFileSync('git', ['rev-parse', 'HEAD'], { cwd: receiptRepo, encoding: 'utf8' }).trim()),
      source_status_after_linked_stat_refresh_sha256: fixtureSha, linked_status_before_stat_refresh_sha256: fixtureSha, linked_status_after_stat_refresh_sha256: fixtureSha,
      linked_semantic_index_before_stat_refresh: fixtureSha, linked_semantic_index_after_stat_refresh: fixtureSha, linked_staged_entries_before_stat_refresh: fixtureSha, linked_staged_entries_after_stat_refresh: fixtureSha,
      linked_stat_refresh_path_count: paths.length, linked_stat_refresh_exit_code: 0
    }));
    writeManifest(trackedMaterializationPaths);
    assert.equal(readIsolationIdentity(manifestPath).purpose, 'REVIEWER', 'receipt manifest validation uses only the local isolated worktree tracked set');
    for (const noncanonical of ['../README.md', './README.md', 'nested/../README.md', 'nested/./file.txt', 'nested//file.txt', 'README.md/', 'nested\\file.txt', '.git', '.git/config', 'nested/.git/config', '/README.md', 'C:/README.md']) {
      writeManifest([noncanonical], [{ path: noncanonical, raw_sha256: fixtureSha }]);
      assert.throws(() => readIsolationIdentity(manifestPath), /RECEIPT_ISOLATION_MANIFEST_MALFORMED/, `noncanonical materialization path: ${noncanonical}`);
    }
    writeManifest([trackedMaterializationPaths[0], trackedMaterializationPaths[0], ...trackedMaterializationPaths.slice(1)]);
    assert.throws(() => readIsolationIdentity(manifestPath), /RECEIPT_ISOLATION_MANIFEST_MALFORMED/, 'duplicate materialization path');
    writeManifest([...trackedMaterializationPaths].reverse());
    assert.throws(() => readIsolationIdentity(manifestPath), /RECEIPT_ISOLATION_MANIFEST_MALFORMED/, 'ordinal materialization order drift');
    writeManifest(trackedMaterializationPaths.slice(0, -1));
    assert.throws(() => readIsolationIdentity(manifestPath), /RECEIPT_ISOLATION_TRACKED_SET_MISMATCH/, 'manifest must equal the local isolated git tracked set');
    writeManifest(trackedMaterializationPaths, [...trackedMaterializationPaths.slice(0, -1), 'misaligned.js'].map((relativePath, index) => ({ path: relativePath, raw_sha256: rawIdentity(trackedMaterializationPaths[index]) })));
    assert.throws(() => readIsolationIdentity(manifestPath), /RECEIPT_ISOLATION_MANIFEST_MALFORMED/, 'raw identity path alignment remains exact');
    writeManifest(trackedMaterializationPaths, trackedMaterializationPaths.map((relativePath, index) => ({ path: relativePath, raw_sha256: index === 0 ? fixtureSha : rawIdentity(relativePath) })));
    assert.throws(() => readIsolationIdentity(manifestPath), /RECEIPT_ISOLATION_RAW_IDENTITY_MISMATCH/, 'valid path with an incorrect raw hash must be rejected');
    writeManifest(trackedMaterializationPaths);
    const eolBaseline = fs.readFileSync(path.join(receiptRepo, 'README.md'));
    const eolDrift = eolBaseline.includes(Buffer.from('\r\n')) ? Buffer.from(eolBaseline.toString('utf8').replaceAll('\r\n', '\n')) : Buffer.from(eolBaseline.toString('utf8').replaceAll('\n', '\r\n'));
    fs.writeFileSync(path.join(receiptRepo, 'README.md'), eolDrift);
    assert.notDeepEqual(eolDrift, eolBaseline, 'EOL-only drift must change raw bytes');
    assert.throws(() => readIsolationIdentity(manifestPath), /RECEIPT_ISOLATION_RAW_IDENTITY_MISMATCH/, 'Git-clean EOL byte drift must be rejected');
    fs.writeFileSync(path.join(receiptRepo, 'README.md'), eolBaseline);
    const reparseTarget = path.join(receiptRepo, 'reparse-target');
    const reparsePath = path.join(receiptRepo, 'reparse-junction');
    try {
      fs.mkdirSync(reparseTarget);
      fs.symlinkSync(reparseTarget, reparsePath, 'junction');
      if (!fs.lstatSync(reparsePath).isSymbolicLink()) {
        for (const executable of ['powershell.exe', 'pwsh']) {
          if (spawnSync(executable, ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.Major'], { encoding: 'utf8' }).status === 0) {
            assert.throws(() => assertWindowsNoReparsePoints([reparsePath], { powerShellExecutable: executable }), /RECEIPT_ISOLATION_LOCAL_PATH_INVALID/, `${executable} rejects a non-symlink Windows reparse point`);
          }
        }
      }
    } finally {
      fs.rmSync(reparsePath, { recursive: true, force: true });
      fs.rmSync(reparseTarget, { recursive: true, force: true });
    }
  });
  const governanceChecker = fs.readFileSync(path.join(root, 'scripts', 'checkers', 'check-ai-governance-bootstrap.mjs'), 'utf8');
  assert.match(governanceChecker, /\[System\.IO\.FileAttributes\]::ReparsePoint/, 'FILE_ATTRIBUTE_REPARSE_POINT detection is reachable from receipt validation');
  const governanceCheck = governanceChecker.slice(governanceChecker.indexOf('export function checkGovernance'), governanceChecker.indexOf('function cliValue'));
  assert.doesNotMatch(governanceCheck, /InspectWriter/, 'full governance check must validate a controller receipt instead of invoking InspectWriter');
  assert.match(governanceChecker, /createControllerInspectionReceipt/, 'controller-only receipt creation mode required');
  const receiptEnvironment = { SGDS_CONTROLLER_INSPECTION_RECEIPT: 'C:\\Receipt\\controller.json' };
  assert.equal(resolveControllerReceiptPath(['node', 'checker'], receiptEnvironment), receiptEnvironment.SGDS_CONTROLLER_INSPECTION_RECEIPT, 'aggregate environment receipt discovery');
  assert.equal(resolveControllerReceiptPath(['node', 'checker', '--controller-receipt', 'C:\\Receipt\\cli.json'], {}), 'C:\\Receipt\\cli.json', 'single CLI receipt discovery');
  assert.throws(() => resolveControllerReceiptPath(['node', 'checker'], {}), /RECEIPT_REQUIRED/);
  assert.throws(() => resolveControllerReceiptPath(['node', 'checker'], { SGDS_CONTROLLER_INSPECTION_RECEIPT: '  ' }), /RECEIPT_ENVIRONMENT_EMPTY/);
  assert.throws(() => resolveControllerReceiptPath(['node', 'checker', '--controller-receipt', 'a', '--controller-receipt', 'b'], {}), /RECEIPT_CLI_ARGUMENT_INVALID/);
  assert.throws(() => resolveControllerReceiptPath(['node', 'checker', '--controller-receipt', 'a'], receiptEnvironment), /RECEIPT_SOURCE_AMBIGUOUS/);
  const scriptId = 'expected-case-sensitive-script-id';
  for (const [name, claspJson, status, output, exactMatch] of [
    ['decoy occurrence', JSON.stringify({ scriptId: 'wrong-script-id', note: scriptId }), 0, 'wrong-script-id', false],
    ['malformed JSON', '{"scriptId":', 1, '', false],
    ['missing scriptId', JSON.stringify({ note: scriptId }), 1, '', false],
    ['non-string null', JSON.stringify({ scriptId: null }), 1, '', false],
    ['non-string number', JSON.stringify({ scriptId: 7 }), 1, '', false],
    ['non-string object', JSON.stringify({ scriptId: {} }), 1, '', false],
    ['empty scriptId', JSON.stringify({ scriptId: '' }), 1, '', false],
    ['whitespace-only scriptId', JSON.stringify({ scriptId: ' \t' }), 1, '', false],
    ['wrong property case', JSON.stringify({ ScriptId: scriptId }), 1, '', false],
    ['wrong value case', JSON.stringify({ scriptId: scriptId.toUpperCase() }), 0, scriptId.toUpperCase(), false],
    ['generic mismatch', JSON.stringify({ scriptId: 'different-script-id' }), 0, 'different-script-id', false],
    ['exact case-sensitive match', JSON.stringify({ scriptId }), 0, scriptId, true]
  ]) {
    const run = runEmbeddedClaspParser(claspJson);
    assert.equal(run.status === 0 ? 0 : 1, status, name);
    assert.equal(run.output, output, name);
    assert.equal(run.status === 0 ? run.rootDir : '', run.status === 0 ? '.' : '', name);
    assert.equal(run.status === 0 && run.output === scriptId, exactMatch, name);
  }
  for (const [fixture, gate] of [
    ['direct cwd mismatch', 'BLOCKED_DEPLOY_CWD_PROJECT_ROOT_MISMATCH'],
    ['git top-level mismatch', 'BLOCKED_DEPLOY_CWD_GIT_TOPLEVEL_MISMATCH'],
    ['branch mismatch', 'BLOCKED_DEPLOY_WRONG_BRANCH'],
    ['origin mismatch', 'BLOCKED_DEPLOY_REMOTE_ORIGIN_MISMATCH'],
    ['git name mismatch', 'BLOCKED_DEPLOY_GIT_USER_NAME_MISMATCH'],
    ['git email mismatch', 'BLOCKED_DEPLOY_GIT_USER_EMAIL_MISMATCH'],
    ['tracked worktree dirty', 'BLOCKED_DEPLOY_TRACKED_WORKTREE_DIRTY'],
    ['staging nonempty', 'BLOCKED_DEPLOY_STAGED_CHANGES_PRESENT'],
    ['ahead mismatch', 'BLOCKED_DEPLOY_LOCAL_AHEAD_OF_ORIGIN'],
    ['behind mismatch', 'BLOCKED_DEPLOY_REMOTE_AHEAD_OF_LOCAL']
  ]) assertDirectDeployFixtureFailsBeforeTools(fixture, gate);
  const porcelain = parsePorcelainV1Z(Buffer.from(' M docs/12_AI_WORK_LOG.md\0?? _guard/deploy/output.txt\0R  docs/13_DECISION_LOG.md\0docs/old-name.md\0', 'utf8'));
  assert.equal(porcelain.length, 3);
  assert.deepEqual(porcelain[2].paths, ['docs/13_DECISION_LOG.md', 'docs/old-name.md']);
  assert.throws(() => assertV6ScopeEntries([{ x: '?', y: '?', paths: ['_guard/deploy/output.txt'] }]), /FORBIDDEN_DEPLOY_OUTPUT_RESIDUE/);
  assert.throws(() => assertV6ScopeEntries([{ x: '?', y: '?', paths: ['outside-v6-scope.txt'] }]), /UNAUTHORIZED_PATH_CHANGE/);
  for (const file of phase0CandidateScope) {
    assert.equal(assertV6ScopeEntries([{ x: ' ', y: 'M', paths: [file] }]), true);
    assert.throws(() => assertV6ScopeEntries([{ x: '?', y: '?', paths: [`${file}.copy`] }]), /UNAUTHORIZED_PATH_CHANGE/);
    assert.throws(() => assertV6ScopeEntries([{ x: 'M', y: ' ', paths: [file] }]), /STAGED_CHANGE/);
  }
  assert.throws(() => assertV6ScopeEntries([{ x: 'M', y: ' ', paths: ['GUARD.bat'] }]), /STAGED_CHANGE/);
  const engine = fs.readFileSync(path.join(root, '_guard', 'PROJECT_GUARD_ENGINE.bat'), 'utf8');
  const adapter = fs.readFileSync(path.join(root, '_guard', 'deploy', 'DEPLOY_GOOGLE_APPS_FIREBASE.bat'), 'utf8');
  for (const token of ['BLOCKED_GUARD_CONFIG_NONCANONICAL', 'BLOCKED_OVERRIDE_ENVIRONMENT', 'VerifyPullAheadBehind', 'RecheckPushBinding', 'CONFIRMED_LOCAL_HEAD', 'PENDING_LATE_COMPLETION_QUARANTINE']) assert.match(engine, new RegExp(token), `V6 engine token ${token}`);
  for (const token of ['BLOCKED_CLASP_ROOT_DIR_MISMATCH', 'VerifyGasUploadInventory', 'deploy/gas-runtime-files.txt', 'VerifyFirestoreIdentity', 'GAS_PUSH_OUTCOME=ATTEMPTED', 'GAS_DEPLOY_OUTCOME=ATTEMPTED', 'FIREBASE_DEPLOY_OUTCOME=ATTEMPTED']) assert.match(adapter, new RegExp(token.replaceAll('.', '\\.')), `V6 adapter token ${token}`);
  assert.ok(adapter.indexOf('GAS_PUSH_OUTCOME=ATTEMPTED') < adapter.indexOf('clasp.cmd --user "%CLASP_PROFILE%" push'));
  assert.ok(adapter.indexOf('GAS_DEPLOY_OUTCOME=ATTEMPTED') < adapter.indexOf('clasp.cmd --user "%CLASP_PROFILE%" deploy'));
  assert.ok(adapter.indexOf('FIREBASE_DEPLOY_OUTCOME=ATTEMPTED') < adapter.indexOf('firebase.cmd deploy'));
  assert.ok(engine.indexOf('call :VerifyPullAheadBehind') < engine.indexOf('git pull --ff-only'));
  assert.ok(engine.indexOf('call :RecheckPushBinding') < engine.indexOf('git push origin "%CONFIRMED_LOCAL_HEAD%:refs/heads/%EXPECTED_BRANCH%"'));
  const model = deriveV10GuardBehaviorEvidence(root);
  const execution = model.executeAllTarget({});
  assert.equal(execution.state.errorlevel, 0); assert.deepEqual(execution.state.callStack, []); assert.equal(typeof execution.state.pc, 'string'); assert.ok(execution.state.trace.length > 0); assert.ok(execution.state.steps > 0 && execution.state.steps <= 512); assert.equal(typeof execution.state.variables, 'object');
  const canonical = model.startup({ engine: {}, adapter: {} });
  assert.equal(canonical.engine.status, 'PASS'); assert.equal(canonical.adapter.status, 'PASS');
  const engineStartup = model.startup({ engine: { git_index_file: 'attacker-index', GIT_CONFIG_PARAMETERS: 'attacker-config' }, adapter: {} });
  assert.equal(engineStartup.engine.status, 'FAILED'); assert.equal(engineStartup.engine.defaults.PROJECT_KEY, 'UNTRUSTED_STARTUP'); assert.equal(engineStartup.adapter.status, 'PASS');
  const adapterStartup = model.startup({ engine: {}, adapter: { git_index_file: 'attacker-index', git_config_parameters: 'attacker-config' } });
  assert.equal(adapterStartup.engine.status, 'PASS'); assert.equal(adapterStartup.adapter.status, 'FAILED'); assert.equal(adapterStartup.adapter.defaults.DEPLOY_TARGET, 'UNTRUSTED_STARTUP');
  const partial = { PUSH_RUN: 'true', DEPLOY_RUN: 'PARTIAL_GAS_CONFIRMED_FIREBASE_NOT_CONFIRMED', NEW_VERSION_CREATED: 'true', GAS_PUSH_OUTCOME: 'CONFIRMED_SUCCESS', GAS_DEPLOY_OUTCOME: 'CONFIRMED_SUCCESS', FIREBASE_DEPLOY_OUTCOME: 'NOT_ATTEMPTED' };
  const cases = [
    ['repository preflight failure', { labels: { AdapterPrivilegedPreflight: [0, 0, 0, 1] } }, partial],
    ['Firebase service preflight failure', { labels: { FirebasePreflight: [1] } }, partial],
    ['immediate repository recheck failure', { labels: { AdapterPrivilegedPreflight: [0, 0, 0, 0, 1] } }, partial],
    ['Firebase command unknown quarantine', { providers: { 'firebase-deploy': 1 } }, { ...partial, FIREBASE_DEPLOY_OUTCOME: 'PENDING_LATE_COMPLETION_QUARANTINE' }],
    ['confirmed Firebase success', {}, { ...partial, DEPLOY_RUN: 'true', FIREBASE_DEPLOY_OUTCOME: 'CONFIRMED_SUCCESS' }]
  ];
  for (const [name, injections, expected] of cases) assert.deepEqual(model.allTargetResult(injections), expected, name);
  const adapterSource = fs.readFileSync(path.join(root, '_guard', 'deploy', 'DEPLOY_GOOGLE_APPS_FIREBASE.bat'), 'utf8');
  const mutateOnce = (source, from, to) => { assert.equal(source.split(from).length - 1, 1, `mutation anchor must be unique: ${from}`); return source.replace(from, to); };
  const deployFirebase = batchLabelBody(adapterSource, ':DeployFirebase');
  const mutateDeployFirebase = (from, to) => mutateOnce(adapterSource, deployFirebase, mutateOnce(deployFirebase, from, to));
  assert.throws(() => deriveV10GuardBehaviorEvidence(root, { adapter: mutateDeployFirebase('call :AdapterPrivilegedPreflight\r\nif errorlevel 1 exit /b 1\r\ncall :FirebasePreflight', 'call :FirebasePreflight') }), /CFG_FIREBASE_RECHECK_FLOW_REQUIRED|CFG_/);
  assert.throws(() => deriveV10GuardBehaviorEvidence(root, { adapter: mutateDeployFirebase('call :FirebasePreflight\r\nif errorlevel 1 exit /b 1\r\ncall :AdapterPrivilegedPreflight', 'call :AdapterPrivilegedPreflight') }), /CFG_FIREBASE_RECHECK_FLOW_REQUIRED|CFG_/);
  assert.throws(() => deriveV10GuardBehaviorEvidence(root, { adapter: mutateDeployFirebase('call :AdapterPrivilegedPreflight\r\nif errorlevel 1 exit /b 1\r\nset "FIREBASE_DEPLOY_OUTCOME=ATTEMPTED"', 'set "FIREBASE_DEPLOY_OUTCOME=ATTEMPTED"\r\ncall :AdapterPrivilegedPreflight\r\nif errorlevel 1 exit /b 1') }), /CFG_FIREBASE_RECHECK_FLOW_REQUIRED|CFG_/);
  const weakGuard = deriveV10GuardBehaviorEvidence(root, { adapter: mutateDeployFirebase('if errorlevel 1 (\r\n  set "FIREBASE_DEPLOY_OUTCOME=PENDING_LATE_COMPLETION_QUARANTINE"', 'if errorlevel 2 (\r\n  set "FIREBASE_DEPLOY_OUTCOME=PENDING_LATE_COMPLETION_QUARANTINE"') });
  assert.notDeepEqual(weakGuard.allTargetResult({ providers: { 'firebase-deploy': 1 } }), cases[3][2], 'Firebase errorlevel guard sensitivity');
  const changedSuccess = deriveV10GuardBehaviorEvidence(root, { adapter: mutateDeployFirebase('set "DEPLOY_RUN=true"\r\nset "FIREBASE_DEPLOY_OUTCOME=CONFIRMED_SUCCESS"', 'set "DEPLOY_RUN=CHANGED"\r\nset "FIREBASE_DEPLOY_OUTCOME=CONFIRMED_SUCCESS"') });
  assert.notDeepEqual(changedSuccess.allTargetResult({}), cases[4][2], 'confirmed success assignment sensitivity');
  let decoySource = mutateOnce(adapterSource, 'exit /b 1\r\n\r\n:Cancel', 'exit /b 1\r\nset "DEPLOY_RUN=FAIL_DECOY"\r\n\r\n:Cancel');
  const cancel = batchLabelBody(decoySource, ':Cancel');
  decoySource = mutateOnce(decoySource, cancel, mutateOnce(cancel, 'exit /b 2\r\n', 'exit /b 2\r\nset "DEPLOY_RUN=CANCEL_DECOY"\r\n'));
  const decoy = deriveV10GuardBehaviorEvidence(root, { adapter: decoySource });
  assert.deepEqual(decoy.allTargetResult({}), cases[4][2], 'unreachable Fail/Cancel decoy assignment has no effect on success');
  assert.deepEqual(decoy.allTargetResult({ providers: { 'firebase-deploy': 1 } }), cases[3][2], 'post-return Fail decoy assignment has no effect on quarantine');
  const blockExpansion = interpretBatchCfgEvidence(':Main\r\nset "VALUE=BEFORE"\r\nif "x"=="x" (\r\n  set "VALUE=AFTER"\r\n  set "OBSERVED=%VALUE%"\r\n)\r\nexit /b 0\r\n', 'main');
  assert.equal(blockExpansion.variables.VALUE, 'AFTER'); assert.equal(blockExpansion.variables.OBSERVED, 'BEFORE', 'CMD block expansion freezes percent variables before executing the block');
  assert.throws(() => interpretBatchCfgEvidence(':Main\r\nexit /b 0\r\n:MAIN\r\nexit /b 0\r\n', 'Main'), /CFG_DUPLICATE_LABEL/);
  assert.throws(() => interpretBatchCfgEvidence(':Main\r\ncall :%DYNAMIC%\r\n', 'Main'), /CFG_UNSUPPORTED_REACHABLE_COMMAND/);
  assert.throws(() => interpretBatchCfgEvidence(':Main\r\ncall :Missing\r\n', 'Main'), /CFG_MISSING_STATIC_TARGET/);
  assert.throws(() => interpretBatchCfgEvidence(':Main\r\ngoto :Main\r\n', 'Main'), /CFG_CALL_STACK_BOUND_EXCEEDED|CFG_STEP_BOUND_EXCEEDED/);
  for (const branch of ['success', 'drift', 'early-failure']) assert.deepEqual(model.recheckPushd(branch), { entered: 1, exited: 1 }, branch);
  assert.equal(validateActiveContracts(root), true);
  assert.equal(checkStaticGovernance(root), true);
});
