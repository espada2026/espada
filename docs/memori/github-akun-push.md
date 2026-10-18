---
name: github-akun-push
description: Push dan PR ke repo espada2026/espada harus memakai akun gh espada2026, lalu kembali ke tribudi3267
metadata:
  type: feedback
---

Sebelum `git push` atau `gh pr create` di repo espada2026/espada, jalankan `gh auth switch -u espada2026` dan `gh auth setup-git`. Sesudahnya kembalikan dengan `gh auth switch -u tribudi3267`.

**Why:** akun aktif bawaan `tribudi3267` tidak punya izin tulis ke repo itu (push ditolak 403); `espada2026` sudah login di komputer ini. Pemilik meminta hal ini diingat (1 Okt 2026).
**How to apply:** lakukan langkah itu otomatis setiap kali diminta push atau membuat PR, tanpa menunggu 403 dulu.
