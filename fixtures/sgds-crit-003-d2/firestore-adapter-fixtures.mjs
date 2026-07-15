export const D2_FAULT_INJECTION_CASES = Object.freeze([
  'fail before job create',
  'fail after create response lost',
  'fail before transition commit',
  'fail after transition commit response lost',
  'fail while appending audit event',
  'fail while saving reconciliation report',
  'version conflict during resume',
  'duplicate request with same idempotency key'
]);

export function createD2Clock() {
  let index = 0;
  const values = [
    '2026-07-15T00:00:00.000Z',
    '2026-07-15T00:00:01.000Z',
    '2026-07-15T00:00:02.000Z',
    '2026-07-15T00:00:03.000Z',
    '2026-07-15T00:00:04.000Z',
    '2026-07-15T00:00:05.000Z'
  ];
  return {
    now() {
      const value = values[Math.min(index, values.length - 1)];
      index += 1;
      return value;
    }
  };
}

export function createD2JobSeed(overrides = {}) {
  return {
    invoiceIdentityHash: 'synthetic-invoice-identity-hash',
    sourceThreadHash: 'synthetic-source-thread-hash',
    status: 'DETECTED',
    ...overrides
  };
}

export function createD2CommitPlan(overrides = {}) {
  return {
    version: 'DURABLE_COMMIT_PLAN_V1',
    jobId: 'synthetic-job-id',
    legacyInvoiceKey: 'SYNTHETIC_LEGACY_KEY',
    invoiceKeyV2: 'SYNTHETIC_INVOICE_KEY_V2',
    expectedLineCount: 2,
    legacyHashIndexes: ['synthetic-line-hash-1', 'synthetic-line-hash-2'],
    lineIdentityV2s: ['synthetic-line-id-1', 'synthetic-line-id-2'],
    lines: [
      { sourceLineNo: 1, legacyHashIndex: 'synthetic-line-hash-1', lineIdentityV2: 'synthetic-line-id-1', immutableFields: { bucket: 'A' } },
      { sourceLineNo: 2, legacyHashIndex: 'synthetic-line-hash-2', lineIdentityV2: 'synthetic-line-id-2', immutableFields: { bucket: 'B' } }
    ],
    hoaDonRegistryTarget: { xmlContentHash: 'synthetic-xml-hash', pdfContentHash: 'synthetic-pdf-hash' },
    driveEvidenceTargets: { xmlContentHash: 'synthetic-xml-hash', pdfContentHash: 'synthetic-pdf-hash' },
    preCommitLedgerProbe: { status: 'NO_ROWS_PRESENT' },
    ...overrides
  };
}

export function createD2Report(overrides = {}) {
  return {
    reportId: 'rpt_synthetic_consistent',
    jobId: 'synthetic-job-id',
    invoiceKeyHashPrefix: 'abcdef12',
    status: 'CONSISTENT',
    findingCount: 0,
    blockerCount: 0,
    findings: [],
    generatedAt: '2026-07-15T00:00:00.000Z',
    inputSnapshotVersion: 'snapshot-v1',
    jobVersion: 1,
    ...overrides
  };
}

export function createFakeFirestoreTransport(options = {}) {
  const docs = new Map();
  const failures = [...(options.failures || [])];
  const calls = [];

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function maybeFail(op, timing, path = '') {
    const index = failures.findIndex(failure => failure.op === op && failure.timing === timing && failure.used !== true && (!failure.pathIncludes || String(path).includes(failure.pathIncludes)));
    if (index < 0) return;
    const failure = failures[index];
    if (failure.once !== false) failure.used = true;
    const error = new Error(`${op}_${timing}_fault`);
    error.code = failure.code || 'FAKE_TRANSPORT_FAULT';
    if (timing === 'after') error.writeOutcome = 'UNKNOWN';
    throw error;
  }

  const transport = {
    calls,
    dump() {
      return [...docs.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([path, doc]) => [path, clone(doc)]);
    },
    async runTransaction(work) {
      calls.push(['runTransaction']);
      return work(this);
    },
    async getDocument(path) {
      calls.push(['getDocument', path]);
      maybeFail('getDocument', 'before', path);
      const value = docs.has(path) ? clone(docs.get(path)) : null;
      maybeFail('getDocument', 'after', path);
      return value;
    },
    async createDocument(path, doc) {
      calls.push(['createDocument', path]);
      maybeFail('createDocument', 'before', path);
      if (docs.has(path)) {
        const error = new Error('document already exists');
        error.code = 'DURABLE_JOB_ALREADY_EXISTS';
        throw error;
      }
      docs.set(path, clone(doc));
      maybeFail('createDocument', 'after', path);
      return clone(doc);
    },
    async updateDocument(path, doc, options = {}) {
      calls.push(['updateDocument', path]);
      maybeFail('updateDocument', 'before', path);
      if (!docs.has(path)) {
        const error = new Error('document not found');
        error.code = 'DURABLE_JOB_NOT_FOUND';
        throw error;
      }
      const current = docs.get(path);
      if (options.expectedVersion != null && Number(current.version) !== Number(options.expectedVersion)) {
        const error = new Error('version conflict');
        error.code = 'DURABLE_JOB_VERSION_CONFLICT';
        throw error;
      }
      docs.set(path, clone(doc));
      maybeFail('updateDocument', 'after', path);
      return clone(doc);
    },
    async appendDocument(collectionPath, doc) {
      calls.push(['appendDocument', collectionPath]);
      maybeFail('appendDocument', 'before', collectionPath);
      const id = doc.eventId || doc.reportId || `doc_${String(docs.size + 1).padStart(6, '0')}`;
      const path = `${collectionPath}/${id}`;
      if (docs.has(path)) {
        const error = new Error('append collision');
        error.code = 'AUDIT_EVENT_SEQUENCE_CONFLICT';
        throw error;
      }
      docs.set(path, clone(doc));
      maybeFail('appendDocument', 'after', collectionPath);
      return clone(doc);
    },
    async queryDocuments(collectionPath) {
      calls.push(['queryDocuments', collectionPath]);
      maybeFail('queryDocuments', 'before', collectionPath);
      const prefix = `${collectionPath}/`;
      const result = [...docs.entries()]
        .filter(([path]) => path.startsWith(prefix) && path.slice(prefix.length).indexOf('/') < 0)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, doc]) => clone(doc));
      maybeFail('queryDocuments', 'after', collectionPath);
      return result;
    }
  };

  return transport;
}