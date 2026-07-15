const BUNDLE_C_SMOKE_APPROVAL_MARKER = "OWNER_APPROVE_BUNDLE_C_SINGLE_INVOICE_MUTATION_SMOKE";
const BUNDLE_C_SMOKE_DIRECTION = "NHAP";
const BUNDLE_C_SMOKE_PROP = {
  marker: "BUNDLE_C_SMOKE_APPROVAL_MARKER",
  threadId: "BUNDLE_C_SMOKE_THREAD_ID",
  nonce: "BUNDLE_C_SMOKE_NONCE",
  state: "BUNDLE_C_SMOKE_STATE",
  resultCode: "BUNDLE_C_SMOKE_RESULT_CODE",
  startedAt: "BUNDLE_C_SMOKE_STARTED_AT",
  finishedAt: "BUNDLE_C_SMOKE_FINISHED_AT",
  threadHashPrefix: "BUNDLE_C_SMOKE_THREAD_HASH_PREFIX",
  invoiceKeyHashPrefix: "BUNDLE_C_SMOKE_INVOICE_KEY_HASH_PREFIX",
  expectedLineCount: "BUNDLE_C_SMOKE_EXPECTED_LINE_COUNT",
  committedLineCount: "BUNDLE_C_SMOKE_COMMITTED_LINE_COUNT"
};

function runApprovedBundleCSingleThreadSmoke() {
  return runBundleCSingleThreadSmoke_();
}

function runBundleCSingleThreadSmoke_() {
  const props = PropertiesService.getScriptProperties();
  const lock = LockService.getScriptLock();
  let locked = false;

  try {
    const gate = readBundleCSmokeGate_(props);
    const gateBlock = validateBundleCSmokeGate_(gate);
    if (gateBlock) return blockBundleCSmoke_(props, gateBlock);

    if (props.getProperty(BUNDLE_C_SMOKE_PROP.startedAt)) {
      return blockBundleCSmoke_(props, "SMOKE_REPLAY_BLOCKED");
    }

    if (!lock.tryLock(1000)) {
      return blockBundleCSmoke_(props, "SMOKE_LOCK_UNAVAILABLE");
    }
    locked = true;

    const stateAfterLock = props.getProperty(BUNDLE_C_SMOKE_PROP.state);
    if (stateAfterLock !== "READY") {
      return blockBundleCSmoke_(props, "SMOKE_REPLAY_BLOCKED");
    }

    props.setProperty(BUNDLE_C_SMOKE_PROP.startedAt, new Date().toISOString());
    props.setProperty(BUNDLE_C_SMOKE_PROP.threadHashPrefix, smokeHashPrefix_(gate.threadId));

    const thread = GmailApp.getThreadById(gate.threadId);
    if (!thread) return blockBundleCSmoke_(props, "SMOKE_THREAD_NOT_FOUND");

    const validation = validateBundleCSmokeThread_(thread);
    if (!validation.ok) return blockBundleCSmoke_(props, validation.errorCode);

    const stats = createProcessStats_();
    const prepared = prepareInvoiceRowsForCommit_(validation.items, stats, {
      debugPrefix: "BUNDLE_C_SINGLE_THREAD"
    });

    const precheck = validateBundleCSmokePrestate_(prepared, validation);
    if (!precheck.ok) return blockBundleCSmoke_(props, precheck.errorCode);

    props.setProperty(BUNDLE_C_SMOKE_PROP.state, "RUNNING");
    props.setProperty(BUNDLE_C_SMOKE_PROP.invoiceKeyHashPrefix, smokeHashPrefix_(validation.invoiceKey));
    props.setProperty(BUNDLE_C_SMOKE_PROP.expectedLineCount, String(validation.expectedLineCount));

    saveBundleCSmokeArtifacts_(validation);

    const commitResults = commitPreparedInvoiceRows_(prepared);
    projectCommitLabelsByThread_(commitResults);

    const committed = commitResults.filter(x => x.writeStatus === "COMMITTED").length;
    props.setProperty(BUNDLE_C_SMOKE_PROP.committedLineCount, String(committed));

    const failed = commitResults.find(x => x.writeStatus === "FAILED");
    const already = commitResults.find(x => x.writeStatus === "ALREADY_COMMITTED");

    if (already) {
      return blockBundleCSmoke_(props, "SAMPLE_ALREADY_COMMITTED");
    }

    if (failed || committed !== validation.expectedLineCount) {
      props.setProperty(BUNDLE_C_SMOKE_PROP.state, "FAILED");
      props.setProperty(BUNDLE_C_SMOKE_PROP.resultCode, failed?.errorCode || "SMOKE_COMMIT_MISMATCH");
      props.setProperty(BUNDLE_C_SMOKE_PROP.finishedAt, new Date().toISOString());
      return { status: "FAILED", errorCode: props.getProperty(BUNDLE_C_SMOKE_PROP.resultCode) };
    }

    props.setProperty(BUNDLE_C_SMOKE_PROP.state, "SUCCEEDED");
    props.setProperty(BUNDLE_C_SMOKE_PROP.resultCode, "COMMITTED");
    props.setProperty(BUNDLE_C_SMOKE_PROP.finishedAt, new Date().toISOString());
    debugLog_("BUNDLE_C_SINGLE_THREAD_SMOKE status=COMMITTED threadHash=" + props.getProperty(BUNDLE_C_SMOKE_PROP.threadHashPrefix));
    return {
      status: "SUCCEEDED",
      resultCode: "COMMITTED",
      expectedLineCount: validation.expectedLineCount,
      committedLineCount: committed
    };
  } catch (err) {
    props.setProperty(BUNDLE_C_SMOKE_PROP.state, "FAILED");
    props.setProperty(BUNDLE_C_SMOKE_PROP.resultCode, safeBundleCSmokeErrorCode_(err));
    props.setProperty(BUNDLE_C_SMOKE_PROP.finishedAt, new Date().toISOString());
    debugLog_("BUNDLE_C_SINGLE_THREAD_SMOKE status=FAILED code=" + props.getProperty(BUNDLE_C_SMOKE_PROP.resultCode));
    return { status: "FAILED", errorCode: props.getProperty(BUNDLE_C_SMOKE_PROP.resultCode) };
  } finally {
    if (locked) {
      try {
        lock.releaseLock();
      } catch (releaseErr) {
        debugLog_("BUNDLE_C_SINGLE_THREAD_SMOKE lock release failed");
      }
    }
  }
}

