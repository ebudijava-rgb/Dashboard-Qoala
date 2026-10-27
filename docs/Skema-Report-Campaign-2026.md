# Skema Report — Campaign 2026 (Sep–Des 2026)

Dokumen ini menjelaskan rancangan halaman **Campaign 2026** di dashboard
(`#/campaign`) berdasarkan *QOALA Program Reward & Trip 2026* (T&C) dan
`Target-Campaign-2026.xlsx`.

---

## 1. Tujuan

Menampilkan posisi seluruh store peserta campaign terhadap target Sep–Des 2026,
sekaligus simulasi pemenang voucher dan grand prize sesuai T&C.

## 2. Sumber data

| Data | Sumber | Catatan |
|---|---|---|
| Target campaign per store per bulan | `Target-Campaign-2026.xlsx` (kolom A–K) | 230 store: 129 Digiplus + 101 Digimap; total Rp 50.002 jt (Sep 10.000 · Okt 12.499 · Nov 13.500 · Des 14.003) |
| Realisasi GWP & polis | `Data-raw.xlsx` (via `summary.json`) | per store, per bulan; bulan berjalan ikut data terakhir |
| Baseline growth | `Data-raw.xlsx` bulan Mei–Agu 2026 | rata-rata GWP per bulan |

Pencocokan nama store: exact match, lalu normalisasi (huruf kecil, spasi dirapikan)
untuk mengakomodasi beda kapitalisasi (mis. `Sogo Deli park Mall`).

## 3. Definisi metrik

| Metrik | Rumus |
|---|---|
| **Target Sep–Des** | Σ target 4 bulan (kolom G–J) |
| **Target s/d bulan ini** | Σ target bulan yang sudah berjalan (Sep–Okt saat ini) |
| **Aktual s/d bulan ini** | Σ GWP realisasi bulan berjalan |
| **Achievement (Ach)** | Aktual ÷ target s/d bulan ini |
| **Aktual polis** | Σ polis realisasi bulan berjalan |
| **Growth vs Mei–Agu** | (rata-rata GWP/bulan berjalan) ÷ (rata-rata GWP/bulan Mei–Agu) − 1 |
| **Skor** | 50% Achievement + 50% indeks growth (growth −100%…+100% dipetakan 0…1) |

Growth kosong (`—`) bila baseline Mei–Agu = 0 (store baru).

## 4. Aturan T&C yang diterapkan

1. **Ambang capaian:** store dianggap memenuhi syarat bila Achievement ≥ **90%**.
2. **Minimum per BU** (pro-rata sampai bulan berjalan):
   - Digimap: **100 polis** & **Rp 100 jt**
   - Digiplus: **70 polis** & **Rp 70 jt**
3. **Syarat layak** = Ach ≥ 90% **dan** polis ≥ minimum **dan** revenue ≥ minimum.
4. **Peringkat** dihitung terpisah per BU (Digimap & Digiplus), hanya store layak.
5. **Voucher store per BU** (75 pemenang): Rp 10 jt (1) · Rp 9 jt (1) · Rp 8 jt (1) ·
   Rp 6 jt (2) · Rp 5 jt (3) · Rp 4 jt (7) · Rp 2,5 jt (60).
6. **Voucher AM** (18 pemenang): Rp 10 jt (1) · Rp 8,5 jt (1) · Rp 6,5 jt (1) ·
   Rp 4,5 jt (3) · Rp 3,5 jt (5) · Rp 2 jt (7).
7. **Voucher RH** (5 pemenang): Rp 8 jt (1) · Rp 5,5 jt (2) · Rp 4 jt (2).
8. **Grand prize** (25 pemenang): Best SPV Digimap 7 · Best SPV Digiplus 7 ·
   Best AM Digimap 3 · Best AM Digiplus 3 · Best RH 2 · HO 3.

### Pemetaan dimensi

| Kategori T&C | Dimensi dashboard | Alasan |
|---|---|---|
| Store | `store` | — |
| SPV | `PA` | jumlah PA (14) selaras kuota 7 per BU |
| AM | `AM` | jumlah AM (18) selaras kuota 3 per BU |
| RH | `SPA` | SPA (4) selaras kuota 2 |
| HO | — | belum ada di data; ditandai "belum tersedia" |

> Bila pemetaan berbeda (mis. SPV = SPA), cukup ubah di halaman/logika
> `campGroup()` pada `dashboard/app.js`.

## 5. Struktur halaman (`#/campaign`)

1. **KPI** — target campaign, realisasi s/d bulan berjalan, achievement, growth vs Mei–Agu,
   store memenuhi syarat, nilai voucher simulasi.
2. **Progres per bulan** — tabel Sep/Oct/Nov/Des: target, aktual, ach, polis, bar progres.
   Bulan yang belum berjalan hanya menampilkan target.
3. **Leaderboard store** — filter BU, pencarian, urut (skor/ach/growth/aktual/target),
   tab semua/layak/belum; kolom: Rank (per BU), Store, BU, AM, SPA, PA, target, aktual,
   ach, polis, growth, skor, status, voucher. Ada baris TOTAL + unduh CSV.
4. **Leaderboard AM** — 18 posisi voucher, agregat store di bawah AM.
5. **Leaderboard SPV & RH** — Best SPV per BU (7) dan Best RH (5).
6. **Grand prize** — simulasi 25 pemenang per kategori.
7. **Ringkasan T&C**.

Halaman ini **tidak memakai filter global** (tahun/bulan/produk/store) karena definisi
campaign sudah tetap (Sep–Des 2026); pembatasan akses (lock PA/Promotor) tetap berlaku.

## 6. Catatan & keterbatasan

- Baru **Sep–Okt** yang punya realisasi; Nov–Des masih target.
- Voucher & grand prize bersifat **simulasi posisi saat ini**, bukan penetapan resmi.
- Perhitungan ulang otomatis setiap `tools\refresh.ps1` dijalankan
  (target campaign dibaca dari `Target-Campaign-2026.xlsx`).
- Bulan baru otomatis masuk saat `Data-raw.xlsx` memuat data Nov/Des.
