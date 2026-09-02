const D7_E4C_PRECONDITION_IDS_ = Object.freeze([
  'P01', 'P02', 'P03', 'P04', 'P05', 'P06', 'P07', 'P08', 'P09', 'P10', 'P11', 'P12', 'P13', 'P14', 'P15', 'P16', 'P17',
  'P18', 'P19', 'P20', 'P21', 'P22', 'P23', 'P24', 'P25', 'P26', 'P27', 'P28', 'P29', 'P30', 'P31', 'P32', 'P33', 'P34'
]);

const D7_E4C_EVIDENCE_CLASSES_ = Object.freeze({
  EXACT: 'EXACT_EVIDENCE',
  CONTRADICTORY: 'CONTRADICTORY_EVIDENCE',
  MISSING: 'MISSING_EVIDENCE',
  UNKNOWN: 'UNKNOWN_EVIDENCE',
  INCOMPLETE: 'INCOMPLETE_EVIDENCE',
  MALFORMED: 'MALFORMED_EVIDENCE',
  UPSTREAM: 'UPSTREAM_UNDELIVERABLE'
});

function evaluateD7E4BInitialPreconditions_(authorization, snapshot, expected) {
  const a = authorization || {};
  const s = snapshot || {};
  const e = expected || {};
  const job = d7e4cObject_(s.job);
  const lease = d7e4cObject_(s.lease);
  const commitPlan = d7e4cObject_(job.commitPlan);
  const targets = d7e4cObject_(commitPlan.driveEvidenceTargets);
  const results = [
    d7e4cCount_(a.canonicalCount, 5),
    d7e4cBoolean_(a.identityAligned, true),
    d7e4cBoolean_(a.priorMarkerAbsent, true),
    d7e4cNumber_(s.exactJobCount, 1),
    d7e4cNumber_(s.nonExactCandidateCount, 0),
    d7e4cReadOutcome_(s),
    d7e4cString_(job.jobId, e.jobId),
    d7e4cString_(job.invoiceIdentityHash, e.invoiceIdentityHash),
    d7e4cPattern_(job.sourceThreadHash, /^[a-f0-9]{8}$/i),
    d7e4cString_(job.status, 'VALIDATED'),
    d7e4cNumber_(job.version, 4),
    d7e4cString_(job.reconciliationStatus, 'RECONCILIATION_REQUIRED'),
    d7e4cString_(commitPlan.jobId, e.jobId),
    d7e4cNumber_(commitPlan.expectedLineCount, 1),
    d7e4cString_(targets.xmlContentHash, e.xmlSha256),
    d7e4cString_(targets.pdfContentHash, e.pdfSha256),
    d7e4cString_(lease.status, 'RECONCILIATION_REQUIRED'),
    d7e4cString_(lease.jobId, e.jobId),
    d7e4cString_(lease.fencingToken, e.leaseFence),
    d7e4cInteger_(lease.leaseGeneration),
    d7e4cPositiveInteger_(lease.leaseGeneration),
    d7e4cComplete_(s.eventsComplete),
    d7e4cArray_(s.events),
    d7e4cArrayCount_(s.events, 2, s.eventsComplete),
    d7e4cComplete_(s.reportsComplete),
    d7e4cArray_(s.reports),
    d7e4cArrayCount_(s.reports, 1, s.reportsComplete),
    d7e4cLatestReport_(s),
    d7e4cBoolean_(s.xmlAttachmentPresent, false),
    d7e4cBoolean_(s.pdfAttachmentPresent, false),
    d7e4cProvenBoolean_(s.sheetExactRowPresent, true, s.sheetEvidenceAvailable, s.sheetEvidenceComplete),
    d7e4cProvenBoolean_(s.sheetContentMatches, true, s.sheetEvidenceAvailable, s.sheetEvidenceComplete),
    d7e4cProvenBoolean_(s.driveXmlMatches, true, s.driveEvidenceAvailable, s.driveEvidenceComplete),
    d7e4cProvenBoolean_(s.drivePdfMatches, true, s.driveEvidenceAvailable, s.driveEvidenceComplete)
  ].map(function d7e4cWithId_(result, index) {
    return Object.freeze({
      id: D7_E4C_PRECONDITION_IDS_[index],
      status: result.status,
      reason: result.reason,
      evidenceClass: result.evidenceClass
    });
  });
  const summary = { PASS: 0, FAIL: 0, NOT_PROVEN: 0 };
  results.forEach(function d7e4cCountStatus_(result) { summary[result.status] += 1; });
  const overallStatus = summary.FAIL > 0 ? 'FAIL' : summary.NOT_PROVEN > 0 ? 'NOT_PROVEN' : 'PASS';
  return Object.freeze({ overallStatus: overallStatus, summary: Object.freeze(summary), results: Object.freeze(results) });
}

function createD7E4CExactPreconditionDiagnosticRunner_(dependencies) {
  const d = dependencies || {};
  if (typeof d.capture !== 'function') throw new Error('D7_E4C_CAPTURE_ADAPTER_REQUIRED');
  return Object.freeze({
    run: async function runD7E4CExactPreconditionDiagnostic_() {
      const captured = await d.capture();
      const input = captured || {};
      return evaluateD7E4BInitialPreconditions_(input.authorization, input.snapshot, input.expected);
    }
  });
}

