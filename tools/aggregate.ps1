# Regenerasi data dashboard dari Data-raw.xlsx + Target.xlsx (static, tanpa Python)
# Cara pakai: powershell -ExecutionPolicy Bypass -File tools/aggregate.ps1
$ErrorActionPreference = "Stop"
$root = Split-Path (Split-Path $MyInvocation.MyCommand.Path -Parent) -Parent
if (-not (Test-Path (Join-Path $root "Data-raw.xlsx"))) { $root = "D:\Project Dashboard" }
$src = Join-Path $root "Data-raw.xlsx"
$tgt = Join-Path $root "Target.xlsx"
$tmp = Join-Path $env:TEMP "opencode\copy-raw.xlsx"
$tmpt = Join-Path $env:TEMP "opencode\copy-target.xlsx"
$tmpNew = Join-Path $env:TEMP "opencode\summary-new.json"
$tmptJ = Join-Path $env:TEMP "opencode\targets.json"
$out = Join-Path $root "dashboard\data\summary.json"
$js  = Join-Path $root "dashboard\data\summary.js"

if (!(Test-Path $src)) { throw "Tidak ketemu: $src" }
Copy-Item -LiteralPath $src -Destination $tmp -Force
Add-Type -Path (Join-Path $root "tools\XlsxAgg.cs") -ReferencedAssemblies @("System.IO.Compression.FileSystem","System.Xml","System.IO.Compression")
$res = [XlsxAgg]::Run($tmp, $tmpNew)
Write-Output $res
Copy-Item $tmpNew $out -Force

if (Test-Path $tgt) {
  Copy-Item -LiteralPath $tgt -Destination $tmpt -Force
  Add-Type -Path (Join-Path $root "tools\TargetExport.cs") -ReferencedAssemblies @("System.IO.Compression.FileSystem","System.Xml","System.IO.Compression")
  Write-Output ([TargetExport]::Run($tmpt, $tmptJ))
  $t = Get-Content $tmptJ -Raw
  $meta = '{"month":"2026-10","cutoff":"2026-10-15","elapsed":15,"daysInMonth":31,"factor":2.066666666666667,"source":"Target.xlsx"}'
  $fs = New-Object System.IO.FileStream($out, [System.IO.FileMode]::Open, [System.IO.FileAccess]::ReadWrite)
  $fs.Seek(-1, [System.IO.SeekOrigin]::End) | Out-Null
  $add = ',"target":' + $t + ',"targetMeta":' + $meta + '}'
  $bytes = (New-Object System.Text.UTF8Encoding($false)).GetBytes($add)
  $fs.Write($bytes, 0, $bytes.Length)
  $fs.Close()
  Write-Output "target merged"
} else { Write-Output "Target.xlsx tidak ada - lanjut tanpa target" }

# Bungkus JSON jadi JS agar bisa dibuka via file:// (double-click index.html)
$sr = New-Object System.IO.StreamReader($out)
$sw = New-Object System.IO.StreamWriter($js, $false, (New-Object System.Text.UTF8Encoding($false)))
$sw.Write("window.DASHBOARD_DATA=")
$buf = New-Object char[] 1048576
while (($n = $sr.Read($buf,0,$buf.Length)) -gt 0) { $sw.Write($buf,0,$n) }
$sw.Write(";")
$sr.Close(); $sw.Close()
Write-Output ("JS: " + (Get-Item $js).Length + " bytes")
Write-Output "Selesai. Buka dashboard/index.html"
