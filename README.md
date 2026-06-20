# PolyOS Lab 🏫

**PolyOS Lab**, okul laboratuvarlarında öğretmenlerin öğrenci bilgisayarlarını canlı olarak izlemesini, kontrol etmesini ve yönetmesini sağlayan modern, hızlı ve hafif bir laboratuvar yönetim sistemidir.

Proje üç temel bileşenden oluşur:
1. **Dashboard (Öğretmen Paneli)**: Vite, React, TypeScript ve Electron tabanlı, gelişmiş görsel tasarıma sahip masaüstü yönetim paneli.
2. **Server (Merkezi Sunucu)**: Go diliyle yazılmış, WebSocket ve REST API'leri barındıran, verileri anlık olarak yönlendiren hafif sunucu.
3. **Client (Öğrenci İstemcisi)**: Go diliyle yazılmış, macOS ve Pardus (Linux) uyumlu çalışan, sistem kontrollerini gerçekleştiren arka plan hizmeti.

---

## 🌟 Öne Çıkan Özellikler

* **Canlı Ekran İzleme**: Tüm bağlı öğrenci ekranlarını aynı anda düşük gecikmeyle izleyin.
* **Uzaktan Kontrol (Remote Control)**: Çift tıklayarak öğrenci bilgisayarını klavye ve fare hareketlerinizle uzaktan yönetin, pano (clipboard) paylaşımı yapın.
* **Ekran Yansıtma (Screen Share)**: Öğretmen ekranını tüm öğrencilere aynı anda, klavye/fare girdileri kısıtlanmış ve tam ekran modunda yayınlayın.
* **Akıllı Ekran Kilidi**: Öğrencilerin dikkatini çekmek için ekranları kilitleyin. Tüm girdiler (fare ve klavye) yerel düzeyde devre dışı kalır ve ekranda *"Bu Bilgisayar Kilitlendi"* mesajı belirir.
* **USB Kısıtlaması**: Öğrenci bilgisayarlarında USB depolama birimlerini (Flash bellek vb.) uzaktan tek tıkla engelleyin veya engeli kaldırın.
* **Ağ Yönetimi & İnternet Kontrolü**:
  * Tüm laboratuvarın internet erişimini tek tıkla kapatın/açın.
  * Kara Liste (Blacklist) özelliği ile belirli web sitelerini sistem seviyesinde engelleyin ve engelli öğrencileri yerel bilgilendirme sayfasına yönlendirin.
* **PolyOS Wake (Wake-on-LAN)**: Daha önce sisteme bağlanmış bilgisayarları MAC adresleri üzerinden topluca veya tekil olarak uzaktan uyandırın (WOL).
* **Dosya Transferi**: İstediğiniz dosyayı seçip tüm öğrencilerin veya seçtiğiniz belirli bir öğrencinin masaüstüne anında gönderin.

---

## 🛠️ Kurulum ve Çalıştırma

### Gereksinimler
* [Node.js](https://nodejs.org/) (v16 veya üzeri)
* [Go](https://go.dev/) (v1.18 veya üzeri)
* Linux/Pardus için gerekli sistem paketleri: `xinput`, `scrot`, `xdotool`, `xclip`, `python3` (Tkinter modülü ile)

---

### 1. Sunucuyu Başlatma (Server)

```bash
cd server
go run main.go
```
* Sunucu varsayılan olarak `http://localhost:8080` portu üzerinden hizmet verir.
* Bağlanan tüm geçmiş cihazlar `devices.json` dosyasına kaydedilir (WOL için).

---

### 2. Yönetim Panelini Başlatma (Dashboard)

```bash
cd dashboard
npm install
npm run electron:dev
```
* Electron arayüzü açılacak ve sunucuya otomatik olarak bağlanacaktır.

---

### 3. İstemciyi Başlatma (Client)

```bash
cd client
# Linux/Pardus üzerinde sistem seviyesinde girdileri ve USB'yi kilitleyebilmek için sudo ile çalıştırılmalıdır:
sudo go run main.go
```
* İstemci, arka planda sunucuya bağlanarak ekran görüntüsü göndermeye ve komutları dinlemeye başlar.

---

## 🔒 Güvenlik ve İzinler

* **Pardus / Linux**: Giriş cihazlarını kısıtlamak (`xinput` set-prop) ve USB engellemesi (`modprobe -r`) yapabilmek için istemci uygulamasının **yönetici yetkileriyle (sudo)** çalıştırılması gerekmektedir.
* **macOS**: Geliştirme ve test süreçleri için macOS üzerinde simüle edilmiş komutlar (pmset, osascript, mock ekran görüntüsü vb.) çalışır.

---

## 📝 Lisans

Bu proje eğitim ve laboratuvar yönetimi amacıyla geliştirilmiştir. Geliştirici: **Emirhan Gök**
