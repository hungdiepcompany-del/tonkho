const D7_E3V_PHASE_ = 'D7_E3V_TO_X_EXACT_POST_HOC_ATTRIBUTION_AND_FIRESTORE_RECONCILIATION_DECISION';
const D7_E3V_PUBLIC_ENTRYPOINT_ = 'runD7E3VExactPostHocAttributionReadOnly';
const D7_E3V_SCHEMA_VERSION_ = 'D7_E3V_ATTRIBUTION_RESULT_V1';

const D7_E3V_ATTRIBUTION_DECISIONS_ = Object.freeze({
  PROVEN_D7_E: 'ATTRIBUTION_PROVEN_D7_E',
  PROVEN_EXTERNAL_OR_USER_CREATED: 'ATTRIBUTION_PROVEN_EXTERNAL_OR_USER_CREATED',
  CONFLICT: 'ATTRIBUTION_CONFLICT',
  UNPROVEN: 'ATTRIBUTION_UNPROVEN'
});

const D7_E3V_FIRESTORE_STATE_DECISIONS_ = Object.freeze({
  ALREADY_CONSISTENT: 'FIRESTORE_ALREADY_CONSISTENT',
  FINALIZATION_MISSING: 'FIRESTORE_FINALIZATION_MISSING_AFTER_PROVEN_D7_E_WRITE',
  POST_HOC_RECORD_MISSING: 'POST_HOC_ATTRIBUTION_RECORD_MISSING',
  EXTERNAL_OR_USER_REVIEW: 'EXTERNAL_OR_USER_STATE_REQUIRES_MANUAL_REVIEW',
  CONFLICT_REVIEW: 'ATTRIBUTION_CONFLICT_REQUIRES_MANUAL_REVIEW',
  UNPROVEN_REVIEW: 'ATTRIBUTION_UNPROVEN_REQUIRES_MANUAL_REVIEW'
});

const D7_E3V_RECONCILIATION_PLAN_TYPES_ = Object.freeze({
  NO_ACTION: 'NO_ACTION_REQUIRED',
  POST_HOC_EVENT: 'POST_HOC_RECONCILIATION_EVENT_REVIEW_REQUIRED',
  FIRESTORE_STATE: 'FIRESTORE_STATE_RECONCILIATION_REVIEW_REQUIRED',
  OWNER_REVIEW: 'OWNER_MANUAL_REVIEW_REQUIRED',
  FRESH_RERUN: 'FRESH_READ_ONLY_RERUN_REQUIRED'
});

const D7_E3V_REASON_CODES_ = Object.freeze([
  'ATTRIBUTION_JOB_IDENTITY_MISMATCH',
  'ATTRIBUTION_COMMIT_PLAN_MISMATCH',
  'ATTRIBUTION_DRIVE_XML_IDENTITY_MISMATCH',
  'ATTRIBUTION_DRIVE_PDF_IDENTITY_MISMATCH',
  'ATTRIBUTION_DRIVE_XML_HASH_MISMATCH',
  'ATTRIBUTION_DRIVE_PDF_HASH_MISMATCH',
  'ATTRIBUTION_SHEET_ROW_IDENTITY_MISMATCH',
  'ATTRIBUTION_SHEET_TRANSACTION_IDENTITY_MISSING',
  'ATTRIBUTION_SHEET_TRANSACTION_IDENTITY_MISMATCH',
  'ATTRIBUTION_DURABLE_LINK_MISSING',
  'ATTRIBUTION_DURABLE_LINK_EXACT',
  'ATTRIBUTION_EXTERNAL_CREATOR_PROVEN',
  'ATTRIBUTION_CONFLICTING_EVIDENCE',
  'ATTRIBUTION_CONCURRENT_CHANGE',
  'ATTRIBUTION_READ_INCOMPLETE',
  'ATTRIBUTION_PROVEN_D7_E'
]);

function runD7E3VExactPostHocAttributionReadOnly() {
  const runner = createD7E3VExactPostHocAttributionReadOnlyRunner_();
  return runner.run();
}

