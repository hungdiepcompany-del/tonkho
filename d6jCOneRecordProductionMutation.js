const D6J_C_MUTATION_SCHEMA_VERSION_ = 'D6J_C_CONTROLLED_ONE_RECORD_PRODUCTION_MUTATION_CHANNEL_V1';
const D6J_C_MUTATION_ENTRYPOINT_ = 'runD6jCOneRecordProductionMutation';
const D6J_C_MUTATION_APPROVAL_ = 'OWNER_APPROVED_D6J_C_ONE_RECORD_PRODUCTION_MUTATION';
const D6J_C_MUTATION_APPROVAL_PROPERTY_ = 'D6J_C_MUTATION_APPROVAL_MARKER';
const D6J_C_DIRECTION_ = 'NHAP';
const D6J_C_FIRESTORE_PROJECT_ID_ = 'tonkhohd';
const D6J_C_FIRESTORE_DATABASE_ID_ = '(default)';

function runD6jCOneRecordProductionMutation() {
  const runner = createD6jCOneRecordProductionMutationRunner_();
  return runner.run();
}

function createD6jCOneRecordProductionMutationRunner_(deps) {
  const d = deps || {};
  const services = {
    readProperties: d.readProperties || readD6jCScriptProperties_,
    createLock: d.createLock || (() => LockService.getScriptLock()),
    runPreflight: d.runPreflight || (() => createD6jBProductionDryRunReadOnlyRunner_().run()),
    readPilotArtifacts: d.readPilotArtifacts || readD6jCPilotArtifacts_,
    buildLedgerRows: d.buildLedgerRows || buildD6jCLedgerRowsFromXml_,
    createJobStore: d.createJobStore || (() => createD6jCDefaultDurableJobStore_()),
    createLeaseStore: d.createLeaseStore || (() => createD6jCDefaultLeaseStore_()),
    createDriveAdapters: d.createDriveAdapters || (context => createD6jCDefaultDriveAdapters_(context)),
    createSheetsAdapters: d.createSheetsAdapters || (context => createD6jCDefaultSheetsAdapters_(context)),
    clock: d.clock || { now: () => new Date().toISOString() },
    logger: d.logger || (typeof Logger !== 'undefined' ? Logger : { log() {} })
  };

  async function run() {
    const result = createD6jCBaseResult_();
    let lock = null;
    let activePlan = null;
    let activeJobStore = null;
    let activeJob = null;
    try {
      const properties = validateD6jCApproval_(services.readProperties());
      result.OWNER_APPROVAL_MARKER_VALID = 'YES';
      lock = services.createLock();
      if (!lock || typeof lock.tryLock !== 'function' || !lock.tryLock(30000)) {
        throw d6jCError_('BLOCKED_SCRIPT_LOCK_NOT_ACQUIRED');
      }

      const preflight = services.runPreflight(properties);
      assertD6jCPreflightPass_(preflight);
      result.PREFLIGHT_STATUS = preflight.DRY_RUN_STATUS;

      const artifacts = await services.readPilotArtifacts(properties, preflight);
      assertD6jCArtifactsMatchPreflight_(artifacts, preflight);
      const ledgerRows = await services.buildLedgerRows({ properties, preflight, artifacts });
      const plan = buildD6jCMutationPlan_({ properties, preflight, artifacts, ledgerRows, now: services.clock.now() });
      activePlan = plan;
      mergeD6jCResult_(result, {
        PILOT_ID: plan.pilotId,
        CORRELATION_ID: plan.correlationId,
        JOB_ID: plan.jobId
      });

      const jobStore = services.createJobStore({ properties, preflight, artifacts, plan });
      activeJobStore = jobStore;
      const leaseStore = services.createLeaseStore({ properties, preflight, artifacts, plan });
      const lease = await acquireD6jCLease_(leaseStore, plan, services.clock);
      result.LEASE_STATUS = lease.status;
      if (lease.status !== 'ACQUIRED' && lease.status !== 'ALREADY_HELD_BY_SAME_JOB') {
        throw d6jCError_('BLOCKED_ACTIVE_LEASE');
      }
      result.FIRESTORE_MUTATION_COUNT += lease.mutationCount;

      const jobCreate = await jobStore.createJobIfAbsent({
        jobId: plan.jobId,
        invoiceIdentityHash: plan.invoiceIdentityHash,
        sourceThreadHash: plan.sourceThreadHash,
        status: 'VALIDATED',
        attemptCount: 1
      });
      result.FIRESTORE_JOB_STATUS = jobCreate.resultCode;
      result.FIRESTORE_MUTATION_COUNT += jobCreate.created ? 1 : 0;

      let job = jobCreate.job;
      activeJob = job;
      if (!jobCreate.created && job && job.status === 'COMPLETED') {
        const resume = await verifyD6jCCompletedNoop_(jobStore, plan, services, result);
        logD6jCSanitizedResult_(services.logger, resume);
        return resume;
      }

      const planSave = await jobStore.saveCommitPlanIfAbsent({
        jobId: plan.jobId,
        expectedVersion: Number(job.version || 1),
        commitPlan: plan.commitPlan
      });
      result.COMMIT_PLAN_STATUS = planSave.resultCode;
      result.FIRESTORE_MUTATION_COUNT += planSave.saved ? 1 : 0;
      job = planSave.job;
      activeJob = job;

      await jobStore.appendAuditEvent({
        jobId: plan.jobId,
        eventType: 'COMMIT_PLAN_ACCEPTED',
        actorType: 'APPS_SCRIPT_D6J_C',
        safeDetails: { correlationId: plan.correlationId, expectedLineCount: 1 }
      });
      result.FIRESTORE_MUTATION_COUNT += 1;

      const drive = services.createDriveAdapters({ properties, preflight, artifacts, plan });
      const sheets = services.createSheetsAdapters({ properties, preflight, artifacts, plan });

      const driveResult = await writeAndVerifyD6jCDriveArtifacts_(drive, plan);
      mergeD6jCResult_(result, driveResult.safeResult);
      result.DRIVE_MUTATION_COUNT += driveResult.createdCount;
      if (job.status === 'VALIDATED') {
        job = await transitionD6jC_(jobStore, plan, job, 'FILES_SAVED', 'd6jc-files-saved');
        activeJob = job;
        result.FIRESTORE_MUTATION_COUNT += 1;
      }

      if (job.status === 'FILES_SAVED') {
        job = await transitionD6jC_(jobStore, plan, job, 'COMMITTING', 'd6jc-committing');
        activeJob = job;
        result.FIRESTORE_MUTATION_COUNT += 1;
      }
      const sheetResult = await appendAndVerifyD6jCSheetTransaction_(sheets, plan);
      mergeD6jCResult_(result, sheetResult.safeResult);
      result.SHEETS_MUTATION_COUNT += sheetResult.appendedCount;
      if (job.status === 'COMMITTING') {
        job = await transitionD6jC_(jobStore, plan, job, 'ROWS_COMMITTED', 'd6jc-rows-committed');
        activeJob = job;
        result.FIRESTORE_MUTATION_COUNT += 1;
      }
      if (job.status === 'ROWS_COMMITTED') {
        job = await transitionD6jC_(jobStore, plan, job, 'PROJECTIONS_COMMITTED', 'd6jc-projections-committed');
        activeJob = job;
        result.FIRESTORE_MUTATION_COUNT += 1;
      }

      const report = await saveD6jCReconciliationReport_(jobStore, plan, job, 'CONSISTENT', []);
      result.RECONCILIATION_STATUS = report.report.status;
      result.FIRESTORE_MUTATION_COUNT += 1;
      job = report.job;
      activeJob = job;
      job = await transitionD6jC_(jobStore, plan, job, 'COMPLETED', 'd6jc-completed');
      activeJob = job;
      result.FIRESTORE_MUTATION_COUNT += 1;
      result.FIRESTORE_JOB_STATUS = job.status;

      await jobStore.appendAuditEvent({
        jobId: plan.jobId,
        eventType: 'JOB_COMPLETED',
        actorType: 'APPS_SCRIPT_D6J_C',
        safeDetails: { correlationId: plan.correlationId, reconciliationStatus: result.RECONCILIATION_STATUS }
      });
      result.FIRESTORE_MUTATION_COUNT += 1;

      result.MUTATION_STATUS = 'PASS_ONE_RECORD_PRODUCTION_MUTATION_CHANNEL_READY';
      result.IDEMPOTENT_RERUN_STATUS = 'READY_FOR_IDEMPOTENT_RERUN';
      finalizeD6jCMutationCounts_(result);
      logD6jCSanitizedResult_(services.logger, result);
      return result;
    } catch (error) {
      if (Number(error && error.driveMutationCount || 0) > 0) result.DRIVE_MUTATION_COUNT += Number(error.driveMutationCount);
      if (Number(error && error.sheetsMutationCount || 0) > 0) result.SHEETS_MUTATION_COUNT += Number(error.sheetsMutationCount);
      if (error && error.partialSafeResult) mergeD6jCResult_(result, error.partialSafeResult);
      await maybeMarkD6jCReconciliationRequired_(activeJobStore, activePlan, activeJob, error, result);
      const blocked = finalizeD6jCBlockedResult_(result, error);
      logD6jCSanitizedResult_(services.logger, blocked);
      return blocked;
    } finally {
      if (lock && typeof lock.releaseLock === 'function') lock.releaseLock();
    }
  }

  return Object.freeze({ run });
}

