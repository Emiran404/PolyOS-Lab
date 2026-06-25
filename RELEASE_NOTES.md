# PolyOS Lab v1.3.6 - Sürüm Açıklaması

🎉 **PolyOS Lab v1.3.6**

Bu sürüm, sınıf yönetimini daha güçlü ve akıcı hale getirmek amacıyla sisteme **TigerVNC ve noVNC** entegrasyonu ekler. Ayrıca kullanıcıya Ayarlar sekmesinde farklı ekran yansıtma teknolojilerini dinamik olarak seçme imkanı sunar.

---

## 🚀 Yenilikler ve İyileştirmeler

### 🔌 TigerVNC + noVNC Entegrasyonu (Önerilen)
* **Kullanıcı Deneyimi:** Ekran izleme ve uzaktan kontrol sistemleri daha yüksek performanslı ve düşük gecikmeli hale getirildi.
* **TCP-to-WebSocket Köprüsü:** Go sunucusuna `/ws/vnc-proxy` uç noktası üzerinden websockify proxy desteği eklendi.
* **noVNC Entegrasyonu:** React & Electron Dashboard tarafına doğrudan `@novnc/novnc` kütüphanesi entegre edildi.
* **Dinamik Seçim Seçeneği:** Ayarlar paneline "TigerVNC (Önerilen)", "Yerel Python Tkinter" ve "Kiosk Tarayıcı" seçenekleri eklendi. Varsayılan olarak en kararlı ve hızlı olan **TigerVNC** teknolojisi seçildi.
* **Güvenli Erişim:** VNC sunucu bağlantıları istemcinin yerel proxy portu (`-localhost`) üzerinden tünellenerek, sınıf içi güvenlik standartlarına uygun ve şifresiz kolay yönetim yetenekleriyle sunuldu.

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
