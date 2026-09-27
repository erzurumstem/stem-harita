'use strict';

// İle ve yıla özgü tüm değerler yalnızca burada durur.
const AYARLAR = {
  il: "Erzurum",
  iletisim: "erzurumstem@gmail.com",
  donem: "2026-2027",
  baslangic: "2026-09-01",
  bitis: "2027-08-31",
  veriUrl: null, // 6. aşamada Apps Script adresi yazılacak
  testVeriUrl: "data/ornek-etkinlikler.json"
};

// Bilgisayarda (localhost) açılınca uydurma test verisi yüklenir;
// canlı sitede test verisi asla gösterilmez.
const YEREL_MI = ["localhost", "127.0.0.1"].includes(location.hostname);

// Veride yalnızca kod bulunur, ekranda yalnızca etiket gösterilir.
const SOZLUK = {
  kapsam: {
    bagimsiz: "Okul içi / bağımsız",
    tubitak: "TÜBİTAK",
    etwinning: "eTwinning",
    teknofest: "Teknofest",
    codeweek: "EU Code Week",
    erasmus: "Erasmus+",
    diger: "Diğer program"
  },
  icerik: {
    kodlama: { etiket: "Kodlama ve Algoritma", renk: "#0072B2" },
    robotik: { etiket: "Robotik ve Elektronik", renk: "#D55E00" },
    tasarim: { etiket: "Tasarım ve Üretim", renk: "#E69F00" },
    fen: { etiket: "Fen Deneyi ve Gözlem", renk: "#009E73" },
    yapayzeka: { etiket: "Yapay Zekâ ve Veri", renk: "#CC79A7" },
    unplugged: { etiket: "Bilgisayarsız Etkinlik", renk: "#56B4E9" },
    diger: { etiket: "Diğer", renk: "#7F7F7F" }
  },
  sinifDuzeyi: {
    okuloncesi: "Okul Öncesi",
    "1-4": "İlkokul (1-4)",
    "5-8": "Ortaokul (5-8)",
    "9-12": "Lise (9-12)",
    karma: "Karma"
  }
};

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

function kayitlariDogrula(hamKayitlar, ilceAdlari, bilinenOkullar) {
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

    const ilce = metin(ham.ilce);
    if (!ilceAdlari.has(ilce)) {
      uyar(`ilçe "${ilce}" ilçe listesinde yok, atlandı.`);
      continue;
    }

    const okulAdi = metin(ham.okulAdi);
    const anahtar = okulAnahtari(okulAdi, ilce);
    if (!bilinenOkullar.has(anahtar)) uyar(`"${okulAdi}" (${ilce}) okul listesinde yok; yine de gösteriliyor.`);

    let kapsam = metin(ham.kapsam);
    if (!(kapsam in SOZLUK.kapsam)) { uyar(`tanımsız kapsam "${kapsam}", Diğer sayıldı.`); kapsam = "diger"; }

    let icerik = metin(ham.icerik);
    if (!(icerik in SOZLUK.icerik)) { uyar(`tanımsız içerik "${icerik}", Diğer sayıldı.`); icerik = "diger"; }

    let sinifDuzeyi = metin(ham.sinifDuzeyi);
    if (!(sinifDuzeyi in SOZLUK.sinifDuzeyi)) { uyar(`tanımsız sınıf düzeyi "${sinifDuzeyi}", "—" gösterilecek.`); sinifDuzeyi = null; }

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
      kizSayisi,
      erkekSayisi,
      toplamOgrenci: kizSayisi + erkekSayisi,
      aciklama: aciklamaKirp(ham.aciklama),
      ogretmenAdi: metin(ham.ogretmenAdi)
    });
  }
  return sonuc;
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

  const iletisim = document.getElementById("iletisim");
  iletisim.textContent = AYARLAR.iletisim;
  iletisim.href = `mailto:${AYARLAR.iletisim}`;
}

// Altlık harita YOKTUR: yalnızca ilçeler çizilir. Böylece dışarıya istek
// gitmez ve işaretçilerin temsilî konumu köy/yol gibi yanlış okunmaz.
function haritaKur() {
  return L.map("harita", { zoomSnap: 0.25, maxZoom: 13 });
}

