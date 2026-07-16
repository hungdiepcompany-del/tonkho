#!/usr/bin/env node
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export const D5J_OWNER_APPROVAL = 'OWNER_APPROVE_D5J_ONE_JOB_PRODUCTION_FIRESTORE_SHADOW_WRITE';
export const D5J_SYNTHETIC_SEED = 'SGDS_D5J_SYNTHETIC_SHADOW_SMOKE_V1';
export const D5J_RUNNER_MODES = Object.freeze(['--preflight', '--dry-run', '--execute', '--verify']);
export const D5J_GCLOUD_CONFIGURATION = 'sgds-hungdiep';
export const D5J_FORBIDDEN_PROJECT_PATTERNS = Object.freeze([/^demo-/i, /^local-/i, /sanxuat-lt/i, /^noble-nation-497005-f1$/i]);
export const D5J_FORBIDDEN_ACCOUNT_PATTERNS = Object.freeze([/longthaisteel[.]com/i]);
export const D5J_EVENT_TYPES = Object.freeze([
  'SHADOW_JOB_CREATED',
  'SHADOW_COMMIT_PLAN_SAVED',
  'SHADOW_RECONCILIATION_RECORDED',
  'SHADOW_EVALUATION_COMPLETED'
]);

const D5J_SCHEMA_VERSION = 'SGDS_FIRESTORE_SHADOW_SCHEMA_V1';
const D5J_REPORT_SCHEMA_VERSION = 'SGDS_FIRESTORE_SHADOW_REPORT_V1';
const D5J_EVENT_SCHEMA_VERSION = 'SGDS_FIRESTORE_SHADOW_EVENT_V1';
const D5J_FIXED_TIME = '2026-07-16T00:00:00.000Z';

export function loadD5JGasContracts(rootDir = process.cwd()) {
  const context = vm.createContext({ console });
  const files = [
    'durableReconciliation.js',
    'firestoreShadowStateValidator.js',
    'firestoreDurableJobStore.js',
    'durableShadowStateIntegration.js'
  ];
  for (const file of files) {
    const full = path.join(rootDir, file);
    if (fs.existsSync(full)) vm.runInContext(fs.readFileSync(full, 'utf8'), context, { filename: file, timeout: 1000 });
  }
  vm.runInContext(`
    globalThis.__d5jExports = {
      createFirestoreShadowStateValidator: typeof createFirestoreShadowStateValidator === 'undefined' ? undefined : createFirestoreShadowStateValidator,
      reconcileDurableInvoiceJobReportOnly: typeof reconcileDurableInvoiceJobReportOnly === 'undefined' ? undefined : reconcileDurableInvoiceJobReportOnly,
      createDurableInvoiceJobStore: typeof createDurableInvoiceJobStore === 'undefined' ? undefined : createDurableInvoiceJobStore,
      createDurableShadowStateIntegration: typeof createDurableShadowStateIntegration === 'undefined' ? undefined : createDurableShadowStateIntegration
    };
  `, context, { filename: 'd5j-export-map', timeout: 500 });
  const exports = context.__d5jExports;
  if (typeof exports.createFirestoreShadowStateValidator !== 'function') throw d5jError('D5J_VALIDATOR_NOT_AVAILABLE');
  if (typeof exports.reconcileDurableInvoiceJobReportOnly !== 'function') throw d5jError('D5J_REPORT_ONLY_RECONCILER_NOT_AVAILABLE');
  if (typeof exports.createDurableInvoiceJobStore !== 'function') throw d5jError('D5J_D2_STORE_NOT_AVAILABLE');
  if (typeof exports.createDurableShadowStateIntegration !== 'function') throw d5jError('D5J_D5E_INTEGRATION_NOT_AVAILABLE');
  return exports;
}

