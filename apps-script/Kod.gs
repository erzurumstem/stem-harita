// STEM Etkinlik Haritası — Google Sheets tarafı.
//
// Bu betik Sheets dosyasına Uzantılar → Apps Script ile eklenir. İle özgü
// değerler Ayarlar.gs dosyasındadır (AYARLAR nesnesi).
//
// Görevleri:
//   kurulum()        Bir kez çalıştırılır: formu oluşturur, Sheets'e bağlar,
//                    Onay sütununu ve Özet sayfasını ekler, tetikleyicileri kurar.
//   formuGuncelle()  Eski yapıdaki formu yerinde yeni yapıya getirir (form
//                    adresi ve mevcut yanıtlar korunur).
//   doGet()          Web uygulaması: siteye YALNIZCA onaylı kayıtların izin
//                    verilen alanlarını ve "Etiketler" sayfasındaki STEM School
//                    Label okullarını JSON olarak verir.
//   ozetiYenile()    Yalnızca yöneticinin gördüğü Özet sayfasını hesaplar.
//
// KVKK: Tam ad, şube, zaman damgası ve onaysız kayıtlar doGet çıktısına
// ASLA girmez. Öğretmen adı burada kısaltılır.

// ---------------------------------------------------------------------------
// Sabitler. Soru başlıkları Sheets sütun başlıklarıyla eşleştirmede
// kullanılır; formda başlık değiştirilirse burası da değiştirilmelidir.

const SORU = {
  ilce: "İlçe",
  okul: "Okul adı",
  ad: "Adınız ve soyadınız",
  etkinlik: "Etkinlik adı",
  kapsam: "Etkinlik hangi program kapsamında yapıldı?",
  icerik: "Etkinlikte neler yapıldı?",
  sinif: "Sınıf",
  sube: "Şubeler",
  sube1112: "Şubeler (11. ve 12. sınıf)",
  tarih: "Başlangıç tarihi",
  bitis: "Bitiş tarihi",
  kiz: "Katılan kız öğrenci sayısı",
  erkek: "Katılan erkek öğrenci sayısı",
  aciklama: "Kısa açıklama",
  aydinlatma: "Aydınlatma metni",
  riza: "Açık rıza"
};
// Tek seçimli eski soruların başlıkları. Eski yanıtlar bu sütunlarda kalır;
// yeni sütun boşsa buradan okunur. (Aynı başlık kullanılsaydı Sheets'te iki
// sütun aynı adı taşırdı.)
const SORU_ESKI = {
  icerik: "Etkinlikte ne yapıldı?",
  tarih: "Etkinlik tarihi",
  sube: "Şube",
  sube1112: "Şube (11. ve 12. sınıf)"
};
// STEM School Label okulları: yönetici "Etiketler" sayfasına elle girer.
const ETIKET_SAYFASI = "Etiketler";
const ETIKET_BASLIKLARI = ["İlçe", "Okul adı", "Tür", "Yıl"];
const ONAY_SUTUNU = "Onay";
const YANIT_SAYFASI = "Yanıtlar";
const OZET_SAYFASI = "Özet";
const ONBELLEK_ANAHTARI = "yayin-verisi";
const ONBELLEK_SURESI = 300; // saniye

// Site ile AYNI kodlar (js/harita.js → SOZLUK).
const KAPSAM = {
  bagimsiz: "Okul içi / bağımsız",
  tubitak: "TÜBİTAK",
  etwinning: "eTwinning",
  teknofest: "Teknofest",
  codeweek: "EU Code Week",
  erasmus: "Erasmus+",
  harezmi: "Harezmi Eğitim Modeli",
  diger: "Diğer program"
};
const ICERIK = {
  kodlama: "Kodlama ve Algoritma",
  robotik: "Robotik ve Elektronik",
  tasarim: "Tasarım ve Üretim",
  fen: "Fen Deneyi ve Gözlem",
  yapayzeka: "Yapay Zekâ ve Veri",
  unplugged: "Bilgisayarsız Etkinlik",
  diger: "Diğer STEM etkinlikleri"
};
const ETIKET_TURU = {
  competent: "Competent",
  proficient: "Proficient",
  expert: "Expert"
};
const SINIF_DUZEYI = {
  okuloncesi: "Okul Öncesi",
  "1-4": "İlkokul (1-4)",
  "5-8": "Ortaokul (5-8)",
  "9-12": "Lise (9-12)",
  karma: "Karma"
};
const OKUL_ONCESI = "Okul öncesi";
const ESKI_OKUL_ONCESI = "Anasınıfı";   // eski yanıtlarda bu yazar
const SINIFLAR = [OKUL_ONCESI]
  .concat(Array.from({ length: 12 }, (_, i) => `${i + 1}. sınıf`))
  .concat(["Kulüp / karma grup"]);
const KULUP = "Kulüp / karma grup";
const HARFLER = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "İ", "J", "K", "L",
  "M", "N", "O", "P", "R", "S", "T", "U", "V", "Y", "Z"];
const SUBELER = HARFLER;
// 11. ve 12. sınıflarda alan ayrımı: "Sayısal A", "Eşit Ağırlık B" … Alan
// ayrımı olmayan okullar için yalnızca harf seçenekleri de başta bulunur.
const ALANLAR = ["Sayısal", "Eşit Ağırlık", "Sözel", "Dil"];
const SUBELER_1112 = HARFLER.slice(0, 8)
  .concat(...ALANLAR.map((alan) => HARFLER.slice(0, 6).map((h) => `${alan} ${h}`)));

// ---------------------------------------------------------------------------
// Metin yardımcıları. Türkçe harf dönüşümü elle yapılır; Apps Script'in yerel
// ayar desteğine güvenilmez.

function temizle(deger) {
  return deger === undefined || deger === null ? "" : String(deger).replace(/\s+/g, " ").trim();
}

function trKucuk(metin) {
  return metin.replace(/I/g, "ı").replace(/İ/g, "i").toLowerCase();
}

function trBuyuk(metin) {
  return metin.replace(/i/g, "İ").replace(/ı/g, "I").toUpperCase();
}

// "aYŞE-nur" → "Ayşe-Nur"
function basHarfBuyuk(kelime) {
  return kelime.split("-").map((p) => (p ? trBuyuk(p[0]) + trKucuk(p.slice(1)) : p)).join("-");
}

// "ali veli" → "Ali V.", "AYŞE NUR YILMAZ" → "Ayşe Nur Y."
function adiKisalt(adSoyad) {
  const kelimeler = temizle(adSoyad).split(" ").filter(Boolean);
  if (!kelimeler.length) return "";
  if (kelimeler.length === 1) return basHarfBuyuk(kelimeler[0]);
  const soyad = kelimeler[kelimeler.length - 1];
  return kelimeler.slice(0, -1).map(basHarfBuyuk).join(" ") + " " + trBuyuk(soyad[0]) + ".";
}

