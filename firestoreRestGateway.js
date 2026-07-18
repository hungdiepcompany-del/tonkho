const SGDS_FIRESTORE_REST_RETRY_STATUS_CODES_ = Object.freeze([408, 429, 500, 502, 503, 504]);
const SGDS_FIRESTORE_REST_FORBIDDEN_ERROR_TEXT_ = Object.freeze([
  'Authorization',
  'Bearer ',
  ['ya29', '.'].join(''),
  ['access', 'token'].join('_'),
  ['refresh', 'token'].join('_'),
  ['private', 'key'].join('_'),
  ['client', 'secret'].join('_')
]);

function createFirestoreValueCodec_() {
  function encode(value) {
    if (value === null || value === undefined) return { nullValue: 'NULL_VALUE' };
    if (typeof value === 'boolean') return { booleanValue: value };
    if (typeof value === 'number') {
      if (Number.isInteger(value) && Number.isSafeInteger(value)) return { integerValue: String(value) };
      if (Number.isFinite(value)) return { doubleValue: value };
      throw firestoreGatewayError_('FIRESTORE_VALUE_UNSUPPORTED');
    }
    if (typeof value === 'string') {
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:[.]\d{3})?Z$/.test(value)) return { timestampValue: value };
      return { stringValue: value };
    }
    if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
    if (value && typeof value === 'object') {
      const fields = {};
      Object.keys(value).sort().forEach(key => {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') throw firestoreGatewayError_('FIRESTORE_VALUE_FORBIDDEN_KEY');
        fields[key] = encode(value[key]);
      });
      return { mapValue: { fields } };
    }
    throw firestoreGatewayError_('FIRESTORE_VALUE_UNSUPPORTED');
  }

  function decode(value) {
    const source = value || {};
    if (Object.prototype.hasOwnProperty.call(source, 'nullValue')) return null;
    if (Object.prototype.hasOwnProperty.call(source, 'booleanValue')) return Boolean(source.booleanValue);
    if (Object.prototype.hasOwnProperty.call(source, 'integerValue')) return Number(source.integerValue);
    if (Object.prototype.hasOwnProperty.call(source, 'doubleValue')) return Number(source.doubleValue);
    if (Object.prototype.hasOwnProperty.call(source, 'stringValue')) return String(source.stringValue);
    if (Object.prototype.hasOwnProperty.call(source, 'timestampValue')) return String(source.timestampValue);
    if (Object.prototype.hasOwnProperty.call(source, 'arrayValue')) return ((source.arrayValue && source.arrayValue.values) || []).map(decode);
    if (Object.prototype.hasOwnProperty.call(source, 'mapValue')) {
      const out = {};
      const fields = (source.mapValue && source.mapValue.fields) || {};
      Object.keys(fields).sort().forEach(key => {
        out[key] = decode(fields[key]);
      });
      return out;
    }
    throw firestoreGatewayError_('FIRESTORE_VALUE_UNKNOWN_TYPE');
  }

  function encodeDocument(fields) {
    const out = {};
    Object.keys(fields || {}).sort().forEach(key => {
      out[key] = encode(fields[key]);
    });
    return { fields: out };
  }

  function decodeDocument(document) {
    const fields = document && document.fields ? document.fields : {};
    const out = {};
    Object.keys(fields).sort().forEach(key => {
      out[key] = decode(fields[key]);
    });
    return out;
  }

  return Object.freeze({ encode, decode, encodeDocument, decodeDocument });
}

