'use strict';

// İle ve yıla özgü tüm değerler yalnızca burada durur.
const AYARLAR = {
  il: "Erzurum",
  iletisim: "erzurumstem@gmail.com",
  donem: "2026-2027",
  baslangic: "2026-09-01",
  bitis: "2027-08-31",
  veriUrl: "https://script.google.com/macros/s/AKfycbyS3Or1oT0mRt6PY7kYW70DGlwTgmYiiyvP0ffC3sb35ctWXvO0OMksnJQOyxZ4Ah_lxg/exec",
  testVeriUrl: "data/ornek-etkinlikler.json",
  formUrl: "https://docs.google.com/forms/d/e/1FAIpQLSfg8AG0ynp-Wg6yT4kMTUGu-GVa98dEuNw9yEN6Kv5EXyG8Uw/viewform"
};

// Bilgisayarda (localhost) veya ev ağından (telefonla deneme) açılınca
// uydurma test verisi yüklenir; canlı sitede test verisi asla gösterilmez.
const YEREL_MI = /^(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/
  .test(location.hostname);

// Veride yalnızca kod bulunur, ekranda yalnızca etiket gösterilir.
const SOZLUK = {
  // İşaretçi rengi YALNIZCA kapsama göre belirlenir (Okabe-Ito, renk
  // körlüğüne uygun). Sarı iğne açık zeminde seçilsin diye koyu kenarlıdır.
  kapsam: {
    bagimsiz: { etiket: "Okul içi / bağımsız", renk: "#0072B2" },
    tubitak: { etiket: "TÜBİTAK", renk: "#D55E00" },
    etwinning: { etiket: "eTwinning", renk: "#56B4E9" },
    teknofest: { etiket: "Teknofest", renk: "#E69F00" },
    codeweek: { etiket: "EU Code Week", renk: "#009E73" },
    erasmus: { etiket: "Erasmus+", renk: "#CC79A7" },
    harezmi: { etiket: "Harezmi Eğitim Modeli", renk: "#F0E442", kenar: "#6b6400" },
    diger: { etiket: "Diğer program", renk: "#7F7F7F" }
  },
  // Birden çok içerik seçilebilir; veride kod listesi olarak gelir.
  icerik: {
    kodlama: "Kodlama ve Algoritma",
    robotik: "Robotik ve Elektronik",
    tasarim: "Tasarım ve Üretim",
    fen: "Fen Deneyi ve Gözlem",
    yapayzeka: "Yapay Zekâ ve Veri",
    unplugged: "Bilgisayarsız Etkinlik",
    diger: "Diğer STEM etkinlikleri"
  },
  // STEM School Label (European Schoolnet) türleri.
  etiketTuru: {
    competent: "Competent",
    proficient: "Proficient",
    expert: "Expert"
  },
  sinifDuzeyi: {
    okuloncesi: "Okul Öncesi",
    "1-4": "İlkokul (1-4)",
    "5-8": "Ortaokul (5-8)",
    "9-12": "Lise (9-12)",
    karma: "Karma"
  }
};

const ETIKET_ADI = "STEM School Label";

const ACIKLAMA_SINIRI = 300;
const NOKTA_DENEME_SAYISI = 200;
// Nokta, ilçe sınırına en az (ilçe boyutu × bu oran) uzaklıkta olmalı;
// yoksa sınır üstündeki nokta "hangi ilçede?" sorusuna yol açar.
const SINIR_PAYI_ORANI = 0.12;

const ILCE_STILI = {
  color: "#1f3b63",
  weight: 1.8,
  opacity: 0.85,
  fillColor: "#1f3b63",
  fillOpacity: 0.08
};
const ILCE_VURGU_STILI = { weight: 3, fillOpacity: 0.14 };
const ILCE_SECILI_STILI = { color: "#0b1f3a", weight: 4, opacity: 1, fillOpacity: 0.16 };

// Veriden gelen metin her zaman textContent ile basılır (XSS önlemi).
function metinDugumu(metin, sinif) {
  const el = document.createElement("span");
  if (sinif) el.className = sinif;
  el.textContent = metin;
  return el;
}

// ---------------------------------------------------------------------------
// Deterministik rastgelelik: aynı okul her yenilemede aynı noktaya düşer.

// Metinden 32 bitlik tohum (FNV-1a).
function tohumUret(metin) {
  let h = 0x811c9dc5;
  for (let i = 0; i < metin.length; i++) {
    h ^= metin.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Tohumlu sayı üreteci (mulberry32); 0 ile 1 arasında sayı döndürür.
function mulberry32(tohum) {
  return function () {
    tohum = (tohum + 0x6d2b79f5) | 0;
    let t = tohum;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Geometri. Koordinatlar GeoJSON sırasıyladır: [boylam, enlem].

// Işın atma: noktadan sağa çekilen ışın halkayı tek sayıda keserse içeridedir.
function halkaIcindeMi(x, y, halka) {
  let icinde = false;
  for (let i = 0, j = halka.length - 1; i < halka.length; j = i++) {
    const [xi, yi] = halka[i];
    const [xj, yj] = halka[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      icinde = !icinde;
    }
  }
  return icinde;
}

// Dış halkanın içinde ve hiçbir deliğin (iç halkanın) içinde değilse.
function poligonIcindeMi(x, y, poligon) {
  if (!halkaIcindeMi(x, y, poligon[0])) return false;
  for (let k = 1; k < poligon.length; k++) {
    if (halkaIcindeMi(x, y, poligon[k])) return false;
  }
  return true;
}

function halkaAlani(halka) {
  let toplam = 0;
  for (let i = 0, j = halka.length - 1; i < halka.length; j = i++) {
    toplam += (halka[j][0] + halka[i][0]) * (halka[j][1] - halka[i][1]);
  }
  return Math.abs(toplam / 2);
}

function poligonAlani(poligon) {
  return poligon.reduce((alan, halka, k) => alan + (k === 0 ? 1 : -1) * halkaAlani(halka), 0);
}

// Noktanın poligonun en yakın kenarına uzaklığı (derece; boylam enleme göre ölçeklenir).
function kenaraUzaklik(x, y, poligon) {
  const olcek = Math.cos((y * Math.PI) / 180);
  let enAz = Infinity;
  for (const halka of poligon) {
    for (let i = 0, j = halka.length - 1; i < halka.length; j = i++) {
      const ax = halka[j][0] * olcek, ay = halka[j][1];
      const bx = halka[i][0] * olcek, by = halka[i][1];
      const px = x * olcek, py = y;
      const dx = bx - ax, dy = by - ay;
      const uzunluk2 = dx * dx + dy * dy;
      const t = uzunluk2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / uzunluk2)) : 0;
      enAz = Math.min(enAz, Math.hypot(px - (ax + t * dx), py - (ay + t * dy)));
    }
  }
  return enAz;
}

function halkaAgirlikMerkezi(halka) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = halka.length - 1; i < halka.length; j = i++) {
    const [x0, y0] = halka[j];
    const [x1, y1] = halka[i];
    const f = x0 * y1 - x1 * y0;
    a += f;
    cx += (x0 + x1) * f;
    cy += (y0 + y1) * f;
  }
  return [cx / (3 * a), cy / (3 * a)];
}

// Bir ilçenin parçalarını (MultiPolygon'da birden çok) alan ve kutusuyla hazırlar.
function ilceGeometrisiHazirla(ozellik) {
  const g = ozellik.geometry;
  const poligonlar = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  const parcalar = poligonlar.map((poligon) => {
    const xler = poligon[0].map((n) => n[0]);
    const yler = poligon[0].map((n) => n[1]);
    return {
      poligon,
      alan: poligonAlani(poligon),
      kutu: [Math.min(...xler), Math.min(...yler), Math.max(...xler), Math.max(...yler)]
    };
  });
  return {
    ad: ozellik.properties.ad,
    parcalar,
    toplamAlan: parcalar.reduce((t, p) => t + p.alan, 0)
  };
}

// İlçe içinde, anahtara bağlı sabit bir nokta üretir. Leaflet sırasıyla
// [enlem, boylam] döndürür.
function temsiliNokta(ilceGeo, anahtar) {
  const rastgele = mulberry32(tohumUret(anahtar));

  // Parça, alanıyla orantılı olasılıkla seçilir (küçük adacıklar kayırılmaz).
  let esik = rastgele() * ilceGeo.toplamAlan;
  let parca = ilceGeo.parcalar[ilceGeo.parcalar.length - 1];
  for (const p of ilceGeo.parcalar) {
    esik -= p.alan;
    if (esik <= 0) { parca = p; break; }
  }

  // İçeride olan ve sınıra yeterince uzak ilk nokta alınır. Hiçbiri yeterince
  // uzak değilse içeride bulunan en uzak nokta kullanılır.
  const [minX, minY, maxX, maxY] = parca.kutu;
  const pay = SINIR_PAYI_ORANI * Math.sqrt(parca.alan);
  let enIyi = null;
  for (let deneme = 0; deneme < NOKTA_DENEME_SAYISI; deneme++) {
    const x = minX + rastgele() * (maxX - minX);
    const y = minY + rastgele() * (maxY - minY);
    if (!poligonIcindeMi(x, y, parca.poligon)) continue;
    const uzaklik = kenaraUzaklik(x, y, parca.poligon);
    if (uzaklik >= pay) return [y, x];
    if (!enIyi || uzaklik > enIyi.uzaklik) enIyi = { x, y, uzaklik };
  }
  if (enIyi) return [enIyi.y, enIyi.x];

  const enBuyuk = ilceGeo.parcalar.reduce((a, b) => (b.alan > a.alan ? b : a));
  const [x, y] = halkaAgirlikMerkezi(enBuyuk.poligon[0]);
  console.warn(`${anahtar}: ${NOKTA_DENEME_SAYISI} denemede nokta bulunamadı, ilçenin ağırlık merkezine konuldu.`);
  return [y, x];
}

// ---------------------------------------------------------------------------
// Veri doğrulama (CLAUDE.md "Doğrulama kuralları").

function metin(deger) {
  return deger === undefined || deger === null ? "" : String(deger).trim();
}

function sayi(deger) {
  const n = Number(deger);
  return deger === undefined || deger === null || deger === "" || !Number.isFinite(n) ? 0 : n;
}

function aciklamaKirp(deger) {
  const harfler = Array.from(metin(deger));
  return harfler.length > ACIKLAMA_SINIRI
    ? harfler.slice(0, ACIKLAMA_SINIRI).join("").trimEnd() + "…"
    : harfler.join("");
}

function okulAnahtari(okulAdi, ilce) {
  return `${okulAdi}|${ilce}`;
}

function kayitlariDogrula(hamKayitlar, ilceAdlari) {
  if (!Array.isArray(hamKayitlar)) throw new Error("Etkinlik verisi bir liste değil.");
  const sonuc = [];

  for (const ham of hamKayitlar) {
    if (!ham || ham.onay !== true) continue;
    const id = metin(ham.id);
    const uyar = (neden) => console.warn(`Kayıt ${id}: ${neden}`);

    const tarih = metin(ham.tarih);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tarih) || tarih < AYARLAR.baslangic || tarih > AYARLAR.bitis) {
      uyar(`tarih "${tarih}" dönem dışında veya geçersiz, atlandı.`);
      continue;
    }

    // Bitiş tarihi isteğe bağlıdır (tek günlük etkinlikte yoktur).
    let bitisTarihi = metin(ham.bitisTarihi);
    if (bitisTarihi && (!/^\d{4}-\d{2}-\d{2}$/.test(bitisTarihi) || bitisTarihi < tarih)) {
      uyar(`bitiş tarihi "${bitisTarihi}" geçersiz veya başlangıçtan önce, yok sayıldı.`);
      bitisTarihi = "";
    }
    if (bitisTarihi === tarih) bitisTarihi = "";

    const ilce = metin(ham.ilce);
    if (!ilceAdlari.has(ilce)) {
      uyar(`ilçe "${ilce}" ilçe listesinde yok, atlandı.`);
      continue;
    }

    // Okul listesi yoktur: okullar kayıtlardan oluşur. Yazım farkları
    // yönetici tarafından Sheets'te onaydan önce düzeltilir.
    const okulAdi = metin(ham.okulAdi);
    if (!okulAdi) {
      uyar("okul adı boş, atlandı.");
      continue;
    }
    const anahtar = okulAnahtari(okulAdi, ilce);

    let kapsam = metin(ham.kapsam);
    if (!Object.hasOwn(SOZLUK.kapsam, kapsam)) { uyar(`tanımsız kapsam "${kapsam}", Diğer sayıldı.`); kapsam = "diger"; }

    // Eski kayıtlarda içerik tek bir koddur; yenilerde kod listesidir.
    const icerikKodlari = (Array.isArray(ham.icerik) ? ham.icerik : [ham.icerik]).map(metin);
    const icerikSecili = new Set();
    for (const kod of icerikKodlari) {
      if (Object.hasOwn(SOZLUK.icerik, kod)) icerikSecili.add(kod);
      else { uyar(`tanımsız içerik "${kod}", Diğer sayıldı.`); icerikSecili.add("diger"); }
    }
    if (!icerikSecili.size) icerikSecili.add("diger");
    const icerik = Object.keys(SOZLUK.icerik).filter((kod) => icerikSecili.has(kod));

    let sinifDuzeyi = metin(ham.sinifDuzeyi);
    if (!Object.hasOwn(SOZLUK.sinifDuzeyi, sinifDuzeyi)) { uyar(`tanımsız sınıf düzeyi "${sinifDuzeyi}", "—" gösterilecek.`); sinifDuzeyi = null; }

    const kizSayisi = sayi(ham.kizSayisi);
    const erkekSayisi = sayi(ham.erkekSayisi);

    sonuc.push({
      id,
      okulAdi,
      ilce,
      okulAnahtari: anahtar,
      etkinlikAdi: metin(ham.etkinlikAdi),
      kapsam,
      icerik,
      sinifDuzeyi,
      tarih,
      bitisTarihi,
      kizSayisi,
      erkekSayisi,
      toplamOgrenci: kizSayisi + erkekSayisi,
      aciklama: aciklamaKirp(ham.aciklama),
      ogretmenAdi: metin(ham.ogretmenAdi)
    });
  }
  return sonuc;
}

