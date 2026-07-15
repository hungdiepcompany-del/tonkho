export const D5A_TEST_SCENARIOS = Object.freeze([
  'happy path one-line invoice',
  'happy path multi-line invoice',
  'completed job resume no-op',
  'same source submitted twice',
  'Gmail and Drive source converge to same job',
  'Drive XML already present matching',
  'Drive XML existing conflict',
  'Drive XML write response lost',
  'Drive PDF write failure',
  'Hoa-Don already present matching',
  'Hoa-Don duplicate conflict',
  'Hoa-Don write response lost',
  'ledger already committed matching',
  'partial ledger commit',
  'ledger write response lost',
  'ledger verification mismatch',
  'Gmail saved label already correctly present',
  'Gmail saved label falsely present before ledger',
  'Gmail label write failure after committed ledger',
  'Gmail label response lost',
  'durable version conflict before mutation',
  'durable version conflict after external mutation',
  'reconciliation-required job cannot auto-resume',
  'completed job cannot transition backward',
  'two concurrent orchestration attempts',
  'same tests run twice deterministically'
]);

export const D5A_FAULT_INJECTION_CASES = Object.freeze([
  'fail before write',
  'fail after write response lost',
  'outcome unknown',
  'existing duplicate',
  'existing conflict',
  'stale read',
  'partial ledger commit',
  'verification mismatch',
  'version conflict before mutation',
  'version conflict after external mutation'
]);

export function createD5AClock() {
  let index = 0;
  return {
    now() {
      const value = `2026-07-15T01:00:${String(index).padStart(2, '0')}.000Z`;
      index += 1;
      return value;
    }
  };
}

export function createD5AInvoice(options = {}) {
  const lineCount = Number(options.lineCount || 1);
  const invoiceIdentity = options.invoiceIdentity || 'synthetic-seller-tax:C26THD8:8:2026-02-01';
  const legacyInvoiceKey = options.legacyInvoiceKey || '20260201_0100000001_C26THD8';
  const invoiceKeyV2 = options.invoiceKeyV2 || '0100000001_C26THD8_8_20260201';
  const lines = Array.from({ length: lineCount }, (_, index) => ({
    sourceLineNo: index + 1,
    legacyHashIndex: `synthetic-line-hash-${index + 1}`,
    lineIdentityV2: `synthetic-line-id-${index + 1}`,
    immutableFields: { item: `ITEM-${index + 1}`, quantity: index + 1, unitPrice: 100 + index }
  }));
  return {
    sourceType: options.sourceType || 'GMAIL',
    sourceLocatorHash: options.sourceLocatorHash || `source-${options.sourceType || 'gmail'}-hash`,
    invoice: {
      invoiceIdentity,
      legacyInvoiceKey,
      invoiceKeyV2,
      lines,
      driveEvidenceTargets: {
        xmlContentHash: options.xmlContentHash || 'synthetic-xml-hash',
        pdfContentHash: options.pdfContentHash || 'synthetic-pdf-hash',
        xmlFileId: 'synthetic-xml-file',
        pdfFileId: 'synthetic-pdf-file'
      },
      hoaDonRegistryTarget: {
        legacyInvoiceKey,
        invoiceKeyV2,
        xmlContentHash: options.xmlContentHash || 'synthetic-xml-hash',
        pdfContentHash: options.pdfContentHash || 'synthetic-pdf-hash',
        xmlFileId: 'synthetic-xml-file',
        pdfFileId: 'synthetic-pdf-file'
      },
      preCommitLedgerProbe: { status: 'NO_ROWS_PRESENT' }
    }
  };
}