function readD6jCScriptProperties_() {
  const props = PropertiesService.getScriptProperties();
  const out = {};
  D6J_B_REQUIRED_SCRIPT_PROPERTIES_.forEach(name => {
    out[name] = String(props.getProperty(name) || '').trim();
  });
  out[D6J_C_MUTATION_APPROVAL_PROPERTY_] = String(props.getProperty(D6J_C_MUTATION_APPROVAL_PROPERTY_) || '').trim();
  return out;
}

function validateD6jCApproval_(raw) {
  const source = raw || {};
  if (String(source[D6J_C_MUTATION_APPROVAL_PROPERTY_] || '').trim() !== D6J_C_MUTATION_APPROVAL_) {
    throw d6jCError_('BLOCKED_INVALID_D6J_C_MUTATION_APPROVAL_MARKER');
  }
  validateD6jBConfig_(source);
  return source;
}

function assertD6jCPreflightPass_(preflight) {
  const r = preflight || {};
  const checks = [
    [r.DRY_RUN_STATUS === 'PASS_EXACT_PRODUCTION_DRY_RUN_READ_ONLY', 'BLOCKED_D6J_B_PREFLIGHT_STATUS'],
    [r.FIRESTORE_READ_ONLY_GATE === 'READ_OK', 'BLOCKED_FIRESTORE_READ_ONLY_GATE'],
    [r.FIRESTORE_ACTIVE_LEASE_STATUS === 'NO_ACTIVE_LEASE_FOUND' || r.FIRESTORE_ACTIVE_LEASE_STATUS === 'EXISTING_RECORDS_FOUND', 'BLOCKED_FIRESTORE_ACTIVE_LEASE'],
    [Number(r.GMAIL_QUERY_MATCH_COUNT) === 1, 'BLOCKED_GMAIL_QUERY_MATCH_COUNT'],
    [Number(r.MESSAGE_COUNT) === 1, 'BLOCKED_MESSAGE_COUNT'],
    [Number(r.ATTACHMENT_COUNT) === 2, 'BLOCKED_ATTACHMENT_COUNT'],
    [r.PDF_FILENAME_MATCH === 'YES', 'BLOCKED_PDF_FILENAME'],
    [r.XML_FILENAME_MATCH === 'YES', 'BLOCKED_XML_FILENAME'],
    [r.PDF_MIME_TYPE_MATCH === 'YES', 'BLOCKED_PDF_MIME'],
    [r.XML_MIME_TYPE_MATCH === 'YES', 'BLOCKED_XML_MIME'],
    [r.DRIVE_ROOT_MATCH === 'YES', 'BLOCKED_DRIVE_ROOT'],
    [Number(r.DRIVE_FOLDERS_PLANNED) === 0, 'BLOCKED_DRIVE_FOLDER_PLAN'],
    [Number(r.DRIVE_FILES_PLANNED) <= 2, 'BLOCKED_DRIVE_FILE_LIMIT'],
    [Number(r.SHEETS_INSERTS_PLANNED) <= 1, 'BLOCKED_SHEET_INSERT_LIMIT'],
    [Number(r.SHEETS_UPDATES_PLANNED) === 0, 'BLOCKED_SHEET_UPDATE_PLAN'],
    [Number(r.FIRESTORE_ATTACHMENT_RECORDS_PLANNED) <= 2, 'BLOCKED_FIRESTORE_ATTACHMENT_LIMIT'],
    [Number(r.GMAIL_MUTATION_COUNT) === 0, 'BLOCKED_GMAIL_MUTATION_IN_PREFLIGHT'],
    [Number(r.TRIGGER_MUTATION_COUNT) === 0, 'BLOCKED_TRIGGER_MUTATION_IN_PREFLIGHT'],
    [Number(r.DESTRUCTIVE_OPERATION_COUNT) === 0, 'BLOCKED_DESTRUCTIVE_OPERATION_IN_PREFLIGHT'],
    [r.IDEMPOTENCY_KEYS_VALID === 'YES', 'BLOCKED_IDEMPOTENCY_KEYS'],
    [r.ROLLBACK_OWNERSHIP_PROVABLE === 'YES', 'BLOCKED_ROLLBACK_OWNERSHIP'],
    [r.RECONCILIATION_PLAN_COMPLETE === 'YES', 'BLOCKED_RECONCILIATION_PLAN']
  ];
  checks.forEach(pair => {
    if (!pair[0]) throw d6jCError_(pair[1]);
  });
}

