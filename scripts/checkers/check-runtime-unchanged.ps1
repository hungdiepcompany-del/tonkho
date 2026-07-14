$ErrorActionPreference = "Stop"
$baseline = "artifacts/audit/a00-source-sha256.txt"
if (!(Test-Path -LiteralPath $baseline)) { Write-Error "RUNTIME_UNCHANGED=FAIL missing baseline" }
$bad = @()
Get-Content -LiteralPath $baseline | ForEach-Object {
  if ($_ -notmatch "^([A-Fa-f0-9]{64})\s+(.+)$") { return }
  $expected = $Matches[1].ToUpperInvariant()
  $path = $Matches[2]
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
