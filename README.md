# SyncGmailDriveSheet

Local repository for the SyncGmailDriveSheet Google Apps Script system.

## Current Phase

Bundle B establishes a local-only regression foundation. It does not modify runtime GAS source and does not push/deploy anything.

## Local Validation

```powershell
Set-Location "D:\CODE\SyncGmailDriveSheet"
npm.cmd test
npm.cmd run check
```

Use `npm.cmd` on machines where PowerShell blocks `npm.ps1`.

## Safety

- No `clasp push`, `clasp run`, or Firebase deploy in Bundle B.
- No production Gmail/Drive/Sheets calls in tests.
- Runtime entrypoints are forbidden by the test harness.
- `ton kho - DATABASE.xlsx` is read-only evidence and must not be edited.


## Bundle B Result

- Local test foundation status: PASS.
- Main command: `npm.cmd test` -> 45 tests, 44 pass, 1 skipped target invariant draft.
- Aggregate command: `npm.cmd run check` -> `BUNDLE_B_CHECK=PASS`.
- Runtime GAS files, `.clasp.json`, `appsscript.json`, and workbook evidence remain unchanged.
