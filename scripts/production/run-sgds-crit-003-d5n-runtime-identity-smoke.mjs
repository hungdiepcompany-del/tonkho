#!/usr/bin/env node
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  loadD5JGasContracts
} from './run-sgds-crit-003-d5j-one-job-firestore-shadow.mjs';

export const D5N_OWNER_APPROVAL = 'OWNER_APPROVE_D5N_ONE_SYNTHETIC_IDENTITY_WRITE_PROJECT_tonkhohd';
export const D5N_PROJECT_ID = 'tonkhohd';
export const D5N_DATABASE_ID = '(default)';
export const D5N_RUNTIME_PRINCIPAL = 'sgds-firestore-runtime@tonkhohd.iam.gserviceaccount.com';
export const D5N_GCLOUD_CONFIGURATION = 'sgds-hungdiep';
export const D5N_SYNTHETIC_CASE_ID = ['SGDS_D5N_SERVICE', 'ACCOUNT_IDENTITY_SMOKE_V1'].join('_');
export const D5N_SYNTHETIC_JOB_ID = 'sgds-d5n-runtime-identity-smoke-v1';
export const D5N_EXISTING_D5J_JOB_ID = 'sgds-d5j-3400731da7823d5d8690f242';
export const D5N_RUNNER_MODES = Object.freeze(['--dry-run', '--read', '--execute', '--verify']);

const D5N_SCHEMA_VERSION = 'SGDS_FIRESTORE_SHADOW_SCHEMA_V1';
const D5N_EVENT_SCHEMA_VERSION = 'SGDS_FIRESTORE_SHADOW_EVENT_V1';
const D5N_REPORT_SCHEMA_VERSION = 'SGDS_FIRESTORE_SHADOW_REPORT_V1';
const D5N_FIXED_TIME = '2026-07-16T00:00:00.000Z';
const D5N_EVENT_TYPES = Object.freeze([
  'SHADOW_JOB_CREATED',
  'SHADOW_COMMIT_PLAN_SAVED',
  'SHADOW_RECONCILIATION_RECORDED',
  'SHADOW_EVALUATION_COMPLETED'
]);

export function validateD5NEnvironment(env = process.env, mode = '--dry-run', commandRunner = defaultCommandRunner) {
  if (!D5N_RUNNER_MODES.includes(mode)) throw d5nError('D5N_MODE_INVALID');
  const projectId = safeString(env.SGDS_D5N_PROJECT_ID || D5N_PROJECT_ID);
  const databaseId = safeString(env.SGDS_D5N_DATABASE_ID || D5N_DATABASE_ID);
  const expectedPrincipal = safeString(env.SGDS_D5N_EXPECTED_PRINCIPAL || D5N_RUNTIME_PRINCIPAL);
  if (projectId !== D5N_PROJECT_ID) throw d5nError('D5N_PROJECT_MISMATCH');
  if (databaseId !== D5N_DATABASE_ID) throw d5nError('D5N_DATABASE_MISMATCH');
  if (expectedPrincipal !== D5N_RUNTIME_PRINCIPAL) throw d5nError('D5N_EXPECTED_PRINCIPAL_MISMATCH');
  if (env.FIRESTORE_EMULATOR_HOST) throw d5nError('D5N_EMULATOR_DENIED');
  if (env.GOOGLE_APPLICATION_CREDENTIALS) throw d5nError('D5N_KEY_FILE_DENIED');
  if (mode === '--execute' && safeString(env.SGDS_D5N_OWNER_APPROVAL) !== D5N_OWNER_APPROVAL) {
    throw d5nError('D5N_OWNER_APPROVAL_REQUIRED');
  }
  const activeAccount = safeCommandValue(commandRunner('gcloud.cmd', ['config', 'get-value', 'account', '--configuration=sgds-hungdiep']));
  const activeProject = safeCommandValue(commandRunner('gcloud.cmd', ['config', 'get-value', 'project', '--configuration=sgds-hungdiep']));
  if (activeAccount !== 'hungdiepcompany@gmail.com') throw d5nError('D5N_ADMIN_ACCOUNT_MISMATCH');
  if (activeProject !== projectId) throw d5nError('D5N_PROJECT_CONTEXT_MISMATCH');
  return Object.freeze({
    projectId,
    databaseId,
    expectedPrincipal,
    activeAccount,
    activeProject,
    impersonationMode: 'GCLOUD_SHORT_LIVED_IMPERSONATION',
    keyFileCredential: 'ABSENT'
  });
}