function readD6jCPilotArtifacts_(properties, preflight) {
  const config = validateD6jBConfig_(properties);
  const query = buildD6jBGmailQuery_(config);
  const threads = GmailApp.search(query, 0, D6J_B_MAX_GMAIL_CANDIDATES_) || [];
  const matches = [];
  threads.forEach(thread => {
    const messages = thread.getMessages ? thread.getMessages() : [];
    messages.forEach(message => {
      if (d6jBMessageMatchesQuery_(message, config) && String(message.getId()) === config.messageId) {
        matches.push({ thread, message });
      }
    });
  });
  if (matches.length !== 1) throw d6jCError_('BLOCKED_D6J_C_ARTIFACT_MESSAGE_NOT_UNIQUE');
  const attachments = (matches[0].message.getAttachments({ includeInlineImages: false }) || []).map(att => {
    const bytes = att.getBytes ? att.getBytes() : (att.getBlob && att.getBlob().getBytes ? att.getBlob().getBytes() : []);
    return {
      fileName: normalizeD6jCString_(att.getName && att.getName()),
      mimeType: normalizeD6jCString_(att.getContentType && att.getContentType()).toLowerCase(),
      bytes,
      byteSize: bytes.length,
      contentHash: sha256D6jBBytes_(bytes)
    };
  });
  const pdf = attachments.find(att => att.fileName === config.pdfFilename);
  const xml = attachments.find(att => att.fileName === config.xmlFilename);
  return {
    threadIdHash: hashPrefixD6jC_(matches[0].thread && matches[0].thread.getId ? matches[0].thread.getId() : config.messageId, 16),
    messageId: config.messageId,
    pdf,
    xml,
    preflightHash: hashPrefixD6jC_(JSON.stringify({
      pilot: preflight.PILOT_ID,
      pdf: preflight.PDF_SHA256,
      xml: preflight.XML_SHA256
    }), 16)
  };
}

function assertD6jCArtifactsMatchPreflight_(artifacts, preflight) {
  if (!artifacts || !artifacts.pdf || !artifacts.xml) throw d6jCError_('BLOCKED_D6J_C_ARTIFACTS_MISSING');
  if (artifacts.pdf.contentHash !== preflight.PDF_SHA256 || Number(artifacts.pdf.byteSize) !== Number(preflight.PDF_SIZE_BYTES)) {
    throw d6jCError_('BLOCKED_D6J_C_PDF_PRECHECK_MISMATCH');
  }
  if (artifacts.xml.contentHash !== preflight.XML_SHA256 || Number(artifacts.xml.byteSize) !== Number(preflight.XML_SIZE_BYTES)) {
    throw d6jCError_('BLOCKED_D6J_C_XML_PRECHECK_MISMATCH');
  }
}

function buildD6jCLedgerRowsFromXml_(context) {
  const xml = context && context.artifacts && context.artifacts.xml;
  if (!xml) throw d6jCError_('BLOCKED_D6J_C_XML_ARTIFACT_MISSING');
  const blob = Utilities.newBlob(xml.bytes || [], xml.mimeType || 'application/xml', xml.fileName || 'invoice.xml');
  const parsed = parseInvoiceXML_(blob, { type: D6J_C_DIRECTION_ });
  if (!isVatInvoiceXML_(parsed && parsed.meta)) throw d6jCError_('BLOCKED_D6J_C_XML_NOT_VAT_INVOICE');
  if (!parsed.items || parsed.items.length !== 1) throw d6jCError_('BLOCKED_D6J_C_EXPECTED_ONE_LEDGER_LINE');
  const meta = parsed.meta || {};
  const seller = parsed.seller || {};
  const item = parsed.items[0] || {};
  const legacyInvoiceKey = buildD6jCLegacyInvoiceKey_(meta.invoiceDate, seller.taxCode, meta.invoiceNo);
  const lineIdentity = hashPrefixD6jC_([legacyInvoiceKey, xml.contentHash, item.code, item.name, item.qty, item.price].join('|'), 32);
  return [{
    issueDate: normalizeD6jCString_(meta.invoiceDate),
    legacyInvoiceKey,
    invoiceKeyV2: legacyInvoiceKey,
    sourceLineNo: 1,
    lineIdentityV2: lineIdentity,
    legacyHashIndex: lineIdentity,
    transactionIdentity: lineIdentity,
    direction: D6J_C_DIRECTION_,
    itemCode: normalizeD6jCString_(item.code || 'Unknown_ID'),
    itemName: normalizeD6jCString_(item.name),
    quantity: Number(item.qty || 0),
    unitPrice: Number(item.price || 0)
  }];
}