function d7e4cObject_(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function d7e4cResult_(status, reason, evidenceClass) {
  return { status: status, reason: reason, evidenceClass: evidenceClass };
}

function d7e4cPass_() { return d7e4cResult_('PASS', 'EXACT_TRUE', D7_E4C_EVIDENCE_CLASSES_.EXACT); }
function d7e4cFail_() { return d7e4cResult_('FAIL', 'CONTRADICTORY_EVIDENCE', D7_E4C_EVIDENCE_CLASSES_.CONTRADICTORY); }
function d7e4cNotProven_(reason, evidenceClass) { return d7e4cResult_('NOT_PROVEN', reason, evidenceClass); }
function d7e4cMissing_() { return d7e4cNotProven_('MISSING_EVIDENCE', D7_E4C_EVIDENCE_CLASSES_.MISSING); }
function d7e4cMalformed_() { return d7e4cNotProven_('MALFORMED_EVIDENCE', D7_E4C_EVIDENCE_CLASSES_.MALFORMED); }

function d7e4cBoolean_(value, expected) {
  if (value === undefined || value === null) return d7e4cMissing_();
  if (typeof value !== 'boolean') return d7e4cMalformed_();
  return value === expected ? d7e4cPass_() : d7e4cFail_();
}

function d7e4cString_(value, expected) {
  if (value === undefined || value === null || value === '') return d7e4cMissing_();
  if (typeof value !== 'string' || !expected) return !expected ? d7e4cMissing_() : d7e4cMalformed_();
  return value === expected ? d7e4cPass_() : d7e4cFail_();
}

function d7e4cNumber_(value, expected) {
  if (value === undefined) return d7e4cMissing_();
  if (typeof value !== 'number' || !Number.isFinite(value)) return d7e4cMalformed_();
  return value === expected ? d7e4cPass_() : d7e4cFail_();
}

function d7e4cCount_(value, expected) { return d7e4cNumber_(value, expected); }

function d7e4cPattern_(value, pattern) {
  if (value === undefined || value === null || value === '') return d7e4cMissing_();
  if (typeof value !== 'string') return d7e4cMalformed_();
  return pattern.test(value) ? d7e4cPass_() : d7e4cFail_();
}

function d7e4cInteger_(value) {
  if (value === undefined) return d7e4cMissing_();
  return typeof value === 'number' && Number.isInteger(value) ? d7e4cPass_() : d7e4cMalformed_();
}

function d7e4cPositiveInteger_(value) {
  const integer = d7e4cInteger_(value);
  if (integer.status !== 'PASS') return integer;
  return value > 0 ? d7e4cPass_() : d7e4cFail_();
}

function d7e4cComplete_(value) {
  if (value === undefined || value === null) return d7e4cMissing_();
  if (typeof value !== 'boolean') return d7e4cMalformed_();
  return value ? d7e4cPass_() : d7e4cNotProven_('INCOMPLETE_LISTING', D7_E4C_EVIDENCE_CLASSES_.INCOMPLETE);
}

function d7e4cArray_(value) {
  if (value === undefined || value === null) return d7e4cMissing_();
  return Array.isArray(value) ? d7e4cPass_() : d7e4cMalformed_();
}

function d7e4cArrayCount_(value, expected, complete) {
  const completeness = d7e4cComplete_(complete);
  if (completeness.status !== 'PASS') return completeness;
  const array = d7e4cArray_(value);
  if (array.status !== 'PASS') return array;
  return value.length === expected ? d7e4cPass_() : d7e4cFail_();
}

function d7e4cProvenBoolean_(value, expected, available, complete) {
  if (available === undefined || available === null) return d7e4cMissing_();
  if (typeof available !== 'boolean') return d7e4cMalformed_();
  if (!available) return d7e4cMissing_();
  const completeness = d7e4cComplete_(complete);
  if (completeness.status !== 'PASS') return completeness;
  return d7e4cBoolean_(value, expected);
}

function d7e4cLatestReport_(snapshot) {
  const completeness = d7e4cComplete_(snapshot.reportsComplete);
  if (completeness.status !== 'PASS') return completeness;
  const reports = d7e4cArray_(snapshot.reports);
  if (reports.status !== 'PASS') return reports;
  if (snapshot.latestReportEvidenceAvailable === undefined || snapshot.latestReportEvidenceAvailable === null) return d7e4cMissing_();
  if (typeof snapshot.latestReportEvidenceAvailable !== 'boolean') return d7e4cMalformed_();
  if (!snapshot.latestReportEvidenceAvailable) return d7e4cMissing_();
  return d7e4cBoolean_(snapshot.latestReportValid, true);
}

function d7e4cReadOutcome_(snapshot) {
  if (snapshot.readOutcomeUndeliverable === true) return d7e4cNotProven_('UPSTREAM_UNDELIVERABLE', D7_E4C_EVIDENCE_CLASSES_.UPSTREAM);
  if (snapshot.readOutcomeUnknown === undefined || snapshot.readOutcomeUnknown === null) return d7e4cMissing_();
  if (typeof snapshot.readOutcomeUnknown !== 'boolean') return d7e4cMalformed_();
  return snapshot.readOutcomeUnknown === false ? d7e4cPass_() : d7e4cNotProven_('UNKNOWN_OUTCOME', D7_E4C_EVIDENCE_CLASSES_.UNKNOWN);
}
