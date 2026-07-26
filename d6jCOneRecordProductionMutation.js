const D6J_C_MUTATION_SCHEMA_VERSION_ = 'D6J_C_CONTROLLED_ONE_RECORD_PRODUCTION_MUTATION_CHANNEL_V1';
const D6J_C_MUTATION_ENTRYPOINT_ = 'runD6jCOneRecordProductionMutation';
const D6J_C_MUTATION_APPROVAL_ = 'OWNER_APPROVED_D6J_C_ONE_RECORD_PRODUCTION_MUTATION';
const D6J_C_MUTATION_APPROVAL_PROPERTY_ = 'D6J_C_MUTATION_APPROVAL_MARKER';
const D6J_C_DIRECTION_ = 'NHAP';
const D6J_C_FIRESTORE_PROJECT_ID_ = 'tonkhohd';
const D6J_C_FIRESTORE_DATABASE_ID_ = '(default)';
const D6J_C_LEASE_OWNER_ = 'apps_script_d6j_c';
const D6J_C_LEASE_DURATION_MS_ = 10 * 60 * 1000;
const D6J_D_SCHEMA_VERSION_ = 'D6J_D_NHAP_XUAT_SCHEMA_MAPPING_FIX_AND_SINGLE_PILOT_ROW_REPAIR_CHANNEL_V1';
const D6J_D_INSPECT_ENTRYPOINT_ = 'runD6jDInspectMalformedPilotRowReadOnly';
const D6J_D_REPAIR_ENTRYPOINT_ = 'runD6jDRepairSingleMalformedPilotRow';
const D6J_D_REPAIR_APPROVAL_PROPERTY_ = 'D6J_D_REPAIR_APPROVAL_MARKER';
const D6J_D_REPAIR_APPROVAL_ = 'OWNER_APPROVED_D6J_D_SINGLE_PILOT_ROW_REPAIR';
const D6J_D_ORIGINAL_JOB_ID_ = 'd6j_job_10ad66ede74a1121b0d6';
const D6J_D_PILOT_ID_ = 'd6j_pilot_9e12d76a0f2b6c16';
const D6J_D_CORRELATION_ID_ = 'd6j_corr_9efff2df466dd953';
const D6J_D_TARGET_HEADERS_ = [
  'STT',
  'Ngay',
  'Hoa don so',
  'Ten khach hang',
  'Ma hang',
  'Ten hang',
  'Phan loai',
  'So luong',
  'Don gia',
  'Thanh tien',
  'Don gia BQ',
  'So luong ton',
  'Gia tri ton',
  'HashIndex',
  'InvoiceKey',
  'HD'
];

function runD6jCOneRecordProductionMutation() {
  const runner = createD6jCOneRecordProductionMutationRunner_();
  return runner.run();
}

function runD6jDInspectMalformedPilotRowReadOnly() {
  const runner = createD6jDNhapXuatSchemaRepairRunner_();
  return runner.inspect();
}