// Karşılaştırma anahtarı: büyük/küçük harf, Türkçe harf, nokta ve boşluk
// farklarını yok sayar. "ATATÜRK  İlkokulu." = "ataturk ilkokulu"
const SADE = { ı: "i", ş: "s", ğ: "g", ü: "u", ö: "o", ç: "c", â: "a", î: "i", û: "u" };
function sadelestir(metin) {
  return trKucuk(temizle(metin))
    .replace(/[ışğüöçâîû]/g, (h) => SADE[h])
    .replace(/\./g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function degerler(sozluk) {
  return Object.keys(sozluk).map((kod) => sozluk[kod]);
}

// Çok seçimli (işaret kutusu) cevap Sheets'te "A, B" biçiminde durur.
// Seçenek etiketlerinde virgül bulunmaz.
function coklu(deger) {
  return temizle(deger).split(/\s*,\s*/).filter(Boolean);
}

// Yeni sütun boşsa eski (tek seçimli) sorunun sütunundan okur.
function cevap(satir, alan) {
  return temizle(satir[SORU[alan]]) || (SORU_ESKI[alan] ? temizle(satir[SORU_ESKI[alan]]) : "");
}

// cevap() gibi, ama değeri olduğu gibi (ör. tarih nesnesi) döndürür.
function hamCevap(satir, alan) {
  const deger = satir[SORU[alan]];
  if (deger !== undefined && deger !== null && deger !== "") return deger;
  return SORU_ESKI[alan] ? satir[SORU_ESKI[alan]] : "";
}

function tersSozluk(sozluk) {
  const ters = {};
  Object.keys(sozluk).forEach((kod) => { ters[sozluk[kod]] = kod; });
  return ters;
}

// "Okul öncesi" → okuloncesi, "3. sınıf" → 1-4, "Kulüp / karma grup" → karma
function sinifDuzeyiBul(sinif) {
  if (sinif === OKUL_ONCESI) return "okuloncesi";
  if (sinif === KULUP) return "karma";
  const no = parseInt(sinif, 10);
  if (no >= 1 && no <= 4) return "1-4";
  if (no >= 5 && no <= 8) return "5-8";
  if (no >= 9 && no <= 12) return "9-12";
  return "";
}

function tarihMi(deger) {
  return Object.prototype.toString.call(deger) === "[object Date]" && !isNaN(deger.getTime());
}

function sayiyaCevir(deger) {
  const n = Number(temizle(deger));
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

// ---------------------------------------------------------------------------
// Yanıt satırlarını okuma

function yanitSayfasi() {
  const sayfa = SpreadsheetApp.getActive().getSheetByName(YANIT_SAYFASI);
  if (!sayfa) throw new Error(`"${YANIT_SAYFASI}" sayfası bulunamadı. Önce kurulum() çalıştırılmalı.`);
  return sayfa;
}

// Her satırı { baslik: deger } nesnesine çevirir; ilk sütun zaman damgasıdır.
function satirlariOku() {
  const sayfa = yanitSayfasi();
  const veri = sayfa.getDataRange().getValues();
  if (veri.length < 2) return [];
  const basliklar = veri[0].map(temizle);
  return veri.slice(1)
    .map((satir, i) => ({ satir, satirNo: i + 2 }))
    .filter(({ satir }) => tarihMi(satir[0]))
    .map(({ satir, satirNo }) => {
      const nesne = { zaman: satir[0], satirNo };
      basliklar.forEach((b, i) => { if (i > 0) nesne[b] = satir[i]; });
      return nesne;
    });
}

// Bir yanıt satırından iç kullanım kaydı üretir (tam ad dahil; DIŞARI VERİLMEZ).
function kayitOlustur(satir, saatDilimi) {
  const kapsamKodu = tersSozluk(KAPSAM)[temizle(satir[SORU.kapsam])] || "diger";
  // Birden çok içerik seçilebilir; tanınmayan etiket (ör. eski "Diğer") → diger.
  const icerikEtiketten = tersSozluk(ICERIK);
  const secilenIcerik = coklu(cevap(satir, "icerik")).map((e) => icerikEtiketten[e] || "diger");
  const icerikKodlari = Object.keys(ICERIK).filter((kod) => secilenIcerik.includes(kod));
  if (!icerikKodlari.length) icerikKodlari.push("diger");
  const sinifHam = temizle(satir[SORU.sinif]);
  const sinif = sinifHam === ESKI_OKUL_ONCESI ? OKUL_ONCESI : sinifHam;
  const subeler = coklu(cevap(satir, "sube") || cevap(satir, "sube1112"));
  const kizSayisi = sayiyaCevir(satir[SORU.kiz]);
  const erkekSayisi = sayiyaCevir(satir[SORU.erkek]);
  const okulAdi = temizle(satir[SORU.okul]);
  const ilce = temizle(satir[SORU.ilce]);
  const tamAd = temizle(satir[SORU.ad]);
  const tarihYaz = (ham) => (tarihMi(ham) ? Utilities.formatDate(ham, saatDilimi, "yyyy-MM-dd") : temizle(ham));
  const tarih = tarihYaz(hamCevap(satir, "tarih"));
  const bitisTarihi = tarihYaz(hamCevap(satir, "bitis"));   // isteğe bağlı

  const okulAnahtari = `${sadelestir(okulAdi)}|${ilce}`;
  const ogretmenAnahtari = `${okulAnahtari}|${sadelestir(tamAd)}`;
  // Öğrenci grubu = okul + sınıf + şube. Birden çok şubeli kayıtta sayılar
  // şubelere EŞİT paylaştırılır (şube başına sayı sorulmadığı için yaklaşık).
  const kulupMu = sinif === KULUP;
  const gruplar = kulupMu
    ? [{ anahtar: `${okulAnahtari}|kulüp|${sadelestir(tamAd)}`, kiz: kizSayisi, erkek: erkekSayisi }]
    : (subeler.length ? subeler : [""]).map((sube, _, liste) => ({
        anahtar: `${okulAnahtari}|${sinif}|${sube}`,
        kiz: kizSayisi / liste.length,
        erkek: erkekSayisi / liste.length
      }));

  return {
    id: `${AYARLAR.idOnEki}-${satir.zaman.getTime()}`,
    onay: satir[ONAY_SUTUNU] === true,
    okulAdi,
    ilce,
    etkinlikAdi: temizle(satir[SORU.etkinlik]),
    kapsam: kapsamKodu,
    icerik: icerikKodlari,
    sinifDuzeyi: sinifDuzeyiBul(sinif),
    tarih,
    bitisTarihi,
    kizSayisi,
    erkekSayisi,
    aciklama: temizle(satir[SORU.aciklama]),
    ogretmenAdi: adiKisalt(tamAd),
    // Yalnızca Özet sayfası için:
    satirNo: satir.satirNo,
    okulAnahtari,
    ogretmenAnahtari,
    gruplar
  };
}

function kayitlariOku() {
  const saatDilimi = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
  return satirlariOku().map((s) => kayitOlustur(s, saatDilimi));
}

// ---------------------------------------------------------------------------
// Siteye verilen veri (BEYAZ LİSTE)

function yayinKaydi(k) {
  return {
    id: k.id,
    okulAdi: k.okulAdi,
    ilce: k.ilce,
    etkinlikAdi: k.etkinlikAdi,
    kapsam: k.kapsam,
    icerik: k.icerik,
    sinifDuzeyi: k.sinifDuzeyi,
    tarih: k.tarih,
    // Tek günlük etkinlikte alan hiç yazılmaz (JSON.stringify undefined'ı atlar).
    bitisTarihi: k.bitisTarihi && k.bitisTarihi !== k.tarih ? k.bitisTarihi : undefined,
    kizSayisi: k.kizSayisi,
    erkekSayisi: k.erkekSayisi,
    aciklama: k.aciklama,
    ogretmenAdi: k.ogretmenAdi,
    onay: true
  };
}

// Etiketler sayfasının satırları. Okul adı onaylı etkinliklerde (küçük yazım
// farklarıyla) geçiyorsa oradaki yazım kullanılır; böylece yıldız, okulun
// etkinlikleriyle aynı temsilî noktaya düşer.
function etiketleriOku(onayliKayitlar) {
  const sayfa = SpreadsheetApp.getActive().getSheetByName(ETIKET_SAYFASI);
  if (!sayfa || sayfa.getLastRow() < 2) return [];
  const yazim = {};
  onayliKayitlar.forEach((k) => { if (!yazim[k.okulAnahtari]) yazim[k.okulAnahtari] = k.okulAdi; });
  const turKodu = tersSozluk(ETIKET_TURU);
  return sayfa.getRange(2, 1, sayfa.getLastRow() - 1, ETIKET_BASLIKLARI.length).getValues()
    .map((r, i) => {
      const ilce = temizle(r[0]);
      const yazilan = temizle(r[1]);
      const okulAnahtari = `${sadelestir(yazilan)}|${ilce}`;
      const turHam = temizle(r[2]);
      const yilHam = temizle(r[3]);
      return {
        satirNo: i + 2,
        ilce,
        yazilan,
        okulAdi: yazim[okulAnahtari] || yazilan,
        okulAnahtari,
        turHam,
        tur: turKodu[turHam] || "",
        yilHam,
        yil: /^\d{4}$/.test(yilHam) ? yilHam : ""
      };
    })
    .filter((e) => e.ilce || e.yazilan || e.turHam || e.yilHam);
}

function etiketGecerliMi(e) {
  return Boolean(e.yazilan) && AYARLAR.ilceler.includes(e.ilce);
}

// Okul başına bir etiket yayımlanır; aynı okul birden çok satırdaysa en yeni yıl.
function yayinEtiketleri(etiketler) {
  const secilen = {};
  etiketler.filter(etiketGecerliMi).forEach((e) => {
    const onceki = secilen[e.okulAnahtari];
    if (!onceki || e.yil > onceki.yil) secilen[e.okulAnahtari] = e;
  });
  return Object.keys(secilen).map((a) => {
    const e = secilen[a];
    return { okulAdi: e.okulAdi, ilce: e.ilce, tur: e.tur, yil: e.yil };
  });
}

function yayinVerisi() {
  const onayli = kayitlariOku().filter((k) => k.onay);
  return {
    etkinlikler: onayli.map(yayinKaydi),
    etiketliOkullar: yayinEtiketleri(etiketleriOku(onayli))
  };
}

function doGet() {
  const onbellek = CacheService.getScriptCache();
  let json = onbellek.get(ONBELLEK_ANAHTARI);
  if (!json) {
    json = JSON.stringify(yayinVerisi());
    // Önbellek bir değer için en fazla ~100 KB kabul eder.
    if (json.length < 90000) onbellek.put(ONBELLEK_ANAHTARI, json, ONBELLEK_SURESI);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function onbellegiTemizle() {
  CacheService.getScriptCache().remove(ONBELLEK_ANAHTARI);
}

// ---------------------------------------------------------------------------
// Özet sayfası (yalnızca yönetici görür; doGet'ten ASLA dönmez)

// Tekrarsız sayım: okul, öğretmen (okul + tam ad) ve öğrenci grubu (okul +
// sınıf + şube) birer kez sayılır; grubun kız/erkek sayısı en yüksek değerdir.
// Şubelere paylaştırılan sayılar küsuratlı olabilir; toplam yuvarlanır.
function istatistik(kayitlar) {
  const okullar = new Set();
  const ogretmenler = new Set();
  const gruplar = {};
  kayitlar.forEach((k) => {
    okullar.add(k.okulAnahtari);
    ogretmenler.add(k.ogretmenAnahtari);
    k.gruplar.forEach((kg) => {
      const g = gruplar[kg.anahtar] || { kiz: 0, erkek: 0 };
      g.kiz = Math.max(g.kiz, kg.kiz);
      g.erkek = Math.max(g.erkek, kg.erkek);
      gruplar[kg.anahtar] = g;
    });
  });
  let kiz = 0;
  let erkek = 0;
  Object.keys(gruplar).forEach((a) => { kiz += gruplar[a].kiz; erkek += gruplar[a].erkek; });
  kiz = Math.round(kiz);
  erkek = Math.round(erkek);
  return { etkinlik: kayitlar.length, okul: okullar.size, ogretmen: ogretmenler.size, kiz, erkek, ogrenci: kiz + erkek };
}

function ozetCumlesi(o) {
  const s = (n) => n.toLocaleString("tr-TR");
  return `${s(o.etkinlik)} etkinlik, ${s(o.okul)} okulda ${s(o.ogretmen)} öğretmen tarafından ` +
    `${s(o.kiz)} kız ve ${s(o.erkek)} erkek, toplam ${s(o.ogrenci)} farklı öğrenciyle gerçekleştirildi.`;
}

// Kayıtları bir alana göre gruplayıp her grup için istatistik satırı üretir.
// Alan liste ise (içerik) kayıt, listedeki her değerin grubuna girer.
function kirilim(kayitlar, alan, etiketler) {
  const gruplar = {};
  kayitlar.forEach((k) => {
    [].concat(k[alan]).forEach((d) => { (gruplar[d] = gruplar[d] || []).push(k); });
  });
  const anahtarlar = etiketler ? Object.keys(etiketler) : Object.keys(gruplar).sort((a, b) => a.localeCompare(b, "tr"));
  return anahtarlar
    .filter((a) => gruplar[a])
    .map((a) => {
      const o = istatistik(gruplar[a]);
      return [etiketler ? etiketler[a] : a, o.etkinlik, o.okul, o.ogretmen, o.kiz, o.erkek, o.ogrenci];
    });
}

// ---------------------------------------------------------------------------
// Kontrol edilecekler: onaydan önce yöneticinin bakması gereken kayıtlar.

// "2026-2027" → 2026-09-01 … 2027-08-31
function donemAraligi() {
  const [bas, son] = AYARLAR.donem.split("-");
  return { baslangic: `${bas}-09-01`, bitis: `${son}-08-31` };
}

// Okul adındaki türe göre beklenen sınıf düzeyleri. Karma (kulüp) her
// okulda olabilir. Ad birden çok tür içeriyorsa hepsine izin verilir.
const OKUL_TURLERI = [
  { kelime: "anaokul", duzeyler: ["okuloncesi"] },
  { kelime: "ilkokul", duzeyler: ["okuloncesi", "1-4"] },
  { kelime: "ortaokul", duzeyler: ["5-8"] },
  { kelime: "lise", duzeyler: ["9-12"] }
];

function kayitUyarilari(k, bugun) {
  const uyarilar = [];
  const ad = sadelestir(k.okulAdi);
  const turler = OKUL_TURLERI.filter((t) => ad.includes(t.kelime));
  if (turler.length && k.sinifDuzeyi && k.sinifDuzeyi !== "karma") {
    const izinli = [].concat(...turler.map((t) => t.duzeyler));
    if (!izinli.includes(k.sinifDuzeyi)) {
      uyarilar.push(`Okul türü ile sınıf uyuşmuyor (${SINIF_DUZEYI[k.sinifDuzeyi]})`);
    }
  }
  const { baslangic, bitis } = donemAraligi();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(k.tarih)) uyarilar.push("Tarih boş veya geçersiz");
  else if (k.tarih < baslangic || k.tarih > bitis) uyarilar.push("Tarih dönem dışında (sitede görünmez)");
  else if (k.tarih > bugun) uyarilar.push("İleri tarihli etkinlik");
  if (k.bitisTarihi) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k.bitisTarihi)) uyarilar.push("Bitiş tarihi geçersiz");
    else if (k.bitisTarihi < k.tarih) uyarilar.push("Bitiş tarihi başlangıçtan önce (sitede tek gün görünür)");
    else if (k.bitisTarihi < baslangic || k.bitisTarihi > bitis) uyarilar.push("Bitiş tarihi dönem dışında");
  }
  const toplam = k.kizSayisi + k.erkekSayisi;
  if (toplam === 0) uyarilar.push("Öğrenci sayısı 0");
  else if (toplam > 200) uyarilar.push(`Öğrenci sayısı çok yüksek (${toplam})`);
  if (/https?:\/\/|www\./i.test(k.aciklama)) uyarilar.push("Açıklamada bağlantı var");
  return uyarilar;
}

function etiketUyarilari(e, satirSayisi) {
  const uyarilar = [];
  if (!e.yazilan) uyarilar.push("Okul adı boş (sitede görünmez)");
  if (!AYARLAR.ilceler.includes(e.ilce)) uyarilar.push("İlçe boş veya geçersiz (sitede görünmez)");
  if (!e.tur) uyarilar.push("Tür boş veya geçersiz");
  if (e.yilHam && !e.yil) uyarilar.push("Yıl geçersiz");
  if (satirSayisi[e.okulAnahtari] > 1) uyarilar.push("Aynı okul birden fazla satırda (en yeni yıl gösterilir)");
  return uyarilar;
}

function ozetiYenile() {
  const ss = SpreadsheetApp.getActive();
  const sayfa = ss.getSheetByName(OZET_SAYFASI) || ss.insertSheet(OZET_SAYFASI);
  const tumu = kayitlariOku();
  const onayli = tumu.filter((k) => k.onay);
  const bekleyen = tumu.length - onayli.length;
  const props = PropertiesService.getScriptProperties();

  const satirlar = [];
  const basliklar = [];      // kalın yazılacak satır numaraları (1'den başlar)
  const bolum = (ad) => { satirlar.push([]); satirlar.push([ad]); basliklar.push(satirlar.length); };
  const tablo = (sutunlar, veri) => {
    satirlar.push(sutunlar);
    basliklar.push(satirlar.length);
    veri.forEach((r) => satirlar.push(r));
    if (!veri.length) satirlar.push(["(kayıt yok)"]);
  };

  satirlar.push([`${AYARLAR.il} STEM Etkinlik Haritası ${AYARLAR.donem} — Özet (yalnızca yönetici)`]);
  basliklar.push(1);
  satirlar.push(["Son güncelleme", Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), "dd.MM.yyyy HH:mm")]);
  satirlar.push(["Form bağlantısı (öğretmenlere gönderin)", props.getProperty("FORM_ADRESI") || ""]);
  satirlar.push(["Site", AYARLAR.siteAdresi]);
  satirlar.push(["Onay bekleyen kayıt", bekleyen]);

  bolum("Kontrol edilecekler (onaysızlar dahil) — onaydan önce bakın");
  const bugun = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), "yyyy-MM-dd");
  const kontrolSatirlari = tumu
    .map((k) => ({ k, uyarilar: kayitUyarilari(k, bugun) }))
    .filter((x) => x.uyarilar.length)
    .map(({ k, uyarilar }) => [k.satirNo, k.onay ? "Onaylı" : "Bekliyor", k.ilce, k.okulAdi, k.etkinlikAdi, uyarilar.join(" · ")]);
  tablo(["Yanıtlar satırı", "Durum", "İlçe", "Okul", "Etkinlik", "Uyarı"], kontrolSatirlari);

  bolum("İl geneli (yalnızca onaylı kayıtlar)");
  satirlar.push([onayli.length ? ozetCumlesi(istatistik(onayli)) : "Henüz onaylı kayıt yok."]);
  satirlar.push(["Not: Birden fazla şubeyle girilen kayıtlarda öğrenci sayısı şubelere eşit paylaştırılarak sayılır; \"farklı öğrenci\" sayısı bu yüzden yaklaşıktır."]);

  const sutunlar = (ilk) => [ilk, "Etkinlik", "Okul", "Öğretmen", "Kız", "Erkek", "Farklı öğrenci"];
  bolum("İlçelere göre");
  tablo(sutunlar("İlçe"), kirilim(onayli, "ilce"));
  bolum("Kapsama göre");
  tablo(sutunlar("Kapsam"), kirilim(onayli, "kapsam", KAPSAM));
  bolum("İçerik türüne göre");
  tablo(sutunlar("İçerik türü"), kirilim(onayli, "icerik", ICERIK));
  satirlar.push(["Not: Bir etkinlikte birden çok tür seçilebildiği için bu tablonun toplamı il genelini aşabilir."]);
  bolum("Sınıf düzeyine göre");
  tablo(sutunlar("Sınıf düzeyi"), kirilim(onayli, "sinifDuzeyi", SINIF_DUZEYI));

  bolum("Okullara göre");
  const okulGruplari = {};
  onayli.forEach((k) => { (okulGruplari[k.okulAnahtari] = okulGruplari[k.okulAnahtari] || []).push(k); });
  const okulSatirlari = Object.keys(okulGruplari).map((a) => {
    const g = okulGruplari[a];
    const o = istatistik(g);
    return [g[0].ilce, g[0].okulAdi, o.etkinlik, o.ogretmen, o.kiz, o.erkek, o.ogrenci];
  }).sort((x, y) => x[0].localeCompare(y[0], "tr") || x[1].localeCompare(y[1], "tr"));
  tablo(["İlçe", "Okul", "Etkinlik", "Öğretmen", "Kız", "Erkek", "Farklı öğrenci"], okulSatirlari);

  bolum(`Etiketli okullar (STEM School Label) — "${ETIKET_SAYFASI}" sayfasından`);
  const etiketler = etiketleriOku(onayli);
  const satirSayisi = {};
  etiketler.filter(etiketGecerliMi).forEach((e) => { satirSayisi[e.okulAnahtari] = (satirSayisi[e.okulAnahtari] || 0) + 1; });
  const etkinlikSayisi = {};
  onayli.forEach((k) => { etkinlikSayisi[k.okulAnahtari] = (etkinlikSayisi[k.okulAnahtari] || 0) + 1; });
  tablo(["Etiketler satırı", "İlçe", "Okul adı (haritada)", "Tür", "Yıl", "Onaylı etkinlik", "Uyarı"],
    etiketler.map((e) => [e.satirNo, e.ilce, e.okulAdi, e.turHam, e.yilHam, etkinlikSayisi[e.okulAnahtari] || 0,
      etiketUyarilari(e, satirSayisi).join(" · ")]));
  satirlar.push(["Not: Okul adı etkinlik kayıtlarındakinden yalnızca büyük/küçük harf, Türkçe harf veya nokta farkıyla ayrılıyorsa aynı okul sayılır. \"Onaylı etkinlik\" 0 ise adı kontrol edin."]);

  // Yazım denetimi: ONAYSIZLAR DAHİL tüm kayıtlar. Sadeleştirilmiş hali aynı
  // olup farklı yazılan adlar "olası mükerrer" diye işaretlenir.
  bolum("Okul adları (onaysızlar dahil) — onaydan önce yazımı düzeltin");
  const yazimlar = {};
  tumu.forEach((k) => {
    const anahtar = k.okulAnahtari;
    yazimlar[anahtar] = yazimlar[anahtar] || {};
    const y = yazimlar[anahtar][k.okulAdi] || { ilce: k.ilce, ad: k.okulAdi, toplam: 0, onayli: 0 };
    y.toplam++;
    if (k.onay) y.onayli++;
    yazimlar[anahtar][k.okulAdi] = y;
  });
  const yazimSatirlari = [];
  Object.keys(yazimlar).forEach((anahtar) => {
    const farkliYazimlar = Object.keys(yazimlar[anahtar]);
    farkliYazimlar.forEach((ad) => {
      const y = yazimlar[anahtar][ad];
      yazimSatirlari.push([y.ilce, y.ad, y.toplam, y.onayli, farkliYazimlar.length > 1 ? "⚠ olası mükerrer" : ""]);
    });
  });
  yazimSatirlari.sort((x, y) => x[0].localeCompare(y[0], "tr") || sadelestir(x[1]).localeCompare(sadelestir(y[1]), "tr"));
  tablo(["İlçe", "Okul adı (yazıldığı gibi)", "Kayıt", "Onaylı", "Uyarı"], yazimSatirlari);
  satirlar.push(["Not: \"İ.O.\" gibi kısaltma farkları otomatik yakalanamaz; listeyi göz ile kontrol edin."]);

  // Yaz
  const genislik = Math.max(...satirlar.map((r) => r.length));
  const dolu = satirlar.map((r) => r.concat(Array(genislik - r.length).fill("")));
  sayfa.clear();
  sayfa.getRange(1, 1, dolu.length, genislik).setValues(dolu);
  basliklar.forEach((no) => sayfa.getRange(no, 1, 1, genislik).setFontWeight("bold"));
  sayfa.getRange(1, 1).setFontSize(13);
  sayfa.autoResizeColumns(1, genislik);
}

