const D5C_IMPLEMENTATION_STATUS = 'LOCAL_ONLY';
const D5C_EXECUTION_MODE_ = 'READ_ONLY';
const D5C_READ_STATUSES_ = Object.freeze({
  OK: 'READ_OK',
  NOT_FOUND: 'NOT_FOUND',
  MULTIPLE_MATCHES: 'MULTIPLE_MATCHES',
  LIMIT_EXCEEDED: 'READ_LIMIT_EXCEEDED',
  FAILED: 'READ_FAILED',
  REFERENCE_INVALID: 'REFERENCE_INVALID',
  CONTENT_HASH_MISMATCH: 'CONTENT_HASH_MISMATCH'
});

const D5C_DEFAULT_LIMITS_ = Object.freeze({
  MAX_GMAIL_MESSAGES_PER_THREAD: 10,
  MAX_HOA_DON_ROWS_SCANNED: 20,
  MAX_LEDGER_ROWS_SCANNED: 50,
  MAX_DRIVE_DUPLICATE_CANDIDATES: 5
});

function createProductionReadOnlySnapshotAdapters(options) {
  const opts = options || {};
  const gmailReader = requireD5CAdapter_(opts.gmailReader, 'gmailReader', ['readThread']);
  const driveReader = requireD5CAdapter_(opts.driveReader, 'driveReader', ['readFile']);
  const sheetsReader = requireD5CAdapter_(opts.sheetsReader, 'sheetsReader', ['readHoaDonRows', 'readLedgerRows']);
  const identityHasher = opts.identityHasher || { hash: hashD5CString_ };
  requireD5CAdapter_(identityHasher, 'identityHasher', ['hash']);
  const clock = opts.clock || { now: () => 'D5C_LOCAL_READ_ONLY' };
  requireD5CAdapter_(clock, 'clock', ['now']);
  const limits = normalizeD5CLimits_(opts.limits);

  async function readGmailLabelSnapshot(input) {
    const request = normalizeD5CInput_(input);
    const threadReference = request.sourceReferences.gmailThreadReference;
    if (!threadReference) {
      return safeD5CGmailSnapshot_({ readStatus: D5C_READ_STATUSES_.REFERENCE_INVALID });
    }
    try {
      const read = await gmailReader.readThread({
        threadReference,
        maxMessages: limits.MAX_GMAIL_MESSAGES_PER_THREAD,
        includeAttachmentSummary: true
      });
      if (!read || read.exists === false) {
        return safeD5CGmailSnapshot_({
          exists: false,
          sourceReferenceHashPrefix: hashPrefixD5C_(threadReference, identityHasher),
          readStatus: D5C_READ_STATUSES_.NOT_FOUND
        });
      }
      const messageCount = Number(read.messageCount || 0);
      if (messageCount > limits.MAX_GMAIL_MESSAGES_PER_THREAD) {
        return safeD5CGmailSnapshot_({
          exists: true,
          messageCount,
          labels: safeD5CLabels_(read.labels),
          attachmentSummary: summarizeD5CAttachments_(read.attachmentSummary),
          sourceReferenceHashPrefix: hashPrefixD5C_(threadReference, identityHasher),
          readStatus: D5C_READ_STATUSES_.LIMIT_EXCEEDED
        });
      }
      const labels = safeD5CLabels_(read.labels);
      return safeD5CGmailSnapshot_({
        exists: true,
        messageCount,
        labels,
        savedLabelPresent: labels.some(isD5CSavedLabel_),
        pendingLabelPresent: labels.some(isD5CPendingLabel_),
        attachmentSummary: summarizeD5CAttachments_(read.attachmentSummary),
        sourceReferenceHashPrefix: hashPrefixD5C_(threadReference, identityHasher),
        readStatus: D5C_READ_STATUSES_.OK
      });
    } catch (error) {
      return safeD5CGmailSnapshot_({
        sourceReferenceHashPrefix: hashPrefixD5C_(threadReference, identityHasher),
        readStatus: D5C_READ_STATUSES_.FAILED,
        errorCode: d5cErrorCode_(error)
      });
    }
  }

  async function readDriveEvidenceSnapshot(input) {
    const request = normalizeD5CInput_(input);
    const references = driveReferencesD5C_(request);
    const xml = await readDriveFileD5C_(driveReader, identityHasher, references.xml, 'XML', request.expected.xmlContentHash);
    const pdf = await readDriveFileD5C_(driveReader, identityHasher, references.pdf, 'PDF', request.expected.pdfContentHash);
    let duplicateCandidateCount = 0;
    let duplicateLimitExceeded = false;
    if (typeof driveReader.findDuplicateCandidates === 'function') {
      try {
        const duplicates = await driveReader.findDuplicateCandidates({
          expected: cloneD5CJson_(request.expected),
          maxCandidates: limits.MAX_DRIVE_DUPLICATE_CANDIDATES
        });
        duplicateCandidateCount = Array.isArray(duplicates) ? duplicates.length : Number(duplicates && duplicates.count || 0);
        duplicateLimitExceeded = duplicateCandidateCount > limits.MAX_DRIVE_DUPLICATE_CANDIDATES;
      } catch (_error) {
        duplicateCandidateCount = 0;
      }
    }
    return {
      xml,
      pdf,
      duplicateCandidateCount,
      readStatus: duplicateLimitExceeded ? D5C_READ_STATUSES_.LIMIT_EXCEEDED : combineD5CReadStatus_([xml.readStatus, pdf.readStatus])
    };
  }

  async function readHoaDonSnapshot(input) {
    const request = normalizeD5CInput_(input);
    try {
      const rows = await sheetsReader.readHoaDonRows({
        legacyInvoiceKey: request.commitPlan.legacyInvoiceKey,
        invoiceKeyV2: request.commitPlan.invoiceKeyV2,
        xmlFileReference: driveReferencesD5C_(request).xml,
        pdfFileReference: driveReferencesD5C_(request).pdf,
        maxRows: limits.MAX_HOA_DON_ROWS_SCANNED
      });
      const safeRows = Array.isArray(rows) ? rows.slice(0, limits.MAX_HOA_DON_ROWS_SCANNED + 1).map(row => cloneD5CJson_(row)) : [];
      if (safeRows.length > limits.MAX_HOA_DON_ROWS_SCANNED) {
        return safeD5CHoaDonSnapshot_(request, safeRows.slice(0, limits.MAX_HOA_DON_ROWS_SCANNED), D5C_READ_STATUSES_.LIMIT_EXCEEDED, identityHasher);
      }
      const status = safeRows.length === 0 ? D5C_READ_STATUSES_.NOT_FOUND : safeRows.length > 1 ? D5C_READ_STATUSES_.MULTIPLE_MATCHES : D5C_READ_STATUSES_.OK;
      return safeD5CHoaDonSnapshot_(request, safeRows, status, identityHasher);
    } catch (error) {
      return safeD5CHoaDonSnapshot_(request, [], D5C_READ_STATUSES_.FAILED, identityHasher, d5cErrorCode_(error));
    }
  }

  async function readLedgerSnapshot(input) {
    const request = normalizeD5CInput_(input);
    try {
      const rows = await sheetsReader.readLedgerRows({
        legacyInvoiceKey: request.commitPlan.legacyInvoiceKey,
        invoiceKeyV2: request.commitPlan.invoiceKeyV2,
        lineHashes: request.expected.lineHashes,
        lineIdentities: request.commitPlan.lineIdentityV2s || [],
        maxRows: limits.MAX_LEDGER_ROWS_SCANNED
      });
      const safeRows = Array.isArray(rows) ? rows.slice(0, limits.MAX_LEDGER_ROWS_SCANNED + 1).map(row => cloneD5CJson_(row)) : [];
      if (safeRows.length > limits.MAX_LEDGER_ROWS_SCANNED) {
        return safeD5CLedgerSnapshot_(request, safeRows.slice(0, limits.MAX_LEDGER_ROWS_SCANNED), D5C_READ_STATUSES_.LIMIT_EXCEEDED, identityHasher);
      }
      const status = safeRows.length === 0 ? D5C_READ_STATUSES_.NOT_FOUND : D5C_READ_STATUSES_.OK;
      return safeD5CLedgerSnapshot_(request, safeRows, status, identityHasher);
    } catch (error) {
      return safeD5CLedgerSnapshot_(request, [], D5C_READ_STATUSES_.FAILED, identityHasher, d5cErrorCode_(error));
    }
  }

  async function buildDurableReconciliationSnapshot(input) {
    const request = normalizeD5CInput_(input);
    const drive = await readDriveEvidenceSnapshot(request);
    const hoaDon = await readHoaDonSnapshot(request);
    const ledger = await readLedgerSnapshot(request);
    const gmail = await readGmailLabelSnapshot(request);
    return {
      job: { ...cloneD5CJson_(request.job), commitPlan: cloneD5CJson_(request.commitPlan) },
      commitPlan: cloneD5CJson_(request.commitPlan),
      observed: {
        driveEvidence: driveEvidenceRowsD5C_(drive),
        hoaDonRows: hoaDon.observedRows,
        ledgerRows: ledger.observedRows,
        gmailLabels: gmail.labels
      },
      snapshotMeta: {
        mode: D5C_EXECUTION_MODE_,
        generatedAt: safeD5CString_(clock.now()),
        sourceReadStatuses: {
          gmail: gmail.readStatus,
          drive: drive.readStatus,
          hoaDon: hoaDon.readStatus,
          ledger: ledger.readStatus
        },
        sanitized: true
      }
    };
  }

  return Object.freeze({
    readGmailLabelSnapshot,
    readDriveEvidenceSnapshot,
    readHoaDonSnapshot,
    readLedgerSnapshot,
    buildDurableReconciliationSnapshot
  });
}

