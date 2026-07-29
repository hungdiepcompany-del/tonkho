const D6K_HISTORICAL_PHASE_CLOSED_STATUS_ = 'HISTORICAL_PHASE_CLOSED_DO_NOT_EXECUTE';
const D6K_OPERATOR_ENTRYPOINT_POLICY_VERSION_ = 'D6K_OPERATOR_ENTRYPOINT_POLICY_V1';

function runD7AOperationalAutomationReadinessReadOnly() {
  const runner = createD7AOperationalAutomationReadinessAuditRunner_();
  return runner.run();
}

function runD7BBoundedReadOnlyCandidateDiscovery() {
  const runner = createD7BBoundedReadOnlyCandidateDiscoveryRunner_();
  return runner.run();
}

function blockD6kHistoricalPhaseEntrypoint_(entrypointName) {
  const error = new Error(D6K_HISTORICAL_PHASE_CLOSED_STATUS_ + ': ' + entrypointName);
  error.code = D6K_HISTORICAL_PHASE_CLOSED_STATUS_;
  error.entrypointName = entrypointName;
  throw error;
}

function getD6kOperatorEntrypointPolicy_() {
  return Object.freeze({
    policyVersion: D6K_OPERATOR_ENTRYPOINT_POLICY_VERSION_,
    historicalPhaseStatus: D6K_HISTORICAL_PHASE_CLOSED_STATUS_,
    productionEntrypointExecutedDuringD6K: 'NO',
    productionMutationDuringD6K: 'NONE'
  });
}
