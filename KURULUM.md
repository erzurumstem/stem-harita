# STEM Etkinlik Haritası: Kendi İliniz İçin Kurulum

Bu rehber, öğretmenlerin düzenlediği STEM etkinliklerini il haritası üzerinde
gösteren bu siteyi **kendi iliniz için** kurmanızı anlatır. Yazılım bilgisi
gerekmez; her adım tıklanacak yerleriyle yazılmıştır.

**Ne elde edersiniz?**
- İlinizin ilçe sınırlarıyla çizilmiş bir harita. Her etkinlik, okulun
  bulunduğu ilçede temsilî bir noktada görünür.
- Öğretmenlerin sitedeki **"+ Etkinliğini ekle"** düğmesiyle doldurduğu bir form.
- Kayıtların yalnızca **siz onayladıktan sonra** haritada görünmesi.
- Yalnızca sizin görebileceğiniz bir **Özet** sayfası: il geneli sayılar;
  ilçe, okul, kapsam ve sınıf düzeyine göre dökümler; onaydan önce bakılması
  gereken kayıtlar.

**Neye ihtiyacınız var?**
- Bir bilgisayar (telefonla kurulmaz).
- Bir **Google (Gmail) hesabı** ve bir **GitHub hesabı**. İkisi de ücretsizdir.
- Yaklaşık **1–1,5 saat**.

> **Önemli:** Siteyi kurduğunuzda öğretmenlerden kişisel veri toplamış
> olursunuz ve KVKK kapsamında **veri sorumlusu siz olursunuz**. Aşağıdaki
> "KVKK notları" bölümünü mutlaka okuyun.

---

## 1. Hesapları hazırlayın

1. **Ayrı bir Gmail hesabı açmanızı öneririz**, örneğin `ilinizstem@gmail.com`.
   Form, yanıtlar ve site bu hesapta toplanır; kişisel hesabınızla karışmaz.
2. Bu e-postayla **https://github.com/signup** adresinden bir GitHub hesabı açın.
   Kullanıcı adı sitenin adresinde görünür (`kullaniciadi.github.io/stem-harita`),
   kısa ve anlaşılır seçin.
3. GitHub'da sağ üstteki profil resmi → **Settings** → **Emails** bölümünde:
   - **"Keep my email addresses private"** kutusunu işaretleyin.
   - **"Block command line pushes that expose my email"** kutusunu işaretleyin.

   Bu ikisi, sitede yaptığınız değişikliklerde e-posta adresinizin herkese
   açık görünmesini önler.

## 2. Siteyi kendi hesabınıza kopyalayın

1. Bu deponun GitHub sayfasında yeşil **"Use this template"** düğmesine,
   ardından **"Create a new repository"** seçeneğine tıklayın.
2. **Repository name:** `stem-harita`
3. **Public** seçin. GitHub Pages ücretsiz planda yalnızca açık depolarla çalışır.
4. **Create repository** düğmesine basın.

## 3. İlçe sınırlarını indirin

İlinizin ilçe sınırları OpenStreetMap'ten otomatik indirilir.

1. Kendi deponuzda üstteki **Actions** sekmesine tıklayın.
   *"Workflows aren't being run on this repository"* uyarısı çıkarsa
   **"I understand my workflows, go ahead and enable them"** düğmesine basın.
2. Soldaki listeden **"İlçe sınırlarını indir"**i seçin.
3. Sağdaki **Run workflow** düğmesine basın. İl adını **Türkçe karakterleriyle**
   yazın (ör. `Kahramanmaraş`) ve yeşil **Run workflow** düğmesine basın.
4. 1–2 dakika içinde satırın yanında yeşil ✓ işareti çıkar. Satıra, sonra
   **indir** adımına tıklayın. Kayıtların en altında şuna benzer bir satır
   göreceksiniz; **not edin** (5. adımda gerekecek):

   ```
   ilceler: ["Afşin","Andırın","Çağlayancerit", …]
   ```

   İlçe sayısının ilinizin gerçek ilçe sayısıyla aynı olduğunu kontrol edin.
   Kırmızı ✗ çıkarsa il adının yazımını kontrol edip yeniden deneyin.

## 4. Siteyi yayına alın (GitHub Pages)

