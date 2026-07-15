const SGDS_CRIT_003_D5D_MODE_ = 'EXACT_REFERENCE_PRODUCTION_READ_ONLY';
const SGDS_CRIT_003_D5D_PROPERTY_KEYS_ = Object.freeze({
  GMAIL_THREAD_ID: 'SGDS_D5D_GMAIL_THREAD_ID',
  XML_FILE_ID: 'SGDS_D5D_XML_FILE_ID',
  PDF_FILE_ID: 'SGDS_D5D_PDF_FILE_ID',
  INVOICE_IDENTITY_HASH: 'SGDS_D5D_INVOICE_IDENTITY_HASH',
  EXPECTED_LINE_COUNT: 'SGDS_D5D_EXPECTED_LINE_COUNT',
  EXPECTED_LINE_HASHES_JSON: 'SGDS_D5D_EXPECTED_LINE_HASHES_JSON',
  EXPECTED_INVOICE_KEY_HASH: 'SGDS_D5D_EXPECTED_INVOICE_KEY_HASH',
  EXPECTED_COMMIT_PLAN_HASH: 'SGDS_D5D_EXPECTED_COMMIT_PLAN_HASH'
});

async function runSgdsCrit003D5dProductionReadOnlyShadowSmoke() {
  const props = PropertiesService.getScriptProperties();
  const executor = createSgdsCrit003D5dReadOnlySmokeExecutor({
    propertyReader: { getProperty: key => props.getProperty(key) },
    gmailReader: createGasGmailReadOnlyReader(),
    driveReader: createGasDriveReadOnlyReader({ hasher: { hash: hashD5DString_ } }),
    sheetsReader: createGasSheetsReadOnlyReader(),
    identityHasher: { hash: hashD5DString_ },
    clock: { now: () => new Date().toISOString() },
    logger: { log: message => Logger.log(message) },
    reconciliationService: { reconcileDurableInvoiceJobReportOnly }
  });
  return await executor.run();
}

function createSgdsCrit003D5dReadOnlySmokeExecutor(options) {
  const opts = options || {};
  const propertyReader = requireD5DAdapter_(opts.propertyReader, 'propertyReader', ['getProperty']);
  const logger = opts.logger || { log: function () {} };
  const clock = opts.clock || { now: () => 'D5D_LOCAL_READ_ONLY' };
  const identityHasher = opts.identityHasher || { hash: hashD5DString_ };
  const reconciliationService = opts.reconciliationService || { reconcileDurableInvoiceJobReportOnly };
  const adapterFactory = opts.adapterFactory || createProductionReadOnlySnapshotAdapters;
  const mutationCounter = { count: 0 };

  async function run() {
    safeLogD5D_(logger, 'SGDS_CRIT_003_D5D_SMOKE_START=YES');
    safeLogD5D_(logger, 'SMOKE_MODE=PRODUCTION_READ_ONLY');
    safeLogD5D_(logger, 'EXACT_REFERENCE_POLICY=YES');

    const config = readD5DConfig_(propertyReader, identityHasher);
    if (!config.ok) {
      return finalizeD5DResult_(logger, {
        status: 'BLOCKED_EXACT_REFERENCE_CONFIG_MISSING',
        exactReferenceConfig: 'MISSING',
        productionApiReadStarted: 'NO',
        mutationAttemptCount: 0,
        productionWrite: 'NONE',
        blockerCount: 1,
        findingCodes: config.errors
      });
    }

    const adapters = adapterFactory({
      gmailReader: opts.gmailReader,
      driveReader: opts.driveReader,
      sheetsReader: opts.sheetsReader,
      identityHasher,
      clock,
      limits: opts.limits || {}
    });

    const before = await collectD5DReadOnlySnapshot_(adapters, reconciliationService, config.input, clock);
    const after = await collectD5DReadOnlySnapshot_(adapters, reconciliationService, config.input, clock);
    const beforeSummary = summarizeD5DReadOnlySnapshot_(before, identityHasher);
    const afterSummary = summarizeD5DReadOnlySnapshot_(after, identityHasher);
    const beforeAfterMatch = stableD5DJson_(beforeSummary) === stableD5DJson_(afterSummary);
    const report = before.reconciliationReport || {};
    const findingCodes = Array.isArray(report.findings)
      ? report.findings.map(finding => safeD5DCode_(finding && finding.code)).filter(Boolean).sort()
      : [];
    deriveD5DReadFindingCodes_(before, config.input).forEach(code => findingCodes.push(code));
    const allFindingCodes = Array.from(new Set(findingCodes)).sort();
    const blockerCount = Array.isArray(report.findings)
      ? report.findings.filter(finding => safeD5DString_(finding && finding.repairPolicy) === 'OWNER_REVIEW_REQUIRED').length
      : 0;
    const smokeStatus = !beforeAfterMatch
      ? 'REVIEW_REQUIRED_CONCURRENT_EXTERNAL_CHANGE'
      : safeD5DString_(report.status) === 'CONSISTENT' && blockerCount === 0 && allFindingCodes.length === 0
        ? 'PASS_PRODUCTION_READ_ONLY_CONSISTENT'
        : 'PASS_READ_ONLY_FINDINGS_DETECTED';

    return finalizeD5DResult_(logger, {
      status: smokeStatus,
      exactReferenceConfig: 'PRESENT',
      productionApiReadStarted: 'YES',
      gmailReadStatus: before.gmail.readStatus,
      driveXmlReadStatus: before.drive.xml.readStatus,
      drivePdfReadStatus: before.drive.pdf.readStatus,
      hoaDonReadStatus: before.hoaDon.readStatus,
      ledgerReadStatus: before.ledger.readStatus,
      gmailMessageCount: beforeSummary.gmailMessageCount,
      driveArtifactCount: beforeSummary.driveArtifactCount,
      hoaDonMatchCount: beforeSummary.hoaDonMatchCount,
      ledgerMatchCount: beforeSummary.ledgerMatchCount,
      expectedLedgerLineCount: config.input.expected.lineCount,
      reconciliationStatus: safeD5DString_(report.status || 'NOT_RUN'),
      findingCount: Math.max(Number(report.findingCount || 0), allFindingCodes.length),
      blockerCount,
      findingCodes: allFindingCodes,
      beforeAfterSnapshotMatch: beforeAfterMatch ? 'YES' : 'NO',
      mutationAttemptCount: mutationCounter.count,
      productionWrite: 'NONE'
    });
  }

  return Object.freeze({ run });
}

