import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createGasStubs } from './gas-stubs.mjs';

export const FORBIDDEN_ENTRYPOINTS = new Set([
  'main',
  'mainRun',
  'triggerMarkAllInvoiceEmails',
  'triggerScanInvoiceDriveFolder',
  'capNhatNhapXuatBQGQ',
  'capNhatTonKho',
  'onOpen',
  'onEdit',
  'doGet',
]);

export function loadGasSource({ root = process.cwd(), files = [], exportNames = [], stubs = {} } = {}) {
  const context = vm.createContext({
    console,
    ...createGasStubs(stubs),
  });
  for (const file of files) {
    const full = path.join(root, file);
    const code = fs.readFileSync(full, 'utf8');
    vm.runInContext(code, context, { filename: file, timeout: 1000 });
  }
  const exportsCode = `globalThis.__gasExports = {${exportNames.map((name) => `${JSON.stringify(name)}: (typeof ${name} === 'undefined' ? undefined : ${name})`).join(',')}};`;
  vm.runInContext(exportsCode, context, { filename: 'gas-export-map', timeout: 500 });
  for (const [name, value] of Object.entries(context.__gasExports)) {
    if (value === undefined) throw new Error(`GAS_FUNCTION_NOT_LOADED: ${name}`);
  }
  return {
    context,
    exports: context.__gasExports,
    call(name, ...args) {
      if (FORBIDDEN_ENTRYPOINTS.has(name)) throw new Error(`RUNTIME_ENTRYPOINT_FORBIDDEN: ${name}`);
      const fn = context.__gasExports[name];
      if (typeof fn !== 'function') throw new Error(`GAS_FUNCTION_NOT_CALLABLE: ${name}`);
      return fn(...args);
    },
  };
}