// Uç nokta { etkinlikler, etiketliOkullar } döndürür; eski biçim yalnızca
// etkinlik listesidir.
function veriyiAyir(ham) {
  if (Array.isArray(ham)) return { etkinlikler: ham, etiketliOkullar: [] };
  if (!ham || typeof ham !== "object") throw new Error("Veri biçimi tanınmadı.");
  return {
    etkinlikler: ham.etkinlikler,
    etiketliOkullar: Array.isArray(ham.etiketliOkullar) ? ham.etiketliOkullar : []
  };
}

// STEM School Label okulları: okul başına bir kayıt.
function etiketleriDogrula(hamListe, ilceAdlari) {
  const sonuc = new Map();
  for (const ham of hamListe) {
    if (!ham) continue;
    const okulAdi = metin(ham.okulAdi);
    const ilce = metin(ham.ilce);
    const uyar = (neden) => console.warn(`Etiket "${okulAdi}": ${neden}`);
    if (!okulAdi) { uyar("okul adı boş, atlandı."); continue; }
    if (!ilceAdlari.has(ilce)) { uyar(`ilçe "${ilce}" ilçe listesinde yok, atlandı.`); continue; }
    let tur = metin(ham.tur);
    if (tur && !Object.hasOwn(SOZLUK.etiketTuru, tur)) { uyar(`tanımsız tür "${tur}", tür gösterilmeyecek.`); tur = ""; }
    const yil = /^\d{4}$/.test(metin(ham.yil)) ? metin(ham.yil) : "";
    const anahtar = okulAnahtari(okulAdi, ilce);
    if (!sonuc.has(anahtar)) sonuc.set(anahtar, { okulAdi, ilce, okulAnahtari: anahtar, tur, yil });
  }
  return [...sonuc.values()];
}