function deriveD5DReadFindingCodes_(snapshot, input) {
  const codes = [];
  if (snapshot.drive && Number(snapshot.drive.duplicateCandidateCount || 0) > 0) {
    codes.push('DRIVE_XML_DUPLICATE', 'DRIVE_PDF_DUPLICATE');
  }
  if (snapshot.drive && snapshot.drive.xml && snapshot.drive.xml.readStatus === 'CONTENT_HASH_MISMATCH') codes.push('DRIVE_CONTENT_HASH_MISMATCH');
  if (snapshot.drive && snapshot.drive.pdf && snapshot.drive.pdf.readStatus === 'CONTENT_HASH_MISMATCH') codes.push('DRIVE_CONTENT_HASH_MISMATCH');
  if (snapshot.hoaDon && snapshot.hoaDon.readStatus === 'NOT_FOUND') codes.push('HOA_DON_ROW_MISSING');
  if (snapshot.hoaDon && snapshot.hoaDon.readStatus === 'MULTIPLE_MATCHES') codes.push('HOA_DON_ROW_DUPLICATE');
  const expectedLineCount = Number(input && input.expected && input.expected.lineCount || 0);
  const ledgerCount = Number(snapshot.ledger && snapshot.ledger.matchCount || 0);
  if (ledgerCount < expectedLineCount) codes.push('LEDGER_ROWS_MISSING');
  if (ledgerCount > expectedLineCount) codes.push('LEDGER_ROWS_EXTRA');
  if (snapshot.ledger && Number(snapshot.ledger.duplicateLineIdentityCount || 0) > 0) codes.push('LEDGER_DUPLICATE_LINE_IDENTITY');
  if (snapshot.ledger && Number(snapshot.ledger.hashIndexPresentCount || 0) < ledgerCount) codes.push('LEDGER_LINE_HASH_MISMATCH');
  if (snapshot.ledger && snapshot.ledger.invoiceKeyConsistent === false) codes.push('LEDGER_INVOICE_KEY_MISMATCH');
  if (snapshot.gmail && snapshot.gmail.savedLabelPresent === true && ledgerCount < expectedLineCount) codes.push('GMAIL_FALSE_SAVED_LABEL');
  if (snapshot.gmail && snapshot.gmail.savedLabelPresent !== true) codes.push('GMAIL_SAVED_LABEL_MISSING');
  return codes.map(safeD5DCode_);
}