function readBundleCSmokeGate_(props) {
  return {
    marker: props.getProperty(BUNDLE_C_SMOKE_PROP.marker),
    threadId: props.getProperty(BUNDLE_C_SMOKE_PROP.threadId),
    nonce: props.getProperty(BUNDLE_C_SMOKE_PROP.nonce),
    state: props.getProperty(BUNDLE_C_SMOKE_PROP.state)
  };
}

function validateBundleCSmokeGate_(gate) {
  if (!gate.marker) return "SMOKE_APPROVAL_MARKER_MISSING";
  if (gate.marker !== BUNDLE_C_SMOKE_APPROVAL_MARKER) return "SMOKE_APPROVAL_MARKER_INVALID";
  if (!gate.threadId) return "SMOKE_THREAD_ID_MISSING";
  if (!gate.nonce) return "SMOKE_NONCE_MISSING";
  if (!gate.state) return "SMOKE_STATE_MISSING";
  if (gate.state !== "READY") return "SMOKE_REPLAY_BLOCKED";
  return "";
}

function validateBundleCSmokeThread_(thread) {
  const collected = collectThreadMessagesAndAttachments_(thread, { includeBodies: true });
  const attachments = collected.attachments || [];
  const xmlAttachments = attachments.filter(att => String(att.getName() || "").toLowerCase().endsWith(".xml"));
  const pdfAttachments = attachments.filter(att => String(att.getName() || "").toLowerCase().endsWith(".pdf"));

  if (xmlAttachments.length === 0 && smokeBodiesContainLink_(collected.bodies || [])) {
    return smokeValidationError_("SMOKE_LINK_ONLY_BLOCKED");
  }
  if (xmlAttachments.length === 0 && pdfAttachments.length > 0) {
    return smokeValidationError_("SMOKE_PDF_ONLY_BLOCKED");
  }
  if (xmlAttachments.length !== 1) return smokeValidationError_("SMOKE_XML_COUNT_NOT_ONE");
  if (pdfAttachments.length > 1) return smokeValidationError_("SMOKE_PDF_COUNT_INVALID");

  const xml = xmlAttachments[0];
  const nature = readBundleCSmokeInvoiceNature_(xml);
  if (nature !== "ORIGINAL") return smokeValidationError_("SMOKE_NON_ORIGINAL_INVOICE");

  const parsed = parseInvoiceXML_(xml, { type: BUNDLE_C_SMOKE_DIRECTION });
  if (!isVatInvoiceXML_(parsed.meta)) return smokeValidationError_("SMOKE_XML_NOT_VAT_INVOICE");
  if (!parsed.meta?.invoiceDate || !parsed.meta?.invoiceNo || !parsed.seller?.taxCode || !parsed.seller?.name) {
    return smokeValidationError_("SMOKE_REQUIRED_FIELDS_MISSING");
  }
  if (!parsed.items || parsed.items.length < 1) return smokeValidationError_("SMOKE_REQUIRED_FIELDS_MISSING");

  const mapping = validateBundleCSmokeItemMapping_(parsed.items);
  if (!mapping.ok) return smokeValidationError_(mapping.errorCode);

  const items = [];
  const ok = processInvoiceXMLAttachment_(parsed, BUNDLE_C_SMOKE_DIRECTION, items, thread);
  if (!ok || items.length !== parsed.items.length) {
    return smokeValidationError_("SMOKE_XML_PARSE_FAILED");
  }

  const invoiceKey = buildInvoiceKey_(parsed.meta.invoiceDate, parsed.seller.taxCode, normalizeInvoiceNo_(parsed.meta.invoiceNo));

  return {
    ok: true,
    thread,
    items: items.map(x => ({ type: "IN", ...x })),
    invoiceKey,
    xml,
    pdf: pdfAttachments[0] || null,
    meta: {
      issueDate: parsed.meta.invoiceDate,
      invoiceNo: normalizeInvoiceNo_(parsed.meta.invoiceNo),
      taxCode: parsed.seller.taxCode,
      companyName: parsed.seller.name
    },
    expectedLineCount: items.length
  };
}

