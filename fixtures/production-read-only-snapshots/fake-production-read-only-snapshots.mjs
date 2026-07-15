export const D5C_TEST_SCENARIOS = Object.freeze([
  'exact Gmail thread found',
  'Gmail thread not found',
  'Gmail saved label present',
  'Gmail pending label conflict',
  'Gmail message limit exceeded',
  'exact XML and PDF files found',
  'missing XML',
  'missing PDF',
  'Drive content hash mismatch',
  'duplicate Drive candidates',
  'invalid Drive reference',
  'one Hoa-Don row',
  'missing Hoa-Don row',
  'duplicate Hoa-Don rows',
  'missing XML/PDF references',
  'one-line ledger invoice',
  'multi-line ledger invoice',
  'missing ledger line',
  'extra ledger line',
  'blank HashIndex',
  'blank InvoiceKey',
  'inconsistent InvoiceKey',
  'duplicate line identity',
  'complete reconciliation snapshot',
  'partial snapshot',
  'one adapter read failure',
  'snapshot ordering deterministic',
  'input remains immutable',
  'snapshot contains no raw identifiers',
  'snapshot contains no invoice PII',
  'zero mutation method calls',
  'zero production network calls',
  'same suite run twice deterministically'
]);

export const D5C_READ_FAILURE_CASES = Object.freeze([
  'gmail reference invalid',
  'gmail not found',
  'gmail read failure',
  'drive reference invalid',
  'drive not found',
  'drive content hash mismatch',
  'sheet multiple matches',
  'sheet read limit exceeded',
  'sheet read failure'
]);

export function createD5CClock() {
  return { now: () => '2026-07-15T00:00:00.000Z' };
}

export function createD5CInput(overrides = {}) {
  const lineCount = overrides.lineCount || 2;
  const lines = Array.from({ length: lineCount }, (_, index) => ({
    sourceLineNo: index + 1,
    legacyHashIndex: `synthetic-d5c-line-hash-${index + 1}`,
    lineIdentityV2: `synthetic-d5c-line-id-${index + 1}`,
    immutableFields: { bucket: `line-${index + 1}` }
  }));
  const commitPlan = {
    version: 'DURABLE_COMMIT_PLAN_V1',
    jobId: 'job_synthetic_d5c',
    legacyInvoiceKey: 'SYNTHETIC_LEGACY_KEY_D5C',
    invoiceKeyV2: 'SYNTHETIC_INVOICE_KEY_V2_D5C',
    expectedLineCount: lineCount,
    legacyHashIndexes: lines.map(line => line.legacyHashIndex),
    lineIdentityV2s: lines.map(line => line.lineIdentityV2),
    lines,
    hoaDonRegistryTarget: {
      legacyInvoiceKey: 'SYNTHETIC_LEGACY_KEY_D5C',
      xmlFileId: 'synthetic-xml-file-safe',
      pdfFileId: 'synthetic-pdf-file-safe',
      xmlContentHash: 'syntheticXmlHash',
      pdfContentHash: 'syntheticPdfHash'
    },
    driveEvidenceTargets: {
      xmlContentHash: 'syntheticXmlHash',
      pdfContentHash: 'syntheticPdfHash'
    },
    commitPlanHash: 'syntheticCommitPlanHash',
    projectionState: 'EXPECT_SAVED_LABEL'
  };
  return {
    jobId: 'job_synthetic_d5c',
    invoiceIdentityHash: 'syntheticInvoiceIdentityHashD5C',
    job: {
      jobId: 'job_synthetic_d5c',
      status: 'COMPLETED',
      state: 'COMPLETED',
      commitPlan
    },
    commitPlan,
    sourceReferences: {
      gmailThreadReference: 'RAW_GMAIL_THREAD_ID_SHOULD_NOT_LEAK_D5C',
      xmlFileReference: 'RAW_XML_FILE_ID_SHOULD_NOT_LEAK_D5C',
      pdfFileReference: 'RAW_PDF_FILE_ID_SHOULD_NOT_LEAK_D5C'
    },
    expected: {
      lineCount,
      lineHashes: lines.map(line => line.legacyHashIndex),
      invoiceKeyHash: 'syntheticInvoiceKeyHash',
      commitPlanHash: 'syntheticCommitPlanHash',
      xmlContentHash: 'syntheticXmlHash',
      pdfContentHash: 'syntheticPdfHash'
    },
    ...clone(overrides.input || {})
  };
}

