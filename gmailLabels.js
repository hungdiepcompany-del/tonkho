function getOrCreateLabel_(name) {
  return GmailApp.getUserLabelByName(name)
    || GmailApp.createLabel(name);
}

function threadHasAllLabel_(thread, labelNames = []) {
  const set = new Set(thread.getLabels().map(l => l.getName()));
  return labelNames.every(n => set.has(n));
}

function setExclusiveLabel_(thread, target) {
  const labelSaved = getOrCreateLabel_(CONFIG.SAVE_SHEET_LABEL);
  const labelPending = getOrCreateLabel_(CONFIG.PENDING_LABEL);

  switch (target) {
    case 'SAVED_SHEET':
      thread.addLabel(labelSaved);
      thread.removeLabel(labelPending);
      break;
    case 'PENDING':
      thread.addLabel(labelPending);
      thread.removeLabel(labelSaved);
      break;
  }
}

function initInvoiceProcessLabels_(options = {}) {
  const labels = {
    saveSheetLabel: getOrCreateLabel_(CONFIG.SAVE_SHEET_LABEL),
    pendingLabel: getOrCreateLabel_(CONFIG.PENDING_LABEL)
  };

  if (options.includePdf) {
    labels.savePdfLabel = getOrCreateLabel_(CONFIG.SAVE_PDF_LABEL);
  }

  if (options.includeXml) {
    labels.saveXmlLabel = getOrCreateLabel_(CONFIG.SAVE_XML_LABEL);
  }

  if (options.includeLink) {
    labels.saveLinkLabel = getOrCreateLabel_(CONFIG.SAVE_LINK_LABEL);
  }

  return labels;
}

function threadHasLabels_(thread, labelNames) {
  const labelSet = new Set(thread.getLabels().map(l => l.getName()));
  Utilities.sleep(200); // cho Gmail sync
  const labelSet2 = new Set(thread.getLabels().map(l => l.getName()));

  return labelNames.every(n =>
    labelSet.has(n) || labelSet2.has(n)
  );
}

// Chỉ để DEBUG / TOOL
function deleteAndRecreateGmailLabels_() {

  const labelKeys = [
    "PENDING_LABEL",
    "SAVE_SHEET_LABEL",
    "SAVE_PDF_LABEL",
    "SAVE_XML_LABEL",
    "SAVE_LINK_LABEL"
  ];

  labelKeys.forEach(key => {
    const name = CONFIG[key];
    if (!name) return;

    // Xóa nếu tồn tại
    const oldLabel = GmailApp.getUserLabelByName(name);
    if (oldLabel) {
      oldLabel.deleteLabel();
    }

    // Tạo lại label
    GmailApp.createLabel(name);
  });

  debugLog_("Hoàn tất xóa & tạo lại Gmail labels");
}

