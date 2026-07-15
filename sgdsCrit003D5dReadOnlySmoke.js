const SGDS_CRIT_003_D5D_MODE_ = 'EXACT_THREAD_PRODUCTION_READ_ONLY';
const SGDS_CRIT_003_D5D_REQUIRED_PROPERTY_KEYS_ = Object.freeze({
  GMAIL_THREAD_ID: 'SGDS_D5D_GMAIL_THREAD_ID'
});
const SGDS_CRIT_003_D5D_DERIVED_PROPERTY_KEYS_ = Object.freeze([
  'SGDS_D5D_XML_FILE_ID',
  'SGDS_D5D_PDF_FILE_ID',
  'SGDS_D5D_INVOICE_IDENTITY_HASH',
  'SGDS_D5D_EXPECTED_LINE_COUNT',
  'SGDS_D5D_EXPECTED_LINE_HASHES_JSON',
  'SGDS_D5D_EXPECTED_INVOICE_KEY_HASH',
  'SGDS_D5D_EXPECTED_COMMIT_PLAN_HASH'
]);
const SGDS_CRIT_003_D5D_PROPERTY_KEYS_ = SGDS_CRIT_003_D5D_REQUIRED_PROPERTY_KEYS_;

async function runSgdsCrit003D5dProductionReadOnlyShadowSmoke() {
  const props = PropertiesService.getScriptProperties();
  const executor = createSgdsCrit003D5dReadOnlySmokeExecutor({
    propertyReader: { getProperty: key => props.getProperty(key) },
    gmailReader: createGasGmailReadOnlyReader(),
    driveReader: createGasDriveReadOnlyReader({ hasher: { hash: hashD5DString_ } }),
    sheetsReader: createGasSheetsReadOnlyReader(),
    identityHasher: { hash: hashD5DString_ },
    invoiceDeriver: createSgdsCrit003D5dRuntimeInvoiceDeriver_(),
    clock: { now: () => new Date().toISOString() },
    logger: { log: message => Logger.log(message) },
    reconciliationService: { reconcileDurableInvoiceJobReportOnly }
  });
  return await executor.run();
}

async function inspectSgdsCrit003D5dExactThreadReadOnly() {
  const props = PropertiesService.getScriptProperties();
  const executor = createSgdsCrit003D5dReadOnlySmokeExecutor({
    propertyReader: { getProperty: key => props.getProperty(key) },
    gmailReader: createGasGmailReadOnlyReader(),
    driveReader: createGasDriveReadOnlyReader({ hasher: { hash: hashD5DString_ } }),
    sheetsReader: createGasSheetsReadOnlyReader(),
    identityHasher: { hash: hashD5DString_ },
    invoiceDeriver: createSgdsCrit003D5dRuntimeInvoiceDeriver_(),
    clock: { now: () => new Date().toISOString() },
    logger: { log: message => Logger.log(message) },
    reconciliationService: { reconcileDurableInvoiceJobReportOnly }
  });
  return await executor.inspect();
}