// D5A fake environment can record calls, mutationLog, and deterministic local state only.
export function createD5AFakeAdapters(options = {}) {
  const calls = [];
  const mutationLog = [];
  const sourceInput = createD5AInvoice(options.invoice || {});
  const state = {
    driveEvidence: [],
    hoaDonRows: [],
    ledgerRows: [],
    labels: [...(options.initialLabels || [])]
  };

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function record(method, extra = {}) {
    calls.push({ method, ...clone(extra) });
  }

  function mutation(method) {
    mutationLog.push(method);
  }

  function targetHash(plan, kind) {
    return kind === 'XML' ? plan.driveEvidenceTargets.xmlContentHash : plan.driveEvidenceTargets.pdfContentHash;
  }

  function targetFileId(plan, kind) {
    return kind === 'XML' ? plan.driveEvidenceTargets.xmlFileId : plan.driveEvidenceTargets.pdfFileId;
  }

  function preload(plan) {
    if (options.driveXmlExisting === 'matching') state.driveEvidence.push({ kind: 'XML', contentHash: plan.driveEvidenceTargets.xmlContentHash, fileId: plan.driveEvidenceTargets.xmlFileId });
    if (options.driveXmlExisting === 'conflict') state.driveEvidence.push({ kind: 'XML', contentHash: 'conflicting-xml-hash', fileId: 'conflicting-xml-file' });
    if (options.drivePdfExisting === 'matching') state.driveEvidence.push({ kind: 'PDF', contentHash: plan.driveEvidenceTargets.pdfContentHash, fileId: plan.driveEvidenceTargets.pdfFileId });
    if (options.drivePdfExisting === 'conflict') state.driveEvidence.push({ kind: 'PDF', contentHash: 'conflicting-pdf-hash', fileId: 'conflicting-pdf-file' });
    if (options.hoaDonExisting === 'matching') state.hoaDonRows.push(clone(plan.hoaDonRegistryTarget));
    if (options.hoaDonExisting === 'conflict') state.hoaDonRows.push({ ...clone(plan.hoaDonRegistryTarget), xmlFileId: 'conflicting-xml-file' });
    if (options.ledgerExisting === 'matching') state.ledgerRows.push(...ledgerRowsFromPlan(plan));
    if (options.ledgerExisting === 'partial') state.ledgerRows.push(...ledgerRowsFromPlan(plan).slice(0, 1));
  }

  function maybeFault(key, afterWrite) {
    const fault = options.failures && options.failures[key];
    if (!fault) return null;
    if (fault === 'FAILED_BEFORE_WRITE' && !afterWrite) return { status: 'FAILED', errorCode: `${key}_FAILED_BEFORE_WRITE`, evidence: {} };
    if (fault === 'OUTCOME_UNKNOWN_AFTER_WRITE' && afterWrite) return { status: 'OUTCOME_UNKNOWN', errorCode: `${key}_RESPONSE_LOST`, evidence: {} };
    if (fault === 'CONFLICT') return { status: 'CONFLICT', errorCode: `${key}_CONFLICT`, evidence: {} };
    return null;
  }

  function findEvidence(kind, plan) {
    const entries = state.driveEvidence.filter(entry => entry.kind === kind);
    const matches = entries.filter(entry => entry.contentHash === targetHash(plan, kind));
    if (matches.length === 1) return { status: 'ALREADY_PRESENT', evidence: matches[0] };
    if (entries.length > 0 || matches.length > 1) return { status: 'CONFLICT', errorCode: `DRIVE_${kind}_CONFLICT`, evidence: { count: entries.length } };
    return { status: 'CONFIRMED_NOT_WRITTEN', evidence: {} };
  }

  function writeEvidence(kind, plan) {
    const before = maybeFault(`DRIVE_${kind}_WRITE`, false);
    if (before) return before;
    const existing = findEvidence(kind, plan);
    if (existing.status === 'ALREADY_PRESENT') return existing;
    if (existing.status === 'CONFLICT') return existing;
    mutation(`writeDrive${kind}`);
    state.driveEvidence.push({ kind, contentHash: targetHash(plan, kind), fileId: targetFileId(plan, kind) });
    const after = maybeFault(`DRIVE_${kind}_WRITE`, true);
    if (after) return after;
    return { status: 'CONFIRMED_WRITTEN', evidence: { kind } };
  }

  function ledgerRowsFromPlan(plan) {
    return plan.lines.map(line => ({
      legacyInvoiceKey: plan.legacyInvoiceKey,
      invoiceKeyV2: plan.invoiceKeyV2,
      legacyHashIndex: line.legacyHashIndex,
      lineIdentityV2: line.lineIdentityV2
    }));
  }

  const sourceAdapter = {
    async buildSourceSnapshot(input) {
      record('source.buildSourceSnapshot');
      const src = input && input.invoice ? input : sourceInput;
      const invoice = src.invoice;
      return {
        jobId: `job_${hashFixture(invoice.invoiceIdentity)}`,
        invoiceIdentityHash: invoice.invoiceIdentity,
        sourceFingerprint: src.sourceLocatorHash,
        legacyInvoiceKey: invoice.legacyInvoiceKey,
        invoiceKeyV2: invoice.invoiceKeyV2
      };
    },
    async loadSource(input) {
      record('source.loadSource');
      return clone(input && input.invoice ? input : sourceInput);
    },
    async parseInvoice(loaded) {
      record('source.parseInvoice');
      return clone(loaded.invoice);
    },
    async validateInvoice(parsed) {
      record('source.validateInvoice');
      return {
        commitPlanInput: {
          jobId: 'filled-by-orchestrator',
          legacyInvoiceKey: parsed.legacyInvoiceKey,
          invoiceKeyV2: parsed.invoiceKeyV2,
          lines: clone(parsed.lines),
          driveEvidenceTargets: clone(parsed.driveEvidenceTargets),
          hoaDonRegistryTarget: clone(parsed.hoaDonRegistryTarget),
          preCommitLedgerProbe: clone(parsed.preCommitLedgerProbe)
        }
      };
    }
  };

  const driveEvidenceAdapter = {
    async findEvidence({ kind, commitPlan }) {
      record('drive.findEvidence', { kind });
      preloadOnce(commitPlan);
      return findEvidence(kind, commitPlan);
    },
    async writeXmlIfAbsent({ commitPlan }) {
      record('drive.writeXmlIfAbsent');
      return writeEvidence('XML', commitPlan);
    },
    async writePdfIfAbsent({ commitPlan }) {
      record('drive.writePdfIfAbsent');
      return writeEvidence('PDF', commitPlan);
    },
    async verifyEvidence({ kind, commitPlan }) {
      record('drive.verifyEvidence', { kind });
      return findEvidence(kind, commitPlan).status === 'ALREADY_PRESENT'
        ? { status: 'CONFIRMED_WRITTEN', evidence: { kind } }
        : { status: 'CONFLICT', errorCode: `DRIVE_${kind}_VERIFY_FAILED`, evidence: {} };
    },
    async buildSnapshot() {
      return clone(state.driveEvidence);
    },
    mutationCount() {
      return mutationLog.filter(item => item.startsWith('writeDrive')).length;
    }
  };

  const hoaDonAdapter = {
    async findInvoiceRow({ commitPlan }) {
      record('hoaDon.findInvoiceRow');
      preloadOnce(commitPlan);
      return findHoaDon(commitPlan);
    },
    async writeInvoiceRowIfAbsent({ commitPlan }) {
      record('hoaDon.writeInvoiceRowIfAbsent');
      const before = maybeFault('HOA_DON_WRITE', false);
      if (before) return before;
      const existing = findHoaDon(commitPlan);
      if (existing.status !== 'CONFIRMED_NOT_WRITTEN') return existing;
      mutation('writeHoaDon');
      state.hoaDonRows.push(clone(commitPlan.hoaDonRegistryTarget));
      const after = maybeFault('HOA_DON_WRITE', true);
      if (after) return after;
      return { status: 'CONFIRMED_WRITTEN', evidence: { row: 'created' } };
    },
    async verifyInvoiceRow({ commitPlan }) {
      record('hoaDon.verifyInvoiceRow');
      return findHoaDon(commitPlan).status === 'ALREADY_PRESENT'
        ? { status: 'CONFIRMED_WRITTEN', evidence: { row: 'verified' } }
        : { status: 'CONFLICT', errorCode: 'HOA_DON_VERIFY_FAILED', evidence: {} };
    },
    async buildSnapshot() {
      return clone(state.hoaDonRows);
    },
    mutationCount() {
      return mutationLog.filter(item => item === 'writeHoaDon').length;
    }
  };

  const ledgerAdapter = {
    async findInvoiceLines({ commitPlan }) {
      record('ledger.findInvoiceLines');
      preloadOnce(commitPlan);
      return findLedger(commitPlan);
    },
    async appendInvoiceLinesIfAbsent({ commitPlan }) {
      record('ledger.appendInvoiceLinesIfAbsent');
      const before = maybeFault('LEDGER_WRITE', false);
      if (before) return before;
      const existing = findLedger(commitPlan);
      if (existing.status === 'ALREADY_PRESENT') return existing;
      if (existing.status === 'CONFLICT') return existing;
      mutation('writeLedger');
      const rows = ledgerRowsFromPlan(commitPlan);
      state.ledgerRows.push(...(options.partialLedgerCommit ? rows.slice(0, 1) : rows));
      const after = maybeFault('LEDGER_WRITE', true);
      if (after) return after;
      return options.partialLedgerCommit
        ? { status: 'OUTCOME_UNKNOWN', errorCode: 'LEDGER_PARTIAL_COMMIT', evidence: { committedLineCount: 1 } }
        : { status: 'CONFIRMED_WRITTEN', evidence: { committedLineCount: rows.length } };
    },
    async verifyInvoiceLines({ commitPlan }) {
      record('ledger.verifyInvoiceLines');
      if (options.ledgerVerificationMismatch) return { status: 'CONFLICT', errorCode: 'LEDGER_VERIFY_MISMATCH', evidence: {} };
      return findLedger(commitPlan).status === 'ALREADY_PRESENT'
        ? { status: 'CONFIRMED_WRITTEN', evidence: { committedLineCount: commitPlan.expectedLineCount } }
        : { status: 'CONFLICT', errorCode: 'LEDGER_VERIFY_FAILED', evidence: {} };
    },
    async buildSnapshot() {
      return clone(state.ledgerRows);
    },
    mutationCount() {
      return mutationLog.filter(item => item === 'writeLedger').length;
    }
  };

  const gmailProjectionAdapter = {
    async readLabels({ stage, commitPlan }) {
      record('gmail.readLabels', { stage: stage || '' });
      preloadOnce(commitPlan);
      if (stage === 'PRE_LEDGER' && options.falseSavedLabelBeforeLedger) return { status: 'ALREADY_PRESENT', labels: ['SAVED'] };
      if (stage === 'PRE_LEDGER') return { status: 'CONFIRMED_NOT_WRITTEN', labels: [] };
      if (options.savedLabelAlreadyCorrect && findLedger(commitPlan).status === 'ALREADY_PRESENT') state.labels = ['SAVED'];
      return state.labels.includes('SAVED')
        ? { status: 'ALREADY_PRESENT', labels: clone(state.labels) }
        : { status: 'CONFIRMED_NOT_WRITTEN', labels: clone(state.labels) };
    },
    async applySavedLabel() {
      record('gmail.applySavedLabel');
      const before = maybeFault('GMAIL_WRITE', false);
      if (before) return before;
      if (!state.labels.includes('SAVED')) {
        mutation('writeGmail');
        state.labels = state.labels.filter(label => label !== 'PENDING');
        state.labels.push('SAVED');
      }
      const after = maybeFault('GMAIL_WRITE', true);
      if (after) return after;
      return { status: 'CONFIRMED_WRITTEN', evidence: { saved: true } };
    },
    async verifySavedLabel() {
      record('gmail.verifySavedLabel');
      return state.labels.includes('SAVED') && !state.labels.includes('PENDING')
        ? { status: 'CONFIRMED_WRITTEN', evidence: { saved: true } }
        : { status: 'CONFLICT', errorCode: 'GMAIL_SAVED_LABEL_MISSING', evidence: {} };
    },
    async buildSnapshot() {
      return clone(state.labels);
    },
    mutationCount() {
      return mutationLog.filter(item => item === 'writeGmail').length;
    }
  };

  let preloaded = false;
  function preloadOnce(plan) {
    if (preloaded) return;
    preloaded = true;
    preload(plan);
  }

  function findHoaDon(plan) {
    const matches = state.hoaDonRows.filter(row => row.legacyInvoiceKey === plan.legacyInvoiceKey || row.invoiceKeyV2 === plan.invoiceKeyV2);
    if (matches.length === 1 && fieldsMatch(matches[0], plan.hoaDonRegistryTarget, ['xmlContentHash', 'pdfContentHash', 'xmlFileId', 'pdfFileId'])) {
      return { status: 'ALREADY_PRESENT', evidence: clone(matches[0]) };
    }
    if (matches.length > 0) return { status: 'CONFLICT', errorCode: 'HOA_DON_ROW_CONFLICT', evidence: { count: matches.length } };
    return { status: 'CONFIRMED_NOT_WRITTEN', evidence: {} };
  }

  function findLedger(plan) {
    const expected = ledgerRowsFromPlan(plan);
    const matches = expected.filter(expectedRow => state.ledgerRows.some(row => fieldsMatch(row, expectedRow, ['legacyInvoiceKey', 'invoiceKeyV2', 'legacyHashIndex', 'lineIdentityV2'])));
    if (matches.length === expected.length && state.ledgerRows.length >= expected.length) return { status: 'ALREADY_PRESENT', evidence: { committedLineCount: matches.length } };
    if (matches.length > 0 || state.ledgerRows.some(row => row.invoiceKeyV2 === plan.invoiceKeyV2 || row.legacyInvoiceKey === plan.legacyInvoiceKey)) {
      return { status: 'CONFLICT', errorCode: 'LEDGER_ROWS_MISSING', evidence: { committedLineCount: matches.length } };
    }
    return { status: 'CONFIRMED_NOT_WRITTEN', evidence: {} };
  }

  return {
    sourceAdapter,
    driveEvidenceAdapter,
    hoaDonAdapter,
    ledgerAdapter,
    gmailProjectionAdapter,
    calls,
    mutationLog,
    state,
    sourceInput,
    dump() {
      return clone({ calls, mutationLog, state });
    }
  };
}

function fieldsMatch(actual, expected, fields) {
  return fields.every(field => String(actual && actual[field] || '') === String(expected && expected[field] || ''));
}

function hashFixture(value) {
  const text = String(value || '');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (`00000000${(hash >>> 0).toString(16)}`).slice(-8);
}
