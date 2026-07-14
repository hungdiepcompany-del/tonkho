function main() {
  // SECURITY PIPELINE
  assertScriptOwner_();
  auditTriggers_();
  assertAntiReplayTrigger_();
  assertTriggerMinuteSignature_();

  _mainInternal_();
}

function _mainInternal_() {
  const t0 = Date.now();

  if (CONFIG.DELETE_LABELS_ON_RUN) {
    deleteAndRecreateGmailLabels_();
  }

  if (CONFIG.RESET_PROPERTIES_ON_RUN) {
    clearAllScriptProperties_();
  }

  const stats = createProcessStats_();
  const threadSet = new Set();
  const { dic, dicVietTat } = loadVietTatDictionary_();

  try {
    const items = [
      ...scanInvoiceOutEmails_().map(x => ({ type: "OUT", ...x })),
      ...scanInvoiceInEmails_().map(x => ({ type: "IN", ...x }))
    ];

    ensureViewFormula_();

    stats.scanned = items.length;
    if (!items.length) {
      debugLog_("Khong co email IN/OUT nao duoc xu ly");
      return;
    }

    items.forEach(x => {
      if (x.thread) threadSet.add(x.thread);
    });

    const rowsWithHash = items.map(({ type, row }, i) => {
      stats[type.toLowerCase()].scanned++;

      const r = row || [];
      r[2] = normalizeCustomerName_(r[2], dic, dicVietTat);

      // invoiceKey da co san tu buoc parse XML.
      const invoiceKey = r[8] || "";

      const values = {
        invoiceDate: r[0],
        invoiceNo: r[1],
        customerName: r[2],
        itemCode: r[3],
        itemName: r[4],
        invoiceType: r[5],
        qty: r[6]
      };

      const hash = buildInvoiceItemHash_(
        values,
        CONFIG.DEBUG_HASH ? `MAIN ${type} row ${i + 1}` : ""
      );

      if (!hash) stats.emptyHash++;
      else stats.hashed++;

      const rowOut = [];
      rowOut[CONFIG.NHAPXUAT_INDEX.invoiceDate] = r[0];
      rowOut[CONFIG.NHAPXUAT_INDEX.invoiceNo] = r[1];
      rowOut[CONFIG.NHAPXUAT_INDEX.customerName] = r[2];
      rowOut[CONFIG.NHAPXUAT_INDEX.itemCode] = r[3];
      rowOut[CONFIG.NHAPXUAT_INDEX.itemName] = r[4];
      rowOut[CONFIG.NHAPXUAT_INDEX.invoiceType] = r[5];
      rowOut[CONFIG.NHAPXUAT_INDEX.qty] = r[6];
      rowOut[CONFIG.NHAPXUAT_INDEX.price] = r[7];
      rowOut[CONFIG.NHAPXUAT_INDEX.hash] = hash;
      rowOut[CONFIG.NHAPXUAT_INDEX.invoiceKey] = invoiceKey;

      return { type, row: rowOut };
    });

    const processed = filterRowsByHashIndex_(rowsWithHash, stats);

    if (!processed.some(x =>
      x.status === "accepted" || x.status === "duplicated"
    )) {
      debugLog_("Khong co dong hop le sau khi chuan hoa hash");
      return;
    }

    let writeOk = false;

    try {
      const acceptedRows = processed
        .filter(x => x.status === "accepted")
        .map(x => x.row);

      if (acceptedRows.length) {
        writeInvoicesToSheet_(acceptedRows);
      }

      writeOk = true;
    } catch (err) {
      debugLog_("LOI GHI SHEET: " + err.message);
    }

    const targetLabel = writeOk ? "SAVED_SHEET" : "PENDING";
    threadSet.forEach(thread => {
      setExclusiveLabel_(thread, targetLabel);
    });

    // Main chi ghi du lieu moi va sap xep. NX/TK la job nang, chay qua menu/sidebar.
    sortSheetBySTT_();
  } finally {
    Logger.log(
      "THONG KE HOA DON\n" +
      `- Tong quet: ${stats.scanned}\n\n` +
      "HOA DON DAU VAO\n" +
      `  - Quet: ${stats.in.scanned}\n` +
      `  - Trung: ${stats.in.duplicate}\n` +
      `  - Ghi moi: ${stats.in.accepted}\n\n` +
      "HOA DON DAU RA\n" +
      `  - Quet: ${stats.out.scanned}\n` +
      `  - Trung: ${stats.out.duplicate}\n` +
      `  - Ghi moi: ${stats.out.accepted}\n\n` +
      `- Thoi gian xu ly: ${((Date.now() - t0) / 1000).toFixed(2)}s`
    );
  }
}
