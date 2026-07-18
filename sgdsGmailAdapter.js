const SGDS_GMAIL_ADAPTER_CONTRACT_ = Object.freeze({
  D6C: 'GMAIL_ADAPTER',
  readOperations: Object.freeze([
    'searchCandidateThreads',
    'readThreadMetadata',
    'readMessage',
    'listAttachments',
    'readAttachmentContent',
    'readLabels'
  ]),
  mutationOperations: Object.freeze([
    'applyProcessingLabel',
    'removeTemporaryLabel'
  ]),
  cursorModel: 'bounded_query_plus_thread_message_checkpoint',
  idempotencyModel: 'threadId+messageId+attachmentId+contentHash+invoiceKeyV2'
});

function createSgdsGmailReadAdapter_(deps) {
  const source = requireSgdsAdapterMethod_(deps && deps.source, 'gmailSource', [
    'searchCandidateThreads',
    'readThread',
    'readMessage',
    'readAttachmentContent'
  ]);
  return Object.freeze({
    async searchCandidateThreads(request) {
      const result = await source.searchCandidateThreads(cloneSgdsAdapterJson_(request || {}));
      return (Array.isArray(result) ? result : []).map(normalizeSgdsGmailThread_);
    },
    async readThreadMetadata(request) {
      const thread = await source.readThread(cloneSgdsAdapterJson_(request || {}));
      return normalizeSgdsGmailThread_(thread);
    },
    async readMessage(request) {
      const message = await source.readMessage(cloneSgdsAdapterJson_(request || {}));
      return normalizeSgdsGmailMessage_(message);
    },
    async listAttachments(request) {
      const message = await source.readMessage(cloneSgdsAdapterJson_(request || {}));
      return normalizeSgdsGmailMessage_(message).attachments;
    },
    async readAttachmentContent(request) {
      const content = await source.readAttachmentContent(cloneSgdsAdapterJson_(request || {}));
      return normalizeSgdsGmailAttachmentContent_(content);
    },
    async readLabels(request) {
      const thread = await source.readThread(cloneSgdsAdapterJson_(request || {}));
      return normalizeSgdsGmailLabels_(thread && thread.labels);
    }
  });
}

function createSgdsGmailMutationAdapter_(deps) {
  const source = requireSgdsAdapterMethod_(deps && deps.source, 'gmailMutationSource', [
    'applyProcessingLabel',
    'removeTemporaryLabel',
    'readThread'
  ]);
  return Object.freeze({
    async applyProcessingLabel(request) {
      requireSgdsIdempotencyKey_(request);
      return normalizeSgdsMutationResult_(await source.applyProcessingLabel(cloneSgdsAdapterJson_(request || {})));
    },
    async removeTemporaryLabel(request) {
      requireSgdsIdempotencyKey_(request);
      return normalizeSgdsMutationResult_(await source.removeTemporaryLabel(cloneSgdsAdapterJson_(request || {})));
    },
    async verifyLabels(request) {
      const thread = await source.readThread(cloneSgdsAdapterJson_(request || {}));
      return { labels: normalizeSgdsGmailLabels_(thread && thread.labels), status: 'READ_OK' };
    }
  });
}

function createSgdsGmailJobCandidates_(threadDto) {
  const thread = normalizeSgdsGmailThread_(threadDto || {});
  const candidates = [];
  thread.messages.forEach(message => {
    const xmlAttachments = message.attachments.filter(att => att.artifactType === 'XML');
    const pdfAttachments = message.attachments.filter(att => att.artifactType === 'PDF');
    const linkAttachments = message.attachments.filter(att => att.artifactType === 'LINK');
    xmlAttachments.forEach(att => {
      candidates.push({
        sourceType: 'GMAIL',
        reviewRequired: false,
        reviewReason: '',
        threadId: thread.threadId,
        messageId: message.messageId,
        attachmentId: att.attachmentId,
        attachmentKind: 'XML',
        attachmentContentHash: att.contentHash,
        invoiceJobIdentity: buildSgdsGmailJobIdentity_(thread, message, att),
        companionPdfCount: pdfAttachments.length,
        labelNames: thread.labels.slice()
      });
    });
    if (!xmlAttachments.length && pdfAttachments.length) {
      pdfAttachments.forEach(att => {
        candidates.push({
          sourceType: 'GMAIL',
          reviewRequired: true,
          reviewReason: 'PDF_ONLY_REVIEW_REQUIRED',
          threadId: thread.threadId,
          messageId: message.messageId,
          attachmentId: att.attachmentId,
          attachmentKind: 'PDF',
          attachmentContentHash: att.contentHash,
          invoiceJobIdentity: buildSgdsGmailJobIdentity_(thread, message, att),
          companionPdfCount: pdfAttachments.length,
          labelNames: thread.labels.slice()
        });
      });
    }
    if (!xmlAttachments.length && !pdfAttachments.length && linkAttachments.length) {
      linkAttachments.forEach(att => {
        candidates.push({
          sourceType: 'GMAIL',
          reviewRequired: true,
          reviewReason: 'LINK_ONLY_REVIEW_REQUIRED',
          threadId: thread.threadId,
          messageId: message.messageId,
          attachmentId: att.attachmentId,
          attachmentKind: 'LINK',
          attachmentContentHash: att.contentHash,
          invoiceJobIdentity: buildSgdsGmailJobIdentity_(thread, message, att),
          companionPdfCount: 0,
          labelNames: thread.labels.slice()
        });
      });
    }
  });
  const seen = {};
  return candidates.filter(candidate => {
    if (seen[candidate.invoiceJobIdentity]) return false;
    seen[candidate.invoiceJobIdentity] = true;
    return true;
  });
}

