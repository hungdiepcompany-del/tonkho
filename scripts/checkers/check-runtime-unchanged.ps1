$ErrorActionPreference = "Stop"
$baseline = "artifacts/audit/a00-source-sha256.txt"
if (!(Test-Path -LiteralPath $baseline)) { Write-Error "RUNTIME_UNCHANGED=FAIL missing baseline" }
$runtimePatterns = @("*.js","*.html","appsscript.json",".clasp.json")
$runtime = @{}
foreach ($pattern in $runtimePatterns) {
  Get-ChildItem -LiteralPath . -File -Filter $pattern | ForEach-Object {
    $runtime[$_.Name] = $true
  }
}
$bad = @()
Get-Content -LiteralPath $baseline | ForEach-Object {
  if ($_ -notmatch "^([A-Fa-f0-9]{64})\s+(.+)$") { return }
  $expected = $Matches[1].ToUpperInvariant()
  $path = $Matches[2]
  $name = Split-Path -Leaf $path
  if (-not $runtime.ContainsKey($name)) { return }
  if (!(Test-Path -LiteralPath $path)) {
    $bad += "$path:MISSING"
    return
  }
  $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $path).Hash.ToUpperInvariant()
  if ($actual -ne $expected) {
    $bad += "$path:HASH_CHANGED"
  }
}
if ($bad.Count) {
  Write-Error ("RUNTIME_UNCHANGED=FAIL " + ($bad -join ","))
}
Write-Host "RUNTIME_UNCHANGED=PASS"
Write-Host "CLASP_JSON_UNCHANGED=PASS"
Write-Host "APPSSCRIPT_JSON_UNCHANGED=PASS"