function runD6jDRepairSingleMalformedPilotRow() {
  const runner = createD6jDNhapXuatSchemaRepairRunner_();
  return runner.repair();
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
    let activeLeaseStore = null;
    let activeLease = null;
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
      result.LEASE_EXPIRES_AT = lease.expiresAt || '';
      result.LEASE_RECLAIM_STATUS = lease.reclaimStatus || 'NOT_RECLAIMED';
      if (!isD6jCLeaseAcquiredStatus_(lease.status)) {
        throw d6jCError_('BLOCKED_ACTIVE_LEASE');
      }
      activeLeaseStore = leaseStore;
      activeLease = lease;
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
        await closeD6jCLease_(leaseStore, lease, resume, 'COMPLETED', {
          mode: 'release',
          clock: services.clock,
          mustConfirm: true
        });
        finalizeD6jCMutationCounts_(resume);
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

      result.MUTATION_STATUS = 'PASS_ONE_RECORD_PRODUCTION_MUTATION_COMPLETED';
      result.LEGACY_MUTATION_STATUS_COMPAT = 'PASS_ONE_RECORD_PRODUCTION_MUTATION_CHANNEL_READY';
      result.IDEMPOTENT_RERUN_STATUS = 'READY_FOR_IDEMPOTENT_RERUN';
      await closeD6jCLease_(leaseStore, lease, result, 'COMPLETED', {
        mode: 'release',
        clock: services.clock,
        mustConfirm: true
      });
      finalizeD6jCMutationCounts_(result);
      logD6jCSanitizedResult_(services.logger, result);
      return result;
    } catch (error) {
      if (Number(error && error.driveMutationCount || 0) > 0) result.DRIVE_MUTATION_COUNT += Number(error.driveMutationCount);
      if (Number(error && error.sheetsMutationCount || 0) > 0) result.SHEETS_MUTATION_COUNT += Number(error.sheetsMutationCount);
      if (error && error.partialSafeResult) mergeD6jCResult_(result, error.partialSafeResult);
      await maybeMarkD6jCReconciliationRequired_(activeJobStore, activePlan, activeJob, error, result);
      const externalMutationCount = Number(result.DRIVE_MUTATION_COUNT || 0) + Number(result.SHEETS_MUTATION_COUNT || 0);
      await closeD6jCLease_(activeLeaseStore, activeLease, result, externalMutationCount > 0 ? 'RECONCILIATION_REQUIRED' : 'FAILED_BEFORE_EXTERNAL_MUTATION', {
        mode: externalMutationCount > 0 ? 'reconciliation' : 'release',
        clock: services.clock,
        error
      });
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
  const hashIndex = buildD6jCInvoiceItemHash_({
    invoiceDate: meta.invoiceDate,
    invoiceNo: meta.invoiceNo,
    customerName: seller.name,
    itemCode: item.code || 'Unknown_ID',
    itemName: item.name,
    invoiceType: D6J_C_DIRECTION_,
    qty: item.qty
  });
  return [{
    issueDate: normalizeD6jCString_(meta.invoiceDate),
    invoiceNo: normalizeD6jCString_(meta.invoiceNo),
    customerName: normalizeD6jCString_(seller.name),
    sellerTaxCode: normalizeD6jCString_(seller.taxCode),
    legacyInvoiceKey,
    invoiceKeyV2: legacyInvoiceKey,
    sourceLineNo: 1,
    lineIdentityV2: lineIdentity,
    legacyHashIndex: hashIndex,
    transactionIdentity: lineIdentity,
    direction: D6J_C_DIRECTION_,
    itemCode: normalizeD6jCString_(item.code || 'Unknown_ID'),
    itemName: normalizeD6jCString_(item.name),
    quantity: Number(item.qty || 0),
    unitPrice: Number(item.price || 0),
    amount: Number(item.qty || 0) * Number(item.price || 0)
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
  const acquiredAt = normalizeD6jCString_(clock.now());
  const expiresAt = addD6jCMilliseconds_(acquiredAt, D6J_C_LEASE_DURATION_MS_);
  try {
    const lease = await leaseStore.acquireLease({
      leaseId: plan.jobId,
      jobId: plan.jobId,
      leaseOwner: D6J_C_LEASE_OWNER_,
      acquiredAt,
      expiresAt,
      fencingToken: plan.idempotencyKeys.lease,
      idempotencyKey: plan.idempotencyKeys.lease
    });
    const status = normalizeD6jCString_(lease && lease.status) || (lease && lease.idempotent ? 'ALREADY_HELD_BY_SAME_JOB' : 'ACQUIRED');
    return {
      leaseId: plan.jobId,
      jobId: plan.jobId,
      leaseOwner: D6J_C_LEASE_OWNER_,
      fencingToken: plan.idempotencyKeys.lease,
      status,
      expiresAt: normalizeD6jCString_(lease && (lease.expiresAt || lease.leaseExpiresAt)) || expiresAt,
      reclaimStatus: normalizeD6jCString_(lease && lease.reclaimStatus) || (status === 'LEASE_RECLAIMED_EXPIRED' ? 'RECLAIMED_EXPIRED' : 'NOT_RECLAIMED'),
      mutationCount: Number(lease && lease.mutationCount || (lease && lease.idempotent ? 0 : 1))
    };
  } catch (error) {
    const code = normalizeD6jCString_(error && (error.code || error.message));
    if (code.indexOf('ACTIVE_LEASE_FOUND') >= 0 || code.indexOf('ALREADY') >= 0 || code.indexOf('409') >= 0 || code.indexOf('CONFLICT') >= 0) {
      return { status: 'ACTIVE_LEASE_FOUND', mutationCount: 0 };
    }
    throw error;
  }
}

function isD6jCLeaseAcquiredStatus_(status) {
  return [
    'ACQUIRED',
    'ALREADY_HELD_BY_SAME_JOB',
    'ACQUIRED_AFTER_RELEASED',
    'ACQUIRED_AFTER_RECONCILIATION_REQUIRED',
    'LEASE_RECLAIMED_EXPIRED'
  ].includes(normalizeD6jCString_(status));
}

async function closeD6jCLease_(leaseStore, lease, result, finalJobStatus, options) {
  const opts = options || {};
  if (!leaseStore || !lease || !lease.leaseId || lease.closeAttempted) return null;
  lease.closeAttempted = true;
  const now = opts.clock && typeof opts.clock.now === 'function' ? opts.clock.now() : new Date().toISOString();
  const request = {
    leaseId: lease.leaseId,
    jobId: lease.jobId,
    leaseOwner: lease.leaseOwner || D6J_C_LEASE_OWNER_,
    fencingToken: lease.fencingToken,
    releasedAt: now,
    finalJobStatus,
    errorCode: normalizeD6jCErrorCode_(opts.error && (opts.error.code || opts.error.message) || finalJobStatus)
  };
  result.LEASE_FINAL_STATUS = opts.mode === 'reconciliation' ? 'RECONCILIATION_REQUIRED' : 'RELEASED';
  try {
    const closeFn = opts.mode === 'reconciliation' ? leaseStore.markLeaseReconciliationRequired : leaseStore.releaseLease;
    if (typeof closeFn !== 'function') throw d6jCError_('BLOCKED_D6J_C_LEASE_RELEASE_MISSING');
    const outcome = await closeFn.call(leaseStore, request);
    result.LEASE_RELEASE_STATUS = normalizeD6jCString_(outcome && outcome.status) || 'CONFIRMED';
    result.FIRESTORE_MUTATION_COUNT += Number(outcome && outcome.mutationCount || 0);
    if (outcome && outcome.lease && outcome.lease.expiresAt) result.LEASE_EXPIRES_AT = outcome.lease.expiresAt;
    return outcome;
  } catch (error) {
    result.LEASE_RELEASE_STATUS = 'FAILED_' + normalizeD6jCErrorCode_(error && (error.code || error.message));
    if (opts.mustConfirm) throw error;
    return null;
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
    hashIndex: plan.ledgerRows[0].legacyHashIndex,
    invoiceKeyV2: plan.ledgerRows[0].invoiceKeyV2,
    legacyInvoiceKey: plan.ledgerRows[0].legacyInvoiceKey
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
  ['invoiceKeyV2', 'legacyInvoiceKey', 'legacyHashIndex'].forEach(field => {
    if (normalizeD6jCString_(actual && actual[field]) !== normalizeD6jCString_(expected && expected[field])) {
      throw d6jCError_('BLOCKED_D6J_C_SHEET_TRANSACTION_CONFLICT');
    }
  });
  const semanticPairs = [
    ['issueDate', normalizeD6jCComparableDate_],
    ['invoiceNo', normalizeD6jCString_],
    ['customerName', normalizeD6jCString_],
    ['direction', value => normalizeD6jCString_(value).toUpperCase()],
    ['itemCode', normalizeD6jCString_],
    ['itemName', normalizeD6jCString_]
  ];
  semanticPairs.forEach(pair => {
    const key = pair[0];
    const normalize = pair[1];
    if (!normalize(expected && expected[key])) return;
    if (normalize(actual && actual[key]) !== normalize(expected && expected[key])) {
      throw d6jCError_('BLOCKED_D6J_C_SHEET_TRANSACTION_CONFLICT');
    }
  });
  ['quantity', 'unitPrice', 'amount'].forEach(field => {
    if (expected && (expected[field] == null || expected[field] === '')) return;
    if (!numbersEqualD6jD_(actual && actual[field], expected && expected[field])) {
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
  function readSnapshot() {
    return readD6jDSheetSnapshotFromSheet_(sheet);
  }
  function readRows() {
    return readSnapshot().rows.map(row => row.values);
  }
  function findRow(request) {
    const hash = normalizeD6jCString_(request && (request.hashIndex || request.legacyHashIndex));
    const invoiceKey = normalizeD6jCString_(request && (request.invoiceKeyV2 || request.legacyInvoiceKey));
    if (!hash || !invoiceKey) throw d6jCError_('BLOCKED_D6J_C_SHEET_LOOKUP_KEYS_MISSING');
    return readRows()
      .filter(row => normalizeD6jCString_(row[13]) === hash)
      .map(row => normalizeD6jDNhapXuatRowFromValues_(row));
  }
  return {
    async readLedgerRows() {
      return [];
    },
    async readConfigurationRows() {
      return [];
    },
    async findTransactionByIdentity(request) {
      const rows = findRow(request || {});
      return { status: rows.length === 1 ? 'ALREADY_PRESENT' : rows.length > 1 ? 'CONFLICT' : 'CONFIRMED_NOT_WRITTEN', rows };
    },
    async readRowsForRebuild() {
      return [];
    },
    async appendImmutableTransactionsIfAbsent(request) {
      const rows = Array.isArray(request.rows) ? request.rows : [];
      if (rows.length !== 1) throw d6jCError_('BLOCKED_D6J_C_APPEND_ROW_COUNT_NOT_ONE');
      const row = rows[0];
      const existing = findRow({ hashIndex: row.legacyHashIndex, invoiceKeyV2: row.invoiceKeyV2, legacyInvoiceKey: row.legacyInvoiceKey });
      if (existing.length === 1) return { status: 'ALREADY_PRESENT', appendedCount: 0, rows: existing, idempotent: true };
      if (existing.length > 1) throw d6jCError_('BLOCKED_D6J_C_SHEET_TRANSACTION_CONFLICT');
      const snapshot = readSnapshot();
      assertD6jDHeaderSchema_(snapshot.headers);
      const nextRowNumber = sheet.getLastRow() + 1;
      const previousRows = snapshot.rows.map(item => item.values);
      const inventory = calculateD6jDInventoryForTarget_(previousRows, row);
      const hdRule = resolveD6jDHdColumnRule_(snapshot, -1);
      const next = buildD6jCNhapXuatRowAP_(row, context.plan, inventory, hdRule);
      sheet.getRange(nextRowNumber, 1, 1, next.values.length).setValues([next.values]);
      if (next.pFormulaR1C1) {
        sheet.getRange(nextRowNumber, 16, 1, 1).setFormulaR1C1(next.pFormulaR1C1);
      }
      return { status: 'CONFIRMED_WRITTEN', appendedCount: 1, rows: [row], idempotent: false };
    },
    async replaceDerivedRangeForRebuild() {
      throw d6jCError_('BLOCKED_D6J_C_REBUILD_FORBIDDEN');
    }
  };
}

function createD6jDNhapXuatSchemaRepairRunner_(deps) {
  const d = deps || {};
  const services = {
    readProperties: d.readProperties || readD6jDProperties_,
    buildRepairContext: d.buildRepairContext || buildD6jDRepairContextFromProductionReads_,
    createSheetsSource: d.createSheetsSource || (context => createD6jDGasSheetsSource_(context)),
    createJobStore: d.createJobStore || (() => createD6jCDefaultDurableJobStore_()),
    clock: d.clock || { now: () => new Date().toISOString() },
    logger: d.logger || (typeof Logger !== 'undefined' ? Logger : { log() {} })
  };

  async function inspect() {
    const properties = services.readProperties();
    const context = await services.buildRepairContext(properties);
    const source = services.createSheetsSource({ properties, context });
    const result = inspectD6jDMalformedPilotRow_(source.readSnapshot(), context, { includeRawCells: true });
    const out = {
      PHASE: 'D6J_D_NHAP_XUAT_SCHEMA_MAPPING_FIX_AND_SINGLE_PILOT_ROW_REPAIR_CHANNEL',
      AUDIT_STATUS: 'PASS_MALFORMED_PILOT_ROW_LOCATED',
      READ_ONLY_AUDIT_ENTRYPOINT: D6J_D_INSPECT_ENTRYPOINT_,
      TARGET_ROW_NUMBER: result.targetRowNumber,
      HEADER_SCHEMA_STATUS: result.headerSchemaStatus,
      HD_COLUMN_RULE: result.hdRule.type,
      ARRAYFORMULA_CONTROLS_A_OR_P: result.arrayFormulaControlsAOrP ? 'YES' : 'NO',
      CURRENT_VALUES_AP: result.currentValues,
      CURRENT_FORMULAS_AP: result.currentFormulas,
      CURRENT_NUMBER_FORMATS_AP: result.currentNumberFormats,
      EXPECTED_VALUES_AP: result.expected.values,
      BLOCKER_CODE: '',
      PRODUCTION_MUTATION: 'NONE',
      SCHEMA_VERSION: D6J_D_SCHEMA_VERSION_
    };
    logD6jDSanitizedResult_(services.logger, out);
    return out;
  }

  async function repair() {
    const properties = services.readProperties();
    if (normalizeD6jCString_(properties[D6J_D_REPAIR_APPROVAL_PROPERTY_]) !== D6J_D_REPAIR_APPROVAL_) {
      return createD6jDRepairBlockedResult_('BLOCKED_INVALID_D6J_D_REPAIR_APPROVAL_MARKER');
    }
    const context = await services.buildRepairContext(properties);
    const source = services.createSheetsSource({ properties, context });
    const snapshot = source.readSnapshot();
    const inspection = inspectD6jDMalformedPilotRow_(snapshot, context, { includeRawCells: false });
    const changes = buildD6jDRepairCellChanges_(inspection);
    if (!changes.length) throw d6jCError_('BLOCKED_D6J_D_REPAIR_NO_CHANGES_REQUIRED');
    const beforeHash = hashPrefixD6jC_(JSON.stringify({
      rowNumber: inspection.targetRowNumber,
      values: inspection.currentValues,
      formulas: inspection.currentFormulas,
      formats: inspection.currentNumberFormats
    }), 32);
    let writeCompleted = false;
    try {
      source.updateRowCells({
        rowNumber: inspection.targetRowNumber,
        changes,
        audit: {
          originalJobId: D6J_D_ORIGINAL_JOB_ID_,
          pilotId: D6J_D_PILOT_ID_,
          correlationId: D6J_D_CORRELATION_ID_
        }
      });
      writeCompleted = true;
      const afterInspection = inspectD6jDRepairedPilotRow_(source.readSnapshot(), context, inspection.targetRowNumber);
      const afterHash = hashPrefixD6jC_(JSON.stringify({
        rowNumber: afterInspection.targetRowNumber,
        values: afterInspection.currentValues,
        formulas: afterInspection.currentFormulas
      }), 32);
      const auditResult = await recordD6jDRepairAudit_(services.createJobStore, {
        beforeHash,
        afterHash,
        changedColumns: changes.map(change => change.column),
        clock: services.clock
      });
      const out = {
        PHASE: 'D6J_D_NHAP_XUAT_SCHEMA_MAPPING_FIX_AND_SINGLE_PILOT_ROW_REPAIR_CHANNEL',
        REPAIR_STATUS: 'PASS_SINGLE_MALFORMED_PILOT_ROW_REPAIRED',
        TARGET_ROW_NUMBER: inspection.targetRowNumber,
        SHEET_ROWS_UPDATED: 1,
        SHEET_ROWS_APPENDED: 0,
        SHEET_ROWS_DELETED: 0,
        DRIVE_MUTATION_COUNT: 0,
        GMAIL_MUTATION_COUNT: 0,
        TRIGGER_MUTATION_COUNT: 0,
        DESTRUCTIVE_OPERATION_COUNT: 0,
        FIRESTORE_REPAIR_AUDIT_STATUS: auditResult.status,
        BEFORE_HASH: beforeHash,
        AFTER_HASH: afterHash,
        CHANGED_COLUMNS: changes.map(change => change.column).join(','),
        ORIGINAL_JOB_ID: D6J_D_ORIGINAL_JOB_ID_,
        PRODUCTION_MUTATION: 'SINGLE_SHEET_ROW_REPAIR_ONLY',
        SCHEMA_VERSION: D6J_D_SCHEMA_VERSION_
      };
      logD6jDSanitizedResult_(services.logger, out);
      return out;
    } catch (error) {
      if (writeCompleted) {
        return {
          PHASE: 'D6J_D_NHAP_XUAT_SCHEMA_MAPPING_FIX_AND_SINGLE_PILOT_ROW_REPAIR_CHANNEL',
          REPAIR_STATUS: 'REPAIR_RECONCILIATION_REQUIRED',
          BLOCKER_CODE: normalizeD6jCErrorCode_(error && (error.code || error.message) || 'D6J_D_REPAIR_UNKNOWN'),
          SHEET_ROWS_UPDATED: 1,
          SHEET_ROWS_APPENDED: 0,
          SHEET_ROWS_DELETED: 0,
          DRIVE_MUTATION_COUNT: 0,
          GMAIL_MUTATION_COUNT: 0,
          TRIGGER_MUTATION_COUNT: 0,
          DESTRUCTIVE_OPERATION_COUNT: 0,
          PRODUCTION_MUTATION: 'SINGLE_SHEET_ROW_REPAIR_NEEDS_RECONCILIATION',
          SCHEMA_VERSION: D6J_D_SCHEMA_VERSION_
        };
      }
      throw error;
    }
  }

  return Object.freeze({ inspect, repair });
}

function readD6jDProperties_() {
  const base = readD6jCScriptProperties_();
  base[D6J_D_REPAIR_APPROVAL_PROPERTY_] = String(PropertiesService.getScriptProperties().getProperty(D6J_D_REPAIR_APPROVAL_PROPERTY_) || '').trim();
  return base;
}

async function buildD6jDRepairContextFromProductionReads_(properties) {
  const preflight = createD6jBProductionDryRunReadOnlyRunner_().run();
  assertD6jCPreflightPass_(preflight);
  const artifacts = await readD6jCPilotArtifacts_(properties, preflight);
  assertD6jCArtifactsMatchPreflight_(artifacts, preflight);
  const ledgerRows = await buildD6jCLedgerRowsFromXml_({ properties, preflight, artifacts });
  const plan = buildD6jCMutationPlan_({ properties, preflight, artifacts, ledgerRows, now: new Date().toISOString() });
  return { properties, preflight, artifacts, ledgerRows, plan };
}

function createD6jDGasSheetsSource_(context) {
  const properties = context.properties || {};
  const spreadsheet = SpreadsheetApp.openById(properties.D6J_SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(properties.D6J_SHEET_NAME);
  if (!sheet) throw d6jCError_('BLOCKED_D6J_D_TARGET_SHEET_MISSING');
  return {
    readSnapshot() {
      return readD6jDSheetSnapshotFromSheet_(sheet);
    },
    updateRowCells(request) {
      const rowNumber = Number(request && request.rowNumber || 0);
      const changes = Array.isArray(request && request.changes) ? request.changes : [];
      if (!Number.isInteger(rowNumber) || rowNumber < 2) throw d6jCError_('BLOCKED_D6J_D_REPAIR_ROW_NUMBER_INVALID');
      if (!changes.length) throw d6jCError_('BLOCKED_D6J_D_REPAIR_EMPTY_CHANGESET');
      changes.forEach(change => {
        const column = Number(change.column);
        if (!Number.isInteger(column) || column < 1 || column > 16) throw d6jCError_('BLOCKED_D6J_D_REPAIR_COLUMN_INVALID');
        const cell = sheet.getRange(rowNumber, column, 1, 1);
        if (change.formulaR1C1) cell.setFormulaR1C1(change.formulaR1C1);
        else cell.setValue(change.value == null ? '' : change.value);
      });
      return { updatedRowCount: 1, updatedCellCount: changes.length };
    }
  };
}

function readD6jDSheetSnapshotFromSheet_(sheet) {
  const lastRow = Math.max(1, Number(sheet.getLastRow() || 1));
  const range = sheet.getRange(1, 1, lastRow, 16);
  const values = range.getValues();
  const formulas = typeof range.getFormulas === 'function' ? range.getFormulas() : values.map(row => row.map(() => ''));
  const formulasR1C1 = typeof range.getFormulasR1C1 === 'function' ? range.getFormulasR1C1() : formulas;
  const numberFormats = typeof range.getNumberFormats === 'function' ? range.getNumberFormats() : values.map(row => row.map(() => ''));
  return {
    headers: values[0] || [],
    rows: values.slice(1).map((row, index) => ({
      rowNumber: index + 2,
      values: row.slice(0, 16),
      formulas: (formulas[index + 1] || []).slice(0, 16),
      formulasR1C1: (formulasR1C1[index + 1] || []).slice(0, 16),
      numberFormats: (numberFormats[index + 1] || []).slice(0, 16)
    }))
  };
}

function inspectD6jDMalformedPilotRow_(snapshot, context, options) {
  const source = snapshot || {};
  assertD6jDHeaderSchema_(source.headers || []);
  const row = ((context && context.ledgerRows) || [])[0];
  if (!row) throw d6jCError_('BLOCKED_D6J_D_EXPECTED_ROW_MISSING');
  const plan = context.plan || {};
  const matches = findD6jDMalformedPilotRows_(source, context);
  if (matches.length === 0) throw d6jCError_('BLOCKED_D6J_D_MALFORMED_ROW_NOT_FOUND');
  if (matches.length > 1) throw d6jCError_('BLOCKED_D6J_D_MALFORMED_ROW_NOT_UNIQUE');
  const target = matches[0];
  assertNoLaterD6jDItemTransactions_(source, target.rowNumber, row.itemCode);
  const previousRows = source.rows.filter(item => item.rowNumber < target.rowNumber).map(item => item.values);
  const inventory = calculateD6jDInventoryForTarget_(previousRows, row);
  const hdRule = resolveD6jDHdColumnRule_(source, target.rowNumber);
  const expected = buildD6jCNhapXuatRowAP_(row, plan, inventory, hdRule);
  return {
    targetRowNumber: target.rowNumber,
    headerSchemaStatus: 'PASS',
    hdRule,
    arrayFormulaControlsAOrP: d6jDColumnHasArrayFormula_(source, 0) || d6jDColumnHasArrayFormula_(source, 15),
    currentValues: (options && options.includeRawCells === false) ? target.values.slice(0, 16) : target.values.slice(0, 16),
    currentFormulas: target.formulas.slice(0, 16),
    currentFormulasR1C1: target.formulasR1C1.slice(0, 16),
    currentNumberFormats: target.numberFormats.slice(0, 16),
    expected,
    expectedInventory: inventory
  };
}

function inspectD6jDRepairedPilotRow_(snapshot, context, rowNumber) {
  const source = snapshot || {};
  assertD6jDHeaderSchema_(source.headers || []);
  const target = (source.rows || []).find(row => Number(row.rowNumber) === Number(rowNumber));
  if (!target) throw d6jCError_('BLOCKED_D6J_D_REPAIRED_ROW_NOT_FOUND');
  const expected = ((context && context.ledgerRows) || [])[0];
  const normalized = normalizeD6jDNhapXuatRowFromValues_(target.values);
  assertD6jCSheetRowMatches_(normalized, expected);
  ['averageUnitCost', 'stockQuantity', 'stockValue'].forEach(key => {
    if (!Number.isFinite(Number(normalized[key]))) throw d6jCError_('BLOCKED_D6J_D_REPAIRED_NUMERIC_FIELD_INVALID');
  });
  return {
    targetRowNumber: target.rowNumber,
    currentValues: target.values.slice(0, 16),
    currentFormulas: target.formulas.slice(0, 16)
  };
}

function findD6jDMalformedPilotRows_(snapshot, context) {
  const row = ((context && context.ledgerRows) || [])[0] || {};
  const plan = context && context.plan || {};
  const xmlHash = normalizeD6jCString_(plan.driveTargets && plan.driveTargets.xml && plan.driveTargets.xml.contentHash);
  const pdfHash = normalizeD6jCString_(plan.driveTargets && plan.driveTargets.pdf && plan.driveTargets.pdf.contentHash);
  return (snapshot.rows || []).filter(item => {
    const v = item.values || [];
    return normalizeD6jCComparableDate_(v[1]) === normalizeD6jCComparableDate_(row.issueDate)
      && normalizeD6jCString_(v[4]) === normalizeD6jCString_(row.itemCode)
      && normalizeD6jCString_(v[5]) === normalizeD6jCString_(row.itemName)
      && normalizeD6jCString_(v[6]).toUpperCase() === normalizeD6jCString_(row.direction).toUpperCase()
      && numbersEqualD6jD_(v[7], row.quantity)
      && numbersEqualD6jD_(v[8], row.unitPrice)
      && normalizeD6jCString_(v[9]) === normalizeD6jCString_(row.legacyInvoiceKey)
      && normalizeD6jCString_(v[10]) === normalizeD6jCString_(row.transactionIdentity || row.lineIdentityV2)
      && normalizeD6jCString_(v[11]) === xmlHash
      && normalizeD6jCString_(v[12]) === pdfHash
      && normalizeD6jCString_(v[13]) === normalizeD6jCString_(row.invoiceKeyV2)
      && !normalizeD6jCString_(v[2])
      && !normalizeD6jCString_(v[3])
      && !normalizeD6jCString_(v[14]);
  });
}

function buildD6jDRepairCellChanges_(inspection) {
  const current = inspection.currentValues || [];
  const expected = inspection.expected || {};
  const values = expected.values || [];
  const changes = [];
  for (let index = 1; index < 16; index += 1) {
    if (index === 15 && expected.pWritePolicy === 'DO_NOT_WRITE') continue;
    if (index === 15 && expected.pFormulaR1C1) {
      if (normalizeD6jCString_((inspection.currentFormulasR1C1 || [])[15]) !== normalizeD6jCString_(expected.pFormulaR1C1)) {
        changes.push({ column: 16, formulaR1C1: expected.pFormulaR1C1 });
      }
      continue;
    }
    if (!d6jDCellEqual_(current[index], values[index])) {
      changes.push({ column: index + 1, value: values[index] });
    }
  }
  return changes;
}

function buildD6jCNhapXuatRowAP_(row, plan, inventory, hdRule) {
  const expected = row || {};
  const safeInventory = inventory || {};
  const amount = Number.isFinite(Number(expected.amount)) ? Number(expected.amount) : Number(expected.quantity || 0) * Number(expected.unitPrice || 0);
  const values = [
    '',
    expected.issueDate || '',
    expected.invoiceNo || '',
    expected.customerName || '',
    expected.itemCode || '',
    expected.itemName || '',
    expected.direction || D6J_C_DIRECTION_,
    Number(expected.quantity || 0),
    Number(expected.unitPrice || 0),
    amount,
    Number(safeInventory.averageUnitCost || 0),
    Number(safeInventory.stockQuantity || 0),
    Number(safeInventory.stockValue || 0),
    expected.legacyHashIndex || buildD6jCInvoiceItemHash_(expected),
    expected.invoiceKeyV2 || expected.legacyInvoiceKey || '',
    ''
  ];
  const rule = hdRule || { type: 'UNRESOLVED' };
  if (rule.type === 'UNRESOLVED') throw d6jCError_('BLOCKED_HD_COLUMN_RULE_UNRESOLVED');
  const output = { values, pWritePolicy: 'WRITE_VALUE', pFormulaR1C1: '' };
  if (rule.type === 'ARRAYFORMULA') {
    output.pWritePolicy = 'DO_NOT_WRITE';
    return output;
  }
  if (rule.type === 'ROW_RELATIVE_FORMULA') {
    output.pWritePolicy = 'WRITE_FORMULA_R1C1';
    output.pFormulaR1C1 = rule.formulaR1C1;
    return output;
  }
  if (rule.type === 'HYPERLINK_OR_LOOKUP') {
    output.values[15] = rule.value || '';
    output.pFormulaR1C1 = rule.formulaR1C1 || '';
    output.pWritePolicy = output.pFormulaR1C1 ? 'WRITE_FORMULA_R1C1' : 'WRITE_VALUE';
    return output;
  }
  throw d6jCError_('BLOCKED_HD_COLUMN_RULE_UNRESOLVED');
}

function calculateD6jDInventoryForTarget_(previousRowsAP, targetRow) {
  let stockQuantity = 0;
  let stockValue = 0;
  let averageUnitCost = 0;
  (previousRowsAP || []).forEach(row => {
    if (normalizeD6jCString_(row[4]) !== normalizeD6jCString_(targetRow.itemCode)) return;
    const type = normalizeD6jCString_(row[6]).toUpperCase();
    let quantity = Number(row[7] || 0);
    const unitPrice = Number(row[8] || 0);
    if (type === 'NHAP') {
      const amount = quantity * unitPrice;
      stockQuantity += quantity;
      stockValue += amount;
      averageUnitCost = stockQuantity ? stockValue / stockQuantity : 0;
    } else if (type === 'XUAT') {
      if (quantity > stockQuantity) quantity = stockQuantity;
      stockQuantity -= quantity;
      stockValue = stockQuantity * averageUnitCost;
      if (stockQuantity <= 0) {
        stockQuantity = 0;
        stockValue = 0;
        averageUnitCost = 0;
      }
    }
  });
  const incomingQuantity = Number(targetRow.quantity || 0);
  const incomingAmount = Number.isFinite(Number(targetRow.amount)) ? Number(targetRow.amount) : incomingQuantity * Number(targetRow.unitPrice || 0);
  stockQuantity += incomingQuantity;
  stockValue += incomingAmount;
  averageUnitCost = stockQuantity ? stockValue / stockQuantity : 0;
  return { amount: incomingAmount, averageUnitCost, stockQuantity, stockValue };
}

function assertNoLaterD6jDItemTransactions_(snapshot, targetRowNumber, itemCode) {
  const later = (snapshot.rows || []).filter(row => Number(row.rowNumber) > Number(targetRowNumber)
    && normalizeD6jCString_(row.values && row.values[4]) === normalizeD6jCString_(itemCode));
  if (later.length) throw d6jCError_('BLOCKED_LATER_ITEM_TRANSACTIONS_REQUIRE_BOUNDED_REBUILD');
}

function resolveD6jDHdColumnRule_(snapshot, targetRowNumber) {
  if (d6jDColumnHasArrayFormula_(snapshot, 15)) return { type: 'ARRAYFORMULA', writePolicy: 'DO_NOT_WRITE' };
  const neighbors = (snapshot.rows || [])
    .filter(row => Number(row.rowNumber) !== Number(targetRowNumber))
    .map(row => normalizeD6jCString_((row.formulasR1C1 || [])[15] || (row.formulas || [])[15]))
    .filter(Boolean)
    .filter(formula => !/^=ARRAYFORMULA/i.test(formula));
  const unique = Array.from(new Set(neighbors));
  if (unique.length === 1) return { type: 'ROW_RELATIVE_FORMULA', formulaR1C1: unique[0], writePolicy: 'WRITE_FORMULA_R1C1' };
  const hyperlink = unique.filter(formula => /(HYPERLINK|VLOOKUP|XLOOKUP|INDEX|MATCH)/i.test(formula));
  if (hyperlink.length === 1) return { type: 'HYPERLINK_OR_LOOKUP', formulaR1C1: hyperlink[0], writePolicy: 'WRITE_FORMULA_R1C1' };
  return { type: 'UNRESOLVED', writePolicy: 'BLOCK' };
}

function d6jDColumnHasArrayFormula_(snapshot, columnIndex) {
  return (snapshot.rows || []).some(row => /^=ARRAYFORMULA/i.test(normalizeD6jCString_((row.formulas || [])[columnIndex] || (row.formulasR1C1 || [])[columnIndex])));
}

function assertD6jDHeaderSchema_(headers) {
  const actual = (headers || []).slice(0, 16).map(canonicalD6jDHeader_);
  const expected = D6J_D_TARGET_HEADERS_.map(canonicalD6jDHeader_);
  if (actual.length !== 16 || actual.some((value, index) => value !== expected[index])) {
    throw d6jCError_('BLOCKED_D6J_D_HEADER_SCHEMA_MISMATCH');
  }
}

function normalizeD6jDNhapXuatRowFromValues_(row) {
  const values = row || [];
  return {
    issueDate: values[1],
    invoiceNo: values[2],
    customerName: values[3],
    legacyInvoiceKey: values[14],
    invoiceKeyV2: values[14],
    sourceLineNo: 1,
    lineIdentityV2: values[13],
    legacyHashIndex: values[13],
    transactionIdentity: values[13],
    direction: values[6],
    itemCode: values[4],
    itemName: values[5],
    quantity: Number(values[7] || 0),
    unitPrice: Number(values[8] || 0),
    amount: Number(values[9] || 0),
    averageUnitCost: Number(values[10] || 0),
    stockQuantity: Number(values[11] || 0),
    stockValue: Number(values[12] || 0)
  };
}

async function recordD6jDRepairAudit_(createJobStore, evidence) {
  const store = typeof createJobStore === 'function' ? createJobStore() : null;
  if (!store || typeof store.appendAuditEvent !== 'function') return { status: 'NOT_AVAILABLE' };
  await store.appendAuditEvent({
    jobId: D6J_D_ORIGINAL_JOB_ID_,
    eventType: 'D6J_D_SINGLE_ROW_REPAIR',
    actorType: 'APPS_SCRIPT_D6J_D',
    safeDetails: {
      beforeHash: evidence.beforeHash,
      afterHash: evidence.afterHash,
      changedColumns: evidence.changedColumns,
      repairedAt: evidence.clock && evidence.clock.now ? evidence.clock.now() : ''
    }
  });
  return { status: 'RECORDED' };
}

function createD6jDRepairBlockedResult_(code) {
  return {
    PHASE: 'D6J_D_NHAP_XUAT_SCHEMA_MAPPING_FIX_AND_SINGLE_PILOT_ROW_REPAIR_CHANNEL',
    REPAIR_STATUS: code,
    BLOCKER_CODE: code,
    OWNER_APPROVAL_MARKER_VALID: 'NO',
    SHEET_ROWS_UPDATED: 0,
    SHEET_ROWS_APPENDED: 0,
    SHEET_ROWS_DELETED: 0,
    DRIVE_MUTATION_COUNT: 0,
    GMAIL_MUTATION_COUNT: 0,
    TRIGGER_MUTATION_COUNT: 0,
    DESTRUCTIVE_OPERATION_COUNT: 0,
    PRODUCTION_MUTATION: 'NONE',
    SCHEMA_VERSION: D6J_D_SCHEMA_VERSION_
  };
}

function buildD6jCInvoiceItemHash_(values) {
  const source = values || {};
  if (typeof buildInvoiceItemHash_ === 'function') {
    const hash = buildInvoiceItemHash_({
      invoiceDate: source.issueDate || source.invoiceDate,
      invoiceNo: source.invoiceNo,
      customerName: source.customerName,
      itemCode: source.itemCode,
      itemName: source.itemName,
      invoiceType: source.direction || source.invoiceType || D6J_C_DIRECTION_,
      qty: source.quantity || source.qty
    });
    if (!hash) throw d6jCError_('BLOCKED_D6J_D_HASHINDEX_EMPTY');
    return hash;
  }
  return hashPrefixD6jC_([
    source.issueDate || source.invoiceDate,
    source.invoiceNo,
    source.customerName,
    source.itemCode,
    source.itemName,
    source.direction || source.invoiceType || D6J_C_DIRECTION_,
    source.quantity || source.qty
  ].join('|'), 64);
}

function canonicalD6jDHeader_(value) {
  return normalizeD6jCString_(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toLowerCase();
}

function normalizeD6jCComparableDate_(value) {
  return normalizeD6jCString_(value).replace(/\D/g, '');
}

function numbersEqualD6jD_(a, b) {
  return Math.abs(Number(a || 0) - Number(b || 0)) < 0.000001;
}

function d6jDCellEqual_(a, b) {
  if (typeof a === 'number' || typeof b === 'number') return numbersEqualD6jD_(a, b);
  return normalizeD6jCString_(a) === normalizeD6jCString_(b);
}

function logD6jDSanitizedResult_(logger, result) {
  const text = JSON.stringify(result);
  if (/(Bearer|Authorization|refresh_token|private_key|client_secret|<\?xml|<Invoice|JVBERi0|\b80,68,70\b)/i.test(text)) {
    throw d6jCError_('BLOCKED_UNSAFE_D6J_D_LOG_PAYLOAD');
  }
  logger.log(text);
}

function createD6jCDefaultDurableJobStore_() {
  if (typeof createDurableInvoiceJobStore !== 'function') throw d6jCError_('BLOCKED_D6J_C_DURABLE_STORE_MISSING');
  return createDurableInvoiceJobStore(createD6jCFirestoreDurableTransport_(), { clock: { now: () => new Date().toISOString() } });
}

function createD6jCDefaultLeaseStore_() {
  return createD6jCFirestoreLeaseStore_(createD6jCFirestoreDurableTransport_(), {
    clock: { now: () => new Date().toISOString() },
    leaseDurationMs: D6J_C_LEASE_DURATION_MS_
  });
}

function createD6jCFirestoreLeaseStore_(transport, options) {
  if (!transport || typeof transport.runTransaction !== 'function') throw d6jCError_('BLOCKED_D6J_C_LEASE_TRANSPORT_MISSING');
  const opts = options || {};
  const clock = opts.clock && typeof opts.clock.now === 'function' ? opts.clock : { now: () => new Date().toISOString() };
  const leaseDurationMs = Math.max(60000, Math.min(Number(opts.leaseDurationMs || D6J_C_LEASE_DURATION_MS_), 30 * 60 * 1000));

  function pathFor(leaseId) {
    const id = normalizeD6jCString_(leaseId);
    if (!/^[A-Za-z0-9._:-]{1,180}$/.test(id)) throw d6jCError_('BLOCKED_D6J_C_LEASE_ID_INVALID');
    return 'worker_leases/' + id;
  }

  function normalizeRequest(request) {
    const req = request || {};
    const leaseId = normalizeD6jCString_(req.leaseId);
    const jobId = normalizeD6jCString_(req.jobId);
    const fencingToken = normalizeD6jCString_(req.fencingToken);
    if (!leaseId || !jobId || !fencingToken) throw d6jCError_('BLOCKED_D6J_C_LEASE_REQUEST_INVALID');
    if (leaseId !== jobId) throw d6jCError_('BLOCKED_D6J_C_LEASE_JOB_CONFLICT');
    const acquiredAt = normalizeD6jCString_(req.acquiredAt || clock.now());
    const expiresAt = normalizeD6jCString_(req.expiresAt || addD6jCMilliseconds_(acquiredAt, leaseDurationMs));
    assertD6jCFutureTimestamp_(expiresAt, acquiredAt);
    return {
      leaseId,
      jobId,
      leaseOwner: normalizeD6jCString_(req.leaseOwner || D6J_C_LEASE_OWNER_),
      fencingToken,
      acquiredAt,
      expiresAt
    };
  }

  function activeLease(req, now, extras) {
    const sourceExtras = extras || {};
    const previousLeaseGeneration = Number(sourceExtras.previousLeaseGeneration || 0);
    const cleanExtras = { ...sourceExtras };
    delete cleanExtras.previousLeaseGeneration;
    return {
      leaseId: req.leaseId,
      jobId: req.jobId,
      leaseOwner: req.leaseOwner,
      status: 'ACTIVE',
      fencingToken: req.fencingToken,
      leaseGeneration: Number.isFinite(previousLeaseGeneration) && previousLeaseGeneration >= 0 ? previousLeaseGeneration + 1 : 1,
      acquiredAt: now,
      expiresAt: req.expiresAt,
      releasedAt: '',
      finalJobStatus: '',
      updatedAt: now,
      ...cleanExtras
    };
  }

  function assertSameLeaseIdentity(current, req) {
    if (normalizeD6jCString_(current.jobId) !== req.jobId) throw d6jCError_('BLOCKED_D6J_C_LEASE_JOB_CONFLICT');
    if (normalizeD6jCString_(current.fencingToken) !== req.fencingToken) throw d6jCError_('BLOCKED_D6J_C_LEASE_FENCING_TOKEN_MISMATCH');
  }

  async function acquireLease(request) {
    const req = normalizeRequest(request);
    const now = req.acquiredAt;
    return transport.runTransaction(async tx => {
      const path = pathFor(req.leaseId);
      const current = await tx.getDocument(path);
      if (!current) {
        const created = activeLease(req, now, { createdAt: now });
        await tx.createDocument(path, created, { idempotencyKey: req.fencingToken });
        return { status: 'ACQUIRED', mutationCount: 1, reclaimStatus: 'CREATED', expiresAt: created.expiresAt, lease: cloneD6jCJson_(created) };
      }
      const currentStatus = normalizeD6jCString_(current.status || (current.releasedAt ? 'RELEASED' : 'ACTIVE'));
      if (currentStatus === 'ACTIVE') {
        const sameJob = normalizeD6jCString_(current.jobId) === req.jobId;
        const sameFence = normalizeD6jCString_(current.fencingToken) === req.fencingToken;
        if (sameJob && sameFence) {
          return { status: 'ALREADY_HELD_BY_SAME_JOB', idempotent: true, mutationCount: 0, reclaimStatus: 'SAME_OWNER_ACTIVE', expiresAt: current.expiresAt, lease: cloneD6jCJson_(current) };
        }
        if (sameJob && !sameFence) throw d6jCError_('BLOCKED_D6J_C_LEASE_FENCING_TOKEN_MISMATCH');
        if (!isD6jCTimestampExpired_(current.expiresAt, now)) throw d6jCError_('ACTIVE_LEASE_FOUND');
        const reclaimed = activeLease(req, now, {
          previousLeaseStatus: currentStatus,
          previousLeaseOwner: normalizeD6jCString_(current.leaseOwner),
          previousLeaseUpdatedAt: normalizeD6jCString_(current.updatedAt),
          previousLeaseExpiresAt: normalizeD6jCString_(current.expiresAt),
          previousFencingTokenHashPrefix: hashPrefixD6jC_(current.fencingToken || '', 8),
          previousLeaseGeneration: Number(current.leaseGeneration || 0),
          reclaimedAt: now
        });
        await tx.updateDocument(path, reclaimed);
        return { status: 'LEASE_RECLAIMED_EXPIRED', mutationCount: 1, reclaimStatus: 'RECLAIMED_EXPIRED', expiresAt: reclaimed.expiresAt, lease: cloneD6jCJson_(reclaimed) };
      }
      if (currentStatus === 'RELEASED' || currentStatus === 'RECONCILIATION_REQUIRED') {
        assertSameLeaseIdentity(current, req);
        const reacquired = activeLease(req, now, {
          previousLeaseStatus: currentStatus,
          previousFinalJobStatus: normalizeD6jCString_(current.finalJobStatus),
          previousReleasedAt: normalizeD6jCString_(current.releasedAt),
          previousLeaseGeneration: Number(current.leaseGeneration || 0),
          reacquiredAt: now
        });
        await tx.updateDocument(path, reacquired);
        return {
          status: currentStatus === 'RELEASED' ? 'ACQUIRED_AFTER_RELEASED' : 'ACQUIRED_AFTER_RECONCILIATION_REQUIRED',
          mutationCount: 1,
          reclaimStatus: currentStatus === 'RELEASED' ? 'REACQUIRED_RELEASED' : 'REACQUIRED_RECONCILIATION_REQUIRED',
          expiresAt: reacquired.expiresAt,
          lease: cloneD6jCJson_(reacquired)
        };
      }
      throw d6jCError_('BLOCKED_D6J_C_LEASE_STATUS_UNSUPPORTED');
    });
  }

  async function releaseLease(request) {
    const req = request || {};
    const releasedAt = normalizeD6jCString_(req.releasedAt || clock.now());
    const finalJobStatus = normalizeD6jCString_(req.finalJobStatus || 'UNKNOWN');
    return transport.runTransaction(async tx => {
      const path = pathFor(req.leaseId);
      const current = await tx.getDocument(path);
      if (!current) throw d6jCError_('BLOCKED_D6J_C_LEASE_NOT_FOUND');
      assertSameLeaseIdentity(current, { jobId: normalizeD6jCString_(req.jobId), fencingToken: normalizeD6jCString_(req.fencingToken) });
      if (normalizeD6jCString_(current.status) === 'RELEASED' && normalizeD6jCString_(current.finalJobStatus) === finalJobStatus) {
        return { status: 'CONFIRMED', mutationCount: 0, lease: cloneD6jCJson_(current) };
      }
      const next = {
        ...current,
        status: 'RELEASED',
        releasedAt,
        finalJobStatus,
        updatedAt: releasedAt
      };
      await tx.updateDocument(path, next);
      return { status: 'CONFIRMED', mutationCount: 1, lease: cloneD6jCJson_(next) };
    });
  }

  async function markLeaseReconciliationRequired(request) {
    const req = request || {};
    const releasedAt = normalizeD6jCString_(req.releasedAt || clock.now());
    const errorCode = normalizeD6jCErrorCode_(req.errorCode || 'D6J_C_RECONCILIATION_REQUIRED');
    return transport.runTransaction(async tx => {
      const path = pathFor(req.leaseId);
      const current = await tx.getDocument(path);
      if (!current) throw d6jCError_('BLOCKED_D6J_C_LEASE_NOT_FOUND');
      assertSameLeaseIdentity(current, { jobId: normalizeD6jCString_(req.jobId), fencingToken: normalizeD6jCString_(req.fencingToken) });
      const next = {
        ...current,
        status: 'RECONCILIATION_REQUIRED',
        releasedAt,
        finalJobStatus: 'RECONCILIATION_REQUIRED',
        reconciliationErrorCode: errorCode,
        updatedAt: releasedAt
      };
      await tx.updateDocument(path, next);
      return { status: 'RECONCILIATION_REQUIRED', mutationCount: 1, lease: cloneD6jCJson_(next) };
    });
  }

  async function getLease(request) {
    const leaseId = normalizeD6jCString_(request && (request.leaseId || request.jobId));
    return cloneD6jCJson_(await transport.getDocument(pathFor(leaseId)));
  }

  return Object.freeze({ acquireLease, releaseLease, markLeaseReconciliationRequired, getLease });
}

function createD6jCFirestoreDurableTransport_() {
  const codec = createFirestoreValueCodec_();
  async function request(method, path, body, options) {
    const safePath = method === 'LIST' ? validateD6jCFirestoreCollectionPath_(path) : validateD6jCFirestorePath_(path);
    const url = buildD6jCFirestoreUrl_(safePath, method, options || {});
    const params = {
      method: (method === 'LIST' ? 'GET' : method).toLowerCase(),
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
    const state = await readD6jCFirestoreDocumentReadState_(path);
    return state ? cloneD6jCJson_(state.data) : null;
  }
  async function readD6jCFirestoreDocumentReadState_(path) {
    const doc = await request('GET', path, null, {});
    if (!doc) return null;
    const updateTime = normalizeD6jCString_(doc.updateTime);
    if (!updateTime) throw d6jCError_('FIRESTORE_DOCUMENT_UPDATE_TIME_MISSING');
    return Object.freeze({
      data: codec.decodeDocument(doc),
      name: normalizeD6jCString_(doc.name),
      createTime: normalizeD6jCString_(doc.createTime),
      updateTime
    });
  }
  async function createDocument(path, data, options) {
    const encoded = codec.encodeDocument(data || {});
    const doc = await request('POST', path, encoded, { ...(options || {}), create: true, currentDocument: { exists: false } });
    return codec.decodeDocument(doc);
  }
  async function updateDocument(path, data, options) {
    const fields = Object.keys(data || {}).sort();
    const opts = options || {};
    const currentDocument = opts.currentDocument || {};
    const expectedUpdateTime = normalizeD6jCString_(opts.expectedUpdateTime || currentDocument.updateTime);
    const requestOptions = {
      ...opts,
      updateMask: fields,
      currentDocument: expectedUpdateTime ? { ...currentDocument, updateTime: expectedUpdateTime } : currentDocument
    };
    const doc = await request('PATCH', path, codec.encodeDocument(data || {}), requestOptions);
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
    if (typeof work !== 'function') throw d6jCError_('FIRESTORE_TRANSACTION_CALLBACK_MISSING');
    const readUpdateTimes = {};
    const tx = Object.freeze({
      async getDocument(path) {
        const safePath = validateD6jCFirestorePath_(path);
        const state = await readD6jCFirestoreDocumentReadState_(safePath.path);
        if (state) readUpdateTimes[safePath.path] = state.updateTime;
        return state ? cloneD6jCJson_(state.data) : null;
      },
      async createDocument(path, data, options) {
        return createDocument(path, data, options || {});
      },
      async updateDocument(path, data, options) {
        const safePath = validateD6jCFirestorePath_(path);
        const opts = options || {};
        const currentDocument = opts.currentDocument || {};
        const expectedUpdateTime = normalizeD6jCString_(opts.expectedUpdateTime || currentDocument.updateTime || readUpdateTimes[safePath.path]);
        if (!expectedUpdateTime) throw d6jCError_('FIRESTORE_PRECONDITION_MISSING');
        return updateDocument(safePath.path, data, {
          ...opts,
          expectedUpdateTime,
          currentDocument: { ...currentDocument, updateTime: expectedUpdateTime }
        });
      },
      async appendDocument(collectionPath, data, options) {
        return appendDocument(collectionPath, data, options || {});
      },
      async queryDocuments(collectionPath) {
        return queryDocuments(collectionPath);
      }
    });
    return work(tx);
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
  if (method === 'LIST') {
    return d6jCFirestoreBaseUrl_() + '/' + encodedPath + '?pageSize=100';
  }
  if (method === 'PATCH') {
    const query = [];
    (options.updateMask || []).forEach(field => {
      query.push('updateMask.fieldPaths=' + encodeURIComponent(field));
    });
    const currentDocument = (options && options.currentDocument) || {};
    const updateTime = normalizeD6jCString_(currentDocument.updateTime);
    if (updateTime) query.push('currentDocument.updateTime=' + encodeURIComponent(updateTime));
    if (typeof currentDocument.exists === 'boolean') query.push('currentDocument.exists=' + String(currentDocument.exists));
    return d6jCFirestoreBaseUrl_() + '/' + encodedPath + (query.length ? '?' + query.join('&') : '');
  }
  return d6jCFirestoreBaseUrl_() + '/' + encodedPath;
}

function validateD6jCFirestoreCollectionPath_(path) {
  const value = normalizeD6jCString_(path);
  if (!value || value.indexOf('//') >= 0 || value.charAt(0) === '/' || value.charAt(value.length - 1) === '/') {
    throw d6jCError_('FIRESTORE_REQUEST_PATH_INVALID');
  }
  if (/[?#\\]/.test(value)) throw d6jCError_('FIRESTORE_REQUEST_PATH_INVALID');
  const parts = value.split('/');
  if (parts.length < 1 || parts.length % 2 !== 1) throw d6jCError_('FIRESTORE_COLLECTION_PATH_DEPTH_UNSUPPORTED');
  parts.forEach(part => {
    if (!/^[A-Za-z0-9._:-]{1,180}$/.test(part)) throw d6jCError_('FIRESTORE_DOCUMENT_ID_INVALID');
  });
  return { path: value, parts };
}

function d6jCFirestoreBaseUrl_() {
  return 'https://firestore.googleapis.com/v1/projects/'
    + D6J_C_FIRESTORE_PROJECT_ID_
    + '/databases/'
    + encodeURIComponent(D6J_C_FIRESTORE_DATABASE_ID_)
    + '/documents';
}

function createD6jCFirestoreError_(status, path, text) {
  const errorStatus = extractD6jCFirestoreErrorStatus_(text || '');
  const code = classifyD6jCFirestoreErrorCode_(status, errorStatus);
  const error = d6jCError_([
    code,
    'HTTP_STATUS=' + status,
    'FIRESTORE_PROJECT_ID=' + D6J_C_FIRESTORE_PROJECT_ID_,
    'FIRESTORE_DATABASE_ID=' + D6J_C_FIRESTORE_DATABASE_ID_,
    'FIRESTORE_REQUEST_PATH=' + path,
    'FIRESTORE_ERROR_STATUS=' + errorStatus,
    'FIRESTORE_ERROR_MESSAGE=' + sanitizeD6jCLogText_(text || '')
  ].join(';'));
  error.httpStatus = Number(status || 0);
  error.code = code;
  return error;
}

function classifyD6jCFirestoreErrorCode_(status, errorStatus) {
  const httpStatus = Number(status || 0);
  const firestoreStatus = normalizeD6jCString_(errorStatus).toUpperCase();
  if ([409, 412].includes(httpStatus) || ['ABORTED', 'ALREADY_EXISTS', 'FAILED_PRECONDITION'].includes(firestoreStatus)) {
    return 'FIRESTORE_CONCURRENT_MODIFICATION';
  }
  return 'FIRESTORE_HTTP_REQUEST_FAILED';
}

function extractD6jCFirestoreErrorStatus_(text) {
  try {
    const parsed = JSON.parse(String(text || '{}'));
    return sanitizeD6jCLogText_(parsed && parsed.error && parsed.error.status || 'UNKNOWN');
  } catch (_err) {
    return 'UNKNOWN';
  }
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
    LEASE_FINAL_STATUS: 'NOT_ATTEMPTED',
    LEASE_RELEASE_STATUS: 'NOT_ATTEMPTED',
    LEASE_EXPIRES_AT: '',
    LEASE_RECLAIM_STATUS: 'NOT_EVALUATED',
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

function addD6jCMilliseconds_(timestamp, durationMs) {
  const base = parseD6jCTimestamp_(timestamp);
  if (!Number.isFinite(base)) throw d6jCError_('BLOCKED_D6J_C_LEASE_TIMESTAMP_INVALID');
  return new Date(base + Number(durationMs || 0)).toISOString();
}

function assertD6jCFutureTimestamp_(timestamp, referenceTimestamp) {
  const value = parseD6jCTimestamp_(timestamp);
  const reference = parseD6jCTimestamp_(referenceTimestamp);
  if (!Number.isFinite(value) || !Number.isFinite(reference) || value <= reference) {
    throw d6jCError_('BLOCKED_D6J_C_LEASE_EXPIRES_AT_NOT_FUTURE');
  }
}

function isD6jCTimestampExpired_(timestamp, referenceTimestamp) {
  const value = parseD6jCTimestamp_(timestamp);
  const reference = parseD6jCTimestamp_(referenceTimestamp);
  if (!Number.isFinite(value) || !Number.isFinite(reference)) return false;
  return value <= reference;
}

function parseD6jCTimestamp_(value) {
  const time = Date.parse(normalizeD6jCString_(value));
  return Number.isFinite(time) ? time : NaN;
}

function cloneD6jCJson_(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
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
