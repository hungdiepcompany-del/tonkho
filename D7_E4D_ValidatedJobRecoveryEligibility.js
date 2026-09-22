const D7_E4D_EVIDENCE_IDS_ = Object.freeze([
  'R01', 'R02', 'R03', 'R04', 'R05', 'R06', 'R07', 'R08', 'R09',
  'R10', 'R11', 'R12', 'R13', 'R14', 'R15', 'R16', 'R17', 'R18',
  'R19', 'R20', 'R21', 'R22', 'R23', 'R24', 'R25', 'R26', 'R27'
]);

const D7_E4D_CAPABILITY_IDS_ = Object.freeze([
  'C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'C07'
]);

const D7_E4D_RECOVERY_STATE_PATH_ = Object.freeze([
  'VALIDATED',
  'FILES_SAVED',
  'COMMITTING',
  'ROWS_COMMITTED',
  'INVENTORY_PENDING',
  'PROJECTIONS_COMMITTED',
  'COMPLETED'
]);

const D7_E4D_EVIDENCE_CLASSES_ = Object.freeze({
  EXACT: 'EXACT_EVIDENCE',
  CONTRADICTORY: 'CONTRADICTORY_EVIDENCE',
  MISSING: 'MISSING_EVIDENCE',
  UNKNOWN: 'UNKNOWN_EVIDENCE',
  INCOMPLETE: 'INCOMPLETE_EVIDENCE',
  MALFORMED: 'MALFORMED_EVIDENCE',
  CAPABILITY: 'CAPABILITY_GAP'
});

