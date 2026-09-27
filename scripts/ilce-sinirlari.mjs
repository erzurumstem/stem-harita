// İlçe sınırlarını OpenStreetMap'ten indirip data/ilceler.geojson dosyasını üretir.
// Kullanım: node scripts/ilce-sinirlari.mjs "Bayburt"
// GitHub'da "İlçe sınırlarını indir" iş akışı (.github/workflows) bunu çalıştırır.
//
// Yöntem (CLAUDE.md "data/ilceler.geojson" ile aynı):
//   1. Overpass API: ilin (admin_level=4) içindeki ilçe ilişkileri (admin_level=6).
//   2. polygons.openstreetmap.fr: her ilçenin poligonu.
//   3. mapshaper: yalnızca "ad" alanı, koordinatlar 4 basamak; sadeleştirme yok.

import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, statSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const il = (process.argv[2] || "").trim();
if (!il) {
  console.error('İl adı verilmedi. Örnek: node scripts/ilce-sinirlari.mjs "Bayburt"');
  process.exit(1);
}

const TANITICI = { "User-Agent": "stem-harita/1.0 (ilce-sinirlari)" };
const bekle = (ms) => new Promise((r) => setTimeout(r, ms));

async function getir(adres, secenekler = {}, deneme = 3) {
  for (let i = 1; ; i++) {
    try {
      const yanit = await fetch(adres, { ...secenekler, headers: { ...TANITICI, ...(secenekler.headers || {}) } });
      if (!yanit.ok) throw new Error(`HTTP ${yanit.status}`);
      return yanit;
    } catch (hata) {
      if (i >= deneme) throw new Error(`${adres}: ${hata.message}`);
      await bekle(3000 * i);
    }
  }
}

console.log(`"${il}" ilinin ilçeleri aranıyor…`);
const sorgu = `[out:json][timeout:90];
area["boundary"="administrative"]["admin_level"="4"]["name"="${il.replace(/"/g, "")}"]->.il;
rel(area.il)["boundary"="administrative"]["admin_level"="6"];
out tags;`;
const liste = await (await getir("https://overpass-api.de/api/interpreter", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: "data=" + encodeURIComponent(sorgu)
})).json();

const ilceler = liste.elements
  .map((e) => ({ id: e.id, ad: e.tags?.name }))
  .filter((e) => e.ad)
  .sort((a, b) => a.ad.localeCompare(b.ad, "tr"));
if (!ilceler.length) {
  console.error(`"${il}" için ilçe bulunamadı. İl adını Türkçe karakterleriyle ve büyük harfle başlayarak yazın (ör. "Kahramanmaraş").`);
  process.exit(1);
}
console.log(`${ilceler.length} ilçe bulundu: ${ilceler.map((i) => i.ad).join(", ")}`);

const ozellikler = [];
for (const ilce of ilceler) {
  await getir(`https://polygons.openstreetmap.fr/index.py?id=${ilce.id}`);
  const g = await (await getir(`https://polygons.openstreetmap.fr/get_geojson.py?id=${ilce.id}&params=0`)).json();
  const geometri = g.type === "GeometryCollection" ? g.geometries[0] : g;
  ozellikler.push({ type: "Feature", properties: { ad: ilce.ad }, geometry: geometri });
  console.log(`  ✓ ${ilce.ad}`);
}

const klasor = mkdtempSync(join(tmpdir(), "ilce-"));
const ham = join(klasor, "ham.geojson");
writeFileSync(ham, JSON.stringify({ type: "FeatureCollection", features: ozellikler }));

const hedef = "data/ilceler.geojson";
execFileSync("npx", ["-y", "mapshaper", ham, "-filter-fields", "ad", "-o", hedef, "precision=0.0001"], { stdio: "inherit" });

const boyut = Math.round(statSync(hedef).size / 1024);
const adlar = JSON.parse(readFileSync(hedef, "utf8")).features.map((f) => f.properties.ad);
console.log(`\n${hedef} yazıldı: ${adlar.length} ilçe, ${boyut} KB.`);
if (boyut > 400) console.log("UYARI: Dosya 400 KB'den büyük; site yavaş açılabilir.");
console.log("\nApps Script'teki Ayarlar.gs dosyasında \"ilceler\" satırını şununla değiştirin:");
console.log(`  ilceler: ${JSON.stringify(adlar)}`);
