const D7_E4A1_PHASE_ = 'D7_E4A1_BOUNDED_FIRESTORE_IDENTITY_CARDINALITY_READ_ONLY_PROOF';
const D7_E4A1_PUBLIC_ENTRYPOINT_ = 'runD7E4A1BoundedFirestoreIdentityCardinalityReadOnlyProof';
const D7_E4A1_SCHEMA_VERSION_ = 'D7_E4A1_FIRESTORE_CARDINALITY_RESULT_V1';
const D7_E4A1_OWNER_MARKER_PROPERTY_ = 'D7_E4A1_OWNER_APPROVAL_MARKER';
const D7_E4A1_OWNER_MARKER_ = 'OWNER_APPROVED_D7_E4A1_BOUNDED_READ_ONLY_PROOF';
const D7_E4A1_FIRESTORE_PROJECT_ID_ = 'tonkhohd';
const D7_E4A1_FIRESTORE_DATABASE_ID_ = '(default)';
const D7_E4A1_QUERY_LIMIT_ = 2;

function runD7E4A1BoundedFirestoreIdentityCardinalityReadOnlyProof() {
  return createD7E4A1BoundedFirestoreIdentityCardinalityReadOnlyRunner_().run();
}

function createD7E4A1BoundedFirestoreIdentityCardinalityReadOnlyRunner_(dependencies) {
  const d = dependencies || {};
  const reader = d.firestoreReader || createD7E4A1ProductionFirestoreReadOnly_(d);
  const services = {
    readConfiguration: d.readConfiguration || readD7E4A1ConfigurationReadOnly_,
    getDocument: d.getDocument || reader.getDocument,
    queryDocuments: d.queryDocuments || reader.queryDocuments,
    now: d.now || function nowD7E4A1_() { return new Date().toISOString(); },
    logger: d.logger || (typeof Logger !== 'undefined' ? Logger : { log: function noopD7E4A1_() {} })
  };

  function run() {
    const result = createD7E4A1BaseResult_(services.now());
    const config = normalizeD7E4A1Configuration_(safeD7E4A1Call_(services.readConfiguration));
    result.CONFIGURATION = config.publicResult;
    if (!config.ready) return finishD7E4A1_(result, services.logger, config.blockerCode);

    const expectedJobId = 'd7e_job_' + config.privateConfig.candidateFingerprint.slice(0, 24);
    const expectedInvoicePrefix = durableD7E4A1HashPrefix_(config.privateConfig.invoiceIdentityHash);
    result.IDENTITY = {
      IDENTITY_DEFINITION: 'JOB_ID_PLUS_PERSISTED_INVOICE_THREAD_AND_COMMIT_PLAN_ATTACHMENT_HASHES',
      JOB_ID_DERIVATION: 'D7_E_CANDIDATE_FINGERPRINT_PREFIX_24',
      INVOICE_IDENTITY_HASH_PREFIX: expectedInvoicePrefix,
      ATTACHMENT_SET_IDENTITY: 'XML_AND_PDF_SHA256_PAIR',
      ATTACHMENT_SET_HASH_CONFIGURED: 'YES',
      COMMIT_PLAN_IDENTITY_REQUIRED: 'YES'
    };

    let directDocument;
    try {
      directDocument = services.getDocument('invoiceJobs/' + expectedJobId);
      result.QUERY.DIRECT_DOCUMENT_READ_COUNT = 1;
    } catch (error) {
      result.QUERY.QUERY_ERROR_STATUS = classifyD7E4A1Error_(error);
      return finishD7E4A1_(result, services.logger, 'BLOCKED_FIRESTORE_DIRECT_DOCUMENT_READ_FAILED');
    }

    let jobIdCandidates;
    try {
      jobIdCandidates = normalizeD7E4A1Documents_(services.queryDocuments({
        collectionId: 'invoiceJobs',
        filters: [{ fieldPath: 'jobId', value: expectedJobId }],
        limit: D7_E4A1_QUERY_LIMIT_
      }));
      result.QUERY.QUERY_EXECUTED = 'YES';
      result.QUERY.QUERY_COUNT = 1;
      result.QUERY.JOB_ID_QUERY_DOCUMENT_COUNT = boundedD7E4A1Count_(jobIdCandidates.length);
    } catch (error) {
      result.QUERY.QUERY_EXECUTED = 'YES';
      result.QUERY.QUERY_COUNT = 1;
      result.QUERY.QUERY_ERROR_STATUS = classifyD7E4A1Error_(error);
      result.QUERY.INDEX_STATUS = indexD7E4A1Status_(error);
      return finishD7E4A1_(result, services.logger, 'BLOCKED_FIRESTORE_JOB_ID_QUERY_FAILED');
    }

    if (!directDocument && jobIdCandidates.length === 0) {
      result.CARDINALITY = createD7E4A1CardinalityResult_(0, 0, 0, 'NO_MATCHING_JOB_FOUND');
      return finishD7E4A1_(result, services.logger, 'PASS_READ_ONLY_CARDINALITY_PROOF_ZERO_MATCH');
    }
    if (!directDocument || jobIdCandidates.length === 0) {
      result.CARDINALITY = createD7E4A1CardinalityResult_('UNKNOWN', 'UNKNOWN', 'UNKNOWN', 'DIRECT_AND_QUERY_CARDINALITY_CONFLICT');
      return finishD7E4A1_(result, services.logger, 'BLOCKED_FIRESTORE_DIRECT_AND_QUERY_CONFLICT');
    }

    const directIdentity = inspectD7E4A1JobIdentity_(directDocument, {
      expectedJobId: expectedJobId,
      expectedInvoicePrefix: expectedInvoicePrefix,
      expectedXmlSha256: config.privateConfig.xmlSha256,
      expectedPdfSha256: config.privateConfig.pdfSha256
    });
    result.IDENTITY.DIRECT_JOB_IDENTITY_STATUS = directIdentity.status;
    result.IDENTITY.SOURCE_THREAD_HASH_STATUS = directIdentity.sourceThreadHash ? 'PERSISTED_HASH_PREFIX_PRESENT' : 'MISSING_OR_INVALID';
    result.IDENTITY.COMMIT_PLAN_IDENTITY_STATUS = directIdentity.commitPlanPresent ? 'PRESENT' : 'MISSING';
    if (!directIdentity.sourceThreadHash || !directIdentity.commitPlanPresent) {
      result.CARDINALITY = createD7E4A1CardinalityResult_(boundedD7E4A1Count_(jobIdCandidates.length), 'UNKNOWN', 'UNKNOWN', directIdentity.status);
      return finishD7E4A1_(result, services.logger, 'BLOCKED_COMMIT_PLAN_OR_SOURCE_THREAD_IDENTITY_UNAVAILABLE');
    }

    let exactCandidates;
    try {
      exactCandidates = normalizeD7E4A1Documents_(services.queryDocuments({
        collectionId: 'invoiceJobs',
        filters: [
          { fieldPath: 'jobId', value: expectedJobId },
          { fieldPath: 'invoiceIdentityHash', value: expectedInvoicePrefix },
          { fieldPath: 'sourceThreadHash', value: directIdentity.sourceThreadHash },
          { fieldPath: 'commitPlan.jobId', value: expectedJobId },
          { fieldPath: 'commitPlan.driveEvidenceTargets.xmlContentHash', value: config.privateConfig.xmlSha256 },
          { fieldPath: 'commitPlan.driveEvidenceTargets.pdfContentHash', value: config.privateConfig.pdfSha256 }
        ],
        limit: D7_E4A1_QUERY_LIMIT_
      }));
      result.QUERY.QUERY_COUNT = 2;
      result.QUERY.EXACT_IDENTITY_QUERY_DOCUMENT_COUNT = boundedD7E4A1Count_(exactCandidates.length);
    } catch (error) {
      result.QUERY.QUERY_COUNT = 2;
      result.QUERY.QUERY_ERROR_STATUS = classifyD7E4A1Error_(error);
      result.QUERY.INDEX_STATUS = indexD7E4A1Status_(error);
      return finishD7E4A1_(result, services.logger, 'BLOCKED_FIRESTORE_EXACT_IDENTITY_QUERY_FAILED');
    }

    const nonExactCandidateCount = jobIdCandidates.filter(function isNonExactCandidate(document) {
      return !inspectD7E4A1JobIdentity_(document, {
        expectedJobId: expectedJobId,
        expectedInvoicePrefix: expectedInvoicePrefix,
        expectedXmlSha256: config.privateConfig.xmlSha256,
        expectedPdfSha256: config.privateConfig.pdfSha256,
        expectedSourceThreadHash: directIdentity.sourceThreadHash
      }).exact;
    }).length;
    const exactCount = boundedD7E4A1Count_(exactCandidates.length);
    const candidateCount = boundedD7E4A1Count_(jobIdCandidates.length);
    result.CARDINALITY = createD7E4A1CardinalityResult_(candidateCount, exactCount, nonExactCandidateCount, 'EXACT_COMPOSITE_QUERY_COMPLETED');
    return finishD7E4A1_(result, services.logger, nonExactCandidateCount > 0
      ? 'BLOCKED_CONFLICTING_PARTIAL_IDENTITY_JOB'
      : exactCount === 1
        ? 'PASS_READ_ONLY_CARDINALITY_PROOF_ONE_MATCH'
      : exactCount === 0
        ? 'PASS_READ_ONLY_CARDINALITY_PROOF_ZERO_MATCH'
        : 'BLOCKED_DUPLICATE_EXACT_FIRESTORE_JOBS');
  }

  return Object.freeze({ run: run });
}