function createD7E3VExactPostHocAttributionReadOnlyRunner_(dependencies) {
  const d = dependencies || {};
  const productionReaders = d.productionReaders || (typeof createD7E3RExactBoundedProductionReadOnlyAdapters_ === 'function'
    ? createD7E3RExactBoundedProductionReadOnlyAdapters_()
    : {});
  const services = {
    readConfiguration: d.readConfiguration || (typeof readD7E3IConfigurationReadOnly_ === 'function'
      ? readD7E3IConfigurationReadOnly_
      : function unavailableConfigD7E3V_() { return { status: 'READ_CONFIGURATION_INVALID', reasonCode: 'D7_E3V_CONFIGURATION_READER_UNAVAILABLE' }; }),
    readSnapshot: d.readSnapshot || productionReaders.readSnapshot || unavailableD7E3VReader_('SNAPSHOT'),
    readGmailEvidence: d.readGmailEvidence || productionReaders.readGmailEvidence || unavailableD7E3VReader_('GMAIL'),
    readDriveEvidence: d.readDriveEvidence || productionReaders.readDriveEvidence || unavailableD7E3VReader_('DRIVE'),
    readSheetsEvidence: d.readSheetsEvidence || productionReaders.readSheetsEvidence || unavailableD7E3VReader_('SHEETS'),
    readFirestoreEvidence: d.readFirestoreEvidence || productionReaders.readFirestoreEvidence || unavailableD7E3VReader_('FIRESTORE'),
    now: d.now || function nowD7E3V_() { return new Date().toISOString(); },
    logger: d.logger || (typeof Logger !== 'undefined' ? Logger : { log: function noopD7E3V_() {} })
  };

  function run() {
    const createdAt = services.now();
    const configuration = safeReadD7E3V_('CONFIGURATION', services.readConfiguration, {});
    const readArgs = { configuration: configuration };
    const beforeSnapshot = normalizeSnapshotD7E3V_(safeReadD7E3V_('BEFORE_SNAPSHOT', services.readSnapshot, { stage: 'BEFORE', configuration: configuration }), 'BEFORE');
    const gmail = normalizeGmailD7E3V_(safeReadD7E3V_('GMAIL', services.readGmailEvidence, readArgs));
    const driveXml = normalizeDriveD7E3V_('XML', safeReadD7E3V_('DRIVE_XML', services.readDriveEvidence, { artifactType: 'XML', configuration: configuration }));
    const drivePdf = normalizeDriveD7E3V_('PDF', safeReadD7E3V_('DRIVE_PDF', services.readDriveEvidence, { artifactType: 'PDF', configuration: configuration }));
    const sheets = normalizeSheetsD7E3V_(safeReadD7E3V_('SHEETS', services.readSheetsEvidence, readArgs));
    const firestore = normalizeFirestoreD7E3V_(safeReadD7E3V_('FIRESTORE', services.readFirestoreEvidence, readArgs));
    const afterSnapshot = normalizeSnapshotD7E3V_(safeReadD7E3V_('AFTER_SNAPSHOT', services.readSnapshot, { stage: 'AFTER', configuration: configuration }), 'AFTER');
    const concurrency = compareSnapshotsD7E3V_(beforeSnapshot, afterSnapshot);
    const evidence = buildAttributionEvidenceD7E3V_({
      configuration,
      beforeSnapshot,
      gmail,
      driveXml,
      drivePdf,
      sheets,
      firestore,
      afterSnapshot,
      concurrency
    });
    const attribution = decideAttributionD7E3V_(evidence);
    const firestoreStateDecision = decideFirestoreStateD7E3V_(evidence, attribution);
    const reconciliation = decideReconciliationD7E3V_(evidence, attribution, firestoreStateDecision);
    const safeCounters = buildSafetyCountersD7E3V_(gmail, driveXml, drivePdf, sheets, firestore);

    const result = {
      phase: D7_E3V_PHASE_,
      status: statusD7E3V_(evidence, attribution),
      runtimeMutation: 'NONE',
      beforeSnapshotStatus: beforeSnapshot.status,
      afterSnapshotStatus: afterSnapshot.status,
      concurrentChangeStatus: concurrency.status,
      sourceEvidence: gmail.publicEvidence,
      driveEvidence: {
        XML: driveXml.publicEvidence,
        PDF: drivePdf.publicEvidence
      },
      sheetEvidence: sheets.publicEvidence,
      firestoreEvidence: firestore.publicEvidence,
      durableLinkEvidence: evidence.durableLinkEvidence,
      attributionDecision: attribution.decision,
      attributionReasonCodes: attribution.reasonCodes,
      reconciliationDecision: reconciliation,
      safeCounters: safeCounters,
      PHASE: D7_E3V_PHASE_,
      STATUS: statusD7E3V_(evidence, attribution),
      RUNTIME_MUTATION: 'NONE',
      BEFORE_SNAPSHOT_STATUS: beforeSnapshot.status,
      AFTER_SNAPSHOT_STATUS: afterSnapshot.status,
      CONCURRENT_CHANGE_STATUS: concurrency.status,
      SOURCE_EVIDENCE: gmail.publicEvidence,
      DRIVE_EVIDENCE: {
        XML: driveXml.publicEvidence,
        PDF: drivePdf.publicEvidence
      },
      SHEET_EVIDENCE: sheets.publicEvidence,
      FIRESTORE_EVIDENCE: firestore.publicEvidence,
      DURABLE_LINK_EVIDENCE: evidence.durableLinkEvidence,
      JOB_IDENTITY_EXACT: evidence.safeFields.JOB_IDENTITY_EXACT,
      COMMIT_PLAN_IDENTITY_EXACT: evidence.safeFields.COMMIT_PLAN_IDENTITY_EXACT,
      GMAIL_SOURCE_IDENTITY_EXACT: evidence.safeFields.GMAIL_SOURCE_IDENTITY_EXACT,
      DRIVE_XML_IDENTITY_EXACT: evidence.safeFields.DRIVE_XML_IDENTITY_EXACT,
      DRIVE_XML_CONTENT_HASH_MATCH: evidence.safeFields.DRIVE_XML_CONTENT_HASH_MATCH,
      DRIVE_PDF_IDENTITY_EXACT: evidence.safeFields.DRIVE_PDF_IDENTITY_EXACT,
      DRIVE_PDF_CONTENT_HASH_MATCH: evidence.safeFields.DRIVE_PDF_CONTENT_HASH_MATCH,
      SHEET_ROW_IDENTITY_EXACT: evidence.safeFields.SHEET_ROW_IDENTITY_EXACT,
      SHEET_TRANSACTION_IDENTITY_EXACT: evidence.safeFields.SHEET_TRANSACTION_IDENTITY_EXACT,
      SHEET_CONTENT_MATCH: evidence.safeFields.SHEET_CONTENT_MATCH,
      DURABLE_WRITE_ATTEMPT_LINK_EXACT: evidence.safeFields.DURABLE_WRITE_ATTEMPT_LINK_EXACT,
      DURABLE_AUDIT_LINK_EXACT: evidence.safeFields.DURABLE_AUDIT_LINK_EXACT,
      DURABLE_ATTACHMENT_RECORD_LINK_EXACT: evidence.safeFields.DURABLE_ATTACHMENT_RECORD_LINK_EXACT,
      CONFLICTING_ATTRIBUTION_EVIDENCE_PRESENT: evidence.safeFields.CONFLICTING_ATTRIBUTION_EVIDENCE_PRESENT,
      CONCURRENT_CHANGE_DETECTED: evidence.safeFields.CONCURRENT_CHANGE_DETECTED,
      ATTRIBUTION_DECISION: attribution.decision,
      ATTRIBUTION_REASON_CODES: attribution.reasonCodes,
      FIRESTORE_STATE_DECISION: firestoreStateDecision,
      RECONCILIATION_PLAN_TYPE: reconciliation.planType,
      RECONCILIATION_AUTOMATIC_EXECUTION_ALLOWED: reconciliation.automaticExecutionAllowed,
      RECONCILIATION_PLAN_EXECUTED: reconciliation.reconciliationPlanExecuted,
      NEXT_PHASE: reconciliation.nextPhase,
      SAFE_COUNTERS: safeCounters,
      METADATA: {
        schemaVersion: D7_E3V_SCHEMA_VERSION_,
        publicEntrypoint: D7_E3V_PUBLIC_ENTRYPOINT_,
        createdAtStatus: createdAt ? 'CAPTURED' : 'UNAVAILABLE',
        exactBoundedReadersRequired: 'YES',
        productionIdentifiersEmitted: 'NO'
      }
    };
    const safe = sanitizeObjectD7E3V_(result);
    services.logger.log('D7_E3V_ATTRIBUTION_RESULT ' + JSON.stringify(safe));
    return safe;
  }

  return Object.freeze({ run: run });
}