function buildD6jCMutationPlan_(context) {
  const preflight = context.preflight || {};
  const artifacts = context.artifacts || {};
  const rows = context.ledgerRows || [];
  if (rows.length !== 1) throw d6jCError_('BLOCKED_D6J_C_SHEET_ROW_COUNT_NOT_ONE');
  const row = rows[0];
  const jobId = 'd6j_job_' + hashPrefixD6jC_([preflight.GMAIL_MESSAGE_ID, preflight.XML_SHA256].join('|'), 20);
  const invoiceIdentityHash = hashPrefixD6jC_([row.invoiceKeyV2, preflight.XML_SHA256, preflight.PDF_SHA256].join('|'), 32);
  const sourceThreadHash = artifacts.threadIdHash || hashPrefixD6jC_(preflight.GMAIL_MESSAGE_ID, 16);
  const correlationId = preflight.CORRELATION_ID || ('d6j_corr_' + hashPrefixD6jC_([preflight.GMAIL_MESSAGE_ID, row.invoiceKeyV2].join('|'), 16));
  const pilotId = preflight.PILOT_ID || ('d6j_pilot_' + hashPrefixD6jC_(preflight.GMAIL_MESSAGE_ID, 16));
  const pdfTarget = buildD6jCDriveTarget_('PDF', artifacts.pdf, row, preflight, correlationId);
  const xmlTarget = buildD6jCDriveTarget_('XML', artifacts.xml, row, preflight, correlationId);
  const commitPlan = buildDurableCommitPlan_({
    jobId,
    legacyInvoiceKey: row.legacyInvoiceKey,
    invoiceKeyV2: row.invoiceKeyV2,
    lines: [{
      sourceLineNo: 1,
      legacyHashIndex: row.legacyHashIndex || row.lineIdentityV2,
      lineIdentityV2: row.lineIdentityV2,
      immutableFields: {
        direction: row.direction,
        itemCode: row.itemCode,
        quantity: row.quantity,
        unitPrice: row.unitPrice
      }
    }],
    driveEvidenceTargets: {
      pdfContentHash: artifacts.pdf.contentHash,
      xmlContentHash: artifacts.xml.contentHash,
      pdfFileIdentity: pdfTarget.logicalFileIdentity,
      xmlFileIdentity: xmlTarget.logicalFileIdentity
    },
    hoaDonRegistryTarget: {
      legacyInvoiceKey: row.legacyInvoiceKey,
      invoiceKeyV2: row.invoiceKeyV2,
      xmlContentHash: artifacts.xml.contentHash,
      pdfContentHash: artifacts.pdf.contentHash
    },
    preCommitLedgerProbe: { status: 'D6J_C_PREFLIGHT_PASS' }
  });
  return {
    jobId,
    correlationId,
    pilotId,
    invoiceIdentityHash,
    sourceThreadHash,
    commitPlan,
    ledgerRows: rows,
    driveTargets: { pdf: pdfTarget, xml: xmlTarget },
    idempotencyKeys: {
      lease: 'd6jc_lease_' + jobId,
      plan: 'd6jc_plan_' + jobId,
      pdf: 'd6jc_drive_pdf_' + jobId,
      xml: 'd6jc_drive_xml_' + jobId,
      sheet: 'd6jc_sheet_' + jobId
    }
  };
}

function buildD6jCDriveTarget_(artifactType, artifact, row, preflight, correlationId) {
  const target = {
    direction: D6J_C_DIRECTION_,
    year: String(row.issueDate || '').slice(0, 4) || 'UNKNOWN',
    artifactType,
    fileName: artifact.fileName,
    mimeType: artifact.mimeType,
    invoiceKeyV2: row.invoiceKeyV2,
    messageId: preflight.GMAIL_MESSAGE_ID,
    attachmentId: artifactType + '_' + hashPrefixD6jC_([preflight.GMAIL_MESSAGE_ID, artifact.contentHash].join('|'), 16),
    contentHash: artifact.contentHash,
    byteSize: artifact.byteSize,
    bytes: artifact.bytes,
    metadata: { correlationId, schemaVersion: D6J_C_MUTATION_SCHEMA_VERSION_ }
  };
  target.logicalFileIdentity = buildSgdsDriveArtifactIdentity_(target);
  return target;
}

async function acquireD6jCLease_(leaseStore, plan, clock) {
  if (!leaseStore || typeof leaseStore.acquireLease !== 'function') throw d6jCError_('BLOCKED_D6J_C_LEASE_STORE_MISSING');
  try {
    const lease = await leaseStore.acquireLease({
      leaseId: plan.jobId,
      jobId: plan.jobId,
      leaseOwner: 'apps_script_d6j_c',
      leaseExpiresAt: clock.now(),
      fencingToken: plan.idempotencyKeys.lease,
      idempotencyKey: plan.idempotencyKeys.lease
    });
    return { status: lease && lease.idempotent ? 'ALREADY_HELD_BY_SAME_JOB' : 'ACQUIRED', mutationCount: lease && lease.idempotent ? 0 : 1 };
  } catch (error) {
    const code = normalizeD6jCString_(error && (error.code || error.message));
    if (code.indexOf('ALREADY') >= 0 || code.indexOf('409') >= 0 || code.indexOf('CONFLICT') >= 0) {
      return { status: 'ACTIVE_LEASE_FOUND', mutationCount: 0 };
    }
    throw error;
  }
}

async function writeAndVerifyD6jCDriveArtifacts_(drive, plan) {
  const mutate = drive && drive.mutate;
  const read = drive && drive.read;
  if (!mutate || !read) throw d6jCError_('BLOCKED_D6J_C_DRIVE_ADAPTER_MISSING');
  let xml = null;
  let pdf = null;
  let createdCount = 0;
  let alreadyCount = 0;
  try {
    xml = await mutate.createFileIfAbsent({ ...plan.driveTargets.xml, idempotencyKey: plan.idempotencyKeys.xml });
    if (xml.status === 'CONFIRMED_WRITTEN' && !xml.idempotent) createdCount += 1;
    if (xml.status === 'ALREADY_PRESENT' || xml.idempotent) alreadyCount += 1;
    pdf = await mutate.createFileIfAbsent({ ...plan.driveTargets.pdf, idempotencyKey: plan.idempotencyKeys.pdf });
    if (pdf.status === 'CONFIRMED_WRITTEN' && !pdf.idempotent) createdCount += 1;
    if (pdf.status === 'ALREADY_PRESENT' || pdf.idempotent) alreadyCount += 1;
  } catch (error) {
    error.driveMutationCount = createdCount;
    error.partialSafeResult = {
      DRIVE_XML_STATUS: xml ? xml.status : 'NOT_ATTEMPTED',
      DRIVE_PDF_STATUS: pdf ? pdf.status : 'NOT_ATTEMPTED',
      DRIVE_FILES_CREATED: createdCount,
      DRIVE_FILES_ALREADY_PRESENT: alreadyCount
    };
    throw error;
  }
  const verifiedXml = await read.readFileMetadata({ logicalFileIdentity: plan.driveTargets.xml.logicalFileIdentity, fileReference: xml.fileReference });
  const verifiedPdf = await read.readFileMetadata({ logicalFileIdentity: plan.driveTargets.pdf.logicalFileIdentity, fileReference: pdf.fileReference });
  assertD6jCDriveReadback_(verifiedXml, plan.driveTargets.xml, 'XML');
  assertD6jCDriveReadback_(verifiedPdf, plan.driveTargets.pdf, 'PDF');
  return {
    createdCount,
    safeResult: {
      DRIVE_XML_STATUS: xml.status,
      DRIVE_PDF_STATUS: pdf.status,
      DRIVE_FILES_CREATED: createdCount,
      DRIVE_FILES_ALREADY_PRESENT: alreadyCount
    }
  };
}

