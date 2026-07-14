$ErrorActionPreference = "Stop"
$missing = @()
$docs = Get-ChildItem -LiteralPath docs -Recurse -File -Filter *.md
foreach ($doc in $docs) {
  $text = Get-Content -LiteralPath $doc.FullName -Raw
  $matches = [regex]::Matches($text, "\[[^\]]+\]\(([^)]+)\)")
  foreach ($m in $matches) {
    $target = $m.Groups[1].Value
    if ($target -match "^(https?:|mailto:|#)") { continue }
    $clean = $target.Split("#")[0].Trim("<>").Trim()
    if (!$clean) { continue }
    $base = Split-Path -Parent $doc.FullName
    $full = Join-Path $base $clean
    if (!(Test-Path -LiteralPath $full)) {
      $missing += "$($doc.FullName):$target"
    }
  }
}
if ($missing.Count) {
  Write-Error ("INTERNAL_DOC_LINKS=FAIL " + ($missing -join ","))
}
Write-Host "INTERNAL_DOC_LINKS=PASS"
