import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { defineTestMetadata } from '../harness/test-metadata.mjs';
import { checkStaticGovernance } from '../../scripts/checkers/check-ai-governance-bootstrap.mjs';

const TEST_METADATA = defineTestMetadata({ testClass: 'REGRESSION_INVARIANT', sourceFiles: ['scripts/ai/Manage-NonWriterIsolation.ps1'], ownerPolicyRequired: true, runtimeMutation: 'NONE' });
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const helper = path.join(root, 'scripts', 'ai', 'Manage-NonWriterIsolation.ps1');
const authority = 'SGDS_WRITER_AUTHORITY_V3_TEST';
const id = crypto.randomBytes(16).toString('hex');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const field = (output, name) => output.match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1] ?? '';

export function validateActiveContracts(base) {
  const active = path.join(base, 'docs', 'exec-plans', 'active');
  const files = fs.existsSync(active) ? fs.readdirSync(active).filter(name => name.endsWith('.md')).sort() : [];
  return files.length === 1 && files[0] === 'SGDS_WRITER_AUTHORITY_V3_CONTROLLER_ENFORCED_SINGLE_WRITER_IMPLEMENTATION.md';
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
  const run = spawnSync(executable, args, { cwd: repo, encoding: 'utf8', env: { ...process.env, ...values.env } });
  return { status: run.status ?? 1, output: (run.stdout || '') + (run.stderr || '') };
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
test('N bidirectional writer/isolation interlocks preserve raw bytes, status, and index across PS5.1 and PS7', () => withRepo(repo => {
  execFileSync('git', ['config', 'core.autocrlf', 'true'], { cwd: repo });
  const deletedTracked = path.join(repo, 'tracked-delete.txt');
  fs.writeFileSync(deletedTracked, Buffer.from('delete from source candidate\n'));
  execFileSync('git', ['add', 'tracked-delete.txt'], { cwd: repo });
  execFileSync('git', ['commit', '-qm', 'tracked deletion fixture'], { cwd: repo });
  fs.rmSync(deletedTracked);
  const index = indexSha(repo); const a = `${id}-n`; const readme = path.join(repo, 'README.md'); const overlay = path.join(repo, 'overlay.txt');
  fs.writeFileSync(readme, Buffer.from('baseline\nportable\n')); fs.writeFileSync(overlay, Buffer.from('overlay\n'));
  const payload = Buffer.from(JSON.stringify(['overlay.txt'])).toString('base64');
  const status = execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], { cwd: repo, encoding: 'utf8' });
  ok(invoke(repo, 'ControllerAssign', { AssignmentId: a, OperationId: 'n-a' }));
  assert.notEqual(invoke(repo, 'Create', { IsolationPurpose: 'REVIEWER', UntrackedPathPayload: payload }).status, 0);
  ok(invoke(repo, 'ControllerVerify', { AssignmentId: a, OperationId: 'n-v' })); ok(invoke(repo, 'WriterComplete', { AssignmentId: a, OperationId: 'n-c' })); ok(invoke(repo, 'ControllerRelease', { AssignmentId: a, OperationId: 'n-r' }));

  for (const executable of ['powershell.exe', 'pwsh']) {
    const created = ok(invoke(repo, 'Create', { IsolationPurpose: 'REVIEWER', UntrackedPathPayload: payload }, executable));
    const isolation = field(created.output, 'ISOLATION_ROOT'); const worktree = field(created.output, 'WORKTREE_PATH');
    ok(invoke(repo, 'ValidateIsolation', { IsolationRoot: isolation }, executable));
    assert.deepEqual(fs.readFileSync(path.join(worktree, 'README.md')), fs.readFileSync(readme));
    assert.deepEqual(fs.readFileSync(path.join(worktree, 'overlay.txt')), fs.readFileSync(overlay));
    assert.equal(fs.existsSync(path.join(worktree, 'tracked-delete.txt')), false);
    assert.notEqual(invoke(repo, 'ControllerAssign', { AssignmentId: `${id}-n-${executable}`, OperationId: `n-a-${executable}` }, executable).status, 0);
    ok(invoke(repo, 'Cleanup', { IsolationRoot: isolation }, executable));
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
test('Q checker static contract and reachable-v3 authority proof align with this matrix', () => { assert.equal(validateActiveContracts(root), true); assert.equal(checkStaticGovernance(root), true); });
