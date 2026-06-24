# PolyOS Lab v1.3.2 - Sürüm Açıklaması

🎉 **PolyOS Lab v1.3.2**

Bu sürüm; internet kısıtlamaları sırasında istemcilerin kopması, kilit ekranındaki CSS/CDN bağımlılığı kaynaklı görsel bozulmalar ve Firefox tarayıcı entegrasyonu önceliği gibi kritik kararlılık hataları için düzeltmeler içerir.

---

## 🚀 Yenilikler ve İyileştirmeler

### 🔒 İnternet Kısıtlaması & Çevrimiçi Kalma Garantisi
* **Dinamik Sunucu IP Beyaz Listesi (Whitelist):** İnternet engellendiğinde istemcinin dashboard ile olan bağlantısının kesilmesi ve ağdan düşmesi engellendi. `iptables` kısıtlama zincirine (`POLYOS_BLOCK`) öğretmen bilgisayarının güncel IP adresi dinamik olarak whiteliste eklenerek kesintisiz yerel ağ iletişimi sağlandı.

### 🎨 Çevrimdışı Kilit Ekranı Arayüzü (Lock Screen CSS Fix)
* **Sıfır Ağ Bağımlılığı:** İnternet kısıtlandığında Tailwind CSS ve Material Symbols CDN'lerinin yüklenememesinden ötürü kilit ekranındaki tasarımın bozulması engellendi.
* Arayüz tamamen **saf CSS (Vanilla CSS)** ve **inline SVG** ikonlar kullanılarak internet bağlantısına ihtiyaç duymayan, şık ve kendi kendine yeten (self-contained) bir yapıya dönüştürüldü.

### 🌐 Firefox Tarayıcı Önceliği
* Pardus (Linux) istemcilerde varsayılan olarak kurulu gelen **Firefox**, Ekran Kilitleme ve Ekran Paylaşımı (Screen Share) işlemlerinde birinci öncelikli (index 0) tarayıcı olarak ayarlandı. Firefox ile başlayıp başarısız olunması durumunda Chromium türevlerine geçiş yapılacaktır.

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
