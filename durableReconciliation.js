const DURABLE_RECONCILIATION_FINDING_CODES_ = Object.freeze([
  'JOB_MISSING',
  'COMMIT_PLAN_MISSING',
  'COMMIT_PLAN_HASH_MISMATCH',
  'COMMIT_PLAN_VERSION_MISMATCH',
  'STATE_AHEAD_OF_EVIDENCE',
  'STATE_BEHIND_EVIDENCE',
  'TERMINAL_STATE_CONFLICT',
  'DRIVE_XML_MISSING',
  'DRIVE_PDF_MISSING',
  'DRIVE_ARTIFACT_DUPLICATE',
  'DRIVE_CONTENT_HASH_MISMATCH',
  'HOA_DON_ROW_MISSING',
  'HOA_DON_ROW_DUPLICATE',
  'HOA_DON_FILE_REFERENCE_MISMATCH',
  'LEDGER_ROWS_MISSING',
  'LEDGER_ROWS_EXTRA',
  'LEDGER_LINE_HASH_MISMATCH',
  'LEDGER_INVOICE_KEY_MISMATCH',
  'LEDGER_DUPLICATE_LINE_IDENTITY',
  'GMAIL_FALSE_SAVED_LABEL',
  'GMAIL_SAVED_LABEL_MISSING',
  'GMAIL_PENDING_LABEL_CONFLICT'
]);

const DURABLE_RECONCILIATION_CODE_ORDER_ = Object.freeze(
  DURABLE_RECONCILIATION_FINDING_CODES_.reduce((out, code, index) => {
    out[code] = index;
    return out;
  }, {})
);

const DURABLE_RECONCILIATION_STATE_ORDER_ = Object.freeze({
  DETECTED: 1,
  COLLECTED: 2,
  PARSED: 3,
  VALIDATED: 4,
  FILES_SAVED: 5,
  COMMITTING: 6,
  ROWS_COMMITTED: 7,
  PROJECTIONS_COMMITTED: 8,
  COMPLETED: 9,
  FAILED_RETRYABLE: 3,
  FAILED_REVIEW_REQUIRED: 3,
  RECONCILIATION_REQUIRED: 9,
  IGNORED_NOT_INVOICE: 9
});

const DURABLE_RECONCILIATION_CONFLICT_CODES_ = Object.freeze([
  'JOB_MISSING',
  'COMMIT_PLAN_MISSING',
  'COMMIT_PLAN_HASH_MISMATCH',
  'COMMIT_PLAN_VERSION_MISMATCH',
  'TERMINAL_STATE_CONFLICT',
  'DRIVE_CONTENT_HASH_MISMATCH',
  'HOA_DON_FILE_REFERENCE_MISMATCH',
  'LEDGER_LINE_HASH_MISMATCH',
  'LEDGER_INVOICE_KEY_MISMATCH',
  'LEDGER_DUPLICATE_LINE_IDENTITY',
  'GMAIL_FALSE_SAVED_LABEL',
  'GMAIL_PENDING_LABEL_CONFLICT'
]);

