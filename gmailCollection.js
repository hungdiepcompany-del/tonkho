function collectThreadMessagesAndAttachments_(thread, options = {}) {
  const includeBodies = options.includeBodies === true;

  EmailDedupService.resetThreadCache();

  const messages = thread.getMessages();
  const attachments = [];
  const bodies = [];

  for (const msg of messages) {
    if (EmailDedupService.isDuplicateBodyInThread(msg)) continue;

    if (includeBodies) {
      bodies.push(msg);
    }

    const atts = msg.getAttachments({
      includeInlineImages: false,
      includeAttachments: true,
    });
    attachments.push(...atts);
  }

  return includeBodies
    ? { attachments, bodies }
    : { attachments };
}
