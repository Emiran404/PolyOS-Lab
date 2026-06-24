# PolyOS Lab v1.3.4 - Sürüm Açıklaması

🎉 **PolyOS Lab v1.3.4**

Bu sürüm; kilit ekranı aç/kapa yapıldığında tarayıcı pencerelerinin arkada asılı (zombie) kalarak yeni kilit ekranının gelmesini engellemesi sorununu çözer. Ayrıca, ekran yansıtma (Screen Share) özelliğini Chrome/Firefox yerine tamamen yerel Python Tkinter penceresi üzerinden yürüterek tarayıcı bağımlılığını ortadan kaldırır.

---

## 🚀 Yenilikler ve İyileştirmeler

### 🔒 Kilit Ekranı Süreç Temizliği (Lock Screen Toggling Fix)
* **Kök Neden:** Kilit ekranı açılıp kapatıldığında, arka planda kalan kiosk tarayıcı süreçleri (zombie processes) tam olarak sonlandırılamıyor ve sonraki kilitleme tetiklemelerinde port/profil çakışmaları yaratarak yeni ekranın gelmesini engelliyordu.
* **Çözüm:** `startLockOverlay()` ve `stopLockOverlay()` adımlarında, yeni bir kilit ekranı açılmadan ve kapatıldıktan hemen sonra arka plandaki tüm `firefox`, `chromium`, `chrome` süreçleri sistem seviyesinde temizlendi (`pkill -f`). Böylece kilit ekranı arka arkaya aç-kapa yapıldığında dahi her seferinde sorunsuz çizilir.

### 🖥️ Yerel Python Tkinter Ekran Yansıtıcı (Native Screen Share)
* **Tarayıcısız Yansıtma:** Ekran yansıtma sırasında Chrome veya Firefox kiosk pencereleri kullanmak yerine, istemci tarafında **tam ekran yerel bir Python Tkinter arayüzü** geliştirildi (`polyos_share_viewer.py`).
* Bu yerel arayüz, WebSockets (`websocket-client` kütüphanesi) üzerinden öğretmen ekranı yayınını anlık (`base64` jpeg) olarak alıp, cihaz ekran çözünürlüğüne göre en-boy oranını bozmadan (`PIL` / Pillow) tam ekran olarak çizmektedir. Chrome/Firefox açılması zorunluluğu tamamen ortadan kaldırılmıştır.

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
   * Yerel Python yansıtıcının çalışabilmesi için istemcide gerekli Python kütüphanelerini yükleyin:
     ```bash
     sudo apt install python3-tk python3-pil python3-pil.imagetk
     pip3 install websocket-client pillow
     ```
   * İstemciyi başlatın:
     ```bash
     cd client
     sudo go run main.go
     ```