function buildAttributionEvidenceD7E3V_(parts) {
  const gmail = parts.gmail;
  const driveXml = parts.driveXml;
  const drivePdf = parts.drivePdf;
  const sheets = parts.sheets;
  const firestore = parts.firestore;
  const concurrency = parts.concurrency;
  const readIncomplete = parts.beforeSnapshot.incomplete || parts.afterSnapshot.incomplete ||
    gmail.incomplete || driveXml.incomplete || drivePdf.incomplete || sheets.incomplete || firestore.incomplete;
  const externalCreatorProven = exactD7E3V_(sheets.externalEvidenceLinksExactRowIdentity) ||
    exactD7E3V_(firestore.externalCreatorEvidenceStatus) ||
    exactD7E3V_(firestore.externalEvidenceLinksExactState);
  const durableWriteAttemptLinkExact = exactD7E3V_(firestore.durableWriteAttemptLinkExact) ||
    exactD7E3V_(firestore.writeAttemptLinkStatus) ||
    exactD7E3V_(firestore.exactWriteOutcomeLinkStatus);
  const durableAuditLinkExact = exactD7E3V_(firestore.durableAuditLinkExact) ||
    exactD7E3V_(firestore.auditLinkStatus) ||
    exactD7E3V_(sheets.auditLinksExactRowIdentity);
  const durableAttachmentRecordLinkExact = exactD7E3V_(firestore.durableAttachmentRecordLinkExact) ||
    exactD7E3V_(firestore.attachmentRecordLinkStatus) ||
    exactD7E3V_(sheets.attachmentRecordLinksExactRowIdentity);
  const durableLinkExact = durableWriteAttemptLinkExact || durableAuditLinkExact || durableAttachmentRecordLinkExact;
  const conflict = concurrency.concurrentChange ||
    externalCreatorProven && durableLinkExact ||
    conflictD7E3V_(firestore.jobIdentityStatus) ||
    conflictD7E3V_(firestore.commitPlanStatus) ||
    conflictD7E3V_(firestore.commitPlanIdentityStatus) ||
    conflictD7E3V_(firestore.expectedDriveIdentitiesStatus) ||
    conflictD7E3V_(firestore.expectedSheetTransactionIdentityStatus) ||
    conflictD7E3V_(firestore.writeAttemptLinkStatus) ||
    conflictD7E3V_(firestore.auditLinkStatus) ||
    conflictD7E3V_(firestore.attachmentRecordLinkStatus) ||
    conflictD7E3V_(sheets.rowTransactionIdentityStatus) ||
    conflictD7E3V_(sheets.auditRowIdentityLinkStatus) ||
    exactD7E3V_(sheets.conflictingAttributionEvidencePresent) ||
    exactD7E3V_(firestore.conflictingAttributionEvidencePresent);
  const sheetPredatesAttempt = statusEqD7E3V_(sheets.temporalStatus, 'PREDATES_D7_E_ATTEMPT') ||
    statusEqD7E3V_(sheets.rowTemporalStatus, 'PREDATES_D7_E_ATTEMPT');
  const externalStateExact = gmail.sourceIdentityExact && driveXml.identityExact && driveXml.hashMatch &&
    drivePdf.identityExact && drivePdf.hashMatch && sheets.rowIdentityExact && sheets.transactionIdentityExact &&
    sheets.contentMatch;
  const safeFields = {
    JOB_IDENTITY_EXACT: boolD7E3V_(firestore.jobIdentityExact),
    COMMIT_PLAN_IDENTITY_EXACT: boolD7E3V_(firestore.commitPlanIdentityExact),
    GMAIL_SOURCE_IDENTITY_EXACT: boolD7E3V_(gmail.sourceIdentityExact),
    DRIVE_XML_IDENTITY_EXACT: boolD7E3V_(driveXml.identityExact),
    DRIVE_XML_CONTENT_HASH_MATCH: boolD7E3V_(driveXml.hashMatch),
    DRIVE_PDF_IDENTITY_EXACT: boolD7E3V_(drivePdf.identityExact),
    DRIVE_PDF_CONTENT_HASH_MATCH: boolD7E3V_(drivePdf.hashMatch),
    SHEET_ROW_IDENTITY_EXACT: boolD7E3V_(sheets.rowIdentityExact),
    SHEET_TRANSACTION_IDENTITY_EXACT: boolD7E3V_(sheets.transactionIdentityExact),
    SHEET_CONTENT_MATCH: boolD7E3V_(sheets.contentMatch),
    DURABLE_WRITE_ATTEMPT_LINK_EXACT: boolD7E3V_(durableWriteAttemptLinkExact),
    DURABLE_AUDIT_LINK_EXACT: boolD7E3V_(durableAuditLinkExact),
    DURABLE_ATTACHMENT_RECORD_LINK_EXACT: boolD7E3V_(durableAttachmentRecordLinkExact),
    CONFLICTING_ATTRIBUTION_EVIDENCE_PRESENT: boolD7E3V_(conflict),
    CONCURRENT_CHANGE_DETECTED: boolD7E3V_(concurrency.concurrentChange)
  };
  return {
    readIncomplete: readIncomplete,
    externalStateExact: externalStateExact,
    durableLinkExact: durableLinkExact,
    externalCreatorProven: externalCreatorProven,
    conflict: conflict,
    sheetPredatesAttempt: sheetPredatesAttempt,
    concurrency: concurrency,
    firestoreJobState: firestore.jobState,
    firestoreReconciliationStatus: firestore.reconciliationReportStatus,
    firestoreUnknownOutcomeExact: exactD7E3V_(firestore.exactWriteOutcomeLinkStatus) || statusEqD7E3V_(firestore.writeOutcomeEvidenceStatus, 'UNKNOWN_WRITE_OUTCOME_EXACT_LINK'),
    safeFields: safeFields,
    durableLinkEvidence: {
      EXACT_WRITE_ATTEMPT_LINK_REFERENCE_UNAVAILABLE: boolD7E3V_(!durableWriteAttemptLinkExact),
      DURABLE_WRITE_ATTEMPT_LINK_EXACT: safeFields.DURABLE_WRITE_ATTEMPT_LINK_EXACT,
      DURABLE_AUDIT_LINK_EXACT: safeFields.DURABLE_AUDIT_LINK_EXACT,
      DURABLE_ATTACHMENT_RECORD_LINK_EXACT: safeFields.DURABLE_ATTACHMENT_RECORD_LINK_EXACT,
      EXACT_DURABLE_LINK_REQUIRED: 'YES',
      CONTENT_SIMILARITY_ALONE_ATTRIBUTION_PROHIBITED: 'YES',
      GENERIC_UNKNOWN_WRITE_OUTCOME_ATTRIBUTION_PROHIBITED: 'YES',
      CALLER_ATTRIBUTION_LABEL_ATTRIBUTION_PROHIBITED: 'YES'
    }
  };
}

