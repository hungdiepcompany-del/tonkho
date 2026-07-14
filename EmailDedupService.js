/* ===============================
 * EMAIL DEDUP SERVICE v2
 * =============================== */

const EmailDedupService = (() => {

  // Cache trong 1 lần scan
  const threadSeen = new Set();

  /* ===============================
   * NORMALIZE HELPERS
   * =============================== */

  function normalizeCommon_(text) {
    return String(text || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  function normalizeEmailBody_(body) {
    return normalizeCommon_(
      body
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
    );
  }

  function normalizeXml_(xmlText) {
    return normalizeCommon_(
      xmlText
        .replace(/<!--[\s\S]*?-->/g, '') // remove comments
        .replace(/>\s+</g, '><')          // collapse whitespace
    );
  }

  /* ===============================
   * HASH WRAPPER
   * =============================== */

  function hashText_(text) {
    return buildHashFromText_(text); // 🔑 dùng chung
  }

  /* ===============================
   * BODY
   * =============================== */

  function isDuplicateBodyInThread_(msg) {
    const norm = normalizeEmailBody_(msg.getBody());
    if (!norm) return false;

    const hash = hashText_(norm);
    if (threadSeen.has(hash)) return true;

    threadSeen.add(hash);
    return false;
  }

  /* ===============================
   * ATTACHMENTS (XML / TEXT)
   * =============================== */

  function isDuplicateAttachment_(blob, type = 'AUTO') {
    let text = '';

    if (type === 'XML' || blob.getName().toLowerCase().endsWith('.xml')) {
      text = normalizeXml_(blob.getDataAsString('UTF-8'));
    } else {
      text = normalizeCommon_(blob.getDataAsString('UTF-8'));
    }

    if (!text) return false;

    const hash = hashText_(text);
    if (threadSeen.has(hash)) return true;

    threadSeen.add(hash);
    return false;
  }

  /* ===============================
   * RESET (per thread)
   * =============================== */

  function resetThreadCache_() {
    threadSeen.clear();
  }

  return {
    resetThreadCache: resetThreadCache_,
    isDuplicateBodyInThread: isDuplicateBodyInThread_,
    isDuplicateAttachment: isDuplicateAttachment_
  };

})();