async function ilceleriYukle(harita) {
  const yanit = await fetch("data/ilceler.geojson");
  if (!yanit.ok) throw new Error(`ilceler.geojson: HTTP ${yanit.status}`);
  const geojson = await yanit.json();

  let seciliIlce = null;
  const ilceStiliniYenile = (ilce) => {
    katman.resetStyle(ilce);
    if (ilce === seciliIlce) ilce.setStyle(ILCE_SECILI_STILI);
  };
  const ilceSec = (ilce) => {
    const onceki = seciliIlce;
    seciliIlce = ilce;
    if (onceki) ilceStiliniYenile(onceki);
    if (ilce) {
      ilce.setStyle(ILCE_SECILI_STILI);
      ilce.bringToFront();
    }
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
        interactive: false
      });
      ilce.on("mouseover", () => {
        if (ilce !== seciliIlce) ilce.setStyle(ILCE_VURGU_STILI);
      });
      ilce.on("mouseout", () => ilceStiliniYenile(ilce));
      ilce.on("click", (olay) => {
        L.DomEvent.stopPropagation(olay);
        ilceSec(ilce === seciliIlce ? null : ilce);
      });
    }
  }).addTo(harita);

  // Harita boşluğuna tıklanınca seçim kalkar.
  harita.on("click", () => ilceSec(null));

  const sinirlar = katman.getBounds();
  harita.fitBounds(sinirlar, { padding: [12, 12] });
  // Altlık olmadığı için il dışına kaydırma ve fazla uzaklaşma sınırlanır.
  harita.setMinZoom(harita.getZoom() - 1);
  harita.setMaxBounds(sinirlar.pad(0.3));
  return geojson;
}

async function jsonGetir(adres) {
  const yanit = await fetch(adres);
  if (!yanit.ok) throw new Error(`${adres}: HTTP ${yanit.status}`);
  return yanit.json();
}

async function etkinlikleriYukle() {
  const adres = YEREL_MI ? AYARLAR.testVeriUrl : AYARLAR.veriUrl;
  if (!adres) return [];
  return jsonGetir(adres);
}

// 3. aşama için geçici gösterim: her okul tek bir gri nokta.
function okulNoktalariniCiz(harita, kayitlar, ilceGeolari) {
  const okullar = new Map();
  for (const k of kayitlar) {
    if (!okullar.has(k.okulAnahtari)) okullar.set(k.okulAnahtari, { ...k, adet: 0 });
    okullar.get(k.okulAnahtari).adet++;
  }
  for (const [anahtar, okul] of okullar) {
    const nokta = temsiliNokta(ilceGeolari.get(okul.ilce), anahtar);
    L.circleMarker(nokta, { radius: 6, color: "#333", weight: 1, fillColor: "#777", fillOpacity: 0.9 })
      .bindTooltip(metinDugumu(`${okul.okulAdi} · ${okul.adet} etkinlik`))
      .addTo(harita);
  }
}

async function baslat() {
  sayfaBasliklariniKur();
  const harita = haritaKur();
  durumGoster("Harita yükleniyor…");

  let ilceler;
  try {
    ilceler = await ilceleriYukle(harita);
  } catch (hata) {
    console.error(hata);
    durumGoster("İlçe sınırları şu an yüklenemedi. Lütfen sayfayı daha sonra yenileyin.", true);
    return;
  }
  const ilceGeolari = new Map(ilceler.features.map((f) => [f.properties.ad, ilceGeometrisiHazirla(f)]));

  durumGoster("Etkinlikler yükleniyor…");
  try {
    const [okulListesi, hamKayitlar] = await Promise.all([jsonGetir("data/okullar.json"), etkinlikleriYukle()]);
    const bilinenOkullar = new Set(okulListesi.map((o) => okulAnahtari(metin(o.okulAdi), metin(o.ilce))));
    const kayitlar = kayitlariDogrula(hamKayitlar, new Set(ilceGeolari.keys()), bilinenOkullar);
    okulNoktalariniCiz(harita, kayitlar, ilceGeolari);
    if (YEREL_MI) durumGoster(`Yerel test: uydurma veri gösteriliyor (${kayitlar.length} etkinlik).`);
    else durumGizle();
  } catch (hata) {
    console.error(hata);
    durumGoster("Etkinlik verileri şu an yüklenemedi. Lütfen sayfayı daha sonra yenileyin.", true);
  }
}

document.addEventListener("DOMContentLoaded", baslat);