// "STEM School Label (Expert, 2025)"
function etiketMetni(etiket) {
  const ek = [etiket.tur ? SOZLUK.etiketTuru[etiket.tur] : "", etiket.yil].filter(Boolean).join(", ");
  return ek ? `${ETIKET_ADI} (${ek})` : ETIKET_ADI;
}

// ---------------------------------------------------------------------------
// Sayfa

function durumGoster(mesaj, hataMi) {
  const el = document.getElementById("durum");
  el.textContent = mesaj;
  el.classList.toggle("hata", Boolean(hataMi));
  el.hidden = false;
}

function durumGizle() {
  document.getElementById("durum").hidden = true;
}

function sayfaBasliklariniKur() {
  const baslik = `${AYARLAR.il} STEM Etkinlik Haritası ${AYARLAR.donem}`;
  document.title = baslik;
  document.getElementById("baslik").textContent = baslik;

  for (const id of ["iletisim", "gizlilik-iletisim"]) {
    const baglanti = document.getElementById(id);
    baglanti.textContent = AYARLAR.iletisim;
    baglanti.href = `mailto:${AYARLAR.iletisim}`;
  }
}

function gizlilikKur() {
  const pencere = document.getElementById("gizlilik");
  document.getElementById("gizlilik-ac").addEventListener("click", () => pencere.showModal());
  document.getElementById("gizlilik-kapat").addEventListener("click", () => pencere.close());
  // Pencerenin dışına (arka plana) tıklayınca kapansın.
  pencere.addEventListener("click", (olay) => { if (olay.target === pencere) pencere.close(); });
}

