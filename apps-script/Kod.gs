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
// İsteğe bağlı Proje Maratonu (AYARLAR.maraton): aynı formun ilk sorusunda
// "Proje Maratonu çalışması" seçilir; ekipler "Maraton" sayfasında tanımlanır,
// yazılar da etkinlikler gibi Onay kutusuyla yayımlanır.
//
// KVKK: Tam ad, şube, zaman damgası ve onaysız kayıtlar doGet çıktısına
// ASLA girmez. Öğretmen adı burada kısaltılır.

// ---------------------------------------------------------------------------
// Sabitler. Soru başlıkları Sheets sütun başlıklarıyla eşleştirmede
// kullanılır; formda başlık değiştirilirse burası da değiştirilmelidir.

const SORU = {
  tur: "Ne eklemek istiyorsunuz?",   // yalnızca maraton açıkken; eski yanıtlarda boş
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
// Önbellek değer başına ~100 KB kabul eder; Türkçe harf 2 bayt tuttuğu için
// çıktı bu uzunlukta parçalara bölünür.
const ONBELLEK_PARCA = 40000; // karakter

// Proje Maratonu (isteğe bağlı; AYARLAR.maraton yoksa kapalıdır). Aynı formun
// ilk sorusunda öğretmen ya ekibini BİR KEZ kaydeder ya da kayıtlı ekibine
// çalışma yazısı ekler. İkisi de etkinlikler gibi "Onay" kutusuyla yayımlanır.
// Onaylanan ekip kaydı kendiliğinden "Maraton" sayfasına aktarılır ve kod alır;
// sonraki düzeltmeleri yönetici o sayfada yapar.
const MARATON_SAYFASI = "Maraton";
const MARATON_BASLIKLARI = ["Ekip kodu", "Öğretmen adı soyadı", "İlçe", "Okul adı",
  "Proje adı", "Tema", "Kız", "Erkek", "Yayında"];
const TUR_ETKINLIK = "STEM etkinliği";
const TUR_KAYIT = "Proje Maratonu: ekip kaydı (ilk kez)";
const TUR_YAZI = "Proje Maratonu: çalışma yazısı";
// Yanıtlar sayfasında, Maraton'a aktarılan ekip kaydının kodu (betik yazar).
const KAYIT_KODU_SUTUNU = "Ekip kodu";
// Başlıklar etkinlik sorularınınkinden ve birbirinden FARKLI olmalı (Sheets'te
// aynı adlı iki sütun olmasın).
const KAYIT_SORU = {
  ilce: "Ekibin ilçesi",
  okul: "Ekibin okulu",
  ad: "Ekip öğretmeninin adı ve soyadı",
  proje: "Proje adı",
  tema: "Proje teması",
  kiz: "Ekipteki kız öğrenci sayısı",
  erkek: "Ekipteki erkek öğrenci sayısı",
  aydinlatma: "Aydınlatma metni (ekip kaydı)",
  riza: "Açık rıza (ekip kaydı)"
};
const MARATON_SORU = {
  ekip: "Ekibiniz",
  ad: "Yazıyı gönderen öğretmenin adı ve soyadı",
  tarih: "Çalışma tarihi",
  metin: "Bu çalışmada neler yaptınız?",
  aydinlatma: "Aydınlatma metni (çalışma yazısı)",
  riza: "Açık rıza (çalışma yazısı)"
};
const GUNLUK_SINIRI = 400;
const EKIP_AYRACI = " · ";          // formdaki seçenek: "M01 · Proje adı — Okul"
const EKIP_YOK = "(Henüz ekip yok)";

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

const TARIH_BICIMI = /^\d{4}-\d{2}-\d{2}$/;

function bugunTarihi() {
  return Utilities.formatDate(new Date(), SpreadsheetApp.getActive().getSpreadsheetTimeZone(), "yyyy-MM-dd");
}

function metinKirp(metin, sinir) {
  return metin.length > sinir ? metin.slice(0, sinir).trim() + "…" : metin;
}

function baglantiVarMi(metin) {
  return /https?:\/\/|www\./i.test(metin);
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

// Eski yanıtlarda tür sorusu yoktur (boş) → etkinlik.
function satirTuru(satir) {
  return temizle(satir[SORU.tur]) || TUR_ETKINLIK;
}

// Etkinlik kayıtları (maraton satırları hariç).
function kayitlariOku() {
  const saatDilimi = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
  return satirlariOku().filter((s) => satirTuru(s) === TUR_ETKINLIK).map((s) => kayitOlustur(s, saatDilimi));
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

// okulAnahtari → onaylı etkinliklerdeki yazım. Elle girilen okul adı (Etiketler,
// Maraton) küçük yazım farklarıyla bir etkinlikte geçiyorsa oradaki yazım
// kullanılır; böylece işaret, okulun etkinlikleriyle aynı temsilî noktaya düşer.
function okulYazimlari(onayliKayitlar) {
  const yazim = {};
  onayliKayitlar.forEach((k) => { if (!yazim[k.okulAnahtari]) yazim[k.okulAnahtari] = k.okulAdi; });
  return yazim;
}

// Etiketler sayfasının satırları.
function etiketleriOku(onayliKayitlar) {
  const sayfa = SpreadsheetApp.getActive().getSheetByName(ETIKET_SAYFASI);
  if (!sayfa || sayfa.getLastRow() < 2) return [];
  const yazim = okulYazimlari(onayliKayitlar);
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

// ---------------------------------------------------------------------------
// Proje Maratonu

function maratonAcikMi() {
  return Boolean(typeof AYARLAR.maraton === "object" && AYARLAR.maraton && AYARLAR.maraton.ad);
}

// "Maraton" sayfasının satırları (tam ad dahil; DIŞARI VERİLMEZ).
function maratonEkipleriOku(onayliKayitlar) {
  const sayfa = SpreadsheetApp.getActive().getSheetByName(MARATON_SAYFASI);
  if (!sayfa || sayfa.getLastRow() < 2) return [];
  const yazim = okulYazimlari(onayliKayitlar);
  return sayfa.getRange(2, 1, sayfa.getLastRow() - 1, MARATON_BASLIKLARI.length).getValues()
    .map((r, i) => {
      const ilce = temizle(r[2]);
      const yazilan = temizle(r[3]);
      const okulAnahtari = `${sadelestir(yazilan)}|${ilce}`;
      return {
        satirNo: i + 2,
        kod: temizle(r[0]),
        tamAd: temizle(r[1]),
        ilce,
        yazilan,
        okulAdi: yazim[okulAnahtari] || yazilan,
        okulAnahtari,
        projeAdi: temizle(r[4]),
        tema: temizle(r[5]),
        kizSayisi: sayiyaCevir(r[6]),
        erkekSayisi: sayiyaCevir(r[7]),
        yayinda: r[8] === true
      };
    })
    .filter((m) => m.kod || m.tamAd || m.yazilan || m.projeAdi)
    // Okulun etkinliği yoksa aynı okulun ekipleri ilk ekibin yazımını kullanır.
    .map((m, _, ekipler) => {
      if (!yazim[m.okulAnahtari]) m.okulAdi = ekipler.find((x) => x.okulAnahtari === m.okulAnahtari).yazilan;
      return m;
    });
}

// Ekibin haritada görünmesini engelleyen eksikler.
function ekipSorunlari(m, ilkSatir) {
  const sorunlar = [];
  if (!m.kod) sorunlar.push("Ekip kodu boş");
  else if (m.kod.includes("·")) sorunlar.push("Ekip kodunda \"·\" kullanılmaz");
  else if (ilkSatir[m.kod] !== m) sorunlar.push(`Aynı ekip kodu ${ilkSatir[m.kod].satirNo}. satırda da var (bu satır kullanılmaz)`);
  if (!m.tamAd) sorunlar.push("Öğretmen adı boş");
  if (!AYARLAR.ilceler.includes(m.ilce)) sorunlar.push("İlçe boş veya geçersiz");
  if (!m.yazilan) sorunlar.push("Okul adı boş");
  if (!m.projeAdi) sorunlar.push("Proje adı boş");
  return sorunlar;
}

// Ekiplere sorunlarını ve haritada görünüp görünmeyeceğini ekler.
// Döndürür: ekip kodu → ekip (aynı kod birden çok satırdaysa ilki).
function ekipleriHazirla(ekipler) {
  const ilkSatir = {};
  ekipler.forEach((m) => { if (m.kod && !ilkSatir[m.kod]) ilkSatir[m.kod] = m; });
  ekipler.forEach((m) => {
    m.sorunlar = ekipSorunlari(m, ilkSatir);
    m.yayinlanir = m.yayinda && !m.sorunlar.length;
  });
  return ilkSatir;
}

// Yanıtlar sayfasındaki ekip kayıtları (tam ad dahil; DIŞARI VERİLMEZ).
// "kod" doluysa kayıt Maraton sayfasına aktarılmıştır.
function ekipKayitlariniOku() {
  return satirlariOku().filter((s) => satirTuru(s) === TUR_KAYIT).map((satir) => ({
    satirNo: satir.satirNo,
    onay: satir[ONAY_SUTUNU] === true,
    kod: temizle(satir[KAYIT_KODU_SUTUNU]),
    ilce: temizle(satir[KAYIT_SORU.ilce]),
    okulAdi: temizle(satir[KAYIT_SORU.okul]),
    tamAd: temizle(satir[KAYIT_SORU.ad]),
    projeAdi: temizle(satir[KAYIT_SORU.proje]),
    tema: temizle(satir[KAYIT_SORU.tema]),
    kizSayisi: sayiyaCevir(satir[KAYIT_SORU.kiz]),
    erkekSayisi: sayiyaCevir(satir[KAYIT_SORU.erkek])
  }));
}

// Onaydan önce yöneticinin bakması gerekenler.
function ekipKaydiUyarilari(k, ekipler) {
  const uyarilar = [];
  if (!AYARLAR.ilceler.includes(k.ilce)) uyarilar.push("İlçe boş veya geçersiz");
  if (!k.okulAdi) uyarilar.push("Okul adı boş");
  if (!k.tamAd) uyarilar.push("Öğretmen adı boş");
  if (!k.projeAdi) uyarilar.push("Proje adı boş");
  const toplam = k.kizSayisi + k.erkekSayisi;
  if (toplam === 0) uyarilar.push("Öğrenci sayısı 0");
  else if (toplam > 200) uyarilar.push(`Öğrenci sayısı çok yüksek (${toplam})`);
  const okulAnahtari = `${sadelestir(k.okulAdi)}|${k.ilce}`;
  const ayni = ekipler.find((m) => m.okulAnahtari === okulAnahtari &&
    sadelestir(m.projeAdi) === sadelestir(k.projeAdi) && m.kod !== k.kod);
  if (ayni) uyarilar.push(`Bu okulda aynı adlı ekip zaten var (${ayni.kod}); mükerrer kayıt olabilir`);
  return uyarilar;
}

// Yanıtlar sayfasındaki maraton yazıları (tam ad dahil; DIŞARI VERİLMEZ).
// Ekip, formdaki "M01 · Proje adı — Okul" seçeneğinin kodundan bulunur; proje
// adı sonradan değişse de eski yazılar ekibinde kalır.
function maratonYazilariOku() {
  const saatDilimi = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
  return satirlariOku().filter((s) => satirTuru(s) === TUR_YAZI).map((satir) => {
    const tarihHam = satir[MARATON_SORU.tarih];
    return {
      satirNo: satir.satirNo,
      zaman: satir.zaman.getTime(),
      onay: satir[ONAY_SUTUNU] === true,
      ekipSecimi: temizle(satir[MARATON_SORU.ekip]),
      kod: temizle(String(satir[MARATON_SORU.ekip] || "").split(EKIP_AYRACI)[0]),
      tamAd: temizle(satir[MARATON_SORU.ad]),
      tarih: tarihMi(tarihHam) ? Utilities.formatDate(tarihHam, saatDilimi, "yyyy-MM-dd") : temizle(tarihHam),
      metin: temizle(satir[MARATON_SORU.metin])
    };
  });
}

// Yazının yayımlanmasını engelleyenler ve yönetici için uyarılar.
function yaziDurumu(y, ilkSatir, bugun) {
  const engeller = [];
  const uyarilar = [];
  const ekip = ilkSatir[y.kod];
  if (!ekip) engeller.push("Ekip bulunamadı");
  else {
    if (!ekip.yayinlanir) engeller.push("Ekip haritada değil (Maraton sayfasında \"Yayında\" veya eksik bilgi)");
    if (sadelestir(y.tamAd) !== sadelestir(ekip.tamAd)) uyarilar.push(`Ad ekip öğretmeniyle uyuşmuyor (ekipte: ${ekip.tamAd})`);
  }
  const { baslangic, bitis } = AYARLAR.maraton;
  if (!TARIH_BICIMI.test(y.tarih)) engeller.push("Tarih boş veya geçersiz");
  else if (y.tarih < baslangic || y.tarih > bitis) engeller.push("Tarih maraton dönemi dışında");
  else if (y.tarih > bugun) uyarilar.push("İleri tarihli");
  if (!y.metin) engeller.push("Yazı boş");
  if (baglantiVarMi(y.metin)) uyarilar.push("Yazıda bağlantı var");
  if (y.metin.length > GUNLUK_SINIRI) uyarilar.push("Yazı uzun; sitede kırpılır");
  return { engeller, uyarilar };
}

function maratonDurumu(onayliKayitlar, bugun) {
  const ekipler = maratonEkipleriOku(onayliKayitlar);
  const ilkSatir = ekipleriHazirla(ekipler);
  const yazilar = maratonYazilariOku().map((y) => {
    const durum = yaziDurumu(y, ilkSatir, bugun);
    return Object.assign(y, durum, { yayinlanir: y.onay && !durum.engeller.length });
  });
  return { ekipler, yazilar };
}

// Siteye giden maraton verisi (BEYAZ LİSTE): tam ad, zaman damgası, onaysız
// yazı yok. Yazılar en yeni üstte.
function maratonYayini(durum) {
  const gunluk = {};
  durum.yazilar
    .filter((y) => y.yayinlanir)
    .sort((a, b) => b.tarih.localeCompare(a.tarih) || b.zaman - a.zaman)
    .forEach((y) => { (gunluk[y.kod] = gunluk[y.kod] || []).push({ tarih: y.tarih, metin: metinKirp(y.metin, GUNLUK_SINIRI) }); });
  return {
    ad: AYARLAR.maraton.ad,
    ekipler: durum.ekipler.filter((m) => m.yayinlanir).map((m) => ({
      kod: m.kod,
      okulAdi: m.okulAdi,
      ilce: m.ilce,
      projeAdi: m.projeAdi,
      tema: m.tema,
      ogretmenAdi: adiKisalt(m.tamAd),
      kizSayisi: m.kizSayisi,
      erkekSayisi: m.erkekSayisi,
      gunluk: gunluk[m.kod] || []
    }))
  };
}

function yayinVerisi() {
  const onayli = kayitlariOku().filter((k) => k.onay);
  const veri = {
    etkinlikler: onayli.map(yayinKaydi),
    etiketliOkullar: yayinEtiketleri(etiketleriOku(onayli))
  };
  if (maratonAcikMi()) veri.maraton = maratonYayini(maratonDurumu(onayli, bugunTarihi()));
  return veri;
}

// ---------------------------------------------------------------------------
// Web uygulaması ve önbellek

// Ana anahtarda parça sayısı, "<anahtar>-0", "-1"… anahtarlarında JSON parçaları
// durur. Ana anahtar silinince (onbellegiTemizle) önbellek geçersiz olur.
function onbellektenOku(onbellek) {
  const adet = Number(onbellek.get(ONBELLEK_ANAHTARI));
  if (!adet) return null;
  const anahtarlar = Array.from({ length: adet }, (_, i) => `${ONBELLEK_ANAHTARI}-${i}`);
  const parcalar = onbellek.getAll(anahtarlar);
  if (anahtarlar.some((a) => typeof parcalar[a] !== "string")) return null;
  return anahtarlar.map((a) => parcalar[a]).join("");
}

function onbellegeYaz(onbellek, json) {
  const parcalar = {};
  let adet = 0;
  let bas = 0;
  while (bas < json.length) {
    let son = Math.min(bas + ONBELLEK_PARCA, json.length);
    // Emoji gibi iki parçalı karakterler ortadan bölünmesin.
    const kod = json.charCodeAt(son - 1);
    if (son < json.length && kod >= 0xd800 && kod <= 0xdbff) son--;
    parcalar[`${ONBELLEK_ANAHTARI}-${adet++}`] = json.slice(bas, son);
    bas = son;
  }
  onbellek.putAll(parcalar, ONBELLEK_SURESI);
  onbellek.put(ONBELLEK_ANAHTARI, String(adet), ONBELLEK_SURESI);
}

function doGet() {
  const onbellek = CacheService.getScriptCache();
  let json = onbellektenOku(onbellek);
  if (!json) {
    json = JSON.stringify(yayinVerisi());
    onbellegeYaz(onbellek, json);
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
  if (!TARIH_BICIMI.test(k.tarih)) uyarilar.push("Tarih boş veya geçersiz");
  else if (k.tarih < baslangic || k.tarih > bitis) uyarilar.push("Tarih dönem dışında (sitede görünmez)");
  else if (k.tarih > bugun) uyarilar.push("İleri tarihli etkinlik");
  if (k.bitisTarihi) {
    if (!TARIH_BICIMI.test(k.bitisTarihi)) uyarilar.push("Bitiş tarihi geçersiz");
    else if (k.bitisTarihi < k.tarih) uyarilar.push("Bitiş tarihi başlangıçtan önce (sitede tek gün görünür)");
    else if (k.bitisTarihi < baslangic || k.bitisTarihi > bitis) uyarilar.push("Bitiş tarihi dönem dışında");
  }
  const toplam = k.kizSayisi + k.erkekSayisi;
  if (toplam === 0) uyarilar.push("Öğrenci sayısı 0");
  else if (toplam > 200) uyarilar.push(`Öğrenci sayısı çok yüksek (${toplam})`);
  if (baglantiVarMi(k.aciklama)) uyarilar.push("Açıklamada bağlantı var");
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
  const bugun = bugunTarihi();
  const maraton = maratonAcikMi() ? maratonDurumu(onayli, bugun) : null;
  satirlar.push(["Onay bekleyen kayıt", bekleyen]);
  const ekipKayitlari = maraton ? ekipKayitlariniOku() : [];
  if (maraton) {
    satirlar.push(["Onay bekleyen maraton ekip kaydı", ekipKayitlari.filter((k) => !k.onay).length]);
    satirlar.push(["Onay bekleyen maraton yazısı", maraton.yazilar.filter((y) => !y.onay).length]);
  }

  bolum("Kontrol edilecekler (onaysızlar dahil) — onaydan önce bakın");
  const kontrolSatirlari = tumu
    .map((k) => ({ k, uyarilar: kayitUyarilari(k, bugun) }))
    .filter((x) => x.uyarilar.length)
    .map(({ k, uyarilar }) => [k.satirNo, k.onay ? "Onaylı" : "Bekliyor", k.ilce, k.okulAdi, k.etkinlikAdi, uyarilar.join(" · ")]);
  tablo(["Yanıtlar satırı", "Durum", "İlçe", "Okul", "Etkinlik", "Uyarı"], kontrolSatirlari);

  if (maraton) {
    // Aktarılmamış (onay bekleyen) ekip kayıtlarının HEPSİ listelenir.
    bolum(`${AYARLAR.maraton.ad} — onay bekleyen ekip kayıtları (onaylanınca "${MARATON_SAYFASI}" sayfasına aktarılır)`);
    tablo(["Yanıtlar satırı", "İlçe", "Okul", "Öğretmen", "Proje", "Tema", "Kız", "Erkek", "Uyarı"],
      ekipKayitlari.filter((k) => !k.kod).map((k) => [k.satirNo, k.ilce, k.okulAdi, k.tamAd, k.projeAdi, k.tema,
        k.kizSayisi, k.erkekSayisi, ekipKaydiUyarilari(k, maraton.ekipler).join(" · ")]));

    // Onaysız maraton yazılarının HEPSİ listelenir (her biri yönetici onayı bekler).
    bolum(`${AYARLAR.maraton.ad} — kontrol edilecek yazılar (onay bekleyenler ve uyarılı olanlar)`);
    tablo(["Yanıtlar satırı", "Durum", "Ekip", "Tarih", "Yazı", "Uyarı"],
      maraton.yazilar
        .filter((y) => !y.onay || y.engeller.length || y.uyarilar.length)
        .map((y) => [y.satirNo, y.yayinlanir ? "Yayında" : y.onay ? "Onaylı ama yayımlanmıyor" : "Bekliyor",
          y.ekipSecimi, y.tarih, y.metin, y.engeller.concat(y.uyarilar).join(" · ")]));
  }

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

  if (maraton) {
    bolum(`${AYARLAR.maraton.ad} — ekipler ("${MARATON_SAYFASI}" sayfasından)`);
    const haritadakiler = maraton.ekipler.filter((m) => m.yayinlanir);
    const ogretmenler = new Set(haritadakiler.map((m) => `${m.okulAnahtari}|${sadelestir(m.tamAd)}`));
    const okullar = new Set(haritadakiler.map((m) => m.okulAnahtari));
    const kiz = haritadakiler.reduce((t, m) => t + m.kizSayisi, 0);
    const erkek = haritadakiler.reduce((t, m) => t + m.erkekSayisi, 0);
    const s = (n) => n.toLocaleString("tr-TR");
    satirlar.push([`Haritada ${s(haritadakiler.length)} ekip: ${s(okullar.size)} okulda ${s(ogretmenler.size)} öğretmen, ` +
      `${s(kiz)} kız ve ${s(erkek)} erkek, toplam ${s(kiz + erkek)} öğrenci; ` +
      `${s(maraton.yazilar.filter((y) => y.yayinlanir).length)} yayımlanmış yazı.`]);
    const yaziSayisi = {};
    maraton.yazilar.forEach((y) => {
      const n = yaziSayisi[y.kod] || { yayinda: 0, bekleyen: 0 };
      if (y.yayinlanir) n.yayinda++;
      if (!y.onay) n.bekleyen++;
      yaziSayisi[y.kod] = n;
    });
    const temalar = AYARLAR.maraton.temalar || [];
    tablo(["Maraton satırı", "Ekip kodu", "İlçe", "Okul adı (haritada)", "Proje", "Tema", "Kız", "Erkek", "Haritada",
      "Yayımlanan yazı", "Bekleyen yazı", "Uyarı"],
      maraton.ekipler.map((m) => {
        const n = (m.kod && yaziSayisi[m.kod]) || { yayinda: 0, bekleyen: 0 };
        const uyarilar = m.sorunlar.slice();
        if (!m.yayinda) uyarilar.push("\"Yayında\" işaretli değil");
        if (temalar.length && !temalar.includes(m.tema)) uyarilar.push("Tema boş veya listede yok");
        if (m.kizSayisi + m.erkekSayisi === 0) uyarilar.push("Öğrenci sayısı 0");
        return [m.satirNo, m.kod, m.ilce, m.okulAdi, m.projeAdi, m.tema, m.kizSayisi, m.erkekSayisi,
          m.yayinlanir ? "Evet" : "Hayır", n.yayinda, n.bekleyen, uyarilar.join(" · ")];
      }));
    satirlar.push(["Not: Maraton ekipleri ve yazıları yukarıdaki il geneli etkinlik sayılarına KATILMAZ. Ekip bilgilerini (öğrenci sayısı, proje adı…) bu sayfada düzeltin; ekibi haritadan kaldırmak için \"Yayında\" kutusunu kaldırın. Yazıyı düzeltmek için Yanıtlar sayfasındaki hücreyi değiştirin; yayından kaldırmak için Onay kutusunu kaldırın."]);
  }

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

// Yeni form yanıtı (etkinlik veya maraton yazısı): Onay kutusunu (işaretsiz)
// ekler, özeti yeniler.
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

// Yanıtlar / Etiketler / Maraton sayfalarında hücre düzeltme veya onay: siteye
// giden veri hemen yenilensin. (Satır silme bunu tetiklemez; bkz. degisti.)
function duzenlendi(e) {
  if (!e) return;
  const sayfaAdi = e.range.getSheet().getName();
  const izlenenler = [YANIT_SAYFASI, ETIKET_SAYFASI, MARATON_SAYFASI];
  if (!izlenenler.includes(sayfaAdi)) return;
  onbellegiTemizle();
  if (maratonAcikMi() && (sayfaAdi === MARATON_SAYFASI || sayfaAdi === YANIT_SAYFASI)) {
    try {
      // Yanıtlar'da onaylanan ekip kaydı Maraton'a aktarılır; Maraton'da elle
      // eklenen satır kod alır. İkisinde de formdaki ekip listesi yenilenir.
      const aktarildi = sayfaAdi === YANIT_SAYFASI && ekipKayitlariniAktar();
      if (sayfaAdi === MARATON_SAYFASI) ekipKodlariniVer();
      if (aktarildi || sayfaAdi === MARATON_SAYFASI) maratonFormListesiniGuncelle();
    } catch (hata) {
      Logger.log("Uyarı: maraton ekipleri güncellenemedi: " + hata);
    }
  }
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
  const menu = SpreadsheetApp.getUi()
    .createMenu("STEM Harita")
    .addItem("Özeti şimdi yenile", "ozetiYenile")
    .addItem("Site verisini hemen yenile", "onbellegiTemizle");
  if (maratonAcikMi()) {
    menu.addSeparator()
      .addItem("Maraton: onaylı ekip kayıtlarını aktar, ekip listesini güncelle", "maratonEkipleriniGuncelle");
  }
  menu.addToUi();
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
    "tek kayıtta işaretleyebilirsiniz. Kaydınız incelendikten sonra haritada görünür." +
    (maratonAcikMi()
      ? ` ${AYARLAR.maraton.ad} öğretmenleri ekiplerini ("${TUR_KAYIT}") ve çalışmalarını ("${TUR_YAZI}") da bu formdan, ilk sorudaki seçenekle ekleyebilir.`
      : "");
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

  // Maraton açıksa ilk sayfada yalnızca tür sorusu durur; etkinlik soruları
  // ikinci sayfadan başlar.
  const turSorusu = maratonAcikMi() ? form.addMultipleChoiceItem().setTitle(SORU.tur).setRequired(true) : null;
  const etkinlikSayfasi = turSorusu ? form.addPageBreakItem().setTitle("Etkinlik bilgileri") : null;

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
  rizaKutulariEkle(form, SORU.aydinlatma, SORU.riza);
  if (turSorusu) maratonBolumunuEkle(form, turSorusu, etkinlikSayfasi);
  return form;
}

// Aydınlatma metninden sonraki iki zorunlu kutu (etkinlik ve maraton bölümünde).
function rizaKutulariEkle(form, aydinlatmaBasligi, rizaBasligi) {
  form.addCheckboxItem().setTitle(aydinlatmaBasligi)
    .setChoiceValues(["Aydınlatma metnini okudum ve anladım."])
    .setRequired(true);
  form.addCheckboxItem().setTitle(rizaBasligi)
    .setChoiceValues(["Yukarıdaki bilgilerimin aydınlatma metninde belirtilen amaçla işlenmesine, sitede yayımlanmasına ve yurt dışındaki sunucularda saklanmasına açık rıza veriyorum."])
    .setRequired(true);
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
  if (maratonAcikMi()) maratonEkipleriniGuncelle();
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
  if (maratonAcikMi()) maratonFormListesiniGuncelle();
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
//   - AYARLAR.maraton varsa: başa "Ne eklemek istiyorsunuz?" sorusu, sona
//     Proje Maratonu sayfası eklenir, "Maraton" sayfası kurulur,
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

  if (maratonAcikMi() && !ogeBul(form, SORU.tur, T.MULTIPLE_CHOICE)) {
    const tur = form.addMultipleChoiceItem().setTitle(SORU.tur).setRequired(true);
    form.moveItem(tur.getIndex(), 0);
    const etkinlikSayfasi = form.addPageBreakItem().setTitle("Etkinlik bilgileri");
    form.moveItem(etkinlikSayfasi.getIndex(), 1);
    maratonBolumunuEkle(form, tur, etkinlikSayfasi);
    yapilan.push("Proje Maratonu bölümü");
  }
  if (maratonAcikMi()) {
    if (!SpreadsheetApp.getActive().getSheetByName(MARATON_SAYFASI)) yapilan.push(`"${MARATON_SAYFASI}" sayfası`);
    maratonEkipleriniGuncelle();
  }

  tetikleyicileriKur();
  onbellegiTemizle();
  ozetiYenile();
  Logger.log("Form güncellendi: " + (yapilan.length ? yapilan.join(", ") : "soru değişikliği gerekmedi (daha önce yapılmış)") + ".");
  Logger.log(`Yanıtların yedeği "Yedek yanıtlar ${tarih}" sayfasında. Kontrol ettikten sonra bu sayfayı silin.`);
}

// ---------------------------------------------------------------------------
// Proje Maratonu: form bölümü ve "Maraton" sayfası (isteğe bağlı)
//
// AYARLAR.maraton varsa kurulum() / formuGuncelle() bunları kendiliğinden
// kurar. Yönetici ekipleri "Maraton" sayfasına girer; ekip kodu kendiliğinden
// verilir, "Yayında" işaretli ekipler formdaki ekip listesine girer.

// "Maraton" sayfasını kurar (yoksa) ve doğrulamalarını yeniler (tema listesi
// Ayarlar.gs'te değişmiş olabilir). Sayfa yeni kurulduysa true döndürür.
function maratonSayfasiKur() {
  const ss = SpreadsheetApp.getActive();
  let sayfa = ss.getSheetByName(MARATON_SAYFASI);
  const yeni = !sayfa;
  if (yeni) {
    sayfa = ss.insertSheet(MARATON_SAYFASI);
    sayfa.getRange(1, 1, 1, MARATON_BASLIKLARI.length).setValues([MARATON_BASLIKLARI])
      .setFontWeight("bold").setBackground("#fff2cc");
    const not = (sutun, metin) => sayfa.getRange(1, sutun).setNote(metin);
    not(1, "Kendiliğinden verilir (M01, M02…). DEĞİŞTİRMEYİN: öğretmenlerin yazıları koda bağlıdır.");
    not(2, "Tam ad; sitede kısaltılmış görünür (ör. Ayşe Y.). Bir öğretmenin birden çok ekibi varsa her ekip ayrı satırdır.");
    not(4, "Okulun tam resmî adı (etkinlik kayıtlarındaki gibi).");
    not(9, "İşaretli ekip haritada görünür ve formdaki ekip listesine girer. Öğretmeni bilgilendirdikten sonra işaretleyin.");
    sayfa.setFrozenRows(1);
    sayfa.setColumnWidth(2, 200);
    sayfa.setColumnWidth(4, 280);
    sayfa.setColumnWidth(5, 240);
    sayfa.setColumnWidth(6, 260);
  }
  const satir = sayfa.getMaxRows() - 1;
  const liste = (degerListesi) => SpreadsheetApp.newDataValidation()
    .requireValueInList(degerListesi, true).setAllowInvalid(false).build();
  sayfa.getRange(2, 3, satir, 1).setDataValidation(liste(AYARLAR.ilceler));
  const temalar = AYARLAR.maraton.temalar || [];
  sayfa.getRange(2, 6, satir, 1).setDataValidation(temalar.length ? liste(temalar) : null);
  sayfa.getRange(2, 7, satir, 2).setDataValidation(SpreadsheetApp.newDataValidation()
    .requireNumberBetween(0, 999).setHelpText("0 ile 999 arasında bir tam sayı").setAllowInvalid(false).build());
  // Boş hücreye de işaretsiz kutu çizilir; değer yazılmadığı için son satır büyümez.
  sayfa.getRange(2, 9, satir, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build());
  return yeni;
}

// Ekip kodları M01, M02… biçimindedir; yeni kod en büyüğün bir fazlasıdır.
function ekipKodu(no) {
  return `M${String(no).padStart(2, "0")}`;
}

function maratonSatirlari(sayfa) {
  return sayfa.getLastRow() < 2 ? []
    : sayfa.getRange(2, 1, sayfa.getLastRow() - 1, MARATON_BASLIKLARI.length).getValues();
}

function enBuyukEkipNo(veri) {
  return veri.reduce((enBuyuk, r) => {
    const eslesme = /^M(\d+)$/.exec(temizle(r[0]));
    return eslesme ? Math.max(enBuyuk, Number(eslesme[1])) : enBuyuk;
  }, 0);
}

// Aynı anda iki tetikleyici aynı kodu vermesin diye kodu veren işlemler kilitle çalışır.
function kilitle(islem) {
  const kilit = LockService.getScriptLock();
  kilit.waitLock(30000);
  try {
    return islem();
  } finally {
    kilit.releaseLock();
  }
}

// Maraton sayfasına elle girilip kodu boş kalan satırlara sıradaki kodu yazar.
function ekipKodlariniVer() {
  kilitle(() => {
    const sayfa = SpreadsheetApp.getActive().getSheetByName(MARATON_SAYFASI);
    if (!sayfa) return;
    const veri = maratonSatirlari(sayfa);
    let enBuyuk = enBuyukEkipNo(veri);
    veri.forEach((r, i) => {
      const bilgiVar = r.slice(1, 6).some((h) => temizle(h));   // ad, ilçe, okul, proje, tema
      if (!temizle(r[0]) && bilgiVar) sayfa.getRange(i + 2, 1).setValue(ekipKodu(++enBuyuk));
    });
  });
}

// Yanıtlar'daki "Ekip kodu" sütununu (yoksa) ekler; sütun numarasını döndürür.
function kayitKoduSutunu(sayfa) {
  const basliklar = sayfa.getRange(1, 1, 1, sayfa.getLastColumn()).getValues()[0].map(temizle);
  const mevcut = basliklar.indexOf(KAYIT_KODU_SUTUNU) + 1;
  if (mevcut > 0) return mevcut;
  const sutun = sayfa.getLastColumn() + 1;
  sayfa.getRange(1, sutun).setValue(KAYIT_KODU_SUTUNU).setFontWeight("bold").setBackground("#fff2cc")
    .setNote(`Onaylanan ekip kaydının "${MARATON_SAYFASI}" sayfasındaki kodu. Betik yazar; DEĞİŞTİRMEYİN.`);
  return sutun;
}

// Onaylanmış ama henüz aktarılmamış ekip kayıtlarını "Maraton" sayfasına
// "Yayında" olarak ekler ve verilen kodu Yanıtlar'daki "Ekip kodu" hücresine
// yazar (böylece ikinci kez aktarılmaz). Aktarılan varsa true döndürür.
// Sonraki düzeltmeler Maraton sayfasında yapılır; onayı kaldırmak ekibi silmez.
function ekipKayitlariniAktar() {
  return kilitle(() => {
    const bekleyen = ekipKayitlariniOku().filter((k) => k.onay && !k.kod);
    if (!bekleyen.length) return false;
    const ss = SpreadsheetApp.getActive();
    if (!ss.getSheetByName(MARATON_SAYFASI)) maratonSayfasiKur();
    const maraton = ss.getSheetByName(MARATON_SAYFASI);
    const yanitlar = yanitSayfasi();
    const kodSutunu = kayitKoduSutunu(yanitlar);
    const veri = maratonSatirlari(maraton);
    let enBuyuk = enBuyukEkipNo(veri);
    // Son dolu satırdan sonrasına yazılır (Yayında sütununun boş kutuları sayılmaz).
    let satir = veri.reduce((son, r, i) => (r.slice(0, 8).some((h) => temizle(h)) ? i + 2 : son), 1);
    bekleyen.forEach((k) => {
      const kod = ekipKodu(++enBuyuk);
      maraton.getRange(++satir, 1, 1, MARATON_BASLIKLARI.length).setValues([[kod, k.tamAd, k.ilce, k.okulAdi,
        k.projeAdi, k.tema, k.kizSayisi, k.erkekSayisi, true]]);
      yanitlar.getRange(k.satirNo, kodSutunu).setValue(kod);
    });
    SpreadsheetApp.flush();
    Logger.log(`${bekleyen.length} ekip kaydı "${MARATON_SAYFASI}" sayfasına aktarıldı.`);
    return true;
  });
}

// Formdaki "Ekibiniz" listesini, haritada görünen ekiplerden yeniler.
function maratonFormListesiniGuncelle() {
  const formId = PropertiesService.getScriptProperties().getProperty("FORM_ID");
  if (!formId) return;
  const oge = ogeBul(FormApp.openById(formId), MARATON_SORU.ekip, FormApp.ItemType.LIST);
  if (!oge) {
    Logger.log(`Uyarı: formda "${MARATON_SORU.ekip}" sorusu bulunamadı. formuGuncelle() çalıştırılmalı.`);
    return;
  }
  const ekipler = maratonEkipleriOku([]);
  ekipleriHazirla(ekipler);
  const secenekler = ekipler
    .filter((m) => m.yayinlanir)
    .sort((a, b) => a.kod.localeCompare(b.kod, "tr"))
    .map((m) => `${m.kod}${EKIP_AYRACI}${m.projeAdi} — ${m.yazilan}`);
  oge.asListItem().setChoiceValues(secenekler.length ? secenekler : [EKIP_YOK]);
}

// Menüden ve kurulumdan: sayfayı kurar, onaylı kayıtları aktarır, kodları
// verir, formdaki ekip listesini yeniler.
function maratonEkipleriniGuncelle() {
  maratonSayfasiKur();
  ekipKayitlariniAktar();
  ekipKodlariniVer();
  maratonFormListesiniGuncelle();
  onbellegiTemizle();
  ozetiYenile();
}

function maratonAydinlatmaMetni() {
  const m = AYARLAR.maraton;
  return [
    `Veri sorumlusu: ${AYARLAR.veriSorumlusu}`,
    "",
    `Bu bölüm, ${m.ad} ekiplerinin çalışmalarını ${AYARLAR.il} STEM Etkinlik Haritası'nda tanıtmak amacıyla hazırlanmıştır.`,
    "",
    "İşlenen veriler: Adınız ve soyadınız; okulunuzun adı ve ilçesi; ekip bilgileri (proje adı, tema, ekipteki kız ve erkek öğrenci sayısı); çalışma yazılarınız ve tarihleri. Öğrencilere ait ad, fotoğraf veya kimliği belirleyici hiçbir bilgi toplanmaz. E-posta adresiniz toplanmaz.",
    "",
    `Yayımlanan bilgiler: Ekip kaydınız ve yazılarınız incelenip onaylandıktan sonra ${AYARLAR.siteAdresi} adresinde ekibinizin kartında herkese açık olarak yayımlanır: proje adı, tema, okul adı, ilçe, kız ve erkek öğrenci sayısı, kısaltılmış adınız (ör. "Ayşe Y.") ve tarihleriyle birlikte çalışma yazılarınız. Soyadınızın tamamı yayımlanmaz. Haritadaki konumlar temsilîdir; okulun gerçek konumunu göstermez.`,
    "",
    "Amaç ve hukuki sebep: Proje çalışmalarının tanıtılması; açık rızanız (6698 sayılı KVKK m.5/1).",
    "",
    "Saklama yeri: Veriler Google Forms / Google E-Tablolar hizmetlerinde saklanır. Site GitHub Pages üzerinde yayımlanır. Veriler başka hiçbir kişi veya kurumla paylaşılmaz.",
    "",
    `Saklama süresi: Form yanıtları ${AYARLAR.saklamaTarihi} tarihinde silinir. Sitede yayımlanmış bilgiler bu tarihten sonra arşiv olarak yayında kalabilir.`,
    "",
    `Haklarınız: KVKK m.11 kapsamındaki haklarınızı (bilgi talep etme, düzeltme, silme vb.) kullanmak ve bir yazının yayından kaldırılmasını istemek için ${AYARLAR.iletisim} adresine yazabilirsiniz.`
  ].join("\n");
}

// Formun SONUNA iki maraton sayfasını (ekip kaydı, çalışma yazısı) ekler ve
// ilk sorudaki dallanmayı kurar.
function maratonBolumunuEkle(form, turSorusu, etkinlikSayfasi) {
  const ad = AYARLAR.maraton.ad;
  const sayiDogrulama = () => FormApp.createTextValidation()
    .setHelpText("Lütfen 0 ile 999 arasında bir tam sayı yazınız.")
    .requireTextMatchesPattern("^[0-9]{1,3}$")
    .build();

  // setGoToPage, sayfa sonundan ÖNCEKİ sayfa için geçerlidir: o sayfa bitince
  // form gönderilir, sonraki maraton sayfasına geçilmez.
  const kayitSayfasi = form.addPageBreakItem().setTitle(`${ad} — ekip kaydı`)
    .setHelpText("Bu sayfayı her ekip için YALNIZCA BİR KEZ doldurunuz; iki ekibiniz varsa her ekip için ayrı kayıt yapınız. " +
      "Kaydınız onaylanınca ekibiniz haritada görünür ve \"" + TUR_YAZI + "\" bölümündeki ekip listesine eklenir. " +
      `Bilgilerde sonradan değişiklik olursa ${AYARLAR.iletisim} adresine yazınız.`);
  kayitSayfasi.setGoToPage(FormApp.PageNavigationType.SUBMIT);
  form.addListItem().setTitle(KAYIT_SORU.ilce).setChoiceValues(AYARLAR.ilceler).setRequired(true);
  form.addTextItem().setTitle(KAYIT_SORU.okul)
    .setHelpText("Okulunuzun tam resmî adını kısaltma kullanmadan yazınız. Örnek: Şehit Ahmet Yılmaz İlkokulu")
    .setRequired(true);
  form.addTextItem().setTitle(KAYIT_SORU.ad)
    .setHelpText("Sitede adınız kısaltılmış olarak görünür (ör. Ayşe Y.).")
    .setRequired(true);
  form.addTextItem().setTitle(KAYIT_SORU.proje).setRequired(true)
    .setValidation(FormApp.createTextValidation()
      .setHelpText("En fazla 100 karakter.")
      .requireTextLengthLessThanOrEqualTo(100).build());
  const temalar = AYARLAR.maraton.temalar || [];
  if (temalar.length) form.addListItem().setTitle(KAYIT_SORU.tema).setChoiceValues(temalar).setRequired(true);
  else form.addTextItem().setTitle(KAYIT_SORU.tema).setRequired(true);
  form.addTextItem().setTitle(KAYIT_SORU.kiz).setRequired(true).setValidation(sayiDogrulama());
  form.addTextItem().setTitle(KAYIT_SORU.erkek).setRequired(true).setValidation(sayiDogrulama());
  form.addSectionHeaderItem()
    .setTitle("Kişisel verilerin işlenmesine ilişkin aydınlatma metni")
    .setHelpText(maratonAydinlatmaMetni());
  rizaKutulariEkle(form, KAYIT_SORU.aydinlatma, KAYIT_SORU.riza);

  const yaziSayfasi = form.addPageBreakItem().setTitle(`${ad} — çalışma yazısı`)
    .setHelpText("Ekibinizle yaptığınız bir çalışmayı 2-3 cümleyle anlatınız. Her çalışma için ayrı gönderim yapınız; " +
      "istediğiniz zaman, istediğiniz sıklıkla ekleyebilirsiniz. Yazınız incelendikten sonra ekibinizin kartında görünür.");
  yaziSayfasi.setGoToPage(FormApp.PageNavigationType.SUBMIT);
  form.addListItem().setTitle(MARATON_SORU.ekip)
    .setHelpText("Birden fazla ekibiniz varsa bu yazının ait olduğu ekibi seçiniz. Ekibiniz listede yoksa önce \"" +
      TUR_KAYIT + "\" yapınız; kaydınız onaylanınca listeye eklenir.")
    .setChoiceValues([EKIP_YOK]).setRequired(true);
  form.addTextItem().setTitle(MARATON_SORU.ad)
    .setHelpText("Sitede adınız kısaltılmış olarak görünür (ör. Ayşe Y.).")
    .setRequired(true);
  form.addDateItem().setTitle(MARATON_SORU.tarih).setRequired(true);
  form.addParagraphTextItem().setTitle(MARATON_SORU.metin)
    .setHelpText(`En fazla ${GUNLUK_SINIRI} karakter. Öğrenci adı yazmayınız. Fotoğraf veya bağlantı eklemeyiniz.`)
    .setRequired(true)
    .setValidation(FormApp.createParagraphTextValidation()
      .setHelpText(`En fazla ${GUNLUK_SINIRI} karakter.`)
      .requireTextLengthLessThanOrEqualTo(GUNLUK_SINIRI).build());
  form.addSectionHeaderItem()
    .setTitle("Kişisel verilerin işlenmesine ilişkin aydınlatma metni")
    .setHelpText(maratonAydinlatmaMetni());
  rizaKutulariEkle(form, MARATON_SORU.aydinlatma, MARATON_SORU.riza);

  turSorusu.setChoices([
    turSorusu.createChoice(TUR_ETKINLIK, etkinlikSayfasi),
    turSorusu.createChoice(TUR_KAYIT, kayitSayfasi),
    turSorusu.createChoice(TUR_YAZI, yaziSayfasi)
  ]);
}
