// STEM Etkinlik Haritası — Google Sheets tarafı.
//
// Bu betik Sheets dosyasına Uzantılar → Apps Script ile eklenir. İle özgü
// değerler Ayarlar.gs dosyasındadır (AYARLAR nesnesi).
//
// Görevleri:
//   kurulum()        Bir kez çalıştırılır: formu oluşturur, Sheets'e bağlar,
//                    Onay sütununu ve Özet sayfasını ekler, tetikleyicileri kurar.
//   doGet()          Web uygulaması: siteye YALNIZCA onaylı kayıtların izin
//                    verilen alanlarını JSON olarak verir.
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
  izin: "Ad yayım izni",
  etkinlik: "Etkinlik adı",
  kapsam: "Etkinlik hangi program kapsamında yapıldı?",
  icerik: "Etkinlikte ne yapıldı?",
  sinif: "Sınıf",
  sube: "Şube",
  tarih: "Etkinlik tarihi",
  kiz: "Katılan kız öğrenci sayısı",
  erkek: "Katılan erkek öğrenci sayısı",
  aciklama: "Kısa açıklama",
  aydinlatma: "Aydınlatma metni",
  riza: "Açık rıza"
};
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
  diger: "Diğer program"
};
const ICERIK = {
  kodlama: "Kodlama ve Algoritma",
  robotik: "Robotik ve Elektronik",
  tasarim: "Tasarım ve Üretim",
  fen: "Fen Deneyi ve Gözlem",
  yapayzeka: "Yapay Zekâ ve Veri",
  unplugged: "Bilgisayarsız Etkinlik",
  diger: "Diğer"
};
const SINIF_DUZEYI = {
  okuloncesi: "Okul Öncesi",
  "1-4": "İlkokul (1-4)",
  "5-8": "Ortaokul (5-8)",
  "9-12": "Lise (9-12)",
  karma: "Karma"
};
const SINIFLAR = ["Anasınıfı"]
  .concat(Array.from({ length: 12 }, (_, i) => `${i + 1}. sınıf`))
  .concat(["Kulüp / karma grup"]);
const KULUP = "Kulüp / karma grup";
const SUBE_YOK = "Yok (kulüp / karma grup)";
const SUBELER = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "İ", "J", "K", "L",
  "M", "N", "O", "P", "R", "S", "T", "U", "V", "Y", "Z", SUBE_YOK];

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

function tersSozluk(sozluk) {
  const ters = {};
  Object.keys(sozluk).forEach((kod) => { ters[sozluk[kod]] = kod; });
  return ters;
}

// "Anasınıfı" → okuloncesi, "3. sınıf" → 1-4, "Kulüp / karma grup" → karma
function sinifDuzeyiBul(sinif) {
  if (sinif === "Anasınıfı") return "okuloncesi";
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
    .filter((satir) => tarihMi(satir[0]))
    .map((satir) => {
      const nesne = { zaman: satir[0] };
      basliklar.forEach((b, i) => { if (i > 0) nesne[b] = satir[i]; });
      return nesne;
    });
}