function evaluateD7E4DValidatedJobRecoveryEligibility_(input) {
  const value = d7e4dObject_(input);
  const expected = d7e4dObject_(value.expected);
  const snapshot = d7e4dObject_(value.snapshot);
  const source = d7e4dObject_(value.sourceEvidence);
  const capabilities = d7e4dObject_(value.capabilities);
  const job = d7e4dObject_(snapshot.job);
  const lease = d7e4dObject_(snapshot.lease);
  const commitPlan = d7e4dObject_(job.commitPlan);
  const targets = d7e4dObject_(commitPlan.driveEvidenceTargets);

  const evidence = [
    d7e4dNumber_(snapshot.exactJobCount, 1),
    d7e4dNumber_(snapshot.nonExactCandidateCount, 0),
    d7e4dReadOutcome_(snapshot),
    d7e4dString_(job.jobId, expected.jobId),
    d7e4dString_(job.invoiceIdentityHash, expected.invoiceIdentityHash),
    d7e4dString_(job.status, 'VALIDATED'),
    d7e4dNumber_(job.version, 4),
    d7e4dString_(job.reconciliationStatus, 'RECONCILIATION_REQUIRED'),
    d7e4dString_(commitPlan.jobId, expected.jobId),
    d7e4dNumber_(commitPlan.expectedLineCount, 1),
    d7e4dString_(targets.xmlContentHash, expected.xmlSha256),
    d7e4dString_(targets.pdfContentHash, expected.pdfSha256),
    d7e4dString_(lease.status, 'RECONCILIATION_REQUIRED'),
    d7e4dString_(lease.jobId, expected.jobId),
    d7e4dString_(lease.fencingToken, expected.leaseFence),
    d7e4dPositiveInteger_(lease.leaseGeneration),
    d7e4dCompleteArrayCount_(snapshot.events, snapshot.eventsComplete, 2),
    d7e4dCompleteArrayCount_(snapshot.reports, snapshot.reportsComplete, 1),
    d7e4dLatestReport_(snapshot),
    d7e4dBothAbsent_(snapshot.xmlAttachmentPresent, snapshot.pdfAttachmentPresent),
    d7e4dProvenBoolean_(snapshot.sheetExactRowPresent, false, snapshot.sheetEvidenceAvailable, snapshot.sheetEvidenceComplete),
    d7e4dProvenBoolean_(snapshot.sheetContentMatches, false, snapshot.sheetEvidenceAvailable, snapshot.sheetEvidenceComplete),
    d7e4dProvenBoolean_(snapshot.driveXmlMatches, false, snapshot.driveEvidenceAvailable, snapshot.driveEvidenceComplete),
    d7e4dProvenBoolean_(snapshot.drivePdfMatches, false, snapshot.driveEvidenceAvailable, snapshot.driveEvidenceComplete),
    d7e4dBoolean_(source.gmailSourceVerified, true),
    d7e4dBoolean_(source.candidateIdentityVerified, true),
    d7e4dBoolean_(source.recomputedCommitPlanMatches, true)
  ].map(function d7e4dEvidenceWithId_(result, index) {
    return d7e4dNamedResult_(D7_E4D_EVIDENCE_IDS_[index], result);
  });

  const capabilityResults = [
    d7e4dCapability_(capabilities.sameJobValidatedResumeSupported),
    d7e4dCapability_(capabilities.currentIdentityContractSupported),
    d7e4dCapability_(capabilities.hoaDonAdapterAvailable),
    d7e4dCapability_(capabilities.inventoryAdapterAvailable),
    d7e4dCapability_(capabilities.gmailProjectionAdapterAvailable),
    d7e4dCapability_(capabilities.exactWriteBudgetDesigned),
    d7e4dCapability_(capabilities.oneShotMarkerLifecycleDesigned)
  ].map(function d7e4dCapabilityWithId_(result, index) {
    return d7e4dNamedResult_(D7_E4D_CAPABILITY_IDS_[index], result);
  });

  const evidenceSummary = d7e4dSummary_(evidence);
  const capabilitySummary = d7e4dSummary_(capabilityResults);
  let classification = 'READY_FOR_LOCAL_RUNTIME_IMPLEMENTATION';
  if (evidenceSummary.FAIL > 0 || evidenceSummary.NOT_PROVEN > 0) classification = 'BLOCKED_RECOVERY_EVIDENCE';
  else if (capabilitySummary.FAIL > 0 || capabilitySummary.NOT_PROVEN > 0) classification = 'BLOCKED_RUNTIME_CAPABILITY_GAP';

  return Object.freeze({
    phase: 'D7_E4D_VALIDATED_JOB_RECOVERY_ELIGIBILITY',
    classification: classification,
    sameJobDisposition: 'PRESERVE_EXISTING_JOB_ID',
    evidenceSummary: Object.freeze(evidenceSummary),
    capabilitySummary: Object.freeze(capabilitySummary),
    evidence: Object.freeze(evidence),
    capabilities: Object.freeze(capabilityResults),
    requiredStatePath: D7_E4D_RECOVERY_STATE_PATH_,
    productionExecutionAuthorized: 'NO'
  });
}