async function readDriveFileD5C_(reader, hasher, fileReference, kind, expectedContentHash) {
  if (!fileReference) {
    return safeD5CDriveFileSnapshot_({ kind, readStatus: D5C_READ_STATUSES_.REFERENCE_INVALID });
  }
  try {
    const read = await reader.readFile({ fileReference, kind, expectedContentHash });
    if (!read || read.exists === false) {
      return safeD5CDriveFileSnapshot_({
        kind,
        exists: false,
        fileReferenceHashPrefix: hashPrefixD5C_(fileReference, hasher),
        readStatus: D5C_READ_STATUSES_.NOT_FOUND
      });
    }
    const contentHash = safeD5CHash_(read.contentHash);
    const expected = safeD5CHash_(expectedContentHash);
    const status = expected && contentHash && expected !== contentHash
      ? D5C_READ_STATUSES_.CONTENT_HASH_MISMATCH
      : D5C_READ_STATUSES_.OK;
    return safeD5CDriveFileSnapshot_({
      kind,
      exists: true,
      fileReferenceHashPrefix: hashPrefixD5C_(fileReference, hasher),
      contentHash,
      mimeType: safeD5CString_(read.mimeType),
      sizeBucket: bucketD5CSize_(read.size),
      trashed: Boolean(read.trashed),
      readStatus: status
    });
  } catch (error) {
    return safeD5CDriveFileSnapshot_({
      kind,
      fileReferenceHashPrefix: hashPrefixD5C_(fileReference, hasher),
      readStatus: D5C_READ_STATUSES_.FAILED,
      errorCode: d5cErrorCode_(error)
    });
  }
}