export function validateD5JEnvironment(env = process.env, mode = '--preflight', commandRunner = defaultCommandRunner) {
  if (!D5J_RUNNER_MODES.includes(mode)) throw d5jError('D5J_MODE_INVALID');
  const projectId = safeString(env.SGDS_D5J_PROJECT_ID);
  const databaseId = safeString(env.SGDS_D5J_DATABASE_ID);
  const expectedPrincipal = safeString(env.SGDS_D5J_EXPECTED_PRINCIPAL);
  if (!projectId) throw d5jError('D5J_PROJECT_ID_REQUIRED');
  if (!databaseId) throw d5jError('D5J_DATABASE_ID_REQUIRED');
  if (!expectedPrincipal) throw d5jError('D5J_EXPECTED_PRINCIPAL_REQUIRED');
  if (env.FIRESTORE_EMULATOR_HOST) throw d5jError('D5J_EMULATOR_HOST_DENIED');
  if (D5J_FORBIDDEN_PROJECT_PATTERNS.some(pattern => pattern.test(projectId))) throw d5jError('D5J_PROJECT_ID_DENIED');
  if (D5J_FORBIDDEN_ACCOUNT_PATTERNS.some(pattern => pattern.test(expectedPrincipal))) throw d5jError('D5J_EXPECTED_PRINCIPAL_DENIED');
  if (mode === '--execute' && safeString(env.SGDS_D5J_OWNER_APPROVAL) !== D5J_OWNER_APPROVAL) throw d5jError('D5J_OWNER_APPROVAL_REQUIRED');

  const activeAccount = safeCommandValue(commandRunner('gcloud.cmd', ['config', 'get-value', 'account', '--configuration=sgds-hungdiep']));
  const activeProject = safeCommandValue(commandRunner('gcloud.cmd', ['config', 'get-value', 'project', '--configuration=sgds-hungdiep']));
  if (!activeAccount) throw d5jError('D5J_ACTIVE_ACCOUNT_UNCONFIRMED');
  if (D5J_FORBIDDEN_ACCOUNT_PATTERNS.some(pattern => pattern.test(activeAccount))) throw d5jError('D5J_ACCOUNT_CONTEXT_MISMATCH');
  if (activeAccount !== expectedPrincipal) throw d5jError('D5J_PRINCIPAL_MISMATCH');
  if (activeProject !== projectId) throw d5jError('D5J_PROJECT_CONTEXT_MISMATCH');

  return {
    projectId,
    databaseId,
    expectedPrincipal,
    activeAccount,
    activeProject,
    authMode: 'GCLOUD_CONFIGURATION_SGDS_HUNGDIEP',
    gcloudConfiguration: D5J_GCLOUD_CONFIGURATION,
    authPrincipalType: activeAccount.includes('@') ? 'USER_ACCOUNT' : 'SERVICE_IDENTITY',
    authPrincipalSafeName: activeAccount
  };
}

