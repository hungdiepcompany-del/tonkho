import { spawnSync } from 'node:child_process';

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:9099';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'demo-sgds-local';

const result = spawnSync(
  process.execPath,
  ['--test', 'tests/emulator/*.test.mjs'],
  {
    stdio: 'inherit',
    env: process.env,
    shell: true
  }
);

process.exit(result.status ?? 1);