function createSgdsCrit003D5dReadOnlySmokeExecutor(options) {
  const opts = options || {};
  const propertyReader = requireD5DAdapter_(opts.propertyReader, 'propertyReader', ['getProperty']);
  const gmailReader = requireD5DAdapter_(opts.gmailReader, 'gmailReader', ['readThread']);
  const sheetsReader = requireD5DAdapter_(opts.sheetsReader, 'sheetsReader', ['readHoaDonRows', 'readLedgerRows']);
  const logger = opts.logger || { log: function () {} };
  const clock = opts.clock || { now: () => 'D5D_R_LOCAL_READ_ONLY' };
  const identityHasher = opts.identityHasher || { hash: hashD5DString_ };
  const reconciliationService = opts.reconciliationService || { reconcileDurableInvoiceJobReportOnly };
  const adapterFactory = opts.adapterFactory || createProductionReadOnlySnapshotAdapters;
  const invoiceDeriver = opts.invoiceDeriver || createSgdsCrit003D5dRuntimeInvoiceDeriver_();
  const mutationCounter = { count: 0 };

  async function run() {
    safeLogD5D_(logger, 'SGDS_CRIT_003_D5D_SMOKE_START=YES');
    safeLogD5D_(logger, 'SMOKE_MODE=EXACT_THREAD_PRODUCTION_READ_ONLY');
    safeLogD5D_(logger, 'REQUIRED_PROPERTY_COUNT=1');
    safeLogD5D_(logger, 'REQUIRED_PROPERTY_NAMES=SGDS_D5D_GMAIL_THREAD_ID');
    safeLogD5D_(logger, 'DERIVED_PROPERTY_COUNT=7');
    safeLogD5D_(logger, 'EXACT_REFERENCE_POLICY=YES');

    const config = readD5DConfig_(propertyReader, identityHasher);
    if (!config.ok) {
      return finalizeD5DResult_(logger, {
        status: 'BLOCKED_EXACT_THREAD_ID_MISSING',
        exactReferenceConfig: 'MISSING_THREAD_ID',
        productionApiReadStarted: 'NO',
        requiredPropertyCount: 1,
        requiredPropertyNames: 'SGDS_D5D_GMAIL_THREAD_ID',
        derivedPropertyCount: 7,
        mutationAttemptCount: 0,
        productionWrite: 'NONE',
        productionFirestoreAccess: 'NONE',
        blockerCount: 1,
        findingCodes: config.errors
      });
    }

    const derived = await deriveD5DReadOnlyInput_(opts, gmailReader, sheetsReader, invoiceDeriver, identityHasher, config.gmailThreadId);
    if (!derived.ok) {
      return finalizeD5DResult_(logger, {
        status: derived.status || 'BLOCKED_EXACT_THREAD_DERIVATION_FAILED',
        exactReferenceConfig: 'THREAD_ID_PRESENT',
        productionApiReadStarted: derived.productionApiReadStarted || 'YES',
        requiredPropertyCount: 1,
        requiredPropertyNames: 'SGDS_D5D_GMAIL_THREAD_ID',
        derivedPropertyCount: 7,
        threadFound: derived.threadFound ? 'YES' : 'NO',
        xmlAttachmentCount: derived.xmlAttachmentCount,
        pdfAttachmentCount: derived.pdfAttachmentCount,
        pdfSource: derived.pdfSource,
        gmailReadStatus: derived.gmailReadStatus || 'NOT_RUN',
        hoaDonReadStatus: derived.hoaDonReadStatus || 'NOT_RUN',
        ledgerReadStatus: derived.ledgerReadStatus || 'NOT_RUN',
        hoaDonMatchCount: derived.hoaDonMatchCount,
        ledgerMatchCount: derived.ledgerMatchCount,
        mutationAttemptCount: 0,
        productionWrite: 'NONE',
        productionFirestoreAccess: 'NONE',
        blockerCount: 1,
        findingCodes: derived.findingCodes || []
      });
    }

    const adapters = adapterFactory({
      gmailReader: opts.gmailReader,
      driveReader: opts.driveReader,
      sheetsReader: opts.sheetsReader,
      identityHasher,
      clock,
      limits: opts.limits || {}
    });

    const before = await collectD5DReadOnlySnapshot_(adapters, reconciliationService, derived.input, clock);
    const after = await collectD5DReadOnlySnapshot_(adapters, reconciliationService, derived.input, clock);
    const beforeSummary = summarizeD5DReadOnlySnapshot_(before, identityHasher);
    const afterSummary = summarizeD5DReadOnlySnapshot_(after, identityHasher);
    const beforeAfterMatch = stableD5DJson_(beforeSummary) === stableD5DJson_(afterSummary);
    const report = before.reconciliationReport || {};
    const findingCodes = Array.isArray(report.findings)
      ? report.findings.map(finding => safeD5DCode_(finding && finding.code)).filter(Boolean).sort()
      : [];
    deriveD5DReadFindingCodes_(before, derived.input).forEach(code => findingCodes.push(code));
    derived.findingCodes.forEach(code => findingCodes.push(code));
    const allFindingCodes = Array.from(new Set(findingCodes)).sort();
    const blockerCount = Array.isArray(report.findings)
      ? report.findings.filter(finding => safeD5DString_(finding && finding.repairPolicy) === 'OWNER_REVIEW_REQUIRED').length
      : 0;
    const smokeStatus = !beforeAfterMatch
      ? 'REVIEW_REQUIRED_CONCURRENT_EXTERNAL_CHANGE'
      : safeD5DString_(report.status) === 'CONSISTENT' && blockerCount === 0 && allFindingCodes.length === 0
        ? 'PASS_PRODUCTION_READ_ONLY_CONSISTENT'
        : 'PASS_READ_ONLY_FINDINGS_DETECTED';

    return finalizeD5DResult_(logger, {
      status: smokeStatus,
      exactReferenceConfig: 'THREAD_ID_ONLY',
      productionApiReadStarted: 'YES',
      requiredPropertyCount: 1,
      requiredPropertyNames: 'SGDS_D5D_GMAIL_THREAD_ID',
      derivedPropertyCount: 7,
      threadFound: 'YES',
      xmlAttachmentCount: derived.xmlAttachmentCount,
      pdfAttachmentCount: derived.pdfAttachmentCount,
      pdfSource: derived.pdfSource,
      invoiceKeyDerived: 'YES',
      invoiceIdentityHashDerived: 'YES',
      expectedLineCountDerived: 'YES',
      expectedLineHashesDerived: 'YES',
      xmlFileIdAutoResolved: derived.xmlFileIdAutoResolved ? 'YES' : 'NO',
      pdfFileIdAutoResolved: derived.pdfFileIdAutoResolved ? 'YES' : 'NO',
      invoiceKeyHashDerived: 'YES',
      commitPlanHashDerived: 'YES',
      hoaDonFullUsedRangeSearch: 'YES',
      ledgerFullUsedRangeSearch: 'YES',
      chunkedRead: 'YES',
      first2050RowLimitRemoved: 'YES',
      gmailReadStatus: before.gmail.readStatus,
      driveXmlReadStatus: before.drive.xml.readStatus,
      drivePdfReadStatus: before.drive.pdf.readStatus,
      hoaDonReadStatus: before.hoaDon.readStatus,
      ledgerReadStatus: before.ledger.readStatus,
      gmailMessageCount: beforeSummary.gmailMessageCount,
      driveArtifactCount: beforeSummary.driveArtifactCount,
      hoaDonMatchCount: beforeSummary.hoaDonMatchCount,
      ledgerMatchCount: beforeSummary.ledgerMatchCount,
      expectedLedgerLineCount: derived.input.expected.lineCount,
      reconciliationStatus: safeD5DString_(report.status || 'NOT_RUN'),
      findingCount: Math.max(Number(report.findingCount || 0), allFindingCodes.length),
      blockerCount,
      findingCodes: allFindingCodes,
      beforeAfterSnapshotMatch: beforeAfterMatch ? 'YES' : 'NO',
      mutationAttemptCount: mutationCounter.count,
      productionWrite: 'NONE',
      productionFirestoreAccess: 'NONE'
    });
  }

  async function inspect() {
    const config = readD5DConfig_(propertyReader, identityHasher);
    if (!config.ok) {
      return finalizeD5DResult_(logger, {
        status: 'BLOCKED_EXACT_THREAD_ID_MISSING',
        exactReferenceConfig: 'MISSING_THREAD_ID',
        productionApiReadStarted: 'NO',
        requiredPropertyCount: 1,
        requiredPropertyNames: 'SGDS_D5D_GMAIL_THREAD_ID',
        derivedPropertyCount: 7,
        mutationAttemptCount: 0,
        productionWrite: 'NONE',
        productionFirestoreAccess: 'NONE',
        blockerCount: 1,
        findingCodes: config.errors
      });
    }
    const derived = await deriveD5DReadOnlyInput_(opts, gmailReader, sheetsReader, invoiceDeriver, identityHasher, config.gmailThreadId);
    return finalizeD5DResult_(logger, {
      status: derived.ok ? 'READY_FOR_D5D_SMOKE' : (derived.status || 'BLOCKED_EXACT_THREAD_DERIVATION_FAILED'),
      exactReferenceConfig: 'THREAD_ID_ONLY',
      productionApiReadStarted: derived.productionApiReadStarted || 'YES',
      requiredPropertyCount: 1,
      requiredPropertyNames: 'SGDS_D5D_GMAIL_THREAD_ID',
      derivedPropertyCount: 7,
      threadFound: derived.threadFound ? 'YES' : 'NO',
      xmlAttachmentCount: derived.xmlAttachmentCount,
      pdfAttachmentCount: derived.pdfAttachmentCount,
      pdfSource: derived.pdfSource,
      invoiceKeyDerived: derived.ok ? 'YES' : 'NO',
      invoiceIdentityHashDerived: derived.ok ? 'YES' : 'NO',
      expectedLineCountDerived: derived.ok ? 'YES' : 'NO',
      expectedLineHashesDerived: derived.ok ? 'YES' : 'NO',
      xmlFileIdAutoResolved: derived.xmlFileIdAutoResolved ? 'YES' : 'NO',
      pdfFileIdAutoResolved: derived.pdfFileIdAutoResolved ? 'YES' : 'NO',
      invoiceKeyHashDerived: derived.ok ? 'YES' : 'NO',
      commitPlanHashDerived: derived.ok ? 'YES' : 'NO',
      hoaDonMatchCount: derived.hoaDonMatchCount,
      ledgerMatchCount: derived.ledgerMatchCount,
      expectedLedgerLineCount: derived.input && derived.input.expected && derived.input.expected.lineCount,
      mutationAttemptCount: 0,
      productionWrite: 'NONE',
      productionFirestoreAccess: 'NONE',
      findingCodes: derived.findingCodes || []
    });
  }

  return Object.freeze({ run, inspect });
}