export function buildD5JSyntheticPayload({ projectId, databaseId, validator }) {
  const base = `${D5J_SYNTHETIC_SEED}|${projectId}|${databaseId}|${D5J_SCHEMA_VERSION}`;
  const jobHash = sha256Hex(base);
  const jobId = `sgds-d5j-${jobHash.slice(0, 24)}`;
  const invoiceIdentityHash = sha256Hex(`${base}|invoiceIdentity`);
  const sourceReferenceHash = sha256Hex(`${base}|sourceReference`);
  const lineIdentityHash = sha256Hex(`${base}|lineIdentity`);
  const commitPlanBase = {
    version: 'D5J_SYNTHETIC_COMMIT_PLAN_V1',
    jobId,
    executionMode: 'SHADOW',
    productionMutationAllowed: false,
    syntheticOnly: true,
    wouldMutateSteps: [],
    expectedLineCount: 0,
    lineIdentityHashes: [lineIdentityHash],
    sourceReferenceHashes: [sourceReferenceHash],
    inputSnapshotVersion: D5J_SYNTHETIC_SEED
  };
  const commitPlanHash = sha256Hex(stableJson(commitPlanBase));
  const commitPlan = { ...commitPlanBase, commitPlanHash };
  const job = {
    schemaVersion: D5J_SCHEMA_VERSION,
    jobId,
    status: 'SHADOW_READY',
    shadowEvaluationStatus: 'SHADOW_READY',
    executionMode: 'SHADOW',
    productionMutationAllowed: false,
    invoiceIdentityHash,
    sourceReferenceHashes: [sourceReferenceHash],
    sourceTypes: ['SMOKE_SYNTHETIC'],
    commitPlan,
    commitPlanHash,
    expectedLineCount: 0,
    version: 1,
    createdAt: D5J_FIXED_TIME,
    updatedAt: D5J_FIXED_TIME,
    lastObservedAt: D5J_FIXED_TIME,
    latestReconciliationStatus: 'CONSISTENT',
    latestFindingCodes: [],
    latestReconciliationReportId: `rpt-${jobHash.slice(0, 16)}`,
    retentionClass: 'SMOKE_AUDIT'
  };
  const events = D5J_EVENT_TYPES.map((eventType, index) => ({
    schemaVersion: D5J_EVENT_SCHEMA_VERSION,
    eventId: `evt-d5j-${String(index + 1).padStart(2, '0')}-${sha256Hex(`${jobId}|${eventType}`).slice(0, 12)}`,
    jobId,
    eventType,
    idempotencyKey: sha256Hex(`${jobId}|${eventType}|${D5J_SYNTHETIC_SEED}`).slice(0, 24),
    actorType: 'SYSTEM_SMOKE',
    occurredAt: D5J_FIXED_TIME,
    safeDetails: {
      code: eventType,
      count: String(index + 1),
      jobHashPrefix: jobHash.slice(0, 12),
      status: 'SHADOW_READY'
    }
  }));
  const report = {
    schemaVersion: D5J_REPORT_SCHEMA_VERSION,
    reportId: job.latestReconciliationReportId,
    jobId,
    jobVersion: 1,
    status: 'CONSISTENT',
    findingCount: 0,
    findingCodes: [],
    findings: [],
    blockerCount: 0,
    repairPolicy: 'REPORT_ONLY',
    inputSnapshotVersion: D5J_SYNTHETIC_SEED,
    executionMode: 'SHADOW',
    generatedAt: D5J_FIXED_TIME
  };

  const checkedJob = validator.validateJobDocument(job);
  const checkedEvents = events.map(event => validator.validateAuditEvent(event));
  const checkedReport = validator.validateReconciliationReport(report);
  return {
    jobId,
    jobHash,
    commitPlanHash,
    job: checkedJob,
    events: checkedEvents,
    report: checkedReport,
    targetPaths: {
      job: `invoiceJobs/${jobId}`,
      events: checkedEvents.map(event => `invoiceJobs/${jobId}/events/${event.eventId}`),
      report: `invoiceJobs/${jobId}/reconciliationReports/${checkedReport.reportId}`
    }
  };
}

export function createD5JFirestoreClient({ projectId, databaseId, fetchImpl = globalThis.fetch, tokenProvider }) {
  if (typeof fetchImpl !== 'function') throw d5jError('D5J_FETCH_REQUIRED');
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/${encodeURIComponent(databaseId)}`;

  async function request(method, suffix, body) {
    const token = await tokenProvider();
    const response = await fetchImpl(`${baseUrl}${suffix}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: body == null ? undefined : JSON.stringify(body)
    });
    if (response.status === 404) return null;
    const text = await response.text();
    const parsed = text ? JSON.parse(text) : {};
    if (!response.ok) {
      const error = d5jError(`D5J_FIRESTORE_${response.status}`);
      error.details = parsed && parsed.error && parsed.error.status;
      throw error;
    }
    return parsed;
  }

  return {
    async getDocument(relativePath) {
      return request('GET', `/documents/${relativePath}`, null);
    },
    async commitCreates(documents) {
      const writes = documents.map(doc => ({
        update: {
          name: `projects/${projectId}/databases/${databaseId}/documents/${doc.path}`,
          fields: toFirestoreFields(doc.body)
        },
        currentDocument: { exists: false }
      }));
      return request('POST', '/documents:commit', { writes });
    }
  };
}

