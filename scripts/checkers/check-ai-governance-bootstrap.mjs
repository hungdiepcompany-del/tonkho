import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = process.cwd();
const activeName = 'SGDS_PHASE0_CURRENT_STATE_NORMALIZATION_AND_PRODUCTION_RECOVERY_HANDOFF.md';
const matrix = 'ABCDEFGHIJKLMNOPQ'.split('');
const read = file => fs.readFileSync(file, 'utf8');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
export const phase0CandidateScope = Object.freeze([
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
  'docs/00_INDEX.md',
  'docs/04_MASTER_PLAN.md',
  'docs/12_AI_WORK_LOG.md',
  'docs/13_DECISION_LOG.md',
  'docs/99_NEXT_AI_HANDOFF.md',
  'docs/FILE_MANIFEST.md'
]);
const candidateScope = phase0CandidateScope;
const allowed = new Set(phase0CandidateScope);
export function composePhase0CandidateScope(historicalScope) {
  assert.ok(Array.isArray(historicalScope), 'HISTORICAL_SCOPE_ARRAY_REQUIRED');
  assert.ok(historicalScope.every(value => typeof value === 'string' && value.length > 0), 'HISTORICAL_SCOPE_PATH_INVALID');
  return Object.freeze([...new Set([...historicalScope, ...phase0CandidateScope])]);
}
const controllerReceiptMagic = 'syncgmaildrivesheet.controller-inspection-receipt/v2';
const controllerReceiptSchemaVersion = 2;
const controllerReceiptMaximumAgeMs = 5 * 60 * 1000;
const controllerReceiptKeys = ['magic', 'schema_version', 'issued_utc_ms', 'primary_root', 'git_common_directory', 'authority_id', 'assignment_id', 'writer_id', 'inspection', 'candidate', 'isolated_candidate', 'isolation'];
const controllerInspectionKeys = ['action', 'status', 'slot_state', 'revision', 'state_sha256'];
const controllerCandidateKeys = ['head', 'status_sha256', 'index_sha256', 'content_sha256', 'manifest_content_aware_primary_worktree_state_sha256', 'manifest_semantic_primary_index_identity', 'manifest_canonical_tracked_diff_sha256', 'manifest_reachable_head_object_graph_identity'];
const controllerIsolationKeys = ['manifest_path', 'manifest_sha256', 'isolation_root', 'worktree_path', 'purpose', 'manifest_source_root', 'manifest_git_common_directory', 'manifest_head', 'manifest_content_aware_primary_worktree_state_sha256', 'manifest_semantic_primary_index_identity', 'manifest_canonical_tracked_diff_sha256', 'manifest_reachable_head_object_graph_identity'];
const controllerReceiptAssignmentKey = 'CURRENT_AUTHORITY_ASSIGNMENT_ID';
const controllerReceiptWriterKey = 'CURRENT_AUTHORITY_CODER_THREAD_ID';
const controllerReceiptEnvironmentName = 'SGDS_CONTROLLER_INSPECTION_RECEIPT';
const authoritativePreambleBindingKeys = ['AUTHORITY_ID', controllerReceiptAssignmentKey, controllerReceiptWriterKey];
const sha256Label = value => `sha256:${sha(value)}`;
const windowsReparsePointProbe = [
  "$ErrorActionPreference = 'Stop'",
  '$decoded = [Console]::In.ReadToEnd() | ConvertFrom-Json',
  'if ($null -eq $decoded -or $decoded -is [string]) { exit 2 }',
  'foreach ($candidate in @($decoded)) {',
  "  if ($candidate -isnot [string] -or [string]::IsNullOrWhiteSpace($candidate)) { exit 3 }",
  '  $item = Get-Item -LiteralPath $candidate -Force -ErrorAction Stop',
  '  if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { exit 4 }',
  '}',
  'exit 0'
].join('\n');

