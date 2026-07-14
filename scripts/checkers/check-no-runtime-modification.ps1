$ErrorActionPreference = "Stop"
$runtime = @("*.js","*.html","appsscript.json",".clasp.json","PULL_GAS_CODE*.bat","PULL_GAS_CODE*.log")
$changed = git diff --name-only HEAD --
$runtimeChanged = @()
foreach ($file in $changed) {
  foreach ($pattern in $runtime) {
    if ((Split-Path -Leaf $file) -like $pattern -and $file -notlike "tests/*" -and $file -notlike "scripts/*" -and $file -notlike "fixtures/*") {
      $runtimeChanged += $file
    }
  }
}
if ($runtimeChanged.Count) {
  Write-Error ("RUNTIME_FILES_CHANGED=YES " + ($runtimeChanged -join ","))
}
Write-Host "RUNTIME_FILES_CHANGED=NO"
