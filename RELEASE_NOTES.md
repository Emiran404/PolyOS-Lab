# PolyOS Lab v1.4.3 - Sürüm Açıklaması

🎉 **PolyOS Lab v1.4.3**

Bu sürüm; laboratuvar ortamında tam kontrol sağlamak adına öğretmen panelinden öğrenci bilgisayarlarının masaüstü arka planını (duvar kağıdı) kilitleme ve sunucudan toplu duvar kağıdı görseli yansıtma özelliklerini ekler.

---

## 🚀 Yenilikler ve İyileştirmeler

### 🖼️ Masaüstü Duvar Kağıdı Kilitleme & Yönetimi (Wallpaper Lock)
* **Dedicated Dashboard Sayfası:** Öğretmen panelinin sol menüsüne özel bir "Duvar Kağıdı Kilidi" sekmesi eklendi. Buradan kilit durumu açılıp kapatılabilir ve görsel önizlemesi izlenebilir.
* **Görsel Yükleme & Dağıtma:** Öğretmen panelinden yüklenen duvar kağıdı görseli anlık olarak sunucuya kaydedilir, tüm aktif istemcilere WebSocket üzerinden yansıtılır.
* **Aktif Koruma (Enforcer Loop):** Öğrenci bilgisayarlarında çalışan arka plan servisi (goroutine), duvar kağıdının değiştirilmesini engellemek için 4 saniyede bir kontrol yapar ve elle yapılan değişiklikleri otomatik olarak sıfırlayıp kilitli resmi tekrar uygular.
* **Masaüstü Ortamı Desteği:** XFCE (`xfconf-query`) ve GNOME (`gsettings`) masaüstü ortamlarıyla tam uyumluluk sağlandı.

---

# PolyOS Lab v1.4.2 - Sürüm Açıklaması

🎉 **PolyOS Lab v1.4.2**

Bu sürüm; Atölye.Platform sınav entegrasyonu için merkezi yayın (broadcast) altyapısı ve öğretmen panelinde canlı masaüstü bildirim pencereleri ekler.

---

## 🚀 Yenilikler ve İyileştirmeler

### 📡 Merkezi Yayın (Broadcast) API'si
* **Yayın API Uç Noktası:** `/api/broadcast` REST API rotası sunucuya eklendi. Bu rota sayesinde tek bir HTTP isteğiyle bağlı olan tüm istemcilere (`polyos-client`) aynı anda bildirim/komut gönderilebilmesi sağlandı.

### 🔔 Öğretmen Dashboard Canlı Bildirim Sistemi (Toast)
* **Duyuru Yakalama:** Dashboard, log akışı üzerinden gelen yayın isteklerini anlık takip edecek şekilde güncellendi.
* **Şık Toast Bildirimi:** Herhangi bir sınav veya genel bildirim yayınlandığında, öğretmen panelinin sağ üst köşesinde animasyonlu, yeşil renkli, zil ikonlu (🔔) modern bir bildirim penceresi gösterilmesi sağlandı.

---

# PolyOS Lab v1.4.1 - Sürüm Açıklaması

🎉 **PolyOS Lab v1.4.1**

Bu sürüm; ilk kurulumlar için şık bir karşılama ekranı, dinamik öğretmen profili, sistem sıfırlama işlevi ve alt ağ (subnet) üzerinden otomatik sunucu keşif mekanizması ekler.

---

## 🚀 Yenilikler ve İyileştirmeler

### 🏫 Karşılama (Onboarding) Ekranı ve Dinamik Profil
* **İlk Kurulum Arayüzü:** Dashboard ilk kez açıldığında öğretmen adı ve görevini soran animasyonlu modern bir karşılama ekranı eklendi.
* **Geçiş Efektleri:** Kurulum tamamlandığında dönen yükleme animasyonu ve 500ms'lik yumuşak sayfa solma (fade-out) geçişi uygulandı.
* **Dinamik Sidebar & Selamlama:** Sidebar profili ve sağ üst karşılama başlığı öğretmen bilgilerine göre dinamik olarak güncellenir hale getirildi.
* **Profil Düzenleme:** Ayarlar sekmesine öğretmen bilgilerini düzenleme alanları eklendi.

### ⚠️ Tehlikeli Bölge ve Sistem Sıfırlama
* **Sistemi Sıfırla:** Ayarlar sekmesine eklenen "Tehlikeli Bölge" paneli ile tüm kullanıcı verileri sıfırlanarak sistem ilk kurulum (onboarding) durumuna döndürülebilir hale getirildi.

### 📡 İstemci Tarafında Alt Ağ Taraması (Subnet Scan)
* **Otomatik Ağ Taraması:** Sanal makine (VM) veya router engelleri nedeniyle UDP mDNS/Broadcast keşfi başarısız olduğunda istemcinin yerel `/24` ağını `8080` portundan saniyeler içinde tarayıp sunucuyu otomatik bulmasını sağlayan fallback mekanizması eklendi.

### 📐 Arayüz İyileştirmeleri
* **Sidebar Düzenlemesi:** Sidebar kapatıldığında okul emojisinin hizalanması ve kapatma butonunun bölme çizgisinde havada duracak şekilde şıklaştırılması sağlandı.

---

# PolyOS Lab v1.3.11 - Sürüm Açıklaması

🎉 **PolyOS Lab v1.3.11**

Bu sürüm; Hızlı İşlemler paneline "Dosya Gönder" butonu ekler ve VNC ekran yansıtma senkronizasyonunu optimize eder.

---

## 🚀 Yenilikler ve İyileştirmeler

### 📂 Hızlı İşlemler "Dosya Gönder" Entegrasyonu
* **Hızlı Aksiyon Butonu:** Hızlı İşlemler sekmesindeki üst kontrol paneline "Dosya Gönder" butonu eklendi. Seçtiğiniz 3-5 istemciye doğrudan oradan dosya transferi sekmesine geçerek otomatik hedeflenmiş şekilde dosya gönderebilirsiniz.

---

# PolyOS Lab v1.3.10 - Sürüm Açıklaması

🎉 **PolyOS Lab v1.3.10**

Bu sürüm; VNC uzaktan kontrol modunda pano eşitleme sistemini iyileştirir ve kolaylaştırılmış klavye kısayollarını ekler.

---

## 🚀 Yenilikler ve İyileştirmeler

### 📋 VNC Pano (Clipboard) Gönderim Sistemi Entegrasyonu
* **Otomatik xclip Kurulumu:** İstemci açıldığında pano paylaşımını yöneten `xclip` aracı sistemde yüklü değilse, otomatik olarak arka planda kurularak pano işlemlerinin çalışmama ihtimali ortadan kaldırıldı.
* **Kolaylaştırılmış Gönderim:** Uzaktan kontrol modalındaki "Pano içeriği" kutusuna metin girilip klavyeden **Enter** tuşuna basıldığında pano içeriği doğrudan hedeflenen Pardus istemcisinin panosuna aktarılacak şekilde geliştirildi.

---

# PolyOS Lab v1.3.9 - Sürüm Açıklaması

🎉 **PolyOS Lab v1.3.9**

Bu sürüm; öğretmen ekran yansıtma (screen share) sistemindeki istemci bağımlılık çökmelerini düzeltir ve Dashboard uygulamasının paket adını günceller.

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