function decideAttributionD7E3V_(evidence) {
  const reasonCodes = [];
  if (evidence.readIncomplete) reasonCodes.push('ATTRIBUTION_READ_INCOMPLETE');
  if (evidence.concurrency.concurrentChange) reasonCodes.push('ATTRIBUTION_CONCURRENT_CHANGE');
  if (evidence.conflict) reasonCodes.push('ATTRIBUTION_CONFLICTING_EVIDENCE');
  if (evidence.safeFields.JOB_IDENTITY_EXACT !== 'YES') reasonCodes.push('ATTRIBUTION_JOB_IDENTITY_MISMATCH');
  if (evidence.safeFields.COMMIT_PLAN_IDENTITY_EXACT !== 'YES') reasonCodes.push('ATTRIBUTION_COMMIT_PLAN_MISMATCH');
  if (evidence.safeFields.DRIVE_XML_IDENTITY_EXACT !== 'YES') reasonCodes.push('ATTRIBUTION_DRIVE_XML_IDENTITY_MISMATCH');
  if (evidence.safeFields.DRIVE_PDF_IDENTITY_EXACT !== 'YES') reasonCodes.push('ATTRIBUTION_DRIVE_PDF_IDENTITY_MISMATCH');
  if (evidence.safeFields.DRIVE_XML_CONTENT_HASH_MATCH !== 'YES') reasonCodes.push('ATTRIBUTION_DRIVE_XML_HASH_MISMATCH');
  if (evidence.safeFields.DRIVE_PDF_CONTENT_HASH_MATCH !== 'YES') reasonCodes.push('ATTRIBUTION_DRIVE_PDF_HASH_MISMATCH');
  if (evidence.safeFields.SHEET_ROW_IDENTITY_EXACT !== 'YES') reasonCodes.push('ATTRIBUTION_SHEET_ROW_IDENTITY_MISMATCH');
  if (evidence.safeFields.SHEET_TRANSACTION_IDENTITY_EXACT !== 'YES') reasonCodes.push('ATTRIBUTION_SHEET_TRANSACTION_IDENTITY_MISSING');
  if (evidence.sheetPredatesAttempt) reasonCodes.push('ATTRIBUTION_SHEET_TRANSACTION_IDENTITY_MISMATCH');
  if (evidence.externalCreatorProven) reasonCodes.push('ATTRIBUTION_EXTERNAL_CREATOR_PROVEN');
  if (evidence.durableLinkExact) reasonCodes.push('ATTRIBUTION_DURABLE_LINK_EXACT');
  if (!evidence.durableLinkExact) reasonCodes.push('ATTRIBUTION_DURABLE_LINK_MISSING');

  let decision = D7_E3V_ATTRIBUTION_DECISIONS_.UNPROVEN;
  if (evidence.conflict || evidence.concurrency.concurrentChange) {
    decision = D7_E3V_ATTRIBUTION_DECISIONS_.CONFLICT;
  } else if (evidence.externalCreatorProven) {
    decision = D7_E3V_ATTRIBUTION_DECISIONS_.PROVEN_EXTERNAL_OR_USER_CREATED;
  } else if (!evidence.readIncomplete &&
      evidence.safeFields.JOB_IDENTITY_EXACT === 'YES' &&
      evidence.safeFields.COMMIT_PLAN_IDENTITY_EXACT === 'YES' &&
      evidence.safeFields.GMAIL_SOURCE_IDENTITY_EXACT === 'YES' &&
      evidence.safeFields.DRIVE_XML_IDENTITY_EXACT === 'YES' &&
      evidence.safeFields.DRIVE_XML_CONTENT_HASH_MATCH === 'YES' &&
      evidence.safeFields.DRIVE_PDF_IDENTITY_EXACT === 'YES' &&
      evidence.safeFields.DRIVE_PDF_CONTENT_HASH_MATCH === 'YES' &&
      evidence.safeFields.SHEET_ROW_IDENTITY_EXACT === 'YES' &&
      evidence.safeFields.SHEET_TRANSACTION_IDENTITY_EXACT === 'YES' &&
      evidence.safeFields.SHEET_CONTENT_MATCH === 'YES' &&
      evidence.durableLinkExact &&
      !evidence.sheetPredatesAttempt) {
    decision = D7_E3V_ATTRIBUTION_DECISIONS_.PROVEN_D7_E;
    reasonCodes.push('ATTRIBUTION_PROVEN_D7_E');
  }
  return {
    decision: decision,
    reasonCodes: uniqueReasonCodesD7E3V_(reasonCodes)
  };
}