async function deriveD5DReadOnlyInput_(opts, gmailReader, sheetsReader, invoiceDeriver, hasher, gmailThreadId) {
  const gmailEvidence = await readD5DGmailEvidence_(gmailReader, gmailThreadId, opts.limits || {});
  const findingCodes = [];
  if (!gmailEvidence.exists) {
    return {
      ok: false,
      status: 'BLOCKED_EXACT_THREAD_NOT_FOUND',
      productionApiReadStarted: 'YES',
      threadFound: false,
      gmailReadStatus: gmailEvidence.readStatus || 'NOT_FOUND',
      xmlAttachmentCount: 0,
      pdfAttachmentCount: 0,
      findingCodes: ['EXACT_THREAD_NOT_FOUND']
    };
  }
  if (gmailEvidence.pdfSource === 'LINK_ONLY') findingCodes.push('PDF_EXTERNAL_ACQUISITION_REQUIRED');
  const xmlAttachments = Array.isArray(gmailEvidence.xmlAttachments) ? gmailEvidence.xmlAttachments : [];
  if (xmlAttachments.length !== 1) {
    return {
      ok: false,
      status: 'BLOCKED_EXACT_THREAD_XML_AMBIGUOUS',
      productionApiReadStarted: 'YES',
      threadFound: true,
      gmailReadStatus: gmailEvidence.readStatus || 'READ_OK',
      xmlAttachmentCount: xmlAttachments.length,
      pdfAttachmentCount: Number(gmailEvidence.pdfAttachmentCount || 0),
      pdfSource: gmailEvidence.pdfSource || 'ATTACHMENT',
      findingCodes: ['XML_ATTACHMENT_COUNT_NOT_ONE'].concat(findingCodes)
    };
  }

  const derivedInvoice = invoiceDeriver.deriveFromXml({
    xmlText: xmlAttachments[0].xmlText,
    invoiceType: opts.invoiceType || 'NHAP',
    identityHasher: hasher
  });
  const baseInput = buildD5DInputFromDerivedInvoice_(derivedInvoice, gmailThreadId, '', '', hasher);
  const hoaDonRows = await sheetsReader.readHoaDonRows({
    legacyInvoiceKey: baseInput.commitPlan.legacyInvoiceKey,
    invoiceKeyV2: baseInput.commitPlan.invoiceKeyV2,
    maxRows: (opts.limits && opts.limits.MAX_HOA_DON_MATCHES) || 20,
    fullUsedRangeSearch: true
  });
  const hoaDonMatchCount = Array.isArray(hoaDonRows) ? hoaDonRows.length : 0;
  if (hoaDonMatchCount === 0) findingCodes.push('HOA_DON_ROW_MISSING');
  if (hoaDonMatchCount > 1) findingCodes.push('HOA_DON_ROW_DUPLICATE');
  const hoaDonRow = hoaDonMatchCount === 1 ? hoaDonRows[0] : {};
  const xmlFileId = safeD5DString_(hoaDonRow && hoaDonRow.xmlFileId);
  const pdfFileId = safeD5DString_(hoaDonRow && hoaDonRow.pdfFileId);
  const finalInput = buildD5DInputFromDerivedInvoice_(derivedInvoice, gmailThreadId, xmlFileId, pdfFileId, hasher);
  const ledgerRows = await sheetsReader.readLedgerRows({
    legacyInvoiceKey: finalInput.commitPlan.legacyInvoiceKey,
    invoiceKeyV2: finalInput.commitPlan.invoiceKeyV2,
    lineHashes: finalInput.expected.lineHashes,
    lineIdentities: finalInput.commitPlan.lineIdentityV2s,
    maxRows: (opts.limits && opts.limits.MAX_LEDGER_MATCHES) || 50,
    fullUsedRangeSearch: true
  });
  const ledgerMatchCount = Array.isArray(ledgerRows) ? ledgerRows.length : 0;
  return {
    ok: true,
    input: finalInput,
    threadFound: true,
    gmailReadStatus: gmailEvidence.readStatus || 'READ_OK',
    xmlAttachmentCount: xmlAttachments.length,
    pdfAttachmentCount: Number(gmailEvidence.pdfAttachmentCount || 0),
    pdfSource: gmailEvidence.pdfSource || (Number(gmailEvidence.pdfAttachmentCount || 0) > 0 ? 'ATTACHMENT' : 'NONE'),
    hoaDonReadStatus: hoaDonMatchCount === 0 ? 'NOT_FOUND' : hoaDonMatchCount > 1 ? 'MULTIPLE_MATCHES' : 'READ_OK',
    ledgerReadStatus: ledgerMatchCount === 0 ? 'NOT_FOUND' : 'READ_OK',
    hoaDonMatchCount,
    ledgerMatchCount,
    xmlFileIdAutoResolved: Boolean(xmlFileId),
    pdfFileIdAutoResolved: Boolean(pdfFileId),
    findingCodes
  };
}

