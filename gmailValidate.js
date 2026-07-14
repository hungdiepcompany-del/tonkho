function validateGmailInvoiceLabel_(labelName) {
  const label = GmailApp.getUserLabelByName(labelName);
  if (!label) {
    throw new Error("Không tìm thấy label: " + labelName);
  }
  return label;
}