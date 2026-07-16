const SGDS_DURABLE_SHADOW_DEFAULTS_ = Object.freeze({
  SGDS_DURABLE_SHADOW_ENABLED: false,
  SGDS_DURABLE_SHADOW_MAX_CANDIDATES: 1,
  SGDS_DURABLE_SHADOW_CANONICAL_WRITES: false,
  SGDS_DURABLE_SHADOW_GMAIL_MUTATIONS: false,
  SGDS_DURABLE_SHADOW_DRIVE_MUTATIONS: false
});

const SGDS_DURABLE_SHADOW_WIRING_POINT_ = 'AFTER_CANDIDATE_DETECTED_BEFORE_CANONICAL_EFFECTS';

function createDurableScannerShadowBridge(options) {
  const opts = options || {};
  const config = resolveDurableShadowConfig_(opts.env || opts.config || {});
  const shadowRunner = opts.shadowRunner || null;
  let evaluatedCount = 0;

  function evaluateScannerCandidate(context) {
    if (!config.enabled) {
      return durableShadowDecision_('DURABLE_SHADOW_DISABLED', true, {
        featureDefault: false,
        durableCallCount: 0
      });
    }
    if (config.canonicalWrites || config.gmailMutations || config.driveMutations) {
      return durableShadowDecision_('DURABLE_SHADOW_MUTATION_GATE_REJECTED', false, {
        durableCallCount: 0
      });
    }
    if (evaluatedCount >= config.maxCandidates) {
      return durableShadowDecision_('DURABLE_SHADOW_MAX_CANDIDATES_REACHED', false, {
        durableCallCount: 0
      });
    }
    if (!shadowRunner || typeof shadowRunner.evaluateShadowCandidate !== 'function') {
      return durableShadowDecision_('DURABLE_SHADOW_RUNTIME_NOT_CONFIGURED', false, {
        durableCallCount: 0
      });
    }
    evaluatedCount += 1;
    const candidate = buildDurableShadowCandidateFromScannerContext_(context);
    try {
      const result = shadowRunner.evaluateShadowCandidate(candidate);
      if (result && typeof result.then === 'function') {
        return result.then(resolved => durableShadowDecisionFromRunner_(resolved, candidate)).catch(error => durableShadowDecision_('DURABLE_SHADOW_FAILED_CANONICAL_BLOCKED', false, {
          durableCallCount: 1,
          errorCode: d5oErrorCode_(error),
          mutationAttemptCount: 0
        }));
      }
      return durableShadowDecisionFromRunner_(result, candidate);
    } catch (error) {
      return durableShadowDecision_('DURABLE_SHADOW_FAILED_CANONICAL_BLOCKED', false, {
        durableCallCount: 1,
        errorCode: d5oErrorCode_(error),
        mutationAttemptCount: 0
      });
    }
  }

  function durableShadowDecisionFromRunner_(result, candidate) {
    const status = safeD5OString_(result && (result.status || result.shadowEvaluationStatus));
    const pass = ['SHADOW_READY', 'SHADOW_ALREADY_SEEN', 'READY'].includes(status);
    return durableShadowDecision_(pass ? 'DURABLE_SHADOW_READY' : 'DURABLE_SHADOW_REVIEW_REQUIRED', pass, {
        durableCallCount: 1,
        candidate,
        jobId: safeD5OString_(result && result.jobId),
        idempotencyKey: buildDurableShadowIdempotencyKey_(candidate),
        runnerStatus: status,
        mutationAttemptCount: Number(result && result.mutationAttemptCount || 0)
      });
  }

  return Object.freeze({
    evaluateScannerCandidate,
    getConfig() {
      return cloneD5OJson_(config);
    },
    getEvaluatedCount() {
      return evaluatedCount;
    }
  });
}

function maybeEvaluateDurableScannerShadow_(scannerContext, options) {
  const bridge = options && options.bridge
    ? options.bridge
    : createDurableScannerShadowBridge(options || {});
  const result = bridge.evaluateScannerCandidate(scannerContext || {});
  if (result && typeof result.then === 'function') {
    throw new Error('DURABLE_SHADOW_ASYNC_BRIDGE_NOT_SUPPORTED_IN_LEGACY_SCANNER');
  }
  return result;
}

function resolveDurableShadowConfig_(env) {
  const source = env || {};
  const enabled = readD5OBoolean_(source.SGDS_DURABLE_SHADOW_ENABLED, SGDS_DURABLE_SHADOW_DEFAULTS_.SGDS_DURABLE_SHADOW_ENABLED);
  const maxCandidates = Math.max(1, Number(source.SGDS_DURABLE_SHADOW_MAX_CANDIDATES || SGDS_DURABLE_SHADOW_DEFAULTS_.SGDS_DURABLE_SHADOW_MAX_CANDIDATES));
  const canonicalWrites = readD5OBoolean_(source.SGDS_DURABLE_SHADOW_CANONICAL_WRITES, SGDS_DURABLE_SHADOW_DEFAULTS_.SGDS_DURABLE_SHADOW_CANONICAL_WRITES);
  const gmailMutations = readD5OBoolean_(source.SGDS_DURABLE_SHADOW_GMAIL_MUTATIONS, SGDS_DURABLE_SHADOW_DEFAULTS_.SGDS_DURABLE_SHADOW_GMAIL_MUTATIONS);
  const driveMutations = readD5OBoolean_(source.SGDS_DURABLE_SHADOW_DRIVE_MUTATIONS, SGDS_DURABLE_SHADOW_DEFAULTS_.SGDS_DURABLE_SHADOW_DRIVE_MUTATIONS);
  return Object.freeze({
    enabled,
    maxCandidates,
    canonicalWrites,
    gmailMutations,
    driveMutations,
    wiringPoint: SGDS_DURABLE_SHADOW_WIRING_POINT_,
    defaultEnabled: false
  });
}

