import { spawnSync } from 'node:child_process';

const commands = [
  ['node', ['--test', 'tests/**/*.test.mjs']],
  ['node', ['scripts/checkers/check-bundle-b-test-foundation.mjs']],
  ['node', ['scripts/checkers/check-no-sensitive-fixtures.mjs']],
  ['node', ['scripts/checkers/check-policy-pending-markers.mjs']],
  ['node', ['scripts/checkers/check-test-metadata.mjs']],
  ['powershell.exe', ['-ExecutionPolicy', 'Bypass', '-File', 'scripts/checkers/check-doc-foundation.ps1']],
  ['powershell.exe', ['-ExecutionPolicy', 'Bypass', '-File', 'scripts/checkers/check-no-secret.ps1']],
  ['powershell.exe', ['-ExecutionPolicy', 'Bypass', '-File', 'scripts/checkers/check-runtime-unchanged.ps1']],
  ['powershell.exe', ['-ExecutionPolicy', 'Bypass', '-File', 'scripts/checkers/check-workbook-unchanged.ps1']],
  ['powershell.exe', ['-ExecutionPolicy', 'Bypass', '-File', 'scripts/checkers/check-internal-doc-links.ps1']],
  ['powershell.exe', ['-ExecutionPolicy', 'Bypass', '-File', 'scripts/checkers/check-no-runtime-modification.ps1']],
];

for (const [cmd, args] of commands) {
  const res = spawnSync(cmd, args, { stdio: 'inherit', shell: false });
  if (res.status !== 0) process.exit(res.status ?? 1);
}
console.log('BUNDLE_B_CHECK=PASS');
