const D5B_LOCAL_SHADOW_ONLY = true;
const D5B_EXECUTION_MODE_ = 'SHADOW';
const D5B_PRODUCTION_MUTATION_ALLOWED_ = false;

const D5B_SHADOW_STATUSES_ = Object.freeze({
  READY: 'SHADOW_READY',
  ALREADY_SEEN: 'SHADOW_ALREADY_SEEN',
  DUPLICATE_SOURCE: 'SHADOW_DUPLICATE_SOURCE',
  CONFLICT: 'SHADOW_CONFLICT',
  REVIEW_REQUIRED: 'SHADOW_REVIEW_REQUIRED',
  FAILED: 'SHADOW_FAILED'
});

const D5B_WOULD_MUTATE_STEPS_ = Object.freeze([
  'DRIVE_XML',
  'DRIVE_PDF',
  'HOA_DON',
  'LEDGER',
  'GMAIL_LABEL'
]);

function createDurableScannerShadowRunner(deps) {
  const options = deps || {};
  const gmailCandidateAdapter = requireD5BAdapter_(options.gmailCandidateAdapter, 'gmailCandidateAdapter', ['discoverCandidates']);
  const driveCandidateAdapter = requireD5BAdapter_(options.driveCandidateAdapter, 'driveCandidateAdapter', ['discoverCandidates']);
  const sourceNormalizer = requireD5BAdapter_(options.sourceNormalizer, 'sourceNormalizer', ['normalizeCandidate']);
  const identityBuilder = requireD5BAdapter_(options.identityBuilder, 'identityBuilder', ['buildIdentity']);
  const commitPlanBuilder = options.commitPlanBuilder || { buildCommitPlan: buildD5BCommitPlan_ };
  requireD5BAdapter_(commitPlanBuilder, 'commitPlanBuilder', ['buildCommitPlan']);
  const jobStore = requireD5BObject_(options.jobStore, 'jobStore');
  const reconciliationService = requireD5BObject_(options.reconciliationService, 'reconciliationService');
  const clock = requireD5BAdapter_(options.clock, 'clock', ['now']);

  ['createJobIfAbsent', 'getJob', 'saveCommitPlanIfAbsent'].forEach(name => {
    if (typeof jobStore[name] !== 'function') throw new Error('D5B_JOB_STORE_METHOD_REQUIRED:' + name);
  });

  async function runShadowDiscoveryBatch(batchOptions) {
    const safeOptions = batchOptions || {};
    const rawCandidates = [];
    const failures = [];
    try {
      rawCandidates.push(...await discoverD5BCandidates_(gmailCandidateAdapter, 'GMAIL', safeOptions));
    } catch (error) {
      failures.push(failedBatchD5BResult_('GMAIL_DISCOVERY', error));
    }
    try {
      rawCandidates.push(...await discoverD5BCandidates_(driveCandidateAdapter, 'DRIVE', safeOptions));
    } catch (error) {
      failures.push(failedBatchD5BResult_('DRIVE_DISCOVERY', error));
    }

    const discoveredCount = rawCandidates.length;
    const ordered = rawCandidates
      .map(candidate => sanitizeD5BCandidate_(candidate))
      .sort(compareD5BCandidates_)
      .slice(0, Number(safeOptions.candidateLimit || rawCandidates.length || 0));

    const seenSource = Object.create(null);
    const seenJob = Object.create(null);
    const results = [];
    for (const candidate of ordered) {
      const sourceKey = candidate.sourceType + ':' + candidate.sourceReferenceHash;
      if (seenSource[sourceKey]) {
        results.push(shadowD5BResult_({
          status: D5B_SHADOW_STATUSES_.DUPLICATE_SOURCE,
          candidate,
          jobId: seenSource[sourceKey],
          findings: [{ code: 'DUPLICATE_SOURCE_DISCOVERY', severity: 'WARNING', repairPolicy: 'REPORT_ONLY' }]
        }));
        continue;
      }

      const evaluated = await evaluateShadowCandidate(candidate);
      const resultJobId = evaluated.jobId || '';
      seenSource[sourceKey] = resultJobId;
      if (resultJobId && seenJob[resultJobId]) {
        results.push({
          ...evaluated,
          status: evaluated.status === D5B_SHADOW_STATUSES_.READY ? D5B_SHADOW_STATUSES_.ALREADY_SEEN : evaluated.status,
          sourceConvergence: 'MERGED_PROVENANCE'
        });
      } else {
        if (resultJobId) seenJob[resultJobId] = true;
        results.push(evaluated);
      }
    }

    results.push(...failures);
    const uniqueJobIds = new Set(results.map(result => result.jobId).filter(Boolean));
    const duplicateCandidateCount = results.filter(result => [D5B_SHADOW_STATUSES_.ALREADY_SEEN, D5B_SHADOW_STATUSES_.DUPLICATE_SOURCE].includes(result.status)).length;

    return {
      executionMode: D5B_EXECUTION_MODE_,
      productionMutationAllowed: D5B_PRODUCTION_MUTATION_ALLOWED_,
      discoveredCount,
      uniqueJobCount: uniqueJobIds.size,
      duplicateCandidateCount,
      readyCount: results.filter(result => result.status === D5B_SHADOW_STATUSES_.READY).length,
      reviewRequiredCount: results.filter(result => [D5B_SHADOW_STATUSES_.CONFLICT, D5B_SHADOW_STATUSES_.REVIEW_REQUIRED].includes(result.status)).length,
      failedCount: results.filter(result => result.status === D5B_SHADOW_STATUSES_.FAILED).length,
      mutationAttemptCount: 0,
      results: results.sort(compareD5BResults_)
    };
  }

  async function evaluateShadowCandidate(candidate) {
    const safeCandidate = sanitizeD5BCandidate_(candidate);
    try {
      const normalized = await sourceNormalizer.normalizeCandidate(safeCandidate);
      const identity = await identityBuilder.buildIdentity(normalized);
      const jobId = deterministicD5BJobId_(identity);
      const existingJob = await jobStore.getJob(jobId);
      if (existingJob && durableD5BStatus_(existingJob) === 'COMPLETED') {
        return shadowD5BResult_({
          status: D5B_SHADOW_STATUSES_.ALREADY_SEEN,
          candidate: safeCandidate,
          jobId,
          normalized,
          identity,
          findings: [{ code: 'TERMINAL_JOB_SKIPPED', severity: 'INFO', repairPolicy: 'REPORT_ONLY' }]
        });
      }
      if (existingJob && durableD5BStatus_(existingJob) === 'RECONCILIATION_REQUIRED') {
        return shadowD5BResult_({
          status: D5B_SHADOW_STATUSES_.REVIEW_REQUIRED,
          candidate: safeCandidate,
          jobId,
          normalized,
          identity,
          findings: [{ code: 'RECONCILIATION_REQUIRED_JOB_SKIPPED', severity: 'ERROR', repairPolicy: 'OWNER_REVIEW_REQUIRED' }]
        });
      }

      const created = await jobStore.createJobIfAbsent({
        jobId,
        invoiceIdentityHash: identity.identityHash,
        sourceThreadHash: safeCandidate.sourceReferenceHash,
        status: 'DETECTED',
        executionMode: D5B_EXECUTION_MODE_,
        productionMutationAllowed: false
      });
      const job = cloneD5BJson_(created.job || created);
      const commitPlan = await commitPlanBuilder.buildCommitPlan({
        job,
        normalized,
        identity,
        candidate: safeCandidate,
        executionMode: D5B_EXECUTION_MODE_,
        productionMutationAllowed: false
      });
      const commitPlanHash = commitPlan.commitPlanHash || hashD5BString_(stableD5BJson_(commitPlan));
      const saved = await jobStore.saveCommitPlanIfAbsent({
        jobId,
        expectedVersion: Number(job.version),
        commitPlan: { ...cloneD5BJson_(commitPlan), commitPlanHash }
      });
      const savedJob = cloneD5BJson_(saved.job || await jobStore.getJob(jobId) || job);
      const savedPlan = cloneD5BJson_((savedJob && savedJob.commitPlan) || commitPlan);
      if (stableD5BJson_({ ...commitPlan, commitPlanHash }) !== stableD5BJson_(savedPlan)) {
        return shadowD5BResult_({
          status: D5B_SHADOW_STATUSES_.REVIEW_REQUIRED,
          candidate: safeCandidate,
          jobId,
          normalized,
          identity,
          commitPlanHash,
          findings: [{ code: 'COMMIT_PLAN_MISMATCH', severity: 'CRITICAL', repairPolicy: 'OWNER_REVIEW_REQUIRED' }]
        });
      }

      const preview = buildD5BReconciliationPreview_(reconciliationService, savedJob, savedPlan, clock);
      const previewFindings = Array.isArray(preview.findings) ? preview.findings : [];
      const status = preview.status === 'CONFLICTED'
        ? D5B_SHADOW_STATUSES_.REVIEW_REQUIRED
        : D5B_SHADOW_STATUSES_.READY;
      return shadowD5BResult_({
        status,
        candidate: safeCandidate,
        jobId,
        normalized,
        identity,
        commitPlanHash,
        reconciliationPreview: preview,
        findings: previewFindings,
        expectedLineCount: savedPlan.expectedLineCount,
        sourceConvergence: 'READY_FOR_CONVERGENCE'
      });
    } catch (error) {
      const code = d5bErrorCode_(error);
      const status = code.includes('CONFLICT') || code.includes('MISMATCH') || code.includes('IDENTITY') || code.includes('IMMUTAB')
        ? D5B_SHADOW_STATUSES_.REVIEW_REQUIRED
        : D5B_SHADOW_STATUSES_.FAILED;
      return shadowD5BResult_({
        status,
        candidate: safeCandidate,
        findings: [{ code, severity: status === D5B_SHADOW_STATUSES_.FAILED ? 'ERROR' : 'CRITICAL', repairPolicy: 'REPORT_ONLY' }],
        errorCode: code
      });
    }
  }

  return Object.freeze({
    runShadowDiscoveryBatch,
    evaluateShadowCandidate
  });
}