function reconcileDurableInvoiceJobReportOnly(input) {
  const snapshot = cloneDurableReconciliationJson_(input || {});
  const job = snapshot.job || null;
  const plan = snapshot.commitPlan || (job && job.commitPlan) || null;
  const observed = snapshot.observed || {};
  const driveEvidence = Array.isArray(observed.driveEvidence) ? observed.driveEvidence : [];
  const hoaDonRows = Array.isArray(observed.hoaDonRows) ? observed.hoaDonRows : [];
  const ledgerRows = Array.isArray(observed.ledgerRows) ? observed.ledgerRows : [];
  const gmailLabels = Array.isArray(observed.gmailLabels) ? observed.gmailLabels : [];
  const findings = [];

  if (!job) {
    addDurableReconciliationFinding_(findings, 'JOB_MISSING', 'CRITICAL', 'JOB', {}, { present: false }, 'OWNER_REVIEW_REQUIRED');
  }
  if (!plan) {
    addDurableReconciliationFinding_(findings, 'COMMIT_PLAN_MISSING', 'CRITICAL', 'PLAN', {}, { present: false }, 'OWNER_REVIEW_REQUIRED');
  }

  if (job && job.commitPlan && snapshot.commitPlan && stableDurableReconciliationJson_(job.commitPlan) !== stableDurableReconciliationJson_(snapshot.commitPlan)) {
    addDurableReconciliationFinding_(findings, 'COMMIT_PLAN_HASH_MISMATCH', 'CRITICAL', 'PLAN', { immutable: true }, { changed: true }, 'OWNER_REVIEW_REQUIRED');
  }

  if (plan && plan.version !== 'DURABLE_COMMIT_PLAN_V1') {
    addDurableReconciliationFinding_(findings, 'COMMIT_PLAN_VERSION_MISMATCH', 'CRITICAL', 'PLAN', { version: 'DURABLE_COMMIT_PLAN_V1' }, { version: safeDurableReconciliationString_(plan.version) }, 'OWNER_REVIEW_REQUIRED');
  }

  const evidenceState = plan
    ? evaluateDurableReconciliationEvidence_(plan, driveEvidence, hoaDonRows, ledgerRows, gmailLabels, findings)
    : { driveVerified: false, registryVerified: false, ledgerVerified: false, projectionVerified: false };

  if (job && plan) {
    evaluateDurableReconciliationState_(job, evidenceState, findings);
  }

  const orderedFindings = findings.slice().sort(compareDurableReconciliationFindings_);
  const status = resolveDurableReconciliationStatus_(orderedFindings);
  const blockerCount = orderedFindings.filter(finding => finding.severity === 'ERROR' || finding.severity === 'CRITICAL' || finding.repairPolicy === 'OWNER_REVIEW_REQUIRED').length;

  return {
    jobId: safeDurableReconciliationIdentifier_(job && job.jobId),
    invoiceKeyHashPrefix: buildDurableReconciliationHashPrefix_(plan && plan.invoiceKeyV2),
    status,
    findingCount: orderedFindings.length,
    blockerCount,
    findings: orderedFindings,
    generatedAt: safeDurableReconciliationString_(snapshot.generatedAt || 'REPORT_ONLY_LOCAL')
  };
}

function evaluateDurableReconciliationEvidence_(plan, driveEvidence, hoaDonRows, ledgerRows, gmailLabels, findings) {
  const driveVerified = evaluateDurableReconciliationDrive_(plan, driveEvidence, findings);
  const registryVerified = evaluateDurableReconciliationHoaDon_(plan, hoaDonRows, findings);
  const ledgerVerified = evaluateDurableReconciliationLedger_(plan, ledgerRows, findings);
  const projectionVerified = evaluateDurableReconciliationGmail_(plan, gmailLabels, ledgerVerified, findings);
  return { driveVerified, registryVerified, ledgerVerified, projectionVerified };
}

