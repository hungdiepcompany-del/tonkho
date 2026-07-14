param([string]$Root = ".")
$ErrorActionPreference = "Stop"
$rootPath = (Resolve-Path -LiteralPath $Root).Path
Write-Host "READ_ONLY_AUDIT_ROOT=$rootPath"
Write-Host "FILES=$((Get-ChildItem -LiteralPath $rootPath -Recurse -File -Force | Where-Object { $_.FullName -notmatch '\\.git\\' }).Count)"
Write-Host "WORKBOOK_FOUND=$((Test-Path -LiteralPath (Join-Path $rootPath 'ton kho - DATABASE.xlsx')))"
Write-Host "SCRIPT_ID=$((Get-Content -LiteralPath (Join-Path $rootPath '.clasp.json') -Raw | ConvertFrom-Json).scriptId)"
