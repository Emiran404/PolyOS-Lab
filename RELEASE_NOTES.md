# PolyOS Lab v1.1.4 - Sürüm Açıklaması

🎉 **PolyOS Lab v1.1.4**

Bu sürüm, paketlenmiş (production) arayüzde yaşanan beyaz ekran yükleme sorununu düzeltmekte ve istemci tarafındaki bağlantı kopması/sunucu bulma mekanizmasını daha kararlı hale getirmektedir.

---

## 🚀 Yenilikler ve İyileştirmeler

### 🖥️ Arayüz (Dashboard) Beyaz Ekran Hatası Giderildi
* Vite konfigürasyonuna gömülü relative path (`base: './'`) desteği eklendi.
* `.deb` paket kurulumlarında (özellikle Pardus) asset yüklenememe ve beyaz ekranda kalma sorunu tamamen çözüldü.

### 🔌 İstemci (Client) Otomatik Yeniden Bağlantı & mDNS Keşfi
* Bağlantı kesintiye uğradığında istemcinin (Client) sunucuyu mDNS üzerinden otomatik olarak tekrar araması sağlandı.
* Ağ değişikliklerinde veya sunucu yeniden başlatıldığında istemcilerin manuel müdahale gerekmeden sisteme geri katılması sağlandı.

---

## 🔧 Hata Düzeltmeleri ve İyileştirmeler
* Electron production paket yapısı optimize edildi.
* Loglama ve hata yakalama mekanizmaları iyileştirildi.

---

## 📦 Kurulum ve Çalıştırma

Platformunuza uygun çalıştırılabilir dosyaları derlemek ve başlatmak için aşağıdaki yönergeleri izleyebilirsiniz:

1. **Sunucu Tarafı:**
   ```bash
   cd server
   go build -o server_bin main.go
   ./server_bin -port 8080 -token polyos-secure-token
   ```
2. **Dashboard (Arayüz):**
   ```bash
   cd dashboard
   npm install
   npm run electron:build
   ```
3. **İstemci (Pardus / Linux Cihazlar):**
   ```bash
   cd client
   sudo go run main.go
   ```
