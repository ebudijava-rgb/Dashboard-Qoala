# Regenerasi data dashboard dari Data-raw.xlsx + Target.xlsx + Master_user.xlsx (static, tanpa Python)
# Cara pakai: powershell -ExecutionPolicy Bypass -File tools/aggregate.ps1
$ErrorActionPreference = "Stop"
$root = Split-Path (Split-Path $MyInvocation.MyCommand.Path -Parent) -Parent
if (-not (Test-Path (Join-Path $root "Data-raw.xlsx"))) { $root = "D:\Project Dashboard" }
$src  = Join-Path $root "Data-raw.xlsx"
$tgt  = Join-Path $root "Target.xlsx"
$mus  = Join-Path $root "Master_user.xlsx"
$tmp    = Join-Path $env:TEMP "opencode\copy-raw.xlsx"
$tmpt   = Join-Path $env:TEMP "opencode\copy-target.xlsx"
$tmpm   = Join-Path $env:TEMP "opencode\copy-master.xlsx"
$tmpNew = Join-Path $env:TEMP "opencode\summary-new.json"
$tmptJ  = Join-Path $env:TEMP "opencode\targets.json"
$tmpUJ  = Join-Path $env:TEMP "opencode\users.json"
$out = Join-Path $root "dashboard\data\summary.json"
$js  = Join-Path $root "dashboard\data\summary.js"

# Bulan target yang dipakai sebagai pembanding (sesuai isi Target.xlsx)
$tgtMonth = "2026-10"

if (!(Test-Path $src)) { throw "Tidak ketemu: $src" }
Copy-Item -LiteralPath $src -Destination $tmp -Force
Add-Type -Path (Join-Path $root "tools\XlsxAgg.cs") -ReferencedAssemblies @("System.IO.Compression.FileSystem","System.Xml","System.IO.Compression")
$res = [XlsxAgg]::Run($tmp, $tmpNew)
Write-Output $res
Copy-Item $tmpNew $out -Force

$extra = ""

if (Test-Path $tgt) {
  Copy-Item -LiteralPath $tgt -Destination $tmpt -Force
  Add-Type -Path (Join-Path $root "tools\TargetExport.cs") -ReferencedAssemblies @("System.IO.Compression.FileSystem","System.Xml","System.IO.Compression")
  Write-Output ([TargetExport]::Run($tmpt, $tmptJ))

  # Baca daftar bulan + hari terakhir yang ada datanya (di awal file JSON)
  $head = New-Object System.IO.StreamReader($out)
  $buf = New-Object char[] 262144
  $n = $head.Read($buf, 0, $buf.Length)
  $head.Close()
  $snip = New-Object string($buf, 0, $n)
  $months = ([regex]::Match($snip, '"months":\[([^\]]*)\]')).Groups[1].Value -replace '"','' -split ','
  $lasts  = ([regex]::Match($snip, '"monthLastDay":\[([^\]]*)\]')).Groups[1].Value -split ','
  $idx = [array]::IndexOf($months, $tgtMonth)
  if ($idx -lt 0) { throw "Bulan target $tgtMonth tidak ada di data" }
  $elapsed = [int]$lasts[$idx]
  $y = [int]$tgtMonth.Substring(0,4); $mo = [int]$tgtMonth.Substring(5,2)
  $dim = [DateTime]::DaysInMonth($y, $mo)
  if ($elapsed -le 0) { $elapsed = $dim }
  $factor = [double]$dim / [double]$elapsed
  $meta = '{"month":"' + $tgtMonth + '","source":"Target.xlsx","lastDay":' + $elapsed + ',"daysInMonth":' + $dim + ',"factor":' + $factor.ToString("0.############", [System.Globalization.CultureInfo]::InvariantCulture) + '}'
  Write-Output ("target unit: bulan " + $tgtMonth + " s/d tgl " + $elapsed + " dari " + $dim + " hari (faktor " + $factor.ToString("0.####") + ")")
  $extra += ',"target":' + (Get-Content $tmptJ -Raw) + ',"targetMeta":' + $meta
} else { Write-Output "Target.xlsx tidak ada - lanjut tanpa target" }

if (Test-Path $mus) {
  Copy-Item -LiteralPath $mus -Destination $tmpm -Force
  Add-Type -Path (Join-Path $root "tools\UserExport.cs") -ReferencedAssemblies @("System.IO.Compression.FileSystem","System.Xml","System.IO.Compression")
  Write-Output ([UserExport]::Run($tmpm, $tmpUJ))
  $extra += ',"users":' + (Get-Content $tmpUJ -Raw)
} else { Write-Output "Master_user.xlsx tidak ada - lanjut tanpa akun login" }

if ($extra -ne "") {
  $fs = New-Object System.IO.FileStream($out, [System.IO.FileMode]::Open, [System.IO.FileAccess]::ReadWrite)
  $fs.Seek(-1, [System.IO.SeekOrigin]::End) | Out-Null
  $add = $extra + '}'
  $bytes = (New-Object System.Text.UTF8Encoding($false)).GetBytes($add)
  $fs.Write($bytes, 0, $bytes.Length)
  $fs.Close()
  Write-Output "extra merged"
}

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