function createFirestorePathValidator_(options) {
  const opts = options || {};
  const allowedCollections = opts.allowedCollections || SGDS_D6_COLLECTIONS_;
  const fieldAllowlists = opts.fieldAllowlists || SGDS_D6_COLLECTION_FIELD_ALLOWLIST_;

  function validateCollection(collection) {
    const value = safeFirestoreGatewayString_(collection);
    if (!allowedCollections.includes(value)) throw firestoreGatewayError_('FIRESTORE_COLLECTION_NOT_ALLOWED');
    return value;
  }

  function validateDocumentPath(path) {
    const value = safeFirestoreGatewayString_(path);
    if (!value || value.includes('//') || value.startsWith('/') || value.endsWith('/')) throw firestoreGatewayError_('FIRESTORE_PATH_INVALID');
    if (/[?#\\]/.test(value)) throw firestoreGatewayError_('FIRESTORE_PATH_INVALID');
    const parts = value.split('/');
    if (parts.length !== 2) throw firestoreGatewayError_('FIRESTORE_PATH_DEPTH_UNSUPPORTED');
    const collection = validateCollection(parts[0]);
    if (!/^[A-Za-z0-9._:-]{1,160}$/.test(parts[1])) throw firestoreGatewayError_('FIRESTORE_DOCUMENT_ID_INVALID');
    return { collection, documentId: parts[1], path: value };
  }

  function validateUpdateMask(collection, mask) {
    const safeCollection = validateCollection(collection);
    const fields = Array.isArray(mask) ? mask.slice() : [];
    if (!fields.length) throw firestoreGatewayError_('FIRESTORE_UPDATE_MASK_REQUIRED');
    const allowed = fieldAllowlists[safeCollection] || [];
    const immutable = ['jobId', 'schemaVersion', 'createdAt', 'gmailMessageId', 'threadId'];
    fields.forEach(field => {
      if (immutable.includes(field)) throw firestoreGatewayError_('FIRESTORE_UPDATE_MASK_UNSAFE');
      if (!allowed.includes(field) || /[*[\]`]/.test(field)) throw firestoreGatewayError_('FIRESTORE_UPDATE_MASK_UNSAFE');
    });
    return fields.sort();
  }

  return Object.freeze({ validateCollection, validateDocumentPath, validateUpdateMask });
}

function createFirestoreRetryPolicy_(options) {
  const opts = options || {};
  const maxAttempts = Math.max(1, Number(opts.maxAttempts || 3));
  const baseDelayMs = Math.max(0, Number(opts.baseDelayMs || 25));
  const retryStatusCodes = opts.retryStatusCodes || SGDS_FIRESTORE_REST_RETRY_STATUS_CODES_;
  const delay = typeof opts.delay === 'function' ? opts.delay : async () => {};
  const jitter = typeof opts.jitter === 'function' ? opts.jitter : attempt => attempt;

  function isRetryableStatus(status) {
    return retryStatusCodes.includes(Number(status));
  }

  async function run(operation) {
    let lastError = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await operation({ attempt, maxAttempts });
      } catch (error) {
        lastError = error;
        if (!error || !isRetryableStatus(error.status) || attempt >= maxAttempts) throw error;
        await delay(baseDelayMs * Math.pow(2, attempt - 1) + Number(jitter(attempt) || 0));
      }
    }
    throw lastError || firestoreGatewayError_('FIRESTORE_RETRY_EXHAUSTED');
  }

  return Object.freeze({ maxAttempts, isRetryableStatus, run });
}

function createFirestoreErrorMapper_() {
  function redact(value) {
    let text = safeFirestoreGatewayString_(value);
    SGDS_FIRESTORE_REST_FORBIDDEN_ERROR_TEXT_.forEach(token => {
      const pattern = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      text = text.replace(new RegExp(pattern + '[^\\s,;)]*', 'gi'), 'REDACTED');
    });
    if (text.length > 180) text = text.slice(0, 180) + '...';
    return text;
  }

  function mapHttpError(response, context) {
    const status = Number(response && response.status);
    const error = firestoreGatewayError_('FIRESTORE_HTTP_' + status);
    error.status = status;
    error.operation = safeFirestoreGatewayString_(context && context.operation);
    error.safeMessage = redact((response && response.body) || (response && response.statusText) || '');
    error.message = error.code + ':' + error.safeMessage;
    return error;
  }

  return Object.freeze({ redact, mapHttpError });
}

function createFirestoreClient_(options) {
  const opts = options || {};
  const projectId = safeFirestoreGatewayString_(opts.projectId);
  const databaseId = safeFirestoreGatewayString_(opts.databaseId || '(default)');
  if (!projectId) throw firestoreGatewayError_('FIRESTORE_PROJECT_ID_REQUIRED');
  if (!databaseId) throw firestoreGatewayError_('FIRESTORE_DATABASE_ID_REQUIRED');
  const codec = opts.codec || createFirestoreValueCodec_();
  const pathValidator = opts.pathValidator || createFirestorePathValidator_(opts);
  const retryPolicy = opts.retryPolicy || createFirestoreRetryPolicy_(opts.retry || {});
  const errorMapper = opts.errorMapper || createFirestoreErrorMapper_();
  const httpTransport = requireFirestoreGatewayFunction_(opts.httpTransport, 'httpTransport');
  const accessTokenProvider = opts.accessTokenProvider || (async () => '');
  const baseUrl = safeFirestoreGatewayString_(opts.baseUrl || ('https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(projectId) + '/databases/' + encodeURIComponent(databaseId) + '/documents'));

  async function request(method, path, body, requestOptions) {
    const reqOpts = requestOptions || {};
    const safePath = pathValidator.validateDocumentPath(path);
    if ((method === 'POST' || method === 'PATCH') && !safeFirestoreGatewayString_(reqOpts.idempotencyKey)) {
      throw firestoreGatewayError_('FIRESTORE_IDEMPOTENCY_KEY_REQUIRED');
    }
    const token = await accessTokenProvider();
    const headers = {
      'Content-Type': 'application/json',
      'X-SGDS-Idempotency-Key': safeFirestoreGatewayString_(reqOpts.idempotencyKey)
    };
    if (token) headers.Authorization = 'Bearer ' + token;
    const url = baseUrl.replace(/\/$/, '') + '/' + encodeURIComponent(safePath.collection) + '/' + encodeURIComponent(safePath.documentId) + buildQuery_(reqOpts.query || {});
    return retryPolicy.run(async () => {
      const response = await httpTransport({ method, url, headers, body: body ? JSON.stringify(body) : null, timeoutMs: Number(reqOpts.timeoutMs || 30000) });
      const status = Number(response && response.status);
      if (status >= 200 && status < 300) return parseFirestoreGatewayJson_(response && response.body);
      throw errorMapper.mapHttpError(response, { operation: method, path });
    });
  }

  async function getDocument(path) {
    const doc = await request('GET', path, null, {});
    return codec.decodeDocument(doc);
  }

  async function createDocument(path, data, options2) {
    const safePath = pathValidator.validateDocumentPath(path);
    const query = { documentId: safePath.documentId };
    const created = await request('POST', safePath.collection + '/' + safePath.documentId, codec.encodeDocument(data || {}), { ...(options2 || {}), query });
    return codec.decodeDocument(created);
  }

  async function patchDocument(path, data, updateMask, options2) {
    const safePath = pathValidator.validateDocumentPath(path);
    const mask = pathValidator.validateUpdateMask(safePath.collection, updateMask);
    const query = {};
    mask.forEach((field, index) => {
      query['updateMask.fieldPaths.' + index] = field;
    });
    const patched = await request('PATCH', path, codec.encodeDocument(data || {}), { ...(options2 || {}), query });
    return codec.decodeDocument(patched);
  }

  async function deleteDocument(path, options2) {
    if (!options2 || options2.allowDelete !== true) throw firestoreGatewayError_('FIRESTORE_DELETE_FORBIDDEN');
    await request('DELETE', path, null, options2);
    return { deleted: true };
  }

  async function queryCollection(collection, options2) {
    pathValidator.validateCollection(collection);
    const opts2 = options2 || {};
    if (!opts2.safeQueryName) throw firestoreGatewayError_('FIRESTORE_SAFE_QUERY_NAME_REQUIRED');
    const response = await opts.collectionQueryTransport({ collection, options: opts2 });
    return Array.isArray(response) ? response.slice() : [];
  }

  return Object.freeze({ getDocument, createDocument, patchDocument, deleteDocument, queryCollection, buildBaseUrl: () => baseUrl });
}

function createSgdsJobRepository_(client, options) {
  const clock = (options && options.clock) || { now: () => new Date().toISOString() };

  async function createJob(job) {
    assertSgdsD6RequiredJobFields_(job);
    return client.createDocument('jobs/' + job.jobId, job, { idempotencyKey: job.idempotencyKey });
  }

  async function getJob(jobId) {
    return client.getDocument('jobs/' + safeFirestoreGatewayString_(jobId));
  }

  async function transitionJob(request) {
    const req = request || {};
    if (!safeFirestoreGatewayString_(req.idempotencyKey)) throw firestoreGatewayError_('FIRESTORE_IDEMPOTENCY_KEY_REQUIRED');
    assertSgdsD6JobTransition_(req.fromStatus, req.toStatus);
    return client.patchDocument('jobs/' + req.jobId, {
      status: req.toStatus,
      currentStep: req.currentStep || req.toStatus,
      updatedAt: clock.now(),
      completedAt: req.toStatus === 'completed' ? clock.now() : null,
      idempotencyKey: req.idempotencyKey
    }, ['status', 'currentStep', 'updatedAt', 'completedAt', 'idempotencyKey'], { idempotencyKey: req.idempotencyKey });
  }

  return Object.freeze({ createJob, getJob, transitionJob });
}

function createSgdsAuditRepository_(client) {
  async function appendEvent(event) {
    const source = event || {};
    if (!source.eventId || !source.jobId || !source.idempotencyKey) throw firestoreGatewayError_('FIRESTORE_AUDIT_EVENT_REQUIRED');
    return client.createDocument('audit_events/' + source.eventId, source, { idempotencyKey: source.idempotencyKey });
  }
  return Object.freeze({ appendEvent });
}

function createSgdsLeaseRepository_(client, options) {
  const clock = (options && options.clock) || { now: () => new Date().toISOString() };

  async function acquireLease(request) {
    const req = request || {};
    if (!req.leaseId || !req.leaseOwner || !req.idempotencyKey) throw firestoreGatewayError_('FIRESTORE_LEASE_REQUEST_REQUIRED');
    return client.createDocument('worker_leases/' + req.leaseId, {
      schemaVersion: SGDS_D6_SCHEMA_VERSION_,
      leaseId: req.leaseId,
      jobId: req.jobId || '',
      leaseOwner: req.leaseOwner,
      leaseExpiresAt: req.leaseExpiresAt,
      renewedAt: clock.now(),
      fencingToken: req.fencingToken || req.idempotencyKey,
      createdAt: clock.now(),
      updatedAt: clock.now()
    }, { idempotencyKey: req.idempotencyKey });
  }

  async function renewLease(request) {
    const req = request || {};
    if (!req.leaseId || !req.idempotencyKey) throw firestoreGatewayError_('FIRESTORE_LEASE_REQUEST_REQUIRED');
    return client.patchDocument('worker_leases/' + req.leaseId, {
      leaseExpiresAt: req.leaseExpiresAt,
      renewedAt: clock.now(),
      updatedAt: clock.now()
    }, ['leaseExpiresAt', 'renewedAt', 'updatedAt'], { idempotencyKey: req.idempotencyKey });
  }

  return Object.freeze({ acquireLease, renewLease });
}

function createSgdsCommandRepository_(client) {
  async function createCommand(command) {
    const source = command || {};
    if (!source.commandId || !source.idempotencyKey) throw firestoreGatewayError_('FIRESTORE_COMMAND_REQUIRED');
    return client.createDocument('commands/' + source.commandId, source, { idempotencyKey: source.idempotencyKey });
  }
  return Object.freeze({ createCommand });
}

function createSgdsFirestoreGateway_(options) {
  const client = createFirestoreClient_(options || {});
  return Object.freeze({
    client,
    jobs: createSgdsJobRepository_(client, options || {}),
    audit: createSgdsAuditRepository_(client),
    leases: createSgdsLeaseRepository_(client, options || {}),
    commands: createSgdsCommandRepository_(client)
  });
}

function parseFirestoreGatewayJson_(body) {
  if (!body) return {};
  if (typeof body === 'object') return body;
  return JSON.parse(String(body));
}

function buildQuery_(query) {
  const keys = Object.keys(query || {}).sort();
  if (!keys.length) return '';
  return '?' + keys.map(key => encodeURIComponent(key.replace(/[.]\d+$/, '')) + '=' + encodeURIComponent(query[key])).join('&');
}

function requireFirestoreGatewayFunction_(value, name) {
  if (typeof value !== 'function') throw firestoreGatewayError_('FIRESTORE_GATEWAY_DEPENDENCY_REQUIRED:' + name);
  return value;
}

function safeFirestoreGatewayString_(value) {
  return value == null ? '' : String(value).trim();
}

function firestoreGatewayError_(code) {
  const error = new Error(String(code));
  error.code = String(code).split(':')[0];
  return error;
}