// Altlık harita YOKTUR: yalnızca ilçeler çizilir. Böylece dışarıya istek
// gitmez ve işaretçilerin temsilî konumu köy/yol gibi yanlış okunmaz.
function haritaKur() {
  return L.map("harita", { zoomSnap: 0.25, maxZoom: 13 });
}

async function ilceleriYukle(harita, ilceTiklandi) {
  const yanit = await fetch("data/ilceler.geojson");
  if (!yanit.ok) throw new Error(`ilceler.geojson: HTTP ${yanit.status}`);
  const geojson = await yanit.json();

  // İlçe adları işaretçilerin ALTINDA kalsın diye ayrı katmanda.
  const adKatmani = harita.createPane("ilceAdlari");
  adKatmani.style.zIndex = 450;
  adKatmani.style.pointerEvents = "none";

  const ilceKatmanlari = new Map();
  let seciliIlce = null;
  const ilceStiliniYenile = (ilce) => {
    katman.resetStyle(ilce);
    if (ilce === seciliIlce) ilce.setStyle(ILCE_SECILI_STILI);
  };

  const katman = L.geoJSON(geojson, {
    style: ILCE_STILI,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap katkıcıları</a>',
    onEachFeature(ozellik, ilce) {
      // Her ilçenin adı ortasında bir kez yazar.
      ilce.bindTooltip(metinDugumu(ozellik.properties.ad), {
        permanent: true,
        direction: "center",
        className: "ilce-etiket",
        interactive: false,
        pane: "ilceAdlari"
      });
      ilce.on("mouseover", () => {
        if (ilce !== seciliIlce) ilce.setStyle(ILCE_VURGU_STILI);
      });
      ilce.on("mouseout", () => ilceStiliniYenile(ilce));
      ilce.on("click", (olay) => {
        L.DomEvent.stopPropagation(olay);
        ilceTiklandi(ozellik.properties.ad);
      });
      ilceKatmanlari.set(ozellik.properties.ad, ilce);
    }
  }).addTo(harita);

  const sinirlar = katman.getBounds();
  harita.fitBounds(sinirlar, { padding: [12, 12] });
  // Altlık olmadığı için il dışına kaydırma ve fazla uzaklaşma sınırlanır.
  // En küçük yakınlaştırma TAM SAYI olmalı: ondalıklı olursa markercluster
  // küme düzeylerini yanlış kuruyor ve tek başına duran işaretçileri çizmiyor.
  harita.setMinZoom(Math.floor(harita.getZoom()) - 1);
  harita.ilSiniri = sinirlar.pad(0.3);
  harita.setMaxBounds(harita.ilSiniri);

  // Seçili ilçeyi koyulaştırır ve haritayı ona (seçim yoksa ilin tamamına) yaklaştırır.
  function ilceVurgula(ad) {
    const yeni = ad ? ilceKatmanlari.get(ad) : null;
    if (yeni === seciliIlce) return;
    const onceki = seciliIlce;
    seciliIlce = yeni;
    if (onceki) ilceStiliniYenile(onceki);
    if (yeni) {
      yeni.setStyle(ILCE_SECILI_STILI);
      yeni.bringToFront();
      harita.fitBounds(yeni.getBounds(), { padding: [24, 24], maxZoom: 11 });
    } else {
      harita.fitBounds(sinirlar, { padding: [12, 12] });
    }
  }

  return { geojson, ilceVurgula };
}

async function jsonGetir(adres) {
  const yanit = await fetch(adres);
  if (!yanit.ok) throw new Error(`${adres}: HTTP ${yanit.status}`);
  return yanit.json();
}

async function veriyiYukle() {
  const adres = YEREL_MI ? AYARLAR.testVeriUrl : AYARLAR.veriUrl;
  if (!adres) return veriyiAyir([]);
  return veriyiAyir(await jsonGetir(adres));
}

// ---------------------------------------------------------------------------
// İşaretçiler

const TARIH_BICIMI = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" });

// "14 Ekim 2026"; bitiş varsa "14–18 Ekim 2026" / "28 Ekim – 3 Kasım 2026".
function tarihYaz(kayit) {
  const bas = new Date(`${kayit.tarih}T00:00:00`);
  if (!kayit.bitisTarihi) return TARIH_BICIMI.format(bas);
  const son = new Date(`${kayit.bitisTarihi}T00:00:00`);
  return TARIH_BICIMI.formatRange
    ? TARIH_BICIMI.formatRange(bas, son)
    : `${TARIH_BICIMI.format(bas)} – ${TARIH_BICIMI.format(son)}`;
}

// Küçük DOM yardımcısı: metin her zaman textContent ile yazılır.
function el(etiket, sinif, metinIcerik) {
  const e = document.createElement(etiket);
  if (sinif) e.className = sinif;
  if (metinIcerik !== undefined) e.textContent = metinIcerik;
  return e;
}

// Google Maps tarzı damla iğne. Renk yalnızca SOZLUK'tan gelir, veriden değil.
const pinIkonlari = new Map();
function pinIkonu(kapsam, secili) {
  const anahtar = `${kapsam}|${secili ? 1 : 0}`;
  if (!pinIkonlari.has(anahtar)) {
    const { renk, kenar = "#fff" } = SOZLUK.kapsam[kapsam];
    pinIkonlari.set(anahtar, L.divIcon({
      className: secili ? "pin pin-secili" : "pin",
      html: `<svg viewBox="0 0 30 42" width="30" height="42" aria-hidden="true">
        <path d="M15 1C7.3 1 1 7.2 1 14.9c0 10.4 12.2 24.9 13.3 26.2a.9.9 0 0 0 1.4 0C16.8 39.8 29 25.3 29 14.9 29 7.2 22.7 1 15 1z"
              fill="${renk}" stroke="${kenar}" stroke-width="2"/>
        <circle cx="15" cy="15" r="5.5" fill="#fff"/></svg>`,
      iconSize: [30, 42],
      iconAnchor: [15, 41],
      tooltipAnchor: [0, -36]
    }));
  }
  return pinIkonlari.get(anahtar);
}

