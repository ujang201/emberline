# Paket Submit — EMBERLINE (make.fun threejs-fps-02)

Bounty: Make the best three.js tactical FPS
https://make.fun/bounty/threejs-fps-02
Hadiah: $1.000 total (1st $400, 2nd $200, 3rd $120, 4th–10th $40), USDC di Solana
Deadline: Selasa, 17 Nov 2026 pukul 04.30 WIB
Referral yang dipakai: https://make.fun/r/wfjv7kgb (kode wfjv7kgb)

## Isi paket ini

- `main.ts` — Node 22, stdlib only, menulis `game/`, `screenshots/`, `dossier.json` ke output
- `game/` — game statis, ES modules, tanpa build step, tanpa request jaringan
  - `game/index.html` (8,4 KB), 13 modul di `game/src/`
  - `game/vendor/three/` — three.js 0.187.0 vendored byte-for-byte
- `screenshots/` — 4 JPG asli dari game, 1280x720, 32–40 KB tiap file (<256 KB)
  - `1-start.jpg` (cover), `2-play.jpg`, `3-buy.jpg`, `4-end.jpg`
- `out/` — hasil build siap submit, sudah dibuat dengan:
  `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts`
  - `out/dossier.json` 271.661 byte (<1,5 MB), teks 75.487 byte (<160 KB)
  - `out/` total 2,6 MB, `game/` 17 file (<993 file / 48 MiB)
- `LICENSE` — MIT, `README.md`, `serve.ts`, `shots.json`, `vendor/makefun-threejs.ts`

## Verifikasi yang sudah dilakukan (16 Nov 2026)

- `main.ts` dijalankan 2 kali, hasil `diff -r` identik (deterministik)
- 13 modul `game/src/*.js` lolos `node --check`
- Tidak ada URL eksternal di source game
- Smoke test di browser: buy menu → Enter mulai ronde (timer 1:40), gerak + tembak mengurangi amunisi (12→9), tanpa page error
- Screenshot sudah diperiksa visual dan diperbaiki (pencahayaan, ukuran view model, dll.)

## Cara main lokal

```sh
cd ~/workspace/makefun-threejs-fps
node serve.ts   # http://localhost:8080
```

Buka di desktop Chrome, klik Click to play, WASD gerak, mouse look, klik tembak, R reload, G granat, E tahan untuk plant bom, 1–4 beli senjata, Enter mulai ronde.

## Langkah submit (belum dilakukan — butuh akun Ujang)

1. Buat repo GitHub publik baru, dibuat setelah kompetisi dibuka (14 Nov 2026 21:30 UTC). Upload seluruh isi folder ini.
2. Siapkan Solana wallet, sign in di make.fun dengan Solana wallet (dan GitHub).
3. Jika owner GitHub berbeda dengan akun sign-in, tambah file `.makefun/owner.json` di commit yang di-submit, berisi `{"wallet": "<address>"}` wallet yang terhubung.
4. Unduh kit di https://make.fun/c/threejs-fps-02/kit, baca `RULES.txt`.
5. Bundle transkrip sesi AI coding-agent yang membangun game ini (wajib, maks 200 MB, harus lolos transcript gate: minimal 30% baris kode terhitung, minimal 5 assistant turn):
   `node cli/makefun.mjs bundle …`
6. Cek sebelum submit:
   `node cli/makefun.mjs check --kit . --repo <repo> --transcripts transcripts.tar.gz`
7. Submit di make.fun dengan menyebutkan repo GitHub + commit + transkrip. Tandatangani pesan `make.fun entry v1` dengan Solana wallet (berlaku 10 menit, hanya untuk 1 submission).
8. Batas: maks 5 submit per hari UTC, 10 total. Submit terakhir sebelum deadline adalah entri final.

## Status

Belum di-submit. Belum dibuat repo GitHub, belum dibuat / dihubungkan Solana wallet, belum ditandatangani apa pun.

## Wallet (dibuat 16 Nov 2026 atas permintaan Ujang)

Alamat publik: `7focsqTUoRbCHYNuM9iEueDBakZr4pTTz1vvqdk6c38p`
File private key (jangan dibagikan, jangan di-upload ke mana pun): `wallet/solana-keypair.json` (izin 600)
File claim: `.makefun/owner.json` sudah dibuat dengan alamat di atas.
Private key / seed TIDAK ditampilkan di chat demi keamanan. Segera backup file keypair itu ke tempat aman milik Ujang, lalu hapus salinan lain jika ada.
