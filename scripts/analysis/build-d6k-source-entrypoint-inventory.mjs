import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FROZEN_D6J_ENTRYPOINTS = new Set([
  'runD6jCOneRecordProductionMutation',
  'runD6jDRepairSingleMalformedPilotRow',
  'runD6jD4CFirestoreEvidenceDiagnosticsReadOnly',
  'runD6jD4DReconciliationPreviewReadOnly',
  'runD6jD4DRecordPostHocReconciliationEvidenceOnce',
  'runD6jD4PostRepairVerificationReadOnly'
]);

const TEXT_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.html', '.json', '.md', '.ps1', '.bat', '.txt', '.rules'
]);

const SKIP_DIRS = new Set(['.git', 'node_modules', '.firebase', 'dist', 'build', 'artifacts']);

function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

function stableSort(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
}

function listFiles(root) {
  const output = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        output.push(toPosix(path.relative(root, full)));
      }
    }
  }
  walk(root);
  return output.sort((a, b) => a.localeCompare(b));
}

function isTextFile(file) {
  return TEXT_EXTENSIONS.has(path.extname(file).toLowerCase());
}

function isRootAppsScriptRuntimeFile(file) {
  return path.extname(file).toLowerCase() === '.js' && !file.includes('/');
}

function read(root, file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function stripCommentsAndStringsForScanning(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, match => '\n'.repeat(match.split('\n').length - 1))
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/`(?:\\.|[^`\\])*`/g, '``');
}

function collectTopLevelDeclarations(source) {
  const scan = stripCommentsAndStringsForScanning(source);
  const lines = scan.split(/\r?\n/);
  const originalLines = source.split(/\r?\n/);
  const declarations = [];
  let depth = 0;

  lines.forEach((line, index) => {
    const beforeDepth = depth;
    if (beforeDepth === 0) {
      const functionMatch = line.match(/^\s*(async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/);
      if (functionMatch) {
        declarations.push({
          kind: 'function',
          async: Boolean(functionMatch[1]),
          name: functionMatch[2],
          line: index + 1,
          sourceLine: originalLines[index] ?? ''
        });
      }
      const variableMatch = line.match(/^\s*(const|let|var)\s+([A-Za-z_$][\w$]*)\b/);
      if (variableMatch) {
        declarations.push({
          kind: variableMatch[1],
          name: variableMatch[2],
          line: index + 1,
          sourceLine: originalLines[index] ?? ''
        });
      }
    }
    const open = (line.match(/\{/g) ?? []).length;
    const close = (line.match(/\}/g) ?? []).length;
    depth = Math.max(0, depth + open - close);
  });

  return declarations;
}

function extractFunctionBody(source, declaration) {
  const start = source.indexOf(declaration.sourceLine);
  if (start < 0) return '';
  const braceStart = source.indexOf('{', start);
  if (braceStart < 0) return '';
  let depth = 0;
  for (let i = braceStart; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(braceStart, i + 1);
    }
  }
  return source.slice(braceStart);
}

function inferResponsibility(file) {
  const name = path.basename(file).toLowerCase();
  if (name.includes('gmail')) return 'Gmail invoice discovery and labeling';
  if (name.includes('drive')) return 'Drive evidence storage and lookup';
  if (name.includes('sheet') || name.includes('hoadon') || name.includes('viet')) return 'Google Sheets ledger and UI handling';
  if (name.includes('firestore') || name.includes('durable') || name.includes('checkpoint')) return 'Firestore durable job, lease, event, or shadow state handling';
  if (name.includes('hash')) return 'Hashing and identity helpers';
  if (name.includes('normal')) return 'Normalization helpers';
  if (name.includes('trigger')) return 'Trigger handlers';
  if (name.includes('config')) return 'Runtime configuration';
  if (name.includes('main')) return 'Top-level scanner orchestration';
  if (name.includes('d6j')) return 'D6J pilot, dry-run, mutation, or reconciliation phase code';
  if (name.includes('sgds')) return 'SGDS durable architecture adapter or command service';
  return 'General Apps Script support';
}

function inferProposedModule(file, functionName = '') {
  const joined = `${file} ${functionName}`.toLowerCase();
  if (joined.includes('gmail')) return 'Invoice_GmailReader.js';
  if (joined.includes('drive')) return 'Invoice_DriveStorage.js';
  if (joined.includes('sheet') || joined.includes('hoadon') || joined.includes('nhapxuat')) return 'Invoice_SheetLedger.js';
  if (joined.includes('hash')) return 'Shared_Hashing.js';
  if (joined.includes('normal') || joined.includes('canonical')) return 'Shared_Normalization.js';
  if (joined.includes('valid')) return 'Shared_Validation.js';
  if (joined.includes('lease')) return 'Firestore_LeaseStore.js';
  if (joined.includes('firestore') || joined.includes('durable') || joined.includes('job')) return 'Firestore_InvoiceJobStore.js';
  if (joined.includes('event') || joined.includes('audit')) return 'Audit_InvoiceEvents.js';
  if (joined.includes('trigger')) return 'Trigger_Handlers.js';
  if (joined.includes('doget') || joined.includes('dopost') || joined.includes('web')) return 'WebApp_Handlers.js';
  if (joined.includes('run') || joined.includes('main')) return 'Operator_Entrypoints.js';
  return 'Shared_Validation.js';
}

function scanReferences(root, files, functionName, definitionFile) {
  const directCallers = [];
  const stringBasedCallers = [];
  const htmlCallers = [];
  const triggerCallers = [];
  const menuCallers = [];
  const testCallers = [];
  const checkerCallers = [];
  const documentationCallers = [];
  const directRegex = new RegExp(`\\b${functionName}\\s*\\(`);
  const stringRegex = new RegExp(`[\\x27\\x22\\x60]${functionName}[\\x27\\x22\\x60]`);
  const htmlRegex = new RegExp(`google\\.script\\.run(?:\\.with[A-Za-z]+\\([^)]*\\))*\\.${functionName}\\s*\\(`);
  const triggerRegex = new RegExp(`newTrigger\\(\\s*[\\x27\\x22\\x60]${functionName}[\\x27\\x22\\x60]`);
  const menuRegex = new RegExp(`addItem\\([^,]+,\\s*[\\x27\\x22\\x60]${functionName}[\\x27\\x22\\x60]`);

  for (const file of files) {
    if (!isTextFile(file)) continue;
    const text = read(root, file);
    if (file !== definitionFile && directRegex.test(text)) directCallers.push(file);
    if (stringRegex.test(text)) stringBasedCallers.push(file);
    if (path.extname(file).toLowerCase() === '.html' && (htmlRegex.test(text) || text.includes(functionName))) htmlCallers.push(file);
    if (triggerRegex.test(text)) triggerCallers.push(file);
    if (menuRegex.test(text)) menuCallers.push(file);
    if (file.startsWith('tests/') && text.includes(functionName)) testCallers.push(file);
    if (file.startsWith('scripts/checkers/') && text.includes(functionName)) checkerCallers.push(file);
    if (file.startsWith('docs/') && text.includes(functionName)) documentationCallers.push(file);
  }

  return {
    directCallers: stableSort(directCallers),
    stringBasedCallers: stableSort(stringBasedCallers),
    htmlCallers: stableSort(htmlCallers),
    triggerCallers: stableSort(triggerCallers),
    menuCallers: stableSort(menuCallers),
    testCallers: stableSort(testCallers),
    checkerCallers: stableSort(checkerCallers),
    documentationCallers: stableSort(documentationCallers)
  };
}

function inferCapabilities(body) {
  const readCapabilities = [];
  const mutationCapabilities = [];
  if (/GmailApp|Gmail\./.test(body)) readCapabilities.push('GMAIL');
  if (/DriveApp|Drive\./.test(body)) readCapabilities.push('DRIVE');
  if (/SpreadsheetApp|\.getRange\(|\.getValues\(|\.getDisplayValues\(/.test(body)) readCapabilities.push('SHEETS');
  if (/UrlFetchApp|firestore|Firestore/i.test(body)) readCapabilities.push('FIRESTORE_OR_HTTP');
  if (/PropertiesService|getScriptProperties/.test(body)) readCapabilities.push('SCRIPT_PROPERTIES');

  if (/\.setValue\(|\.setValues\(|\.appendRow\(|\.insertRow|\.deleteRow|\.clear\(/.test(body)) mutationCapabilities.push('SHEETS_WRITE');
  if (/createFile|makeCopy|setName|setTrashed|removeFile|addFile/.test(body)) mutationCapabilities.push('DRIVE_WRITE');
  if (/addLabel|removeLabel|markRead|markUnread|moveTo|trash/.test(body)) mutationCapabilities.push('GMAIL_WRITE');
  if (/setProperty|deleteProperty/.test(body)) mutationCapabilities.push('SCRIPT_PROPERTIES_WRITE');
  if (/newTrigger|deleteTrigger/.test(body)) mutationCapabilities.push('TRIGGER_WRITE');
  if (/UrlFetchApp\.fetch[\s\S]*method\s*:\s*['\"](?:post|put|patch|delete)['\"]/i.test(body)) mutationCapabilities.push('HTTP_WRITE');

  return { readCapabilities: stableSort(readCapabilities), mutationCapabilities: stableSort(mutationCapabilities) };
}

function classifyFunction(name, file, body, references) {
  if (FROZEN_D6J_ENTRYPOINTS.has(name)) return 'HISTORICAL_PHASE_ENTRYPOINT';
  if (name === 'doGet' || name === 'doPost') return 'WEB_APP_HANDLER';
  if (name === 'onOpen' || name === 'onEdit' || references.triggerCallers.length > 0) return 'TRIGGER_HANDLER';
  if (references.menuCallers.length > 0) return 'MENU_HANDLER';
  if (references.htmlCallers.length > 0) return 'PUBLIC_OPERATOR_ENTRYPOINT';
  if (name.endsWith('_')) return 'PRIVATE_HELPER';
  if (/ReadOnly|Inspect|Preview|DryRun|Smoke/.test(name)) return 'PUBLIC_READ_ONLY_ENTRYPOINT';
  const { mutationCapabilities } = inferCapabilities(body);
  if (/^(run|main|trigger|capNhat|process|scan)/.test(name) && mutationCapabilities.length > 0) return 'PUBLIC_MUTATION_ENTRYPOINT';
  if (/^(run|main|trigger|capNhat|process|scan)/.test(name)) return 'PUBLIC_OPERATOR_ENTRYPOINT';
  if (references.stringBasedCallers.length > 0) return 'COMPATIBILITY_WRAPPER';
  return 'INTERNAL_SERVICE';
}

function collisionReport(runtimeFiles) {
  const symbols = new Map();
  for (const file of runtimeFiles) {
    for (const symbol of file.globalSymbols) {
      const key = symbol.name;
      const existing = symbols.get(key) ?? [];
      existing.push({ filePath: file.filePath, kind: symbol.kind, line: symbol.line });
      symbols.set(key, existing);
    }
  }
  const duplicateTopLevelFunctionNames = [];
  const duplicateGlobalVariableNames = [];
  const functionVariableNameCollisions = [];
  for (const [name, entries] of [...symbols.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const functions = entries.filter(entry => entry.kind === 'function');
    const variables = entries.filter(entry => entry.kind !== 'function');
    if (functions.length > 1) duplicateTopLevelFunctionNames.push({ name, entries: functions });
    if (variables.length > 1) duplicateGlobalVariableNames.push({ name, entries: variables });
    if (functions.length > 0 && variables.length > 0) functionVariableNameCollisions.push({ name, entries });
  }

  const lowerMap = new Map();
  for (const name of symbols.keys()) {
    const lower = name.toLowerCase();
    lowerMap.set(lower, stableSort([...(lowerMap.get(lower) ?? []), name]));
  }
  const caseOnlyGlobalNameCollisions = [...lowerMap.entries()]
    .filter(([, names]) => names.length > 1)
    .map(([lowerName, names]) => ({ lowerName, names }));

  return {
    duplicateTopLevelFunctionNames,
    duplicateGlobalVariableNames,
    functionVariableNameCollisions,
    handlerNamesDefinedInMultipleFiles: duplicateTopLevelFunctionNames.filter(item => /^(doGet|doPost|onOpen|onEdit|trigger)/.test(item.name)),
    conflictingHelperImplementations: duplicateTopLevelFunctionNames.filter(item => item.name.endsWith('_')),
    caseOnlyGlobalNameCollisions,
    totalCollisionCount: duplicateTopLevelFunctionNames.length + duplicateGlobalVariableNames.length + functionVariableNameCollisions.length + caseOnlyGlobalNameCollisions.length
  };
}

function buildBusinessModuleMap(functions) {
  const modules = new Map();
  for (const fn of functions) {
    const moduleName = fn.proposedModule;
    const entry = modules.get(moduleName) ?? { moduleName, responsibilities: new Set(), candidateFunctions: [] };
    entry.responsibilities.add(inferResponsibility(fn.filePath));
    entry.candidateFunctions.push(fn.name);
    modules.set(moduleName, entry);
  }
  return [...modules.values()]
    .sort((a, b) => a.moduleName.localeCompare(b.moduleName))
    .map(entry => ({
      moduleName: entry.moduleName,
      responsibilities: stableSort([...entry.responsibilities]),
      candidateFunctions: stableSort(entry.candidateFunctions)
    }));
}

export function buildD6kSourceEntrypointInventory({ root = process.cwd() } = {}) {
  const allFiles = listFiles(root);
  const runtimeFileNames = allFiles.filter(isRootAppsScriptRuntimeFile);
  const htmlFiles = allFiles.filter(file => path.extname(file).toLowerCase() === '.html');
  const runtimeFiles = [];
  const functions = [];

  for (const file of runtimeFileNames) {
    const source = read(root, file);
    const declarations = collectTopLevelDeclarations(source);
    const functionDeclarations = declarations.filter(item => item.kind === 'function');
    const variableDeclarations = declarations.filter(item => item.kind !== 'function');
    const directImportsOrExports = /^\s*(?:import|export)\b/m.test(source);
    const globalSymbols = declarations.map(item => ({ name: item.name, kind: item.kind, line: item.line }));

    const runtimeFile = {
      filePath: file,
      fileName: path.basename(file),
      topLevelFunctions: functionDeclarations.filter(item => !item.async).map(item => item.name).sort(),
      topLevelAsyncFunctions: functionDeclarations.filter(item => item.async).map(item => item.name).sort(),
      topLevelConstants: variableDeclarations.filter(item => item.kind === 'const').map(item => item.name).sort(),
      topLevelVariables: variableDeclarations.filter(item => item.kind !== 'const').map(item => item.name).sort(),
      globalSymbols,
      directImportsOrExports,
      approximateResponsibility: inferResponsibility(file),
      phaseSpecific: /(?:bundle|d\d|d6j|sgds_crit|phase)/i.test(file),
      businessSpecific: /(?:gmail|drive|sheet|invoice|hoadon|firestore|durable|hash|normal|trigger|viet)/i.test(file),
      completedPhase: /d6j/i.test(file) ? 'D6J' : null,
      externalHandlerReferences: [],
      testReferences: [],
      checkerReferences: [],
      documentationReferences: []
    };
    runtimeFiles.push(runtimeFile);

    for (const declaration of functionDeclarations) {
      const body = extractFunctionBody(source, declaration);
      const references = scanReferences(root, allFiles, declaration.name, file);
      const capabilities = inferCapabilities(body);
      const classification = classifyFunction(declaration.name, file, body, references);
      const frozen = FROZEN_D6J_ENTRYPOINTS.has(declaration.name);
      const directExternalRefs = [
        ...references.htmlCallers.map(ref => `HTML:${ref}`),
        ...references.triggerCallers.map(ref => `TRIGGER:${ref}`),
        ...references.menuCallers.map(ref => `MENU:${ref}`),
        ...references.stringBasedCallers.map(ref => `STRING:${ref}`)
      ];
      const proposedAction = frozen
        ? 'BLOCKED_COMPATIBILITY_WRAPPER_OR_RETAIN_FORENSIC_PRIVATE_FUNCTION_REVIEW_REQUIRED'
        : classification === 'PRIVATE_HELPER'
          ? 'RETAIN_PRIVATE_HELPER'
          : 'PRESERVE_NAME_AND_REHOME_BY_BUSINESS_RESPONSIBILITY';
      functions.push({
        name: declaration.name,
        filePath: file,
        line: declaration.line,
        classification,
        trailingUnderscore: declaration.name.endsWith('_'),
        likelyAppsScriptRunSelectorVisible: !declaration.name.endsWith('_'),
        directCallers: references.directCallers,
        stringBasedCallers: references.stringBasedCallers,
        htmlCallers: references.htmlCallers,
        triggerCallers: references.triggerCallers,
        menuCallers: references.menuCallers,
        testCallers: references.testCallers,
        checkerCallers: references.checkerCallers,
        documentationCallers: references.documentationCallers,
        readCapabilities: capabilities.readCapabilities,
        mutationCapabilities: capabilities.mutationCapabilities,
        approvalRequirement: /APPROVAL|OWNER|MARKER|approved/i.test(body) ? 'EXPLICIT_OR_MARKER_BASED' : 'NOT_STATICALLY_REQUIRED',
        idempotencyRequirement: /idempot|dedup|hash|invoiceKey/i.test(body) ? 'REFERENCED_IN_SOURCE' : 'NOT_STATICALLY_DETECTED',
        historicalPhase: /d6j/i.test(declaration.name) || /d6j/i.test(file) ? 'D6J' : null,
        frozenDoNotExecute: frozen,
        runtimeState: frozen ? 'FROZEN_DO_NOT_EXECUTE' : 'ACTIVE_OR_INTERNAL',
        proposedAction,
        proposedModule: inferProposedModule(file, declaration.name),
        renameRisk: directExternalRefs.length > 0 || !declaration.name.endsWith('_') ? 'HIGH_PRESERVE_NAME' : 'LOW_PRIVATE_HELPER',
        compatibilityRisk: directExternalRefs.length > 0 ? 'STRING_OR_EXTERNAL_REFERENCE_PRESENT' : 'DIRECT_CODE_REFERENCE_ONLY_OR_NONE',
        zeroReferenceRemovalProof: references.directCallers.length === 0 && references.stringBasedCallers.length === 0 && references.htmlCallers.length === 0 && references.triggerCallers.length === 0 && references.menuCallers.length === 0 && references.testCallers.length === 0 && references.checkerCallers.length === 0 && references.documentationCallers.length === 0
      });
    }
  }

  const collisions = collisionReport(runtimeFiles);
  const sortedFunctions = functions.sort((a, b) => `${a.filePath}:${String(a.line).padStart(6, '0')}:${a.name}`.localeCompare(`${b.filePath}:${String(b.line).padStart(6, '0')}:${b.name}`));

  const publicOperatorCount = sortedFunctions.filter(fn => fn.classification === 'PUBLIC_OPERATOR_ENTRYPOINT').length;
  const publicMutationCount = sortedFunctions.filter(fn => fn.classification === 'PUBLIC_MUTATION_ENTRYPOINT').length;
  const unknownCount = sortedFunctions.filter(fn => fn.classification === 'UNKNOWN_REQUIRES_REVIEW').length;

  return {
    schemaVersion: 1,
    inventoryPolicy: 'D6K_A_STATIC_READ_ONLY_NO_PRODUCTION_ACCESS',
    projectIdentity: 'SyncGmailDriveSheet',
    repository: 'hungdiepcompany-del/tonkho',
    runtimeRoot: '.',
    scannedFileCount: allFiles.length,
    appsScriptRuntimeFileCount: runtimeFiles.length,
    htmlFileCount: htmlFiles.length,
    runtimeFiles: runtimeFiles.sort((a, b) => a.filePath.localeCompare(b.filePath)),
    functions: sortedFunctions,
    collisions,
    frozenD6jEntrypoints: [...FROZEN_D6J_ENTRYPOINTS].sort().map(name => {
      const found = sortedFunctions.find(fn => fn.name === name);
      return {
        name,
        found: Boolean(found),
        filePath: found?.filePath ?? null,
        line: found?.line ?? null,
        classification: found?.classification ?? 'MISSING_FROM_SOURCE',
        runtimeState: found?.runtimeState ?? 'MISSING_FROM_SOURCE',
        safeDisposition: found?.zeroReferenceRemovalProof
          ? 'REMOVE_AFTER_ZERO_REFERENCE_PROOF_CANDIDATE'
          : 'BLOCKED_COMPATIBILITY_WRAPPER_OR_RETAIN_FORENSIC_PRIVATE_FUNCTION_REVIEW_REQUIRED'
      };
    }),
    proposedBusinessModuleMap: buildBusinessModuleMap(sortedFunctions),
    metrics: {
      topLevelFunctionCount: sortedFunctions.length,
      publicOperatorEntrypointCount: publicOperatorCount,
      publicMutationEntrypointCount: publicMutationCount,
      historicalPhaseEntrypointCount: sortedFunctions.filter(fn => fn.classification === 'HISTORICAL_PHASE_ENTRYPOINT').length,
      unknownRequiresReviewCount: unknownCount,
      globalNameCollisionCount: collisions.totalCollisionCount,
      directImportOrExportRuntimeFileCount: runtimeFiles.filter(file => file.directImportsOrExports).length
    }
  };
}

export function stableInventoryJson(inventory) {
  return `${JSON.stringify(inventory, null, 2)}\n`;
}

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function writeInventory({ root = process.cwd(), outFile }) {
  const inventory = buildD6kSourceEntrypointInventory({ root });
  const json = stableInventoryJson(inventory);
  fs.mkdirSync(path.dirname(path.join(root, outFile)), { recursive: true });
  fs.writeFileSync(path.join(root, outFile), json, 'utf8');
  return { inventory, sha256: sha256(json), outFile };
}

function parseArgs(argv) {
  const args = { root: process.cwd(), outFile: null, printSummary: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') args.root = path.resolve(argv[++i]);
    else if (arg === '--write') args.outFile = argv[++i];
    else if (arg === '--summary') args.printSummary = true;
    else throw new Error(`UNKNOWN_ARGUMENT: ${arg}`);
  }
  return args;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const args = parseArgs(process.argv.slice(2));
  const result = args.outFile
    ? writeInventory({ root: args.root, outFile: args.outFile })
    : (() => {
        const inventory = buildD6kSourceEntrypointInventory({ root: args.root });
        const json = stableInventoryJson(inventory);
        process.stdout.write(json);
        return { inventory, sha256: sha256(json), outFile: null };
      })();
  if (args.outFile || args.printSummary) {
    console.log(`D6K_A_SOURCE_ENTRYPOINT_INVENTORY_SHA256=${result.sha256}`);
    console.log(`APPS_SCRIPT_RUNTIME_FILE_COUNT=${result.inventory.appsScriptRuntimeFileCount}`);
    console.log(`TOP_LEVEL_FUNCTION_COUNT=${result.inventory.metrics.topLevelFunctionCount}`);
    console.log(`GLOBAL_NAME_COLLISION_COUNT=${result.inventory.metrics.globalNameCollisionCount}`);
    console.log(`UNKNOWN_REQUIRES_REVIEW_COUNT=${result.inventory.metrics.unknownRequiresReviewCount}`);
  }
}
