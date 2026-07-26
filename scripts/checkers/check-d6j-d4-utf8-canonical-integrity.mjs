import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export const D6J_D4_MOJIBAKE_PATTERNS = Object.freeze([
  '\u00C3\u0192',
  '\u00C3\u201A',
  '\u00C3\u201E',
  '\u00C3\u00A1\u00C2\u00BA',
  '\u00C3\u00A1\u00C2\u00BB',
  '\u00C3\u00A2\u00E2\u201A\u00AC'
]);

export function findD6jD4MojibakeIndicatorsInSource(sourceText) {
  const text = String(sourceText || '');
  const findings = [];
  D6J_D4_MOJIBAKE_PATTERNS.forEach(pattern => {
    let index = text.indexOf(pattern);
    while (index >= 0) {
      findings.push({ pattern, index });
      index = text.indexOf(pattern, index + pattern.length);
    }
  });
  return findings;
}

function run() {
  const productionSources = [
    'd6jD4PostRepairVerificationReadOnly.js',
    'd6jBProductionDryRunReadOnly.js'
  ];
  const findings = productionSources.flatMap(file => {
    const source = fs.readFileSync(file, 'utf8');
    return findD6jD4MojibakeIndicatorsInSource(source).map(finding => ({ file, ...finding }));
  });
  assert.equal(findings.length, 0, `mojibake indicators found: ${JSON.stringify(findings)}`);
  console.log('VIETNAMESE_SOURCE_ENCODING_INTEGRITY=PASS');
  console.log('MOJIBAKE_PATTERN_COUNT=0');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run();
}