// Etiketli okul rozeti: altın madalya ve iki lacivert kurdele. Parçalar
// sabittir (veriden hiçbir şey girmez); aynı tanımdan hem harita simgesinin
// SVG metni hem de lejant/kart için DOM düğümü üretilir.
const ROZET_PARCALARI = [
  ["path", { d: "M7.5 16L4.5 28.5L8 26.6L10.6 29.5L12.2 19Z", fill: "#1f3b63" }],
  ["path", { d: "M16.5 16L19.5 28.5L16 26.6L13.4 29.5L11.8 19Z", fill: "#2f5a94" }],
  ["path", {
    d: "M12.0 0.5L13.8 2.0L16.0 1.3L17.1 3.4L19.4 3.6L19.6 5.9L21.7 7.0L21.0 9.2L22.5 11.0L21.0 12.8L21.7 15.0L19.6 16.1L19.4 18.4L17.1 18.6L16.0 20.7L13.8 20.0L12.0 21.5L10.2 20.0L8.0 20.7L6.9 18.6L4.6 18.4L4.4 16.1L2.3 15.0L3.0 12.8L1.5 11.0L3.0 9.2L2.3 7.0L4.4 5.9L4.6 3.6L6.9 3.4L8.0 1.3L10.2 2.0Z",
    fill: "#F2C230", stroke: "#8a6d00", "stroke-width": "0.8", "stroke-linejoin": "round"
  }],
  ["circle", { cx: "12", cy: "11", r: "6.3", fill: "#1f3b63" }],
  ["circle", { cx: "12", cy: "11", r: "4.6", fill: "none", stroke: "#F2C230", "stroke-width": "0.9" }]
];
const ROZET_SVG = '<svg viewBox="0 0 24 30" width="24" height="30" aria-hidden="true">' +
  ROZET_PARCALARI.map(([etiket, oz]) =>
    `<${etiket} ${Object.entries(oz).map(([k, v]) => `${k}="${v}"`).join(" ")}/>`).join("") +
  "</svg>";

// Okulun etkinlikleri varsa rozet balonun sağ üst yanına kayar, yoksa
// kurdeleleri noktayı gösterecek biçimde noktanın üstünde durur.
function rozetIkonu(yanaKay) {
  return L.divIcon({
    className: "etiket-rozeti",
    html: ROZET_SVG,
    iconSize: [24, 30],
    iconAnchor: yanaKay ? [-8, 34] : [12, 30],
    tooltipAnchor: yanaKay ? [20, -34] : [0, -30]
  });
}

// Lejant ve kartlar için küçük rozet (DOM ile kurulur).
function rozetDugumu() {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 30");
  svg.setAttribute("class", "rozet-kucuk");
  svg.setAttribute("aria-hidden", "true");
  for (const [etiket, oz] of ROZET_PARCALARI) {
    const parca = document.createElementNS(ns, etiket);
    for (const [k, v] of Object.entries(oz)) parca.setAttribute(k, v);
    svg.append(parca);
  }
  return svg;
}

function pinIpucu(kayit) {
  const kutu = el("div", "ipucu");
  kutu.append(el("strong", "", kayit.etkinlikAdi), el("span", "", `${kayit.okulAdi} · ${kayit.ilce}`));
  return kutu;
}

// Lacivert sayı balonu: kümelerde ve tek başına duran etkinliklerde ("1").
function kumeIkonu(adet) {
  const boyut = adet < 10 ? 34 : adet < 50 ? 40 : 46;
  return L.divIcon({
    className: "kume",
    html: `<span>${adet}</span><span class="gorunmez"> etkinlik</span>`,
    iconSize: [boyut, boyut],
    tooltipAnchor: [0, -boyut / 2]
  });
}

function kumeIpucu(kayitlar) {
  const okullar = new Set(kayitlar.map((k) => k.okulAnahtari));
  return okullar.size === 1
    ? `${kayitlar[0].okulAdi} · ${kayitlar.length} etkinlik`
    : `${kayitlar.length} etkinlik · ${okullar.size} okul`;
}

