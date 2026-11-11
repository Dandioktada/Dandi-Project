# Saling Bercerita

Game kartu obrolan untuk dua orang yang terhubung lewat internet.
Game ini hanya menampilkan permainan. Obrolannya dilakukan lewat telepon WhatsApp.

## Cara Bermain

1. Pemain pertama menulis nama, lalu menekan **Buat Ruangan**.
2. Kode ruangan atau tautannya dikirim ke pemain kedua, misalnya lewat WhatsApp.
3. Pemain kedua membuka tautan, menulis nama, lalu menekan **Gabung**.
4. Pemain bergiliran menekan **Putar Dadu**. Dadu punya 3 sisi Cokelat dan 3 sisi Hijau.
5. Warna yang keluar menentukan kartu yang diambil. Kalimat di kartu menjadi topik obrolan.
6. Kartu yang sudah keluar tidak muncul lagi sampai semua 50 kartu habis atau dikocok ulang.

## Isi Kartu

| Warna | Jumlah | Tema |
|---|---|---|
| Cokelat | 25 | Masa depan, rencana, dan mimpi |
| Hijau | 25 | Komitmen, kejujuran, dan kasih sayang |

Semua kalimat kartu ada di file `kartu.js` dan bisa diubah langsung.

## File

- `index.html` : susunan halaman
- `style.css` : tampilan
- `game.js` : jalannya permainan dan koneksi online
- `kartu.js` : isi 50 kartu

## Catatan Teknis

Koneksi antarpemain memakai PeerJS (WebRTC) dengan server sinyal gratis milik PeerJS, jadi tidak perlu server sendiri.
Supaya tautan bisa dibuka orang lain, folder ini harus diunggah ke hosting statis (misalnya GitHub Pages atau Netlify).