function decideFirestoreStateD7E3V_(evidence, attribution) {
  if (evidence.concurrency.concurrentChange || evidence.readIncomplete) return D7_E3V_FIRESTORE_STATE_DECISIONS_.UNPROVEN_REVIEW;
  if (attribution.decision === D7_E3V_ATTRIBUTION_DECISIONS_.CONFLICT) return D7_E3V_FIRESTORE_STATE_DECISIONS_.CONFLICT_REVIEW;
  if (attribution.decision === D7_E3V_ATTRIBUTION_DECISIONS_.PROVEN_EXTERNAL_OR_USER_CREATED) return D7_E3V_FIRESTORE_STATE_DECISIONS_.EXTERNAL_OR_USER_REVIEW;
  if (attribution.decision !== D7_E3V_ATTRIBUTION_DECISIONS_.PROVEN_D7_E) return D7_E3V_FIRESTORE_STATE_DECISIONS_.UNPROVEN_REVIEW;
  if (statusEqD7E3V_(evidence.firestoreJobState, 'COMPLETED') && statusEqD7E3V_(evidence.firestoreReconciliationStatus, 'CONSISTENT')) {
    return D7_E3V_FIRESTORE_STATE_DECISIONS_.ALREADY_CONSISTENT;
  }
  if (evidence.externalStateExact && statusEqD7E3V_(evidence.firestoreJobState, 'VALIDATED') && evidence.firestoreUnknownOutcomeExact) {
    return D7_E3V_FIRESTORE_STATE_DECISIONS_.FINALIZATION_MISSING;
  }
  if (evidence.externalStateExact) return D7_E3V_FIRESTORE_STATE_DECISIONS_.POST_HOC_RECORD_MISSING;
  return D7_E3V_FIRESTORE_STATE_DECISIONS_.UNPROVEN_REVIEW;
}

function decideReconciliationD7E3V_(evidence, attribution, firestoreStateDecision) {
  let planType = D7_E3V_RECONCILIATION_PLAN_TYPES_.OWNER_REVIEW;
  let nextPhase = 'D7_E3Y_OWNER_UNPROVEN_ATTRIBUTION_REVIEW';
  if (evidence.concurrency.concurrentChange || evidence.readIncomplete) {
    planType = D7_E3V_RECONCILIATION_PLAN_TYPES_.FRESH_RERUN;
    nextPhase = 'D7_E3Y_FRESH_EXACT_ATTRIBUTION_READ_ONLY_RERUN';
  } else if (firestoreStateDecision === D7_E3V_FIRESTORE_STATE_DECISIONS_.ALREADY_CONSISTENT) {
    planType = D7_E3V_RECONCILIATION_PLAN_TYPES_.NO_ACTION;
    nextPhase = 'NONE_D7_E_STATE_ALREADY_CONSISTENT';
  } else if (firestoreStateDecision === D7_E3V_FIRESTORE_STATE_DECISIONS_.FINALIZATION_MISSING) {
    planType = D7_E3V_RECONCILIATION_PLAN_TYPES_.FIRESTORE_STATE;
    nextPhase = 'D7_E3Y_OWNER_APPROVED_EXACT_FIRESTORE_STATE_RECONCILIATION';
  } else if (firestoreStateDecision === D7_E3V_FIRESTORE_STATE_DECISIONS_.POST_HOC_RECORD_MISSING) {
    planType = D7_E3V_RECONCILIATION_PLAN_TYPES_.POST_HOC_EVENT;
    nextPhase = 'D7_E3Y_OWNER_APPROVED_EXACT_POST_HOC_RECONCILIATION_EVENT';
  } else if (attribution.decision === D7_E3V_ATTRIBUTION_DECISIONS_.PROVEN_EXTERNAL_OR_USER_CREATED) {
    nextPhase = 'D7_E3Y_OWNER_EXTERNAL_STATE_CONFLICT_REVIEW';
  } else if (attribution.decision === D7_E3V_ATTRIBUTION_DECISIONS_.CONFLICT) {
    nextPhase = 'D7_E3Y_OWNER_ATTRIBUTION_CONFLICT_REVIEW';
  }
  return {
    planType: planType,
    firestoreStateDecision: firestoreStateDecision,
    nextPhase: nextPhase,
    automaticExecutionAllowed: 'NO',
    reconciliationPlanExecuted: 'NO',
    ownerApprovalRequired: planType === D7_E3V_RECONCILIATION_PLAN_TYPES_.NO_ACTION ? 'NO' : 'YES'
  };
}