function evaluateDurableReconciliationDrive_(plan, driveEvidence, findings) {
  const targets = plan.driveEvidenceTargets || {};
  const xmlHash = safeDurableReconciliationString_(targets.xmlContentHash);
  const pdfHash = safeDurableReconciliationString_(targets.pdfContentHash);
  const xmlEntries = driveEvidence.filter(entry => safeDurableReconciliationKind_(entry && entry.kind) === 'XML');
  const pdfEntries = driveEvidence.filter(entry => safeDurableReconciliationKind_(entry && entry.kind) === 'PDF');
  let xmlVerified = !xmlHash;
  let pdfVerified = !pdfHash;

  if (xmlHash) {
    const matches = xmlEntries.filter(entry => safeDurableReconciliationString_(entry.contentHash) === xmlHash);
    xmlVerified = matches.length === 1;
    if (matches.length === 0) {
      addDurableReconciliationFinding_(findings, 'DRIVE_XML_MISSING', 'ERROR', 'DRIVE', { xmlContentHashPrefix: prefixDurableReconciliationValue_(xmlHash) }, { xmlCount: xmlEntries.length }, 'REPORT_ONLY');
      if (xmlEntries.length > 0) {
        addDurableReconciliationFinding_(findings, 'DRIVE_CONTENT_HASH_MISMATCH', 'CRITICAL', 'DRIVE', { kind: 'XML' }, { matchingHash: false }, 'OWNER_REVIEW_REQUIRED');
      }
    }
    if (matches.length > 1) {
      addDurableReconciliationFinding_(findings, 'DRIVE_ARTIFACT_DUPLICATE', 'ERROR', 'DRIVE', { kind: 'XML' }, { duplicateCount: matches.length }, 'OWNER_REVIEW_REQUIRED');
    }
  }

  if (pdfHash) {
    const matches = pdfEntries.filter(entry => safeDurableReconciliationString_(entry.contentHash) === pdfHash);
    pdfVerified = matches.length === 1;
    if (matches.length === 0) {
      addDurableReconciliationFinding_(findings, 'DRIVE_PDF_MISSING', 'ERROR', 'DRIVE', { pdfContentHashPrefix: prefixDurableReconciliationValue_(pdfHash) }, { pdfCount: pdfEntries.length }, 'REPORT_ONLY');
      if (pdfEntries.length > 0) {
        addDurableReconciliationFinding_(findings, 'DRIVE_CONTENT_HASH_MISMATCH', 'CRITICAL', 'DRIVE', { kind: 'PDF' }, { matchingHash: false }, 'OWNER_REVIEW_REQUIRED');
      }
    }
    if (matches.length > 1) {
      addDurableReconciliationFinding_(findings, 'DRIVE_ARTIFACT_DUPLICATE', 'ERROR', 'DRIVE', { kind: 'PDF' }, { duplicateCount: matches.length }, 'OWNER_REVIEW_REQUIRED');
    }
  }

  return xmlVerified && pdfVerified;
}

function evaluateDurableReconciliationHoaDon_(plan, hoaDonRows, findings) {
  const target = plan.hoaDonRegistryTarget || {};
  const legacyInvoiceKey = safeDurableReconciliationString_(target.legacyInvoiceKey || plan.legacyInvoiceKey);
  const invoiceKeyV2 = safeDurableReconciliationString_(plan.invoiceKeyV2);
  const matchingRows = hoaDonRows.filter(row => {
    return safeDurableReconciliationString_(row && row.legacyInvoiceKey) === legacyInvoiceKey ||
      safeDurableReconciliationString_(row && row.invoiceKeyV2) === invoiceKeyV2;
  });

  if (matchingRows.length === 0) {
    addDurableReconciliationFinding_(findings, 'HOA_DON_ROW_MISSING', 'ERROR', 'HOA_DON', { row: 'required' }, { rowCount: 0 }, 'REPORT_ONLY');
    return false;
  }
  if (matchingRows.length > 1) {
    addDurableReconciliationFinding_(findings, 'HOA_DON_ROW_DUPLICATE', 'ERROR', 'HOA_DON', { row: 'single' }, { duplicateCount: matchingRows.length }, 'OWNER_REVIEW_REQUIRED');
  }

  const row = matchingRows[0];
  const fields = ['xmlContentHash', 'pdfContentHash', 'xmlFileId', 'pdfFileId'];
  const mismatched = fields.filter(field => target[field] && safeDurableReconciliationString_(row[field]) !== safeDurableReconciliationString_(target[field]));
  if (mismatched.length > 0) {
    addDurableReconciliationFinding_(findings, 'HOA_DON_FILE_REFERENCE_MISMATCH', 'CRITICAL', 'HOA_DON', { fields: mismatched.slice().sort() }, { matched: false }, 'OWNER_REVIEW_REQUIRED');
    return false;
  }

  return matchingRows.length === 1;
}

