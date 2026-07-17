import {
  SGDS_MAX_EVENT_DOCUMENTS,
  SGDS_MAX_JOB_DOCUMENTS,
  SGDS_MAX_REPORT_DOCUMENTS,
  SGDS_MUTATION_FLAGS,
  SGDS_ORCHESTRATOR_VERSION,
  SGDS_SHADOW_EVENT_TYPES
} from './constants.mjs';
import { sgdsError } from './errors.mjs';
import { cloneJson, sha256Hex, stableJson } from './json.mjs';
import { fromFirestoreDocument } from './firestore-client.mjs';

const FIXED_SHADOW_STATUS = 'SHADOW_READY';

export function createDurableShadowService({ firestoreClient, clock = systemClock() } = {}) {
  if (!firestoreClient) throw sgdsError('FIRESTORE_CLIENT_REQUIRED', 500);
  if (typeof firestoreClient.getDocument !== 'function') throw sgdsError('FIRESTORE_GET_REQUIRED', 500);
  if (typeof firestoreClient.commitCreates !== 'function') throw sgdsError('FIRESTORE_COMMIT_REQUIRED', 500);

  async function plan(request, caller) {
    const payload = buildDurableShadowPayload(request, caller, clock.now());
    const current = await inspectTree(payload);
    return {
      ok: true,
      operation: 'plan',
      jobId: payload.jobId,
      idempotencyKey: payload.idempotencyKey,
      mutationAttemptCount: 0,
      productionWrite: 'NONE',
      wouldCreateDocuments: current.state === 'ABSENT' ? payload.documents.length : 0,
      wouldReuse: current.state === 'MATCH',
      wouldUpdate: 0,
      currentState: current.state,
      maxCandidatesPerRequest: 1,
      deleteAllowed: false,
      canonicalWritesEnabled: false,
      gmailMutationsEnabled: false,
      driveMutationsEnabled: false,
      sheetsMutationsEnabled: false
    };
  }

  async function submit(request, caller) {
    const payload = buildDurableShadowPayload(request, caller, clock.now());
    const before = await inspectTree(payload);
    if (before.state === 'MATCH') {
      return {
        ok: true,
        operation: 'submit',
        result: 'IDEMPOTENT_REUSE',
        jobId: payload.jobId,
        jobCountAfterReplay: 1,
        duplicateJobCount: 0,
        documentsCreated: 0,
        documentsDeleted: 0,
        mutationAttemptCount: 0,
        workspaceMutationAttemptCount: 0,
        productionWrite: 'FIRESTORE_SHADOW_ONLY'
      };
    }
    if (before.state !== 'ABSENT') throw sgdsError('DURABLE_TREE_CONFLICT', 409);
    try {
      await firestoreClient.commitCreates(payload.documents);
    } catch (error) {
      if (error && String(error.code || '').includes('409')) {
        const raced = await inspectTree(payload);
        if (raced.state === 'MATCH') {
          return {
            ok: true,
            operation: 'submit',
            result: 'IDEMPOTENT_REUSE_AFTER_CONCURRENT_CREATE',
            jobId: payload.jobId,
            jobCountAfterReplay: 1,
            duplicateJobCount: 0,
            documentsCreated: 0,
            documentsDeleted: 0,
            mutationAttemptCount: 0,
            workspaceMutationAttemptCount: 0,
            productionWrite: 'FIRESTORE_SHADOW_ONLY'
          };
        }
      }
      throw error;
    }
    const after = await inspectTree(payload);
    if (after.state !== 'MATCH') throw sgdsError('DURABLE_READ_BACK_MISMATCH', 500);
    return {
      ok: true,
      operation: 'submit',
      result: 'SHADOW_JOB_CREATED',
      jobId: payload.jobId,
      jobCountAfterReplay: 1,
      duplicateJobCount: 0,
      documentsCreated: payload.documents.length,
      documentsDeleted: 0,
      mutationAttemptCount: 1,
      workspaceMutationAttemptCount: 0,
      productionWrite: 'FIRESTORE_SHADOW_ONLY'
    };
  }

  async function inspectTree(payload) {
    const docs = [];
    for (const doc of payload.documents) docs.push(await firestoreClient.getDocument(doc.path));
    const present = docs.filter(Boolean).length;
    if (present === 0) return { state: 'ABSENT', present };
    if (present !== payload.documents.length) return { state: 'PARTIAL_CONFLICT', present };
    const current = docs.map(fromFirestoreDocument);
    const expected = payload.documents.map(doc => doc.body);
    return {
      state: stableJson(current) === stableJson(expected) ? 'MATCH' : 'CONFLICT',
      present,
      currentHash: sha256Hex(stableJson(current)).slice(0, 16),
      expectedHash: sha256Hex(stableJson(expected)).slice(0, 16)
    };
  }

  return Object.freeze({ plan, submit, inspectTree });
}