1. Deponuzda **Settings** → soldan **Pages**.
2. **Source:** "Deploy from a branch". **Branch:** `main`, klasör `/ (root)`
   → **Save**.
3. Birkaç dakika sonra siteniz
   `https://kullaniciadi.github.io/stem-harita/` adresinde açılır. Harita
   görünür ama henüz etkinlik ve form yoktur.

## 5. Google tarafını kurun (form, yanıt tablosu, veri bağlantısı)

### 5.1 Tabloyu açın
1. Tarayıcıda Gmail hesabınızla giriş yapıp adres çubuğuna **sheets.new** yazın.
2. Tabloya bir ad verin (ör. `STEM Harita 2026-2027`).
3. **Dosya → Ayarlar**: *Yerel ayar* **Türkiye**, *Saat dilimi*
   **(GMT+03:00) İstanbul** → **Kaydet**.

### 5.2 Betiği ekleyin
1. **Uzantılar → Apps Script**'i açın. Proje adını `STEM Harita` yapın.
2. Soldaki **Kod.gs** dosyasının içini tamamen silin.
3. GitHub'daki deponuzda `apps-script/Kod.gs` dosyasını açın, sağ üstteki
   **kopyala** simgesine ("Copy raw file") basın ve Apps Script'e yapıştırın.
4. Apps Script'te soldaki **"+" → Komut dosyası** ile yeni bir dosya ekleyip
   adını `Ayarlar` yazın.
5. GitHub'da `apps-script/Ayarlar.ornek.gs` dosyasını aynı yolla kopyalayıp
   bu yeni dosyaya yapıştırın ve **kendi bilgilerinizle doldurun**:

   | Alan | Ne yazılır? | Örnek |
   |---|---|---|
   | `il` | İl adı | `"Kahramanmaraş"` |
   | `donem` | Eğitim yılı | `"2026-2027"` |
   | `idOnEki` | Dönemin ilk yılı | `"2026"` |
   | `veriSorumlusu` | **Adınız soyadınız** ve e-postanız | `"Ayşe Yılmaz (proje yürütücüsü) — ilinizstem@gmail.com"` |
   | `iletisim` | Silme/düzeltme talepleri için e-posta | `"ilinizstem@gmail.com"` |
   | `siteAdresi` | 4. adımdaki site adresi | `"https://kullaniciadi.github.io/stem-harita/"` |
   | `saklamaTarihi` | Yanıtların silineceği tarih | `"31 Ağustos 2027"` |
   | `ilceler` | 3. adımda not ettiğiniz satır | `["Afşin", "Andırın", …]` |

6. **Kaydet** simgesine basın (ya da `Ctrl+S` / `⌘S`).

> `Ayarlar` dosyasındaki bilgileri (özellikle adınızı) GitHub deponuza
> **eklemeyin**; yalnızca Apps Script'te dursun.

### 5.3 Kurulumu çalıştırın
1. Üstteki araç çubuğunda fonksiyon listesinden **kurulum**'u seçip
   **▷ Çalıştır**'a basın.
2. **"Yetkilendirme gerekiyor"** penceresinde:
   - **İzinleri incele** → hesabınızı seçin.
   - **"Google bu uygulamayı doğrulamadı"** uyarısı çıkar. Betiği Google'ın
     incelediği bir firma değil siz eklediğiniz için bu normaldir.
     **Gelişmiş** → **"STEM Harita (güvenli değil) sayfasına git"** → **İzin ver**.
3. Alttaki **Yürütme günlüğü**'nde "Kurulum tamam." ve **form adresi**
   (`…/viewform` ile biter) çıkar. **Form adresini not edin.**
4. Tabloya döndüğünüzde **Yanıtlar** ve **Özet** sayfaları ile üst menüde
   **STEM Harita** menüsü oluşmuş olmalı. Menü görünmezse sayfayı yenileyin.

Kurulum formu kendisi oluşturur: sorular, sınıfa göre şube sayfası,
aydınlatma metni ve açık rıza kutuları dahil. E-posta toplanmaz.

### 5.4 Veri bağlantısını yayımlayın
1. Apps Script'te sağ üstte **Dağıt → Yeni dağıtım**.
2. Dişli simgesinden **Web uygulaması**'nı seçin.
3. **Şu kullanıcı olarak yürüt:** **Ben**. **Erişimi olanlar:** **Herkes**
   ("Google hesabı olan herkes" değil).
