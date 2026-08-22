function buildInvoiceQuery_(invoiceLabel, doneLabel1, doneLabel2) {
  const incompleteConditions = [doneLabel1, doneLabel2]
    .filter(Boolean)
    .map(label => `-label:"${label}"`);

  // PENDING is authoritative for partial states. A thread must remain
  // discoverable even when the normal done-label pair is already present.
  if (CONFIG.PENDING_LABEL) {
    incompleteConditions.push(`label:"${CONFIG.PENDING_LABEL}"`);
  }

  return [
    `label:"${invoiceLabel}"`,
    `after:${formatGmailQueryDate_(CONFIG.INVOICE_FROMDATE)}`,
    incompleteConditions.length ? `(${incompleteConditions.join(" OR ")})` : ""
  ].filter(Boolean).join(" ");
}

function searchInvoiceThreads_(query, emptyLog) {
  const threads = GmailApp.search(query, 0, CONFIG.MAX_EMAIL_SCAN);
  if (!threads.length) {
    debugLog_(emptyLog);
    return [];
  }
  return threads;
}

function formatGmailQueryDate_(date) {
  if (date instanceof Date) {
    return Utilities.formatDate(date, 'GMT+7', 'yyyy/MM/dd');
  }
  if (typeof date === 'string') {
    return date.replace(/-/g, '/');
  }
  return String(date);
}