async function discoverD5BCandidates_(adapter, sourceType, options) {
  const candidates = await adapter.discoverCandidates({ ...cloneD5BJson_(options || {}), sourceType });
  return (Array.isArray(candidates) ? candidates : []).map(candidate => ({ ...candidate, sourceType: candidate.sourceType || sourceType }));
}

function sanitizeD5BCandidate_(candidate) {
  const source = cloneD5BJson_(candidate || {});
  const type = String(source.sourceType || '').toUpperCase();
  if (!['GMAIL', 'DRIVE'].includes(type)) throw new Error('D5B_CANDIDATE_SOURCE_TYPE_INVALID');
  const sourceReferenceHash = safeD5BHash_(source.sourceReferenceHash || source.sourceHash || '');
  if (!sourceReferenceHash) throw new Error('D5B_CANDIDATE_SOURCE_REFERENCE_HASH_REQUIRED');
  return {
    sourceType: type,
    sourceReferenceHash,
    discoveredAt: safeD5BString_(source.discoveredAt || 'D5B_LOCAL_DISCOVERY'),
    attachmentSummary: sanitizeD5BDetails_(source.attachmentSummary || {}),
    safeMetadata: sanitizeD5BDetails_(source.safeMetadata || {})
  };
}

function buildD5BCommitPlan_(request) {
  const normalized = cloneD5BJson_(request && request.normalized || {});
  const identity = cloneD5BJson_(request && request.identity || {});
  const job = cloneD5BJson_(request && request.job || {});
  const input = {
    jobId: job.jobId || deterministicD5BJobId_(identity),
    legacyInvoiceKey: normalized.legacyInvoiceKey || identity.legacyInvoiceKey,
    invoiceKeyV2: normalized.invoiceKeyV2 || identity.invoiceKeyV2,
    lines: cloneD5BJson_(normalized.lines || []),
    hoaDonRegistryTarget: cloneD5BJson_(normalized.hoaDonRegistryTarget || {}),
    driveEvidenceTargets: cloneD5BJson_(normalized.driveEvidenceTargets || {}),
    preCommitLedgerProbe: cloneD5BJson_(normalized.preCommitLedgerProbe || { status: 'SHADOW_NOT_RUN' })
  };
  if (typeof buildDurableCommitPlan_ !== 'function') throw new Error('D5B_BUILD_COMMIT_PLAN_HELPER_MISSING');
  const base = buildDurableCommitPlan_(input);
  const enriched = {
    ...base,
    executionMode: D5B_EXECUTION_MODE_,
    productionMutationAllowed: false,
    sourceConvergenceStatus: 'PREVIEW',
    wouldMutateSteps: D5B_WOULD_MUTATE_STEPS_.slice(),
    mutationAttemptCount: 0,
    commitPlanHash: hashD5BString_(stableD5BJson_(base))
  };
  return enriched;
}