4. **Dağıt** → çıkan **Web uygulaması URL**'sini (`…/exec` ile biter) not edin.

"Herkes" ayarı güvenlidir: bu adres yalnızca **onayladığınız** kayıtların
yayımlanmasına izin verilen alanlarını verir. Tam ad, şube, onaysız kayıtlar
ve Özet sayfası bu adresten çıkmaz.

## 6. Sitenin ayarlarını yapın

GitHub'daki deponuzda iki dosyada küçük değişiklikler yapacaksınız. Dosyayı
açıp sağ üstteki **kalem (Edit)** simgesine basın; değiştirdikten sonra
**Commit changes** düğmesine basın.

**`js/harita.js`**: en üstteki `AYARLAR` bölümü:

```js
const AYARLAR = {
  il: "Kahramanmaraş",
  iletisim: "ilinizstem@gmail.com",
  donem: "2026-2027",
  baslangic: "2026-09-01",
  bitis: "2027-08-31",
  veriUrl: "5.4'te not ettiğiniz …/exec adresi",
  testVeriUrl: "data/ornek-etkinlikler.json",
  formUrl: "5.3'te not ettiğiniz …/viewform adresi"
};
```

Tırnak işaretlerini ve virgülleri silmemeye dikkat edin.

**`index.html`**: baştaki şu dört satırda il adını ve yılı değiştirin
(arama motorları ve WhatsApp önizlemeleri bu satırları kullanır):

```html
<title>Kahramanmaraş STEM Etkinlik Haritası 2026-2027</title>
<meta name="description" content="Kahramanmaraş'ta öğretmenlerin düzenlediği …">
<meta property="og:title" content="Kahramanmaraş STEM Etkinlik Haritası 2026-2027">
<meta property="og:description" content="Kahramanmaraş'ta öğretmenlerin düzenlediği …">
```

Birkaç dakika sonra siteniz güncellenir.

## 7. Deneme yapın

1. Sitenizi açın; eski hali görünürse birkaç dakika bekleyip yenileyin.
2. **"+ Etkinliğini ekle"** düğmesiyle formu doldurun (okul adına `TEST` yazın;
   tarih dönem içinde olsun).
3. Tabloda **Yanıtlar** sayfasındaki yeni satırda en sağdaki **Onay** kutusunu
   işaretleyin.
4. Birkaç dakika içinde etkinlik haritada görünür.
5. Denemeden sonra satırı silin.

---

## Günlük kullanım

- **Yeni kayıt bildirimi:** Formun düzenleme ekranında **Yanıtlar** sekmesi →
  **⋮** → **"Yeni yanıtlar için e-posta bildirimleri al"**.
- **Onay:** Kaydı kontrol edip **Onay** kutusunu işaretleyin. İşareti
  kaldırırsanız kayıt haritadan çıkar.
- **Onaydan önce:** **Özet** sayfasındaki **"Kontrol edilecekler"** tablosuna
  bakın (okul türü–sınıf uyuşmazlığı, dönem dışı tarih, açıklamada bağlantı
  vb.). **"Okul adları"** tablosundaki **"olası mükerrer"** uyarılarına göre
  okul adlarını Yanıtlar sayfasında düzeltin. Aynı okul farklı yazılırsa
  haritada iki ayrı okul gibi görünür.
- **Açıklamaları okuyun:** Öğrenci adı veya kişisel bilgi varsa onaylamadan
  önce düzeltin ya da silin.
- **Özet sayfası:** Her yeni kayıt ve düzenlemede kendiliğinden yenilenir;
  elle yenilemek için **STEM Harita → Özeti şimdi yenile**.
- **STEM School Label okulları:** **Etiketler** sayfasına her okul için bir
  satır ekleyin: ilçe (açılır liste), okulun tam resmî adı, tür (Competent /
  Proficient / Expert) ve yıl. Okul haritada yıldızla görünür; etkinliği
  varsa yıldız etkinliklerinin yanında durur. Özet sayfasındaki
  **"Etiketli okullar"** tablosunda "Onaylı etkinlik" 0 görünüyorsa ve okulun
  etkinliği olduğunu biliyorsanız adı etkinlik kayıtlarındaki gibi yazın.