function createD7E4A1ProductionFirestoreReadOnly_(dependencies) {
  const d = dependencies || {};
  const fetch = d.fetch || function d7e4a1Fetch(url, params) { return UrlFetchApp.fetch(url, params); };
  const getOAuthToken = d.getOAuthToken || function d7e4a1Token() { return ScriptApp.getOAuthToken(); };

  function getDocument(path) {
    const safePath = validateD7E4A1FirestoreDocumentPath_(path);
    const response = fetch(d7e4a1FirestoreUrl_('/documents/' + safePath.split('/').map(encodeURIComponent).join('/')), {
      method: 'get',
      headers: { Authorization: 'Bearer ' + getOAuthToken() },
      muteHttpExceptions: true
    });
    const status = Number(response.getResponseCode());
    if (status === 404) return null;
    if (status !== 200) throw d7e4a1FirestoreError_(status, response.getContentText());
    return decodeD7E4A1FirestoreDocument_(JSON.parse(response.getContentText()));
  }

  function queryDocuments(request) {
    const query = normalizeD7E4A1QueryRequest_(request);
    const payload = {
      structuredQuery: {
        from: [{ collectionId: query.collectionId }],
        where: {
          compositeFilter: {
            op: 'AND',
            filters: query.filters.map(function toFieldFilter(filter) {
              return { fieldFilter: { field: { fieldPath: filter.fieldPath }, op: 'EQUAL', value: { stringValue: filter.value } } };
            })
          }
        },
        limit: query.limit
      }
    };
    const response = fetch(d7e4a1FirestoreUrl_('/documents:runQuery'), {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      headers: { Authorization: 'Bearer ' + getOAuthToken() },
      muteHttpExceptions: true
    });
    const status = Number(response.getResponseCode());
    if (status !== 200) throw d7e4a1FirestoreError_(status, response.getContentText());
    const rows = JSON.parse(response.getContentText());
    if (!Array.isArray(rows)) throw d7e4a1Error_('FIRESTORE_QUERY_RESPONSE_INVALID');
    return rows.filter(function hasDocument(row) { return row && row.document; }).map(function decodeRow(row) {
      return decodeD7E4A1FirestoreDocument_(row.document);
    });
  }

  return Object.freeze({ getDocument: getDocument, queryDocuments: queryDocuments });
}