function createFakeSgdsGmailAdapter_(options) {
  const state = {
    threads: cloneSgdsAdapterJson_((options && options.threads) || []),
    mutationLog: []
  };
  const calls = [];
  function record(method, request) {
    calls.push({ method, request: cloneSgdsAdapterJson_(request || {}) });
  }
  function findThread(threadId) {
    return state.threads.find(thread => thread.threadId === threadId || thread.threadReference === threadId);
  }
  const source = {
    async searchCandidateThreads(request) {
      record('gmail.searchCandidateThreads', request);
      const limit = Math.max(1, Number(request && request.limit || state.threads.length || 1));
      return state.threads.slice(0, limit).map(normalizeSgdsGmailThread_);
    },
    async readThread(request) {
      record('gmail.readThread', request);
      const thread = findThread(request && (request.threadId || request.threadReference));
      if (!thread) throw createSgdsAdapterError_(SGDS_ADAPTER_ERROR_CODES_.NOT_FOUND, 'gmail thread not found');
      return normalizeSgdsGmailThread_(thread);
    },
    async readMessage(request) {
      record('gmail.readMessage', request);
      const thread = findThread(request && (request.threadId || request.threadReference));
      const message = thread && (thread.messages || []).find(item => item.messageId === request.messageId);
      if (!message) throw createSgdsAdapterError_(SGDS_ADAPTER_ERROR_CODES_.NOT_FOUND, 'gmail message not found');
      return normalizeSgdsGmailMessage_(message);
    },
    async readAttachmentContent(request) {
      record('gmail.readAttachmentContent', request);
      const thread = findThread(request && (request.threadId || request.threadReference));
      const messages = thread ? (thread.messages || []) : [];
      for (const message of messages) {
        const attachment = (message.attachments || []).find(item => item.attachmentId === request.attachmentId);
        if (attachment) {
          return normalizeSgdsGmailAttachmentContent_({
            attachmentId: attachment.attachmentId,
            contentHash: attachment.contentHash,
            byteSize: attachment.byteSize,
            bytes: request && request.includeBytes ? (attachment.bytes || '') : ''
          });
        }
      }
      throw createSgdsAdapterError_(SGDS_ADAPTER_ERROR_CODES_.NOT_FOUND, 'gmail attachment not found');
    },
    async applyProcessingLabel(request) {
      record('gmail.applyProcessingLabel', request);
      const thread = findThread(request && (request.threadId || request.threadReference));
      if (!thread) throw createSgdsAdapterError_(SGDS_ADAPTER_ERROR_CODES_.NOT_FOUND, 'gmail thread not found');
      const label = safeSgdsAdapterString_(request && request.labelName);
      thread.labels = normalizeSgdsGmailLabels_((thread.labels || []).concat([label]));
      state.mutationLog.push({ method: 'applyProcessingLabel', threadId: thread.threadId, labelName: label, idempotencyKey: request.idempotencyKey });
      return { status: 'CONFIRMED_WRITTEN', idempotent: false };
    },
    async removeTemporaryLabel(request) {
      record('gmail.removeTemporaryLabel', request);
      const thread = findThread(request && (request.threadId || request.threadReference));
      if (!thread) throw createSgdsAdapterError_(SGDS_ADAPTER_ERROR_CODES_.NOT_FOUND, 'gmail thread not found');
      const label = safeSgdsAdapterString_(request && request.labelName);
      thread.labels = normalizeSgdsGmailLabels_(thread.labels || []).filter(item => item !== label);
      state.mutationLog.push({ method: 'removeTemporaryLabel', threadId: thread.threadId, labelName: label, idempotencyKey: request.idempotencyKey });
      return { status: 'CONFIRMED_WRITTEN', idempotent: false };
    }
  };
  return Object.freeze({
    read: createSgdsGmailReadAdapter_({ source }),
    mutate: createSgdsGmailMutationAdapter_({ source }),
    state,
    calls
  });
}