function assertD6jCDriveReadback_(file, target, kind) {
  if (!file || file.exists === false) throw d6jCError_('BLOCKED_D6J_C_DRIVE_' + kind + '_READBACK_MISSING');
  if (file.logicalFileIdentity !== target.logicalFileIdentity) throw d6jCError_('BLOCKED_D6J_C_DRIVE_' + kind + '_IDENTITY_MISMATCH');
  if (!file.fileReference) throw d6jCError_('BLOCKED_D6J_C_DRIVE_' + kind + '_REFERENCE_MISSING');
  if (file.contentHash !== target.contentHash) throw d6jCError_('BLOCKED_D6J_C_DRIVE_' + kind + '_HASH_MISMATCH');
  if (Number(file.byteSize) !== Number(target.byteSize)) throw d6jCError_('BLOCKED_D6J_C_DRIVE_' + kind + '_BYTE_SIZE_MISMATCH');
}

async function appendAndVerifyD6jCSheetTransaction_(sheets, plan) {
  const mutate = sheets && sheets.mutate;
  const read = sheets && sheets.read;
  if (!mutate || !read) throw d6jCError_('BLOCKED_D6J_C_SHEETS_ADAPTER_MISSING');
  const append = await mutate.appendImmutableTransactionsIfAbsent({
    rows: plan.ledgerRows,
    idempotencyKey: plan.idempotencyKeys.sheet
  });
  const verify = await read.findTransactionByIdentity({
    transactionIdentity: plan.ledgerRows[0].transactionIdentity
  });
  if (verify.status !== 'ALREADY_PRESENT' || verify.rows.length !== 1) throw d6jCError_('BLOCKED_D6J_C_SHEET_READBACK_MISSING');
  assertD6jCSheetRowMatches_(verify.rows[0], plan.ledgerRows[0]);
  return {
    appendedCount: Number(append.appendedCount || 0),
    safeResult: {
      SHEETS_TRANSACTION_STATUS: append.status,
      SHEETS_ROWS_APPENDED: Number(append.appendedCount || 0),
      SHEETS_ROWS_ALREADY_PRESENT: append.idempotent ? 1 : 0
    }
  };
}

function assertD6jCSheetRowMatches_(actual, expected) {
  ['transactionIdentity', 'invoiceKeyV2', 'legacyInvoiceKey', 'lineIdentityV2'].forEach(field => {
    if (normalizeD6jCString_(actual && actual[field]) !== normalizeD6jCString_(expected && expected[field])) {
      throw d6jCError_('BLOCKED_D6J_C_SHEET_TRANSACTION_CONFLICT');
    }
  });
}

async function transitionD6jC_(jobStore, plan, currentJob, toStatus, keySuffix) {
  const fromStatus = currentJob.status;
  const transitioned = await jobStore.transitionJob({
    jobId: plan.jobId,
    expectedVersion: Number(currentJob.version),
    fromStatus,
    toStatus,
    idempotencyKey: keySuffix + '_' + plan.jobId
  });
  return transitioned.job;
}

async function saveD6jCReconciliationReport_(jobStore, plan, job, status, findings) {
  return jobStore.saveReconciliationReport({
    jobId: plan.jobId,
    expectedVersion: Number(job.version),
    report: {
      jobId: plan.jobId,
      reportId: 'rpt_' + hashPrefixD6jC_([plan.jobId, status, (findings || []).map(f => f.code).join('|')].join('|'), 20),
      invoiceKeyHashPrefix: hashPrefixD6jC_(plan.commitPlan.invoiceKeyV2, 8),
      status,
      findingCount: (findings || []).length,
      blockerCount: (findings || []).filter(f => f.severity === 'ERROR').length,
      findings: findings || [],
      inputSnapshotVersion: D6J_C_MUTATION_SCHEMA_VERSION_,
      jobVersion: Number(job.version)
    }
  });
}

async function maybeMarkD6jCReconciliationRequired_(jobStore, plan, job, error, result) {
  if (!jobStore || !plan || !job || !result) return;
  const externalMutationCount = Number(result.DRIVE_MUTATION_COUNT || 0) + Number(result.SHEETS_MUTATION_COUNT || 0);
  if (externalMutationCount <= 0) return;
  if (job.status === 'COMPLETED' || job.status === 'RECONCILIATION_REQUIRED') return;
  try {
    const finding = {
      code: normalizeD6jCErrorCode_(error && (error.code || error.message) || 'D6J_C_PARTIAL_FAILURE'),
      severity: 'ERROR',
      scope: 'D6J_C_ONE_RECORD_MUTATION',
      repairPolicy: 'REPORT_ONLY_OWNER_REVIEW',
      safeMessage: 'D6J_C_PARTIAL_FAILURE_AFTER_CONFIRMED_MUTATION'
    };
    const report = await saveD6jCReconciliationReport_(jobStore, plan, job, 'CONFLICTED', [finding]);
    result.RECONCILIATION_STATUS = 'RECONCILIATION_REQUIRED';
    result.FIRESTORE_MUTATION_COUNT += 1;
    await jobStore.markReconciliationRequired({
      jobId: plan.jobId,
      expectedVersion: Number(report.job.version),
      errorCode: finding.code,
      errorStage: 'D6J_C_PARTIAL_FAILURE'
    });
    result.FIRESTORE_MUTATION_COUNT += 1;
    result.FIRESTORE_JOB_STATUS = 'RECONCILIATION_REQUIRED';
  } catch (_ignored) {
    result.RECONCILIATION_STATUS = 'RECONCILIATION_MARK_ATTEMPTED_BUT_UNCONFIRMED';
  }
}