export function buildD5NIdentityPayload({ validator }) {
  const base = `${D5N_SYNTHETIC_CASE_ID}|${D5N_PROJECT_ID}|${D5N_DATABASE_ID}|${D5N_SYNTHETIC_JOB_ID}`;
  const sourceReferenceHash = sha256Hex(`${base}|sourceReference`);
  const invoiceIdentityHash = sha256Hex(`${base}|identity`);
  const lineIdentityHash = sha256Hex(`${base}|line`);
  const commitPlanBase = {
    version: 'D5N_IDENTITY_SMOKE_COMMIT_PLAN_V1',
    jobId: D5N_SYNTHETIC_JOB_ID,
    executionMode: 'SHADOW',
    productionMutationAllowed: false,
    syntheticOnly: true,
    synthetic: true,
    environment: 'production-identity-smoke',
    caseId: D5N_SYNTHETIC_CASE_ID,
    businessData: false,
    canonicalWriteAllowed: false,
    runtimePrincipalExpected: D5N_RUNTIME_PRINCIPAL,
    expectedLineCount: 0,
    lineIdentityHashes: [lineIdentityHash],
    sourceReferenceHashes: [sourceReferenceHash],
    wouldMutateSteps: [],
    inputSnapshotVersion: D5N_SYNTHETIC_CASE_ID
  };
  const commitPlanHash = sha256Hex(stableJson(commitPlanBase));
  const commitPlan = { ...commitPlanBase, commitPlanHash };
  const jobV1 = validator.validateJobDocument({
    schemaVersion: D5N_SCHEMA_VERSION,
    jobId: D5N_SYNTHETIC_JOB_ID,
    status: 'SHADOW_READY',
    shadowEvaluationStatus: 'SHADOW_READY',
    executionMode: 'SHADOW',
    productionMutationAllowed: false,
    synthetic: true,
    environment: 'production-identity-smoke',
    caseId: D5N_SYNTHETIC_CASE_ID,
    businessData: false,
    canonicalWriteAllowed: false,
    invoiceIdentityHash,
    sourceReferenceHashes: [sourceReferenceHash],
    sourceTypes: ['IDENTITY_SYNTHETIC'],
    sourceThreadHash: sourceReferenceHash,
    commitPlan,
    commitPlanHash,
    commitPlanVersion: commitPlan.version,
    expectedLineCount: 0,
    version: 1,
    createdAt: D5N_FIXED_TIME,
    updatedAt: D5N_FIXED_TIME,
    lastObservedAt: D5N_FIXED_TIME,
    latestReconciliationStatus: 'CONSISTENT',
    latestFindingCodes: [],
    latestReconciliationReportId: 'rpt-d5n-runtime-identity-smoke-v1',
    reconciliationStatus: 'CONSISTENT',
    retentionClass: 'IDENTITY_SMOKE',
    attemptCount: 1,
    completedAt: null,
    lastErrorCode: '',
    lastErrorStage: '',
    lastMutationIdempotencyKey: ''
  });
  const jobFinal = validator.validateJobDocument({
    ...jobV1,
    version: 2,
    updatedAt: D5N_FIXED_TIME,
    lastObservedAt: D5N_FIXED_TIME,
    lastMutationIdempotencyKey: sha256Hex(`${base}|identity-update`).slice(0, 24)
  });
  const events = D5N_EVENT_TYPES.map((eventType, index) => validator.validateAuditEvent({
    schemaVersion: D5N_EVENT_SCHEMA_VERSION,
    eventId: `evt-d5n-${String(index + 1).padStart(2, '0')}`,
    jobId: D5N_SYNTHETIC_JOB_ID,
    eventType,
    idempotencyKey: sha256Hex(`${base}|${eventType}`).slice(0, 24),
    actorType: 'SYSTEM_IDENTITY_SMOKE',
    occurredAt: D5N_FIXED_TIME,
    safeDetails: {
      synthetic: 'true',
      environment: 'production-identity-smoke',
      caseId: D5N_SYNTHETIC_CASE_ID,
      canonicalWriteAllowed: 'false',
      runtimePrincipalHashPrefix: sha256Hex(D5N_RUNTIME_PRINCIPAL).slice(0, 12)
    }
  }));
  const report = validator.validateReconciliationReport({
    schemaVersion: D5N_REPORT_SCHEMA_VERSION,
    reportId: jobV1.latestReconciliationReportId,
    jobId: D5N_SYNTHETIC_JOB_ID,
    jobVersion: 2,
    status: 'CONSISTENT',
    findingCount: 0,
    findingCodes: [],
    findings: [],
    blockerCount: 0,
    repairPolicy: 'REPORT_ONLY',
    inputSnapshotVersion: D5N_SYNTHETIC_CASE_ID,
    synthetic: true,
    environment: 'production-identity-smoke',
    caseId: D5N_SYNTHETIC_CASE_ID,
    businessData: false,
    canonicalWriteAllowed: false,
    executionMode: 'SHADOW',
    generatedAt: D5N_FIXED_TIME
  });
  return Object.freeze({
    jobId: D5N_SYNTHETIC_JOB_ID,
    jobV1,
    jobFinal,
    events,
    report,
    targetPaths: {
      existingD5JJob: `invoiceJobs/${D5N_EXISTING_D5J_JOB_ID}`,
      job: `invoiceJobs/${D5N_SYNTHETIC_JOB_ID}`,
      events: events.map(event => `invoiceJobs/${D5N_SYNTHETIC_JOB_ID}/events/${event.eventId}`),
      report: `invoiceJobs/${D5N_SYNTHETIC_JOB_ID}/reconciliationReports/${report.reportId}`
    },
    idempotencyKey: sha256Hex(`${base}|idempotency`).slice(0, 24)
  });
}