export function createD5CReadOnlyFixtures(options = {}) {
  const calls = [];
  const mutationCalls = [];
  const networkCalls = [];
  const input = createD5CInput(options);
  const failures = options.failures || {};

  const gmailThread = {
    exists: options.gmailExists !== false,
    messageCount: options.gmailMessageCount || 1,
    labels: options.gmailLabels || ['SGDS/SAVED'],
    attachmentSummary: options.attachmentSummary || { xmlCount: 1, pdfCount: 1 }
  };

  const driveFiles = {
    RAW_XML_FILE_ID_SHOULD_NOT_LEAK_D5C: options.xmlMissing ? { exists: false } : {
      exists: true,
      contentHash: options.xmlContentHash || 'syntheticXmlHash',
      mimeType: 'application/xml',
      size: 2048,
      trashed: false
    },
    RAW_PDF_FILE_ID_SHOULD_NOT_LEAK_D5C: options.pdfMissing ? { exists: false } : {
      exists: true,
      contentHash: options.pdfContentHash || 'syntheticPdfHash',
      mimeType: 'application/pdf',
      size: 4096,
      trashed: false
    }
  };

  const hoaDonRows = Object.prototype.hasOwnProperty.call(options, 'hoaDonRows')
    ? clone(options.hoaDonRows)
    : [{
      legacyInvoiceKey: input.commitPlan.legacyInvoiceKey,
      invoiceKeyV2: input.commitPlan.invoiceKeyV2,
      xmlFileId: 'synthetic-xml-file-safe',
      pdfFileId: 'synthetic-pdf-file-safe',
      xmlStatus: 'OK',
      pdfStatus: 'OK',
      viewLinkPresent: true,
      xmlContentHash: 'syntheticXmlHash',
      pdfContentHash: 'syntheticPdfHash'
    }];

  const ledgerRows = Object.prototype.hasOwnProperty.call(options, 'ledgerRows')
    ? clone(options.ledgerRows)
    : input.commitPlan.lines.map(line => ({
      legacyInvoiceKey: input.commitPlan.legacyInvoiceKey,
      invoiceKeyV2: input.commitPlan.invoiceKeyV2,
      legacyHashIndex: line.legacyHashIndex,
      lineIdentityV2: line.lineIdentityV2
    }));

  function maybeThrow(key) {
    if (!failures[key]) return;
    const error = new Error(`${key}_fault`);
    error.code = failures[key] === true ? `${key}_FAULT` : failures[key];
    throw error;
  }

  const gmailReader = {
    async readThread(request) {
      calls.push({ name: 'gmail.readThread', request: safeRequest(request) });
      maybeThrow('GMAIL_READ');
      if (options.gmailNotFound) return { exists: false };
      return clone(gmailThread);
    }
  };

  const driveReader = {
    async readFile(request) {
      calls.push({ name: 'drive.readFile', request: safeRequest(request) });
      maybeThrow('DRIVE_READ');
      return clone(driveFiles[request.fileReference] || { exists: false });
    },
    async findDuplicateCandidates(request) {
      calls.push({ name: 'drive.findDuplicateCandidates', request: safeRequest(request) });
      return Array.from({ length: options.duplicateCandidateCount || 0 }, (_, index) => ({ hash: `dup-${index}` }));
    }
  };

  const sheetsReader = {
    async readHoaDonRows(request) {
      calls.push({ name: 'sheets.readHoaDonRows', request: safeRequest(request) });
      maybeThrow('HOA_DON_READ');
      return clone(hoaDonRows);
    },
    async readLedgerRows(request) {
      calls.push({ name: 'sheets.readLedgerRows', request: safeRequest(request) });
      maybeThrow('LEDGER_READ');
      return clone(ledgerRows);
    }
  };

  const mutationTrap = {
    setValue() { mutationCalls.push('setValue'); throw new Error('D5C_MUTATION_FORBIDDEN'); },
    setValues() { mutationCalls.push('setValues'); throw new Error('D5C_MUTATION_FORBIDDEN'); },
    appendRow() { mutationCalls.push('appendRow'); throw new Error('D5C_MUTATION_FORBIDDEN'); },
    deleteRow() { mutationCalls.push('deleteRow'); throw new Error('D5C_MUTATION_FORBIDDEN'); },
    createFile() { mutationCalls.push('createFile'); throw new Error('D5C_MUTATION_FORBIDDEN'); },
    setName() { mutationCalls.push('setName'); throw new Error('D5C_MUTATION_FORBIDDEN'); },
    setTrashed() { mutationCalls.push('setTrashed'); throw new Error('D5C_MUTATION_FORBIDDEN'); },
    addLabel() { mutationCalls.push('addLabel'); throw new Error('D5C_MUTATION_FORBIDDEN'); },
    removeLabel() { mutationCalls.push('removeLabel'); throw new Error('D5C_MUTATION_FORBIDDEN'); },
    send() { mutationCalls.push('send'); throw new Error('D5C_MUTATION_FORBIDDEN'); },
    reply() { mutationCalls.push('reply'); throw new Error('D5C_MUTATION_FORBIDDEN'); }
  };

  const identityHasher = {
    hash(value) {
      return fnv(value);
    }
  };

  return {
    input,
    gmailReader,
    driveReader,
    sheetsReader,
    identityHasher,
    clock: createD5CClock(),
    calls,
    mutationCalls,
    networkCalls,
    mutationTrap
  };
}

function safeRequest(request) {
  const cloneRequest = clone(request || {});
  ['threadReference', 'fileReference'].forEach(key => {
    if (cloneRequest[key]) cloneRequest[key] = `hash:${fnv(cloneRequest[key]).slice(0, 8)}`;
  });
  return cloneRequest;
}

function fnv(value) {
  const text = String(value || '');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (`00000000${(hash >>> 0).toString(16)}`).slice(-8);
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}