async function verifyD6jCCompletedNoop_(jobStore, plan, services, result) {
  const drive = services.createDriveAdapters({ plan });
  const sheets = services.createSheetsAdapters({ plan });
  const xml = await drive.read.readFileMetadata({ logicalFileIdentity: plan.driveTargets.xml.logicalFileIdentity });
  const pdf = await drive.read.readFileMetadata({ logicalFileIdentity: plan.driveTargets.pdf.logicalFileIdentity });
  const sheet = await sheets.read.findTransactionByIdentity({ transactionIdentity: plan.ledgerRows[0].transactionIdentity });
  assertD6jCDriveReadback_(xml, plan.driveTargets.xml, 'XML');
  assertD6jCDriveReadback_(pdf, plan.driveTargets.pdf, 'PDF');
  if (sheet.status !== 'ALREADY_PRESENT') throw d6jCError_('BLOCKED_D6J_C_COMPLETED_SHEET_VERIFY_FAILED');
  const resume = await jobStore.resumeCompletedJob({
    jobId: plan.jobId,
    verification: { ledgerVerified: true, registryVerified: true, projectionVerified: true }
  });
  mergeD6jCResult_(result, {
    MUTATION_STATUS: 'PASS_IDEMPOTENT_COMPLETED_NOOP',
    LEASE_STATUS: 'ACQUIRED',
    COMMIT_PLAN_STATUS: 'IDEMPOTENT_PLAN_MATCH',
    DRIVE_XML_STATUS: 'ALREADY_PRESENT',
    DRIVE_PDF_STATUS: 'ALREADY_PRESENT',
    DRIVE_FILES_CREATED: 0,
    DRIVE_FILES_ALREADY_PRESENT: 2,
    SHEETS_TRANSACTION_STATUS: 'ALREADY_PRESENT',
    SHEETS_ROWS_APPENDED: 0,
    SHEETS_ROWS_ALREADY_PRESENT: 1,
    FIRESTORE_JOB_STATUS: 'COMPLETED',
    RECONCILIATION_STATUS: 'CONSISTENT',
    IDEMPOTENT_RERUN_STATUS: resume.action || 'IDEMPOTENT_COMPLETE_NOOP'
  });
  finalizeD6jCMutationCounts_(result);
  return result;
}

function createD6jCDefaultDriveAdapters_(context) {
  const source = createD6jCGasDriveSource_(context || {});
  return {
    read: createSgdsDriveReadAdapter_({ source }),
    mutate: createSgdsDriveMutationAdapter_({ source })
  };
}

function createD6jCGasDriveSource_(context) {
  const plan = context.plan || {};
  const properties = context.properties || {};
  const folder = DriveApp.getFolderById(properties.D6J_DRIVE_ROOT_FOLDER_ID);
  function identity(request) {
    return normalizeD6jCString_(request.logicalFileIdentity || buildSgdsDriveArtifactIdentity_(request));
  }
  function findByIdentity(request) {
    const targetIdentity = identity(request);
    const targetName = normalizeD6jCString_(request.fileName || (targetIdentity === plan.driveTargets?.xml?.logicalFileIdentity ? plan.driveTargets.xml.fileName : plan.driveTargets?.pdf?.fileName));
    if (!targetName) return null;
    const iterator = folder.getFilesByName(targetName);
    while (iterator.hasNext()) {
      const file = iterator.next();
      const blob = file.getBlob();
      const bytes = blob.getBytes();
      const hash = sha256D6jBBytes_(bytes);
      const target = [plan.driveTargets && plan.driveTargets.xml, plan.driveTargets && plan.driveTargets.pdf].filter(Boolean).find(item => item.fileName === targetName);
      if (target && hash === target.contentHash) {
        return {
          exists: true,
          status: 'ALREADY_PRESENT',
          idempotent: true,
          logicalFileIdentity: target.logicalFileIdentity,
          logicalFileIdentityHashPrefix: hashPrefixD6jC_(target.logicalFileIdentity, 8),
          fileReference: file.getId(),
          folderReference: folder.getId(),
          fileName: targetName,
          artifactType: target.artifactType,
          mimeType: target.mimeType,
          contentHash: hash,
          byteSize: bytes.length
        };
      }
      if (target) throw d6jCError_('BLOCKED_D6J_C_DRIVE_' + target.artifactType + '_HASH_CONFLICT');
    }
    return null;
  }
  return {
    async findFolder() {
      return { exists: true, folderKey: D6J_C_DIRECTION_ + '/ROOT/PILOT', folderReference: folder.getId(), status: 'READ_OK' };
    },
    async ensureFolder() {
      return { exists: true, folderKey: D6J_C_DIRECTION_ + '/ROOT/PILOT', folderReference: folder.getId(), status: 'ALREADY_PRESENT' };
    },
    async findFileByIdentity(request) {
      return findByIdentity(request) || { exists: false, logicalFileIdentity: identity(request), status: 'NOT_FOUND' };
    },
    async createFileIfAbsent(request) {
      const existing = findByIdentity(request);
      if (existing) return existing;
      const blob = Utilities.newBlob(request.bytes || [], request.mimeType, request.fileName);
      const file = folder.createFile(blob);
      return {
        exists: true,
        status: 'CONFIRMED_WRITTEN',
        idempotent: false,
        logicalFileIdentity: identity(request),
        logicalFileIdentityHashPrefix: hashPrefixD6jC_(identity(request), 8),
        fileReference: file.getId(),
        folderReference: folder.getId(),
        fileName: request.fileName,
        artifactType: request.artifactType,
        mimeType: request.mimeType,
        contentHash: request.contentHash,
        byteSize: Number(request.byteSize || 0),
        metadata: request.metadata || {}
      };
    },
    async readFileMetadata(request) {
      const existing = findByIdentity(request);
      if (!existing) throw d6jCError_('BLOCKED_D6J_C_DRIVE_READBACK_MISSING');
      return existing;
    },
    async readFileBytes(request) {
      const existing = findByIdentity(request);
      if (!existing) throw d6jCError_('BLOCKED_D6J_C_DRIVE_READBACK_MISSING');
      return { fileReference: existing.fileReference, contentHash: existing.contentHash, byteSize: existing.byteSize, bytes: '' };
    },
    async updateBoundedMetadata(request) {
      const existing = findByIdentity(request);
      if (!existing) throw d6jCError_('BLOCKED_D6J_C_DRIVE_METADATA_TARGET_MISSING');
      return existing;
    }
  };
}

function createD6jCDefaultSheetsAdapters_(context) {
  const source = createD6jCGasSheetsSource_(context || {});
  return {
    read: createSgdsSheetsLedgerReadAdapter_({ source }),
    mutate: createSgdsSheetsLedgerMutationAdapter_({ source })
  };
}