function readD7E4A1ConfigurationReadOnly_() {
  const keys = [
    D7_E4A1_OWNER_MARKER_PROPERTY_,
    'D7_E_CANONICAL_CANDIDATE_FINGERPRINT',
    'D7_E_CANONICAL_XML_SHA256',
    'D7_E_CANONICAL_PDF_SHA256',
    'D7_E_CANONICAL_INVOICE_IDENTITY_HASH',
    'D7_E_CANONICAL_ATTACHMENT_SET_HASH'
  ];
  const properties = typeof PropertiesService !== 'undefined' && PropertiesService.getScriptProperties
    ? PropertiesService.getScriptProperties()
    : null;
  const values = {};
  keys.forEach(function readKey(key) {
    values[key] = properties && properties.getProperty ? properties.getProperty(key) : null;
  });
  return values;
}

function normalizeD7E4A1Configuration_(raw) {
  const values = raw || {};
  const markerValid = String(values[D7_E4A1_OWNER_MARKER_PROPERTY_] || '').trim() === D7_E4A1_OWNER_MARKER_;
  const privateConfig = {
    candidateFingerprint: normalizeD7E4A1Sha256_(values.D7_E_CANONICAL_CANDIDATE_FINGERPRINT),
    xmlSha256: normalizeD7E4A1Sha256_(values.D7_E_CANONICAL_XML_SHA256),
    pdfSha256: normalizeD7E4A1Sha256_(values.D7_E_CANONICAL_PDF_SHA256),
    invoiceIdentityHash: normalizeD7E4A1Sha256_(values.D7_E_CANONICAL_INVOICE_IDENTITY_HASH),
    attachmentSetHash: normalizeD7E4A1Sha256_(values.D7_E_CANONICAL_ATTACHMENT_SET_HASH)
  };
  const valuesValid = Object.keys(privateConfig).every(function hasValue(key) { return !!privateConfig[key]; });
  const identityAligned = valuesValid && privateConfig.candidateFingerprint === privateConfig.invoiceIdentityHash;
  const blockerCode = !markerValid
    ? 'BLOCKED_OWNER_APPROVAL_MARKER_INVALID'
    : !valuesValid
      ? 'BLOCKED_CANONICAL_IDENTITY_CONFIGURATION_INVALID'
      : !identityAligned
        ? 'BLOCKED_CANONICAL_INVOICE_IDENTITY_NOT_ALIGNED'
        : '';
  return {
    ready: !blockerCode,
    blockerCode: blockerCode,
    privateConfig: privateConfig,
    publicResult: {
      OWNER_APPROVAL_MARKER_VALID: markerValid ? 'YES' : 'NO',
      CANONICAL_PROPERTY_COUNT: Object.keys(privateConfig).filter(function present(key) { return !!privateConfig[key]; }).length,
      CANONICAL_IDENTITY_FORMAT_VALID: valuesValid ? 'YES' : 'NO',
      CANDIDATE_AND_INVOICE_IDENTITY_ALIGNED: identityAligned ? 'YES' : 'NO',
      RAW_PROPERTY_VALUES_LOGGED: 'NO',
      SCRIPT_PROPERTIES_MUTATION: 'NONE'
    }
  };
}

