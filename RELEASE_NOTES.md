# PolyOS Lab v1.1.8 - Sürüm Açıklaması

🎉 **PolyOS Lab v1.1.8**

Bu sürüm, Pardus/Linux istemcilerinin root (sudo) yetkileriyle çalışırken yaşadığı X-Server/DISPLAY GUI yetkilendirme sorunlarını çözmekte, uzaktan terminal bağlantısını kararlı hale getirmekte ve yeni HTML kilit ekranını sunmaktadır.

---

## 🚀 Yenilikler ve İyileştirmeler

### 🔑 Sudo (Root) GUI ve Display İzinleri Fixlendi (Pardus / Linux)
* `sudo go run main.go` veya paketli daemon root olarak çalışırken, GUI arayüzlerinin (`kiosk` kilit ekranı, `xdg-open` ile web sayfası açma, `zenity` bildirim pencereleri vb.) X-Server yetki hatası vermesi engellendi.
* Go istemcisine grafiksel oturumu açmış aktif kullanıcıyı tespit eden (`getLoggedInGUIUser`) ve GUI süreçlerini bu kullanıcı adına `DISPLAY=:0` yetkisiyle başlatan (`runGUICommand`) yeni bir mekanizma eklendi.

### 🔐 HTML Kilit Ekranı & Kilit Detayları Temizliği
* Gönderilen minimalist ve şık HTML kilit ekranı projenin yerleşik kilit ekranı yapıldı.
* Kilit ekranı üzerindeki "Kilit Detayları" (Öğretmen, Sebep, Kilit saati vb.) tamamen kaldırılarak daha temiz ve doğrudan bir tasarım sağlandı.
* Sistem genelindeki `xdg-screensaver` ve `loginctl` gibi oturum kilitleme komutları kaldırılarak, yalnızca girdi aygıtlarının kilitlenmesi ve kiosk ekranı ile kilit yönetiminin kararlı çalışması sağlandı.

### 🔌 Kararlı Uzaktan Terminal & Yeniden Bağlantılar (Stable Client IDs)
* Sunucu tarafında istemcilerin dinamik IP/Port yerine kalıcı **MAC Adresi** (`handshake.MAC`) ile haritalandırılması sağlandı.
* Bu sayede istemcilerin bağlantısı kopup yeni bir portla bağlandıklarında uzaktan terminal, ekran paylaşımı ve kontrol seanslarının kesintiye uğramadan devam etmesi sağlandı.

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