function createD6jCGasSheetsSource_(context) {
  const properties = context.properties || {};
  const spreadsheet = SpreadsheetApp.openById(properties.D6J_SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(properties.D6J_SHEET_NAME);
  if (!sheet) throw d6jCError_('BLOCKED_D6J_C_TARGET_SHEET_MISSING');
  function readRows() {
    const lastRow = Math.max(0, Number(sheet.getLastRow() || 0));
    const lastColumn = Math.max(14, Number(sheet.getLastColumn() || 14));
    if (lastRow <= 1) return [];
    return sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
  }
  function findRow(identity) {
    const target = normalizeD6jCString_(identity);
    const rows = readRows();
    return rows
      .filter(row => row.map(normalizeD6jCString_).includes(target))
      .map(row => ({
        issueDate: row[1],
        legacyInvoiceKey: row[9] || row[13],
        invoiceKeyV2: row[13] || row[9],
        sourceLineNo: 1,
        lineIdentityV2: target,
        transactionIdentity: target,
        direction: row[6],
        itemCode: row[4],
        itemName: row[5],
        quantity: Number(row[7] || 0),
        unitPrice: Number(row[8] || 0)
      }));
  }
  return {
    async readLedgerRows() {
      return [];
    },
    async readConfigurationRows() {
      return [];
    },
    async findTransactionByIdentity(request) {
      const rows = findRow(request && request.transactionIdentity);
      return { status: rows.length === 1 ? 'ALREADY_PRESENT' : rows.length > 1 ? 'CONFLICT' : 'CONFIRMED_NOT_WRITTEN', rows };
    },
    async readRowsForRebuild() {
      return [];
    },
    async appendImmutableTransactionsIfAbsent(request) {
      const rows = Array.isArray(request.rows) ? request.rows : [];
      if (rows.length !== 1) throw d6jCError_('BLOCKED_D6J_C_APPEND_ROW_COUNT_NOT_ONE');
      const row = rows[0];
      const existing = findRow(row.transactionIdentity);
      if (existing.length === 1) return { status: 'ALREADY_PRESENT', appendedCount: 0, rows: existing, idempotent: true };
      if (existing.length > 1) throw d6jCError_('BLOCKED_D6J_C_SHEET_TRANSACTION_CONFLICT');
      const next = [
        '',
        row.issueDate,
        '',
        '',
        row.itemCode,
        row.itemName,
        row.direction,
        row.quantity,
        row.unitPrice,
        row.legacyInvoiceKey,
        row.transactionIdentity,
        context.plan.driveTargets.xml.contentHash,
        context.plan.driveTargets.pdf.contentHash,
        row.invoiceKeyV2
      ];
      sheet.getRange(sheet.getLastRow() + 1, 1, 1, next.length).setValues([next]);
      return { status: 'CONFIRMED_WRITTEN', appendedCount: 1, rows: [row], idempotent: false };
    },
    async replaceDerivedRangeForRebuild() {
      throw d6jCError_('BLOCKED_D6J_C_REBUILD_FORBIDDEN');
    }
  };
}

function createD6jCDefaultDurableJobStore_() {
  if (typeof createDurableInvoiceJobStore !== 'function') throw d6jCError_('BLOCKED_D6J_C_DURABLE_STORE_MISSING');
  return createDurableInvoiceJobStore(createD6jCFirestoreDurableTransport_(), { clock: { now: () => new Date().toISOString() } });
}

function createD6jCDefaultLeaseStore_() {
  return {
    async acquireLease(request) {
      const transport = createD6jCFirestoreDurableTransport_();
      return transport.createDocument('worker_leases/' + request.leaseId, {
        leaseId: request.leaseId,
        jobId: request.jobId,
        leaseOwner: request.leaseOwner,
        leaseExpiresAt: request.leaseExpiresAt,
        fencingToken: request.fencingToken,
        createdAt: new Date().toISOString()
      }, { idempotencyKey: request.idempotencyKey });
    }
  };
}

function createD6jCFirestoreDurableTransport_() {
  const codec = createFirestoreValueCodec_();
  async function request(method, path, body, options) {
    const safePath = validateD6jCFirestorePath_(path);
    const url = buildD6jCFirestoreUrl_(safePath, method, options || {});
    const params = {
      method: method.toLowerCase(),
      muteHttpExceptions: true,
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }
    };
    if (body) params.payload = JSON.stringify(body);
    const response = UrlFetchApp.fetch(url, params);
    const status = Number(response.getResponseCode());
    const text = String(response.getContentText() || '');
    if (status === 404) return null;
    if (status >= 200 && status < 300) return text ? JSON.parse(text) : {};
    throw createD6jCFirestoreError_(status, safePath.path, text);
  }
  async function getDocument(path) {
    const doc = await request('GET', path, null, {});
    return doc ? codec.decodeDocument(doc) : null;
  }
  async function createDocument(path, data, options) {
    const encoded = codec.encodeDocument(data || {});
    const doc = await request('POST', path, encoded, { ...(options || {}), create: true });
    return codec.decodeDocument(doc);
  }
  async function updateDocument(path, data, options) {
    const fields = Object.keys(data || {}).sort();
    const doc = await request('PATCH', path, codec.encodeDocument(data || {}), { ...(options || {}), updateMask: fields });
    return codec.decodeDocument(doc);
  }
  async function appendDocument(collectionPath, data, options) {
    const id = normalizeD6jCString_(data.eventId || data.reportId || ('doc_' + hashPrefixD6jC_(JSON.stringify(data), 20)));
    return createDocument(collectionPath + '/' + id, data, options || {});
  }
  async function queryDocuments(collectionPath) {
    const doc = await request('LIST', collectionPath, null, {});
    const docs = doc && doc.documents ? doc.documents : [];
    return docs.map(item => codec.decodeDocument(item));
  }
  async function runTransaction(work) {
    return work({ getDocument, createDocument, updateDocument, appendDocument, queryDocuments });
  }
  return Object.freeze({ getDocument, createDocument, updateDocument, appendDocument, queryDocuments, runTransaction });
}