function buildDurableShadowCandidateFromScannerContext_(context) {
  const source = context || {};
  const sourceType = safeD5OCode_(source.sourceType || 'GMAIL');
  const direction = safeD5OCode_(source.direction || '');
  const threadReference = safeD5OString_(source.threadReference || getD5OThreadReference_(source.thread));
  const attachmentSummary = summarizeD5OAttachments_(source.attachments || []);
  const sourceReferenceHash = hashD5OString_([
    sourceType,
    direction,
    threadReference,
    attachmentSummary.xmlCount,
    attachmentSummary.pdfCount
  ].join('|'));
  return {
    sourceType,
    sourceReferenceHash,
    discoveredAt: safeD5OString_(source.discoveredAt || 'SCANNER_SHADOW_DISCOVERY'),
    attachmentSummary,
    safeMetadata: {
      direction,
      phase: SGDS_DURABLE_SHADOW_WIRING_POINT_,
      rawReferenceCaptured: false,
      canonicalWrites: false,
      gmailMutations: false,
      driveMutations: false
    }
  };
}

function durableShadowDecision_(status, canonicalProcessingAllowed, details) {
  const safe = details || {};
  return {
    status,
    canonicalProcessingAllowed: canonicalProcessingAllowed === true,
    scannerRunStopsBeforeCanonicalEffects: canonicalProcessingAllowed !== true,
    shadowMode: 'SHADOW',
    featureDefault: Boolean(safe.featureDefault),
    durableCallCount: Number(safe.durableCallCount || 0),
    jobId: safeD5OString_(safe.jobId || ''),
    idempotencyKey: safeD5OString_(safe.idempotencyKey || ''),
    runnerStatus: safeD5OString_(safe.runnerStatus || ''),
    mutationAttemptCount: Number(safe.mutationAttemptCount || 0),
    errorCode: safeD5OString_(safe.errorCode || ''),
    candidate: sanitizeD5ODetails_(safe.candidate || null),
    googleSheetsMutation: 'NONE',
    gmailMessageMutation: 'NONE',
    gmailLabelMutation: 'NONE',
    googleDriveMutation: 'NONE'
  };
}

function buildDurableShadowIdempotencyKey_(candidate) {
  return hashD5OString_([
    candidate && candidate.sourceType,
    candidate && candidate.sourceReferenceHash,
    SGDS_DURABLE_SHADOW_WIRING_POINT_
  ].join('|'));
}

function getD5OThreadReference_(thread) {
  try {
    if (thread && typeof thread.getId === 'function') return thread.getId();
  } catch (_error) {
    return '';
  }
  return '';
}

function summarizeD5OAttachments_(attachments) {
  const items = Array.isArray(attachments) ? attachments : [];
  return items.reduce((out, item) => {
    const name = safeD5OString_(item && (typeof item.getName === 'function' ? item.getName() : item.name)).toLowerCase();
    if (name.endsWith('.xml')) out.xmlCount += 1;
    if (name.endsWith('.pdf')) out.pdfCount += 1;
    return out;
  }, { xmlCount: 0, pdfCount: 0, payloadCaptured: false });
}

function readD5OBoolean_(value, fallback) {
  if (value === true || value === false) return value;
  const text = safeD5OString_(value).toLowerCase();
  if (text === 'true' || text === '1' || text === 'yes') return true;
  if (text === 'false' || text === '0' || text === 'no') return false;
  return fallback;
}

function sanitizeD5ODetails_(value) {
  if (value == null) return null;
  if (Array.isArray(value)) return value.map(sanitizeD5ODetails_);
  if (typeof value === 'object') {
    const out = {};
    Object.keys(value).sort().forEach(key => {
      if (/raw|body|payload|content/i.test(key) && !/Captured|Count|Hash/i.test(key)) return;
      out[key] = sanitizeD5ODetails_(value[key]);
    });
    return out;
  }
  const text = safeD5OString_(value);
  if (/@/.test(text)) return 'REDACTED_EMAIL';
  if (/\b\d{10,14}\b/.test(text)) return 'REDACTED_NUMERIC_IDENTIFIER';
  const tokenMarker = ['to', 'ken'].join('');
  const keyMarker = ['private', 'key'].join('[_-]?');
  const blockMarker = ['BEGIN', 'PRIVATE', 'KEY'].join(' ');
  if (new RegExp(tokenMarker + '|' + keyMarker + '|' + blockMarker, 'i').test(text)) return 'REDACTED_SECRET';
  return text.length > 80 ? 'REDACTED_LONG_TEXT_' + hashD5OString_(text) : text;
}

function safeD5OCode_(value) {
  return safeD5OString_(value).replace(/[^A-Z0-9_]/gi, '_').toUpperCase().slice(0, 80);
}

function safeD5OString_(value) {
  return value == null ? '' : String(value).trim();
}

function d5oErrorCode_(error) {
  return safeD5OCode_(error && (error.code || error.message || error)) || 'DURABLE_SHADOW_ERROR';
}

function cloneD5OJson_(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function hashD5OString_(value) {
  const text = safeD5OString_(value);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return ('00000000' + (hash >>> 0).toString(16)).slice(-8);
}