function normalizeD5CInput_(input) {
  const source = cloneD5CJson_(input || {});
  const commitPlan = source.commitPlan || (source.job && source.job.commitPlan) || {};
  const sourceReferences = source.sourceReferences || {};
  const expected = source.expected || {};
  return {
    job: source.job || { jobId: source.jobId || commitPlan.jobId || '', status: 'READ_ONLY_SNAPSHOT' },
    commitPlan,
    sourceReferences: {
      gmailThreadReference: sourceReferences.gmailThreadReference || '',
      xmlFileReference: sourceReferences.xmlFileReference || sourceReferences.xml || '',
      pdfFileReference: sourceReferences.pdfFileReference || sourceReferences.pdf || ''
    },
    expected: {
      lineCount: Number(expected.lineCount != null ? expected.lineCount : commitPlan.expectedLineCount || 0),
      lineHashes: Array.isArray(expected.lineHashes) ? expected.lineHashes.map(safeD5CHash_) : cloneD5CJson_(commitPlan.legacyHashIndexes || []),
      invoiceKeyHash: safeD5CHash_(expected.invoiceKeyHash || commitPlan.invoiceKeyHash || ''),
      commitPlanHash: safeD5CHash_(expected.commitPlanHash || commitPlan.commitPlanHash || ''),
      xmlContentHash: safeD5CHash_(expected.xmlContentHash || commitPlan.driveEvidenceTargets && commitPlan.driveEvidenceTargets.xmlContentHash || ''),
      pdfContentHash: safeD5CHash_(expected.pdfContentHash || commitPlan.driveEvidenceTargets && commitPlan.driveEvidenceTargets.pdfContentHash || '')
    }
  };
}