function statusD7E3V_(evidence, attribution) {
  if (evidence.readIncomplete) return 'BLOCKED_D7_E3V_ATTRIBUTION_READ_INCOMPLETE';
  if (attribution.decision === D7_E3V_ATTRIBUTION_DECISIONS_.CONFLICT) return 'PASS_D7_E3V_ATTRIBUTION_CONFLICT_READ_ONLY';
  return 'PASS_D7_E3V_ATTRIBUTION_DECISION_READ_ONLY';
}

function normalizeGmailD7E3V_(raw) {
  const input = raw || {};
  const sourceIdentityExact = input.status === 'READ_OK' &&
    exactD7E3V_(input.exactTargetMatched !== false) &&
    Number(input.candidateCount || 0) === 1 &&
    Number(input.messageCount || 0) === 1 &&
    Number(input.xmlAttachmentCount || 0) === 1 &&
    Number(input.pdfAttachmentCount || 0) === 1;
  return {
    incomplete: input.status !== 'READ_OK',
    sourceIdentityExact: sourceIdentityExact,
    readCallCount: boundedNumberD7E3V_(input.readCallCount, sourceIdentityExact ? 1 : 0),
    publicEvidence: {
      readStatus: stringD7E3V_(input.status || 'READ_BLOCKED'),
      exactTargetMatched: boolD7E3V_(sourceIdentityExact),
      messageCountStatus: Number(input.messageCount || 0) === 1 ? 'EXACT_ONE' : 'NOT_EXACT_ONE',
      xmlAttachmentCountStatus: Number(input.xmlAttachmentCount || 0) === 1 ? 'EXACT_ONE' : 'NOT_EXACT_ONE',
      pdfAttachmentCountStatus: Number(input.pdfAttachmentCount || 0) === 1 ? 'EXACT_ONE' : 'NOT_EXACT_ONE',
      readerImplementation: stringD7E3V_(input.readerImplementation || 'UNAVAILABLE')
    }
  };
}

function normalizeDriveD7E3V_(kind, raw) {
  const input = raw || {};
  const identityExact = input.status === 'READ_OK' && exactD7E3V_(input.exactTargetMatched !== false) && Number(input.candidateCount || 0) === 1;
  const hashMatch = identityExact && (input.reasonCode === 'READ_OK' || input.providerChecksumStatus === 'HASH_VERIFIED_BY_CONTENT' || exactD7E3V_(input.contentHashMatch));
  return {
    incomplete: input.status !== 'READ_OK',
    identityExact: identityExact,
    hashMatch: hashMatch,
    readCallCount: boundedNumberD7E3V_(input.readCallCount, identityExact ? 1 : 0),
    publicEvidence: {
      artifactType: kind,
      readStatus: stringD7E3V_(input.status || 'READ_BLOCKED'),
      exactTargetMatched: boolD7E3V_(identityExact),
      contentHashMatch: boolD7E3V_(hashMatch),
      metadataReadStatus: stringD7E3V_(input.metadataReadStatus || 'UNAVAILABLE'),
      contentReadStatus: stringD7E3V_(input.contentReadStatus || 'UNAVAILABLE'),
      duplicateConflictStatus: Number(input.candidateCount || 0) > 1 ? 'PRESENT' : 'ABSENT',
      readerImplementation: stringD7E3V_(input.readerImplementation || 'UNAVAILABLE')
    }
  };
}

function normalizeSheetsD7E3V_(raw) {
  const input = raw || {};
  const rowIdentityExact = input.status === 'READ_OK' &&
    (exactD7E3V_(input.exactTargetMatched) || (Number(input.canonicalRowCount || 0) === 1 && Number(input.exactIdentityMatchCount || 0) === 1));
  const transactionIdentityExact = rowIdentityExact && exactD7E3V_(input.rowTransactionIdentityStatus || input.SHEET_TRANSACTION_IDENTITY_EXACT);
  const contentMatch = rowIdentityExact && exactD7E3V_(input.contentStatus || input.SHEET_CONTENT_MATCH);
  return {
    incomplete: input.status !== 'READ_OK',
    rowIdentityExact: rowIdentityExact,
    transactionIdentityExact: transactionIdentityExact,
    contentMatch: contentMatch,
    externalEvidenceLinksExactRowIdentity: input.externalEvidenceLinksExactRowIdentity,
    auditLinksExactRowIdentity: input.auditLinksExactRowIdentity || input.auditRowIdentityLinkStatus,
    attachmentRecordLinksExactRowIdentity: input.attachmentRecordLinksExactRowIdentity,
    conflictingAttributionEvidencePresent: input.conflictingAttributionEvidencePresent,
    rowTransactionIdentityStatus: input.rowTransactionIdentityStatus || (transactionIdentityExact ? 'MATCH' : 'UNAVAILABLE'),
    auditRowIdentityLinkStatus: input.auditRowIdentityLinkStatus || 'UNAVAILABLE',
    temporalStatus: input.temporalStatus || input.rowTemporalStatus || 'UNAVAILABLE',
    rowTemporalStatus: input.rowTemporalStatus || input.temporalStatus || 'UNAVAILABLE',
    readCallCount: boundedNumberD7E3V_(input.readCallCount, rowIdentityExact ? 1 : 0),
    publicEvidence: {
      readStatus: stringD7E3V_(input.status || 'READ_BLOCKED'),
      exactTargetMatched: boolD7E3V_(rowIdentityExact),
      rowIdentityExact: boolD7E3V_(rowIdentityExact),
      transactionIdentityExact: boolD7E3V_(transactionIdentityExact),
      contentMatch: boolD7E3V_(contentMatch),
      duplicateConflictStatus: Number(input.conflictingIdentityCount || 0) > 0 ? 'PRESENT' : 'ABSENT',
      callerAttributionLabelIgnored: 'YES',
      rawRowValuesEmitted: 'NO',
      readerImplementation: stringD7E3V_(input.readerImplementation || 'UNAVAILABLE')
    }
  };
}