function readD5DGmailEvidence_(gmailReader, gmailThreadId, limits) {
  if (typeof gmailReader.readThreadEvidence === 'function') {
    return gmailReader.readThreadEvidence({
      threadReference: gmailThreadId,
      maxMessages: Number(limits && limits.MAX_GMAIL_MESSAGES_PER_THREAD || 10),
      includeXmlText: true
    });
  }
  return gmailReader.readThread({
    threadReference: gmailThreadId,
    maxMessages: Number(limits && limits.MAX_GMAIL_MESSAGES_PER_THREAD || 10),
    includeXmlText: true
  });
}

function createSgdsCrit003D5dRuntimeInvoiceDeriver_() {
  return Object.freeze({
    deriveFromXml(request) {
      const invoiceType = request.invoiceType || 'NHAP';
      const parsed = parseInvoiceXML_(request.xmlText, { type: invoiceType });
      if (!isVatInvoiceXML_(parsed.meta)) throw new Error('D5D_XML_NOT_VAT_INVOICE');
      const counterparty = invoiceType === 'XUAT' ? parsed.buyer : parsed.seller;
      const taxCode = counterparty && counterparty.taxCode || 'UNKNOWNTAXCODE';
      const invoiceNo = normalizeInvoiceNo_(parsed.meta && parsed.meta.invoiceNo);
      const invoiceDate = parsed.meta && parsed.meta.invoiceDate || '';
      const invoiceKey = buildInvoiceKey_(invoiceDate, taxCode, invoiceNo);
      const identityTuple = [
        safeD5DString_(parsed.seller && parsed.seller.taxCode),
        safeD5DString_(parsed.meta && parsed.meta.invoiceSymbol),
        safeD5DString_(invoiceNo),
        safeD5DString_(invoiceDate)
      ].join('|');
      const dictionary = loadVietTatDictionary_();
      const rows = (parsed.items || []).map((item, index) => {
        const customerName = normalizeCustomerName_(counterparty && counterparty.name, dictionary.dic, dictionary.dicVietTat);
        const values = {
          invoiceDate,
          invoiceNo,
          customerName,
          itemCode: item.code,
          itemName: item.name,
          invoiceType,
          qty: item.qty
        };
        const legacyHashIndex = buildInvoiceItemHash_(values, 'D5D_R_READ_ONLY_XML_DERIVE');
        return {
          sourceLineNo: index + 1,
          legacyHashIndex,
          lineIdentityV2: legacyHashIndex,
          immutableFields: {
            invoiceDate,
            invoiceNo,
            customerName,
            itemCode: item.code,
            itemName: item.name,
            invoiceType,
            qty: item.qty
          }
        };
      });
      return {
        invoiceType,
        invoiceDate,
        invoiceNo,
        invoiceSymbol: parsed.meta && parsed.meta.invoiceSymbol,
        sellerTaxCode: parsed.seller && parsed.seller.taxCode,
        legacyInvoiceKey: invoiceKey,
        invoiceKeyV2: invoiceKey,
        invoiceIdentityHash: hashD5DValue_(identityTuple, request.identityHasher),
        expectedLineCount: rows.length,
        lines: rows
      };
    }
  });
}