function evaluateDurableReconciliationLedger_(plan, ledgerRows, findings) {
  const legacyInvoiceKey = safeDurableReconciliationString_(plan.legacyInvoiceKey);
  const invoiceKeyV2 = safeDurableReconciliationString_(plan.invoiceKeyV2);
  const lines = Array.isArray(plan.lines) ? plan.lines : [];
  let allLinesVerified = lines.length > 0;
  let missingCount = 0;

  const expectedIdentitySet = {};
  const expectedHashSet = {};
  lines.forEach(line => {
    expectedIdentitySet[safeDurableReconciliationString_(line.lineIdentityV2)] = true;
    expectedHashSet[safeDurableReconciliationString_(line.legacyHashIndex)] = true;
  });

  const lineIdentityCounts = {};
  ledgerRows.forEach(row => {
    const identity = safeDurableReconciliationString_(row && row.lineIdentityV2);
    if (expectedIdentitySet[identity]) lineIdentityCounts[identity] = (lineIdentityCounts[identity] || 0) + 1;
  });
  Object.keys(lineIdentityCounts).sort().forEach(identity => {
    if (lineIdentityCounts[identity] > 1) {
      addDurableReconciliationFinding_(findings, 'LEDGER_DUPLICATE_LINE_IDENTITY', 'CRITICAL', 'LEDGER', { lineIdentityHashPrefix: prefixDurableReconciliationValue_(identity) }, { duplicateCount: lineIdentityCounts[identity] }, 'OWNER_REVIEW_REQUIRED');
      allLinesVerified = false;
    }
  });

  lines.forEach(line => {
    const expectedIdentity = safeDurableReconciliationString_(line.lineIdentityV2);
    const expectedHash = safeDurableReconciliationString_(line.legacyHashIndex);
    const identityRows = ledgerRows.filter(row => safeDurableReconciliationString_(row && row.lineIdentityV2) === expectedIdentity);
    const exactRows = identityRows.filter(row => safeDurableReconciliationString_(row.legacyHashIndex) === expectedHash && rowMatchesDurableReconciliationInvoice_(row, legacyInvoiceKey, invoiceKeyV2));

    if (exactRows.length === 0) {
      allLinesVerified = false;
      missingCount += 1;
      const wrongHashRows = identityRows.filter(row => safeDurableReconciliationString_(row.legacyHashIndex) !== expectedHash);
      const wrongKeyRows = identityRows.filter(row => safeDurableReconciliationString_(row.legacyHashIndex) === expectedHash && !rowMatchesDurableReconciliationInvoice_(row, legacyInvoiceKey, invoiceKeyV2));
      if (wrongHashRows.length > 0) {
        addDurableReconciliationFinding_(findings, 'LEDGER_LINE_HASH_MISMATCH', 'CRITICAL', 'LEDGER', { lineIdentityHashPrefix: prefixDurableReconciliationValue_(expectedIdentity) }, { matchingHash: false }, 'OWNER_REVIEW_REQUIRED');
      }
      if (wrongKeyRows.length > 0) {
        addDurableReconciliationFinding_(findings, 'LEDGER_INVOICE_KEY_MISMATCH', 'CRITICAL', 'LEDGER', { lineIdentityHashPrefix: prefixDurableReconciliationValue_(expectedIdentity) }, { matchingInvoiceKey: false }, 'OWNER_REVIEW_REQUIRED');
      }
    }
  });

  if (missingCount > 0) {
    addDurableReconciliationFinding_(findings, 'LEDGER_ROWS_MISSING', 'ERROR', 'LEDGER', { expectedLineCount: lines.length }, { missingLineCount: missingCount }, 'REPORT_ONLY');
  }

  const extraRows = ledgerRows.filter(row => {
    const identity = safeDurableReconciliationString_(row && row.lineIdentityV2);
    const hash = safeDurableReconciliationString_(row && row.legacyHashIndex);
    const belongsToInvoice = rowMatchesDurableReconciliationInvoice_(row, legacyInvoiceKey, invoiceKeyV2) || expectedIdentitySet[identity] || expectedHashSet[hash];
    const expectedPair = expectedIdentitySet[identity] && expectedHashSet[hash] && rowMatchesDurableReconciliationInvoice_(row, legacyInvoiceKey, invoiceKeyV2);
    return belongsToInvoice && !expectedPair;
  });
  if (extraRows.length > 0) {
    addDurableReconciliationFinding_(findings, 'LEDGER_ROWS_EXTRA', 'WARNING', 'LEDGER', { expectedLineCount: lines.length }, { extraLineCount: extraRows.length }, 'OWNER_REVIEW_REQUIRED');
  }

  return allLinesVerified;
}

