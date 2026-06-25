# PolyOS Lab v1.3.7 - Sürüm Açıklaması

🎉 **PolyOS Lab v1.3.7**

Bu sürüm; dosya transfer sistemindeki yetkilendirme sorunlarını, VNC proxy bağlantı protokolü el sıkışmalarını, Pardus/Debian ortamlarındaki MAC adresi tespit zayıflıklarını ve sistem servisleri altındaki ev dizini çözümleme kararsızlıklarını çözen kritik hata düzeltmelerini barındırır.

---

## 🚀 Yenilikler ve Hata Düzeltmeleri

### 📂 Dosya Transfer Sistemi İyileştirmeleri
* **Masaüstü Dizin Çözümlemesi:** Sistem servisi veya `sudo` (root) olarak çalışan istemcilerde, aktif masaüstü kullanıcısının ev dizini `/proc`, `logname` ve `/home` gibi zengin alternatifler (`getLoggedInGUIUser`) ve Go `user.Lookup` API'si ile tespit edilir. Dosyalar artık doğrudan aktif kullanıcının Masaüstüne (`/home/kullanici/Masaüstü/`) indirilmektedir.
* **Yetki Devri (chown):** Root tarafından indirilen dosyalar ve oluşturulan klasörler otomatik olarak aktif GUI kullanıcısının mülkiyetine (`chown`) geçirilir. Öğrencinin dosyayı düzenlemesi, açması veya silmesi önündeki engeller kaldırılmıştır.
* **Sunucu Depolama:** Sunucu tarafında `uploads` dizini yazma yetkisi olan ev klasörü (`~/.config/polyos-lab/uploads`) içerisine dinamik olarak taşınarak paketlenmiş (read-only) Electron dizin yetki hataları giderildi.
* **Yol Gösterimli Bildirimler:** Dosya başarıyla alındığında istemci bilgisayarının sağ üstünde aktif D-Bus oturumu kullanılarak bir bildirim balonu tetiklenir ve dosyanın tam adresi (`Yol: /home/.../Masaüstü/...`) gösterilir.

### 🌐 Ağ ve VNC Proxy Bağlantı Düzeltmeleri
* **VNC Subprotocol Desteği:** Go Websocket VNC Proxy el sıkışması (`handleVNCProxyWS`) noVNC tarafından talep edilen `binary` alt-protokolünü (subprotocol) destekleyecek şekilde güncellendi. noVNC bağlantılarının tarayıcı tarafından `1006` koduyla sonlandırılması önlendi.
* **Güvenli Dış Erişim:** VNC sunucu komutlarındaki `-localhost` parametresi kaldırılarak ana sunucunun uzaktan kontrol ve ekran izleme amacıyla öğrenci istemcisine erişebilmesi sağlandı.
* **Eksik VNC Otomatik Kurulumu:** VNC paylaşımı açıldığında istemci makinede `x11vnc` veya `x0vncserver` kurulu değilse arka planda otomatik olarak `apt-get` paket yöneticisi ile kurulması sağlandı.

### 🔌 Cihaz Listesi ve WOL Düzeltmeleri
* **MAC Adresi Tespiti:** Aktif arayüzlerde MAC adresi alınırken `UP` durum kontrolüne ek olarak, donanım adresi olan ilk loopback dışı arayüze otomatik geri düşme (fallback) desteği getirildi. MAC adresinin boş dönmesi sorunu çözüldü.
* **Cihaz Listesi İzinleri:** Cihazların WOL amacıyla listelendiği `devices.json` dosyası yazılabilir kullanıcı yapılandırma klasörüne (`~/.config/polyos-lab/devices.json`) taşındı.

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