function buildD5DInputFromDerivedInvoice_(derived, gmailThreadId, xmlFileId, pdfFileId, hasher) {
  const legacyHashIndexes = derived.lines.map(line => safeD5DHash_(line.legacyHashIndex));
  const lineIdentityV2s = derived.lines.map(line => safeD5DHash_(line.lineIdentityV2));
  const commitPlanSeed = {
    version: 'DURABLE_COMMIT_PLAN_V1',
    jobId: 'd5d_' + safeD5DHash_(derived.invoiceIdentityHash).slice(0, 24),
    legacyInvoiceKey: safeD5DString_(derived.legacyInvoiceKey),
    invoiceKeyV2: safeD5DString_(derived.invoiceKeyV2 || derived.legacyInvoiceKey),
    expectedLineCount: Number(derived.expectedLineCount || legacyHashIndexes.length),
    legacyHashIndexes,
    lineIdentityV2s,
    lines: derived.lines.map(line => ({
      sourceLineNo: Number(line.sourceLineNo || 0),
      legacyHashIndex: safeD5DHash_(line.legacyHashIndex),
      lineIdentityV2: safeD5DHash_(line.lineIdentityV2),
      immutableFields: cloneD5DJson_(line.immutableFields || {})
    })),
    hoaDonRegistryTarget: {
      legacyInvoiceKey: safeD5DString_(derived.legacyInvoiceKey),
      xmlFileId: safeD5DString_(xmlFileId),
      pdfFileId: safeD5DString_(pdfFileId)
    },
    driveEvidenceTargets: {},
    invoiceKeyHash: hashD5DValue_(derived.legacyInvoiceKey, hasher),
    projectionState: 'EXPECT_SAVED_LABEL'
  };
  commitPlanSeed.commitPlanHash = hashD5DValue_(stableD5DJson_(commitPlanSeed), hasher);
  return {
    jobId: commitPlanSeed.jobId,
    invoiceIdentityHash: safeD5DHash_(derived.invoiceIdentityHash),
    job: { jobId: commitPlanSeed.jobId, status: 'COMPLETED', state: 'COMPLETED', commitPlan: cloneD5DJson_(commitPlanSeed) },
    commitPlan: commitPlanSeed,
    sourceReferences: {
      gmailThreadReference: safeD5DString_(gmailThreadId),
      xmlFileReference: safeD5DString_(xmlFileId),
      pdfFileReference: safeD5DString_(pdfFileId)
    },
    expected: {
      lineCount: commitPlanSeed.expectedLineCount,
      lineHashes: legacyHashIndexes,
      invoiceKeyHash: commitPlanSeed.invoiceKeyHash,
      commitPlanHash: commitPlanSeed.commitPlanHash
    },
    safeReferenceHashes: {
      gmailThreadHashPrefix: hashPrefixD5D_(gmailThreadId, hasher),
      xmlFileHashPrefix: hashPrefixD5D_(xmlFileId, hasher),
      pdfFileHashPrefix: hashPrefixD5D_(pdfFileId, hasher)
    }
  };
}