export function buildDurableShadowPayload(request, caller = {}, now = new Date().toISOString()) {
  const candidate = cloneJson(request.candidate);
  const identitySeed = stableJson({
    schemaVersion: request.schemaVersion,
    mode: request.mode,
    sourceType: candidate.sourceType,
    sourceIdentityHash: candidate.sourceIdentityHash,
    contentIdentityHash: candidate.contentIdentityHash || '',
    scannerVersion: candidate.scannerVersion
  });
  const identityHash = sha256Hex(identitySeed);
  const jobId = `sgds-shadow-${identityHash.slice(0, 24)}`;
  const idempotencyKey = sha256Hex(`${jobId}|${request.requestId}|shadow`).slice(0, 32);
  const commitPlan = {
    version: 'SGDS_CLOUD_RUN_SHADOW_COMMIT_PLAN_V1',
    jobId,
    mode: 'shadow',
    serviceVersion: SGDS_ORCHESTRATOR_VERSION,
    idempotencyKeyHashPrefix: sha256Hex(idempotencyKey).slice(0, 16),
    sourceType: candidate.sourceType.toUpperCase(),
    sourceIdentityHash: candidate.sourceIdentityHash,
    contentIdentityHash: candidate.contentIdentityHash || '',
    scannerVersion: candidate.scannerVersion,
    mutationFlags: SGDS_MUTATION_FLAGS,
    expectedLineCount: 0,
    wouldMutateSteps: [],
    workspaceSideEffects: 'DENIED'
  };
  const job = {
    schemaVersion: 'SGDS_CLOUD_RUN_SHADOW_JOB_V1',
    jobId,
    status: FIXED_SHADOW_STATUS,
    shadowEvaluationStatus: FIXED_SHADOW_STATUS,
    executionMode: 'SHADOW',
    productionMutationAllowed: false,
    canonicalWriteAllowed: false,
    businessData: false,
    sourceType: candidate.sourceType.toUpperCase(),
    sourceIdentityHash: candidate.sourceIdentityHash,
    contentIdentityHash: candidate.contentIdentityHash || '',
    invoiceIdentityHash: identityHash,
    sourceReferenceHashes: [candidate.sourceIdentityHash],
    commitPlan,
    commitPlanHash: sha256Hex(stableJson(commitPlan)),
    version: 1,
    createdAt: now,
    updatedAt: now,
    lastObservedAt: now,
    latestReconciliationStatus: 'CONSISTENT',
    latestFindingCodes: [],
    latestReconciliationReportId: `rpt-${identityHash.slice(0, 16)}`,
    retentionClass: 'SHADOW_AUDIT'
  };
  const events = SGDS_SHADOW_EVENT_TYPES.map((eventType, index) => ({
    schemaVersion: 'SGDS_CLOUD_RUN_SHADOW_EVENT_V1',
    eventId: `evt-${String(index + 1).padStart(2, '0')}-${sha256Hex(`${jobId}|${eventType}`).slice(0, 12)}`,
    jobId,
    sequence: index + 1,
    eventType,
    actorType: 'CLOUD_RUN_ORCHESTRATOR',
    occurredAt: now,
    safeDetails: {
      requestId: request.requestId,
      sourceType: candidate.sourceType.toUpperCase(),
      callerEmail: caller.email || 'REDACTED_EMAIL',
      serviceVersion: SGDS_ORCHESTRATOR_VERSION,
      workspaceMutationAttemptCount: 0
    }
  }));
  const report = {
    schemaVersion: 'SGDS_CLOUD_RUN_SHADOW_REPORT_V1',
    reportId: job.latestReconciliationReportId,
    jobId,
    jobVersion: 1,
    status: 'CONSISTENT',
    findingCount: 0,
    findingCodes: [],
    findings: [],
    blockerCount: 0,
    repairPolicy: 'REPORT_ONLY',
    inputSnapshotVersion: 'SGDS_CLOUD_RUN_SHADOW_REQUEST_V1',
    executionMode: 'SHADOW',
    canonicalWriteAllowed: false,
    generatedAt: now
  };
  const documents = [
    { path: `invoiceJobs/${jobId}`, body: job },
    ...events.map(event => ({ path: `invoiceJobs/${jobId}/events/${event.eventId}`, body: event })),
    { path: `invoiceJobs/${jobId}/reconciliationReports/${report.reportId}`, body: report }
  ];
  if (documents.filter(doc => doc.path.startsWith(`invoiceJobs/${jobId}/events/`)).length > SGDS_MAX_EVENT_DOCUMENTS) {
    throw sgdsError('MUTATION_BUDGET_EVENT_LIMIT_EXCEEDED', 500);
  }
  if (documents.filter(doc => doc.path === `invoiceJobs/${jobId}`).length > SGDS_MAX_JOB_DOCUMENTS) {
    throw sgdsError('MUTATION_BUDGET_JOB_LIMIT_EXCEEDED', 500);
  }
  if (documents.filter(doc => doc.path.includes('/reconciliationReports/')).length > SGDS_MAX_REPORT_DOCUMENTS) {
    throw sgdsError('MUTATION_BUDGET_REPORT_LIMIT_EXCEEDED', 500);
  }
  return Object.freeze({ jobId, idempotencyKey, job, events, report, documents });
}

function systemClock() {
  return Object.freeze({ now: () => new Date().toISOString() });
}