// Her etkinlik önce sayı balonu olarak görünür; tıklanınca iğneye dönüşür,
// iğneye tıklanınca detay paneli açılır.
function isaretcileriCiz(harita, kayitlar, ilceGeolari, detay) {
  const kume = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 40,
    spiderfyDistanceMultiplier: 1.8,
    iconCreateFunction: (kumeKatmani) => kumeIkonu(kumeKatmani.getChildCount())
  });

  kume.on("clustermouseover", (olay) => {
    const alt = olay.layer.getAllChildMarkers().map((m) => m.kayit);
    olay.layer.bindTooltip(metinDugumu(kumeIpucu(alt)), { direction: "top", className: "ipucu-kutu" }).openTooltip();
  });
  kume.on("clustermouseout", (olay) => olay.layer.unbindTooltip());

  // Yelpaze gibi açılan kümenin etkinlikleri doğrudan iğne olarak görünür.
  kume.on("spiderfied", (olay) => olay.markers.forEach((m) => { m.acik = true; m.ikonuYenile(); }));
  kume.on("unspiderfied", (olay) => olay.markers.forEach((m) => { m.acik = false; m.ikonuYenile(); }));

  // Tek başına açılmış iğneler haritaya tıklanınca veya yakınlaştırınca
  // yeniden sayı balonuna döner.
  const acikTekler = new Set();
  const tekleriKapat = () => {
    for (const m of acikTekler) { m.acik = false; m.ikonuYenile(); }
    acikTekler.clear();
  };
  harita.on("zoomstart", tekleriKapat);

  const noktalar = new Map();
  for (const kayit of kayitlar) {
    if (!noktalar.has(kayit.okulAnahtari)) {
      noktalar.set(kayit.okulAnahtari, temsiliNokta(ilceGeolari.get(kayit.ilce), kayit.okulAnahtari));
    }
    const isaretci = L.marker(noktalar.get(kayit.okulAnahtari), {
      icon: kumeIkonu(1),
      riseOnHover: true,
      keyboard: true
    });
    isaretci.kayit = kayit;
    isaretci.acik = false;
    isaretci.ikonuYenile = () => {
      const secili = detay.seciliId() === kayit.id;
      const igne = secili || isaretci.acik;
      isaretci.setIcon(igne ? pinIkonu(kayit.kapsam, secili) : kumeIkonu(1));
      isaretci.setTooltipContent(igne ? pinIpucu(kayit) : metinDugumu(kumeIpucu([kayit])));
      etiketle();
    };
    // Ekran okuyucular için işaretçinin ne olduğu (setIcon öğeyi yeniler).
    const etiketle = () => {
      const oge = isaretci.getElement();
      if (!oge) return;
      oge.setAttribute("role", "button");
      oge.setAttribute("aria-label", isaretci.acik || detay.seciliId() === kayit.id
        ? `${kayit.etkinlikAdi}, ${kayit.okulAdi}, ${kayit.ilce}. Ayrıntılar için Enter`
        : `${kumeIpucu([kayit])}. Açmak için Enter`);
    };
    isaretci.on("add", etiketle);
    isaretci.bindTooltip(metinDugumu(kumeIpucu([kayit])), { direction: "top", className: "ipucu-kutu" });
    isaretci.on("click", () => {
      if (!isaretci.acik && detay.seciliId() !== kayit.id) {
        isaretci.acik = true;
        acikTekler.add(isaretci);
        isaretci.ikonuYenile();
      } else {
        detay.ac(kayit);
      }
    });
    detay.isaretciler.set(kayit.id, isaretci);
    kume.addLayer(isaretci);
  }
  harita.addLayer(kume);
  return { tekleriKapat };
}

// Etiketli okullar ayrı katmanda çizilir; kümelere katılmaz ki "n etkinlik"
// sayıları bozulmasın.
function rozetleriCiz(harita, etiketler, kayitlar, ilceGeolari, detay) {
  const etkinlikliOkullar = new Set(kayitlar.map((k) => k.okulAnahtari));
  const katman = L.layerGroup();
  for (const etiket of etiketler) {
    const nokta = temsiliNokta(ilceGeolari.get(etiket.ilce), etiket.okulAnahtari);
    const isaretci = L.marker(nokta, {
      icon: rozetIkonu(etkinlikliOkullar.has(etiket.okulAnahtari)),
      keyboard: true,
      riseOnHover: true,
      zIndexOffset: 1000
    });
    const ipucu = el("div", "ipucu");
    ipucu.append(el("strong", "", etiket.okulAdi), el("span", "", etiketMetni(etiket)));
    isaretci.bindTooltip(ipucu, { direction: "top", className: "ipucu-kutu" });
    isaretci.on("add", () => {
      const oge = isaretci.getElement();
      oge.setAttribute("role", "button");
      oge.setAttribute("aria-label", `${etiket.okulAdi}, ${etiket.ilce}, ${etiketMetni(etiket)}. Ayrıntılar için Enter`);
    });
    isaretci.on("click", () => detay.etiketAc(etiket, isaretci));
    katman.addLayer(isaretci);
  }
  katman.addTo(harita);
}

// ---------------------------------------------------------------------------
// Detay paneli: masaüstünde sağdan, telefonda alttan açılır.