function inspectD7E4A1JobIdentity_(document, expected) {
  const doc = document || {};
  const plan = doc.commitPlan && typeof doc.commitPlan === 'object' ? doc.commitPlan : null;
  const targets = plan && plan.driveEvidenceTargets && typeof plan.driveEvidenceTargets === 'object' ? plan.driveEvidenceTargets : {};
  const sourceThreadHash = /^[a-f0-9]{8}$/i.test(String(doc.sourceThreadHash || '')) ? String(doc.sourceThreadHash).toLowerCase() : '';
  const exact = !!plan &&
    String(doc.jobId || '') === expected.expectedJobId &&
    String(doc.invoiceIdentityHash || '').toLowerCase() === expected.expectedInvoicePrefix &&
    (!expected.expectedSourceThreadHash || sourceThreadHash === expected.expectedSourceThreadHash) &&
    String(plan.jobId || '') === expected.expectedJobId &&
    String(targets.xmlContentHash || '').toLowerCase() === expected.expectedXmlSha256 &&
    String(targets.pdfContentHash || '').toLowerCase() === expected.expectedPdfSha256 &&
    Number(plan.expectedLineCount) === 1;
  return {
    exact: exact,
    status: exact ? 'EXACT_PERSISTED_IDENTITY_MATCH' : 'PERSISTED_IDENTITY_MISMATCH',
    sourceThreadHash: sourceThreadHash,
    commitPlanPresent: !!plan
  };
}

function createD7E4A1CardinalityResult_(candidateCount, exactCount, nonExactCandidateCount, status) {
  const isExactOne = exactCount === 1;
  const isZero = exactCount === 0;
  const isDuplicate = exactCount === '2_PLUS';
  const proven = isZero || isExactOne || isDuplicate;
  return {
    CANDIDATE_DOCUMENT_COUNT: candidateCount,
    NON_EXACT_CANDIDATE_COUNT: nonExactCandidateCount,
    EXACT_MATCHING_JOB_COUNT: exactCount,
    EXACT_FIRESTORE_JOB_CARDINALITY_PROVEN: proven ? 'YES' : 'NO',
    DUPLICATE_MATCHING_JOB_ABSENCE_PROVEN: isZero || isExactOne ? 'YES' : 'NO',
    EXACT_MATCHED_JOB_STATE: isExactOne ? 'EXACT_ONE_MATCH' : isZero ? 'NO_EXACT_MATCH' : isDuplicate ? 'DUPLICATE_EXACT_MATCHES' : 'UNKNOWN',
    READ_OUTCOME_UNKNOWN: proven ? 'NO' : 'YES',
    STATUS: status
  };
}