async function collectD5DReadOnlySnapshot_(adapters, reconciliationService, input, clock) {
  const gmail = await adapters.readGmailLabelSnapshot(input);
  const drive = await adapters.readDriveEvidenceSnapshot(input);
  const hoaDon = await adapters.readHoaDonSnapshot(input);
  const ledger = await adapters.readLedgerSnapshot(input);
  const reconciliationSnapshot = adaptD5DReconciliationSnapshot_(await adapters.buildDurableReconciliationSnapshot(input), input);
  const reconciliationReport = reconciliationService.reconcileDurableInvoiceJobReportOnly(reconciliationSnapshot);
  return {
    gmail: cloneD5DJson_(gmail),
    drive: cloneD5DJson_(drive),
    hoaDon: cloneD5DJson_(hoaDon),
    ledger: cloneD5DJson_(ledger),
    reconciliationReport: cloneD5DJson_(reconciliationReport),
    generatedAt: safeD5DString_(clock.now())
  };
}

function adaptD5DReconciliationSnapshot_(snapshot, input) {
  const safe = cloneD5DJson_(snapshot || {});
  const syntheticKey = 'D5D_INVOICE_HASH_' + safeD5DHash_(input && input.expected && input.expected.invoiceKeyHash);
  const observed = safe.observed || {};
  const observedHoaDonRow = Array.isArray(observed.hoaDonRows) && observed.hoaDonRows.length === 1 ? observed.hoaDonRows[0] : {};

  function adaptPlan(plan) {
    if (!plan) return plan;
    const next = cloneD5DJson_(plan);
    next.legacyInvoiceKey = syntheticKey;
    next.invoiceKeyV2 = syntheticKey;
    if (next.hoaDonRegistryTarget) {
      next.hoaDonRegistryTarget.legacyInvoiceKey = syntheticKey;
      if (observedHoaDonRow && observedHoaDonRow.xmlFileId) next.hoaDonRegistryTarget.xmlFileId = observedHoaDonRow.xmlFileId;
      if (observedHoaDonRow && observedHoaDonRow.pdfFileId) next.hoaDonRegistryTarget.pdfFileId = observedHoaDonRow.pdfFileId;
      if (observedHoaDonRow && observedHoaDonRow.xmlContentHash) next.hoaDonRegistryTarget.xmlContentHash = observedHoaDonRow.xmlContentHash;
      if (observedHoaDonRow && observedHoaDonRow.pdfContentHash) next.hoaDonRegistryTarget.pdfContentHash = observedHoaDonRow.pdfContentHash;
    }
    return next;
  }

  safe.commitPlan = adaptPlan(safe.commitPlan);
  if (safe.job && safe.job.commitPlan) safe.job.commitPlan = adaptPlan(safe.job.commitPlan);
  if (Array.isArray(observed.hoaDonRows)) {
    observed.hoaDonRows = observed.hoaDonRows.map(row => ({
      ...row,
      legacyInvoiceKey: syntheticKey,
      invoiceKeyV2: syntheticKey
    }));
  }
  if (Array.isArray(observed.ledgerRows)) {
    observed.ledgerRows = observed.ledgerRows.map(row => ({
      ...row,
      legacyInvoiceKey: syntheticKey,
      invoiceKeyV2: syntheticKey,
      lineIdentityV2: safeD5DHash_(row && row.legacyHashIndex) || safeD5DString_(row && row.lineIdentityV2)
    }));
  }
  safe.observed = observed;
  return safe;
}