// ---------------------------------------------------------------------------
// Tetikleyiciler

// Yeni form yanıtı: Onay kutusunu (işaretsiz) ekler, özeti yeniler.
function formGonderildi(e) {
  const sayfa = e.range.getSheet();
  const basliklar = sayfa.getRange(1, 1, 1, sayfa.getLastColumn()).getValues()[0].map(temizle);
  const onaySutunu = basliklar.indexOf(ONAY_SUTUNU) + 1;
  if (onaySutunu > 0) {
    const hucre = sayfa.getRange(e.range.getRow(), onaySutunu);
    hucre.insertCheckboxes();
    hucre.uncheck();
  }
  ozetiYenile();
}

// Yanıtlar / Etiketler sayfasında hücre düzeltme veya onay: siteye giden veri hemen
// yenilensin. (Satır silme bunu tetiklemez; bkz. degisti.)
function duzenlendi(e) {
  if (!e) return;
  const sayfaAdi = e.range.getSheet().getName();
  if (sayfaAdi !== YANIT_SAYFASI && sayfaAdi !== ETIKET_SAYFASI) return;
  onbellegiTemizle();
  ozetiYenile();
}

// Satır silme / ekleme gibi yapısal değişiklikler onEdit'i TETİKLEMEZ;
// bunlar onChange ile yakalanır. Sıradan hücre düzenlemesi ("EDIT")
// duzenlendi() tarafından zaten işlendiği için burada atlanır.
function degisti(e) {
  if (e && e.changeType === "EDIT") return;
  onbellegiTemizle();
  ozetiYenile();
}

