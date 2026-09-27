'use strict';

// İle ve yıla özgü tüm değerler yalnızca burada durur.
const AYARLAR = {
  il: "Erzurum",
  iletisim: "erzurumstem@gmail.com",
  donem: "2026-2027",
  baslangic: "2026-09-01",
  bitis: "2027-08-31",
  veriUrl: "https://script.google.com/macros/s/XXXX/exec"
  // yerel test: "data/ornek-etkinlikler.json"
};

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
  return katman;
}

async function baslat() {
  sayfaBasliklariniKur();
  const harita = haritaKur();
  durumGoster("Harita yükleniyor…");
  try {
    await ilceleriYukle(harita);
    durumGizle();
  } catch (hata) {
    console.error(hata);
    durumGoster("İlçe sınırları şu an yüklenemedi. Lütfen sayfayı daha sonra yenileyin.", true);
  }
}

document.addEventListener("DOMContentLoaded", baslat);
