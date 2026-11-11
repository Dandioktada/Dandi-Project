/* Saling Bercerita
 * Dua pemain terhubung lewat internet (PeerJS / WebRTC).
 * Pembuat ruangan (host) menyimpan keadaan permainan dan mengirimkannya ke tamu.
 */
(function () {
  "use strict";

  const AWALAN_ID = "salingbercerita-";
  const HURUF_KODE = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const KUNCI_SESI = "salingbercerita-sesi";
  const LAMA_ANIMASI = 1600;

  // Sisi dadu: warna dan putaran agar sisi itu menghadap ke depan.
  const SISI = {
    depan:    { warna: "coklat", rx: 0,   ry: 0 },
    kiri:     { warna: "coklat", rx: 0,   ry: 90 },
    atas:     { warna: "coklat", rx: -90, ry: 0 },
    belakang: { warna: "hijau",  rx: 0,   ry: 180 },
    kanan:    { warna: "hijau",  rx: 0,   ry: -90 },
    bawah:    { warna: "hijau",  rx: 90,  ry: 0 },
  };
  const TEMA = { coklat: "Masa depan · Rencana · Mimpi", hijau: "Komitmen · Kejujuran · Kasih sayang" };
  const DAFTAR = { coklat: KARTU_COKLAT, hijau: KARTU_HIJAU };

  // ---------- Keadaan lokal ----------
  let peer = null;
  let conn = null;
  let peran = null;          // "host" | "tamu"
  let kode = null;
  let namaSaya = "";
  let state = null;
  let terhubung = false;
  let animasiSampai = 0;
  let putaranDadu = 0;
  let rondeTerakhir = -1;
  let rollTerakhir = -1;
  let timerSambung = null;
  let sengajaKeluar = false;
  let pesanTerakhir = 0;      // waktu terakhir menerima data dari lawan
  const BATAS_SENYAP = 12000; // lebih dari ini tanpa kabar = dianggap terputus

  const $ = (id) => document.getElementById(id);

  // ---------- Utilitas ----------
  function acak(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function urutan(n) { return Array.from({ length: n }, (_, i) => i); }
  function buatKode() {
    let k = "";
    for (let i = 0; i < 5; i++) k += HURUF_KODE[Math.floor(Math.random() * HURUF_KODE.length)];
    return k;
  }
  function bersihkanKode(v) { return (v || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5); }
  function tautanRuangan() { return location.origin + location.pathname + "?room=" + kode; }

  function toast(teks) {
    const t = $("toast");
    t.textContent = teks;
    t.classList.add("tampil");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove("tampil"), 2600);
  }

  function tampilkanLayar(id) {
    document.querySelectorAll(".layar").forEach((el) => el.classList.toggle("aktif", el.id === id));
    window.scrollTo(0, 0);
  }

  function pesan(id, teks, ok) {
    const el = $(id);
    el.textContent = teks || "";
    el.classList.toggle("ok", !!ok);
  }

  function simpanSesi() {
    try {
      const data = { peran, kode, nama: namaSaya };
      if (peran === "host") data.state = state;
      localStorage.setItem(KUNCI_SESI, JSON.stringify(data));
    } catch (e) { /* penyimpanan tidak tersedia */ }
  }
  function bacaSesi() {
    try { return JSON.parse(localStorage.getItem(KUNCI_SESI)); } catch (e) { return null; }
  }
  function hapusSesi() {
    try { localStorage.removeItem(KUNCI_SESI); } catch (e) { /* abaikan */ }
  }

  function opsiPeer() {
    // Untuk pengujian lokal: ?server=localhost:9000
    const s = new URLSearchParams(location.search).get("server");
    if (!s) return { debug: 1 };
    const [host, port] = s.split(":");
    return { host, port: Number(port) || 9000, path: "/", secure: false, debug: 1 };
  }

  function tutupPeer() {
    clearTimeout(timerSambung);
    if (conn) { try { conn.close(); } catch (e) {} }
    if (peer) { try { peer.destroy(); } catch (e) {} }
    conn = null;
    peer = null;
  }

  // ---------- Keadaan permainan (dikelola host) ----------
  function stateBaru(namaHost, ronde) {
    return {
      nama: [namaHost, null],
      dek: { coklat: acak(urutan(KARTU_COKLAT.length)), hijau: acak(urutan(KARTU_HIJAU.length)) },
      giliran: 0,
      kini: null,
      riwayat: [],
      rollId: 0,
      ronde: ronde || 0,
    };
  }

  function sisaTotal(s) { return s.dek.coklat.length + s.dek.hijau.length; }

  function putar(oleh) {
    if (!state || state.giliran !== oleh || sisaTotal(state) === 0) return;
    if (Date.now() < animasiSampai) return;

    let warna = Math.random() < 0.5 ? "coklat" : "hijau";
    if (state.dek[warna].length === 0) warna = warna === "coklat" ? "hijau" : "coklat";

    const pilihanSisi = Object.keys(SISI).filter((k) => SISI[k].warna === warna);
    const sisi = pilihanSisi[Math.floor(Math.random() * pilihanSisi.length)];
    const idx = state.dek[warna].pop();
    const nomor = DAFTAR[warna].length - state.dek[warna].length;

    state.kini = { warna, sisi, idx, teks: DAFTAR[warna][idx], nomor, oleh };
    state.riwayat.push(state.kini);
    state.giliran = 1 - state.giliran;
    state.rollId += 1;

    simpanSesi();
    kirimState(true);
    terapkanState(state, true);
  }

  function mulaiUlang() {
    state = Object.assign(stateBaru(state.nama[0], state.ronde + 1), { nama: state.nama });
    simpanSesi();
    kirimState(false);
    terapkanState(state, false);
  }

  function kirimState(animasi) {
    if (peran === "host" && conn && conn.open) conn.send({ t: "state", state, animasi });
  }

  // ---------- Tampilan permainan ----------
  function indeksSaya() { return peran === "host" ? 0 : 1; }

  function aturDadu(sisi, animasi) {
    const dadu = $("dadu");
    const target = SISI[sisi] || { rx: 0, ry: 0 };
    if (animasi) putaranDadu += 2;
    const rx = target.rx + 360 * putaranDadu;
    const ry = target.ry + 360 * putaranDadu;
    dadu.style.transition = animasi ? "" : "none";
    dadu.style.transform = `rotateX(-18deg) rotateY(24deg) rotateX(${rx}deg) rotateY(${ry}deg)`;
    if (!animasi) { void dadu.offsetWidth; dadu.style.transition = ""; }

    const wadah = dadu.parentElement;
    wadah.classList.remove("berputar");
    if (animasi) { void wadah.offsetWidth; wadah.classList.add("berputar"); }
  }

  function tampilKartu(kini, balik) {
    const k = $("kartu");
    k.classList.remove("kosong", "coklat", "hijau", "balik", "tunggu");
    if (!kini) {
      k.classList.add("kosong");
      $("kartu-tema").textContent = "Belum ada kartu";
      $("kartu-teks").textContent = "Putar dadu untuk mengambil kartu pertama.";
      $("kartu-no").textContent = "";
      return;
    }
    k.classList.add(kini.warna);
    $("kartu-tema").textContent = TEMA[kini.warna];
    $("kartu-teks").textContent = kini.teks;
    const penarik = state.nama[kini.oleh] || "Pemain";
    $("kartu-no").textContent = `Kartu ${kini.warna === "coklat" ? "Cokelat" : "Hijau"} ${kini.nomor}/${DAFTAR[kini.warna].length} · diambil ${penarik}`;
    if (balik) { void k.offsetWidth; k.classList.add("balik"); }
  }

  function perbaruiKontrol() {
    if (!state) return;
    const saya = indeksSaya();
    const sedangAnimasi = Date.now() < animasiSampai;
    const habis = sisaTotal(state) === 0;
    const lawan = state.nama[1 - saya] || "pasanganmu";

    [0, 1].forEach((i) => {
      const el = $("pemain-" + i);
      el.querySelector(".nama").textContent = (state.nama[i] || "Menunggu...") + (i === saya ? " (kamu)" : "");
      el.classList.toggle("giliran-ini", !habis && state.giliran === i);
      el.classList.toggle("offline", i !== saya && !terhubung);
    });

    const ko = $("status-koneksi");
    ko.className = "koneksi " + (terhubung ? "on" : "off");
    ko.title = terhubung ? "Terhubung" : "Tidak terhubung";

    const info = $("info-giliran");
    const btn = $("btn-putar");
    if (habis) {
      info.textContent = sedangAnimasi ? "Mengambil kartu terakhir..." : "Semua kartu sudah keluar.";
      info.classList.remove("saya");
      btn.textContent = "Selesai bermain";
      btn.disabled = sedangAnimasi;
    } else {
      btn.textContent = "Putar Dadu";
      const giliranSaya = state.giliran === saya;
      if (sedangAnimasi) info.textContent = "Dadu sedang berputar...";
      else if (!terhubung) info.textContent = "Menunggu koneksi dengan " + lawan + "...";
      else if (giliranSaya) info.textContent = "Giliran kamu memutar dadu";
      else info.textContent = "Menunggu " + lawan + " memutar dadu";
      info.classList.toggle("saya", giliranSaya && terhubung && !sedangAnimasi);
      btn.disabled = !giliranSaya || !terhubung || sedangAnimasi;
    }
  }

  function perbaruiSisaDanRiwayat() {
    $("sisa-coklat").textContent = state.dek.coklat.length;
    $("sisa-hijau").textContent = state.dek.hijau.length;
    $("jumlah-riwayat").textContent = state.riwayat.length;
    const ol = $("daftar-riwayat");
    ol.innerHTML = "";
    state.riwayat.slice().reverse().forEach((r) => {
      const li = document.createElement("li");
      li.className = r.warna;
      const kecil = document.createElement("small");
      kecil.textContent = (r.warna === "coklat" ? "Cokelat " : "Hijau ") + r.nomor + " · " + (state.nama[r.oleh] || "Pemain");
      li.appendChild(kecil);
      li.appendChild(document.createTextNode(r.teks));
      ol.appendChild(li);
    });
  }

  function terapkanState(s, animasi) {
    const rondeBaru = s.ronde !== rondeTerakhir;
    const adaRollBaru = !rondeBaru && s.rollId > rollTerakhir;
    state = s;
    rondeTerakhir = s.ronde;
    rollTerakhir = s.rollId;

    if (rondeBaru && !$("layar-main").classList.contains("aktif")) tampilkanLayar("layar-main");
    if (rondeBaru && $("layar-selesai").classList.contains("aktif")) tampilkanLayar("layar-main");

    if (animasi && adaRollBaru && s.kini) {
      animasiSampai = Date.now() + LAMA_ANIMASI;
      aturDadu(s.kini.sisi, true);
      $("kartu").classList.add("tunggu");
      perbaruiKontrol();
      setTimeout(() => {
        if (state !== s) return;
        tampilKartu(s.kini, true);
        perbaruiSisaDanRiwayat();
        perbaruiKontrol();
      }, LAMA_ANIMASI);
    } else {
      animasiSampai = 0;
      aturDadu(s.kini ? s.kini.sisi : "depan", false);
      tampilKartu(s.kini, rondeBaru && !!s.kini);
      perbaruiSisaDanRiwayat();
      perbaruiKontrol();
    }
  }

  function aturTerhubung(v) {
    terhubung = v;
    perbaruiKontrol();
  }

  // ---------- Host ----------
  function mulaiHost(lanjutan, percobaan) {
    percobaan = percobaan || 0;
    sengajaKeluar = false;
    peer = new Peer(AWALAN_ID + kode, opsiPeer());

    peer.on("open", () => {
      simpanSesi();
      if (lanjutan && state.nama[1]) {
        tampilkanLayar("layar-main");
        terapkanState(state, false);
        aturTerhubung(false);
        toast("Ruangan dibuka lagi. Menunggu " + state.nama[1] + " tersambung.");
      } else {
        tampilkanRuanganTunggu();
      }
    });

    peer.on("connection", (c) => {
      c.on("data", (d) => terimaDariTamu(c, d));
      c.on("close", () => {
        if (c !== conn) return;
        conn = null;
        aturTerhubung(false);
        if (!sengajaKeluar && state && state.nama[1]) toast(state.nama[1] + " terputus. Menunggu tersambung lagi.");
      });
    });

    peer.on("disconnected", () => {
      if (!sengajaKeluar && peer && !peer.destroyed) setTimeout(() => peer && !peer.destroyed && peer.reconnect(), 1500);
    });

    peer.on("error", (err) => {
      if (err.type === "unavailable-id") {
        tutupPeer();
        if (lanjutan && percobaan < 5) {
          pesan("pesan-awal", "Membuka ruangan lagi...", true);
          setTimeout(() => mulaiHost(true, percobaan + 1), 3000);
        } else if (!lanjutan) {
          kode = buatKode();
          mulaiHost(false, percobaan + 1);
        } else {
          pesan("pesan-awal", "Ruangan lama tidak bisa dibuka. Silakan buat ruangan baru.");
          tampilkanLayar("layar-awal");
        }
        return;
      }
      tanganiErrorUmum(err);
    });
  }

  function terimaDariTamu(c, d) {
    if (!d || typeof d !== "object") return;
    if (c === conn || d.t === "halo") pesanTerakhir = Date.now();
    if (d.t === "ping") {
      if (c === conn) {
        try { c.send({ t: "pong" }); } catch (e) {}
        if (!terhubung) aturTerhubung(true);
      }
      return;
    }
    if (d.t === "halo") {
      if (conn && conn !== c) { try { conn.close(); } catch (e) {} }
      conn = c;
      const namaTamu = String(d.nama || "Tamu").slice(0, 20);
      const baru = !state.nama[1];
      state.nama[1] = namaTamu;
      simpanSesi();
      aturTerhubung(true);
      kirimState(false);
      if (!$("layar-main").classList.contains("aktif") && !$("layar-selesai").classList.contains("aktif")) {
        tampilkanLayar("layar-main");
      }
      terapkanState(state, false);
      toast(namaTamu + (baru ? " bergabung" : " tersambung lagi"));
      return;
    }
    if (c !== conn) return;
    if (d.t === "putar") putar(1);
    if (d.t === "ulang") { mulaiUlang(); toast(state.nama[1] + " memulai ulang kartu"); }
  }

  function tampilkanRuanganTunggu() {
    $("tampil-kode").textContent = kode;
    const teks = "Yuk main Saling Bercerita bareng aku. Buka tautan ini: " + tautanRuangan() + " (kode ruangan: " + kode + ")";
    $("btn-wa").href = "https://wa.me/?text=" + encodeURIComponent(teks);
    pesan("pesan-tunggu", location.protocol === "file:" ? "Halaman ini dibuka dari file lokal, jadi tautan tidak bisa dibuka orang lain. Bagikan kodenya saja, atau unggah game ke hosting." : "");
    tampilkanLayar("layar-tunggu");
  }

  // ---------- Tamu ----------
  function mulaiTamu() {
    sengajaKeluar = false;
    peer = new Peer(opsiPeer());
    peer.on("open", sambungKeHost);
    peer.on("disconnected", () => {
      if (!sengajaKeluar && peer && !peer.destroyed) setTimeout(() => peer && !peer.destroyed && peer.reconnect(), 1500);
    });
    peer.on("error", (err) => {
      if (err.type === "peer-unavailable") {
        if (state) {
          aturTerhubung(false);
          jadwalkanSambungUlang();
        } else {
          pesan("pesan-awal", "Ruangan " + kode + " tidak ditemukan. Periksa kodenya, atau minta pasanganmu membuka ruangan dulu.");
          setTombolAwal(false);
          tutupPeer();
        }
        return;
      }
      tanganiErrorUmum(err);
    });
  }

  function sambungKeHost() {
    if (!peer || peer.destroyed || sengajaKeluar) return;
    clearTimeout(timerSambung);
    timerSambung = null;
    if (conn) { const lama = conn; conn = null; try { lama.close(); } catch (e) {} }
    const c = peer.connect(AWALAN_ID + kode, { reliable: true });
    conn = c;
    c.on("open", () => {
      c.send({ t: "halo", nama: namaSaya });
      simpanSesi();
    });
    c.on("data", (d) => {
      if (!d || typeof d !== "object") return;
      pesanTerakhir = Date.now();
      if (d.t === "pong") { if (!terhubung && state) aturTerhubung(true); return; }
      if (d.t === "state") {
        if (!terhubung) aturTerhubung(true);
        terhubung = true;
        if (!$("layar-main").classList.contains("aktif") && !$("layar-selesai").classList.contains("aktif")) {
          tampilkanLayar("layar-main");
          setTombolAwal(false);
          pesan("pesan-awal", "");
        }
        terapkanState(d.state, !!d.animasi);
      }
      if (d.t === "tutup") {
        sengajaKeluar = true;
        hapusSesi();
        tutupPeer();
        state = null;
        tampilkanLayar("layar-awal");
        pesan("pesan-awal", "Ruangan sudah ditutup oleh pembuatnya.");
      }
    });
    c.on("close", () => {
      if (c !== conn || sengajaKeluar) return;
      aturTerhubung(false);
      toast("Koneksi terputus. Mencoba menyambung lagi...");
      jadwalkanSambungUlang();
    });
  }

  function jadwalkanSambungUlang() {
    clearTimeout(timerSambung);
    timerSambung = setTimeout(sambungKeHost, 3000);
  }

  // ---------- Error umum ----------
  function tanganiErrorUmum(err) {
    console.warn("PeerJS:", err.type, err);
    const daftar = {
      "browser-incompatible": "Browser ini tidak mendukung permainan online. Coba Chrome atau Safari terbaru.",
      "network": "Tidak bisa terhubung ke server. Periksa koneksi internetmu.",
      "server-error": "Server sedang bermasalah. Coba lagi sebentar lagi.",
      "socket-error": "Koneksi ke server terputus. Coba lagi.",
      "socket-closed": "Koneksi ke server terputus. Coba lagi.",
    };
    const teks = daftar[err.type] || "Terjadi gangguan koneksi (" + err.type + ").";
    if ($("layar-awal").classList.contains("aktif")) {
      pesan("pesan-awal", teks);
      setTombolAwal(false);
    } else {
      toast(teks);
    }
  }

  // ---------- Layar awal ----------
  function setTombolAwal(sibuk) {
    $("btn-buat").disabled = sibuk;
    $("btn-gabung").disabled = sibuk;
    $("btn-lanjut").disabled = sibuk;
  }

  function ambilNama() {
    const n = $("input-nama").value.trim();
    if (!n) {
      pesan("pesan-awal", "Tulis namamu dulu, ya.");
      $("input-nama").focus();
      return null;
    }
    return n.slice(0, 20);
  }

  function buatRuangan() {
    const n = ambilNama();
    if (!n) return;
    tutupPeer();
    namaSaya = n;
    peran = "host";
    kode = buatKode();
    state = stateBaru(n, 0);
    rondeTerakhir = -1;
    rollTerakhir = -1;
    pesan("pesan-awal", "Membuat ruangan...", true);
    setTombolAwal(true);
    mulaiHost(false);
  }

  function gabungRuangan() {
    const n = ambilNama();
    if (!n) return;
    const k = bersihkanKode($("input-kode").value);
    if (k.length !== 5) {
      pesan("pesan-awal", "Kode ruangan terdiri dari 5 huruf atau angka.");
      $("input-kode").focus();
      return;
    }
    tutupPeer();
    namaSaya = n;
    peran = "tamu";
    kode = k;
    state = null;
    rondeTerakhir = -1;
    rollTerakhir = -1;
    pesan("pesan-awal", "Menyambung ke ruangan " + k + "...", true);
    setTombolAwal(true);
    mulaiTamu();
  }

  function lanjutkanSesi() {
    const s = bacaSesi();
    if (!s) return;
    tutupPeer();
    namaSaya = s.nama;
    kode = s.kode;
    peran = s.peran;
    rondeTerakhir = -1;
    rollTerakhir = -1;
    setTombolAwal(true);
    pesan("pesan-awal", "Membuka ruangan " + kode + "...", true);
    if (peran === "host" && s.state) {
      state = s.state;
      mulaiHost(true);
    } else {
      state = null;
      mulaiTamu();
    }
  }

  function keluar() {
    if (!confirm("Keluar dari ruangan ini?")) return;
    sengajaKeluar = true;
    if (peran === "host" && conn && conn.open) { try { conn.send({ t: "tutup" }); } catch (e) {} }
    setTimeout(tutupPeer, 200);
    hapusSesi();
    state = null;
    peran = null;
    terhubung = false;
    siapkanLayarAwal();
    tampilkanLayar("layar-awal");
  }

  function siapkanLayarAwal() {
    setTombolAwal(false);
    pesan("pesan-awal", "");
    const s = bacaSesi();
    const btn = $("btn-lanjut");
    if (s && s.kode && s.nama) {
      btn.hidden = false;
      btn.textContent = "Lanjutkan ruangan " + s.kode + " sebagai " + s.nama;
    } else {
      btn.hidden = true;
    }
  }

  // ---------- Penjaga koneksi ----------
  // HP sering memutus koneksi saat browser ditinggal ke WhatsApp.
  // Detak ini memeriksa koneksi secara berkala dan menyambung ulang otomatis.
  setInterval(() => {
    if (!peer || sengajaKeluar || !state) return;
    if (peer.disconnected && !peer.destroyed) { try { peer.reconnect(); } catch (e) {} }
    const senyap = Date.now() - pesanTerakhir > BATAS_SENYAP;
    if (peran === "tamu") {
      if (conn && conn.open) {
        try { conn.send({ t: "ping" }); } catch (e) {}
        if (senyap) { aturTerhubung(false); sambungKeHost(); }
      } else if (!timerSambung || senyap) {
        aturTerhubung(false);
        sambungKeHost();
      }
    } else if (peran === "host" && terhubung && senyap) {
      aturTerhubung(false);
    }
  }, 4000);

  function saatKembali() {
    if (document.visibilityState !== "visible" || !peer || sengajaKeluar) return;
    if (peer.destroyed) {
      if (peran === "host" && state) mulaiHost(true);
      else if (peran === "tamu") mulaiTamu();
      return;
    }
    if (peer.disconnected) { try { peer.reconnect(); } catch (e) {} }
    if (peran === "tamu" && state) {
      if (conn && conn.open) { try { conn.send({ t: "ping" }); } catch (e) {} }
      else sambungKeHost();
    }
  }
  document.addEventListener("visibilitychange", saatKembali);
  window.addEventListener("pageshow", saatKembali);
  window.addEventListener("online", saatKembali);

  // ---------- Pasang tombol ----------
  $("btn-buat").addEventListener("click", buatRuangan);
  $("btn-gabung").addEventListener("click", gabungRuangan);
  $("btn-lanjut").addEventListener("click", lanjutkanSesi);
  $("input-kode").addEventListener("input", (e) => { e.target.value = bersihkanKode(e.target.value); });
  $("input-kode").addEventListener("keydown", (e) => { if (e.key === "Enter") gabungRuangan(); });

  $("btn-salin").addEventListener("click", async () => {
    const link = tautanRuangan();
    try {
      await navigator.clipboard.writeText(link);
    } catch (e) {
      const t = document.createElement("textarea");
      t.value = link; document.body.appendChild(t); t.select();
      try { document.execCommand("copy"); } catch (_) {}
      t.remove();
    }
    toast("Tautan disalin");
  });

  $("btn-batal").addEventListener("click", () => {
    sengajaKeluar = true;
    tutupPeer();
    hapusSesi();
    state = null;
    siapkanLayarAwal();
    tampilkanLayar("layar-awal");
  });

  $("btn-putar").addEventListener("click", () => {
    if (!state) return;
    if (sisaTotal(state) === 0) { tampilkanLayar("layar-selesai"); return; }
    if (state.giliran !== indeksSaya() || Date.now() < animasiSampai) return;
    if (peran === "host") putar(0);
    else if (conn && conn.open) {
      conn.send({ t: "putar" });
      $("btn-putar").disabled = true;
    }
  });

  function mintaUlang() {
    if (peran === "host") mulaiUlang();
    else if (conn && conn.open) conn.send({ t: "ulang" });
    else toast("Belum terhubung dengan pasanganmu.");
  }
  $("btn-ulang").addEventListener("click", () => {
    if (confirm("Kocok ulang semua kartu dan mulai dari awal?")) mintaUlang();
  });
  $("btn-main-lagi").addEventListener("click", mintaUlang);
  $("btn-keluar").addEventListener("click", keluar);
  $("btn-keluar-2").addEventListener("click", keluar);

  // ---------- Mulai ----------
  const ruangDariTautan = bersihkanKode(new URLSearchParams(location.search).get("room"));
  const sesiLama = bacaSesi();
  if (sesiLama && sesiLama.nama) $("input-nama").value = sesiLama.nama;
  if (ruangDariTautan) {
    $("input-kode").value = ruangDariTautan;
    pesan("pesan-awal", "Kamu diundang ke ruangan " + ruangDariTautan + ". Tulis namamu lalu tekan Gabung.", true);
  }
  siapkanLayarAwal();
  if (ruangDariTautan) pesan("pesan-awal", "Kamu diundang ke ruangan " + ruangDariTautan + ". Tulis namamu lalu tekan Gabung.", true);
  if (typeof Peer === "undefined") {
    pesan("pesan-awal", "Gagal memuat komponen online. Periksa koneksi internet lalu muat ulang halaman.");
    setTombolAwal(true);
  }
})();