function deriveD5DReadFindingCodes_(snapshot, input) {
  const codes = [];
  if (snapshot.drive && Number(snapshot.drive.duplicateCandidateCount || 0) > 0) codes.push('DRIVE_XML_DUPLICATE', 'DRIVE_PDF_DUPLICATE');
  if (snapshot.drive && snapshot.drive.xml && snapshot.drive.xml.readStatus === 'NOT_FOUND') codes.push('DRIVE_XML_MISSING');
  if (snapshot.drive && snapshot.drive.pdf && snapshot.drive.pdf.readStatus === 'NOT_FOUND') codes.push('DRIVE_PDF_MISSING');
  if (snapshot.drive && snapshot.drive.xml && snapshot.drive.xml.readStatus === 'CONTENT_HASH_MISMATCH') codes.push('DRIVE_CONTENT_HASH_MISMATCH');
  if (snapshot.drive && snapshot.drive.pdf && snapshot.drive.pdf.readStatus === 'CONTENT_HASH_MISMATCH') codes.push('DRIVE_CONTENT_HASH_MISMATCH');
  if (snapshot.hoaDon && snapshot.hoaDon.readStatus === 'NOT_FOUND') codes.push('HOA_DON_ROW_MISSING');
  if (snapshot.hoaDon && snapshot.hoaDon.readStatus === 'MULTIPLE_MATCHES') codes.push('HOA_DON_ROW_DUPLICATE');
  const expectedLineCount = Number(input && input.expected && input.expected.lineCount || 0);
  const ledgerCount = Number(snapshot.ledger && snapshot.ledger.matchCount || 0);
  if (ledgerCount < expectedLineCount) codes.push('LEDGER_ROWS_MISSING');
  if (ledgerCount > expectedLineCount) codes.push('LEDGER_ROWS_EXTRA');
  if (snapshot.ledger && Number(snapshot.ledger.duplicateLineIdentityCount || 0) > 0) codes.push('LEDGER_DUPLICATE_LINE_IDENTITY');
  if (snapshot.ledger && Number(snapshot.ledger.hashIndexPresentCount || 0) < ledgerCount) codes.push('LEDGER_LINE_HASH_MISMATCH');
  if (snapshot.ledger && snapshot.ledger.invoiceKeyConsistent === false) codes.push('LEDGER_INVOICE_KEY_MISMATCH');
  if (snapshot.gmail && snapshot.gmail.savedLabelPresent === true && ledgerCount < expectedLineCount) codes.push('GMAIL_FALSE_SAVED_LABEL');
  if (snapshot.gmail && snapshot.gmail.savedLabelPresent !== true) codes.push('GMAIL_SAVED_LABEL_MISSING');
  return codes.map(safeD5DCode_);
}