// Bu projenin tetikleyicilerini (yeniden) kurar; eskiler silinir, böylece
// iki kez çalıştırılsa da aynı tetikleyiciden iki tane oluşmaz.
function tetikleyicileriKur() {
  const ss = SpreadsheetApp.getActive();
  const bizimkiler = ["formGonderildi", "duzenlendi", "degisti"];
  ScriptApp.getProjectTriggers()
    .filter((t) => bizimkiler.includes(t.getHandlerFunction()))
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("formGonderildi").forSpreadsheet(ss).onFormSubmit().create();
  ScriptApp.newTrigger("duzenlendi").forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger("degisti").forSpreadsheet(ss).onChange().create();
  Logger.log("Tetikleyiciler kuruldu: " + bizimkiler.join(", "));
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("STEM Harita")
    .addItem("Özeti şimdi yenile", "ozetiYenile")
    .addItem("Site verisini hemen yenile", "onbellegiTemizle")
    .addToUi();
}

// ---------------------------------------------------------------------------
// Kurulum (bir kez)

// "Etiketler" sayfasını başlıkları ve açılır listeleriyle kurar (yoksa).
function etiketSayfasiKur() {
  const ss = SpreadsheetApp.getActive();
  if (ss.getSheetByName(ETIKET_SAYFASI)) return false;
  const sayfa = ss.insertSheet(ETIKET_SAYFASI);
  sayfa.getRange(1, 1, 1, ETIKET_BASLIKLARI.length).setValues([ETIKET_BASLIKLARI])
    .setFontWeight("bold").setBackground("#fff2cc");
  sayfa.getRange(1, 2).setNote("STEM School Label almış okul. Adı, etkinlik kayıtlarındaki gibi (tam resmî adıyla) yazın.");
  sayfa.setFrozenRows(1);
  const satir = sayfa.getMaxRows() - 1;
  const liste = (degerListesi) => SpreadsheetApp.newDataValidation()
    .requireValueInList(degerListesi, true).setAllowInvalid(false).build();
  sayfa.getRange(2, 1, satir, 1).setDataValidation(liste(AYARLAR.ilceler));
  sayfa.getRange(2, 3, satir, 1).setDataValidation(liste(degerler(ETIKET_TURU)));
  sayfa.getRange(2, 4, satir, 1).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireNumberBetween(2000, 2100).setHelpText("Etiketin alındığı yıl, ör. 2025").setAllowInvalid(false).build());
  sayfa.setColumnWidth(2, 320);
  return true;
}