function d7e4dObject_(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function d7e4dNamedResult_(id, result) {
  return Object.freeze({ id: id, status: result.status, reason: result.reason, evidenceClass: result.evidenceClass });
}

function d7e4dResult_(status, reason, evidenceClass) {
  return { status: status, reason: reason, evidenceClass: evidenceClass };
}

function d7e4dPass_() {
  return d7e4dResult_('PASS', 'EXACT_TRUE', D7_E4D_EVIDENCE_CLASSES_.EXACT);
}

function d7e4dFail_() {
  return d7e4dResult_('FAIL', 'CONTRADICTORY_EVIDENCE', D7_E4D_EVIDENCE_CLASSES_.CONTRADICTORY);
}

function d7e4dMissing_() {
  return d7e4dResult_('NOT_PROVEN', 'MISSING_EVIDENCE', D7_E4D_EVIDENCE_CLASSES_.MISSING);
}

function d7e4dMalformed_() {
  return d7e4dResult_('NOT_PROVEN', 'MALFORMED_EVIDENCE', D7_E4D_EVIDENCE_CLASSES_.MALFORMED);
}

function d7e4dBoolean_(value, expected) {
  if (value === undefined || value === null) return d7e4dMissing_();
  if (typeof value !== 'boolean') return d7e4dMalformed_();
  return value === expected ? d7e4dPass_() : d7e4dFail_();
}

function d7e4dString_(value, expected) {
  if (value === undefined || value === null || value === '' || !expected) return d7e4dMissing_();
  if (typeof value !== 'string') return d7e4dMalformed_();
  return value === expected ? d7e4dPass_() : d7e4dFail_();
}

function d7e4dNumber_(value, expected) {
  if (value === undefined || value === null) return d7e4dMissing_();
  if (typeof value !== 'number' || !Number.isFinite(value)) return d7e4dMalformed_();
  return value === expected ? d7e4dPass_() : d7e4dFail_();
}

function d7e4dPositiveInteger_(value) {
  if (value === undefined || value === null) return d7e4dMissing_();
  if (typeof value !== 'number' || !Number.isInteger(value)) return d7e4dMalformed_();
  return value > 0 ? d7e4dPass_() : d7e4dFail_();
}

function d7e4dComplete_(value) {
  if (value === undefined || value === null) return d7e4dMissing_();
  if (typeof value !== 'boolean') return d7e4dMalformed_();
  return value ? d7e4dPass_() : d7e4dResult_('NOT_PROVEN', 'INCOMPLETE_LISTING', D7_E4D_EVIDENCE_CLASSES_.INCOMPLETE);
}

function d7e4dCompleteArrayCount_(value, complete, expected) {
  const completeness = d7e4dComplete_(complete);
  if (completeness.status !== 'PASS') return completeness;
  if (!Array.isArray(value)) return value === undefined || value === null ? d7e4dMissing_() : d7e4dMalformed_();
  return value.length === expected ? d7e4dPass_() : d7e4dFail_();
}

function d7e4dLatestReport_(snapshot) {
  const complete = d7e4dComplete_(snapshot.reportsComplete);
  if (complete.status !== 'PASS') return complete;
  if (snapshot.latestReportEvidenceAvailable !== true) return d7e4dBoolean_(snapshot.latestReportEvidenceAvailable, true);
  return d7e4dBoolean_(snapshot.latestReportValid, true);
}

function d7e4dBothAbsent_(left, right) {
  const first = d7e4dBoolean_(left, false);
  if (first.status !== 'PASS') return first;
  return d7e4dBoolean_(right, false);
}

function d7e4dProvenBoolean_(value, expected, available, complete) {
  const availability = d7e4dBoolean_(available, true);
  if (availability.status !== 'PASS') return availability;
  const completeness = d7e4dComplete_(complete);
  if (completeness.status !== 'PASS') return completeness;
  return d7e4dBoolean_(value, expected);
}

function d7e4dReadOutcome_(snapshot) {
  if (snapshot.readOutcomeUndeliverable === true) {
    return d7e4dResult_('NOT_PROVEN', 'UPSTREAM_UNDELIVERABLE', D7_E4D_EVIDENCE_CLASSES_.UNKNOWN);
  }
  if (snapshot.readOutcomeUnknown === undefined || snapshot.readOutcomeUnknown === null) return d7e4dMissing_();
  if (typeof snapshot.readOutcomeUnknown !== 'boolean') return d7e4dMalformed_();
  return snapshot.readOutcomeUnknown ? d7e4dResult_('NOT_PROVEN', 'UNKNOWN_OUTCOME', D7_E4D_EVIDENCE_CLASSES_.UNKNOWN) : d7e4dPass_();
}

function d7e4dCapability_(value) {
  if (value === undefined || value === null) return d7e4dMissing_();
  if (typeof value !== 'boolean') return d7e4dMalformed_();
  return value ? d7e4dPass_() : d7e4dResult_('FAIL', 'CAPABILITY_NOT_IMPLEMENTED', D7_E4D_EVIDENCE_CLASSES_.CAPABILITY);
}

function d7e4dSummary_(results) {
  const summary = { PASS: 0, FAIL: 0, NOT_PROVEN: 0 };
  results.forEach(function d7e4dCount_(result) { summary[result.status] += 1; });
  return summary;
}
