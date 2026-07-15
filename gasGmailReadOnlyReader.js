function createGasGmailReadOnlyReader() {
  function readThread(request) {
    const threadReference = String(request && request.threadReference || '').trim();
    if (!threadReference) return { exists: false, messageCount: 0, labels: [], attachmentSummary: { xmlCount: 0, pdfCount: 0 } };
    const thread = GmailApp.getThreadById(threadReference);
    if (!thread) return { exists: false, messageCount: 0, labels: [], attachmentSummary: { xmlCount: 0, pdfCount: 0 } };
    const messages = thread.getMessages();
    const maxMessages = Number(request && request.maxMessages || messages.length);
    const labels = thread.getLabels().map(label => label.getName());
    let xmlCount = 0;
    let pdfCount = 0;
    messages.slice(0, maxMessages).forEach(message => {
      message.getAttachments({ includeInlineImages: false }).forEach(attachment => {
        const name = String(attachment.getName() || '').toLowerCase();
        if (name.endsWith('.xml')) xmlCount += 1;
        if (name.endsWith('.pdf')) pdfCount += 1;
      });
    });
    return {
      exists: true,
      messageCount: messages.length,
      labels,
      attachmentSummary: { xmlCount, pdfCount }
    };
  }

  return Object.freeze({ readThread });
}