function receiptFailure(code) { throw new Error(code); }
export function assertWindowsNoReparsePoints(paths, { platform = process.platform, powerShellExecutable = 'powershell.exe' } = {}) {
  if (!Array.isArray(paths) || paths.length === 0 || paths.some(value => typeof value !== 'string' || !path.isAbsolute(value))) receiptFailure('RECEIPT_ISOLATION_LOCAL_PATH_INVALID');
  if (platform !== 'win32') return;
  try {
    execFileSync(powerShellExecutable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', windowsReparsePointProbe], {
      input: JSON.stringify([...new Set(paths)]), encoding: 'utf8', windowsHide: true, stdio: ['pipe', 'ignore', 'ignore']
    });
  } catch { receiptFailure('RECEIPT_ISOLATION_LOCAL_PATH_INVALID'); }
}
function exactKeys(value, keys, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join('|') !== [...keys].sort().join('|')) receiptFailure(code);
}
function isSha256(value) { return typeof value === 'string' && /^sha256:[0-9a-f]{64}$/.test(value); }
function canonicalExistingPath(value, code) {
  if (typeof value !== 'string' || !path.isAbsolute(value) || !fs.existsSync(value)) receiptFailure(code);
  return fs.realpathSync.native(value);
}
function canonicalOutputPath(value, code) {
  if (typeof value !== 'string' || !path.isAbsolute(value)) receiptFailure(code);
  const directory = canonicalExistingPath(path.dirname(value), code);
  return path.join(directory, path.basename(value));
}
function pathWithin(child, parent) {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}
function gitBuffer(base, args, code) {
  try { return execFileSync('git', ['-C', base, ...args], { encoding: null, windowsHide: true }); }
  catch { receiptFailure(code); }
}
function gitText(base, args, code) { return gitBuffer(base, args, code).toString('utf8').trim(); }
function canonicalRepositoryContext(base) {
  const requested = canonicalExistingPath(path.resolve(base), 'RECEIPT_PRIMARY_ROOT_INVALID');
  const sourceRoot = canonicalExistingPath(gitText(requested, ['rev-parse', '--show-toplevel'], 'RECEIPT_PRIMARY_ROOT_INVALID'), 'RECEIPT_PRIMARY_ROOT_INVALID');
  if (sourceRoot !== requested) receiptFailure('RECEIPT_PRIMARY_ROOT_NOT_TOPLEVEL');
  const commonRaw = gitText(sourceRoot, ['rev-parse', '--git-common-dir'], 'RECEIPT_GIT_COMMON_DIRECTORY_INVALID');
  const commonDirectory = canonicalExistingPath(path.resolve(sourceRoot, commonRaw), 'RECEIPT_GIT_COMMON_DIRECTORY_INVALID');
  return { sourceRoot, commonDirectory };
}
export function authoritativeContractPreamble(text) {
  const source = text.replace(/^\uFEFF/, '');
  const title = /^# [^\r\n]+\r?\n/.exec(source);
  const firstSection = source.search(/^##\s/m);
  if (!title || firstSection < title[0].length) receiptFailure('RECEIPT_ACTIVE_PREAMBLE_INVALID');
  const preamble = source.slice(title[0].length, firstSection);
  const entries = new Map([...preamble.matchAll(/^([A-Z][A-Z0-9_]*)=(.*)$/gm)].map(([, key, value]) => [key, value]));
  for (const key of authoritativePreambleBindingKeys) {
    const matches = [...preamble.matchAll(new RegExp(`^${key}=(.*)$`, 'gm'))];
    if (matches.length !== 1 || matches[0][1].trim() === '') receiptFailure('RECEIPT_ACTIVE_PREAMBLE_BINDING_INVALID');
  }
  return entries;
}
function activeControllerBinding(base) {
  const contract = read(path.join(base, 'docs', 'exec-plans', 'active', activeName));
  const entries = authoritativeContractPreamble(contract);
  const authorityId = entries.get('AUTHORITY_ID');
  const assignmentId = entries.get(controllerReceiptAssignmentKey);
  const writerId = entries.get(controllerReceiptWriterKey);
  if (!authorityId || !assignmentId || !writerId) receiptFailure('RECEIPT_ACTIVE_BINDING_MISSING');
  return { authorityId, assignmentId, writerId };
}
function statusEntries(base) {
  const status = gitBuffer(base, ['status', '--porcelain=v1', '-z', '--untracked-files=all'], 'RECEIPT_CANDIDATE_STATUS_UNAVAILABLE');
  const untracked = gitBuffer(base, ['ls-files', '--others', '--exclude-standard', '-z'], 'RECEIPT_CANDIDATE_CONTENT_UNAVAILABLE').toString('utf8').split('\0').filter(Boolean).sort();
  const overlays = [];
  for (const relativePath of untracked) {
    const file = path.resolve(base, relativePath);
    if (!pathWithin(file, base) || !fs.existsSync(file) || !fs.lstatSync(file).isFile()) receiptFailure('RECEIPT_CANDIDATE_CONTENT_UNAVAILABLE');
    overlays.push(`${relativePath.replaceAll('\\', '/')}:${sha256Label(fs.readFileSync(file))}`);
  }
  return { status, overlays };
}
function currentCandidateIdentity(context) {
  const head = gitText(context.sourceRoot, ['rev-parse', 'HEAD'], 'RECEIPT_CANDIDATE_HEAD_UNAVAILABLE');
  const { status, overlays } = statusEntries(context.sourceRoot);
  const indexRaw = gitText(context.sourceRoot, ['rev-parse', '--git-path', 'index'], 'RECEIPT_CANDIDATE_INDEX_UNAVAILABLE');
  const indexPath = canonicalExistingPath(path.resolve(context.sourceRoot, indexRaw), 'RECEIPT_CANDIDATE_INDEX_UNAVAILABLE');
  const diff = gitBuffer(context.sourceRoot, ['diff', '--binary', '--no-ext-diff', 'HEAD'], 'RECEIPT_CANDIDATE_CONTENT_UNAVAILABLE');
  const content = crypto.createHash('sha256').update(diff).update('\0').update(overlays.join('\n')).digest('hex');
  return { head, status_sha256: sha256Label(status), index_sha256: sha256Label(fs.readFileSync(indexPath)), content_sha256: `sha256:${content}` };
}
function declaredAbsolutePath(value, code) {
  if (typeof value !== 'string' || !path.isAbsolute(value)) receiptFailure(code);
  return path.normalize(value);
}
function samePath(left, right) { return path.normalize(left).toLowerCase() === path.normalize(right).toLowerCase(); }
function compareOrdinalUtf16(left, right) { return left < right ? -1 : left > right ? 1 : 0; }
function strictGitLines(base, args, { input, code }) {
  const run = spawnSync('git', ['-C', base, ...args], { encoding: 'utf8', input, windowsHide: true });
  if (run.error || run.signal || run.status !== 0 || (run.stderr ?? '') !== '') receiptFailure(code);
  const normalized = (run.stdout ?? '').replaceAll('\r\n', '\n');
  if (normalized.includes('\r') || !normalized.endsWith('\n')) receiptFailure(code);
  return normalized.slice(0, -1).split('\n');
}
export function reachableHeadObjectGraphIdentity(worktreePath, head) {
  const [objectFormat] = strictGitLines(worktreePath, ['rev-parse', '--show-object-format'], { code: 'RECEIPT_GIT_OBJECT_FORMAT_INVALID' });
  const objectIdPattern = objectFormat === 'sha1' ? /^[0-9a-f]{40}$/ : objectFormat === 'sha256' ? /^[0-9a-f]{64}$/ : null;
  if (!objectIdPattern || typeof head !== 'string' || !objectIdPattern.test(head)) receiptFailure('RECEIPT_REACHABLE_HEAD_INVALID');
  const resolvedHead = strictGitLines(worktreePath, ['rev-parse', '--verify', `${head}^{commit}`], { code: 'RECEIPT_REACHABLE_HEAD_INVALID' });
  if (resolvedHead.length !== 1 || resolvedHead[0] !== head) receiptFailure('RECEIPT_REACHABLE_HEAD_INVALID');
  const enumerated = strictGitLines(worktreePath, ['rev-list', '--objects', '--no-object-names', '--missing=error', head], { code: 'RECEIPT_REACHABLE_HEAD_OBJECT_ENUMERATION_FAILED' });
  if (enumerated.length === 0 || enumerated.some(objectId => !objectIdPattern.test(objectId)) || new Set(enumerated).size !== enumerated.length) receiptFailure('RECEIPT_REACHABLE_HEAD_OBJECT_ENUMERATION_MALFORMED');
  const objectIds = [...enumerated].sort(compareOrdinalUtf16);
  const metadata = strictGitLines(worktreePath, ['cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)'], { input: `${objectIds.join('\n')}\n`, code: 'RECEIPT_REACHABLE_HEAD_OBJECT_BATCH_CHECK_FAILED' });
  if (metadata.length !== objectIds.length) receiptFailure('RECEIPT_REACHABLE_HEAD_OBJECT_BATCH_CHECK_CARDINALITY_MISMATCH');
  const canonicalMetadata = metadata.map((line, index) => {
    const match = line.match(/^([0-9a-f]+) (blob|tree|commit|tag) ([0-9]+)$/);
    if (!match || !objectIdPattern.test(match[1]) || match[1] !== objectIds[index] || !Number.isSafeInteger(Number(match[3]))) receiptFailure('RECEIPT_REACHABLE_HEAD_OBJECT_BATCH_CHECK_MALFORMED');
    return line;
  });
  return sha256Label(['reachable-head-object-graph/v1', `head=${head}`, `object_format=${objectFormat}`, `object_count=${objectIds.length}`, ...canonicalMetadata].join('\n'));
}
function assertCanonicalMaterializationPath(value) {
  if (typeof value !== 'string' || value.length === 0 || path.isAbsolute(value) || path.posix.isAbsolute(value) || value.includes('\\') || path.posix.normalize(value) !== value) receiptFailure('RECEIPT_ISOLATION_MANIFEST_MALFORMED');
  const segments = value.split('/');
  if (segments.some(segment => segment === '' || segment === '.' || segment === '..' || segment.toLowerCase() === '.git')) receiptFailure('RECEIPT_ISOLATION_MANIFEST_MALFORMED');
}
function localTrackedMaterializationPaths(worktreePath) {
  const raw = gitBuffer(worktreePath, ['ls-files', '-z'], 'RECEIPT_ISOLATION_TRACKED_SET_UNAVAILABLE');
  if (raw.length === 0) return [];
  if (raw[raw.length - 1] !== 0) receiptFailure('RECEIPT_ISOLATION_TRACKED_SET_UNAVAILABLE');
  const decoded = raw.toString('utf8');
  if (!Buffer.from(decoded, 'utf8').equals(raw)) receiptFailure('RECEIPT_ISOLATION_TRACKED_SET_UNAVAILABLE');
  const tracked = decoded.slice(0, -1).split('\0');
  for (const value of tracked) assertCanonicalMaterializationPath(value);
  if (new Set(tracked).size !== tracked.length) receiptFailure('RECEIPT_ISOLATION_TRACKED_SET_UNAVAILABLE');
  return tracked.sort(compareOrdinalUtf16);
}
function localTrackedMaterializationReparsePaths(worktreePath, materializationPaths) {
  const inspected = new Set([worktreePath]);
  for (const relativePath of materializationPaths) {
    const segments = relativePath.split('/');
    let currentPath = worktreePath;
    for (let index = 0; index < segments.length; index += 1) {
      currentPath = path.join(currentPath, segments[index]);
      if (!pathWithin(currentPath, worktreePath)) receiptFailure('RECEIPT_ISOLATION_LOCAL_PATH_INVALID');
      let entry;
      try { entry = fs.lstatSync(currentPath); }
      catch (error) {
        if (error?.code === 'ENOENT' && index === segments.length - 1) break;
        receiptFailure('RECEIPT_ISOLATION_LOCAL_PATH_INVALID');
      }
      if (entry.isSymbolicLink()) receiptFailure('RECEIPT_ISOLATION_LOCAL_PATH_INVALID');
      if (index < segments.length - 1 && !entry.isDirectory()) receiptFailure('RECEIPT_ISOLATION_LOCAL_PATH_INVALID');
      if (index === segments.length - 1 && !entry.isFile()) receiptFailure('RECEIPT_ISOLATION_LOCAL_PATH_INVALID');
      inspected.add(currentPath);
    }
  }
  assertWindowsNoReparsePoints([...inspected]);
  return inspected;
}
function localTrackedMaterializationRawIdentity(worktreePath, relativePath, windowsReparsePaths) {
  const segments = relativePath.split('/');
  const resolvedPath = path.resolve(worktreePath, ...segments);
  if (!pathWithin(resolvedPath, worktreePath)) receiptFailure('RECEIPT_ISOLATION_LOCAL_PATH_INVALID');
  let currentPath = worktreePath;
  if (!(windowsReparsePaths instanceof Set) || !windowsReparsePaths.has(currentPath)) receiptFailure('RECEIPT_ISOLATION_LOCAL_PATH_INVALID');
  for (let index = 0; index < segments.length; index += 1) {
    currentPath = path.join(currentPath, segments[index]);
    let entry;
    try { entry = fs.lstatSync(currentPath); }
    catch (error) {
      if (error?.code === 'ENOENT' && index === segments.length - 1) return 'missing';
      receiptFailure('RECEIPT_ISOLATION_LOCAL_PATH_INVALID');
    }
    if (!windowsReparsePaths.has(currentPath)) receiptFailure('RECEIPT_ISOLATION_LOCAL_PATH_INVALID');
    if (entry.isSymbolicLink()) receiptFailure('RECEIPT_ISOLATION_LOCAL_PATH_INVALID');
    if (index < segments.length - 1) {
      if (!entry.isDirectory()) receiptFailure('RECEIPT_ISOLATION_LOCAL_PATH_INVALID');
      continue;
    }
    if (!entry.isFile()) receiptFailure('RECEIPT_ISOLATION_LOCAL_PATH_INVALID');
    return sha256Label(fs.readFileSync(currentPath));
  }
  receiptFailure('RECEIPT_ISOLATION_LOCAL_PATH_INVALID');
}
export function readIsolationIdentity(manifestPath, options = {}) {
  const canonicalManifestPath = canonicalExistingPath(manifestPath, 'RECEIPT_ISOLATION_MANIFEST_MISSING');
  let manifest;
  const raw = fs.readFileSync(canonicalManifestPath);
  try { manifest = JSON.parse(raw.toString('utf8')); } catch { receiptFailure('RECEIPT_ISOLATION_MANIFEST_MALFORMED'); }
  const required = ['magic', 'schema_version', 'source_root', 'git_common_directory', 'isolation_root', 'worktree_path', 'purpose', 'head', 'tracked_materialization_paths', 'tracked_materialization_raw_identities', 'content_aware_primary_worktree_state_sha256', 'semantic_primary_index_identity', 'canonical_tracked_diff_sha256', 'reachable_head_object_graph_identity', 'source_status_after_linked_stat_refresh_sha256', 'linked_status_before_stat_refresh_sha256', 'linked_status_after_stat_refresh_sha256', 'linked_semantic_index_before_stat_refresh', 'linked_semantic_index_after_stat_refresh', 'linked_staged_entries_before_stat_refresh', 'linked_staged_entries_after_stat_refresh', 'linked_stat_refresh_path_count', 'linked_stat_refresh_exit_code'];
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest) || required.some(key => !Object.hasOwn(manifest, key))) receiptFailure('RECEIPT_ISOLATION_MANIFEST_MALFORMED');
  if (manifest.magic !== 'syncgmaildrivesheet.non-writer-isolation/v4' || manifest.schema_version !== 4) receiptFailure('RECEIPT_ISOLATION_MANIFEST_MALFORMED');
  const sourceRoot = declaredAbsolutePath(manifest.source_root, 'RECEIPT_ISOLATION_MANIFEST_MISMATCH');
  const commonDirectory = declaredAbsolutePath(manifest.git_common_directory, 'RECEIPT_ISOLATION_MANIFEST_MISMATCH');
  const isolationRoot = canonicalExistingPath(manifest.isolation_root, 'RECEIPT_ISOLATION_MANIFEST_MISMATCH');
  const worktreePath = canonicalExistingPath(manifest.worktree_path, 'RECEIPT_ISOLATION_MANIFEST_MISMATCH');
  if (!pathWithin(worktreePath, isolationRoot) || !['EXPLORER', 'REVIEWER', 'VERIFIER'].includes(manifest.purpose)) receiptFailure('RECEIPT_ISOLATION_MANIFEST_MISMATCH');
  if (options.commonDirectory && !samePath(commonDirectory, options.commonDirectory)) receiptFailure('RECEIPT_ISOLATION_MANIFEST_MISMATCH');
  if (options.expectedWorktreePath && !samePath(worktreePath, options.expectedWorktreePath)) receiptFailure('RECEIPT_ISOLATION_WORKTREE_MISMATCH');
  if (options.expectedPrimaryRoot && !samePath(sourceRoot, options.expectedPrimaryRoot)) receiptFailure('RECEIPT_ISOLATION_MANIFEST_MISMATCH');
  if (options.requirePrimaryBinding && !samePath(canonicalExistingPath(sourceRoot, 'RECEIPT_ISOLATION_MANIFEST_MISMATCH'), options.requirePrimaryBinding)) receiptFailure('RECEIPT_ISOLATION_MANIFEST_MISMATCH');
  for (const key of ['head', 'content_aware_primary_worktree_state_sha256', 'semantic_primary_index_identity', 'canonical_tracked_diff_sha256', 'reachable_head_object_graph_identity']) if (key === 'head' ? typeof manifest[key] !== 'string' || manifest[key].length === 0 : !isSha256(manifest[key])) receiptFailure('RECEIPT_ISOLATION_MANIFEST_MALFORMED');
  if (!Array.isArray(manifest.tracked_materialization_paths) || !Array.isArray(manifest.tracked_materialization_raw_identities) || manifest.tracked_materialization_paths.length !== manifest.tracked_materialization_raw_identities.length) receiptFailure('RECEIPT_ISOLATION_MANIFEST_MALFORMED');
  const materializationPaths = [...manifest.tracked_materialization_paths];
  for (const value of materializationPaths) assertCanonicalMaterializationPath(value);
  if (JSON.stringify(materializationPaths) !== JSON.stringify([...materializationPaths].sort(compareOrdinalUtf16)) || new Set(materializationPaths).size !== materializationPaths.length) receiptFailure('RECEIPT_ISOLATION_MANIFEST_MALFORMED');
  if (JSON.stringify(materializationPaths) !== JSON.stringify(localTrackedMaterializationPaths(worktreePath))) receiptFailure('RECEIPT_ISOLATION_TRACKED_SET_MISMATCH');
  const windowsReparsePaths = localTrackedMaterializationReparsePaths(worktreePath, materializationPaths);
  for (let index = 0; index < materializationPaths.length; index += 1) {
    const identity = manifest.tracked_materialization_raw_identities[index];
    if (!identity || typeof identity !== 'object' || Array.isArray(identity) || Object.keys(identity).sort().join('|') !== 'path|raw_sha256' || identity.path !== materializationPaths[index] || (identity.raw_sha256 !== 'missing' && !isSha256(identity.raw_sha256))) receiptFailure('RECEIPT_ISOLATION_MANIFEST_MALFORMED');
    if (identity.raw_sha256 !== localTrackedMaterializationRawIdentity(worktreePath, materializationPaths[index], windowsReparsePaths)) receiptFailure('RECEIPT_ISOLATION_RAW_IDENTITY_MISMATCH');
  }
  if (manifest.reachable_head_object_graph_identity !== reachableHeadObjectGraphIdentity(worktreePath, manifest.head)) receiptFailure('RECEIPT_REACHABLE_HEAD_OBJECT_GRAPH_MISMATCH');
  for (const key of ['source_status_after_linked_stat_refresh_sha256', 'linked_status_before_stat_refresh_sha256', 'linked_status_after_stat_refresh_sha256', 'linked_semantic_index_before_stat_refresh', 'linked_semantic_index_after_stat_refresh', 'linked_staged_entries_before_stat_refresh', 'linked_staged_entries_after_stat_refresh']) if (!isSha256(manifest[key])) receiptFailure('RECEIPT_ISOLATION_MANIFEST_MALFORMED');
  if (manifest.source_status_after_linked_stat_refresh_sha256 !== manifest.linked_status_after_stat_refresh_sha256 || manifest.linked_semantic_index_before_stat_refresh !== manifest.linked_semantic_index_after_stat_refresh || manifest.linked_staged_entries_before_stat_refresh !== manifest.linked_staged_entries_after_stat_refresh || !Number.isSafeInteger(manifest.linked_stat_refresh_path_count) || manifest.linked_stat_refresh_path_count < 0 || ![0, 1].includes(manifest.linked_stat_refresh_exit_code)) receiptFailure('RECEIPT_ISOLATION_MANIFEST_MALFORMED');
  return {
    manifest_path: canonicalManifestPath,
    manifest_sha256: sha256Label(raw),
    isolation_root: isolationRoot,
    worktree_path: worktreePath,
    purpose: manifest.purpose,
    manifest_source_root: sourceRoot,
    manifest_git_common_directory: commonDirectory,
    manifest_head: manifest.head,
    manifest_content_aware_primary_worktree_state_sha256: manifest.content_aware_primary_worktree_state_sha256,
    manifest_semantic_primary_index_identity: manifest.semantic_primary_index_identity,
    manifest_canonical_tracked_diff_sha256: manifest.canonical_tracked_diff_sha256,
    manifest_reachable_head_object_graph_identity: manifest.reachable_head_object_graph_identity
  };
}
function parseInspectionOutput(output) {
  const fields = new Map();
  for (const line of output.replace(/\r/g, '').split('\n').filter(Boolean)) {
    const separator = line.indexOf('=');
    if (separator <= 0 || fields.has(line.slice(0, separator))) receiptFailure('RECEIPT_INSPECTION_OUTPUT_MALFORMED');
    fields.set(line.slice(0, separator), line.slice(separator + 1));
  }
  const inspection = { action: fields.get('ACTION'), status: fields.get('STATUS'), slot_state: fields.get('SLOT_STATE'), revision: Number(fields.get('REVISION')), state_sha256: fields.get('STATE_SHA256') };
  if (inspection.action !== 'INSPECTWRITER' || inspection.status !== 'INSPECTED' || inspection.slot_state !== 'NONE') receiptFailure('RECEIPT_INSPECTION_NOT_NONE');
  if (!Number.isSafeInteger(inspection.revision) || inspection.revision < 0 || !isSha256(inspection.state_sha256)) receiptFailure('RECEIPT_INSPECTION_OUTPUT_MALFORMED');
  return inspection;
}
function sameJson(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
export function validateControllerInspectionReceiptPayload(receipt, expected) {
  exactKeys(receipt, controllerReceiptKeys, 'RECEIPT_SCHEMA_INVALID');
  if (receipt.magic !== controllerReceiptMagic || receipt.schema_version !== controllerReceiptSchemaVersion) receiptFailure('RECEIPT_SCHEMA_INVALID');
  if (!Number.isSafeInteger(receipt.issued_utc_ms) || receipt.issued_utc_ms < 0) receiptFailure('RECEIPT_ISSUED_UTC_MS_INVALID');
  if (receipt.issued_utc_ms > expected.now) receiptFailure('RECEIPT_ISSUED_UTC_MS_FUTURE');
  if (expected.now - receipt.issued_utc_ms > controllerReceiptMaximumAgeMs) receiptFailure('RECEIPT_STALE');
  if (!samePath(receipt.primary_root, expected.primaryRoot) || !samePath(receipt.git_common_directory, expected.commonDirectory)) receiptFailure('RECEIPT_REPOSITORY_BINDING_MISMATCH');
  if (receipt.authority_id !== expected.binding.authorityId || receipt.assignment_id !== expected.binding.assignmentId || receipt.writer_id !== expected.binding.writerId) receiptFailure('RECEIPT_ACTIVE_BINDING_MISMATCH');
  exactKeys(receipt.inspection, controllerInspectionKeys, 'RECEIPT_INSPECTION_SCHEMA_INVALID');
  if (receipt.inspection.action !== 'INSPECTWRITER' || receipt.inspection.status !== 'INSPECTED' || receipt.inspection.slot_state !== 'NONE' || !Number.isSafeInteger(receipt.inspection.revision) || receipt.inspection.revision < 0 || !isSha256(receipt.inspection.state_sha256)) receiptFailure('RECEIPT_INSPECTION_MISMATCH');
  exactKeys(receipt.candidate, controllerCandidateKeys, 'RECEIPT_CANDIDATE_SCHEMA_INVALID');
  if (typeof receipt.candidate.head !== 'string' || receipt.candidate.head.length === 0 || !['status_sha256', 'index_sha256', 'content_sha256', 'manifest_content_aware_primary_worktree_state_sha256', 'manifest_semantic_primary_index_identity', 'manifest_canonical_tracked_diff_sha256', 'manifest_reachable_head_object_graph_identity'].every(key => isSha256(receipt.candidate[key]))) receiptFailure('RECEIPT_CANDIDATE_SCHEMA_INVALID');
  exactKeys(receipt.isolated_candidate, ['head', 'status_sha256', 'index_sha256', 'content_sha256'], 'RECEIPT_ISOLATED_CANDIDATE_SCHEMA_INVALID');
  if (!sameJson(receipt.isolated_candidate, expected.localCandidate)) receiptFailure('RECEIPT_ISOLATED_CANDIDATE_MISMATCH');
  exactKeys(receipt.isolation, controllerIsolationKeys, 'RECEIPT_ISOLATION_SCHEMA_INVALID');
  if (!sameJson(receipt.isolation, expected.isolation)) receiptFailure('RECEIPT_ISOLATION_MANIFEST_MISMATCH');
  if (receipt.isolation.manifest_head !== receipt.candidate.head || !samePath(receipt.isolation.manifest_source_root, receipt.primary_root) || !samePath(receipt.isolation.manifest_git_common_directory, receipt.git_common_directory) || receipt.candidate.manifest_content_aware_primary_worktree_state_sha256 !== receipt.isolation.manifest_content_aware_primary_worktree_state_sha256 || receipt.candidate.manifest_semantic_primary_index_identity !== receipt.isolation.manifest_semantic_primary_index_identity || receipt.candidate.manifest_canonical_tracked_diff_sha256 !== receipt.isolation.manifest_canonical_tracked_diff_sha256 || receipt.candidate.manifest_reachable_head_object_graph_identity !== receipt.isolation.manifest_reachable_head_object_graph_identity) receiptFailure('RECEIPT_MANIFEST_CANDIDATE_MISMATCH');
  return true;
}
function readReceipt(receiptPath) {
  const canonicalReceiptPath = canonicalExistingPath(receiptPath, 'RECEIPT_MISSING');
  let receipt;
  try { receipt = JSON.parse(fs.readFileSync(canonicalReceiptPath, 'utf8')); } catch { receiptFailure('RECEIPT_MALFORMED'); }
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt) || typeof receipt.primary_root !== 'string') receiptFailure('RECEIPT_MALFORMED');
  return { canonicalReceiptPath, receipt };
}
export function validateControllerInspectionReceipt(receiptPath, options = {}) {
  if (!receiptPath) receiptFailure('RECEIPT_REQUIRED');
  const { canonicalReceiptPath, receipt } = readReceipt(receiptPath);
  const localContext = canonicalRepositoryContext(options.localRoot ?? root);
  const declaredPrimaryRoot = declaredAbsolutePath(receipt.primary_root, 'RECEIPT_REPOSITORY_BINDING_MISMATCH');
  if (pathWithin(canonicalReceiptPath, localContext.sourceRoot) || pathWithin(canonicalReceiptPath, declaredPrimaryRoot)) receiptFailure('RECEIPT_PATH_INSIDE_REPOSITORY');
  const isolation = readIsolationIdentity(receipt.isolation?.manifest_path, { commonDirectory: localContext.commonDirectory, expectedWorktreePath: localContext.sourceRoot, expectedPrimaryRoot: declaredPrimaryRoot });
  const expected = { now: options.now ?? Date.now(), primaryRoot: declaredPrimaryRoot, commonDirectory: localContext.commonDirectory, binding: activeControllerBinding(localContext.sourceRoot), localCandidate: currentCandidateIdentity(localContext), isolation };
  validateControllerInspectionReceiptPayload(receipt, expected);
  return { candidateRoot: localContext.sourceRoot, receipt };
}
function writeExternalReceiptAtomically(receiptPath, receipt, primaryRoot) {
  const target = canonicalOutputPath(receiptPath, 'RECEIPT_OUTPUT_PATH_INVALID');
  if (pathWithin(target, primaryRoot)) receiptFailure('RECEIPT_OUTPUT_PATH_INSIDE_REPOSITORY');
  if (fs.existsSync(target)) receiptFailure('RECEIPT_OUTPUT_EXISTS');
  const temporary = path.join(path.dirname(target), `.${path.basename(target)}.${crypto.randomUUID()}.tmp`);
  try {
    const descriptor = fs.openSync(temporary, 'wx');
    try { fs.writeFileSync(descriptor, JSON.stringify(receipt)); fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
    fs.renameSync(temporary, target);
  } finally {
    if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
  }
  return target;
}
export function createControllerInspectionReceipt({ receiptPath, isolationManifestPath, primaryRoot = root, now = Date.now() } = {}) {
  if (!receiptPath || !isolationManifestPath) receiptFailure('RECEIPT_CREATION_ARGUMENT_REQUIRED');
  const context = canonicalRepositoryContext(primaryRoot);
  const binding = activeControllerBinding(context.sourceRoot);
  const inspectionRun = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(context.sourceRoot, 'scripts', 'ai', 'Manage-NonWriterIsolation.ps1'), '-Action', 'InspectWriter'], { cwd: context.sourceRoot, encoding: 'utf8', windowsHide: true });
  if (inspectionRun.status !== 0) receiptFailure('RECEIPT_INSPECTION_FAILED');
  const isolation = readIsolationIdentity(isolationManifestPath, { commonDirectory: context.commonDirectory, requirePrimaryBinding: context.sourceRoot });
  const primaryCandidate = {
    ...currentCandidateIdentity(context),
    manifest_content_aware_primary_worktree_state_sha256: isolation.manifest_content_aware_primary_worktree_state_sha256,
    manifest_semantic_primary_index_identity: isolation.manifest_semantic_primary_index_identity,
    manifest_canonical_tracked_diff_sha256: isolation.manifest_canonical_tracked_diff_sha256,
    manifest_reachable_head_object_graph_identity: isolation.manifest_reachable_head_object_graph_identity
  };
  const isolatedCandidate = currentCandidateIdentity(canonicalRepositoryContext(isolation.worktree_path));
  const receipt = {
    magic: controllerReceiptMagic,
    schema_version: controllerReceiptSchemaVersion,
    issued_utc_ms: now,
    primary_root: context.sourceRoot,
    git_common_directory: context.commonDirectory,
    authority_id: binding.authorityId,
    assignment_id: binding.assignmentId,
    writer_id: binding.writerId,
    inspection: parseInspectionOutput((inspectionRun.stdout || '') + (inspectionRun.stderr || '')),
    candidate: primaryCandidate,
    isolated_candidate: isolatedCandidate,
    isolation
  };
  validateControllerInspectionReceiptPayload(receipt, { now, primaryRoot: context.sourceRoot, commonDirectory: context.commonDirectory, binding, localCandidate: isolatedCandidate, isolation });
  writeExternalReceiptAtomically(receiptPath, receipt, context.sourceRoot);
  return receipt;
}
function values(text) { return new Map([...text.replace(/^\uFEFF/, '').matchAll(/^([A-Z][A-Z0-9_]*)=(.*)$/gm)].map(([, k, v]) => [k, v])); }
function parseTap(output) { const get = key => Number(output.match(new RegExp(`# ${key} (\\d+)`))?.[1] ?? NaN); return { tests: get('tests'), pass: get('pass'), fail: get('fail'), skip: get('skipped'), todo: get('todo'), cancelled: get('cancelled') }; }
function contractScope(contract) { const section = contract.match(/## Allowed mutation scope\r?\n([\s\S]*?)\r?\n## /)?.[1] ?? ''; return [...section.matchAll(/^- `([^`]+)`/gm)].map(([, item]) => item); }
function activeContract(base = root) {
  const dir = path.join(base, 'docs', 'exec-plans', 'active'); const files = fs.readdirSync(dir).filter(name => name.endsWith('.md')).sort();
  assert.deepEqual(files, [activeName], 'ACTIVE_CONTRACT_EXACTLY_ONE'); const contract = read(path.join(dir, activeName)); const preamble = authoritativeContractPreamble(contract);
  for (const key of authoritativePreambleBindingKeys) assert.ok(preamble.get(key)?.trim(), `ACTIVE_CONTRACT_PREAMBLE_BINDING_REQUIRED=${key}`);
  assert.equal(preamble.get('STATUS'), 'ACTIVE', 'ACTIVE_CONTRACT_STATUS');
  assert.deepEqual(contractScope(contract), candidateScope, 'ACTIVE_CONTRACT_CANDIDATE_SCOPE_EXACT');
}
function functionBody(source, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const declaration = new RegExp(`(?:^|\\r?\\n)((?:export\\s+)?function\\s+${escapedName}(?:\\s*\\([^\\r\\n]*\\))?\\s*\\{)`);
  const match = declaration.exec(source);
  const offset = match ? match.index + match[0].length - match[1].length : -1;
  assert.notEqual(offset, -1, `missing ${name}`);
  const next = source.slice(offset + 1).search(/\r?\n(?:export )?function |\r?\nswitch \(\$Action\)/); return source.slice(offset, next === -1 ? source.length : offset + 1 + next);
}
function helperStatic(base = root) {
  const text = read(path.join(base, 'scripts/ai/Manage-NonWriterIsolation.ps1'));
  const checker = read(path.join(base, 'scripts/checkers', 'check-ai-governance-bootstrap.mjs'));
  const gitResult = functionBody(text, 'Get-GitResult');
  assert.match(gitResult, /\$standardOutputTask = \$process\.StandardOutput\.ReadToEndAsync\(\)\s*\r?\n\s*\$standardErrorTask = \$process\.StandardError\.ReadToEndAsync\(\)[\s\S]*?\$process\.WaitForExit\(\)\s*\r?\n\s*\$standardOutput = \$standardOutputTask\.GetAwaiter\(\)\.GetResult\(\)\s*\r?\n\s*\$standardError = \$standardErrorTask\.GetAwaiter\(\)\.GetResult\(\)/, 'GIT_DUAL_STREAM_CONCURRENT_DRAIN_REQUIRED');
  assert.doesNotMatch(gitResult, /\.ReadToEnd\(\)|Begin(?:Output|Error)ReadLine|(?:Output|Error)DataReceived/, 'GIT_LINE_OR_SEQUENTIAL_DRAIN_FORBIDDEN');
  const reachableGraph = functionBody(text, 'Get-ReachableHeadObjectGraphIdentity');
  assert.match(reachableGraph, /'rev-list', '--objects', '--no-object-names', '--missing=error', \$Head/, 'REACHABLE_HEAD_EXACT_OBJECT_ENUMERATION_REQUIRED');
  assert.match(reachableGraph, /ConvertTo-CanonicalOrdinalUtf16Array/, 'REACHABLE_HEAD_OBJECT_ORDINAL_ORDER_REQUIRED');
  assert.match(reachableGraph, /'cat-file', '--batch-check=%\(objectname\) %\(objecttype\) %\(objectsize\)'[\s\S]*?-StandardInput \$batchInput/, 'REACHABLE_HEAD_OBJECT_BATCH_CHECK_REQUIRED');
  for (const token of ['GIT_REACHABLE_HEAD_OBJECT_ENUMERATION_FAILED', 'GIT_REACHABLE_HEAD_OBJECT_BATCH_CHECK_FAILED', 'GIT_REACHABLE_HEAD_OBJECT_BATCH_CHECK_CARDINALITY_MISMATCH', 'GIT_REACHABLE_HEAD_OBJECT_GRAPH_DRIFT']) assert.match(text, new RegExp(token), `REACHABLE_HEAD_FAIL_CLOSED_REQUIRED=${token}`);
  assert.doesNotMatch(reachableGraph, /Get-ChildItem|git-common-dir|[\\/]objects/i, 'PHYSICAL_OBJECT_DATABASE_INVENTORY_FORBIDDEN');
  assert.doesNotMatch(text, /object_database_identity|manifest_object_database_identity|Get-GitObjectDatabaseIdentity|GIT_OBJECT_DATABASE_DRIFT/, 'LEGACY_PHYSICAL_OBJECT_IDENTITY_FORBIDDEN');
  const receiptGraph = functionBody(checker, 'reachableHeadObjectGraphIdentity');
  assert.match(receiptGraph, /'rev-list', '--objects', '--no-object-names', '--missing=error', head/, 'RECEIPT_REACHABLE_HEAD_ENUMERATION_REQUIRED');
  assert.match(receiptGraph, /'cat-file', '--batch-check=%\(objectname\) %\(objecttype\) %\(objectsize\)'/, 'RECEIPT_REACHABLE_HEAD_BATCH_CHECK_REQUIRED');
  const reparseProbe = functionBody(checker, 'assertWindowsNoReparsePoints');
  const reparseCollection = functionBody(checker, 'localTrackedMaterializationReparsePaths');
  const rawIdentity = functionBody(checker, 'localTrackedMaterializationRawIdentity');
  assert.match(reparseProbe, /execFileSync\([\s\S]*?input: JSON\.stringify[\s\S]*?windowsHide: true/, 'WINDOWS_REPARSE_PROBE_MUST_USE_INJECTION_SAFE_STDIN');
  assert.match(checker, /Get-Item -LiteralPath \$candidate[\s\S]*?\[System\.IO\.FileAttributes\]::ReparsePoint/, 'WINDOWS_FILE_ATTRIBUTE_REPARSE_POINT_PROBE_REQUIRED');
  assert.match(reparseCollection, /assertWindowsNoReparsePoints\(\[\.\.\.inspected\]\)/, 'WINDOWS_REPARSE_COMPONENT_PROBE_REQUIRED');
  assert.match(rawIdentity, /windowsReparsePaths\.has\(currentPath\)/, 'RAW_IDENTITY_REPARSE_COMPONENT_CACHE_REQUIRED');
  for (const name of ['Get-TrackedPatchPaths', 'Get-TrackedMaterializationPaths', 'Get-ContentAwareWorktreeIdentity']) assert.match(functionBody(text, name), /'-z'/, `GIT_NUL_DELIMITED_ENUMERATION_REQUIRED=${name}`);
  const refresh = functionBody(text, 'Invoke-LinkedIndexStatRefresh');
  const sourceChangedTrackedPaths = functionBody(text, 'Get-SourceChangedTrackedPaths');
  assert.match(sourceChangedTrackedPaths, /\[Parameter\(Mandatory = \$true\)\]\[AllowEmptyString\(\)\]\[string\]\$PorcelainV1Z/, 'SOURCE_STATUS_EMPTY_PORCELAIN_TOLERANCE_REQUIRED');
  assert.match(sourceChangedTrackedPaths, /return ,\$changed/, 'SOURCE_STATUS_EMPTY_CHANGE_SET_PRESERVATION_REQUIRED');
  assert.match(sourceChangedTrackedPaths, /\$PorcelainV1Z\.Length -gt 0[\s\S]*?\$PorcelainV1Z\[\$PorcelainV1Z\.Length - 1\] -ne \[char\]0[\s\S]*?Throw-Failure 'SOURCE_STATUS_PORCELAIN_INVALID'[\s\S]*?\$records = @\(\$PorcelainV1Z -split "`0"\)/, 'SOURCE_STATUS_TERMINAL_NUL_FAIL_CLOSED_REQUIRED');
  assert.match(sourceChangedTrackedPaths, /\$record\.Length -lt 3 -or \$record\[2\] -ne ' '/, 'SOURCE_STATUS_MALFORMED_NONEMPTY_FAIL_CLOSED_REQUIRED');
  assert.match(sourceChangedTrackedPaths, /SOURCE_STATUS_PORCELAIN_INVALID/, 'SOURCE_STATUS_INVALID_FAILURE_REQUIRED');
  const ordinalUtf16 = functionBody(text, 'ConvertTo-CanonicalOrdinalUtf16Array');
  assert.match(ordinalUtf16, /\[System\.StringComparer\]::Ordinal/, 'MATERIALIZATION_ORDINAL_UTF16_ORDER_REQUIRED');
  assert.match(functionBody(text, 'Get-TrackedMaterializationPaths'), /ConvertTo-CanonicalOrdinalUtf16Array/, 'MATERIALIZATION_PATH_CANONICAL_ORDER_REQUIRED');
  assert.match(functionBody(text, 'Get-TrackedRawIdentity'), /ConvertTo-CanonicalOrdinalUtf16Array/, 'MATERIALIZATION_RAW_IDENTITY_CANONICAL_ORDER_REQUIRED');
  assert.match(refresh, /'update-index', '--refresh', '-q', '-z', '--stdin'/, 'LINKED_INDEX_STAT_REFRESH_NUL_STDIN_REQUIRED');
  assert.match(refresh, /Get-SourceChangedTrackedPaths/, 'LINKED_INDEX_STAT_REFRESH_SOURCE_CLEAN_PATH_BOUND_REQUIRED');
  assert.match(refresh, /\$exitCode -notin @\(0, 1\)/, 'LINKED_INDEX_STAT_REFRESH_NONZERO_GATE_REQUIRED');
  for (const token of ['LINKED_INDEX_SEMANTIC_IDENTITY_DRIFT_AFTER_STAT_REFRESH', 'LINKED_INDEX_STAGED_ENTRIES_DRIFT_AFTER_STAT_REFRESH', 'LINKED_STATUS_MISMATCH_AFTER_STAT_REFRESH']) assert.match(refresh, new RegExp(token), `LINKED_INDEX_STAT_REFRESH_POSTCONDITION_REQUIRED=${token}`);
  assert.doesNotMatch(refresh, /(?:--config|skip-worktree|assume-unchanged|git\s+add)/i, 'LINKED_INDEX_STAT_REFRESH_OVERRIDE_OR_STAGING_FORBIDDEN');
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
  for (const token of ['spawnInvoke', 'waitForFile', 'SGDS_GOVERNANCE_TEST_LOCK_PRE_RELEASE_HOLD_MS', "OperationId: 'g-v'", 'legacy', 'malformed', 'complete tracked materialization', 'sourceChangedTrackedPathsAstProbe', 'FunctionDefinitionAst', 'unterminatedError', 'trailingGarbageError', 'core.autocrlf', 'tracked_materialization_paths', 'reachable_head_object_graph_identity', 'hash-object', 'unreachable content-addressed snapshot object', 'linked_status_before_stat_refresh', 'linked_status_after_stat_refresh', 'linked_semantic_index_before_stat_refresh', 'linked_staged_entries_before_stat_refresh', 'ISOLATED_TRACKED_RAW_IDENTITY_DRIFT', 'post-checkout', 'high-volume stderr', 'timeout', 'nul-path', 'checkStaticGovernance', 'createWindowsPowerShellEnvironment', 'relative-root', 'embeddedClaspParserCommand', 'runEmbeddedClaspParser', 'decoy occurrence', 'non-string', 'whitespace-only', 'wrong value case', 'generic mismatch', 'exact case-sensitive match', 'GIT_INDEX_FILE', 'GIT_CONFIG_PARAMETERS', 'repository preflight failure', 'Firebase service preflight failure', 'immediate repository recheck failure', 'Firebase command unknown quarantine', 'confirmed Firebase success', 'decoy assignment has no effect']) assert.match(text, new RegExp(token, 'i'));
  assert.match(text, /spawnSync\('powershell\.exe', \['-NoProfile', '-NonInteractive', '-Command', embeddedClaspParserCommand\(\)\]/, 'ACTUAL_EMBEDDED_POWERSHELL_PARSER_EXECUTION_REQUIRED');
  assert.doesNotMatch(text, /hasExactTopLevelClaspScriptId|parseTopLevelClaspScriptId|assignmentAfter|lastAssignment|spawnSync\(['"]cmd(?:\.exe)?['"]/i, 'DUPLICATE_JS_PARSER_OR_BATCH_EXECUTION_FORBIDDEN');
}
function aggregateStatic(base = root) {
  const runner = read(path.join(base, 'scripts/test/run-all-checks.mjs'));
  const helper = read(path.join(base, 'scripts/test/powershell-module-env.mjs'));
  assertAggregateGateOrdering(runner);
  assert.match(runner, /createWindowsPowerShellEnvironment\(process\.env\)/, 'POWERSHELL_MODULE_ENV_HELPER_USE_REQUIRED');
  assert.doesNotMatch(runner, /requiredPowerShellModulePath|inheritedPowerShellModulePaths|seenPowerShellModulePaths/, 'EMBEDDED_POWERSHELL_MODULE_ENV_LOGIC_FORBIDDEN');
  for (const token of ['path.win32.isAbsolute', 'path.win32.delimiter', 'SystemRoot', 'WindowsPowerShell', 'PSModulePath', 'toLowerCase']) {
    assert.match(helper, new RegExp(token.replaceAll('.', '\\.')), `POWERSHELL_MODULE_ENV_HELPER_MISSING_${token}`);
  }
  assert.match(helper, /\[requiredModulePath, \.\.\.inheritedModulePaths\]/, 'POWERSHELL_SYSTEM_MODULE_PATH_PRECEDENCE_REQUIRED');
  assert.match(helper, /if \(!windowsRoot\) throw new Error\('ABSOLUTE_SYSTEMROOT_REQUIRED_FOR_POWERSHELL_MODULES'\)/, 'POWERSHELL_INVALID_SYSTEMROOT_FAIL_CLOSED_REQUIRED');
}
export function assertAggregateGateOrdering(runner) {
  assert.equal(typeof runner, 'string', 'AGGREGATE_RUNNER_SOURCE_REQUIRED');
  const scopeInvocation = 'runScopeGate();';
  const receiptInvocation = 'runReceiptBoundGovernanceGate();';
  const dynamicImport = "await import('./powershell-module-env.mjs')";
  const invocationCount = (source, token) => source.split(token).length - 1;
  assert.match(runner, /function runScopeGate\(\) \{[\s\S]*?\['scripts\/checkers\/check-ai-governance-bootstrap\.mjs', '--scope-only'\]/, 'AGGREGATE_SCOPE_GATE_REQUIRED');
  const receiptGate = runner.match(/function runReceiptBoundGovernanceGate\(\) \{([\s\S]*?)\r?\n\}/)?.[1] ?? '';
  assert.match(receiptGate, /\['scripts\/checkers\/check-ai-governance-bootstrap\.mjs'\]/, 'AGGREGATE_RECEIPT_BOUND_GATE_REQUIRED');
  assert.doesNotMatch(receiptGate, /--scope-only/, 'AGGREGATE_RECEIPT_BOUND_GATE_MUST_NOT_BE_SCOPE_ONLY');
  assert.equal(invocationCount(runner, scopeInvocation), 1, 'AGGREGATE_SCOPE_GATE_UNIQUE_REQUIRED');
  assert.equal(invocationCount(runner, receiptInvocation), 1, 'AGGREGATE_RECEIPT_BOUND_GATE_UNIQUE_REQUIRED');
  const scopeIndex = runner.indexOf(scopeInvocation);
  const receiptIndex = runner.indexOf(receiptInvocation);
  const importIndex = runner.indexOf(dynamicImport);
  assert.notEqual(importIndex, -1, 'AGGREGATE_DYNAMIC_HELPER_IMPORT_REQUIRED');
  assert.ok(scopeIndex < receiptIndex && receiptIndex < importIndex, 'AGGREGATE_GOVERNANCE_GATE_ORDER_REQUIRED');
  assert.match(runner, /runScopeGate\(\);\r?\nrunReceiptBoundGovernanceGate\(\);\r?\nconst \{ createWindowsPowerShellEnvironment \} = await import\('\.\/powershell-module-env\.mjs'\)/, 'AGGREGATE_GOVERNANCE_GATE_ORDER_REQUIRED');
  const commandsStart = runner.indexOf('const commands = [');
  const commandsEnd = commandsStart === -1 ? -1 : runner.indexOf('\n];', commandsStart);
  assert.notEqual(commandsStart, -1, 'AGGREGATE_LONG_COMMAND_LIST_REQUIRED');
  assert.notEqual(commandsEnd, -1, 'AGGREGATE_LONG_COMMAND_LIST_TERMINATOR_REQUIRED');
  assert.doesNotMatch(runner.slice(commandsStart, commandsEnd + 3), /check-ai-governance-bootstrap\.mjs/, 'AGGREGATE_GOVERNANCE_GATE_IN_LONG_COMMAND_LIST_FORBIDDEN');
  return true;
}
function deployStatic(base = root) {
  const deploy = read(path.join(base, '_guard', 'deploy', 'DEPLOY_GOOGLE_APPS_FIREBASE.bat'));
  assert.match(deploy, /\r\n/, 'DEPLOY_ADAPTER_CRLF_REQUIRED');
  assert.doesNotMatch(deploy.replace(/\r\n/g, ''), /\n/, 'DEPLOY_ADAPTER_BARE_LF_FORBIDDEN');
  const start = deploy.indexOf('\r\n:GasPreflight\r\n') + 2; assert.notEqual(start, 1, 'GAS_PREFLIGHT_REQUIRED');
  const next = deploy.indexOf('\r\n:FirebasePreflight\r\n', start); const gas = deploy.slice(start, next === -1 ? deploy.length : next);
  assert.doesNotMatch(gas, /findstr[^\r\n]*GAS_SCRIPT_ID/i, 'SUBSTRING_CLASP_SCRIPT_ID_VALIDATION_FORBIDDEN');
  for (const token of ['ConvertFrom-Json', 'PSObject.Properties', "-ceq 'scriptId'", "-ceq 'rootDir'", '-isnot [string]', 'IsNullOrWhiteSpace', 'CLASP_SCRIPT_ID', 'CLASP_ROOT_DIR_CURRENT']) assert.match(gas, new RegExp(token.replace(/[.()[\]]/g, '\\$&')), `CLASP_JSON_PARSE_REQUIRED_${token}`);
  assert.match(gas, /if not "%CLASP_SCRIPT_ID%"=="%GAS_SCRIPT_ID%"/, 'CASE_SENSITIVE_GAS_SCRIPT_ID_EQUALITY_REQUIRED');
  assert.ok(gas.indexOf('ConvertFrom-Json') < gas.indexOf('call :RequireTool clasp.cmd'), 'CLASP_JSON_VALIDATION_MUST_PRECEDE_CLASP_TOOL_CHECK');
  for (const token of [':BindCanonicalConfig', ':RejectOverrideEnvironment', ':ValidateConfigIdentity', 'BLOCKED_GUARD_CONFIG_NONCANONICAL', 'BLOCKED_OVERRIDE_ENVIRONMENT', 'VerifyGasUploadInventory', 'VerifyFirestoreIdentity', 'PENDING_LATE_COMPLETION_QUARANTINE']) assert.notEqual(deploy.indexOf(token), -1, `V6_DEPLOY_GUARD_REQUIRED=${token}`);
  const labelBody = label => {
    const marker = `\r\n${label}\r\n`; const markerIndex = deploy.indexOf(marker); assert.notEqual(markerIndex, -1, `DEPLOY_LABEL_REQUIRED=${label}`); const start = markerIndex + 2;
    const next = deploy.indexOf('\r\n:', start + label.length); return deploy.slice(start, next === -1 ? deploy.length : next);
  };
  const preflight = labelBody(':AdapterPrivilegedPreflight');
  const deployAction = labelBody(':Deploy');
  const deployGas = labelBody(':DeployGas');
  const deployFirebase = labelBody(':DeployFirebase');
  const firstPrivilegedCommand = source => Math.min(...['call :RequireTool', 'call clasp.cmd', 'call firebase.cmd', 'call gcloud.cmd', 'clasp.cmd --user "%CLASP_PROFILE%" push', 'firebase.cmd deploy'].map(token => {
    const index = source.indexOf(token); return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  }));
  assert.doesNotMatch(preflight, /(?:call :RequireTool|clasp\.cmd|firebase\.cmd|gcloud\.cmd)/i, 'PREFLIGHT_SERVICE_TOOL_CALL_FORBIDDEN');
  for (const [fixture, gate] of [
    ['configured root missing', 'BLOCKED_DEPLOY_PROJECT_ROOT_MISSING'],
    ['direct cwd mismatch', 'BLOCKED_DEPLOY_CWD_PROJECT_ROOT_MISMATCH'],
    ['git top-level unavailable', 'BLOCKED_DEPLOY_GIT_TOPLEVEL_UNAVAILABLE'],
    ['direct cwd git top-level mismatch', 'BLOCKED_DEPLOY_CWD_GIT_TOPLEVEL_MISMATCH'],
    ['configured root git top-level mismatch', 'BLOCKED_DEPLOY_PROJECT_ROOT_MISMATCH'],
    ['branch mismatch', 'BLOCKED_DEPLOY_WRONG_BRANCH'],
    ['origin mismatch', 'BLOCKED_DEPLOY_REMOTE_ORIGIN_MISMATCH'],
    ['git name mismatch', 'BLOCKED_DEPLOY_GIT_USER_NAME_MISMATCH'],
    ['git email mismatch', 'BLOCKED_DEPLOY_GIT_USER_EMAIL_MISMATCH'],
    ['tracked worktree dirty', 'BLOCKED_DEPLOY_TRACKED_WORKTREE_DIRTY'],
    ['staging nonempty', 'BLOCKED_DEPLOY_STAGED_CHANGES_PRESENT'],
    ['ahead count nonzero', 'BLOCKED_DEPLOY_LOCAL_AHEAD_OF_ORIGIN'],
    ['behind count nonzero', 'BLOCKED_DEPLOY_REMOTE_AHEAD_OF_LOCAL']
  ]) assert.notEqual(preflight.indexOf(gate), -1, `DIRECT_DEPLOY_FIXTURE_FAIL_CLOSED=${fixture}`);
  for (const token of ['git rev-parse --show-toplevel', 'git branch --show-current', 'git remote get-url origin', 'git config user.name', 'git config user.email', 'git diff --quiet --exit-code', 'git diff --cached --quiet --exit-code', 'git fetch origin --prune', 'git rev-list --left-right --count HEAD...origin/%EXPECTED_BRANCH%']) assert.notEqual(preflight.indexOf(token), -1, `ADAPTER_PREFLIGHT_REQUIRED=${token}`);
  for (const target of ['gas', 'firebase', 'all']) {
    const branch = deployAction.slice(deployAction.indexOf(`if /I "%DEPLOY_TARGET%"=="${target}" (`), deployAction.indexOf('\r\n)', deployAction.indexOf(`if /I "%DEPLOY_TARGET%"=="${target}" (`)) + 3);
    assert.ok(branch.indexOf('call :AdapterPrivilegedPreflight') < branch.indexOf(target === 'firebase' ? 'call :FirebasePreflight' : 'call :GasPreflight'), `DIRECT_DEPLOY_PREFLIGHT_PRECEDES_${target.toUpperCase()}_SERVICE_CHECKS`);
  }
  for (const [name, section, mutation] of [['gas', deployGas, 'clasp.cmd --user "%CLASP_PROFILE%" push'], ['firebase', deployFirebase, 'firebase.cmd deploy']]) {
    assert.notEqual(section.indexOf(mutation), -1, `DEPLOY_${name.toUpperCase()}_MUTATION_REQUIRED`);
    assert.ok(section.indexOf('call :AdapterPrivilegedPreflight') < section.indexOf(mutation), `DEPLOY_${name.toUpperCase()}_PRECHECKS_MUTATION`);
    assert.ok(section.indexOf('if errorlevel 1 exit /b 1') > section.indexOf('call :AdapterPrivilegedPreflight'), `DEPLOY_${name.toUpperCase()}_PRECHECK_FAILURE_STOPS_MUTATION`);
  }
  assert.equal(firstPrivilegedCommand(preflight), Number.MAX_SAFE_INTEGER, 'PREFLIGHT_DOES_NOT_REACH_SERVICE_TOOLS');
}
function projectRootStatic(base = root) {
  const engine = read(path.join(base, '_guard', 'PROJECT_GUARD_ENGINE.bat'));
  const labelIndex = label => engine.search(new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\r?$`, 'm'));
  const enter = engine.slice(labelIndex(':EnterRepo'), labelIndex(':VerifyBranch'));
  const configured = 'for %%I in ("%CD%") do set "CONFIGURED_ROOT_CANONICAL=%%~fI"';
  const actual = 'for %%I in ("%ACTUAL_ROOT%") do set "ACTUAL_ROOT_CANONICAL=%%~fI"';
  const equality = 'if /I not "%CONFIGURED_ROOT_CANONICAL%"=="%ACTUAL_ROOT_CANONICAL%" (';
  const mismatch = 'call :Fail BLOCKED_PROJECT_ROOT_MISMATCH';
  for (const token of [configured, 'git rev-parse --show-toplevel', 'if not defined ACTUAL_ROOT (', actual, equality, 'popd >nul', mismatch]) assert.notEqual(enter.indexOf(token), -1, `PROJECT_ROOT_GUARD_REQUIRED=${token}`);
  assert.ok(enter.indexOf('pushd "%PROJECT_ROOT%"') < enter.indexOf('git rev-parse --show-toplevel'), 'PROJECT_ROOT_ENTRY_PRECEDES_GIT_TOPLEVEL');
  assert.ok(enter.indexOf('git rev-parse --show-toplevel') < enter.indexOf(configured), 'CONFIGURED_ROOT_CANONICALIZATION_FOLLOWS_GIT_TOPLEVEL');
  assert.ok(enter.indexOf(configured) < enter.indexOf(actual), 'BOTH_ROOTS_CANONICALIZED_IN_ORDER');
  assert.ok(enter.indexOf(actual) < enter.indexOf(equality), 'ROOT_EQUALITY_FOLLOWS_BOTH_CANONICALIZATIONS');
  const equalityBlock = enter.slice(enter.indexOf(equality), enter.indexOf('exit /b 0', enter.indexOf(equality)));
  assert.notEqual(equalityBlock.indexOf('popd >nul'), -1, 'ROOT_MISMATCH_POP_REQUIRED');
  assert.ok(equalityBlock.indexOf('popd >nul') < equalityBlock.indexOf(mismatch), 'ROOT_MISMATCH_POPS_CONFIGURED_ROOT_BEFORE_FAILURE');
  assert.notEqual(equalityBlock.indexOf(mismatch), -1, 'ROOT_MISMATCH_FAILS_CLOSED');
  const commonStart = labelIndex(':CommonReadOnlyChecks');
  const commonEnd = engine.indexOf('\n:', commonStart + 1);
  const common = engine.slice(commonStart, commonEnd === -1 ? engine.length : commonEnd);
  assert.match(common, /call :EnterRepo/, 'ROOT_GUARD_COMMON_PATH_REQUIRED');
  for (const [action, privileged] of [[':Push', 'git push origin "%CONFIRMED_LOCAL_HEAD%:refs/heads/%EXPECTED_BRANCH%"'], [':Deploy', 'call :InvokeAdapter deploy']]) {
    const actionStart = labelIndex(action);
    const actionEnd = engine.indexOf('\n:', actionStart + 1);
    const section = engine.slice(actionStart, actionEnd === -1 ? engine.length : actionEnd);
    assert.match(section, /call :CommonReadOnlyChecks/, `ROOT_GUARD_REQUIRED_BEFORE_${action}`);
    assert.notEqual(section.indexOf(privileged), -1, `PRIVILEGED_COMMAND_REQUIRED=${privileged}`);
    assert.ok(section.indexOf('call :CommonReadOnlyChecks') < section.indexOf(privileged), `ROOT_GUARD_PRECEDES_${action}`);
  }
}
function batchLabelBody(source, label) {
  const marker = new RegExp(`(?:^|\\r?\\n)${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\r?\\n`); const match = marker.exec(source); assert.ok(match, `BATCH_LABEL_REQUIRED=${label}`);
  const start = match.index + match[0].length; const next = source.slice(start).search(/\r?\n:/); return source.slice(start, next === -1 ? source.length : start + next);
}
function capturedOverrideKeys(source) {
  const capture = batchLabelBody(source, ':CaptureOverrideEnvironment');
  const loop = capture.match(/for %%V in \(([^)]*)\) do \(/); assert.ok(loop, 'OVERRIDE_CAPTURE_LOOP_REQUIRED');
  assert.match(capture, /if defined %%V set "INHERITED_OVERRIDE_PRESENT=true"/, 'OVERRIDE_PRESENCE_CAPTURE_REQUIRED');
  assert.doesNotMatch(capture, /(?:echo[^\r\n]*%%V|set "[^"]*=%{1,2}V|for \/f)/i, 'OVERRIDE_VALUE_RETENTION_FORBIDDEN');
  return new Set(loop[1].trim().split(/\s+/));
}
function parseBatchCfg(source) {
  const labels = new Map(); let current = null;
  const lines = source.replace(/^\uFEFF/, '').split(/\r?\n/);
  for (const line of lines) {
    const label = /^:([A-Za-z][A-Za-z0-9_]*)\s*$/.exec(line);
    if (label) {
      const key = label[1].toLowerCase(); assert.ok(!labels.has(key), `CFG_DUPLICATE_LABEL=${label[1]}`);
      current = { name: label[1], lines: [] }; labels.set(key, current); continue;
    }
    if (current) current.lines.push(line);
  }
  const parseSimple = raw => {
    const line = raw.trim();
    let match = /^set "([A-Z][A-Z0-9_]*)=([^"]*)"$/i.exec(line);
    if (match) return { kind: 'set', key: match[1].toUpperCase(), value: match[2] };
    match = /^call\s+:([A-Za-z][A-Za-z0-9_]*)(?:\s+(.*))?$/i.exec(line);
    if (match) return { kind: 'call', label: match[1], args: match[2] ?? '' };
    match = /^goto\s+:([A-Za-z][A-Za-z0-9_]*)$/i.exec(line);
    if (match) return { kind: 'goto', label: match[1] };
    match = /^exit\s+\/b(?:\s+([012]))?$/i.exec(line);
    if (match) return { kind: 'exit', code: match[1] === undefined ? null : Number(match[1]) };
    if (/^echo(?:\s|$)/i.test(line)) return { kind: 'echo' };
    if (/^call\s+clasp\.cmd\b/i.test(line)) return { kind: 'provider', node: /\bpush\b/i.test(line) ? 'clasp-push' : /\bdeploy\b/i.test(line) ? 'clasp-deploy' : 'clasp-other' };
    if (/^call\s+firebase\.cmd\b/i.test(line)) return { kind: 'provider', node: /\bdeploy\b/i.test(line) ? 'firebase-deploy' : 'firebase-other' };
    if (/^findstr\b/i.test(line)) return { kind: 'provider', node: 'findstr' };
    if (/^(?:type|del)\s+/i.test(line)) return { kind: 'noop' };
    return { kind: 'unsupported', raw: line };
  };
  const parseBlock = (body, start = 0) => {
    const nodes = [];
    for (let index = start; index < body.length; index += 1) {
      const line = body[index].trim();
      if (!line || /^rem(?:\s|$)/i.test(line)) continue;
      if (line === ')' || /^\)\s+else\s+\($/i.test(line)) return { nodes, index, terminator: line };
      const grouped = /^if\s+(.+?)\s+\($/i.exec(line);
      if (grouped) {
        const thenBlock = parseBlock(body, index + 1);
        assert.ok(thenBlock.terminator, 'CFG_UNTERMINATED_IF_BLOCK'); index = thenBlock.index;
        let elseNodes = [];
        if (/^\)\s+else\s+\($/i.test(thenBlock.terminator)) {
          const elseBlock = parseBlock(body, index + 1); assert.equal(elseBlock.terminator, ')', 'CFG_UNTERMINATED_ELSE_BLOCK'); index = elseBlock.index; elseNodes = elseBlock.nodes;
        }
        nodes.push({ kind: 'if', condition: grouped[1], thenNodes: thenBlock.nodes, elseNodes }); continue;
      }
      const single = /^if\s+((?:not\s+)?errorlevel\s+\d+|(?:\/I\s+)?"[^"]*"=="[^"]*")\s+(.+)$/i.exec(line);
      if (single) { nodes.push({ kind: 'if', condition: single[1], thenNodes: [parseSimple(single[2])], elseNodes: [] }); continue; }
      nodes.push(parseSimple(line));
    }
    return { nodes, index: body.length, terminator: null };
  };
  const getLabel = name => {
    const label = labels.get(name.toLowerCase()); assert.ok(label, `CFG_MISSING_LABEL=${name}`);
    if (!label.nodes) {
      const parsed = parseBlock(label.lines); assert.equal(parsed.terminator, null, `CFG_UNEXPECTED_BLOCK_TERMINATOR=${label.name}`); label.nodes = parsed.nodes;
    }
    return label;
  };
  return { labels, getLabel };
}
function expandCfg(value, variables) { return value.replace(/%([A-Za-z][A-Za-z0-9_]*)%/g, (_, key) => variables[key.toUpperCase()] ?? ''); }
function expandCfgNode(node, variables) {
  if (node.kind === 'set') return { ...node, value: expandCfg(node.value, variables) };
  if (node.kind === 'if') return { ...node, condition: expandCfg(node.condition, variables), thenNodes: node.thenNodes.map(child => expandCfgNode(child, variables)), elseNodes: node.elseNodes.map(child => expandCfgNode(child, variables)) };
  return node;
}
function evaluateCfgCondition(condition, errorlevel) {
  let match = /^not\s+errorlevel\s+(\d+)$/i.exec(condition); if (match) return errorlevel < Number(match[1]);
  match = /^errorlevel\s+(\d+)$/i.exec(condition); if (match) return errorlevel >= Number(match[1]);
  match = /^(\/I\s+)?"([^"]*)"=="([^"]*)"$/i.exec(condition);
  if (match) return match[1] ? match[2].toLowerCase() === match[3].toLowerCase() : match[2] === match[3];
  throw new Error(`CFG_UNSUPPORTED_REACHABLE_CONDITION=${condition}`);
}
function literalLabelAssignments(cfg, name) {
  const label = cfg.getLabel(name);
  const values = {};
  for (const node of label.nodes) {
    if (node.kind === 'set') values[node.key] = node.value;
    else assert.equal(node.kind === 'exit' && node.code === 0, true, `CFG_NON_LITERAL_DEFAULT=${name}`);
  }
  return values;
}
function executeBatchCfg(cfg, entry, variables, injections = {}) {
  const state = { variables: { ...variables }, errorlevel: 0, callStack: [], pc: null, trace: [], steps: 0 };
  const labelCalls = new Map();
  const normalizedLabels = new Map();
  for (const [key, value] of Object.entries(injections.labels ?? {})) {
    const normalized = key.toLowerCase(); assert.ok(!normalizedLabels.has(normalized), `CFG_DUPLICATE_INJECTED_LABEL=${key}`); normalizedLabels.set(normalized, value);
  }
  const normalizedProviders = new Map();
  for (const [key, value] of Object.entries(injections.providers ?? {})) {
    const normalized = key.toLowerCase(); assert.ok(!normalizedProviders.has(normalized), `CFG_DUPLICATE_INJECTED_PROVIDER=${key}`); normalizedProviders.set(normalized, value);
  }
  const step = () => { state.steps += 1; if (state.steps > 512) throw new Error('CFG_STEP_BOUND_EXCEEDED'); };
  const injectedLabel = label => {
    const key = label.toLowerCase(); const values = normalizedLabels.get(key);
    if (values === undefined) return /^(AdapterPrivilegedPreflight|GasPreflight|FirebasePreflight|Confirm)$/i.test(label) ? 0 : null;
    const index = labelCalls.get(key) ?? 0; labelCalls.set(key, index + 1);
    const result = Array.isArray(values) ? (values[index] ?? 0) : values;
    assert.equal(Number.isInteger(result) && result >= 0 && result <= 255, true, `CFG_INVALID_INJECTED_ERRORLEVEL=${label}`); return result;
  };
  const injectedProvider = node => {
    const result = normalizedProviders.get(node.toLowerCase()) ?? (node === 'findstr' ? 1 : 0);
    assert.equal(Number.isInteger(result) && result >= 0 && result <= 255, true, `CFG_INVALID_INJECTED_ERRORLEVEL=${node}`); return result;
  };
  const runLabel = (name, via) => {
    const label = cfg.labels.get(name.toLowerCase()); if (!label) throw new Error(`CFG_MISSING_STATIC_TARGET=${name}`);
    if (state.callStack.length >= 32) throw new Error('CFG_CALL_STACK_BOUND_EXCEEDED');
    const injected = injectedLabel(label.name);
    state.trace.push(`${via}:${label.name}`);
    if (injected !== null) { state.errorlevel = injected; return injected; }
    const parsed = cfg.getLabel(label.name);
    state.callStack.push(parsed.name); const result = runNodes(parsed.nodes, parsed.name); state.callStack.pop(); return result;
  };
  const runNodes = (nodes, label) => {
    for (let index = 0; index < nodes.length; index += 1) {
      step(); state.pc = `${label}:${index}`; const node = nodes[index];
      if (node.kind === 'if') {
        const frozen = expandCfgNode(node, state.variables);
        const condition = evaluateCfgCondition(frozen.condition, state.errorlevel); state.trace.push(`if:${frozen.condition}:${condition}`);
        const result = runNodes(condition ? frozen.thenNodes : frozen.elseNodes, label);
        if (result !== null) return result;
      } else if (node.kind === 'set') {
        const frozen = expandCfgNode(node, state.variables); state.variables[frozen.key] = frozen.value; state.trace.push(`set:${frozen.key}=${frozen.value}`);
      } else if (node.kind === 'call') {
        state.errorlevel = runLabel(node.label, 'call');
      } else if (node.kind === 'goto') {
        return runLabel(node.label, 'goto');
      } else if (node.kind === 'exit') {
        const result = node.code ?? state.errorlevel; state.errorlevel = result; return result;
      } else if (node.kind === 'provider') {
        state.trace.push(`provider:${node.node}`); state.errorlevel = injectedProvider(node.node);
      } else if (node.kind === 'noop' || node.kind === 'echo') {
        // Local output and cleanup commands do not affect the modeled CFG state.
      } else if (node.kind === 'unsupported') {
        throw new Error(`CFG_UNSUPPORTED_REACHABLE_COMMAND=${state.pc}:${node.raw}:ERRORLEVEL=${state.errorlevel}:TRACE=${state.trace.join('|')}`);
      }
    }
    return null;
  };
  const result = runLabel(entry, 'entry'); state.errorlevel = result ?? state.errorlevel; return state;
}
export function interpretBatchCfgEvidence(source, entry, variables = {}, injections = {}) { return executeBatchCfg(parseBatchCfg(source), entry, variables, injections); }
export function deriveV10GuardBehaviorEvidence(base = root, sourceOverrides = {}) {
  const engine = sourceOverrides.engine ?? read(path.join(base, '_guard', 'PROJECT_GUARD_ENGINE.bat'));
  const adapter = sourceOverrides.adapter ?? read(path.join(base, '_guard', 'deploy', 'DEPLOY_GOOGLE_APPS_FIREBASE.bat'));
  const engineStartup = engine.slice(0, engine.indexOf('\r\n:Help\r\n') === -1 ? engine.indexOf('\n:Help\n') : engine.indexOf('\r\n:Help\r\n'));
  const adapterStartup = adapter.slice(0, adapter.indexOf('\r\n:Doctor\r\n') === -1 ? adapter.indexOf('\n:Doctor\n') : adapter.indexOf('\r\n:Doctor\r\n'));
  const deployPreflight = batchLabelBody(adapter, ':AdapterPrivilegedPreflight');
  const recheck = batchLabelBody(engine, ':RecheckPushBinding');
  const deployGas = batchLabelBody(adapter, ':DeployGas');
  const deployFirebase = batchLabelBody(adapter, ':DeployFirebase');
  const startup = source => ({ capture: source.indexOf('call :CaptureOverrideEnvironment'), sanitize: source.indexOf('call :SanitizeFailureOutputDefaults'), reject: source.indexOf('call :RejectOverrideEnvironment'), argument: source.indexOf('set "GUARD_CONFIG_ARGUMENT=%~'), bind: source.indexOf('call :BindCanonicalConfig'), config: source.indexOf('call "%GUARD_CONFIG%"') });
  const engineStart = startup(engineStartup); const adapterStart = startup(adapterStartup);
  for (const current of [engineStart, adapterStart]) {
    assert.ok(current.capture !== -1 && current.sanitize !== -1 && current.reject !== -1 && current.argument !== -1 && current.bind !== -1 && current.config !== -1, 'STARTUP_FLOW_INCOMPLETE');
    assert.ok(current.capture < current.sanitize && current.sanitize < current.reject && current.reject < current.argument && current.argument < current.bind && current.bind < current.config, 'STARTUP_ORDER_INVALID');
  }
  const engineCfg = parseBatchCfg(engine); const adapterCfg = parseBatchCfg(adapter);
  const failureDefaults = (cfg, source, keys) => {
    const defaults = literalLabelAssignments(cfg, 'SanitizeFailureOutputDefaults');
    for (const key of keys) assert.ok(Object.hasOwn(defaults, key), `SANITIZED_FAILURE_DEFAULT_REQUIRED=${key}`);
    assert.doesNotMatch(batchLabelBody(source, ':RejectOverrideEnvironment'), /%%V/, 'OVERRIDE_REJECTION_MUST_NOT_ECHO_INHERITED_EVIDENCE');
    return Object.fromEntries(keys.map(key => [key, defaults[key]]));
  };
  const engineFailureDefaults = failureDefaults(engineCfg, engine, ['PROJECT_KEY', 'ACTION', 'RELEVANT_LOG', 'PUSH_RUN', 'PUSH_OUTCOME', 'DEPLOY_RUN', 'NEW_VERSION_CREATED', 'HTTP_PROBE_RUN', 'QUARANTINE_STATUS']);
  const adapterFailureDefaults = failureDefaults(adapterCfg, adapter, ['PROJECT_KEY', 'ADAPTER_ACTION', 'DEPLOY_TARGET', 'RELEVANT_LOG', 'PUSH_RUN', 'DEPLOY_RUN', 'NEW_VERSION_CREATED', 'GAS_PUSH_OUTCOME', 'GAS_DEPLOY_OUTCOME', 'FIREBASE_DEPLOY_OUTCOME', 'HTTP_PROBE_RUN', 'QUARANTINE_STATUS']);
  const engineOverrides = capturedOverrideKeys(engine); const adapterOverrides = capturedOverrideKeys(adapter);
  for (const key of ['GIT_INDEX_FILE', 'GIT_CONFIG_PARAMETERS']) {
    assert.ok(engineOverrides.has(key), `ENGINE_OVERRIDE_CAPTURE_REQUIRED=${key}`);
    assert.ok(adapterOverrides.has(key), `ADAPTER_OVERRIDE_CAPTURE_REQUIRED=${key}`);
  }
  const firstService = Math.min(...['git fetch origin --prune', 'call :RequireTool', 'clasp.cmd', 'firebase.cmd', 'gcloud.cmd'].map(token => { const index = deployPreflight.indexOf(token); return index === -1 ? Number.MAX_SAFE_INTEGER : index; }));
  const porcelain = deployPreflight.indexOf('git status --porcelain=v1 -z --untracked-files=all');
  assert.ok(porcelain !== -1 && porcelain < firstService, 'UNTRACKED_PREFLIGHT_BEFORE_SERVICE_REQUIRED');
  for (const token of ['[IO.File]::ReadAllBytes', '.Split([char]0)', 'BLOCKED_DEPLOY_UNTRACKED_FILES_PRESENT', 'BLOCKED_DEPLOY_STATUS_PORCELAIN_INVALID']) assert.notEqual(deployPreflight.indexOf(token), -1, `PORCELAIN_PREFLIGHT_REQUIRED=${token}`);
  const recheckExitBranches = [...recheck.matchAll(/if errorlevel 1 \(popd >nul & exit \/b 1\)/g)].length;
  const recheckFailurePops = [...recheck.matchAll(/call :Fail [^\r\n]+\r?\n  popd >nul\r?\n  exit \/b 1/g)].length;
  assert.equal(recheckExitBranches, 5, 'RECHECK_EARLY_FAILURE_POP_COUNT'); assert.equal(recheckFailurePops, 3, 'RECHECK_DRIFT_FAILURE_POP_COUNT'); assert.match(recheck, /popd >nul\r?\nexit \/b 0/, 'RECHECK_SUCCESS_POP_REQUIRED');
  const runAllTarget = injections => executeBatchCfg(adapterCfg, 'Deploy', { ...adapterFailureDefaults, DEPLOY_TARGET: 'all' }, injections);
  const success = runAllTarget({});
  const firstGas = success.trace.indexOf('call:GasPreflight');
  assert.ok(success.trace.indexOf('call:AdapterPrivilegedPreflight') !== -1 && success.trace.indexOf('call:AdapterPrivilegedPreflight') < firstGas, 'CFG_DEPLOY_ALL_REPOSITORY_PREFLIGHT_REQUIRED');
  const partialState = success.trace.lastIndexOf('set:DEPLOY_RUN=PARTIAL_GAS_CONFIRMED_FIREBASE_NOT_CONFIRMED');
  const firebaseEntry = success.trace.indexOf('call:DeployFirebase', partialState + 1);
  const firebaseRepositoryPreflight = success.trace.indexOf('call:AdapterPrivilegedPreflight', firebaseEntry + 1);
  const firebasePreflight = success.trace.indexOf('call:FirebasePreflight', firebaseRepositoryPreflight + 1);
  const immediateRecheck = success.trace.indexOf('call:AdapterPrivilegedPreflight', firebasePreflight + 1);
  const attempted = success.trace.indexOf('set:FIREBASE_DEPLOY_OUTCOME=ATTEMPTED', immediateRecheck + 1);
  const firebaseCommand = success.trace.indexOf('provider:firebase-deploy', attempted + 1);
  for (const [name, index] of [['post-gas-partial-state', partialState], ['deploy-firebase-call', firebaseEntry], ['firebase-repository-preflight', firebaseRepositoryPreflight], ['firebase-service-preflight', firebasePreflight], ['firebase-immediate-recheck', immediateRecheck], ['firebase-attempted', attempted], ['firebase-provider-command', firebaseCommand]]) assert.ok(index !== -1, `CFG_FIREBASE_RECHECK_FLOW_REQUIRED=${name}`);
  assert.ok(partialState < firebaseEntry && firebaseEntry < firebaseRepositoryPreflight && firebaseRepositoryPreflight < firebasePreflight && firebasePreflight < immediateRecheck && immediateRecheck < attempted && attempted < firebaseCommand, 'CFG_FIREBASE_RECHECK_ORDER_INVALID');
  const result = state => ({ PUSH_RUN: state.variables.PUSH_RUN, DEPLOY_RUN: state.variables.DEPLOY_RUN, NEW_VERSION_CREATED: state.variables.NEW_VERSION_CREATED, GAS_PUSH_OUTCOME: state.variables.GAS_PUSH_OUTCOME, GAS_DEPLOY_OUTCOME: state.variables.GAS_DEPLOY_OUTCOME, FIREBASE_DEPLOY_OUTCOME: state.variables.FIREBASE_DEPLOY_OUTCOME });
  const startupResult = (overrides, keys, defaults) => Object.keys(overrides || {}).some(key => keys.has(key.toUpperCase())) ? { status: 'FAILED', gate: 'BLOCKED_OVERRIDE_ENVIRONMENT', configExecuted: false, defaults } : { status: 'PASS', canonicalConfigBound: true, configExecuted: true };
  return {
    startup: inherited => ({ engine: startupResult(inherited?.engine, engineOverrides, engineFailureDefaults), adapter: startupResult(inherited?.adapter, adapterOverrides, adapterFailureDefaults) }),
    executeAllTarget: injections => { const state = runAllTarget(injections); return { state, result: result(state) }; },
    allTargetResult: injections => result(runAllTarget(injections)),
    recheckPushd: branch => ({ entered: 1, exited: branch === 'success' || branch === 'drift' || branch === 'early-failure' ? 1 : 0 })
  };
}
export const deriveV9GuardBehaviorEvidence = deriveV10GuardBehaviorEvidence;
export const deriveV7GuardBehaviorModel = deriveV10GuardBehaviorEvidence;
function guardBehaviorStatic(base = root) { deriveV10GuardBehaviorEvidence(base); }
export function checkStaticGovernance(base = root) { activeContract(base); helperStatic(base); focusedSource(base); aggregateStatic(base); deployStatic(base); projectRootStatic(base); guardBehaviorStatic(base); return true; }
export function parsePorcelainV1Z(buffer) {
  const fields = Buffer.from(buffer).toString('utf8').split('\0'); const entries = [];
  for (let index = 0; index < fields.length - 1; index += 1) {
    const raw = fields[index]; if (!raw) continue;
    assert.ok(raw.length >= 3 && raw[2] === ' ', `PORCELAIN_ENTRY_INVALID=${JSON.stringify(raw)}`);
    const x = raw[0]; const y = raw[1]; const paths = [raw.slice(3).replaceAll('\\', '/')];
    if (x === 'R' || x === 'C' || y === 'R' || y === 'C') { index += 1; assert.ok(fields[index] !== undefined && fields[index] !== '', 'PORCELAIN_RENAME_PATH_MISSING'); paths.push(fields[index].replaceAll('\\', '/')); }
    entries.push({ x, y, paths });
  }
  return entries;
}
export function assertV6ScopeEntries(entries) {
  for (const entry of entries) {
    assert.equal(entry.x === ' ' || entry.x === '?', true, `STAGED_CHANGE=${entry.paths.join('|')}`);
    for (const file of entry.paths) {
      assert.notEqual(file, '_guard/deploy/output.txt', 'FORBIDDEN_DEPLOY_OUTPUT_RESIDUE');
      assert.notEqual(file, '_guard/deploy/safe-output.txt', 'FORBIDDEN_DEPLOY_SAFE_OUTPUT_RESIDUE');
      assert.ok(allowed.has(file), `UNAUTHORIZED_PATH_CHANGE=${file}`);
    }
  }
  return true;
}
export function assertV6ScopeGate(base = root) {
  const entries = parsePorcelainV1Z(execFileSync('git', ['status', '--porcelain=v1', '-z', '--untracked-files=all'], { cwd: base }));
  assertV6ScopeEntries(entries);
  assert.equal(execFileSync('git', ['diff', '--cached', '--name-only'], { cwd: base, encoding: 'utf8' }).trim(), '', 'STAGING_NONEMPTY');
  const file = 'Operator_Entrypoints.js'; assert.equal(sha(read(path.join(base, file))), sha(execFileSync('git', ['show', `HEAD:${file}`], { cwd: base, encoding: 'utf8' })), `${file} changed`);
  return true;
}
function focused(base = root) { const run = spawnSync(process.execPath, ['--test', 'tests/unit/ai-governance-bootstrap.test.mjs'], { cwd: base, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }); const out = (run.stdout || '') + (run.stderr || ''); const tap = parseTap(out); assert.equal(run.status, 0, out); assert.deepEqual(tap, { tests: 17, pass: 17, fail: 0, skip: 0, todo: 0, cancelled: 0 }, out); for (const letter of matrix) assert.match(out, new RegExp(`Subtest: ${letter} `), `missing matrix ${letter}`); return tap; }
export function checkGovernance(receiptPath) { const verified = validateControllerInspectionReceipt(receiptPath); assertV6ScopeGate(verified.candidateRoot); checkStaticGovernance(verified.candidateRoot); const tap = focused(verified.candidateRoot); return { tap, status: 'PASS' }; }
function cliValue(name, argv = process.argv) {
  const positions = argv.reduce((found, value, index) => value === name ? [...found, index] : found, []);
  if (positions.length !== 1 || positions[0] === argv.length - 1) receiptFailure('RECEIPT_CLI_ARGUMENT_INVALID');
  const value = argv[positions[0] + 1];
  if (typeof value !== 'string' || value.trim() === '') receiptFailure('RECEIPT_CLI_ARGUMENT_INVALID');
  return value;
}
export function resolveControllerReceiptPath(argv = process.argv, environment = process.env) {
  const cliPresent = argv.includes('--controller-receipt');
  const environmentPresent = Object.hasOwn(environment, controllerReceiptEnvironmentName);
  if (cliPresent && environmentPresent) receiptFailure('RECEIPT_SOURCE_AMBIGUOUS');
  if (cliPresent) return cliValue('--controller-receipt', argv);
  if (!environmentPresent) receiptFailure('RECEIPT_REQUIRED');
  const value = environment[controllerReceiptEnvironmentName];
  if (typeof value !== 'string' || value.trim() === '') receiptFailure('RECEIPT_ENVIRONMENT_EMPTY');
  return value;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--scope-only')) { assertV6ScopeGate(root); console.log('SGDS_V6_SCOPE_GATE=PASS'); }
  else if (process.argv.includes('--create-controller-inspection-receipt')) {
    const receipt = createControllerInspectionReceipt({ receiptPath: cliValue('--receipt'), isolationManifestPath: cliValue('--isolation-manifest') });
    console.log(`CONTROLLER_INSPECTION_RECEIPT=CREATED ISSUED_UTC_MS=${receipt.issued_utc_ms}`);
  }
  else { const r = checkGovernance(resolveControllerReceiptPath()); console.log(`AI_GOVERNANCE_BOOTSTRAP_CHECK=PASS TESTS=${r.tap.tests} PASS=${r.tap.pass} FAIL=${r.tap.fail} SKIP=${r.tap.skip} TODO=${r.tap.todo}`); }
}
