// ÖRNEK ayar dosyası. Apps Script projesine "Ayarlar.gs" adıyla ekleyip
// kendi ilinize göre doldurun. Gerçek dosyayı herkese açık bir depoya koymayın.
const AYARLAR = {
  il: "İl adı",
  donem: "2026-2027",
  idOnEki: "2026",
  // KVKK m.10: aydınlatmada veri sorumlusunun KİMLİĞİ yazılmalıdır.
  veriSorumlusu: "Ad Soyad (proje yürütücüsü) — iletisim@ornek.com",
  iletisim: "iletisim@ornek.com",
  siteAdresi: "https://kullaniciadi.github.io/stem-harita/",
  saklamaTarihi: "31 Ağustos 2027",
  // İsteğe bağlı: Proje Maratonu (öğretmen ekiplerinin çalışma günlükleri).
  // Kullanılmayacaksa bu bloğu silin; site ve Sheets maratonu hiç göstermez.
  maraton: {
    ad: "İl adı STEM Proje Maratonu",
    baslangic: "2026-10-01",
    bitis: "2027-06-30",
    // "Maraton" sayfasındaki Tema sütununun açılır listesi.
    temalar: ["Tema 1", "Tema 2"]
  },
  // data/ilceler.geojson içindeki "ad" değerleriyle BİREBİR aynı olmalı.
  ilceler: ["İlçe 1", "İlçe 2"]
};