function normalizeFirestoreD7E3V_(raw) {
  const input = raw || {};
  const jobIdentityExact = input.status === 'READ_OK' && input.jobExists !== false && exactD7E3V_(input.jobIdentityStatus);
  const commitPlanIdentityExact = input.status === 'READ_OK' &&
    exactD7E3V_(input.commitPlanStatus) &&
    exactD7E3V_(input.commitPlanIdentityStatus) &&
    exactD7E3V_(input.expectedDriveIdentitiesStatus) &&
    exactD7E3V_(input.expectedSheetTransactionIdentityStatus);
  return {
    incomplete: input.status !== 'READ_OK',
    jobIdentityExact: jobIdentityExact,
    commitPlanIdentityExact: commitPlanIdentityExact,
    jobIdentityStatus: input.jobIdentityStatus || 'UNAVAILABLE',
    commitPlanStatus: input.commitPlanStatus || 'UNAVAILABLE',
    commitPlanIdentityStatus: input.commitPlanIdentityStatus || 'UNAVAILABLE',
    expectedDriveIdentitiesStatus: input.expectedDriveIdentitiesStatus || 'UNAVAILABLE',
    expectedSheetTransactionIdentityStatus: input.expectedSheetTransactionIdentityStatus || 'UNAVAILABLE',
    durableWriteAttemptLinkExact: input.durableWriteAttemptLinkExact,
    durableAuditLinkExact: input.durableAuditLinkExact,
    durableAttachmentRecordLinkExact: input.durableAttachmentRecordLinkExact,
    writeAttemptLinkStatus: input.writeAttemptLinkStatus || 'UNAVAILABLE',
    exactWriteOutcomeLinkStatus: input.exactWriteOutcomeLinkStatus || 'UNAVAILABLE',
    auditLinkStatus: input.auditLinkStatus || input.auditAttributionStatus || 'UNAVAILABLE',
    attachmentRecordLinkStatus: input.attachmentRecordLinkStatus || 'UNAVAILABLE',
    externalCreatorEvidenceStatus: input.externalCreatorEvidenceStatus || 'UNAVAILABLE',
    externalEvidenceLinksExactState: input.externalEvidenceLinksExactState,
    conflictingAttributionEvidencePresent: input.conflictingAttributionEvidencePresent,
    writeOutcomeEvidenceStatus: input.writeOutcomeEvidenceStatus || 'UNAVAILABLE',
    jobState: input.jobState || 'UNAVAILABLE',
    reconciliationReportStatus: input.reconciliationReportStatus || 'UNAVAILABLE',
    readCallCount: boundedNumberD7E3V_(input.readCallCount, input.status === 'READ_OK' ? 1 : 0),
    publicEvidence: {
      readStatus: stringD7E3V_(input.status || 'READ_BLOCKED'),
      exactTargetMatched: boolD7E3V_(input.status === 'READ_OK' && input.exactTargetMatched !== false),
      jobIdentityExact: boolD7E3V_(jobIdentityExact),
      commitPlanIdentityExact: boolD7E3V_(commitPlanIdentityExact),
      jobStateStatus: safeEnumD7E3V_(input.jobState || 'UNAVAILABLE'),
      writeOutcomeEvidenceStatus: safeEnumD7E3V_(input.writeOutcomeEvidenceStatus || 'UNAVAILABLE'),
      exactDurableLinkStatus: boolD7E3V_(exactD7E3V_(input.writeAttemptLinkStatus) || exactD7E3V_(input.auditLinkStatus) || exactD7E3V_(input.attachmentRecordLinkStatus)),
      rawDocumentPathsEmitted: 'NO',
      readerImplementation: stringD7E3V_(input.readerImplementation || 'UNAVAILABLE')
    }
  };
}

function normalizeSnapshotD7E3V_(raw, stage) {
  const input = raw || {};
  const status = input.status || 'SNAPSHOT_UNAVAILABLE';
  const fingerprint = sanitizeFingerprintD7E3V_(input.snapshotFingerprint || input.fingerprint || input.fingerprints || '');
  return {
    status: status,
    stage: stage,
    fingerprint: status === 'SNAPSHOT_CAPTURED' ? fingerprint : '',
    incomplete: status !== 'SNAPSHOT_CAPTURED' || !fingerprint
  };
}

function compareSnapshotsD7E3V_(beforeSnapshot, afterSnapshot) {
  if (beforeSnapshot.fingerprint && afterSnapshot.fingerprint && beforeSnapshot.fingerprint === afterSnapshot.fingerprint) {
    return { status: 'NO_CONCURRENT_CHANGE_DETECTED', concurrentChange: false };
  }
  if (beforeSnapshot.fingerprint && afterSnapshot.fingerprint) return { status: 'CONCURRENT_CHANGE_DETECTED', concurrentChange: true };
  return { status: 'CONCURRENT_CHANGE_CHECK_INCOMPLETE', concurrentChange: false };
}

