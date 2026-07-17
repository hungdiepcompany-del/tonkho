const SGDS_CLOUD_RUN_SHADOW_FEATURE_DEFAULT_ = false;
const SGDS_CLOUD_RUN_SHADOW_SCHEMA_VERSION_ = 1;
const SGDS_CLOUD_RUN_SHADOW_MODE_ = 'shadow';
const SGDS_CLOUD_RUN_SHADOW_MAX_CANDIDATES_ = 1;
const SGDS_CLOUD_RUN_SHADOW_TIMEOUT_MS_ = 30000;

function sgdsIsCloudRunShadowEnabled_(properties) {
  const source = properties || (typeof PropertiesService !== 'undefined'
    ? PropertiesService.getScriptProperties().getProperties()
    : {});
  return String(source.SGDS_CLOUD_RUN_SHADOW_ENABLED || SGDS_CLOUD_RUN_SHADOW_FEATURE_DEFAULT_).toLowerCase() === 'true';
}

function sgdsBuildCloudRunShadowRequest_(candidate, options) {
  const opts = options || {};
  const safeCandidate = sgdsValidateCloudRunShadowCandidate_(candidate);
  return {
    schemaVersion: SGDS_CLOUD_RUN_SHADOW_SCHEMA_VERSION_,
    requestId: String(opts.requestId || ('sgds-shadow-' + safeCandidate.sourceIdentityHash.slice(0, 16))),
    mode: SGDS_CLOUD_RUN_SHADOW_MODE_,
    candidate: safeCandidate,
    canonicalWriteAllowed: false,
    gmailMutationAllowed: false,
    driveMutationAllowed: false,
    sheetsMutationAllowed: false
  };
}

function sgdsBuildCloudRunShadowFetchRequest_(candidate, options) {
  const opts = options || {};
  const url = String(opts.url || 'https://sgds-durable-orchestrator.run.app/v1/shadow/plan');
  const payload = sgdsBuildCloudRunShadowRequest_(candidate, opts);
  const headers = {
    'Content-Type': 'application/json',
    'X-SGDS-Request-Id': payload.requestId
  };
  if (opts.identityToken) headers.Authorization = 'Bearer ' + String(opts.identityToken);
  return {
    url,
    params: {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      headers,
      muteHttpExceptions: true,
      followRedirects: false,
      timeout: SGDS_CLOUD_RUN_SHADOW_TIMEOUT_MS_
    },
    safeInspection: {
      method: 'post',
      contentType: 'application/json',
      hasAuthorizationHeader: Boolean(opts.identityToken),
      payload,
      timeout: SGDS_CLOUD_RUN_SHADOW_TIMEOUT_MS_
    }
  };
}

function sgdsCallCloudRunShadowOrchestrator_(candidate, options) {
  const opts = options || {};
  if (!sgdsIsCloudRunShadowEnabled_(opts.properties)) {
    return {
      status: 'FEATURE_DISABLED',
      httpCallCount: 0,
      canonicalSideEffectAllowed: false
    };
  }
  if (Array.isArray(candidate)) throw new Error('SGDS_CLOUD_RUN_SHADOW_ONE_CANDIDATE_REQUIRED');
  if (typeof ScriptApp === 'undefined' || typeof ScriptApp.getIdentityToken !== 'function') {
    throw new Error('SGDS_CLOUD_RUN_IDENTITY_TOKEN_UNAVAILABLE');
  }
  const identityToken = ScriptApp.getIdentityToken();
  if (!identityToken) throw new Error('SGDS_CLOUD_RUN_IDENTITY_TOKEN_UNAVAILABLE');
  if (typeof UrlFetchApp === 'undefined' || typeof UrlFetchApp.fetch !== 'function') {
    throw new Error('SGDS_CLOUD_RUN_URLFETCH_UNAVAILABLE');
  }
  const request = sgdsBuildCloudRunShadowFetchRequest_(candidate, {
    ...opts,
    identityToken
  });
  const response = UrlFetchApp.fetch(request.url, request.params);
  const statusCode = Number(response.getResponseCode());
  const body = JSON.parse(response.getContentText() || '{}');
  if (statusCode < 200 || statusCode >= 300) throw new Error('SGDS_CLOUD_RUN_HTTP_' + statusCode);
  if (!body || body.ok !== true) throw new Error('SGDS_CLOUD_RUN_RESPONSE_INVALID');
  return {
    status: 'SHADOW_CALL_ACCEPTED',
    httpCallCount: 1,
    response: body,
    canonicalSideEffectAllowed: false
  };
}

function sgdsInspectCloudRunOidcIdentityToken_() {
  if (typeof ScriptApp === 'undefined' || typeof ScriptApp.getIdentityToken !== 'function') {
    throw new Error('SGDS_CLOUD_RUN_IDENTITY_TOKEN_UNAVAILABLE');
  }
  const identityToken = ScriptApp.getIdentityToken();
  const parts = String(identityToken || '').split('.');
  if (parts.length < 2) throw new Error('SGDS_CLOUD_RUN_IDENTITY_TOKEN_INVALID');
  const payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[1])).getDataAsString());
  return {
    aud: String(payload.aud || ''),
    iss: String(payload.iss || ''),
    email: String(payload.email || ''),
    exp: Number(payload.exp || 0)
  };
}

function sgdsValidateCloudRunShadowCandidate_(candidate) {
  if (Array.isArray(candidate)) throw new Error('SGDS_CLOUD_RUN_SHADOW_ONE_CANDIDATE_REQUIRED');
  const source = candidate || {};
  const sourceType = String(source.sourceType || '').toLowerCase();
  if (['gmail', 'drive'].indexOf(sourceType) < 0) throw new Error('SGDS_CLOUD_RUN_SHADOW_SOURCE_TYPE_INVALID');
  const sourceIdentityHash = sgdsValidateCloudRunSha256_(source.sourceIdentityHash, 'SOURCE_IDENTITY_HASH');
  const contentIdentityHash = source.contentIdentityHash
    ? sgdsValidateCloudRunSha256_(source.contentIdentityHash, 'CONTENT_IDENTITY_HASH')
    : '';
  return {
    sourceType,
    sourceIdentityHash,
    contentIdentityHash,
    scannerVersion: String(source.scannerVersion || 'unknown-scanner').slice(0, 64),
    receivedAt: String(source.receivedAt || new Date(0).toISOString()),
    safeMetadata: source.safeMetadata || {}
  };
}

function sgdsValidateCloudRunSha256_(value, label) {
  const text = String(value || '').toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(text)) throw new Error('SGDS_CLOUD_RUN_' + label + '_INVALID');
  return text;
}
