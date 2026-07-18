const SGDS_ADAPTER_ERROR_CODES_ = Object.freeze({
  AUTH: 'adapter_auth_error',
  PERMISSION: 'adapter_permission_error',
  NOT_FOUND: 'adapter_not_found',
  RATE_LIMITED: 'adapter_rate_limited',
  TRANSIENT: 'adapter_transient_error',
  CONTRACT: 'adapter_contract_error',
  CONFLICT: 'adapter_conflict',
  IDEMPOTENT_REPLAY: 'adapter_idempotent_replay'
});

const SGDS_ADAPTER_RETRY_CLASSES_ = Object.freeze({
  RETRYABLE: 'retryable',
  NON_RETRYABLE: 'non-retryable',
  REVIEW_REQUIRED: 'review-required',
  IDEMPOTENT_SUCCESS: 'idempotent-success'
});

function createSgdsAdapterError_(code, safeMessage, details) {
  const normalized = normalizeSgdsAdapterErrorCode_(code);
  const error = new Error(normalized + ':' + safeSgdsAdapterString_(safeMessage || normalized));
  error.code = normalized;
  error.retryClass = classifySgdsAdapterRetry_(normalized);
  error.safeDetails = cloneSgdsAdapterJson_(details || {});
  return error;
}

function normalizeSgdsAdapterError_(error) {
  if (!error) return createSgdsAdapterError_(SGDS_ADAPTER_ERROR_CODES_.CONTRACT, 'unknown adapter error');
  const code = normalizeSgdsAdapterErrorCode_(error.code || error.status || error.message);
  return {
    code,
    retryClass: classifySgdsAdapterRetry_(code),
    safeMessage: sanitizeSgdsAdapterLogText_(error.safeMessage || error.message || code),
    safeDetails: cloneSgdsAdapterJson_(error.safeDetails || {})
  };
}

function normalizeSgdsAdapterErrorCode_(code) {
  const raw = safeSgdsAdapterString_(code).toLowerCase();
  if (raw.includes('auth') || raw === '401') return SGDS_ADAPTER_ERROR_CODES_.AUTH;
  if (raw.includes('permission') || raw === '403') return SGDS_ADAPTER_ERROR_CODES_.PERMISSION;
  if (raw.includes('not_found') || raw.includes('missing') || raw === '404') return SGDS_ADAPTER_ERROR_CODES_.NOT_FOUND;
  if (raw.includes('rate') || raw === '429') return SGDS_ADAPTER_ERROR_CODES_.RATE_LIMITED;
  if (raw.includes('transient') || raw.includes('temporary') || raw === '408' || raw === '500' || raw === '502' || raw === '503' || raw === '504') return SGDS_ADAPTER_ERROR_CODES_.TRANSIENT;
  if (raw.includes('conflict') || raw === '409') return SGDS_ADAPTER_ERROR_CODES_.CONFLICT;
  if (raw.includes('idempotent')) return SGDS_ADAPTER_ERROR_CODES_.IDEMPOTENT_REPLAY;
  return SGDS_ADAPTER_ERROR_CODES_.CONTRACT;
}

function classifySgdsAdapterRetry_(code) {
  const normalized = normalizeSgdsAdapterErrorCodeNoRecurse_(code);
  if (normalized === SGDS_ADAPTER_ERROR_CODES_.RATE_LIMITED || normalized === SGDS_ADAPTER_ERROR_CODES_.TRANSIENT) {
    return SGDS_ADAPTER_RETRY_CLASSES_.RETRYABLE;
  }
  if (normalized === SGDS_ADAPTER_ERROR_CODES_.CONFLICT || normalized === SGDS_ADAPTER_ERROR_CODES_.CONTRACT) {
    return SGDS_ADAPTER_RETRY_CLASSES_.REVIEW_REQUIRED;
  }
  if (normalized === SGDS_ADAPTER_ERROR_CODES_.IDEMPOTENT_REPLAY) {
    return SGDS_ADAPTER_RETRY_CLASSES_.IDEMPOTENT_SUCCESS;
  }
  return SGDS_ADAPTER_RETRY_CLASSES_.NON_RETRYABLE;
}

function normalizeSgdsAdapterErrorCodeNoRecurse_(code) {
  const raw = safeSgdsAdapterString_(code);
  return Object.keys(SGDS_ADAPTER_ERROR_CODES_).map(key => SGDS_ADAPTER_ERROR_CODES_[key]).includes(raw)
    ? raw
    : normalizeSgdsAdapterErrorCode_(raw);
}

function sanitizeSgdsAdapterLogText_(value) {
  let text = safeSgdsAdapterString_(value);
  [
    'Authorization',
    'Bearer ',
    ['ya29', '.'].join(''),
    ['access', 'token'].join('_'),
    ['refresh', 'token'].join('_'),
    ['private', 'key'].join('_'),
    ['client', 'secret'].join('_')
  ].forEach(token => {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = text.replace(new RegExp(escaped + '[^\\s,;)]*', 'gi'), 'REDACTED');
  });
  return text.length > 180 ? text.slice(0, 180) + '...' : text;
}

function requireSgdsAdapterMethod_(adapter, adapterName, methods) {
  if (!adapter || typeof adapter !== 'object') throw createSgdsAdapterError_(SGDS_ADAPTER_ERROR_CODES_.CONTRACT, adapterName + ' required');
  methods.forEach(method => {
    if (typeof adapter[method] !== 'function') {
      throw createSgdsAdapterError_(SGDS_ADAPTER_ERROR_CODES_.CONTRACT, adapterName + '.' + method + ' required');
    }
  });
  return adapter;
}

function cloneSgdsAdapterJson_(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function safeSgdsAdapterString_(value) {
  return value == null ? '' : String(value);
}