function aydinlatmaMetni() {
  return [
    `Veri sorumlusu: ${AYARLAR.veriSorumlusu}`,
    "",
    `Bu form, ${AYARLAR.il} ilinde öğretmenlerin düzenlediği STEM etkinliklerini gönüllülük esasıyla bir harita üzerinde tanıtmak amacıyla hazırlanmıştır.`,
    "",
    "İşlenen veriler: Adınız ve soyadınız; okulunuzun adı ve ilçesi; etkinlik bilgileri (ad, tarih, kapsam, içerik, sınıf ve şube, katılan kız ve erkek öğrenci sayısı, açıklama). Öğrencilere ait ad, fotoğraf veya kimliği belirleyici hiçbir bilgi toplanmaz. E-posta adresiniz toplanmaz.",
    "",
    `Yayımlanan bilgiler: Kaydınız incelenip onaylandıktan sonra şu bilgiler ${AYARLAR.siteAdresi} adresinde herkese açık olarak yayımlanır: etkinlik adı, okul adı, ilçe, tarih, kapsam, içerik, sınıf düzeyi, öğrenci sayıları ve açıklama. Adınız yalnızca kısaltılmış biçimde (ör. "Ayşe Y.") yayımlanır. Soyadınızın tamamı ile sınıf ve şube bilgisi yayımlanmaz. Haritadaki konumlar temsilîdir; okulun gerçek konumunu göstermez.`,
    "",
    "Amaç ve hukuki sebep: Etkinliklerin tanıtılması; açık rızanız (6698 sayılı KVKK m.5/1).",
    "",
    "Saklama yeri: Veriler Google Forms / Google E-Tablolar hizmetlerinde saklanır. Site GitHub Pages üzerinde yayımlanır. Veriler başka hiçbir kişi veya kurumla paylaşılmaz.",
    "",
    `Saklama süresi: Form yanıtları ${AYARLAR.saklamaTarihi} tarihinde silinir. Sitede yayımlanmış bilgiler bu tarihten sonra arşiv olarak yayında kalabilir.`,
    "",
    `Haklarınız: KVKK m.11 kapsamındaki haklarınızı (bilgi talep etme, düzeltme, silme vb.) kullanmak ve kaydınızın yayından kaldırılmasını istemek için ${AYARLAR.iletisim} adresine yazabilirsiniz.`
  ].join("\n");
}