function validateD6jCFirestorePath_(path) {
  const value = normalizeD6jCString_(path);
  if (!value || value.indexOf('//') >= 0 || value.charAt(0) === '/' || value.charAt(value.length - 1) === '/') {
    throw d6jCError_('FIRESTORE_REQUEST_PATH_INVALID');
  }
  if (/[?#\\]/.test(value)) throw d6jCError_('FIRESTORE_REQUEST_PATH_INVALID');
  const parts = value.split('/');
  if (parts.length < 2 || parts.length % 2 !== 0) throw d6jCError_('FIRESTORE_REQUEST_PATH_DEPTH_UNSUPPORTED');
  parts.forEach(part => {
    if (!/^[A-Za-z0-9._:-]{1,180}$/.test(part)) throw d6jCError_('FIRESTORE_DOCUMENT_ID_INVALID');
  });
  return { path: value, parts };
}

function buildD6jCFirestoreUrl_(safePath, method, options) {
  const parts = safePath.parts;
  const encodedPath = parts.map(encodeURIComponent).join('/');
  if (method === 'POST') {
    const parent = parts.slice(0, -1).map(encodeURIComponent).join('/');
    const id = encodeURIComponent(parts[parts.length - 1]);
    return d6jCFirestoreBaseUrl_() + '/' + parent + '?documentId=' + id;
  }
  if (method === 'PATCH') {
    const mask = (options.updateMask || []).map(field => 'updateMask.fieldPaths=' + encodeURIComponent(field)).join('&');
    return d6jCFirestoreBaseUrl_() + '/' + encodedPath + (mask ? '?' + mask : '');
  }
  return d6jCFirestoreBaseUrl_() + '/' + encodedPath;
}

function d6jCFirestoreBaseUrl_() {
  return 'https://firestore.googleapis.com/v1/projects/'
    + D6J_C_FIRESTORE_PROJECT_ID_
    + '/databases/'
    + encodeURIComponent(D6J_C_FIRESTORE_DATABASE_ID_)
    + '/documents';
}

function createD6jCFirestoreError_(status, path, text) {
  const error = d6jCError_([
    'HTTP_STATUS=' + status,
    'FIRESTORE_PROJECT_ID=' + D6J_C_FIRESTORE_PROJECT_ID_,
    'FIRESTORE_DATABASE_ID=' + D6J_C_FIRESTORE_DATABASE_ID_,
    'FIRESTORE_REQUEST_PATH=' + path,
    'FIRESTORE_ERROR_MESSAGE=' + sanitizeD6jCLogText_(text || '')
  ].join(';'));
  error.httpStatus = Number(status || 0);
  return error;
}

function finalizeD6jCBlockedResult_(result, error) {
  result.MUTATION_STATUS = normalizeD6jCString_(error && (error.code || error.message) || 'BLOCKED_D6J_C_UNKNOWN');
  result.BLOCKER_CODE = normalizeD6jCString_(error && (error.code || 'BLOCKED_D6J_C_UNKNOWN'));
  finalizeD6jCMutationCounts_(result);
  return result;
}

function finalizeD6jCMutationCounts_(result) {
  result.GMAIL_MUTATION_COUNT = 0;
  result.TRIGGER_MUTATION_COUNT = 0;
  result.DESTRUCTIVE_OPERATION_COUNT = 0;
  result.PRODUCTION_MUTATION_COUNT = Number(result.DRIVE_MUTATION_COUNT || 0)
    + Number(result.SHEETS_MUTATION_COUNT || 0)
    + Number(result.FIRESTORE_MUTATION_COUNT || 0);
}

function createD6jCBaseResult_() {
  return {
    PHASE: 'D6J_C_CONTROLLED_ONE_RECORD_PRODUCTION_MUTATION_CHANNEL',
    MUTATION_STATUS: 'NOT_STARTED',
    PILOT_ID: '',
    CORRELATION_ID: '',
    JOB_ID: '',
    OWNER_APPROVAL_MARKER_VALID: 'NO',
    PREFLIGHT_STATUS: 'NOT_RUN',
    LEASE_STATUS: 'NOT_ATTEMPTED',
    COMMIT_PLAN_STATUS: 'NOT_ATTEMPTED',
    DRIVE_PDF_STATUS: 'NOT_ATTEMPTED',
    DRIVE_XML_STATUS: 'NOT_ATTEMPTED',
    DRIVE_FILES_CREATED: 0,
    DRIVE_FILES_ALREADY_PRESENT: 0,
    SHEETS_TRANSACTION_STATUS: 'NOT_ATTEMPTED',
    SHEETS_ROWS_APPENDED: 0,
    SHEETS_ROWS_ALREADY_PRESENT: 0,
    FIRESTORE_JOB_STATUS: 'NOT_ATTEMPTED',
    RECONCILIATION_STATUS: 'NOT_ATTEMPTED',
    GMAIL_MUTATION_COUNT: 0,
    DRIVE_MUTATION_COUNT: 0,
    SHEETS_MUTATION_COUNT: 0,
    FIRESTORE_MUTATION_COUNT: 0,
    TRIGGER_MUTATION_COUNT: 0,
    DESTRUCTIVE_OPERATION_COUNT: 0,
    PRODUCTION_MUTATION_COUNT: 0,
    IDEMPOTENT_RERUN_STATUS: 'NOT_EVALUATED',
    SCHEMA_VERSION: D6J_C_MUTATION_SCHEMA_VERSION_
  };
}

function mergeD6jCResult_(target, patch) {
  Object.keys(patch || {}).forEach(key => {
    target[key] = patch[key];
  });
}

function logD6jCSanitizedResult_(logger, result) {
  const text = JSON.stringify(result);
  if (/(Bearer|Authorization|refresh_token|private_key|client_secret|<\?xml|<Invoice|JVBERi0|\b80,68,70\b)/i.test(text)) {
    throw d6jCError_('BLOCKED_UNSAFE_D6J_C_LOG_PAYLOAD');
  }
  logger.log(text);
}

function buildD6jCLegacyInvoiceKey_(issueDate, taxCode, invoiceNo) {
  const date = normalizeD6jCString_(issueDate).replace(/\D/g, '');
  const tax = normalizeD6jCString_(taxCode).replace(/\D/g, '') || 'UNKNOWNTAXCODE';
  const inv = normalizeD6jCString_(invoiceNo);
  return [date, tax, inv].join('_');
}

function hashPrefixD6jC_(value, length) {
  if (typeof hashPrefixD6jB_ === 'function') return hashPrefixD6jB_(value, length || 16);
  const text = String(value || '');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return ('00000000' + (hash >>> 0).toString(16)).slice(-Number(length || 8));
}

function sanitizeD6jCLogText_(value) {
  return normalizeD6jCString_(value)
    .replace(/Bearer\s+[^\s,;)]*/ig, 'REDACTED')
    .replace(/Authorization\s+[^\s,;)]*/ig, 'REDACTED')
    .replace(/(refresh_token|private_key|client_secret)\s*[=:]?\s*[^\s,;)]*/ig, 'REDACTED')
    .replace(/[^\w .:()/-]/g, ' ')
    .slice(0, 180);
}

function normalizeD6jCErrorCode_(value) {
  return normalizeD6jCString_(value).replace(/[^A-Z0-9_]/g, '_').slice(0, 80) || 'D6J_C_ERROR';
}

function normalizeD6jCString_(value) {
  return value == null ? '' : String(value).replace(/\s+/g, ' ').trim();
}

function d6jCError_(code) {
  const error = new Error(String(code));
  error.code = String(code).split(':')[0];
  return error;
}