function detayPaneliKur(harita, tumKayitlar, etiketler) {
  const panel = document.getElementById("detay");
  const icerik = document.getElementById("detay-icerik");
  const kapatDugmesi = document.getElementById("detay-kapat");
  const genisEkran = window.matchMedia("(min-width: 768px)");
  const isaretciler = new Map();
  const okulEtiketi = new Map(etiketler.map((e) => [e.okulAnahtari, e]));
  let secili = null;

  function isaretciVurgula(kayit) {
    const onceki = secili;
    secili = kayit;
    if (onceki) isaretciler.get(onceki.id)?.ikonuYenile();
    if (kayit) isaretciler.get(kayit.id)?.ikonuYenile();
  }

  function bilgiSatiri(liste, baslik, deger) {
    const satir = el("div", "bilgi");
    satir.append(el("dt", "", baslik), el("dd", "", deger));
    liste.append(satir);
  }

  function doldur(kayit) {
    icerik.replaceChildren();
    const program = SOZLUK.kapsam[kayit.kapsam];

    const rozet = el("span", "rozet");
    const renk = el("span", "rozet-renk");
    renk.style.backgroundColor = program.renk;
    rozet.append(renk, document.createTextNode(program.etiket));

    const baslik = el("h2", "detay-baslik", kayit.etkinlikAdi);
    baslik.id = "detay-baslik";
    const okul = el("p", "detay-okul", `${kayit.okulAdi} · ${kayit.ilce}`);
    const etiket = okulEtiketi.get(kayit.okulAnahtari);
    if (etiket) {
      okul.classList.add("etiketli");
      const satir = el("span", "detay-etiket");
      satir.append(rozetDugumu(), document.createTextNode(etiketMetni(etiket)));
      okul.append(satir);
    }

    const bilgiler = el("dl", "bilgiler");
    bilgiSatiri(bilgiler, "Tarih", tarihYaz(kayit));
    bilgiSatiri(bilgiler, kayit.icerik.length > 1 ? "Etkinlik türleri" : "Etkinlik türü",
      kayit.icerik.map((kod) => SOZLUK.icerik[kod]).join(", "));
    bilgiSatiri(bilgiler, "Sınıf düzeyi", kayit.sinifDuzeyi ? SOZLUK.sinifDuzeyi[kayit.sinifDuzeyi] : "—");
    if (kayit.ogretmenAdi) bilgiSatiri(bilgiler, "Öğretmen", kayit.ogretmenAdi);

    const ogrenci = el("div", "ogrenci");
    const sayi = el("p", "ogrenci-toplam");
    sayi.append(el("strong", "", String(kayit.toplamOgrenci)), document.createTextNode(" öğrenci katıldı"));
    ogrenci.append(sayi);
    if (kayit.toplamOgrenci > 0) {
      const cubuk = el("div", "ogrenci-cubuk");
      const kiz = el("span", "cubuk-kiz");
      kiz.style.width = `${(kayit.kizSayisi / kayit.toplamOgrenci) * 100}%`;
      cubuk.append(kiz, el("span", "cubuk-erkek"));
      cubuk.setAttribute("aria-hidden", "true");
      ogrenci.append(cubuk);
    }
    const dagilim = el("p", "ogrenci-dagilim");
    dagilim.append(el("span", "nokta-kiz"), document.createTextNode(` ${kayit.kizSayisi} kız   `),
                   el("span", "nokta-erkek"), document.createTextNode(` ${kayit.erkekSayisi} erkek`));
    ogrenci.append(dagilim);

    icerik.append(rozet, baslik, okul, bilgiler, ogrenci);

    if (kayit.aciklama) {
      icerik.append(el("h3", "", "Açıklama"), el("p", "detay-aciklama", kayit.aciklama));
    }

    const digerleri = okulunEtkinlikleri(kayit.okulAnahtari).filter((k) => k.id !== kayit.id);
    if (digerleri.length) {
      icerik.append(el("h3", "", "Bu okulun diğer etkinlikleri"), etkinlikListesi(digerleri));
    }
  }

  function okulunEtkinlikleri(anahtar) {
    return tumKayitlar
      .filter((k) => k.okulAnahtari === anahtar)
      .sort((a, b) => a.tarih.localeCompare(b.tarih));
  }

  function etkinlikListesi(kayitlar) {
    const liste = el("ul", "diger-liste");
    for (const k of kayitlar) {
      const dugme = el("button", "diger-dugme");
      dugme.type = "button";
      const renkNoktasi = el("span", "rozet-renk");
      renkNoktasi.style.backgroundColor = SOZLUK.kapsam[k.kapsam].renk;
      dugme.append(renkNoktasi, el("span", "diger-ad", k.etkinlikAdi), el("span", "diger-tarih", tarihYaz(k)));
      dugme.addEventListener("click", () => ac(k));
      const oge = el("li");
      oge.append(dugme);
      liste.append(oge);
    }
    return liste;
  }

  // Etiketli okul kartı: etiket, okul, ilçe ve okulun haritadaki etkinlikleri.
  function etiketDoldur(etiket) {
    icerik.replaceChildren();
    const rozet = el("span", "rozet");
    rozet.append(rozetDugumu(), document.createTextNode(ETIKET_ADI));
    const baslik = el("h2", "detay-baslik", etiket.okulAdi);
    baslik.id = "detay-baslik";
    const bilgiler = el("dl", "bilgiler");
    bilgiSatiri(bilgiler, "İlçe", etiket.ilce);
    if (etiket.tur) bilgiSatiri(bilgiler, "Tür", SOZLUK.etiketTuru[etiket.tur]);
    if (etiket.yil) bilgiSatiri(bilgiler, "Yıl", etiket.yil);
    icerik.append(rozet, baslik, bilgiler);

    const etkinlikler = okulunEtkinlikleri(etiket.okulAnahtari);
    if (etkinlikler.length) icerik.append(el("h3", "", "Bu okulun etkinlikleri"), etkinlikListesi(etkinlikler));
    else icerik.append(el("p", "detay-not", "Bu okulun haritada henüz etkinliği yok."));
  }

  function ac(kayit) {
    doldur(kayit);
    isaretciVurgula(kayit);
    paneliAc(isaretciler.get(kayit.id));
  }

  function etiketAc(etiket, isaretci) {
    etiketDoldur(etiket);
    isaretciVurgula(null);
    paneliAc(isaretci);
  }

  function paneliAc(isaretci) {
    panel.setAttribute("aria-labelledby", "detay-baslik");
    panel.classList.add("acik");
    panel.setAttribute("aria-hidden", "false");
    panel.scrollTop = 0;
    kapatDugmesi.focus({ preventScroll: true });

    // İşaretçi panelin altında kalmasın. Panel açıkken kaydırma sınırı
    // kaldırılır; yoksa il kenarındaki işaretçi panelin arkasında kalır.
    isaretci?.closeTooltip();
    if (isaretci && harita.hasLayer(isaretci)) {
      harita.setMaxBounds(null);
      const bosluk = genisEkran.matches
        ? { paddingTopLeft: [40, 60], paddingBottomRight: [panel.offsetWidth + 40, 40] }
        : { paddingTopLeft: [30, 60], paddingBottomRight: [30, panel.offsetHeight + 30] };
      harita.panInside(isaretci.getLatLng(), bosluk);
    }
  }

  function kapat() {
    if (!panel.classList.contains("acik")) return;
    panel.classList.remove("acik");
    panel.setAttribute("aria-hidden", "true");
    isaretciVurgula(null);
    harita.setMaxBounds(harita.ilSiniri);
  }

  kapatDugmesi.addEventListener("click", kapat);
  document.addEventListener("keydown", (olay) => { if (olay.key === "Escape") kapat(); });

  return {
    ac,
    etiketAc,
    kapat,
    isaretciler,
    seciliId: () => secili?.id,
    acikMi: () => panel.classList.contains("acik")
  };
}