function driveReferencesD5C_(request) {
  const targets = request.commitPlan.driveEvidenceTargets || {};
  const registry = request.commitPlan.hoaDonRegistryTarget || {};
  return {
    xml: request.sourceReferences.xmlFileReference || targets.xmlFileReference || targets.xmlFileId || registry.xmlFileId || '',
    pdf: request.sourceReferences.pdfFileReference || targets.pdfFileReference || targets.pdfFileId || registry.pdfFileId || ''
  };
}

function safeD5CGmailSnapshot_(source) {
  const labels = safeD5CLabels_(source.labels);
  return {
    exists: Boolean(source.exists),
    messageCount: Number(source.messageCount || 0),
    labels,
    savedLabelPresent: Boolean(source.savedLabelPresent || labels.some(isD5CSavedLabel_)),
    pendingLabelPresent: Boolean(source.pendingLabelPresent || labels.some(isD5CPendingLabel_)),
    attachmentSummary: summarizeD5CAttachments_(source.attachmentSummary),
    sourceReferenceHashPrefix: safeD5CHashPrefix_(source.sourceReferenceHashPrefix),
    readStatus: safeD5CReadStatus_(source.readStatus),
    errorCode: source.errorCode ? safeD5CErrorCode_(source.errorCode) : ''
  };
}

function safeD5CDriveFileSnapshot_(source) {
  return {
    exists: Boolean(source.exists),
    fileReferenceHashPrefix: safeD5CHashPrefix_(source.fileReferenceHashPrefix),
    contentHash: safeD5CHash_(source.contentHash),
    mimeType: safeD5CMime_(source.mimeType),
    sizeBucket: safeD5CString_(source.sizeBucket || 'UNKNOWN'),
    trashed: Boolean(source.trashed),
    readStatus: safeD5CReadStatus_(source.readStatus),
    errorCode: source.errorCode ? safeD5CErrorCode_(source.errorCode) : ''
  };
}

