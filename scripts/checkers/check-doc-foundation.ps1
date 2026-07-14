$ErrorActionPreference = "Stop"
$required = @(
  "docs/00_INDEX.md","docs/01_SYSTEM_AS_IS.md","docs/02_TARGET_ARCHITECTURE.md",
  "docs/03_DATA_CONTRACT.md","docs/04_MASTER_PLAN.md","docs/05_RISK_AND_BUG_REGISTER.md",
  "docs/06_OWNER_DECISIONS.md","docs/07_WORK_LOG.md","docs/08_DECISION_LOG.md",
  "docs/09_VALIDATION_LOG.md","docs/10_RELEASE_AND_ROLLBACK.md",
  "docs/phases/BUNDLE_A_FOUNDATION_AUDIT.md","docs/99_NEXT_AI_HANDOFF.md"
)
$missing = @($required | Where-Object { !(Test-Path -LiteralPath $_) })
if ($missing.Count) {
  Write-Error ("DOC_FOUNDATION=FAIL missing=" + ($missing -join ","))
}
$handoff = Get-Content -LiteralPath "docs/99_NEXT_AI_HANDOFF.md" -Raw
$keys = @("PROJECT=","ARCHITECTURE=","CURRENT_BUNDLE=","CURRENT_SUBPHASE=","STATUS=","LAST_COMMIT=","BRANCH=","WORKTREE=","FILES_CHANGED=","VALIDATION=","RUNTIME_MUTATION=","GAS_PUSH=","FIREBASE_DEPLOY=","BLOCKERS=","OWNER_DECISIONS_REQUIRED=","NEXT_ALLOWED_BUNDLE=","NEXT_ALLOWED_SUBPHASE=","NEXT_AI_FIRST_ACTION=")
$missingKeys = @($keys | Where-Object { $handoff -notmatch [regex]::Escape($_) })
if ($missingKeys.Count) {
  Write-Error ("HANDOFF_FORMAT=FAIL missing=" + ($missingKeys -join ","))
}
Write-Host "DOC_FOUNDATION=PASS"