// ---------------------------------------------------------------------------
// Lejant: programların (kapsamın) renkleri.

function lejantEkle(harita) {
  const lejant = L.control({ position: "topright" });
  lejant.onAdd = () => {
    const kutu = el("details", "lejant");
    if (window.matchMedia("(min-width: 768px)").matches) kutu.open = true;
    kutu.append(el("summary", "", "Programlar"));
    const liste = el("ul");
    for (const program of Object.values(SOZLUK.kapsam)) {
      const oge = el("li");
      const renk = el("span", "rozet-renk");
      renk.style.backgroundColor = program.renk;
      oge.append(renk, document.createTextNode(program.etiket));
      liste.append(oge);
    }
    kutu.append(liste);
    L.DomEvent.disableClickPropagation(kutu);
    L.DomEvent.disableScrollPropagation(kutu);
    return kutu;
  };
  lejant.addTo(harita);

  // Etiketli okul varsa veri yüklendikten sonra eklenir.
  return {
    etiketSatiriEkle() {
      const oge = el("li", "lejant-ayrac");
      oge.append(rozetDugumu(), document.createTextNode(ETIKET_ADI));
      lejant.getContainer().querySelector("ul").append(oge);
    }
  };
}

// ---------------------------------------------------------------------------
// "Etkinliğini ekle": Google Form site içinde bir panelde açılır. Form
// yalnızca düğmeye basıldığında yüklenir; haritaya bakan ziyaretçi Google'a
// bağlanmaz.

function formDugmesiniKur() {
  const panel = document.getElementById("form-paneli");
  const acDugmesi = document.getElementById("ekle-panel");
  const kapatDugmesi = document.getElementById("form-kapat");
  let cerceve = null;

  const kapat = () => {
    panel.classList.remove("acik");
    panel.setAttribute("aria-hidden", "true");
    acDugmesi.setAttribute("aria-expanded", "false");
    acDugmesi.focus({ preventScroll: true });
  };
  acDugmesi.addEventListener("click", () => {
    if (!cerceve) {
      cerceve = document.createElement("iframe");
      cerceve.className = "form-cercevesi";
      cerceve.title = "Etkinlik kayıt formu";
      cerceve.src = `${AYARLAR.formUrl}?embedded=true`;
      cerceve.addEventListener("load", () => { document.getElementById("form-yukleniyor").hidden = true; });
      panel.append(cerceve);
    }
    panel.classList.add("acik");
    panel.setAttribute("aria-hidden", "false");
    acDugmesi.setAttribute("aria-expanded", "true");
    kapatDugmesi.focus({ preventScroll: true });
  });
  kapatDugmesi.addEventListener("click", kapat);
  document.addEventListener("keydown", (olay) => {
    if (olay.key === "Escape" && panel.classList.contains("acik")) kapat();
  });
}

async function baslat() {
  sayfaBasliklariniKur();
  gizlilikKur();
  formDugmesiniKur();
  const harita = haritaKur();
  durumGoster("Harita yükleniyor…");

  // İlçe tıklaması, işaretçiler hazır olunca bağlanır.
  let ilceTiklandi = () => {};
  let ilceler;
  try {
    ilceler = await ilceleriYukle(harita, (ad) => ilceTiklandi(ad));
  } catch (hata) {
    console.error(hata);
    durumGoster("İlçe sınırları şu an yüklenemedi. Lütfen sayfayı daha sonra yenileyin.", true);
    return;
  }
  const ilceGeolari = new Map(ilceler.geojson.features.map((f) => [f.properties.ad, ilceGeometrisiHazirla(f)]));
  const lejant = lejantEkle(harita);

  durumGoster("Etkinlikler yükleniyor…");
  try {
    const veri = await veriyiYukle();
    const ilceAdlari = new Set(ilceGeolari.keys());
    const kayitlar = kayitlariDogrula(veri.etkinlikler, ilceAdlari);
    const etiketler = etiketleriDogrula(veri.etiketliOkullar, ilceAdlari);
    const detay = detayPaneliKur(harita, kayitlar, etiketler);
    const isaretler = isaretcileriCiz(harita, kayitlar, ilceGeolari, detay);
    rozetleriCiz(harita, etiketler, kayitlar, ilceGeolari, detay);
    if (etiketler.length) lejant.etiketSatiriEkle();

    // İlçeye tıklamak yalnızca ilçeyi vurgular ve yakınlaştırır (özet
    // değişmez); aynı ilçeye tekrar tıklamak seçimi kaldırır. Detay kartı
    // açıksa ilk tıklama yalnızca kartı kapatır.
    let seciliIlce = "";
    const ilceSec = (ad) => {
      seciliIlce = ad;
      ilceler.ilceVurgula(ad);
    };
    ilceTiklandi = (ad) => {
      isaretler.tekleriKapat();
      if (detay.acikMi()) { detay.kapat(); return; }
      ilceSec(seciliIlce === ad ? "" : ad);
    };
    // İl dışındaki boşluğa tıklamak: önce kartı kapatır, sonra seçimi kaldırır.
    harita.on("click", () => {
      isaretler.tekleriKapat();
      if (detay.acikMi()) { detay.kapat(); return; }
      if (seciliIlce) ilceSec("");
    });
    if (YEREL_MI) durumGoster(`Yerel test: uydurma veri gösteriliyor (${kayitlar.length} etkinlik).`);
    else durumGizle();
  } catch (hata) {
    console.error(hata);
    durumGoster("Etkinlik verileri şu an yüklenemedi. Lütfen sayfayı daha sonra yenileyin.", true);
  }
}

document.addEventListener("DOMContentLoaded", baslat);