function validateBundleCSmokeItemMapping_(items) {
  const itemCodeList = buildItemCodeList_();
  for (const item of items || []) {
    const normalizedXmlName = normalizeTextForCompare_(item.name);
    const matches = itemCodeList.filter(x => normalizedXmlName.includes(x.normalizedName));
    if (matches.length !== 1) return { ok: false, errorCode: "SMOKE_ITEM_MAPPING_AMBIGUOUS" };
  }
  return { ok: true };
}

function validateBundleCSmokePrestate_(prepared, validation) {
  if (!prepared.length || prepared.some(x => x.status === "skip")) {
    return { ok: false, errorCode: "SMOKE_PREPARED_ROWS_INVALID" };
  }
  if (prepared.some(x => x.status === "duplicated")) {
    return { ok: false, errorCode: "SAMPLE_ALREADY_COMMITTED" };
  }

  const sampleHashCount = countBundleCSmokeLedgerHashes_(prepared.map(x => x.row[CONFIG.NHAPXUAT_INDEX.hash]));
  if (sampleHashCount > 0) return { ok: false, errorCode: "SAMPLE_ALREADY_COMMITTED" };

  const invoiceKeyCount = countBundleCSmokeLedgerInvoiceKey_(validation.invoiceKey);
  if (invoiceKeyCount > 0) return { ok: false, errorCode: "SAMPLE_ALREADY_COMMITTED" };

  const hoaDonCount = countBundleCSmokeHoaDonInvoiceKey_(validation.invoiceKey);
  const driveState = getBundleCSmokeDrivePrestate_(validation);
  if ((driveState.xmlExists || driveState.pdfExists) && hoaDonCount === 0) {
    return { ok: false, errorCode: "PREEXISTING_PARTIAL_STATE" };
  }

  return { ok: true };
}

function saveBundleCSmokeArtifacts_(validation) {
  const fileId = saveInvoiceXmlToDrive_(
    validation.xml,
    validation.meta.issueDate,
    validation.meta.taxCode,
    validation.meta.companyName,
    validation.meta.invoiceNo,
    CONFIG.INVOICE_IN_FOLDER_ID,
    "IN"
  );
  upsertHoaDonFile_(validation.invoiceKey, "XML", fileId);

  if (validation.pdf) {
    const year = getInvoiceYearFromDate_(validation.meta.issueDate) || "UNKNOWN";
    const yearFolder = getOrCreateYearFolder_(String(year), CONFIG.INVOICE_IN_FOLDER_ID);
    const fileName = buildVatPdfFileName_(validation.meta);
    const existed = findFileInFolder_(yearFolder, fileName);
    const pdfId = existed
      ? existed.getId()
      : saveInvoicePdfToDrive_(validation.pdf.copyBlob(), fileName, yearFolder);
    upsertHoaDonFile_(validation.invoiceKey, "PDF", pdfId);
  }
}