function createD7E4A1BaseResult_(createdAt) {
  return {
    METADATA: {
      PHASE: D7_E4A1_PHASE_,
      SCHEMA_VERSION: D7_E4A1_SCHEMA_VERSION_,
      PUBLIC_ENTRYPOINT: D7_E4A1_PUBLIC_ENTRYPOINT_,
      CREATED_AT_STATUS: createdAt ? 'CAPTURED' : 'UNAVAILABLE',
      FIRESTORE_PROJECT_ID: D7_E4A1_FIRESTORE_PROJECT_ID_,
      FIRESTORE_DATABASE_ID: D7_E4A1_FIRESTORE_DATABASE_ID_,
      READ_ONLY: 'YES'
    },
    CONFIGURATION: {},
    IDENTITY: {},
    QUERY: {
      QUERY_FIELDS: 'jobId;invoiceIdentityHash;sourceThreadHash;commitPlan.jobId;commitPlan.driveEvidenceTargets.xmlContentHash;commitPlan.driveEvidenceTargets.pdfContentHash',
      QUERY_COMPLETENESS_PROVEN: 'YES_BY_EXACT_FIELD_PREDICATE_AND_LIMIT_2_TERMINAL_CATEGORY',
      QUERY_BOUNDED: 'YES',
      QUERY_LIMIT_PER_QUERY: D7_E4A1_QUERY_LIMIT_,
      QUERY_EXECUTED: 'NO',
      QUERY_COUNT: 0,
      DIRECT_DOCUMENT_READ_COUNT: 0,
      INDEX_STATUS: 'NOT_EVALUATED',
      QUERY_ERROR_STATUS: 'NONE'
    },
    CARDINALITY: createD7E4A1CardinalityResult_('UNKNOWN', 'UNKNOWN', 'UNKNOWN', 'NOT_EVALUATED'),
    SAFETY_COUNTS: {
      GMAIL_MUTATION_COUNT: 0,
      DRIVE_MUTATION_COUNT: 0,
      SHEETS_MUTATION_COUNT: 0,
      FIRESTORE_MUTATION_COUNT: 0,
      SCRIPT_PROPERTIES_MUTATION_COUNT: 0,
      TRIGGER_MUTATION_COUNT: 0,
      RECONCILIATION_WRITE_COUNT: 0,
      DEPLOYMENT_COUNT: 0,
      DESTRUCTIVE_OPERATION_COUNT: 0,
      RAW_SENSITIVE_VALUE_LOGGED_COUNT: 0,
      RAW_EMAIL_ADDRESS_LOG_COUNT: 0,
      RAW_EMAIL_SUBJECT_LOG_COUNT: 0,
      RAW_MESSAGE_ID_LOG_COUNT: 0,
      RAW_FIRESTORE_DOCUMENT_ID_LOG_COUNT: 0,
      CUSTOMER_CONTENT_LOG_COUNT: 0,
      PRODUCTION_MUTATION_COUNT: 0
    },
    FINAL_STATUS: 'BLOCKED_D7_E4A1_NOT_RUN'
  };
}

function finishD7E4A1_(result, logger, status) {
  result.FINAL_STATUS = status;
  const safe = sanitizeD7E4A1Result_(result);
  logger.log(JSON.stringify(safe));
  return safe;
}

function normalizeD7E4A1QueryRequest_(request) {
  const source = request || {};
  const collectionId = String(source.collectionId || '');
  const filters = Array.isArray(source.filters) ? source.filters : [];
  const limit = Number(source.limit);
  if (collectionId !== 'invoiceJobs' || !filters.length || limit !== D7_E4A1_QUERY_LIMIT_) throw d7e4a1Error_('FIRESTORE_QUERY_REQUEST_INVALID');
  filters.forEach(function validateFilter(filter) {
    if (!filter || !isD7E4A1AllowedFieldPath_(filter.fieldPath) || typeof filter.value !== 'string' || !filter.value) {
      throw d7e4a1Error_('FIRESTORE_QUERY_FILTER_INVALID');
    }
  });
  return { collectionId: collectionId, filters: filters, limit: limit };
}

function isD7E4A1AllowedFieldPath_(path) {
  return [
    'jobId',
    'invoiceIdentityHash',
    'sourceThreadHash',
    'commitPlan.jobId',
    'commitPlan.driveEvidenceTargets.xmlContentHash',
    'commitPlan.driveEvidenceTargets.pdfContentHash'
  ].indexOf(String(path || '')) >= 0;
}