export async function verifyD5JDatabaseAndRules({ projectId, databaseId, fetchImpl = globalThis.fetch, tokenProvider }) {
  const token = await tokenProvider();
  const headers = { Authorization: `Bearer ${token}` };
  const databaseUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/${encodeURIComponent(databaseId)}`;
  const databaseResponse = await fetchImpl(databaseUrl, { headers });
  if (!databaseResponse.ok) throw d5jError('D5J_DATABASE_UNCONFIRMED');
  const database = await databaseResponse.json();
  if (safeString(database.name) && !safeString(database.name).endsWith(`/databases/${databaseId}`)) throw d5jError('D5J_DATABASE_MISMATCH');
  const rulesReleaseUrl = `https://firebaserules.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/releases/cloud.firestore`;
  const releaseResponse = await fetchImpl(rulesReleaseUrl, { headers });
  if (!releaseResponse.ok) throw d5jError('D5J_DEPLOYED_RULES_UNVERIFIED');
  const release = await releaseResponse.json();
  if (!release.rulesetName) throw d5jError('D5J_DEPLOYED_RULES_UNVERIFIED');
  const rulesetResponse = await fetchImpl(`https://firebaserules.googleapis.com/v1/${release.rulesetName}`, { headers });
  if (!rulesetResponse.ok) throw d5jError('D5J_DEPLOYED_RULES_UNVERIFIED');
  const ruleset = await rulesetResponse.json();
  const rulesText = JSON.stringify(ruleset);
  if (!/invoiceJobs/.test(rulesText) || !/allow\s+read,\s*write:\s*if\s+false|allow\s+create,\s*update,\s*delete:\s*if\s+false|sgdsD5fD5iClientWritesDenied/.test(rulesText)) {
    throw d5jError('D5J_DEPLOYED_RULES_UNSAFE');
  }
  return {
    databaseExists: true,
    databaseId,
    databaseLocation: safeString(database.locationId || database.location || 'UNKNOWN'),
    deployedRulesVerified: true,
    anonymousReadPolicy: 'DENY',
    anonymousWritePolicy: 'DENY',
    clientWritePolicy: 'DENY'
  };
}

export async function inspectD5JExistingTree(client, payload) {
  const jobDoc = await client.getDocument(payload.targetPaths.job);
  const eventDocs = [];
  for (const eventPath of payload.targetPaths.events) eventDocs.push(await client.getDocument(eventPath));
  const reportDoc = await client.getDocument(payload.targetPaths.report);
  const presentCount = [jobDoc, reportDoc, ...eventDocs].filter(Boolean).length;
  if (presentCount === 0) return { state: 'ABSENT', presentCount };
  if (presentCount !== 2 + payload.events.length) return { state: 'PARTIAL_CONFLICT', presentCount };
  const currentJob = fromFirestoreDocument(jobDoc);
  const currentReport = fromFirestoreDocument(reportDoc);
  const currentEvents = eventDocs.map(fromFirestoreDocument);
  const expectedHash = sha256Hex(stableJson({ job: payload.job, report: payload.report, events: payload.events }));
  const actualHash = sha256Hex(stableJson({ job: currentJob, report: currentReport, events: currentEvents }));
  return {
    state: expectedHash === actualHash ? 'MATCH' : 'CONFLICT',
    presentCount,
    expectedHash,
    actualHash,
    currentJob,
    currentReport,
    currentEvents
  };
}