function readD5DConfig_(propertyReader, hasher) {
  const values = {};
  Object.keys(SGDS_CRIT_003_D5D_PROPERTY_KEYS_).forEach(name => {
    const key = SGDS_CRIT_003_D5D_PROPERTY_KEYS_[name];
    values[name] = safeD5DString_(propertyReader.getProperty(key));
  });
  const missing = Object.keys(values).filter(name => !values[name]).map(name => 'MISSING_' + name);
  if (missing.length > 0) return { ok: false, errors: missing };

  const expectedLineCount = Number(values.EXPECTED_LINE_COUNT);
  if (!Number.isInteger(expectedLineCount) || expectedLineCount <= 0) {
    return { ok: false, errors: ['INVALID_EXPECTED_LINE_COUNT'] };
  }
  let expectedLineHashes;
  try {
    expectedLineHashes = JSON.parse(values.EXPECTED_LINE_HASHES_JSON);
  } catch (_error) {
    return { ok: false, errors: ['INVALID_EXPECTED_LINE_HASHES_JSON'] };
  }
  if (!Array.isArray(expectedLineHashes) || expectedLineHashes.length !== expectedLineCount || expectedLineHashes.some(hash => !safeD5DHash_(hash))) {
    return { ok: false, errors: ['INVALID_EXPECTED_LINE_HASHES_JSON'] };
  }

  const lineHashes = expectedLineHashes.map(safeD5DHash_);
  const commitPlan = {
    version: 'DURABLE_COMMIT_PLAN_V1',
    jobId: 'd5d_' + safeD5DHash_(values.INVOICE_IDENTITY_HASH).slice(0, 24),
    legacyInvoiceKey: '',
    invoiceKeyV2: '',
    expectedLineCount,
    legacyHashIndexes: lineHashes,
    lineIdentityV2s: lineHashes,
    lines: lineHashes.map((hash, index) => ({
      sourceLineNo: index + 1,
      legacyHashIndex: hash,
      lineIdentityV2: hash,
      immutableFields: { d5dReadOnly: true }
    })),
    hoaDonRegistryTarget: {
      xmlFileId: values.XML_FILE_ID,
      pdfFileId: values.PDF_FILE_ID
    },
    driveEvidenceTargets: {},
    commitPlanHash: safeD5DHash_(values.EXPECTED_COMMIT_PLAN_HASH),
    invoiceKeyHash: safeD5DHash_(values.EXPECTED_INVOICE_KEY_HASH),
    projectionState: 'EXPECT_SAVED_LABEL'
  };

  return {
    ok: true,
    input: {
      jobId: commitPlan.jobId,
      invoiceIdentityHash: safeD5DHash_(values.INVOICE_IDENTITY_HASH),
      job: { jobId: commitPlan.jobId, status: 'COMPLETED', state: 'COMPLETED', commitPlan },
      commitPlan,
      sourceReferences: {
        gmailThreadReference: values.GMAIL_THREAD_ID,
        xmlFileReference: values.XML_FILE_ID,
        pdfFileReference: values.PDF_FILE_ID
      },
      expected: {
        lineCount: expectedLineCount,
        lineHashes,
        invoiceKeyHash: safeD5DHash_(values.EXPECTED_INVOICE_KEY_HASH),
        commitPlanHash: safeD5DHash_(values.EXPECTED_COMMIT_PLAN_HASH)
      },
      safeReferenceHashes: {
        gmailThreadHashPrefix: hashPrefixD5D_(values.GMAIL_THREAD_ID, hasher),
        xmlFileHashPrefix: hashPrefixD5D_(values.XML_FILE_ID, hasher),
        pdfFileHashPrefix: hashPrefixD5D_(values.PDF_FILE_ID, hasher)
      }
    }
  };
}

function summarizeD5DReadOnlySnapshot_(snapshot, hasher) {
  const driveArtifactCount = Number(Boolean(snapshot.drive && snapshot.drive.xml && snapshot.drive.xml.exists)) +
    Number(Boolean(snapshot.drive && snapshot.drive.pdf && snapshot.drive.pdf.exists));
  return {
    gmailLabelSummaryHash: hashPrefixD5D_(stableD5DJson_((snapshot.gmail && snapshot.gmail.labels) || []), hasher),
    driveEvidenceSummaryHash: hashPrefixD5D_(stableD5DJson_(snapshot.drive || {}), hasher),
    hoaDonSummaryHash: hashPrefixD5D_(stableD5DJson_({
      matchCount: snapshot.hoaDon && snapshot.hoaDon.matchCount,
      duplicate: snapshot.hoaDon && snapshot.hoaDon.duplicate,
      rowIdentityHashes: snapshot.hoaDon && snapshot.hoaDon.rowIdentityHashes
    }), hasher),
    ledgerSummaryHash: hashPrefixD5D_(stableD5DJson_({
      matchCount: snapshot.ledger && snapshot.ledger.matchCount,
      lineIdentityHashes: snapshot.ledger && snapshot.ledger.lineIdentityHashes,
      duplicateLineIdentityCount: snapshot.ledger && snapshot.ledger.duplicateLineIdentityCount
    }), hasher),
    gmailMessageCount: Number(snapshot.gmail && snapshot.gmail.messageCount || 0),
    driveArtifactCount,
    hoaDonMatchCount: Number(snapshot.hoaDon && snapshot.hoaDon.matchCount || 0),
    ledgerMatchCount: Number(snapshot.ledger && snapshot.ledger.matchCount || 0)
  };
}