## Formu değiştirmek isterseniz

Soruları Apps Script'teki `Kod.gs` üzerinden değiştirip **formuYenidenKur**
fonksiyonunu çalıştırın. Eski form kapatılır, eski yanıtlar ayrı bir sayfada
saklanır, yeni form kurulur. Ardından:
- **Dağıt → Dağıtımları yönet → kalem → Sürüm: Yeni sürüm → Dağıt**
  (web uygulaması adresi değişmez).
- Günlükteki **yeni form adresini** `js/harita.js` içindeki `formUrl`'e yazın.

Formu Google Forms ekranından elle değiştirmeyin; soru başlıkları betikle
eşleşmezse veriler siteye yanlış aktarılır.

## Dönem sonu (Ağustos)

1. Web uygulaması adresini (`…/exec`) tarayıcıda açın ve sayfayı
   `etkinlikler-2026-2027.json` adıyla kaydedin.
2. GitHub'da `data` klasörüne girip **Add file → Upload files** ile bu
   dosyayı yükleyin.
3. `js/harita.js` içinde `veriUrl` değerini
   `"data/etkinlikler-2026-2027.json"` yapın. Site artık Google'dan bağımsız
   bir arşiv olur.
4. Aydınlatma metninde yazan tarihte tablodaki yanıtları silin.
5. Yeni dönem için bu rehberi baştan uygulayarak yeni bir depo ve yeni bir
   tablo kurun.

## KVKK notları

- **Veri sorumlusu sizsiniz.** Formdaki aydınlatma metni bir **taslaktır**;
  yayına almadan önce hukuk bilgisi olan birine (ör. İl Millî Eğitim
  Müdürlüğü hukuk birimi) göstermeniz önerilir. Metinde veri sorumlusunun
  kimliği (adınız) yazmalıdır.
- **Öğrenci verisi toplanmaz**; yalnızca kız ve erkek öğrenci sayıları tutulur.
  Fotoğraf veya görsel alanı eklemeyin.
- Öğretmen adı sitede **kısaltılmış** görünür (ör. "Ayşe Y."); kısaltma
  Google tarafında yapılır, tam ad siteye hiç gitmez.
- **Okulların gerçek konumu** kullanılmaz; haritadaki noktalar temsilîdir.
- **Site herkese açıktır ve GitHub deposu da herkese açıktır.** Depoya gerçek
  kişi adı, e-posta veya form yanıtı eklemeyin. `Ayarlar` dosyası yalnızca
  Apps Script'te kalmalıdır.
- Site çerez veya analitik kullanmaz. Sayfanın altındaki **Gizlilik**
  penceresinde bu bilgiler ziyaretçilere açıklanır.
- Okul yöneticilerini veya İl Millî Eğitim Müdürlüğünü önceden
  bilgilendirmeniz önerilir.

## Sorun giderme

| Sorun | Çözüm |
|---|---|
| Haritada etkinlik yok | Kayıt onaylı mı? Tarih dönem içinde mi? `veriUrl` doğru mu? Web uygulaması **Herkes** erişimiyle mi yayımlandı? |
| "Etkinlik verileri şu an yüklenemedi" | `veriUrl` adresini tarayıcıda açın; `[` ile başlayan bir liste görünmeli. Görünmüyorsa 5.4'ü tekrarlayın. |
| Değişiklik sitede görünmüyor | GitHub birkaç dakikada günceller; sayfayı `Ctrl+Shift+R` / `⌘+Shift+R` ile yenileyin. |
| Kod değişti ama site eskisi gibi | Apps Script'te **Yeni sürüm** dağıtmayı unutmayın (yukarıdaki "Formu değiştirmek isterseniz"). |
| "İlçe bulunamadı" | İl adını Türkçe karakterleriyle ve büyük harfle başlayarak yazın. |
| Bir ilçe haritada yok ya da adı farklı | 3. adımı yeniden çalıştırın; `Ayarlar` içindeki `ilceler` listesi, haritadaki ilçe adlarıyla **birebir** aynı olmalı. |

---

Harita verisi © OpenStreetMap katkıcıları (ODbL). Kod MIT lisanslıdır
(bkz. `LICENSE`).
