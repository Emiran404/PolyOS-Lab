# PolyOS Lab v1.2.7 - Sürüm Açıklaması

🎉 **PolyOS Lab v1.2.7**

Bu sürüm, Pardus (Linux) istemcilerindeki ekran kilitleme ve ekran yansıtma kararlılık iyileştirmelerini, gerçek ağ trafik grafik entegrasyonunu ve yönlendirici uyarılarını içermektedir.

---

## 🚀 Yenilikler ve İyileştirmeler

### 🔒 Pardus (Linux) Ekran Kilitleme Düzeltmesi
* **X11 Yetkilendirme Çözümü:** İstemcinin `root` yetkileriyle çalışırken kullanıcı ekranına kilit (HTML) arayüzünü getirememesi sorunu, aktif oturumun `.Xauthority` dosyasının dinamik olarak bulunup komuta `XAUTHORITY` çevre değişkeniyle aktarılmasıyla çözüldü.

### 🖥️ Ekran Yansıtma & Tam Ekran Kararlılığı
* **Tam Ekran Kaplama (Fix):** Ekran yansıtma sırasında Tkinter penceresinin bazı X11 pencere yöneticilerinde yarım veya küçük kalması engellendi. Ekran çözünürlüğü dinamik tespit edilerek tam ekran geometrisi zorlandı.
* **Girişlerin Kilitlenmesi:** Ekran yansıtılırken istemcilerin klavye ve fare girişlerinin `xinput` seviyesinde başarıyla kilitlenmesi sağlandı.

### 📊 Gerçek Zamanlı Ağ Trafik Akış Grafiği
* Grafik arayüzündeki yapay (random) ağ grafik dalgalanması kaldırılarak, **gerçek zamanlı download ve upload hız verilerine** bağlandı.

### ⚡ PolyOS Wake (WOL) Rehber Uyarı
* Wake-on-LAN ekranına, bu özelliğin çalışabilmesi için cihazların BIOS/Anakart ayarlarında WOL özelliğinin açık olması ve kablolu ağa bağlı olması gerektiğini bildiren şık bir uyarı bandı eklendi.

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
