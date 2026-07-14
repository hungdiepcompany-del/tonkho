function clearLog() {
  const sh = SpreadsheetApp.getActive().getSheetByName("FileLog");
  if (sh) sh.clearContents();
}