function normalizeSgdsGmailThread_(thread) {
  const source = cloneSgdsAdapterJson_(thread || {});
  return {
    threadId: safeSgdsAdapterString_(source.threadId || source.threadReference),
    historyId: safeSgdsAdapterString_(source.historyId || ''),
    messageCount: Array.isArray(source.messages) ? source.messages.length : Number(source.messageCount || 0),
    labels: normalizeSgdsGmailLabels_(source.labels),
    messages: (Array.isArray(source.messages) ? source.messages : []).map(normalizeSgdsGmailMessage_)
  };
}

function normalizeSgdsGmailMessage_(message) {
  const source = cloneSgdsAdapterJson_(message || {});
  return {
    messageId: safeSgdsAdapterString_(source.messageId),
    threadId: safeSgdsAdapterString_(source.threadId),
    order: Number(source.order || 0),
    internalDate: safeSgdsAdapterString_(source.internalDate || source.receivedAt || ''),
    sender: safeSgdsAdapterString_(source.sender || source.from || ''),
    recipients: Array.isArray(source.recipients) ? source.recipients.map(safeSgdsAdapterString_) : [],
    subject: safeSgdsAdapterString_(source.subject),
    bodyPreview: safeSgdsAdapterString_(source.bodyPreview || source.plainTextBody || '').slice(0, 500),
    semanticType: safeSgdsAdapterString_(source.semanticType || 'invoice'),
    attachments: (Array.isArray(source.attachments) ? source.attachments : []).map(normalizeSgdsGmailAttachment_)
  };
}

function normalizeSgdsGmailAttachment_(attachment) {
  const source = cloneSgdsAdapterJson_(attachment || {});
  const fileName = safeSgdsAdapterString_(source.fileName || source.name);
  const mimeType = safeSgdsAdapterString_(source.mimeType);
  return {
    attachmentId: safeSgdsAdapterString_(source.attachmentId || source.id || fileName),
    fileName,
    fileNameHashPrefix: sgdsAdapterHashPrefix_(fileName),
    mimeType,
    byteSize: Number(source.byteSize || source.size || 0),
    contentHash: safeSgdsAdapterString_(source.contentHash || source.sha256 || ''),
    artifactType: classifySgdsGmailAttachment_(fileName, mimeType, source.artifactType)
  };
}

function normalizeSgdsGmailAttachmentContent_(content) {
  const source = cloneSgdsAdapterJson_(content || {});
  return {
    attachmentId: safeSgdsAdapterString_(source.attachmentId),
    contentHash: safeSgdsAdapterString_(source.contentHash || source.sha256 || ''),
    byteSize: Number(source.byteSize || 0),
    bytes: safeSgdsAdapterString_(source.bytes || '').slice(0, Number(source.maxBytes || 200000))
  };
}

function normalizeSgdsGmailLabels_(labels) {
  const seen = {};
  return (Array.isArray(labels) ? labels : []).map(safeSgdsAdapterString_).filter(label => {
    if (!label || seen[label]) return false;
    seen[label] = true;
    return true;
  }).sort();
}

function classifySgdsGmailAttachment_(fileName, mimeType, explicit) {
  const value = safeSgdsAdapterString_(explicit).toUpperCase();
  if (value === 'XML' || value === 'PDF' || value === 'LINK') return value;
  const name = safeSgdsAdapterString_(fileName).toLowerCase();
  const mime = safeSgdsAdapterString_(mimeType).toLowerCase();
  if (name.endsWith('.xml') || mime.includes('xml')) return 'XML';
  if (name.endsWith('.pdf') || mime.includes('pdf')) return 'PDF';
  if (mime.includes('html') || name.endsWith('.html') || name.endsWith('.url')) return 'LINK';
  return 'OTHER';
}

function buildSgdsGmailJobIdentity_(thread, message, attachment) {
  return [
    'gmail',
    thread.threadId,
    message.messageId,
    attachment.attachmentId,
    attachment.contentHash,
    attachment.artifactType
  ].map(safeSgdsAdapterString_).join('|');
}

function requireSgdsIdempotencyKey_(request) {
  if (!safeSgdsAdapterString_(request && request.idempotencyKey)) {
    throw createSgdsAdapterError_(SGDS_ADAPTER_ERROR_CODES_.CONTRACT, 'idempotency key required');
  }
}

function normalizeSgdsMutationResult_(result) {
  const source = cloneSgdsAdapterJson_(result || {});
  return {
    status: safeSgdsAdapterString_(source.status || 'CONFIRMED_WRITTEN'),
    idempotent: Boolean(source.idempotent),
    safeDetails: cloneSgdsAdapterJson_(source.safeDetails || {})
  };
}

function sgdsAdapterHashPrefix_(value) {
  let hash = 0;
  const text = safeSgdsAdapterString_(value);
  for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  return ('00000000' + (hash >>> 0).toString(16)).slice(-8);
}
