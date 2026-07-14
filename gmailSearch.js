function buildInvoiceQuery_(invoiceLabel, doneLabel1, doneLabel2) {
  return [
    `label:"${invoiceLabel}"`,
    `after:${formatGmailQueryDate_(CONFIG.INVOICE_FROMDATE)}`,
    `(-label:"${doneLabel1}" OR -label:"${doneLabel2}")`
  ].join(" ");
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
