# PolyOS Lab v1.3.10 - Sürüm Açıklaması

🎉 **PolyOS Lab v1.3.10**

Bu sürüm; VNC uzaktan kontrol modunda pano eşitleme sistemini iyileştirir ve kolaylaştırılmış klavye kısayollarını ekler.

---

## 🚀 Yenilikler ve İyileştirmeler

### 📋 VNC Pano (Clipboard) Gönderim Sistemi Entegrasyonu
* **Otomatik xclip Kurulumu:** İstemci açıldığında pano paylaşımını yöneten `xclip` aracı sistemde yüklü değilse, otomatik olarak arka planda kurularak pano işlemlerinin çalışmama ihtimali ortadan kaldırıldı.
* **Kolaylaştırılmış Gönderim:** Uzaktan kontrol modalındaki "Pano içeriği" kutusuna metin girilip klavyeden **Enter** tuşuna basıldığında pano içeriği doğrudan hedeflenen Pardus istemcisinin panosuna aktarılacak şekilde geliştirildi.

---

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