function safeD5CHoaDonSnapshot_(request, rows, readStatus, hasher, errorCode) {
  const observedRows = rows.map(row => ({
    legacyInvoiceKey: safeD5CString_(row.legacyInvoiceKey || request.commitPlan.legacyInvoiceKey),
    invoiceKeyV2: safeD5CString_(row.invoiceKeyV2 || request.commitPlan.invoiceKeyV2),
    xmlFileId: safeD5CString_(row.xmlFileId || row.xmlReference || ''),
    pdfFileId: safeD5CString_(row.pdfFileId || row.pdfReference || ''),
    xmlContentHash: safeD5CHash_(row.xmlContentHash || request.expected.xmlContentHash),
    pdfContentHash: safeD5CHash_(row.pdfContentHash || request.expected.pdfContentHash)
  }));
  return {
    matchCount: rows.length,
    duplicate: rows.length > 1,
    xmlReferencePresent: observedRows.some(row => Boolean(row.xmlFileId)),
    pdfReferencePresent: observedRows.some(row => Boolean(row.pdfFileId)),
    xmlStatus: rows.some(row => truthyStatusD5C_(row.xmlStatus)) ? 'PRESENT' : 'MISSING',
    pdfStatus: rows.some(row => truthyStatusD5C_(row.pdfStatus)) ? 'PRESENT' : 'MISSING',
    viewLinkPresent: rows.some(row => Boolean(row.viewLinkPresent)),
    rowIdentityHashes: rows.map(row => hashPrefixD5C_(stableD5CJson_({
      legacyInvoiceKey: row.legacyInvoiceKey || request.commitPlan.legacyInvoiceKey,
      invoiceKeyV2: row.invoiceKeyV2 || request.commitPlan.invoiceKeyV2,
      xml: row.xmlFileId || row.xmlReference || '',
      pdf: row.pdfFileId || row.pdfReference || ''
    }), hasher)).sort(),
    observedRows,
    readStatus: safeD5CReadStatus_(readStatus),
    errorCode: errorCode ? safeD5CErrorCode_(errorCode) : ''
  };
}

function safeD5CLedgerSnapshot_(request, rows, readStatus, hasher, errorCode) {
  const observedRows = rows.map(row => ({
    legacyInvoiceKey: safeD5CString_(row.legacyInvoiceKey),
    invoiceKeyV2: safeD5CString_(row.invoiceKeyV2),
    legacyHashIndex: safeD5CHash_(row.legacyHashIndex),
    lineIdentityV2: safeD5CString_(row.lineIdentityV2)
  }));
  const invoiceKeys = observedRows.map(row => row.invoiceKeyV2 || row.legacyInvoiceKey).filter(Boolean);
  const identities = observedRows.map(row => row.lineIdentityV2).filter(Boolean);
  return {
    matchCount: rows.length,
    expectedLineCount: request.expected.lineCount,
    lineCountMatches: rows.length === request.expected.lineCount,
    lineIdentityHashes: identities.map(value => hashPrefixD5C_(value, hasher)).sort(),
    hashIndexPresentCount: observedRows.filter(row => row.legacyHashIndex).length,
    invoiceKeyPresentCount: invoiceKeys.length,
    invoiceKeyConsistent: new Set(invoiceKeys).size <= 1,
    duplicateLineIdentityCount: countD5CDuplicates_(identities),
    observedRows,
    readStatus: safeD5CReadStatus_(readStatus),
    errorCode: errorCode ? safeD5CErrorCode_(errorCode) : ''
  };
}

function driveEvidenceRowsD5C_(snapshot) {
  const rows = [];
  if (snapshot.xml && snapshot.xml.exists) rows.push({ kind: 'XML', contentHash: snapshot.xml.contentHash, fileReferenceHashPrefix: snapshot.xml.fileReferenceHashPrefix });
  if (snapshot.pdf && snapshot.pdf.exists) rows.push({ kind: 'PDF', contentHash: snapshot.pdf.contentHash, fileReferenceHashPrefix: snapshot.pdf.fileReferenceHashPrefix });
  return rows;
}

function normalizeD5CLimits_(limits) {
  const source = limits || {};
  const out = {};
  Object.keys(D5C_DEFAULT_LIMITS_).forEach(key => {
    const value = Number(source[key] || D5C_DEFAULT_LIMITS_[key]);
    out[key] = Number.isInteger(value) && value > 0 ? value : D5C_DEFAULT_LIMITS_[key];
  });
  return out;
}

function combineD5CReadStatus_(statuses) {
  if (statuses.includes(D5C_READ_STATUSES_.FAILED)) return D5C_READ_STATUSES_.FAILED;
  if (statuses.includes(D5C_READ_STATUSES_.LIMIT_EXCEEDED)) return D5C_READ_STATUSES_.LIMIT_EXCEEDED;
  if (statuses.includes(D5C_READ_STATUSES_.CONTENT_HASH_MISMATCH)) return D5C_READ_STATUSES_.CONTENT_HASH_MISMATCH;
  if (statuses.includes(D5C_READ_STATUSES_.REFERENCE_INVALID)) return D5C_READ_STATUSES_.REFERENCE_INVALID;
  if (statuses.every(status => status === D5C_READ_STATUSES_.NOT_FOUND)) return D5C_READ_STATUSES_.NOT_FOUND;
  if (statuses.includes(D5C_READ_STATUSES_.NOT_FOUND)) return D5C_READ_STATUSES_.NOT_FOUND;
  return D5C_READ_STATUSES_.OK;
}

