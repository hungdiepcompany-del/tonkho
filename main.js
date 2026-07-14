
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

    const prepared = prepareInvoiceRowsForCommit_(items, stats, {
      debugPrefix: "MAIN"
    });

    if (!prepared.some(x =>
      x.status === "accepted" || x.status === "duplicated"
    )) {
      debugLog_("Khong co dong hop le sau khi chuan hoa hash");
      projectCommitLabelsByThread_(prepared);
      return;
    }

    const commitResults = commitPreparedInvoiceRows_(prepared);
    projectCommitLabelsByThread_(commitResults);

    if (commitResults.some(x => x.writeStatus === "COMMITTED")) {
      // Main chi ghi du lieu moi va sap xep. NX/TK la job nang, chay qua menu/sidebar.
      sortSheetBySTT_();
    }
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