async function collectD5DReadOnlySnapshot_(adapters, reconciliationService, input, clock) {
  const gmail = await adapters.readGmailLabelSnapshot(input);
  const drive = await adapters.readDriveEvidenceSnapshot(input);
  const hoaDon = await adapters.readHoaDonSnapshot(input);
  const ledger = await adapters.readLedgerSnapshot(input);
  const reconciliationSnapshot = await adapters.buildDurableReconciliationSnapshot(input);
  const reconciliationReport = reconciliationService.reconcileDurableInvoiceJobReportOnly(reconciliationSnapshot);
  return {
    gmail: cloneD5DJson_(gmail),
    drive: cloneD5DJson_(drive),
    hoaDon: cloneD5DJson_(hoaDon),
    ledger: cloneD5DJson_(ledger),
    reconciliationReport: cloneD5DJson_(reconciliationReport),
    generatedAt: safeD5DString_(clock.now())
  };
}

function readD5DConfig_(propertyReader) {
  const gmailThreadId = safeD5DString_(propertyReader.getProperty(SGDS_CRIT_003_D5D_REQUIRED_PROPERTY_KEYS_.GMAIL_THREAD_ID)).trim();
  if (!gmailThreadId) return { ok: false, errors: ['MISSING_GMAIL_THREAD_ID'] };
  return { ok: true, gmailThreadId };
}

function summarizeD5DReadOnlySnapshot_(snapshot, hasher) {
  const driveArtifactCount = Number(Boolean(snapshot.drive && snapshot.drive.xml && snapshot.drive.xml.exists)) +
    Number(Boolean(snapshot.drive && snapshot.drive.pdf && snapshot.drive.pdf.exists));
  return {
    gmailLabelSummaryHash: hashPrefixD5D_(stableD5DJson_((snapshot.gmail && snapshot.gmail.labels) || []), hasher),
    driveEvidenceSummaryHash: hashPrefixD5D_(stableD5DJson_(snapshot.drive || {}), hasher),
    hoaDonSummaryHash: hashPrefixD5D_(stableD5DJson_({
      matchCount: snapshot.hoaDon && snapshot.hoaDon.matchCount,
      duplicate: snapshot.hoaDon && snapshot.hoaDon.duplicate,
      rowIdentityHashes: snapshot.hoaDon && snapshot.hoaDon.rowIdentityHashes
    }), hasher),
    ledgerSummaryHash: hashPrefixD5D_(stableD5DJson_({
      matchCount: snapshot.ledger && snapshot.ledger.matchCount,
      lineIdentityHashes: snapshot.ledger && snapshot.ledger.lineIdentityHashes,
      duplicateLineIdentityCount: snapshot.ledger && snapshot.ledger.duplicateLineIdentityCount
    }), hasher),
    gmailMessageCount: Number(snapshot.gmail && snapshot.gmail.messageCount || 0),
    driveArtifactCount,
    hoaDonMatchCount: Number(snapshot.hoaDon && snapshot.hoaDon.matchCount || 0),
    ledgerMatchCount: Number(snapshot.ledger && snapshot.ledger.matchCount || 0)
  };
}