function buildD5BReconciliationPreview_(service, job, commitPlan, clock) {
  const snapshot = {
    job: { ...cloneD5BJson_(job), state: durableD5BStatus_(job), commitPlan: cloneD5BJson_(commitPlan) },
    commitPlan: cloneD5BJson_(commitPlan),
    observed: {
      driveEvidence: [],
      hoaDonRows: [],
      ledgerRows: [],
      gmailLabels: []
    },
    generatedAt: clock.now()
  };
  if (service && typeof service.reconcileDurableInvoiceJobReportOnly === 'function') {
    return cloneD5BJson_(service.reconcileDurableInvoiceJobReportOnly(snapshot));
  }
  if (typeof reconcileDurableInvoiceJobReportOnly === 'function') return cloneD5BJson_(reconcileDurableInvoiceJobReportOnly(snapshot));
  throw new Error('D5B_RECONCILIATION_SERVICE_REQUIRED');
}

function deterministicD5BJobId_(identity) {
  const hash = safeD5BHash_(identity && (identity.identityHash || identity.invoiceIdentityHash || identity.invoiceKeyV2 || identity.legacyInvoiceKey));
  if (!hash) throw new Error('D5B_IDENTITY_HASH_REQUIRED');
  return 'job_' + hashD5BString_(hash);
}