function evaluateDurableReconciliationGmail_(plan, gmailLabels, ledgerVerified, findings) {
  const labels = gmailLabels.map(label => safeDurableReconciliationString_(label).toUpperCase());
  const saved = labels.some(label => label.indexOf('SAVED') >= 0 || label.indexOf('DA_LUU') >= 0);
  const pending = labels.some(label => label.indexOf('PENDING') >= 0 || label.indexOf('CHO_XU_LY') >= 0);
  const state = safeDurableReconciliationString_(plan && plan.projectionState);

  if (saved && !ledgerVerified) {
    addDurableReconciliationFinding_(findings, 'GMAIL_FALSE_SAVED_LABEL', 'CRITICAL', 'GMAIL', { ledgerVerified: true }, { savedLabelPresent: true, ledgerVerified: false }, 'OWNER_REVIEW_REQUIRED');
  }
  if (!saved && ledgerVerified && state !== 'SKIP_SAVED_LABEL_CHECK') {
    addDurableReconciliationFinding_(findings, 'GMAIL_SAVED_LABEL_MISSING', 'WARNING', 'GMAIL', { savedLabelPresent: true }, { savedLabelPresent: false }, 'REPORT_ONLY');
  }
  if (saved && pending) {
    addDurableReconciliationFinding_(findings, 'GMAIL_PENDING_LABEL_CONFLICT', 'CRITICAL', 'GMAIL', { onlyOneTerminalProjection: true }, { savedLabelPresent: true, pendingLabelPresent: true }, 'OWNER_REVIEW_REQUIRED');
  }

  return ledgerVerified && saved && !pending;
}

function evaluateDurableReconciliationState_(job, evidenceState, findings) {
  const state = safeDurableReconciliationString_(job.state);
  const rank = DURABLE_RECONCILIATION_STATE_ORDER_[state] || 0;
  const evidenceComplete = evidenceState.driveVerified && evidenceState.registryVerified && evidenceState.ledgerVerified && evidenceState.projectionVerified;

  if ((state === 'COMPLETED' || state === 'RECONCILIATION_REQUIRED') && !evidenceComplete) {
    addDurableReconciliationFinding_(findings, 'TERMINAL_STATE_CONFLICT', 'CRITICAL', 'JOB', { terminalEvidenceComplete: true }, { terminalEvidenceComplete: false }, 'OWNER_REVIEW_REQUIRED');
  }
  if ((rank >= DURABLE_RECONCILIATION_STATE_ORDER_.FILES_SAVED && !evidenceState.driveVerified) ||
      (rank >= DURABLE_RECONCILIATION_STATE_ORDER_.ROWS_COMMITTED && !evidenceState.ledgerVerified) ||
      (rank >= DURABLE_RECONCILIATION_STATE_ORDER_.PROJECTIONS_COMMITTED && !evidenceState.registryVerified) ||
      (rank >= DURABLE_RECONCILIATION_STATE_ORDER_.PROJECTIONS_COMMITTED && !evidenceState.projectionVerified)) {
    addDurableReconciliationFinding_(findings, 'STATE_AHEAD_OF_EVIDENCE', 'ERROR', 'JOB', { state }, { evidenceComplete: false }, 'OWNER_REVIEW_REQUIRED');
  }
  if ((rank > 0 && rank < DURABLE_RECONCILIATION_STATE_ORDER_.FILES_SAVED && evidenceState.driveVerified) ||
      (rank > 0 && rank < DURABLE_RECONCILIATION_STATE_ORDER_.ROWS_COMMITTED && evidenceState.ledgerVerified) ||
      (rank > 0 && rank < DURABLE_RECONCILIATION_STATE_ORDER_.PROJECTIONS_COMMITTED && evidenceState.projectionVerified)) {
    addDurableReconciliationFinding_(findings, 'STATE_BEHIND_EVIDENCE', 'WARNING', 'JOB', { state }, { evidenceAhead: true }, 'OWNER_REVIEW_REQUIRED');
  }
}