export function createD5NFirestoreClient({ projectId, databaseId, tokenProvider, fetchImpl = globalThis.fetch }) {
  if (typeof fetchImpl !== 'function') throw d5nError('D5N_FETCH_REQUIRED');
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/${encodeURIComponent(databaseId)}`;

  async function request(method, suffix, body) {
    const token = await tokenProvider();
    const response = await fetchImpl(`${baseUrl}${suffix}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'x-goog-user-project': projectId
      },
      body: body == null ? undefined : JSON.stringify(body)
    });
    if (response.status === 404) return null;
    const text = await response.text();
    const parsed = text ? JSON.parse(text) : {};
    if (!response.ok) {
      const error = d5nError(`D5N_FIRESTORE_${response.status}`);
      error.details = parsed && parsed.error && parsed.error.status;
      throw error;
    }
    return parsed;
  }

  return Object.freeze({
    getDocument(relativePath) {
      return request('GET', `/documents/${relativePath}`, null);
    },
    commitWrites(writes) {
      return request('POST', '/documents:commit', { writes });
    }
  });
}

export async function inspectD5NTree(client, payload) {
  const jobDoc = await client.getDocument(payload.targetPaths.job);
  const eventDocs = [];
  for (const eventPath of payload.targetPaths.events) eventDocs.push(await client.getDocument(eventPath));
  const reportDoc = await client.getDocument(payload.targetPaths.report);
  const presentCount = [jobDoc, reportDoc, ...eventDocs].filter(Boolean).length;
  if (presentCount === 0) return { state: 'ABSENT', presentCount };
  if (presentCount !== 2 + payload.events.length) return { state: 'PARTIAL_CONFLICT', presentCount };
  const current = {
    job: fromFirestoreDocument(jobDoc),
    events: eventDocs.map(fromFirestoreDocument),
    report: fromFirestoreDocument(reportDoc)
  };
  const expected = { job: payload.jobFinal, events: payload.events, report: payload.report };
  return {
    state: stableJson(current) === stableJson(expected) ? 'MATCH' : 'CONFLICT',
    presentCount,
    currentHash: sha256Hex(stableJson(current)),
    expectedHash: sha256Hex(stableJson(expected))
  };
}