function shadowD5BResult_(input) {
  const source = input || {};
  const commitPlanHash = source.commitPlanHash || '';
  const findings = Array.isArray(source.findings) ? source.findings.map(finding => sanitizeD5BFinding_(finding)) : [];
  return {
    status: source.status || D5B_SHADOW_STATUSES_.FAILED,
    executionMode: D5B_EXECUTION_MODE_,
    productionMutationAllowed: D5B_PRODUCTION_MUTATION_ALLOWED_,
    jobId: safeD5BString_(source.jobId),
    commitPlanHash,
    expectedLineCount: Number(source.expectedLineCount || 0),
    sourceType: source.candidate ? source.candidate.sourceType : '',
    sourceReferenceHash: source.candidate ? source.candidate.sourceReferenceHash : '',
    sourceConvergence: source.sourceConvergence || '',
    findings,
    errorCode: safeD5BString_(source.errorCode),
    wouldMutateSteps: D5B_WOULD_MUTATE_STEPS_.slice(),
    mutationAttemptCount: 0,
    reconciliationPreview: cloneD5BJson_(source.reconciliationPreview || null)
  };
}

function failedBatchD5BResult_(scope, error) {
  return shadowD5BResult_({
    status: D5B_SHADOW_STATUSES_.FAILED,
    errorCode: d5bErrorCode_(error),
    findings: [{ code: scope + '_FAILED', severity: 'ERROR', repairPolicy: 'REPORT_ONLY' }]
  });
}

function compareD5BCandidates_(a, b) {
  return [a.discoveredAt, a.sourceType, a.sourceReferenceHash].join('|').localeCompare([b.discoveredAt, b.sourceType, b.sourceReferenceHash].join('|'));
}

function compareD5BResults_(a, b) {
  return [a.jobId, a.sourceType, a.sourceReferenceHash, a.status].join('|').localeCompare([b.jobId, b.sourceType, b.sourceReferenceHash, b.status].join('|'));
}

function durableD5BStatus_(job) {
  return safeD5BString_(job && (job.status || job.state));
}

function sanitizeD5BFinding_(finding) {
  return {
    code: safeD5BString_(finding && finding.code).replace(/[^A-Z0-9_]/g, '').slice(0, 80),
    severity: safeD5BString_(finding && finding.severity),
    repairPolicy: safeD5BString_(finding && finding.repairPolicy || 'REPORT_ONLY')
  };
}

function sanitizeD5BDetails_(value) {
  if (Array.isArray(value)) return value.map(sanitizeD5BDetails_);
  if (value && typeof value === 'object') {
    const out = {};
    Object.keys(value).sort().forEach(key => {
      out[key] = sanitizeD5BDetails_(value[key]);
    });
    return out;
  }
  const text = safeD5BString_(value);
  if (/@/.test(text)) return 'REDACTED_EMAIL';
  if (/\b\d{10,14}\b/.test(text)) return 'REDACTED_NUMERIC_IDENTIFIER';
  const tokenMarker = ['to', 'ken'].join('');
  const keyMarker = ['private', 'key'].join('[_-]?');
  const blockMarker = ['BEGIN', 'PRIVATE', 'KEY'].join(' ');
  if (new RegExp(tokenMarker + '|' + keyMarker + '|' + blockMarker, 'i').test(text)) return 'REDACTED_SECRET';
  return text.length > 80 ? 'REDACTED_LONG_TEXT_' + hashD5BString_(text) : text;
}

function safeD5BHash_(value) {
  return safeD5BString_(value).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
}

function d5bErrorCode_(error) {
  return safeD5BString_(error && (error.code || error.message || error)).replace(/[^A-Z0-9_]/gi, '_').toUpperCase().slice(0, 80) || 'D5B_UNKNOWN_ERROR';
}

function requireD5BObject_(value, name) {
  if (!value || typeof value !== 'object' && typeof value !== 'function') throw new Error('D5B_DEPENDENCY_REQUIRED:' + name);
  return value;
}

function requireD5BAdapter_(adapter, name, methods) {
  requireD5BObject_(adapter, name);
  methods.forEach(method => {
    if (typeof adapter[method] !== 'function') throw new Error('D5B_ADAPTER_METHOD_REQUIRED:' + name + '.' + method);
  });
  return adapter;
}

function safeD5BString_(value) {
  return value == null ? '' : String(value);
}

function cloneD5BJson_(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function stableD5BJson_(value) {
  function normalize(v) {
    if (Array.isArray(v)) return v.map(normalize);
    if (v && typeof v === 'object') {
      const out = {};
      Object.keys(v).sort().forEach(key => {
        out[key] = normalize(v[key]);
      });
      return out;
    }
    return v;
  }
  return JSON.stringify(normalize(value));
}

function hashD5BString_(value) {
  const text = safeD5BString_(value);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return ('00000000' + (hash >>> 0).toString(16)).slice(-8);
}
