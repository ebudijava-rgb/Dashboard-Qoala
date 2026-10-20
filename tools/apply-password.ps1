# Terapkan kata sandi baru ke Master_user.xlsx
# Sumber: file patch JSON yang diunduh dari Setting > Account > Ubah Kata Sandi,
#         atau langsung -Email / -Password.
#
# Pemakaian:
#   powershell -ExecutionPolicy Bypass -File tools\apply-password.ps1 -File password-patch.json
#   powershell -ExecutionPolicy Bypass -File tools\apply-password.ps1 -Email eko.setiawan@qoala.id -Password "sandiBaru"
#   (opsional) -Path "D:\lain\Master_user.xlsx"
#
# Setelah itu jalankan tools\refresh.bat agar dashboard memakai kata sandi baru.

param(
  [string]$File,
  [string]$Email,
  [string]$Password,
  [string]$Path = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path (Split-Path $MyInvocation.MyCommand.Path -Parent) -Parent
if ([string]::IsNullOrWhiteSpace($Path)) { $Path = Join-Path $root "Master_user.xlsx" }
if (-not (Test-Path -LiteralPath $Path)) { throw "Master_user.xlsx tidak ditemukan: $Path" }

$items = @()
if ($File) {
  if (-not (Test-Path -LiteralPath $File)) { throw "File patch tidak ditemukan: $File" }
  $j = Get-Content -LiteralPath $File -Raw | ConvertFrom-Json
  foreach ($it in $j.items) {
    if ($it.email -and $it.password) { $items += [pscustomobject]@{ email = [string]$it.email; password = [string]$it.password } }
  }
}
if ($Email -and $Password) { $items += [pscustomobject]@{ email = $Email; password = $Password } }
if ($items.Count -eq 0) { throw "Tidak ada data. Pakai -File <patch.json> atau -Email/-Password." }

$lockFile = Join-Path (Split-Path $Path -Parent) ("~$" + (Split-Path $Path -Leaf))
if (Test-Path -LiteralPath $lockFile) {
  throw "Master_user.xlsx sedang dibuka di Excel. Tutup dulu file tersebut, lalu jalankan lagi."
}

Write-Output "Memperbarui $Path"
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$done = 0
try {
  $wb = $excel.Workbooks.Open((Resolve-Path -LiteralPath $Path).Path)
  $ws = $wb.Worksheets.Item(1)
  $used = $ws.UsedRange
  $last = $used.Rows.Count + $used.Row - 1
  foreach ($it in $items) {
    $found = $false
    for ($r = 2; $r -le $last; $r++) {
      $val = [string]$ws.Cells.Item($r, 1).Value2
      if ($val.Trim().ToLower() -eq ([string]$it.email).Trim().ToLower()) {
        $ws.Cells.Item($r, 2).Value2 = [string]$it.password
        Write-Output ("  OK     baris $r : " + $val + " -> password diperbarui")
        $found = $true
        $done++
        break
      }
    }
    if (-not $found) { Write-Output ("  LEWAT  email tidak ada di Master_user.xlsx -> " + $it.email) }
  }
  $wb.Save()
  $wb.Close($true)
} finally {
  $excel.Quit()
  try { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null } catch { }
}

Write-Output ""
Write-Output "$done akun diperbarui."
Write-Output "Langkah berikutnya: jalankan tools\refresh.bat supaya dashboard memakai kata sandi baru."