export async function runD5JMode({ mode, env = process.env, rootDir = process.cwd(), commandRunner = defaultCommandRunner, fetchImpl = globalThis.fetch, tokenProvider } = {}) {
  const contracts = loadD5JGasContracts(rootDir);
  const validator = contracts.createFirestoreShadowStateValidator();
  const environment = validateD5JEnvironment(env, mode, commandRunner);
  const payload = buildD5JSyntheticPayload({ projectId: environment.projectId, databaseId: environment.databaseId, validator });
  const defaultTokenProvider = () => safeCommandValue(commandRunner('gcloud.cmd', ['auth', 'print-access-token', '--configuration=sgds-hungdiep']));
  const getToken = tokenProvider || defaultTokenProvider;

  const summary = {
    mode,
    ownerApproval: mode === '--execute' ? 'VALID' : 'NOT_REQUIRED_FOR_NON_EXECUTE',
    confirmedProjectId: environment.projectId,
    confirmedDatabaseId: environment.databaseId,
    confirmedPrincipal: environment.authPrincipalSafeName,
    deterministicJobId: 'YES',
    safeJobIdOrHashPrefix: payload.jobId,
    targetJobPath: payload.targetPaths.job,
    targetEventCount: payload.events.length,
    targetReportCount: 1,
    validatorResult: 'PASS',
    forbiddenFieldCount: 0,
    productionWrite: 'NONE',
    gmailApiCallCount: 0,
    driveApiCallCount: 0,
    sheetsApiCallCount: 0,
    gasExecutionCount: 0
  };

  if (mode === '--preflight') return { ...summary, preflightResult: 'PASS_LOCAL_ENV_GUARD' };
  if (mode === '--dry-run') return { ...summary, dryRunStatus: 'PASS', productionWrite: 'NONE' };

  const identity = await verifyD5JDatabaseAndRules({
    projectId: environment.projectId,
    databaseId: environment.databaseId,
    fetchImpl,
    tokenProvider: getToken
  });
  const client = createD5JFirestoreClient({ projectId: environment.projectId, databaseId: environment.databaseId, fetchImpl, tokenProvider: getToken });
  const before = await inspectD5JExistingTree(client, payload);

  if (mode === '--verify') {
    if (before.state !== 'MATCH') throw d5jError(before.state === 'ABSENT' ? 'D5J_JOB_NOT_FOUND' : 'D5J_JOB_TREE_CONFLICT');
    return buildD5JVerifyResult(summary, identity, payload, before);
  }

  if (before.state === 'CONFLICT' || before.state === 'PARTIAL_CONFLICT') throw d5jError('D5J_EXISTING_SMOKE_JOB_CONFLICT');
  if (before.state === 'MATCH') {
    return {
      ...buildD5JVerifyResult(summary, identity, payload, before),
      executionStatus: 'PASS_IDEMPOTENT_REUSE',
      newJobCreated: 'NO',
      jobDocumentCountChange: 0,
      eventDocumentCountChange: 0,
      reportDocumentCountChange: 0,
      commitPlanMutated: 'NO',
      createdAtMutated: 'NO',
      versionUnexpectedlyChanged: 'NO',
      productionWrite: 'NONE'
    };
  }

  await client.commitCreates([
    { path: payload.targetPaths.job, body: payload.job },
    ...payload.events.map((event, index) => ({ path: payload.targetPaths.events[index], body: event })),
    { path: payload.targetPaths.report, body: payload.report }
  ]);
  const after = await inspectD5JExistingTree(client, payload);
  if (after.state !== 'MATCH') throw d5jError('D5J_READ_BACK_MISMATCH');
  return {
    ...buildD5JVerifyResult(summary, identity, payload, after),
    executionStatus: 'PASS_ONE_JOB_CREATED',
    productionWrite: 'ONE_DETERMINISTIC_JOB_TREE_ONLY',
    productionFirestoreWriteCount: 2 + payload.events.length
  };
}