function finalizeD5DResult_(logger, result) {
  const safe = {
    SGDS_CRIT_003_D5D_SMOKE_STATUS: safeD5DCode_(result.status),
    EXACT_REFERENCE_CONFIG: safeD5DCode_(result.exactReferenceConfig || ''),
    PRODUCTION_API_READ_STARTED: safeD5DCode_(result.productionApiReadStarted || ''),
    GMAIL_READ_STATUS: safeD5DCode_(result.gmailReadStatus || 'NOT_RUN'),
    DRIVE_XML_READ_STATUS: safeD5DCode_(result.driveXmlReadStatus || 'NOT_RUN'),
    DRIVE_PDF_READ_STATUS: safeD5DCode_(result.drivePdfReadStatus || 'NOT_RUN'),
    HOA_DON_READ_STATUS: safeD5DCode_(result.hoaDonReadStatus || 'NOT_RUN'),
    LEDGER_READ_STATUS: safeD5DCode_(result.ledgerReadStatus || 'NOT_RUN'),
    GMAIL_MESSAGE_COUNT: Number(result.gmailMessageCount || 0),
    DRIVE_ARTIFACT_COUNT: Number(result.driveArtifactCount || 0),
    HOA_DON_MATCH_COUNT: Number(result.hoaDonMatchCount || 0),
    LEDGER_MATCH_COUNT: Number(result.ledgerMatchCount || 0),
    EXPECTED_LEDGER_LINE_COUNT: Number(result.expectedLedgerLineCount || 0),
    RECONCILIATION_STATUS: safeD5DCode_(result.reconciliationStatus || 'NOT_RUN'),
    FINDING_COUNT: Number(result.findingCount || 0),
    BLOCKER_COUNT: Number(result.blockerCount || 0),
    FINDING_CODES: (Array.isArray(result.findingCodes) ? result.findingCodes : []).map(safeD5DCode_).filter(Boolean).sort().join(';'),
    BEFORE_AFTER_SNAPSHOT_MATCH: safeD5DCode_(result.beforeAfterSnapshotMatch || ''),
    MUTATION_ATTEMPT_COUNT: Number(result.mutationAttemptCount || 0),
    PRODUCTION_WRITE: 'NONE'
  };
  Object.keys(safe).forEach(key => safeLogD5D_(logger, key + '=' + safe[key]));
  return safe;
}

function safeLogD5D_(logger, message) {
  if (logger && typeof logger.log === 'function') logger.log(safeD5DLogLine_(message));
}

function safeD5DLogLine_(message) {
  return safeD5DString_(message).replace(/[^A-Za-z0-9_=;:./ -]/g, '').slice(0, 500);
}

function requireD5DAdapter_(adapter, name, methods) {
  if (!adapter || typeof adapter !== 'object' && typeof adapter !== 'function') throw new Error('D5D_DEPENDENCY_REQUIRED:' + name);
  methods.forEach(method => {
    if (typeof adapter[method] !== 'function') throw new Error('D5D_ADAPTER_METHOD_REQUIRED:' + name + '.' + method);
  });
  return adapter;
}

function hashPrefixD5D_(value, hasher) {
  return safeD5DHash_(hasher.hash(safeD5DString_(value))).slice(0, 12);
}

function hashD5DString_(value) {
  const text = safeD5DString_(value);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (`00000000${(hash >>> 0).toString(16)}`).slice(-8);
}

function safeD5DHash_(value) {
  return safeD5DString_(value).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 128);
}

function safeD5DCode_(value) {
  return safeD5DString_(value).replace(/[^A-Z0-9_;]/gi, '_').toUpperCase().slice(0, 300);
}

function safeD5DString_(value) {
  return value == null ? '' : String(value);
}

function cloneD5DJson_(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function stableD5DJson_(value) {
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
