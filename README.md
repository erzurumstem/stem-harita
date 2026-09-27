# STEM Etkinlik Haritası

Öğretmenlerin düzenlediği STEM etkinliklerini il haritası üzerinde gösteren,
sunucusuz ve ücretsiz bir site. EU Code Week haritasının il ölçeğindeki benzeri.

**Canlı örnek:** https://erzurumstem.github.io/stem-harita/

- Öğretmenler sitedeki **"+ Etkinliğini ekle"** düğmesiyle kayıt girer
  (Google Form).
- Kayıtlar yönetici **onayladıktan sonra** haritada görünür.
- İşaretçi konumları **temsilîdir**; okulların gerçek konumu kullanılmaz.
- Öğrenci verisi toplanmaz; öğretmen adı kısaltılmış gösterilir
  (ör. "Ayşe Y."). Çerez ve analitik yoktur.

## Kendi ilinize kurmak için

Adım adım rehber: **[KURULUM.md](KURULUM.md)**. Yazılım bilgisi gerekmez;
yaklaşık 1–1,5 saat sürer.

## Teknik özet

- Saf HTML + CSS + JavaScript; derleme adımı yok. Harita: Leaflet ve
  Leaflet.markercluster (jsDelivr, SRI ile).
- Veri: Google Form → Google E-Tablolar → Apps Script web uygulaması
  (yalnızca onaylı kayıtlar, izin verilen alanlar) → site.
- İlçe sınırları: OpenStreetMap (ODbL), `scripts/ilce-sinirlari.mjs` ve
  "İlçe sınırlarını indir" iş akışı ile üretilir.
- GitHub Pages'te yayımlanır.

Lisans: MIT (bkz. [LICENSE](LICENSE)). Harita verisi © OpenStreetMap katkıcıları.