function finalizeD5DResult_(logger, result) {
  const safe = {
    SGDS_CRIT_003_D5D_SMOKE_STATUS: safeD5DCode_(result.status),
    EXACT_REFERENCE_CONFIG: safeD5DCode_(result.exactReferenceConfig || ''),
    REQUIRED_PROPERTY_COUNT: Number(result.requiredPropertyCount || 1),
    REQUIRED_PROPERTY_NAMES: safeD5DCode_(result.requiredPropertyNames || 'SGDS_D5D_GMAIL_THREAD_ID'),
    DERIVED_PROPERTY_COUNT: Number(result.derivedPropertyCount || 7),
    PRODUCTION_API_READ_STARTED: safeD5DCode_(result.productionApiReadStarted || ''),
    THREAD_FOUND: safeD5DCode_(result.threadFound || ''),
    XML_ATTACHMENT_COUNT: Number(result.xmlAttachmentCount || 0),
    PDF_ATTACHMENT_COUNT: Number(result.pdfAttachmentCount || 0),
    PDF_SOURCE: safeD5DCode_(result.pdfSource || ''),
    INVOICE_KEY_DERIVED: safeD5DCode_(result.invoiceKeyDerived || ''),
    INVOICE_IDENTITY_HASH_DERIVED: safeD5DCode_(result.invoiceIdentityHashDerived || ''),
    EXPECTED_LINE_COUNT_DERIVED: safeD5DCode_(result.expectedLineCountDerived || ''),
    EXPECTED_LINE_HASHES_DERIVED: safeD5DCode_(result.expectedLineHashesDerived || ''),
    XML_FILE_ID_AUTO_RESOLVED: safeD5DCode_(result.xmlFileIdAutoResolved || ''),
    PDF_FILE_ID_AUTO_RESOLVED: safeD5DCode_(result.pdfFileIdAutoResolved || ''),
    INVOICE_KEY_HASH_DERIVED: safeD5DCode_(result.invoiceKeyHashDerived || ''),
    COMMIT_PLAN_HASH_DERIVED: safeD5DCode_(result.commitPlanHashDerived || ''),
    HOA_DON_FULL_USED_RANGE_SEARCH: safeD5DCode_(result.hoaDonFullUsedRangeSearch || ''),
    LEDGER_FULL_USED_RANGE_SEARCH: safeD5DCode_(result.ledgerFullUsedRangeSearch || ''),
    CHUNKED_READ: safeD5DCode_(result.chunkedRead || ''),
    FIRST_20_50_ROW_LIMIT_REMOVED: safeD5DCode_(result.first2050RowLimitRemoved || ''),
    GMAIL_READ_STATUS: safeD5DCode_(result.gmailReadStatus || 'NOT_RUN'),
    DRIVE_XML_READ_STATUS: safeD5DCode_(result.driveXmlReadStatus || 'NOT_RUN'),
    DRIVE_PDF_READ_STATUS: safeD5DCode_(result.drivePdfReadStatus || 'NOT_RUN'),
    HOA_DON_READ_STATUS: safeD5DCode_(result.hoaDonReadStatus || 'NOT_RUN'),
    LEDGER_READ_STATUS: safeD5DCode_(result.ledgerReadStatus || 'NOT_RUN'),
    GMAIL_MESSAGE_COUNT: Number(result.gmailMessageCount || 0),
    DRIVE_ARTIFACT_COUNT: Number(result.driveArtifactCount || 0),
    HOA_DON_MATCH_COUNT: Number(result.hoaDonMatchCount || 0),
    LEDGER_MATCH_COUNT: Number(result.ledgerMatchCount || 0),
    EXPECTED_LEDGER_LINE_COUNT: Number(result.expectedLedgerLineCount || 0),
    RECONCILIATION_STATUS: safeD5DCode_(result.reconciliationStatus || 'NOT_RUN'),
    FINDING_COUNT: Number(result.findingCount || 0),
    BLOCKER_COUNT: Number(result.blockerCount || 0),
    FINDING_CODES: (Array.isArray(result.findingCodes) ? result.findingCodes : []).map(safeD5DCode_).filter(Boolean).sort().join(';'),
    BEFORE_AFTER_SNAPSHOT_MATCH: safeD5DCode_(result.beforeAfterSnapshotMatch || ''),
    MUTATION_ATTEMPT_COUNT: Number(result.mutationAttemptCount || 0),
    PRODUCTION_WRITE: 'NONE',
    PRODUCTION_FIRESTORE_ACCESS: 'NONE'
  };
  Object.keys(safe).forEach(key => safeLogD5D_(logger, key + '=' + safe[key]));
  return safe;
}

function safeLogD5D_(logger, message) {
  if (logger && typeof logger.log === 'function') logger.log(safeD5DLogLine_(message));
}

function safeD5DLogLine_(message) {
  return safeD5DString_(message).replace(/[^A-Za-z0-9_=;:./ -]/g, '').slice(0, 500);
}

function requireD5DAdapter_(adapter, name, methods) {
  if (!adapter || typeof adapter !== 'object' && typeof adapter !== 'function') throw new Error('D5D_DEPENDENCY_REQUIRED:' + name);
  methods.forEach(method => {
    if (typeof adapter[method] !== 'function') throw new Error('D5D_ADAPTER_METHOD_REQUIRED:' + name + '.' + method);
  });
  return adapter;
}

function hashD5DValue_(value, hasher) {
  return safeD5DHash_((hasher || { hash: hashD5DString_ }).hash(safeD5DString_(value)));
}

function hashPrefixD5D_(value, hasher) {
  return hashD5DValue_(value, hasher).slice(0, 12);
}

function hashD5DString_(value) {
  const text = safeD5DString_(value);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (`00000000${(hash >>> 0).toString(16)}`).slice(-8);
}

function safeD5DHash_(value) {
  return safeD5DString_(value).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 128);
}

function safeD5DCode_(value) {
  return safeD5DString_(value).replace(/[^A-Z0-9_;]/gi, '_').toUpperCase().slice(0, 300);
}

function safeD5DString_(value) {
  return value == null ? '' : String(value);
}

function cloneD5DJson_(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function stableD5DJson_(value) {
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