// Aşağıdaki parçalar hem yeni form kurulurken (formuOlustur) hem de eski
// form yerinde güncellenirken (formuGuncelle) kullanılır.

function formAciklamasi() {
  return `${AYARLAR.il} ilinde düzenlediğiniz STEM etkinliğini haritaya eklemek için bu formu doldurunuz. ` +
    "Her etkinlik için ayrı kayıt giriniz; aynı etkinliği birden fazla şubeyle yaptıysanız şubelerin hepsini " +
    "tek kayıtta işaretleyebilirsiniz. Kaydınız incelendikten sonra haritada görünür.";
}

const SUBE_NOTU = "Etkinliği aynı sınıfın birden fazla şubesiyle yaptıysanız hepsini işaretleyiniz. " +
  "Öğrenci sayılarına seçtiğiniz şubelerin toplamını yazınız.";
const SAYI_NOTU = "Birden fazla şube seçtiyseniz tüm şubelerin toplamını yazınız.";

function bitisSorusuEkle(form) {
  return form.addDateItem().setTitle(SORU.bitis)
    .setHelpText("Etkinlik tek gün sürdüyse boş bırakınız.")
    .setRequired(false);
}

function icerikSorusuEkle(form) {
  return form.addCheckboxItem().setTitle(SORU.icerik)
    .setHelpText("Birden fazla seçebilirsiniz.")
    .setChoiceValues(degerler(ICERIK)).setRequired(true);
}

function subeSorusuEkle(form) {
  return form.addCheckboxItem().setTitle(SORU.sube)
    .setHelpText(SUBE_NOTU)
    .setChoiceValues(SUBELER).setRequired(true);
}

function sube1112SorusuEkle(form) {
  return form.addCheckboxItem().setTitle(SORU.sube1112)
    .setHelpText("Alan ayrımı olan sınıflarda alanı ve şubeyi seçiniz (ör. Sayısal A). " +
      "Alan ayrımı yoksa yalnızca şube harfini seçiniz. " + SUBE_NOTU)
    .setChoiceValues(SUBELER_1112).setRequired(true);
}