function buildSafetyCountersD7E3V_(gmail, driveXml, drivePdf, sheets, firestore) {
  const readCounts = {
    READ_ONLY_GMAIL_CALL_COUNT: boundedNumberD7E3V_(gmail.readCallCount, 0),
    READ_ONLY_DRIVE_CALL_COUNT: boundedNumberD7E3V_(driveXml.readCallCount, 0) + boundedNumberD7E3V_(drivePdf.readCallCount, 0),
    READ_ONLY_SHEETS_CALL_COUNT: boundedNumberD7E3V_(sheets.readCallCount, 0),
    READ_ONLY_FIRESTORE_CALL_COUNT: boundedNumberD7E3V_(firestore.readCallCount, 0)
  };
  return {
    GMAIL_MUTATION_COUNT: 0,
    DRIVE_MUTATION_COUNT: 0,
    SHEETS_MUTATION_COUNT: 0,
    FIRESTORE_MUTATION_COUNT: 0,
    TRIGGER_MUTATION_COUNT: 0,
    DESTRUCTIVE_OPERATION_COUNT: 0,
    REPAIR_OPERATION_COUNT: 0,
    RECONCILIATION_WRITE_COUNT: 0,
    PRODUCTION_MUTATION_COUNT: 0,
    READ_ONLY_GMAIL_CALL_COUNT: readCounts.READ_ONLY_GMAIL_CALL_COUNT,
    READ_ONLY_DRIVE_CALL_COUNT: readCounts.READ_ONLY_DRIVE_CALL_COUNT,
    READ_ONLY_SHEETS_CALL_COUNT: readCounts.READ_ONLY_SHEETS_CALL_COUNT,
    READ_ONLY_FIRESTORE_CALL_COUNT: readCounts.READ_ONLY_FIRESTORE_CALL_COUNT,
    READ_CALLS_WITHIN_MAXIMA: boolD7E3V_(
      readCounts.READ_ONLY_GMAIL_CALL_COUNT <= 1 &&
      readCounts.READ_ONLY_DRIVE_CALL_COUNT <= 4 &&
      readCounts.READ_ONLY_SHEETS_CALL_COUNT <= 1 &&
      readCounts.READ_ONLY_FIRESTORE_CALL_COUNT <= 5
    )
  };
}

function safeReadD7E3V_(label, fn, args) {
  try {
    return fn(args || {});
  } catch (error) {
    return {
      status: 'READ_BLOCKED',
      reasonCode: safeErrorCodeD7E3V_(error),
      evidenceSource: label,
      safeErrorClass: safeErrorCodeD7E3V_(error)
    };
  }
}

function unavailableD7E3VReader_(channel) {
  return function unavailableReaderD7E3V_() {
    return {
      status: 'READ_BLOCKED',
      reasonCode: 'D7_E3V_' + channel + '_READER_UNAVAILABLE',
      readerImplementation: 'UNAVAILABLE',
      readAttempted: true,
      readSucceeded: false,
      exactTargetMatched: false,
      readCallCount: 0
    };
  };
}

function exactD7E3V_(value) {
  if (value === true) return true;
  const text = stringD7E3V_(value).toUpperCase();
  return text === 'YES' || text === 'MATCH' || text === 'EXACT' || text === 'EXACT_MATCH' || text === 'PRESENT_EXACT';
}

function conflictD7E3V_(value) {
  return /CONFLICT|MISMATCH|DUPLICATE|AMBIGUOUS/.test(stringD7E3V_(value).toUpperCase());
}

function statusEqD7E3V_(value, expected) {
  return stringD7E3V_(value).toUpperCase() === stringD7E3V_(expected).toUpperCase();
}

function boolD7E3V_(value) {
  return value ? 'YES' : 'NO';
}

function boundedNumberD7E3V_(value, fallback) {
  const n = Number(value);
  if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  return Number(fallback || 0);
}

function uniqueReasonCodesD7E3V_(codes) {
  const seen = {};
  return (codes || []).filter(function keep(code) {
    const safe = safeEnumD7E3V_(code);
    if (D7_E3V_REASON_CODES_.indexOf(safe) < 0 || seen[safe]) return false;
    seen[safe] = true;
    return true;
  });
}

function safeEnumD7E3V_(value) {
  return stringD7E3V_(value).toUpperCase().replace(/[^A-Z0-9_]/g, '_').slice(0, 80) || 'UNAVAILABLE';
}

function sanitizeFingerprintD7E3V_(value) {
  if (!value) return '';
  const text = typeof value === 'string' ? value : JSON.stringify(sanitizeObjectD7E3V_(value));
  return text.replace(/[^A-Za-z0-9_:{},." -]/g, '').slice(0, 240);
}

function sanitizeObjectD7E3V_(value) {
  if (Array.isArray(value)) return value.map(sanitizeObjectD7E3V_);
  if (value && typeof value === 'object') {
    const out = {};
    Object.keys(value).forEach(function eachKey(key) {
      if (/raw|token|authorization|messageId|threadId|driveId|spreadsheetId|documentPath|fileName|url|email|invoiceNumber|customerName/i.test(key)) {
        out[key] = 'REDACTED';
      } else {
        out[key] = sanitizeObjectD7E3V_(value[key]);
      }
    });
    return out;
  }
  if (typeof value === 'string') return value.replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer REDACTED').slice(0, 240);
  return value;
}

function safeErrorCodeD7E3V_(error) {
  return safeEnumD7E3V_(error && (error.code || error.name || error.message) || 'UNKNOWN_READ_BLOCKER');
}

function stringD7E3V_(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}
