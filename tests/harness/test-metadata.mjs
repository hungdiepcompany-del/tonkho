export const TEST_CLASSES = new Set([
  'CURRENT_BEHAVIOR',
  'CONFIRMED_BUG_REPRODUCTION',
  'TARGET_INVARIANT_DRAFT',
  'POLICY_PENDING',
  'STATIC_SOURCE_SAFETY',
  'SCHEMA_CONTRACT',
  'REGRESSION_INVARIANT',
]);

export function defineTestMetadata(meta) {
  if (!TEST_CLASSES.has(meta.testClass)) throw new Error(`UNKNOWN_TEST_CLASS: ${meta.testClass}`);
  if (meta.runtimeMutation !== 'NONE') throw new Error('TEST_METADATA_RUNTIME_MUTATION_NOT_ALLOWED');
  return Object.freeze(meta);
}