// Bir yanıt satırından iç kullanım kaydı üretir (tam ad dahil; DIŞARI VERİLMEZ).
function kayitOlustur(satir, saatDilimi) {
  const kapsamKodu = tersSozluk(KAPSAM)[temizle(satir[SORU.kapsam])] || "diger";
  const icerikKodu = tersSozluk(ICERIK)[temizle(satir[SORU.icerik])] || "diger";
  const sinif = temizle(satir[SORU.sinif]);
  const sube = temizle(satir[SORU.sube]);
  const okulAdi = temizle(satir[SORU.okul]);
  const ilce = temizle(satir[SORU.ilce]);
  const tamAd = temizle(satir[SORU.ad]);
  const tarihHam = satir[SORU.tarih];
  const tarih = tarihMi(tarihHam)
    ? Utilities.formatDate(tarihHam, saatDilimi, "yyyy-MM-dd")
    : temizle(tarihHam);

  const okulAnahtari = `${sadelestir(okulAdi)}|${ilce}`;
  const ogretmenAnahtari = `${okulAnahtari}|${sadelestir(tamAd)}`;
  const kulupMu = sinif === KULUP || sube === SUBE_YOK;
  const grupAnahtari = kulupMu
    ? `${okulAnahtari}|kulüp|${sadelestir(tamAd)}`
    : `${okulAnahtari}|${sinif}|${sube}`;

  return {
    id: `${AYARLAR.idOnEki}-${satir.zaman.getTime()}`,
    onay: satir[ONAY_SUTUNU] === true,
    okulAdi,
    ilce,
    etkinlikAdi: temizle(satir[SORU.etkinlik]),
    kapsam: kapsamKodu,
    icerik: icerikKodu,
    sinifDuzeyi: sinifDuzeyiBul(sinif),
    tarih,
    kizSayisi: sayiyaCevir(satir[SORU.kiz]),
    erkekSayisi: sayiyaCevir(satir[SORU.erkek]),
    aciklama: temizle(satir[SORU.aciklama]),
    ogretmenAdi: temizle(satir[SORU.izin]) ? adiKisalt(tamAd) : "",
    // Yalnızca Özet sayfası için:
    okulAnahtari,
    ogretmenAnahtari,
    grupAnahtari
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
    kizSayisi: k.kizSayisi,
    erkekSayisi: k.erkekSayisi,
    aciklama: k.aciklama,
    ogretmenAdi: k.ogretmenAdi,
    onay: true
  };
}

