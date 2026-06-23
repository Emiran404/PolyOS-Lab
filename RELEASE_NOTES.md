# PolyOS Lab v1.2.0 - Sürüm Açıklaması

🎉 **PolyOS Lab v1.2.0**

Bu sürüm, yerel ağ dostu güvenli internet engelleme (iptables sandbox), gerçek zamanlı sistem ağ telemetrisi (throughput & ping), geliştirici modu düzenlemeleri ve kararlılık iyileştirmelerini içermektedir.

---

## 🚀 Yenilikler ve İyileştirmeler

### 🛡️ Güvenli & Kesintisiz İnternet Engelleme (Linux / Pardus)
* **Yerel Ağ Bağlantısı Korundu:** `internet_off` komutu çalıştırıldığında istemcinin ağ kartlarını tamamen kapatmak yerine, Linux `iptables` üzerinde özel bir `POLYOS_BLOCK` zinciri kurulması sağlandı.
* Bu zincir; yerel ağ trafiğini (`127.0.0.1`, `192.168.0.0/16`, `10.0.0.0/8`, `172.16.0.0/12`) etkilemeden geçişe izin verirken dış dünyaya olan internet çıkışını engeller.
* Böylece öğrenci bilgisayarının interneti kesilse dahi öğretmen/merkezi sunucu ile bağlantısı kopmaz ve öğretmen "İnternet Erişimi AÇ" dediğinde bu komut sorunsuz alınarak internet anında geri açılabilir.

### 📊 Gerçek Zamanlı Ağ Telemetrisi & Performans Ölçümü
* Dashboard üzerindeki simüle edilmiş (mock) ağ verileri kaldırılıp yerine **gerçek zamanlı ağ ölçüm motoru** entegre edildi.
* **Download / Upload Trafik Akışı:** İşletim sisteminin ağ kartlarındaki (Network Interfaces) veri akış hızı (Throughput) hesaplanarak anlık Mbps olarak gösterilir.
* **Latency, Packet Loss & Jitter:** Arka planda çalıştırılan hafif ping sorguları ile ağın gerçek gecikme süresi, paket kaybı yüzdesi ve jitter değeri anlık olarak hesaplanır.

### ⚙️ Electron & Geliştirici Modu İyileştirmeleri
* Dashboard uygulamasının geliştirici modunda (`npm run electron:dev`) başlarken DevTools (Geliştirici Araçları) penceresinin otomatik olarak açılması engellendi.
* TypeScript derleme (tsc build) aşamasındaki `window.process` tip kontrolü hatası (error TS2339) giderilerek derleme kararlı hale getirildi.

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
