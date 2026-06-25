# PolyOS Lab v1.3.11 - Sürüm Açıklaması

🎉 **PolyOS Lab v1.3.11**

Bu sürüm; Hızlı İşlemler paneline "Dosya Gönder" butonu ekler ve VNC ekran yansıtma senkronizasyonunu optimize eder.

---

## 🚀 Yenilikler ve İyileştirmeler

### 📂 Hızlı İşlemler "Dosya Gönder" Entegrasyonu
* **Hızlı Aksiyon Butonu:** Hızlı İşlemler sekmesindeki üst kontrol paneline "Dosya Gönder" butonu eklendi. Seçtiğiniz 3-5 istemciye doğrudan oradan dosya transferi sekmesine geçerek otomatik hedeflenmiş şekilde dosya gönderebilirsiniz.

---

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