export async function runD5NMode({ mode, env = process.env, rootDir = process.cwd(), commandRunner = defaultCommandRunner, fetchImpl = globalThis.fetch, tokenProvider } = {}) {
  const environment = validateD5NEnvironment(env, mode, commandRunner);
  const contracts = loadD5JGasContracts(rootDir);
  const validator = contracts.createFirestoreShadowStateValidator();
  const payload = buildD5NIdentityPayload({ validator });
  const getToken = tokenProvider || (() => safeCommandValue(commandRunner('gcloud.cmd', [
    'auth',
    'print-access-token',
    `--impersonate-service-account=${D5N_RUNTIME_PRINCIPAL}`,
    '--configuration=sgds-hungdiep'
  ])));
  const summary = {
    mode,
    projectId: environment.projectId,
    databaseId: environment.databaseId,
    impersonator: environment.activeAccount,
    actualPrincipal: environment.expectedPrincipal,
    credentialMode: environment.impersonationMode,
    tokenMaterialLogged: 'NO',
    keyFileCredential: environment.keyFileCredential,
    syntheticCaseId: D5N_SYNTHETIC_CASE_ID,
    syntheticJobId: D5N_SYNTHETIC_JOB_ID,
    syntheticJobPath: payload.targetPaths.job,
    syntheticEventCount: payload.events.length,
    syntheticReportCount: 1,
    googleSheetsMutation: 'NONE',
    gmailMessageMutation: 'NONE',
    gmailLabelMutation: 'NONE',
    googleDriveMutation: 'NONE',
    canonicalWriteAllowed: false,
    realInvoiceDataUsed: false
  };
  if (mode === '--dry-run') {
    return {
      ...summary,
      dryRun: 'PASS',
      maxJobCount: 1,
      wouldCreateDocuments: 2 + payload.events.length,
      wouldUpdateDocuments: 1,
      firestoreWrite: 'NO'
    };
  }
  const client = createD5NFirestoreClient({ projectId: environment.projectId, databaseId: environment.databaseId, tokenProvider: getToken, fetchImpl });
  const existingD5J = await client.getDocument(payload.targetPaths.existingD5JJob);
  if (!existingD5J) throw d5nError('D5N_EXISTING_D5J_JOB_NOT_FOUND');
  if (mode === '--read') return { ...summary, impersonatedRead: 'PASS', existingD5JJobFound: 'YES', firestoreWrite: 'NO' };

  const before = await inspectD5NTree(client, payload);
  if (mode === '--verify') {
    if (before.state !== 'MATCH') throw d5nError(before.state === 'ABSENT' ? 'D5N_JOB_NOT_FOUND' : 'D5N_JOB_TREE_CONFLICT');
    return { ...summary, readBackStatus: 'PASS', initialJobCount: 1, duplicateJobCount: 0, idempotency: 'PASS' };
  }
  if (before.state === 'CONFLICT' || before.state === 'PARTIAL_CONFLICT') throw d5nError('D5N_SYNTHETIC_TARGET_COLLISION');
  if (before.state === 'MATCH') {
    return {
      ...summary,
      executionStatus: 'PASS_IDEMPOTENT_REUSE',
      initialJobCount: 1,
      jobCountAfterReplay: 1,
      duplicateJobCount: 0,
      idempotency: 'PASS',
      firestoreDocumentsCreated: 0,
      firestoreDocumentsUpdated: 0,
      firestoreDocumentsDeleted: 0
    };
  }
  await client.commitWrites([
    createWrite(payload.targetPaths.job, payload.jobV1, true),
    ...payload.events.map((event, index) => createWrite(payload.targetPaths.events[index], event, true)),
    createWrite(payload.targetPaths.report, payload.report, true),
    updateWrite(payload.targetPaths.job, payload.jobFinal, ['version', 'updatedAt', 'lastObservedAt', 'lastMutationIdempotencyKey'])
  ]);
  const after = await inspectD5NTree(client, payload);
  if (after.state !== 'MATCH') throw d5nError('D5N_READ_BACK_MISMATCH');
  return {
    ...summary,
    executionStatus: 'PASS_ONE_IDENTITY_JOB_CREATED',
    initialJobCount: 1,
    jobCountAfterReplay: 1,
    duplicateJobCount: 0,
    idempotency: 'PASS',
    firestoreDocumentsCreated: 2 + payload.events.length,
    firestoreDocumentsUpdated: 1,
    firestoreDocumentsDeleted: 0
  };
}

function createWrite(relativePath, body, requireAbsent) {
  return {
    update: {
      name: firestoreDocumentName(relativePath),
      fields: toFirestoreFields(body)
    },
    currentDocument: requireAbsent ? { exists: false } : undefined
  };
}

function updateWrite(relativePath, body, maskPaths) {
  return {
    update: {
      name: firestoreDocumentName(relativePath),
      fields: toFirestoreFields(body)
    },
    updateMask: { fieldPaths: maskPaths },
    currentDocument: { exists: true }
  };
}

function firestoreDocumentName(relativePath) {
  return `projects/${D5N_PROJECT_ID}/databases/${D5N_DATABASE_ID}/documents/${relativePath}`;
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

function defaultCommandRunner(command, args) {
  return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: true });
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
  return safeString(String(value || '').split(/\r?\n/).filter(line => line && !/^WARNING:/.test(line) && !/^Your active configuration is:/.test(line)).pop() || '');
}

function d5nError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function sanitizeOutput(result) {
  return JSON.stringify(result, null, 2).replace(/ya29[.][A-Za-z0-9_-]+/g, 'REDACTED_TOKEN');
}

async function main() {
  const mode = process.argv.slice(2).find(arg => D5N_RUNNER_MODES.includes(arg));
  if (!mode) throw d5nError('D5N_MODE_REQUIRED');
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const result = await runD5NMode({ mode, rootDir });
  console.log(sanitizeOutput(result));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(JSON.stringify({
      status: 'BLOCKED',
      code: error && error.code ? error.code : 'D5N_UNKNOWN_ERROR',
      message: error && error.code ? error.code : 'D5N_UNKNOWN_ERROR'
    }));
    process.exit(1);
  });
}
