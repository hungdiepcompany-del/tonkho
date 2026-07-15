function createGasGmailReadOnlyReader() {
  function readThread(request) {
    const evidence = readThreadEvidence(request);
    return {
      exists: evidence.exists,
      messageCount: evidence.messageCount,
      labels: evidence.labels,
      attachmentSummary: evidence.attachmentSummary,
      readStatus: evidence.readStatus
    };
  }

  function readThreadEvidence(request) {
    const threadReference = String(request && request.threadReference || '').trim();
    if (!threadReference) return { exists: false, messageCount: 0, labels: [], attachmentSummary: { xmlCount: 0, pdfCount: 0 }, xmlAttachments: [], pdfAttachmentCount: 0, pdfSource: 'NONE', readStatus: 'REFERENCE_INVALID' };
    const thread = GmailApp.getThreadById(threadReference);
    if (!thread) return { exists: false, messageCount: 0, labels: [], attachmentSummary: { xmlCount: 0, pdfCount: 0 }, xmlAttachments: [], pdfAttachmentCount: 0, pdfSource: 'NONE', readStatus: 'NOT_FOUND' };
    const messages = thread.getMessages();
    const maxMessages = Number(request && request.maxMessages || messages.length);
    const labels = thread.getLabels().map(label => label.getName());
    let xmlCount = 0;
    let pdfCount = 0;
    let pdfLinkOnly = false;
    const xmlAttachments = [];
    messages.slice(0, maxMessages).forEach(message => {
      message.getAttachments({ includeInlineImages: false }).forEach(attachment => {
        const name = String(attachment.getName() || '').toLowerCase();
        if (name.endsWith('.xml')) {
          xmlCount += 1;
          if (request && request.includeXmlText) {
            xmlAttachments.push({
              nameHashPrefix: hashD5DGmailName_(attachment.getName()),
              xmlText: attachment.getDataAsString('UTF-8')
            });
          }
        }
        if (name.endsWith('.pdf')) pdfCount += 1;
      });
      const body = String(message.getBody && message.getBody() || '');
      if (pdfCount === 0 && /https?:\/\/\S+/i.test(body) && /\.pdf\b|pdf/i.test(body)) pdfLinkOnly = true;
    });
    return {
      exists: true,
      messageCount: messages.length,
      labels,
      attachmentSummary: { xmlCount, pdfCount },
      xmlAttachments,
      pdfAttachmentCount: pdfCount,
      pdfSource: pdfCount > 0 ? 'ATTACHMENT' : pdfLinkOnly ? 'LINK_ONLY' : 'NONE',
      readStatus: 'READ_OK'
    };
  }

  return Object.freeze({ readThread, readThreadEvidence });
}

function hashD5DGmailName_(value) {
  const text = String(value || '');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (`00000000${(hash >>> 0).toString(16)}`).slice(-8);
}
