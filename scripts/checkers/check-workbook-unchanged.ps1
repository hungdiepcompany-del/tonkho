$ErrorActionPreference = "Stop"
$path = "ton kho - DATABASE.xlsx"
$expected = "EF44EC11949969E81953C27848C3BDF1886BB647547DE4A70EF05D4BF8FDB267"
if (!(Test-Path -LiteralPath $path)) { Write-Error "WORKBOOK_UNCHANGED=FAIL missing workbook" }
$actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $path).Hash.ToUpperInvariant()
if ($actual -ne $expected) { Write-Error "WORKBOOK_UNCHANGED=FAIL expected=$expected actual=$actual" }
Write-Host "WORKBOOK_UNCHANGED=PASS"