function getBundleCSmokeDrivePrestate_(validation) {
  const year = getInvoiceYearFromDate_(validation.meta.issueDate) || "UNKNOWN";
  const yearFolder = findBundleCSmokeYearFolder_(CONFIG.INVOICE_IN_FOLDER_ID, year);
  if (!yearFolder) return { xmlExists: false, pdfExists: false };

  const xmlName =
    validation.meta.issueDate.replace(/-/g, "") + "_" +
    validation.meta.taxCode + "_" +
    validation.meta.companyName + "_" +
    normalizeInvoiceNo_(validation.meta.invoiceNo) + ".xml";

  const pdfName = validation.pdf ? buildVatPdfFileName_(validation.meta) : "";

  return {
    xmlExists: fileExistsInFolder_(yearFolder, xmlName),
    pdfExists: pdfName ? fileExistsInFolder_(yearFolder, pdfName) : false
  };
}

function findBundleCSmokeYearFolder_(parentFolderId, year) {
  const parent = DriveApp.getFolderById(parentFolderId);
  const folders = parent.getFoldersByName(String(year));
  return folders.hasNext() ? folders.next() : null;
}

function countBundleCSmokeLedgerHashes_(hashes) {
  const wanted = new Set((hashes || []).filter(Boolean));
  if (!wanted.size) return 0;
  const sheet = SpreadsheetApp.getActive().getSheetByName(CONFIG.SHEET_INVOICE);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  const values = sheet.getRange(2, CONFIG.HASH_COLUME, lastRow - 1, 1).getValues().flat();
  return values.filter(v => wanted.has(v)).length;
}

function countBundleCSmokeLedgerInvoiceKey_(invoiceKey) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(CONFIG.SHEET_INVOICE);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  const invoiceKeyColumn = CONFIG.NHAPXUAT_INDEX.invoiceKey + 2;
  const values = sheet.getRange(2, invoiceKeyColumn, lastRow - 1, 1).getValues().flat();
  return values.filter(v => String(v) === String(invoiceKey)).length;
}

function countBundleCSmokeHoaDonInvoiceKey_(invoiceKey) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(CONFIG.SHEET_FILES);
  const data = sheet.getDataRange().getValues();
  const keyCol = data[0].indexOf("invoiceKey");
  if (keyCol < 0) return 0;
  return data.slice(1).filter(row => String(row[keyCol]) === String(invoiceKey)).length;
}

function readBundleCSmokeInvoiceNature_(xmlBlob) {
  try {
    const xmlDoc = loadXmlDocument_(xmlBlob);
    const ttChung = xmlDoc.getRootElement().getChild("DLHDon")?.getChild("TTChung");
    const nature = String(ttChung?.getChildText("TChat") || "").trim().toUpperCase();
    if (!nature) return "ORIGINAL";
    if (nature.includes("ADJUST") || nature.includes("DIEU CHINH")) return "ADJUSTMENT";
    if (nature.includes("REPLACE") || nature.includes("THAY THE")) return "REPLACEMENT";
    if (nature.includes("CANCEL") || nature.includes("HUY")) return "CANCELLED";
    return nature;
  } catch (err) {
    return "UNKNOWN";
  }
}

function smokeBodiesContainLink_(bodies) {
  return (bodies || []).some(msg => /https?:\/\//i.test(String(msg.getBody ? msg.getBody() : "")));
}

function blockBundleCSmoke_(props, code) {
  props.setProperty(BUNDLE_C_SMOKE_PROP.state, "BLOCKED");
  props.setProperty(BUNDLE_C_SMOKE_PROP.resultCode, code);
  props.setProperty(BUNDLE_C_SMOKE_PROP.finishedAt, new Date().toISOString());
  debugLog_("BUNDLE_C_SINGLE_THREAD_SMOKE status=BLOCKED code=" + code);
  return { status: "BLOCKED", errorCode: code };
}

function smokeValidationError_(code) {
  return { ok: false, errorCode: code };
}

function smokeHashPrefix_(value) {
  const hash = buildHashFromText_(String(value || ""));
  return hash ? hash.slice(0, 12) : "";
}

function safeBundleCSmokeErrorCode_(err) {
  const msg = String(err?.message || err || "");
  if (/SMOKE_[A-Z0-9_]+/.test(msg)) return msg.match(/SMOKE_[A-Z0-9_]+/)[0];
  if (/WRITE_FAILED/.test(msg)) return "WRITE_FAILED";
  return "SMOKE_EXECUTION_FAILED";
}
