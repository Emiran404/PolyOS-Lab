# PolyOS Lab v1.3.9 - Sürüm Açıklaması

🎉 **PolyOS Lab v1.3.9**

Bu sürüm; öğretmen ekran yansıtma (screen share) sistemindeki istemci bağımlılık çökmelerini düzeltir ve Dashboard uygulamasının paket adını günceller.

---

## 🚀 Yenilikler ve İyileştirmeler

### 🖥️ Öğretmen Ekran Yansıtma Düzeltmesi (Sıfır Bağımlılık)
* **Bağımlılıksız Kiosk Tarayıcı Yayını:** VNC ve tarayıcı modlarında öğretmen ekran paylaşımı başlatıldığında, istemci tarafında harici Python kütüphaneleri (Pillow, websocket-client vb.) gerektiren Tkinter aracı yerine doğrudan yerleşik web tarayıcısı (Firefox / Chrome) kiosk modda tetiklenir. Bu sayede istemcilerde hiçbir ek paket kurmaya gerek kalmadan öğretmen ekranı kararlı ve tam ekran olarak yansıtılır.

### 📦 Dashboard Paket İsmi Güncellemesi
* **Ürün İsmi Değişimi:** `.deb` paketi ve uygulama ismi `PolyOS Lab Dashboard` yerine **`PolyOS Lab Öğretmen Paneli`** olarak güncellendi. Artık masaüstü kısayollarında ve uygulama listelerinde Türkçe isimle yer alacaktır.

---

# PolyOS Lab v1.3.8 - Sürüm Açıklaması

🎉 **PolyOS Lab v1.3.8**

Bu sürüm; istemci VNC başlangıç varsayılanlarını düzenler ve çoklu dosya transferini kolaylaştırmak amacıyla sürükle-bırak (drag & drop) dosya yükleme desteği ile seçili istemcilere dosya yansıtma seçeneklerini arayüze ekler.

---

## 🚀 Yenilikler ve İyileştirmeler

### 🖱️ Sürükle-Bırak (Drag & Drop) Dosya Transferi
* **Kolaylaştırılmış Gönderim:** Öğretmen panelindeki ana İstemci Listesi gridi veya Ekran İzleme gridi üzerinde yer alan herhangi bir öğrenci kartının üstüne masaüstünden bir dosyayı sürükleyip bırakarak o öğrenciye otomatik olarak dosya gönderme desteği getirildi.
* **Seçili İstemcilere Toplu Gönderim:** Hızlı İşlemler panelinde seçilen 3-5 öğrenciye tek seferde dosya göndermek için Dosya Transferi sekmesine "Seçili İstemciler (X cihaz)" seçeneği eklendi. Cihazlar seçildiğinde bu seçenek otomatik olarak aktifleşir ve dosya sadece seçilen cihazlara gönderilir. Sunucu backend tarafında virgülle ayrılmış hedef listesi çözümleme yeteneği eklendi.
* **Varsayılan VNC Sunucu Başlangıcı:** İstemci ilk kez kurulduğunda veya sıfırdan açıldığında VNC ekran akışının doğrudan çalışabilmesi amacıyla, istemci içi varsayılan ekran paylaşım teknolojisi `vnc` olarak ayarlandı.

---

# PolyOS Lab v1.3.7 - Sürüm Açıklaması

🎉 **PolyOS Lab v1.3.7**

Bu sürüm; dosya transfer sistemindeki yetkilendirme sorunlarını, VNC proxy bağlantı protokolü el sınıfı el sıkışmalarını, Pardus/Debian ortamlarındaki MAC adresi tespit zayıflıklarını ve sistem servisleri altındaki ev dizini çözümleme kararsızlıklarını çözen kritik hata düzeltmelerini barındırır.

---

## 📦 Kurulum ve Çalıştırma

1. **Sunucu:**
   ```bash
   cd server
   go run main.go
   ```
2. **Dashboard (Arayüz):**
   ```bash
   cd dashboard
   npm install
   npm run electron:dev
   ```
3. **İstemci (Pardus / Linux Cihazlar):**
   ```bash
   cd client
   sudo go run main.go
   ```