function formuOlustur() {
  const form = FormApp.create(`${AYARLAR.il} STEM Etkinlik Haritası ${AYARLAR.donem} — Etkinlik Kaydı`);
  form
    .setDescription(formAciklamasi())
    .setCollectEmail(false)
    .setAllowResponseEdits(false)
    .setPublishingSummary(false)       // Yanıt özetleri doldurana GÖSTERİLMEZ.
    .setShowLinkToRespondAgain(true)
    .setConfirmationMessage("Teşekkürler! Kaydınız incelendikten sonra haritada görünecektir.");

  const sayiDogrulama = FormApp.createTextValidation()
    .setHelpText("Lütfen 0 ile 999 arasında bir tam sayı yazınız.")
    .requireTextMatchesPattern("^[0-9]{1,3}$")
    .build();

  form.addListItem().setTitle(SORU.ilce).setChoiceValues(AYARLAR.ilceler).setRequired(true);
  form.addTextItem().setTitle(SORU.okul)
    .setHelpText("Okulunuzun tam resmî adını kısaltma kullanmadan yazınız. Örnek: Şehit Ahmet Yılmaz İlkokulu")
    .setRequired(true);
  form.addTextItem().setTitle(SORU.ad)
    .setHelpText("Sitede adınız kısaltılmış olarak görünür (ör. Ayşe Y.).")
    .setRequired(true);
  form.addTextItem().setTitle(SORU.etkinlik).setRequired(true)
    .setValidation(FormApp.createTextValidation()
      .setHelpText("En fazla 100 karakter.")
      .requireTextLengthLessThanOrEqualTo(100).build());
  form.addMultipleChoiceItem().setTitle(SORU.kapsam)
    .setChoiceValues(degerler(KAPSAM)).setRequired(true);
  icerikSorusuEkle(form);
  const sinifSorusu = form.addListItem().setTitle(SORU.sinif).setRequired(true)
    .setHelpText("Kulüp veya farklı sınıflardan öğrencilerle yaptıysanız \"" + KULUP + "\" seçiniz.");

  // Sınıfa göre dallanma: 11-12 → alanlı şube sayfası; kulüp → şube sorulmaz.
  const subeSayfasi = form.addPageBreakItem().setTitle("Şube");
  subeSorusuEkle(form);
  const sube1112Sayfasi = form.addPageBreakItem().setTitle("Şube (11. ve 12. sınıf)");
  sube1112SorusuEkle(form);
  const sonSayfa = form.addPageBreakItem().setTitle("Etkinlik ayrıntıları");
  sube1112Sayfasi.setGoToPage(sonSayfa);   // "Şube" sayfasından sonra 11-12 sayfası atlanır.
  sinifSorusu.setChoices(SINIFLAR.map((sinif) => {
    const hedef = sinif === KULUP ? sonSayfa
      : (sinif === "11. sınıf" || sinif === "12. sınıf") ? sube1112Sayfasi
      : subeSayfasi;
    return sinifSorusu.createChoice(sinif, hedef);
  }));

  form.addDateItem().setTitle(SORU.tarih).setRequired(true);
  bitisSorusuEkle(form);
  form.addTextItem().setTitle(SORU.kiz).setHelpText(SAYI_NOTU).setRequired(true).setValidation(sayiDogrulama);
  form.addTextItem().setTitle(SORU.erkek).setHelpText(SAYI_NOTU).setRequired(true).setValidation(sayiDogrulama);
  form.addParagraphTextItem().setTitle(SORU.aciklama)
    .setHelpText("En fazla 300 karakter. Öğrenci adı yazmayınız. Fotoğraf veya bağlantı eklemeyiniz.")
    .setRequired(false)
    .setValidation(FormApp.createParagraphTextValidation()
      .setHelpText("En fazla 300 karakter.")
      .requireTextLengthLessThanOrEqualTo(300).build());

  form.addSectionHeaderItem()
    .setTitle("Kişisel verilerin işlenmesine ilişkin aydınlatma metni")
    .setHelpText(aydinlatmaMetni());
  form.addCheckboxItem().setTitle(SORU.aydinlatma)
    .setChoiceValues(["Aydınlatma metnini okudum ve anladım."])
    .setRequired(true);
  form.addCheckboxItem().setTitle(SORU.riza)
    .setChoiceValues(["Yukarıdaki bilgilerimin aydınlatma metninde belirtilen amaçla işlenmesine, sitede yayımlanmasına ve yurt dışındaki sunucularda saklanmasına açık rıza veriyorum."])
    .setRequired(true);
  return form;
}

// Formu oluşturur, bu tabloya bağlar, yanıt sayfasını "Yanıtlar" yapar ve
// sağına Onay sütununu ekler.
function formuKurVeBagla(ss, props) {
  const form = formuOlustur();
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  SpreadsheetApp.flush();

  const formId = form.getId();
  const sayfa = ss.getSheets().find((s) => {
    const adres = s.getFormUrl();
    return adres && FormApp.openByUrl(adres).getId() === formId;
  });
  if (!sayfa) throw new Error("Form yanıt sayfası bulunamadı.");
  sayfa.setName(YANIT_SAYFASI);

  const onaySutunu = sayfa.getLastColumn() + 1;
  sayfa.getRange(1, onaySutunu).setValue(ONAY_SUTUNU).setFontWeight("bold").setBackground("#fff2cc");
  sayfa.setFrozenRows(1);

  props.setProperty("FORM_ID", formId);
  props.setProperty("FORM_ADRESI", form.getPublishedUrl());
  return form;
}

function kurulumSonuMesaji(form) {
  Logger.log("Öğretmenlere gönderilecek form adresi: " + form.getPublishedUrl());
  Logger.log("Formu düzenleme adresi (yalnızca siz): " + form.getEditUrl());
}

function kurulum() {
  const ss = SpreadsheetApp.getActive();
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty("FORM_ID")) {
    throw new Error("Kurulum daha önce yapılmış. Formu yeniden oluşturmak için formuYenidenKur() kullanın.");
  }
  const form = formuKurVeBagla(ss, props);

  // Boş varsayılan sayfayı kaldır.
  ss.getSheets().forEach((s) => {
    if (s.getName() !== YANIT_SAYFASI && s.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s);
  });

  etiketSayfasiKur();
  tetikleyicileriKur();
  ozetiYenile();
  Logger.log("Kurulum tamam.");
  kurulumSonuMesaji(form);
}

// Form soruları değiştiğinde: eski formu kapatır ve tablodan ayırır, eski
// yanıt sayfasını "Eski yanıtlar" diye saklar (SİLMEZ), yeni formu kurar.
// Tetikleyiciler tabloya bağlı olduğu için yeniden kurulmaz.
function formuYenidenKur() {
  const ss = SpreadsheetApp.getActive();
  const props = PropertiesService.getScriptProperties();
  const eskiId = props.getProperty("FORM_ID");
  // Eski formu kapatma ve ayırma "olsa iyi olur" adımlarıdır; Google bazı
  // formlarda bunları reddedebiliyor ("Invalid data updating form").
  // Başarısız olursa kurulum durmaz, günlüğe elle yapılacak iş yazılır.
  if (eskiId) {
    let eski = null;
    try {
      eski = FormApp.openById(eskiId);
    } catch (hata) {
      Logger.log("Uyarı: eski form açılamadı (silinmiş olabilir): " + hata);
    }
    if (eski) {
      try {
        eski.setAcceptingResponses(false);
      } catch (hata) {
        Logger.log("Uyarı: eski form otomatik kapatılamadı. Eski formu açıp Yanıtlar sekmesinde " +
          "\"Yanıt kabul ediliyor\" anahtarını kapatın veya formu Drive'dan silin. (" + hata + ")");
      }
      try {
        eski.removeDestination();
      } catch (hata) {
        Logger.log("Uyarı: eski form tablodan ayrılamadı; eski yanıt sayfası yine de yeniden adlandırılacak. (" + hata + ")");
      }
    }
  }
  const eskiSayfa = ss.getSheetByName(YANIT_SAYFASI);
  if (eskiSayfa) {
    const tarih = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), "yyyy-MM-dd HH.mm");
    eskiSayfa.setName(`Eski yanıtlar ${tarih}`);
  }
  props.deleteProperty("FORM_ID");

  const form = formuKurVeBagla(ss, props);
  onbellegiTemizle();
  ozetiYenile();
  Logger.log("Form yeniden kuruldu. Eski yanıtlar ayrı bir sayfada saklandı; kontrol edip silebilirsiniz.");
  kurulumSonuMesaji(form);
}