function validateD7E4A1FirestoreDocumentPath_(path) {
  const text = String(path || '');
  if (!/^invoiceJobs\/[A-Za-z0-9._:-]+$/.test(text)) throw d7e4a1Error_('INVALID_EXACT_RESOURCE_REFERENCE');
  return text;
}

function d7e4a1FirestoreUrl_(suffix) {
  return 'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(D7_E4A1_FIRESTORE_PROJECT_ID_) +
    '/databases/' + encodeURIComponent(D7_E4A1_FIRESTORE_DATABASE_ID_) + suffix;
}

function d7e4a1FirestoreError_(httpStatus, bodyText) {
  let parsed = {};
  try { parsed = JSON.parse(String(bodyText || '')); } catch (ignored) {}
  const error = parsed && parsed.error || {};
  const out = d7e4a1Error_('FIRESTORE_HTTP_' + Number(httpStatus || 0));
  out.httpStatus = Number(httpStatus || 0);
  out.firestoreErrorStatus = String(error.status || 'UNKNOWN').replace(/[^A-Z_]/g, '').slice(0, 80);
  return out;
}

function d7e4a1Error_(code) {
  const error = new Error(String(code || 'D7_E4A1_READ_ERROR'));
  error.code = String(code || 'D7_E4A1_READ_ERROR');
  return error;
}

function classifyD7E4A1Error_(error) {
  const code = String(error && (error.code || error.message) || 'UNKNOWN_READ_ERROR');
  return code.replace(/[^A-Z0-9_]/gi, '_').toUpperCase().slice(0, 120);
}

function indexD7E4A1Status_(error) {
  const status = String(error && error.firestoreErrorStatus || '');
  return status === 'FAILED_PRECONDITION' ? 'INDEX_REQUIRED_OR_UNAVAILABLE' : 'NOT_REQUIRED_OR_NOT_DETERMINED';
}

function normalizeD7E4A1Documents_(documents) {
  if (!Array.isArray(documents) || documents.length > D7_E4A1_QUERY_LIMIT_) throw d7e4a1Error_('FIRESTORE_QUERY_RESPONSE_BOUND_VIOLATION');
  const seenReferences = {};
  return documents.map(function cloneDocument(document) {
    return JSON.parse(JSON.stringify(document || {}));
  }).filter(function deduplicateDocument(document) {
    const reference = String(document.__d7e4a1Reference || '');
    if (!reference) return true;
    if (seenReferences[reference]) return false;
    seenReferences[reference] = true;
    return true;
  });
}

function boundedD7E4A1Count_(count) {
  const number = Number(count || 0);
  return number >= D7_E4A1_QUERY_LIMIT_ ? '2_PLUS' : number;
}

function normalizeD7E4A1Sha256_(value) {
  const text = String(value || '').trim().toLowerCase();
  return /^[a-f0-9]{64}$/.test(text) ? text : '';
}

function durableD7E4A1HashPrefix_(value) {
  const text = String(value || '');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ('00000000' + (hash >>> 0).toString(16)).slice(-8);
}

function decodeD7E4A1FirestoreDocument_(document) {
  const fields = document && document.fields || {};
  const decoded = {};
  const reference = String(document && document.name || '');
  if (reference) decoded.__d7e4a1Reference = reference;
  Object.keys(fields).forEach(function decodeField(key) { decoded[key] = decodeD7E4A1FirestoreValue_(fields[key]); });
  return decoded;
}

function decodeD7E4A1FirestoreValue_(value) {
  const source = value || {};
  if (Object.prototype.hasOwnProperty.call(source, 'stringValue')) return String(source.stringValue);
  if (Object.prototype.hasOwnProperty.call(source, 'integerValue')) return Number(source.integerValue);
  if (Object.prototype.hasOwnProperty.call(source, 'doubleValue')) return Number(source.doubleValue);
  if (Object.prototype.hasOwnProperty.call(source, 'booleanValue')) return source.booleanValue === true;
  if (source.mapValue) {
    const map = {};
    Object.keys(source.mapValue.fields || {}).forEach(function decodeMapField(key) { map[key] = decodeD7E4A1FirestoreValue_(source.mapValue.fields[key]); });
    return map;
  }
  if (source.arrayValue) return (source.arrayValue.values || []).map(decodeD7E4A1FirestoreValue_);
  return null;
}

function safeD7E4A1Call_(fn) {
  try { return fn(); } catch (error) { return { __D7_E4A1_CONFIGURATION_READ_ERROR__: classifyD7E4A1Error_(error) }; }
}

function sanitizeD7E4A1Result_(result) {
  return JSON.parse(JSON.stringify(result));
}