function addDurableReconciliationFinding_(findings, code, severity, scope, expected, observed, repairPolicy) {
  findings.push({
    code,
    severity,
    scope,
    expected: cloneDurableReconciliationJson_(expected || {}),
    observed: cloneDurableReconciliationJson_(observed || {}),
    repairPolicy,
    safeMessage: buildDurableReconciliationSafeMessage_(code, scope)
  });
}

function buildDurableReconciliationSafeMessage_(code, scope) {
  return 'REPORT_ONLY_' + safeDurableReconciliationString_(scope) + '_' + safeDurableReconciliationString_(code);
}

function resolveDurableReconciliationStatus_(findings) {
  if (findings.length === 0) return 'CONSISTENT';
  if (findings.some(finding => DURABLE_RECONCILIATION_CONFLICT_CODES_.includes(finding.code))) return 'CONFLICTED';
  if (findings.some(finding => finding.repairPolicy === 'OWNER_REVIEW_REQUIRED')) return 'REVIEW_REQUIRED';
  return 'INCOMPLETE';
}

function compareDurableReconciliationFindings_(a, b) {
  const aCodeRank = Object.prototype.hasOwnProperty.call(DURABLE_RECONCILIATION_CODE_ORDER_, a.code) ? DURABLE_RECONCILIATION_CODE_ORDER_[a.code] : 999;
  const bCodeRank = Object.prototype.hasOwnProperty.call(DURABLE_RECONCILIATION_CODE_ORDER_, b.code) ? DURABLE_RECONCILIATION_CODE_ORDER_[b.code] : 999;
  const codeDelta = aCodeRank - bCodeRank;
  if (codeDelta !== 0) return codeDelta;
  const scopeDelta = safeDurableReconciliationString_(a.scope).localeCompare(safeDurableReconciliationString_(b.scope));
  if (scopeDelta !== 0) return scopeDelta;
  return stableDurableReconciliationJson_(a.observed).localeCompare(stableDurableReconciliationJson_(b.observed));
}

function rowMatchesDurableReconciliationInvoice_(row, legacyInvoiceKey, invoiceKeyV2) {
  return safeDurableReconciliationString_(row && row.legacyInvoiceKey) === legacyInvoiceKey ||
    safeDurableReconciliationString_(row && row.invoiceKeyV2) === invoiceKeyV2;
}

function safeDurableReconciliationKind_(value) {
  const kind = safeDurableReconciliationString_(value).toUpperCase();
  if (kind === 'XML' || kind === 'PDF') return kind;
  return kind.indexOf('XML') >= 0 ? 'XML' : (kind.indexOf('PDF') >= 0 ? 'PDF' : kind);
}

function safeDurableReconciliationIdentifier_(value) {
  const text = safeDurableReconciliationString_(value);
  if (!text) return '';
  return 'job_' + buildDurableReconciliationHashPrefix_(text);
}

function safeDurableReconciliationString_(value) {
  return value == null ? '' : String(value);
}

function prefixDurableReconciliationValue_(value) {
  return buildDurableReconciliationHashPrefix_(value);
}

function buildDurableReconciliationHashPrefix_(value) {
  const text = safeDurableReconciliationString_(value);
  if (!text) return '';
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return ('00000000' + (hash >>> 0).toString(16)).slice(-8);
}

function cloneDurableReconciliationJson_(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function stableDurableReconciliationJson_(value) {
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