function safeD5CLabels_(labels) {
  return (Array.isArray(labels) ? labels : []).map(label => safeD5CString_(label).replace(/[^\w .:/-]/g, '').slice(0, 80)).filter(Boolean).sort();
}

function summarizeD5CAttachments_(summary) {
  const source = summary || {};
  return {
    xmlCount: Number(source.xmlCount || 0),
    pdfCount: Number(source.pdfCount || 0)
  };
}

function isD5CSavedLabel_(label) {
  const text = safeD5CString_(label).toUpperCase();
  return text.indexOf('SAVED') >= 0 || text.indexOf('DA_LUU') >= 0 || text.indexOf('SAVE_SHEET') >= 0;
}

function isD5CPendingLabel_(label) {
  const text = safeD5CString_(label).toUpperCase();
  return text.indexOf('PENDING') >= 0 || text.indexOf('CHO_XU_LY') >= 0 || text.indexOf('NEED_REVIEW') >= 0;
}

function truthyStatusD5C_(value) {
  const text = safeD5CString_(value).toUpperCase();
  return Boolean(text) && !['MISSING', 'NO', 'FALSE', '0'].includes(text);
}

function bucketD5CSize_(size) {
  const value = Number(size || 0);
  if (!value) return 'EMPTY';
  if (value <= 1024) return 'LE_1KB';
  if (value <= 1024 * 1024) return 'LE_1MB';
  if (value <= 10 * 1024 * 1024) return 'LE_10MB';
  return 'GT_10MB';
}

function countD5CDuplicates_(values) {
  const counts = {};
  values.forEach(value => {
    counts[value] = (counts[value] || 0) + 1;
  });
  return Object.keys(counts).filter(key => counts[key] > 1).length;
}

function requireD5CAdapter_(adapter, name, methods) {
  if (!adapter || typeof adapter !== 'object' && typeof adapter !== 'function') throw new Error('D5C_DEPENDENCY_REQUIRED:' + name);
  methods.forEach(method => {
    if (typeof adapter[method] !== 'function') throw new Error('D5C_ADAPTER_METHOD_REQUIRED:' + name + '.' + method);
  });
  return adapter;
}

function safeD5CReadStatus_(status) {
  const value = safeD5CString_(status);
  return Object.keys(D5C_READ_STATUSES_).map(key => D5C_READ_STATUSES_[key]).includes(value) ? value : D5C_READ_STATUSES_.FAILED;
}

function d5cErrorCode_(error) {
  return safeD5CErrorCode_(error && (error.code || error.message || error));
}

function safeD5CErrorCode_(value) {
  return safeD5CString_(value).replace(/[^A-Z0-9_]/gi, '_').toUpperCase().slice(0, 80) || 'D5C_READ_FAILED';
}

function safeD5CHash_(value) {
  return safeD5CString_(value).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 128);
}

function safeD5CHashPrefix_(value) {
  return safeD5CHash_(value).slice(0, 12);
}

function safeD5CMime_(value) {
  return safeD5CString_(value).replace(/[^A-Za-z0-9/._+-]/g, '').slice(0, 80);
}

function hashPrefixD5C_(value, hasher) {
  return safeD5CHashPrefix_(hasher.hash(safeD5CString_(value)));
}

function hashD5CString_(value) {
  const text = safeD5CString_(value);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (`00000000${(hash >>> 0).toString(16)}`).slice(-8);
}

function safeD5CString_(value) {
  return value == null ? '' : String(value);
}

function cloneD5CJson_(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function stableD5CJson_(value) {
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
