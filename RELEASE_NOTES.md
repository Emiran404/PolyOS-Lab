# PolyOS Lab v1.3.3 - Sürüm Açıklaması

🎉 **PolyOS Lab v1.3.3**

Bu sürüm; Firefox tarayıcısının kilit ekranı ve ekran yansıtma modlarında kiosk modunda başlatılırken verdiği "Profile cannot be loaded" (Profil yüklenemedi) hatası için düzeltmeler içerir.

---

## 🚀 Yenilikler ve İyileştirmeler

### 🌐 Firefox Profil Yükleme Hatası Düzeltmesi (Profile Fix)
* **Kök Neden:** Firefox `--profile` parametresi ile geçici bir dizinde (`/tmp/...`) başlatıldığında, bu dizin sistem tarafından önceden oluşturulmamış veya izinleri GUI kullanıcısı ile root arasında uyuşmazlık içeriyorsa Firefox'un kilitlenmesine sebep oluyordu.
* **Çözüm:** Firefox başlatılmadan hemen önce, kilit ekranı (`/tmp/polyos_lock_firefox`) ve ekran paylaşımı (`/tmp/polyos_share_firefox`) için kullanılacak olan profil dizinleri Go istemcisinde dinamik olarak oluşturulup (`os.MkdirAll`) okuma/yazma izinleri en geniş seviyeye (`0777`) çekilerek Firefox'un yetki ve dosya erişim hatası vermesi tamamen engellendi.

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
