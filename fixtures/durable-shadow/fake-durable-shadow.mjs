export const D5B_TEST_SCENARIOS = Object.freeze([
  'one Gmail candidate',
  'one Drive candidate',
  'same invoice from Gmail and Drive converges',
  'different invoices remain separate',
  'duplicate Gmail discovery collapses',
  'duplicate Drive discovery collapses',
  'candidate ordering deterministic',
  'one candidate parse failure does not stop batch',
  'commit-plan preview produced',
  'multi-line expected count correct',
  'same candidate rerun is idempotent',
  'existing completed job skipped',
  'reconciliation-required job skipped',
  'commit-plan mismatch produces review required',
  'conflicting identity produces review required',
  'zero mutation adapter calls',
  'zero external API calls',
  'batch limit enforced',
  'same suite run twice deterministically'
]);

export const D5B_FAULT_INJECTION_CASES = Object.freeze([
  'source load failure',
  'parse failure',
  'identity build failure',
  'job-store version conflict',
  'commit-plan save response lost in fake store',
  'reconciliation report failure'
]);

export function createD5BClock() {
  let index = 0;
  return {
    now() {
      const value = `2026-07-15T02:00:${String(index).padStart(2, '0')}.000Z`;
      index += 1;
      return value;
    }
  };
}

export function createD5BInvoice(overrides = {}) {
  const key = overrides.key || 'A';
  const lineCount = Number(overrides.lineCount || 1);
  const legacyInvoiceKey = `SYNTHETIC_LEGACY_${key}`;
  const invoiceKeyV2 = `SYNTHETIC_INVOICE_V2_${key}`;
  const identityHash = `syntheticIdentity${key}`;
  return {
    identityHash,
    legacyInvoiceKey,
    invoiceKeyV2,
    lines: Array.from({ length: lineCount }, (_, index) => ({
      sourceLineNo: index + 1,
      legacyHashIndex: `synthetic-shadow-line-hash-${key}-${index + 1}`,
      lineIdentityV2: `synthetic-shadow-line-id-${key}-${index + 1}`,
      immutableFields: { itemBucket: key, sequence: index + 1 }
    })),
    driveEvidenceTargets: {
      xmlContentHash: `synthetic-shadow-xml-${key}`,
      pdfContentHash: `synthetic-shadow-pdf-${key}`,
      xmlFileId: `synthetic-shadow-xml-file-${key}`,
      pdfFileId: `synthetic-shadow-pdf-file-${key}`
    },
    hoaDonRegistryTarget: {
      legacyInvoiceKey,
      invoiceKeyV2,
      xmlContentHash: `synthetic-shadow-xml-${key}`,
      pdfContentHash: `synthetic-shadow-pdf-${key}`,
      xmlFileId: `synthetic-shadow-xml-file-${key}`,
      pdfFileId: `synthetic-shadow-pdf-file-${key}`
    },
    preCommitLedgerProbe: { status: 'SHADOW_NOT_RUN' }
  };
}

export function createD5BCandidate(sourceType, referenceHash, invoiceKey = 'A', overrides = {}) {
  return {
    sourceType,
    sourceReferenceHash: referenceHash,
    discoveredAt: overrides.discoveredAt || `2026-07-15T02:01:${sourceType === 'GMAIL' ? '00' : '01'}.000Z`,
    attachmentSummary: {
      xmlCount: overrides.xmlCount == null ? 1 : overrides.xmlCount,
      pdfCount: overrides.pdfCount == null ? 1 : overrides.pdfCount,
      payloadCaptured: false
    },
    safeMetadata: {
      syntheticInvoiceKey: invoiceKey,
      sourceKind: sourceType,
      rawReferenceCaptured: false
    }
  };
}

export function createD5BShadowFixtures(options = {}) {
  const calls = [];
  const mutationCalls = [];
  const invoices = {
    A: createD5BInvoice({ key: 'A', lineCount: options.multiLine ? 2 : 1 }),
    B: createD5BInvoice({ key: 'B', lineCount: 1 }),
    C: createD5BInvoice({ key: 'C', lineCount: 1 })
  };
  const gmailCandidates = options.gmailCandidates || [createD5BCandidate('GMAIL', 'gmailHashA', 'A')];
  const driveCandidates = options.driveCandidates || [];
  const failures = options.failures || {};

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function record(method, details = {}) {
    calls.push({ method, ...clone(details) });
  }

  function maybeThrow(key) {
    if (!failures[key]) return;
    const error = new Error(`${key}_fault`);
    error.code = failures[key] === true ? `${key}_FAULT` : failures[key];
    if (String(error.code).includes('RESPONSE_LOST')) error.writeOutcome = 'UNKNOWN';
    throw error;
  }

  const gmailCandidateAdapter = {
    async discoverCandidates() {
      record('gmail.discoverCandidates');
      maybeThrow('GMAIL_DISCOVERY');
      return clone(gmailCandidates);
    }
  };

  const driveCandidateAdapter = {
    async discoverCandidates() {
      record('drive.discoverCandidates');
      maybeThrow('DRIVE_DISCOVERY');
      return clone(driveCandidates);
    }
  };

  const sourceNormalizer = {
    async normalizeCandidate(candidate) {
      record('source.normalizeCandidate', { sourceType: candidate.sourceType });
      maybeThrow('SOURCE_LOAD');
      maybeThrow('PARSE');
      const key = candidate.safeMetadata && candidate.safeMetadata.syntheticInvoiceKey;
      const invoice = invoices[key];
      if (!invoice) {
        const error = new Error('synthetic invoice not found');
        error.code = 'SOURCE_PARSE_FAILED';
        throw error;
      }
      if (options.conflictingCandidateHash && candidate.sourceReferenceHash === options.conflictingCandidateHash) {
        return { ...clone(invoice), invoiceKeyV2: `CONFLICTING_${invoice.invoiceKeyV2}` };
      }
      return clone(invoice);
    }
  };

  const identityBuilder = {
    async buildIdentity(normalized) {
      record('identity.buildIdentity');
      maybeThrow('IDENTITY_BUILD');
      if (String(normalized.invoiceKeyV2 || '').startsWith('CONFLICTING_')) {
        const error = new Error('identity convergence conflict');
        error.code = 'IDENTITY_CONFLICT';
        throw error;
      }
      return {
        identityHash: normalized.identityHash,
        legacyInvoiceKey: normalized.legacyInvoiceKey,
        invoiceKeyV2: normalized.invoiceKeyV2
      };
    }
  };

  const mutationAdapterSentinel = {
    writeXmlIfAbsent() { mutationCalls.push('writeXmlIfAbsent'); throw new Error('D5B_MUTATION_FORBIDDEN'); },
    writePdfIfAbsent() { mutationCalls.push('writePdfIfAbsent'); throw new Error('D5B_MUTATION_FORBIDDEN'); },
    writeInvoiceRowIfAbsent() { mutationCalls.push('writeInvoiceRowIfAbsent'); throw new Error('D5B_MUTATION_FORBIDDEN'); },
    appendInvoiceLinesIfAbsent() { mutationCalls.push('appendInvoiceLinesIfAbsent'); throw new Error('D5B_MUTATION_FORBIDDEN'); },
    applySavedLabel() { mutationCalls.push('applySavedLabel'); throw new Error('D5B_MUTATION_FORBIDDEN'); }
  };

  return {
    gmailCandidateAdapter,
    driveCandidateAdapter,
    sourceNormalizer,
    identityBuilder,
    mutationAdapterSentinel,
    calls,
    mutationCalls,
    invoices,
    dump() {
      return clone({ calls, mutationCalls, invoices });
    }
  };
}
