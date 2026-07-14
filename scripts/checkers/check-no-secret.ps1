$ErrorActionPreference = "Stop"
$patterns = "refresh_token\s*[:=]|private_key\s*[:=]|client_secret\s*[:=]|password\s*[:=]|passwd\s*[:=]|service_account|BEGIN PRIVATE KEY|ya29\.|xox[baprs]-|ghp_|github_pat|sk-[A-Za-z0-9]"
$files = Get-ChildItem -Recurse -File -Force |
  Where-Object {
    $_.FullName -notmatch "\\.git\\" -and
    $_.FullName -notmatch "\\_backup_before_pull\\" -and
    $_.Name -ne ".clasprc.json" -and
    $_.Name -ne "check-no-secret.ps1"
  }
$hits = @()
foreach ($f in $files) {
  $m = Select-String -LiteralPath $f.FullName -Pattern $patterns -CaseSensitive:$false -ErrorAction SilentlyContinue
  if ($m) {
    $hits += $m | ForEach-Object { "$($_.Path):$($_.LineNumber)" }
  }
}
if ($hits.Count) {
  Write-Error ("SECRET_SCAN=FAIL locations=" + ($hits -join ","))
}
Write-Host "SECRET_SCAN=PASS"
