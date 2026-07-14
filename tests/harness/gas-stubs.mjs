import { createHash } from 'node:crypto';

function fail(name) {
  return () => {
    throw new Error(`GAS_STUB_NOT_CONFIGURED: ${name}`);
  };
}

class XmlElement {
  constructor(name, text = '') {
    this.name = name;
    this.text = text;
    this.children = [];
  }
  getChild(name) {
    return this.children.find((c) => c.name === name) || null;
  }
  getChildren(name) {
    return this.children.filter((c) => c.name === name);
  }
  getChildText(name) {
    const child = this.getChild(name);
    return child ? child.getText() : null;
  }
  getText() {
    if (this.children.length) return this.children.map((c) => c.getText()).join('');
    return this.text;
  }
}

function parseSimpleXml(xml) {
  const input = String(xml || '').replace(/<\?xml[\s\S]*?\?>/g, '').trim();
  const rootMatch = input.match(/^<([A-Za-z0-9_:-]+)(?:\s[^>]*)?>([\s\S]*)<\/\1>$/);
  if (!rootMatch) throw new Error('XML_PARSE_ERROR');
  function build(name, body) {
    const el = new XmlElement(name);
    let pos = 0;
    const childRe = /<([A-Za-z0-9_:-]+)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/g;
    let m;
    while ((m = childRe.exec(body)) !== null) {
      if (m.index > pos) {
        const text = body.slice(pos, m.index).trim();
        if (text) el.text += text;
      }
      el.children.push(build(m[1], m[2]));
      pos = childRe.lastIndex;
    }
    if (!el.children.length) {
      el.text = body.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
    }
    return el;
  }
  return { getRootElement: () => build(rootMatch[1], rootMatch[2]) };
}

export function createGasStubs(overrides = {}) {
  const cacheStore = new Map();
  const props = new Map();
  const stubs = {
    Utilities: {
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      Charset: { UTF_8: 'UTF-8' },
      computeDigest(algorithm, text) {
        if (algorithm !== 'SHA_256') throw new Error(`GAS_STUB_NOT_CONFIGURED: Utilities.computeDigest.${algorithm}`);
        return [...createHash('sha256').update(String(text), 'utf8').digest()].map((b) => (b > 127 ? b - 256 : b));
      },
      formatDate(value, _tz, pattern) {
        const d = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(d.getTime())) throw new Error('GAS_STUB_INVALID_DATE');
        const yyyy = String(d.getFullYear()).padStart(4, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const mi = String(d.getMinutes()).padStart(2, '0');
        return pattern.replace('yyyy', yyyy).replace('MM', mm).replace('dd', dd).replace('HH', hh).replace('mm', mi);
      },
      getUuid: () => '00000000-0000-4000-8000-000000000000',
      sleep: () => {},
    },
    Session: {
      getScriptTimeZone: () => 'Asia/Ho_Chi_Minh',
      getEffectiveUser: () => ({ getEmail: () => 'hungdiepcompany@gmail.com' }),
    },
    Logger: { log: (...args) => args.join(' ') },
    XmlService: { parse: parseSimpleXml },
    MimeType: { GOOGLE_DOCS: 'application/vnd.google-apps.document' },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => props.get(k) || null,
        setProperty: (k, v) => props.set(k, String(v)),
        deleteProperty: (k) => props.delete(k),
      }),
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => cacheStore.get(k) || null,
        put: (k, v) => cacheStore.set(k, String(v)),
        remove: (k) => cacheStore.delete(k),
      }),
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    SpreadsheetApp: { getActive: fail('SpreadsheetApp.getActive'), openById: fail('SpreadsheetApp.openById') },
    GmailApp: new Proxy({}, { get: (_t, p) => fail(`GmailApp.${String(p)}`) }),
    DriveApp: new Proxy({}, { get: (_t, p) => fail(`DriveApp.${String(p)}`) }),
    UrlFetchApp: { fetch: fail('UrlFetchApp.fetch') },
    DocumentApp: { openById: fail('DocumentApp.openById') },
    SlidesApp: { openById: fail('SlidesApp.openById') },
    ScriptApp: { getProjectTriggers: fail('ScriptApp.getProjectTriggers') },
    Drive: { Files: { insert: fail('Drive.Files.insert') } },
  };
  return { ...stubs, ...overrides };
}
