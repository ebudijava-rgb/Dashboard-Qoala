<#
  tools/refresh.ps1 - Refresh data dashboard Qoala Gadget Protection (1 langkah)
    1. agregasi ulang dari Data-raw.xlsx + Target.xlsx + Master_user.xlsx
    2. commit + push ke GitHub (otomatis di-skip kalau isi data tidak berubah)

  Cara pakai:
    powershell -ExecutionPolicy Bypass -File tools\refresh.ps1
    powershell -ExecutionPolicy Bypass -File tools\refresh.ps1 -NoPush    (hanya agregasi, tanpa push)
    powershell -ExecutionPolicy Bypass -File tools\refresh.ps1 -Force     (commit walau data sama)

  Paling gampang: klik dua kali tools\refresh.bat
#>
param([switch]$NoPush, [switch]$Force)

$ErrorActionPreference = "Stop"
$script:root = Split-Path (Split-Path $MyInvocation.MyCommand.Path -Parent) -Parent
$script:git  = "C:\Program Files\Git\cmd\git.exe"
if (-not (Test-Path $script:git)) { $script:git = "git" }
$script:agg = Join-Path $script:root "tools\aggregate.ps1"
$script:jj  = Join-Path $script:root "dashboard\data\summary.json"
$script:jss = Join-Path $script:root "dashboard\data\summary.js"
$script:url = "https://gpp-map.vercel.app/"

function Say($msg, $color) { if ($color) { Write-Host $msg -ForegroundColor $color } else { Write-Host $msg } }
function ReadText($p) {
  $sr = New-Object System.IO.StreamReader($p, (New-Object System.Text.UTF8Encoding($false)))
  $t = $sr.ReadToEnd(); $sr.Close(); return $t
}
function GitRun([string[]]$gitArgs) {
  $out = & $script:git -C $script:root @gitArgs 2>&1
  $code = $LASTEXITCODE; if ($null -eq $code) { $code = 0 }
  return @{ code = $code; out = (($out | Out-String).Trim()) }
}

Say ""
Say "==================================================" "Cyan"
Say "  REFRESH DATA DASHBOARD QOALA" "Cyan"
Say "==================================================" "Cyan"

# ---------- 0. cek file sumber ----------
if (-not (Test-Path (Join-Path $script:root "Data-raw.xlsx"))) { throw "Data-raw.xlsx tidak ditemukan di $($script:root)" }
if (-not (Test-Path (Join-Path $script:root "Target.xlsx")))   { throw "Target.xlsx tidak ditemukan di $($script:root)" }
if (Test-Path (Join-Path $script:root "Master_user.xlsx")) { Say "Sumber: Data-raw.xlsx + Target.xlsx + Master_user.xlsx" }
else { Say "Sumber: Data-raw.xlsx + Target.xlsx (Master_user.xlsx tidak ada - akun login pakai yang lama)" "Yellow" }

# ---------- 1. simpan versi di repo sebagai pembanding ----------
$tmpOld = Join-Path $env:TEMP "opencode\head-summary.json"
if (Test-Path $tmpOld) { Remove-Item $tmpOld -Force }
$hasHead = $false
$r = GitRun @("cat-file", "-e", "HEAD:dashboard/data/summary.json")
if ($r.code -eq 0) {
  $cmd = '"' + $script:git + '" -C "' + $script:root + '" cat-file blob HEAD:dashboard/data/summary.json > "' + $tmpOld + '"'
  cmd /c $cmd | Out-Null
  $hasHead = Test-Path $tmpOld
}

# ---------- 2. agregasi ----------
Say ""
Say "[1/3] Agregasi ulang dari Excel ..." "Cyan"
& $script:agg
if (-not (Test-Path $script:jj)) { throw "Agregasi gagal: dashboard\data\summary.json tidak terbentuk" }
if (-not (Test-Path $script:jss)) { throw "Agregasi gagal: dashboard\data\summary.js tidak terbentuk" }

$txt  = ReadText $script:jj
$gen  = [regex]::Match($txt, '"generated":"([^"]*)"').Groups[1].Value
$rows = [regex]::Match($txt, '"rows":(\d+)').Groups[1].Value
$last = [regex]::Match($txt, '"lastDay":(\d+)').Groups[1].Value
$userN = ([regex]::Matches($txt, '"u":"')).Count

# ---------- 3. bandingkan isi data (timestamp diabaikan) ----------
Say ""
Say "[2/3] Cek perubahan isi data ..." "Cyan"
$same = $false
if ($hasHead) {
  $a = (ReadText $tmpOld) -replace '"generated":"[^"]*"', ''
  $b = $txt                  -replace '"generated":"[^"]*"', ''
  $same = ($a -eq $b)
}
Say ("  Baris agregat : " + $rows)
Say ("  Hari berjalan : s/d tgl " + $last)
Say ("  Akun login    : " + $userN)
Say ("  Dibuat        : " + $gen)

if ($same -and -not $Force) {
  Say ""
  Say "Tidak ada perubahan isi data dibanding yang sudah di repo." "Yellow"
  GitRun @("checkout", "--", "dashboard/data/summary.js", "dashboard/data/summary.json") | Out-Null
  Say "File sementara dikembalikan supaya repo tetap bersih."
  Say ""
  Say "SELESAI - tidak ada yang perlu di-commit/push." "Green"
  exit 0
}

# ---------- 4. commit + push ----------
Say ""
Say "[3/3] Commit + push ke GitHub ..." "Cyan"
$msg = "Refresh data $gen (hari berjalan s/d tgl $last, $rows baris)"
$r = GitRun @("add", "dashboard/data/summary.js", "dashboard/data/summary.json", "Target.xlsx")
if ($r.code -ne 0) { throw "git add gagal: $($r.out)" }

$r = GitRun @("commit", "-m", $msg)
if ($r.code -ne 0) { Say "Tidak ada yang perlu di-commit (isi file sama)." "Yellow" }
else { Say "Commit: $msg" "Green" }

if ($NoPush) {
  Say "Lewati push karena -NoPush." "Yellow"
} else {
  $r = GitRun @("push", "origin", "main")
  if ($r.code -ne 0) {
    Say "PUSH GAGAL. Pesan git:" "Red"
    Say $r.out
    Say ""
    Say "Coba: git -C `"$($script:root)`" pull --rebase   lalu jalankan skrip ini lagi." "Yellow"
    exit 2
  }
  Say "Push berhasil. Vercel akan deploy otomatis (+/- 1 menit)." "Green"
}

Say ""
Say "Status repo:" "Cyan"
Say (GitRun @("status", "-sb")).out
Say ""
Say "==================================================" "Green"
Say "  SELESAI. Dashboard: $($script:url)" "Green"
Say "  Jangan lupa Ctrl+Shift+R di browser." "Green"
Say "==================================================" "Green"
