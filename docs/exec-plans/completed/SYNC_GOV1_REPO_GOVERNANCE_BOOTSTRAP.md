# SYNC-GOV1 repository governance bootstrap

TASK_ID=SYNC_GOV1_REPO_GOVERNANCE_BOOTSTRAP_IMPLEMENTATION
STATUS=FAILED_REVIEW_CANDIDATE_PRESERVED
SCOPE=REPOSITORY_GOVERNANCE_ONLY

## Delivered governance

- Authority hierarchy and short agent law.
- GAS-aware workflow and role routing for Gmail, Drive, Sheets, Script Properties, Firestore, Firebase, GAS, and clasp.
- Four model-neutral agent profiles.
- SGDS-local writer/isolation helper. It preserves exact identity checks, repository identity binding, reparse-point rejection, transition locking, and fail-closed lifecycle handling. `RecoverWriter` is deliberately absent and forbidden.
- Local governance checker and disposable-repository behavioural tests.

## Non-goals and preserved boundaries

No D7-E runtime, entrypoint, historical plan, production data, external configuration, clasp source sync, deployment, Git staging, commit, or push is part of this record. The active readiness contract has all production capabilities false or zero and no owner gate.

FROZEN_CANDIDATE=YES
RESPONSIBILITY_CHAIN=Primary_contract_and_owner_checkpoint;Coder_single_active_writer;Reviewer_independent_review;Verifier_independent_proof
DEFAULT_COST_POLICY=CHEAPEST_CAPABLE
ONE_WRITER_POLICY=EXACT_VERIFYWRITER_ACTIVE_ONLY_RESERVED_DENIES
GOV1_REVIEW_STATUS=FAIL
GOV1_REVIEW_P1=3
GOV1_REVIEW_P2=1
GOV1_VERIFIER_STATUS=NOT_RUN
GOV1R2_REPAIR_STATUS=IMPLEMENTED_PENDING_INDEPENDENT_REVIEW
CODER_FREEZE_BEFORE_INDEPENDENT_REVIEW=REQUIRED