function yayinVerisi() {
  return kayitlariOku().filter((k) => k.onay).map(yayinKaydi);
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
function istatistik(kayitlar) {
  const okullar = new Set();
  const ogretmenler = new Set();
  const gruplar = {};
  kayitlar.forEach((k) => {
    okullar.add(k.okulAnahtari);
    ogretmenler.add(k.ogretmenAnahtari);
    const g = gruplar[k.grupAnahtari] || { kiz: 0, erkek: 0 };
    g.kiz = Math.max(g.kiz, k.kizSayisi);
    g.erkek = Math.max(g.erkek, k.erkekSayisi);
    gruplar[k.grupAnahtari] = g;
  });
  let kiz = 0;
  let erkek = 0;
  Object.keys(gruplar).forEach((a) => { kiz += gruplar[a].kiz; erkek += gruplar[a].erkek; });
  return { etkinlik: kayitlar.length, okul: okullar.size, ogretmen: ogretmenler.size, kiz, erkek, ogrenci: kiz + erkek };
}

function ozetCumlesi(o) {
  const s = (n) => n.toLocaleString("tr-TR");
  return `${s(o.etkinlik)} etkinlik, ${s(o.okul)} okulda ${s(o.ogretmen)} öğretmen tarafından ` +
    `${s(o.kiz)} kız ve ${s(o.erkek)} erkek, toplam ${s(o.ogrenci)} farklı öğrenciyle gerçekleştirildi.`;
}

// Kayıtları bir alana göre gruplayıp her grup için istatistik satırı üretir.
function kirilim(kayitlar, alan, etiketler) {
  const gruplar = {};
  kayitlar.forEach((k) => { (gruplar[k[alan]] = gruplar[k[alan]] || []).push(k); });
  const anahtarlar = etiketler ? Object.keys(etiketler) : Object.keys(gruplar).sort((a, b) => a.localeCompare(b, "tr"));
  return anahtarlar
    .filter((a) => gruplar[a])
    .map((a) => {
      const o = istatistik(gruplar[a]);
      return [etiketler ? etiketler[a] : a, o.etkinlik, o.okul, o.ogretmen, o.kiz, o.erkek, o.ogrenci];
    });
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

  bolum("İl geneli (yalnızca onaylı kayıtlar)");
  satirlar.push([onayli.length ? ozetCumlesi(istatistik(onayli)) : "Henüz onaylı kayıt yok."]);

  const sutunlar = (ilk) => [ilk, "Etkinlik", "Okul", "Öğretmen", "Kız", "Erkek", "Farklı öğrenci"];
  bolum("İlçelere göre");
  tablo(sutunlar("İlçe"), kirilim(onayli, "ilce"));
  bolum("Kapsama göre");
  tablo(sutunlar("Kapsam"), kirilim(onayli, "kapsam", KAPSAM));
  bolum("İçerik türüne göre");
  tablo(sutunlar("İçerik türü"), kirilim(onayli, "icerik", ICERIK));
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

// Yanıtlar sayfasında düzeltme veya onay: siteye giden veri hemen yenilensin.
function duzenlendi(e) {
  if (!e || e.range.getSheet().getName() !== YANIT_SAYFASI) return;
  onbellegiTemizle();
  ozetiYenile();
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

function aydinlatmaMetni() {
  return [
    `Veri sorumlusu: ${AYARLAR.veriSorumlusu} — ${AYARLAR.iletisim}`,
    "",
    `Bu form, ${AYARLAR.il} ilinde öğretmenlerin düzenlediği STEM etkinliklerini gönüllülük esasıyla bir harita üzerinde tanıtmak amacıyla hazırlanmıştır. Proje kişisel bir girişimdir; herhangi bir kurumun resmî çalışması değildir.`,
    "",
    "İşlenen veriler: Adınız ve soyadınız; okulunuzun adı ve ilçesi; etkinlik bilgileri (ad, tarih, kapsam, içerik, sınıf ve şube, katılan kız ve erkek öğrenci sayısı, açıklama). Öğrencilere ait ad, fotoğraf veya kimliği belirleyici hiçbir bilgi toplanmaz. E-posta adresiniz toplanmaz.",
    "",
    `Yayımlanan bilgiler: Kaydınız incelenip onaylandıktan sonra şu bilgiler ${AYARLAR.siteAdresi} adresinde herkese açık olarak yayımlanır: etkinlik adı, okul adı, ilçe, tarih, kapsam, içerik, sınıf düzeyi, öğrenci sayıları ve açıklama. Adınız yalnızca izin verirseniz ve kısaltılmış biçimde (ör. "Ayşe Y.") yayımlanır. Soyadınızın tamamı ve şube bilgisi yayımlanmaz. Haritadaki konumlar temsilîdir; okulun gerçek konumunu göstermez.`,
    "",
    "Amaç ve hukuki sebep: Etkinliklerin tanıtılması; açık rızanız (6698 sayılı KVKK m.5/1).",
    "",
    "Aktarım ve saklama yeri: Veriler Google Forms / Google E-Tablolar hizmetlerinde saklanır; bu hizmetlerin sunucuları yurt dışında bulunabilir. Site GitHub Pages üzerinde yayımlanır. Veriler başka hiçbir kişi veya kurumla paylaşılmaz.",
    "",
    `Saklama süresi: Form yanıtları ${AYARLAR.saklamaTarihi} tarihinde silinir. Sitede yayımlanmış bilgiler bu tarihten sonra arşiv olarak yayında kalabilir.`,
    "",
    `Haklarınız: KVKK m.11 kapsamındaki haklarınızı (bilgi talep etme, düzeltme, silme vb.) kullanmak ve kaydınızın yayından kaldırılmasını istemek için ${AYARLAR.iletisim} adresine yazabilirsiniz.`
  ].join("\n");
}

function formuOlustur() {
  const form = FormApp.create(`${AYARLAR.il} STEM Etkinlik Haritası ${AYARLAR.donem} — Etkinlik Kaydı`);
  form
    .setDescription(
      `${AYARLAR.il} ilinde düzenlediğiniz STEM etkinliğini haritaya eklemek için bu formu doldurunuz. ` +
      "Her etkinlik ve her şube için ayrı kayıt giriniz. Kaydınız incelendikten sonra haritada görünür."
    )
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
    .setHelpText("Sitede adınız yalnızca aşağıdaki kutuyu işaretlerseniz ve kısaltılmış olarak görünür (ör. Ayşe Y.).")
    .setRequired(true);
  form.addCheckboxItem().setTitle(SORU.izin)
    .setChoiceValues(["Adımın sitede kısaltılmış olarak (ör. Ayşe Y.) yayımlanmasına izin veriyorum."])
    .setRequired(false);
  form.addTextItem().setTitle(SORU.etkinlik).setRequired(true)
    .setValidation(FormApp.createTextValidation()
      .setHelpText("En fazla 100 karakter.")
      .requireTextLengthLessThanOrEqualTo(100).build());
  form.addMultipleChoiceItem().setTitle(SORU.kapsam)
    .setChoiceValues(Object.keys(KAPSAM).map((k) => KAPSAM[k])).setRequired(true);
  form.addMultipleChoiceItem().setTitle(SORU.icerik)
    .setChoiceValues(Object.keys(ICERIK).map((k) => ICERIK[k])).setRequired(true);
  form.addListItem().setTitle(SORU.sinif).setChoiceValues(SINIFLAR).setRequired(true);
  form.addListItem().setTitle(SORU.sube)
    .setHelpText("Etkinliği birden fazla şubeyle yaptıysanız her şube için ayrı kayıt giriniz. Kulüp veya karma grupsa \"" + SUBE_YOK + "\" seçiniz.")
    .setChoiceValues(SUBELER).setRequired(true);
  form.addDateItem().setTitle(SORU.tarih).setRequired(true);
  form.addTextItem().setTitle(SORU.kiz).setRequired(true).setValidation(sayiDogrulama);
  form.addTextItem().setTitle(SORU.erkek).setRequired(true).setValidation(sayiDogrulama);
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

function kurulum() {
  const ss = SpreadsheetApp.getActive();
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty("FORM_ID")) {
    throw new Error("Kurulum daha önce yapılmış. Formu yeniden oluşturmak gerekiyorsa önce yöneticiye danışın.");
  }

  const form = formuOlustur();
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  SpreadsheetApp.flush();

  // Formun bağlandığı yeni sayfayı bul ve adlandır.
  const formId = form.getId();
  const sayfa = ss.getSheets().find((s) => {
    const adres = s.getFormUrl();
    return adres && FormApp.openByUrl(adres).getId() === formId;
  });
  if (!sayfa) throw new Error("Form yanıt sayfası bulunamadı.");
  sayfa.setName(YANIT_SAYFASI);

  // Onay sütunu: form sütunlarının sağına.
  const onaySutunu = sayfa.getLastColumn() + 1;
  sayfa.getRange(1, onaySutunu).setValue(ONAY_SUTUNU).setFontWeight("bold").setBackground("#fff2cc");
  sayfa.setFrozenRows(1);

  // Boş varsayılan sayfayı kaldır.
  ss.getSheets().forEach((s) => {
    if (s.getName() !== YANIT_SAYFASI && s.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s);
  });

  ScriptApp.newTrigger("formGonderildi").forSpreadsheet(ss).onFormSubmit().create();
  ScriptApp.newTrigger("duzenlendi").forSpreadsheet(ss).onEdit().create();

  props.setProperty("FORM_ID", formId);
  props.setProperty("FORM_ADRESI", form.getPublishedUrl());
  ozetiYenile();

  Logger.log("Kurulum tamam.");
  Logger.log("Öğretmenlere gönderilecek form adresi: " + form.getPublishedUrl());
  Logger.log("Formu düzenleme adresi (yalnızca siz): " + form.getEditUrl());
}