// ---------------------------------------------------------------------------
// Formu yerinde güncelleme (Ekim 2026 değişiklikleri)
//
// formuYenidenKur() yeni bir form açar: form adresi değişir ve eski yanıtlar
// "Eski yanıtlar" sayfasına taşınıp siteden düşer. Bu işlev ise MEVCUT formu
// değiştirir; form adresi ve yanıtlar olduğu gibi kalır:
//   - kapsama "Harezmi Eğitim Modeli" eklenir,
//   - "Etkinlikte ne yapıldı?" çok seçimli "Etkinlikte neler yapıldı?" olur,
//   - "Anasınıfı" seçeneği "Okul öncesi" olur,
//   - şube soruları çok seçimli olur,
//   - "Etkinlik tarihi" "Başlangıç tarihi" olur, isteğe bağlı "Bitiş tarihi" eklenir,
//   - STEM School Label için "Etiketler" sayfası kurulur,
//   - açıklama ve yardım metinleri yenilenir, tetikleyiciler yeniden kurulur.
// Tür değiştirilemeyen sorular (tek seçim → işaret kutusu) aynı yerde yenisiyle
// değiştirilir; eski cevaplar Sheets'teki eski sütunda kalır ve okunmaya devam
// eder. İki kez çalıştırmak güvenlidir: yapılmış adımlar atlanır.

function ogeBul(form, baslik, tur) {
  return form.getItems(tur).find((oge) => oge.getTitle() === baslik) || null;
}

// Eski soruyu siler, yenisini onun yerine (aynı sayfaya) koyar.
function ogeyiDegistir(form, eski, yeniEkle) {
  const yer = eski.getIndex();
  const yeni = yeniEkle(form);
  form.moveItem(yeni.getIndex(), yer);
  form.deleteItem(eski);
}

function formuGuncelle() {
  const ss = SpreadsheetApp.getActive();
  const props = PropertiesService.getScriptProperties();
  const formId = props.getProperty("FORM_ID");
  if (!formId) throw new Error("Form bulunamadı. Önce kurulum() çalıştırılmalı.");
  const form = FormApp.openById(formId);
  const T = FormApp.ItemType;
  const yapilan = [];

  // Güvenlik için önce yanıtların kopyası alınır (tam adlar içerir; kontrol
  // ettikten sonra silin).
  const tarih = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), "yyyy-MM-dd HH.mm");
  yanitSayfasi().copyTo(ss).setName(`Yedek yanıtlar ${tarih}`);

  form.setDescription(formAciklamasi());

  const kapsam = ogeBul(form, SORU.kapsam, T.MULTIPLE_CHOICE);
  if (kapsam) {
    kapsam.asMultipleChoiceItem().setChoiceValues(degerler(KAPSAM));
    yapilan.push("kapsam seçenekleri (Harezmi)");
  } else {
    Logger.log(`Uyarı: "${SORU.kapsam}" sorusu bulunamadı.`);
  }

  const icerik = ogeBul(form, SORU_ESKI.icerik, T.MULTIPLE_CHOICE);
  if (icerik) {
    ogeyiDegistir(form, icerik, icerikSorusuEkle);
    yapilan.push("içerik sorusu çok seçimli");
  }

  const sinifOge = ogeBul(form, SORU.sinif, T.LIST);
  if (sinifOge) {
    const sinif = sinifOge.asListItem();
    const secenekler = sinif.getChoices();
    if (secenekler.some((c) => c.getValue() === ESKI_OKUL_ONCESI)) {
      sinif.setChoices(secenekler.map((c) => {
        const deger = c.getValue() === ESKI_OKUL_ONCESI ? OKUL_ONCESI : c.getValue();
        const hedef = c.getGotoPage();
        return hedef ? sinif.createChoice(deger, hedef) : sinif.createChoice(deger, c.getPageNavigationType());
      }));
      yapilan.push(`"${ESKI_OKUL_ONCESI}" → "${OKUL_ONCESI}"`);
    }
  } else {
    Logger.log(`Uyarı: "${SORU.sinif}" sorusu bulunamadı.`);
  }

  const sube = ogeBul(form, SORU_ESKI.sube, T.LIST);
  if (sube) {
    ogeyiDegistir(form, sube, subeSorusuEkle);
    yapilan.push("şube sorusu çok seçimli");
  }
  const sube1112 = ogeBul(form, SORU_ESKI.sube1112, T.LIST);
  if (sube1112) {
    ogeyiDegistir(form, sube1112, sube1112SorusuEkle);
    yapilan.push("11-12 şube sorusu çok seçimli");
  }

  const eskiTarih = ogeBul(form, SORU_ESKI.tarih, T.DATE);
  if (eskiTarih) {
    eskiTarih.setTitle(SORU.tarih);
    yapilan.push(`"${SORU_ESKI.tarih}" → "${SORU.tarih}"`);
  }
  const baslangicOge = ogeBul(form, SORU.tarih, T.DATE);
  if (baslangicOge && !ogeBul(form, SORU.bitis, T.DATE)) {
    const yeni = bitisSorusuEkle(form);
    form.moveItem(yeni.getIndex(), baslangicOge.getIndex() + 1);
    yapilan.push("bitiş tarihi sorusu");
  }

  [SORU.kiz, SORU.erkek].forEach((baslik) => {
    const oge = ogeBul(form, baslik, T.TEXT);
    if (oge) oge.asTextItem().setHelpText(SAYI_NOTU);
  });

  if (etiketSayfasiKur()) yapilan.push(`"${ETIKET_SAYFASI}" sayfası`);

  tetikleyicileriKur();
  onbellegiTemizle();
  ozetiYenile();
  Logger.log("Form güncellendi: " + (yapilan.length ? yapilan.join(", ") : "soru değişikliği gerekmedi (daha önce yapılmış)") + ".");
  Logger.log(`Yanıtların yedeği "Yedek yanıtlar ${tarih}" sayfasında. Kontrol ettikten sonra bu sayfayı silin.`);
}