function buildD5JVerifyResult(summary, identity, payload, tree) {
  return {
    ...summary,
    ...identity,
    readBackStatus: 'PASS',
    jobFound: 'YES',
    jobIdMatch: 'YES',
    jobHashMatch: 'YES',
    commitPlanHashMatch: 'YES',
    reportPolicy: 'REPORT_ONLY',
    findingCount: 0,
    jobTreeCount: 1,
    mainJobDocumentCount: 1,
    eventDocumentCount: payload.events.length,
    reconciliationReportCount: 1,
    rawGmailIdPersisted: 'NO',
    rawDriveIdPersisted: 'NO',
    emailPersisted: 'NO',
    taxCodePersisted: 'NO',
    invoiceDataPersisted: 'NO',
    xmlPersisted: 'NO',
    pdfPersisted: 'NO',
    sourcePayloadPersisted: 'NO'
  };
}

function defaultCommandRunner(command, args) {
  return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function toFirestoreFields(object) {
  const fields = {};
  for (const [key, value] of Object.entries(object || {})) fields[key] = toFirestoreValue(value);
  return fields;
}

function toFirestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (Number.isInteger(value)) return { integerValue: String(value) };
  if (typeof value === 'number') return { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toFirestoreValue) } };
  if (typeof value === 'object') return { mapValue: { fields: toFirestoreFields(value) } };
  return { stringValue: String(value) };
}

function fromFirestoreDocument(document) {
  const fields = (document && document.fields) || {};
  const out = {};
  for (const [key, value] of Object.entries(fields)) out[key] = fromFirestoreValue(value);
  return out;
}

function fromFirestoreValue(value) {
  if (!value || Object.prototype.hasOwnProperty.call(value, 'nullValue')) return null;
  if (Object.prototype.hasOwnProperty.call(value, 'stringValue')) return value.stringValue;
  if (Object.prototype.hasOwnProperty.call(value, 'booleanValue')) return value.booleanValue;
  if (Object.prototype.hasOwnProperty.call(value, 'integerValue')) return Number(value.integerValue);
  if (Object.prototype.hasOwnProperty.call(value, 'doubleValue')) return Number(value.doubleValue);
  if (Object.prototype.hasOwnProperty.call(value, 'arrayValue')) return ((value.arrayValue && value.arrayValue.values) || []).map(fromFirestoreValue);
  if (Object.prototype.hasOwnProperty.call(value, 'mapValue')) return fromFirestoreDocument({ fields: (value.mapValue && value.mapValue.fields) || {} });
  return '';
}

function stableJson(value) {
  function normalize(v) {
    if (Array.isArray(v)) return v.map(normalize);
    if (v && typeof v === 'object') {
      const out = {};
      Object.keys(v).sort().forEach(key => { out[key] = normalize(v[key]); });
      return out;
    }
    return v;
  }
  return JSON.stringify(normalize(value));
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function safeString(value) {
  return value == null ? '' : String(value).trim();
}

function safeCommandValue(value) {
  return safeString(String(value || '').split(/\r?\n/).filter(line => line && !/^WARNING:/.test(line)).pop() || '');
}

function d5jError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function sanitizeOutput(result) {
  return JSON.stringify(result, null, 2).replace(/ya29[.][A-Za-z0-9_-]+/g, 'REDACTED_TOKEN');
}

async function main() {
  const mode = process.argv.slice(2).find(arg => D5J_RUNNER_MODES.includes(arg));
  if (!mode) throw d5jError('D5J_MODE_REQUIRED');
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const result = await runD5JMode({ mode, rootDir });
  console.log(sanitizeOutput(result));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(JSON.stringify({
      status: 'BLOCKED',
      code: error && error.code ? error.code : 'D5J_UNKNOWN_ERROR',
      message: error && error.code ? error.code : 'D5J_UNKNOWN_ERROR'
    }));
    process.exit(1);
  });
}
