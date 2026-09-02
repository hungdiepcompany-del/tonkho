import path from 'node:path';

function getEnvironmentValue(environment, name) {
  const key = Object.keys(environment).find(candidate => candidate.toLowerCase() === name.toLowerCase());
  return key === undefined ? undefined : environment[key];
}

function normalizeAbsoluteWindowsPath(value) {
  const trimmed = String(value).trim();
  if (!path.win32.isAbsolute(trimmed)) return '';
  const withoutTrailingSeparators = trimmed.replace(/[\\/]+$/g, '');
  return /^[A-Za-z]:$/.test(withoutTrailingSeparators)
    ? `${withoutTrailingSeparators}\\`
    : withoutTrailingSeparators;
}

export function createWindowsPowerShellEnvironment(sourceEnvironment = process.env) {
  if (!sourceEnvironment || typeof sourceEnvironment !== 'object' || Array.isArray(sourceEnvironment)) {
    throw new TypeError('SOURCE_ENVIRONMENT_OBJECT_REQUIRED');
  }

  const windowsRoot = normalizeAbsoluteWindowsPath(
    getEnvironmentValue(sourceEnvironment, 'SystemRoot') || getEnvironmentValue(sourceEnvironment, 'WINDIR') || ''
  );
  if (!windowsRoot) throw new Error('ABSOLUTE_SYSTEMROOT_REQUIRED_FOR_POWERSHELL_MODULES');

  const requiredModulePath = path.win32.join(
    windowsRoot,
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'Modules'
  );
  const inheritedModulePaths = String(getEnvironmentValue(sourceEnvironment, 'PSModulePath') || '')
    .split(path.win32.delimiter)
    .map(normalizeAbsoluteWindowsPath)
    .filter(Boolean);
  const modulePaths = [];
  const seen = new Set();

  for (const modulePath of [requiredModulePath, ...inheritedModulePaths]) {
    const key = modulePath.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    modulePaths.push(modulePath);
  }

  const environment = { ...sourceEnvironment };
  for (const key of Object.keys(environment)) {
    if (key.toLowerCase() === 'psmodulepath') delete environment[key];
  }
  environment.PSModulePath = modulePaths.join(path.win32.delimiter);
  return environment;
}
