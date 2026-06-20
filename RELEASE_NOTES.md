# PolyOS Lab v1.1.0 - Sürüm Açıklaması

🎉 **PolyOS Lab v1.1.0**

Bu sürüm, öğretmenlerin laboratuvardaki Pardus/Linux istemcilerini tam yetkiyle yönetebileceği **Gömülü Uzaktan Terminal (CLI)**, **Donanım & Ağ Sağlığı Haritası** ve kritik durumlar için geliştirilen **Aşırı Isınma Uyarı Sistemi** ile kontrol ve güvenliği en üst düzeye taşıyor.

---

## 🚀 Yenilikler

### 🖥️ Gömülü Uzaktan Terminal (CLI)
* Öğretmen panelinden seçilen bir veya birden fazla istemci üzerinde root yetkileriyle komut çalıştırabilme.
* Canlı terminal çıktısı akışı sağlayan şık, siyah konsol arayüzü.
* Bilişim teknolojileri öğretmenlerinin yönetim süreçlerini hızlandıracak doğrudan komut satırı deneyimi.

### 📊 Donanım ve Ağ Sağlığı Haritası
* Laboratuvardaki tüm cihazların CPU kullanımı, CPU Sıcaklığı, RAM kullanımı ve Disk kapasitesini tek bir ekranda canlı izleme imkanı.
* RAM ve Disk göstergelerinde oransal veri yerine gerçek kapasite sınırları (örn. `2.4 / 16.0 GB RAM`) gösterimi.
* Renk kodlu göstergelerle (yeşil, sarı, kırmızı) anlık donanım analizi.

### ⚠️ Akıllı Aşırı Isınma Uyarı Sistemi
* CPU kullanımı %95 ve sıcaklığı 75°C'nin üzerine çıkan kritik durumdaki istemciler için öğretmen panelinde otomatik kırmızı uyarı banner'ı gösterimi.
* Aşırı ısınan cihaza tek tıkla doğrudan terminal açıp müdahale edebilme kısayolu.

---

## 🔧 Hata Düzeltmeleri ve İyileştirmeler

### 🔑 Hostname Gösterim Sorunu Giderildi
* İstemci listesi tablosunda hostname alanlarının boş görünmesine neden olan WebSocket handshake önceliklendirme bug'ı tamamen fixlendi.
* İstemci bağlantılarında hostname bilgisi alınamadığında otomatik yedek adlandırma (`İstemci-[IP:Port]`) sağlayan fallback mekanizması kuruldu.

### ⚡ Performans ve Kararlılık
* Telemetri verilerinin sıfırlanması durumunda arayüzün kilitlenmesini engelleyen TDZ (Temporal Dead Zone) kontrolcüleri ve varsayılan GB sınırları eklendi.
* Terminal komutlarında `/api/terminal/run` yönlendirmelerindeki log çıktıları sadeleştirildi.

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
   npm run electron:dev
   ```
3. **İstemci (Pardus / Linux Cihazlar):**
   ```bash
   cd client
   sudo go run main.go
   ```
