function clearLog() {
  const sh = SpreadsheetApp.getActive().getSheetByName("FileLog");
  if (sh) sh.clearContents();
}

function appendFileLogEntries_(entries) {
  const rows = Array.isArray(entries) ? entries.filter(row => Array.isArray(row) && row.length === 4) : [];
  if (!rows.length) return;
  const sh = getOrCreateASheet_(CONFIG.SHEET_LOG);
  if (sh.getLastRow() < 1) {
    sh.getRange(1, 1, 1, 4).setValues([["Run ID", "Stage", "Dong NX", "Dien giai"]]);
  }
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, 4).setValues(rows);
}
