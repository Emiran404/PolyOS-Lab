# PolyOS Lab v1.6.3 - Sürüm Açıklaması

🐛 **PolyOS Lab v1.6.3 — Hata Düzeltme Sürümü**

Bu sürüm; ekran yansıtma, duvar kağıdı kilidi, mesaj kutusu ve VNC uyku sorunu gibi 5 kritik hatayı düzeltir.

---

## 🔧 Hata Düzeltmeleri

### 1. 📺 Ekran Yansıtma Tam Ekran Sorunu (BUG-01)
- **Sorun:** `/share` sayfasındaki yayın ekranı tarayıcıda küçük kalıyor, tüm ekranı doldurmuyordu.
- **Çözüm:** `#screen` elementi `width:100vw; height:100vh; object-fit:contain` ile tam ekranı kaplayacak şekilde güncellendi. Sayfa ayrıca Fullscreen API'si ile otomatik tam ekranda açılmaya çalışır (`requestFullscreen`).

### 2. 🖼️ Duvar Kağıdı Kilidi Otomatik Uygulanmıyor (BUG-02)
- **Sorun:** Duvar kağıdı yüklendiğinde istemcilerde otomatik değişmiyordu.
- **Çözüm:** Server tarafında `/api/wallpaper/upload` işlevi güncellendi — yeni resim yüklendiğinde `wallpaperLocked` otomatik olarak `true` yapılır ve anında tüm istemcilere `broadcastWallpaperState()` gönderilir. Öğretmen paneli UI'ı da kilit durumunu otomatik günceller.

### 3. 💬 Mesaj Kutusu'na Yazı Yazılamıyor (BUG-03)
- **Sorun:** Hızlı işlemler > Mesaj Gönder butonuna tıklandığında açılan modaldaki metin kutusuna yazı yazılamıyordu.
- **Çözüm:** Modal'ın arka planı `onMouseDown` ile odak çalma olayını engeller. Modal kartı `onMouseDown` ve `onClick` event'lerini `stopPropagation()` ile durdurur. Input'a ek olarak `e.stopPropagation()` ve `(e.target as HTMLInputElement).focus()` eklendi.

### 4. 💤 Bilgisayar Uyku Moduna Geçiyor → VNC Kesiliyordu (BUG-04)
- **Sorun:** İstemci bilgisayar uyku/bekleme moduna geçtiğinde VNC bağlantısı kopuyordu.
- **Çözüm:** Client'a `startSleepInhibitor()` fonksiyonu eklendi. Bu fonksiyon:
  - `xset s off` + `xset s noblank` + `xset -dpms` komutlarıyla X11 ekran koruyucusu ve DPMS (güç tasarruf modu) devre dışı bırakılır.
  - Her 60 saniyede bir tekrar uygulanarak sistem tarafından yeniden etkinleştirilmesi engellenir.
  - `systemd-inhibit --what=sleep:idle:handle-lid-switch` ile logind tabanlı uyku engeli de eklenir.
  - Başlangıçta otomatik çağrılır (`main()` fonksiyonundan).

### 5. 🔁 Ekran Yansıtmayı 2. Kez Kapatınca Öğrencilerde Kapanmıyordu (BUG-05)
- **Sorun:** Ekran yansıt açıp kapatıldıktan sonra 2. defa açılıp kapatıldığında öğrenci ekranlarındaki Python/tarayıcı viewer pencereleri kapanmıyordu.
- **Çözüm:** `startScreenShareViewer()` artık başlamadan önce her zaman mevcut process'i öldürür (eski erken `return` kaldırıldı). `stopScreenShareViewer()` güçlendirildi: `cmd.Wait()` ile zombie process temizlenir, `pkill -f polyos_share_viewer.py`, `pkill -f firefox.*polyos_share_firefox`, `pkill -f chromium.*polyos_share_chrome` pattern-bazlı komutlarla kalan tüm izler temizlenir.

---

# PolyOS Lab v1.6.2 - Sürüm Açıklaması

🎉 **PolyOS Lab v1.6.2**

Bu sürüm; entegre Go sunucusunu (polyos-server) ve arka plan sistem servislerini (systemd/daemon) birleştiren hibrit sunucu başlatma desteği sunar.

---

## 🚀 Yenilikler ve İyileştirmeler

### 🔌 Hibrit Sunucu Başlatma Desteği
- **Akıllı Port Algılama & Entegre Sunucu Aktivasyonu:** Uygulama açılışında port 8080 (veya belirlenen port) taranır. Eğer arka planda çalışan bir sistem servisi veya daemon varsa, port meşgul olacağından yeni bir süreç başlatılmaz ve doğrudan var olan servis kullanılır. Eğer port boşsa, Electron otomatik olarak yerel entegre Go sunucu sürecini (`spawn`) başlatır. Bu sayede hem servisli hem de servissiz tüm ortamlarda anında çalışır hale gelir.
- **Entegre Sunucu Dosyası:** pre-compiled Linux amd64 sunucu binary dosyası `dashboard/polyos-server` olarak repoya yerleştirilmiş ve `extraResources` üzerinden deb paketine dahil edilmiştir.

---

# PolyOS Lab v1.6.1 - Sürüm Açıklaması

🎉 **PolyOS Lab v1.6.1**

Bu sürüm; kapatma (shutdown) ve yeniden başlatma (reboot) gibi kritik sistem eylemleri için çift aşamalı (onay pencereli) güvenlik koruması sağlar.

---

## 🚀 Yenilikler ve İyileştirmeler

### 🛡️ Kritik Eylem Koruması (Çift Aşamalı Onay)
- **Güvenlik Onay Modali (Confirm Modal):** "Tümünü Kapat", "Tümünü Yeniden Başlat" ve tekli bilgisayar kapatma/yeniden başlatma butonlarının tamamına çift aşamalı onay sistemi eklendi. Butona basıldığında büyük, kırmızı uyarılar içeren özel bir React onay penceresi açılır. Kullanıcı onay vermeden komutlar istemcilere gönderilmez.

---

# PolyOS Lab v1.6.0 - Sürüm Açıklaması

🎉 **PolyOS Lab v1.6.0**

Bu sürüm; öğretmen paneli sunucusunun (polyos-server) arka planda (systemd servisi/daemon) sürekli açık ve çalışır kalması özelliğini destekler. Uygulama açılışında sunucuyu yeniden derleme/başlatma süreleri devre dışı bırakılmıştır. Ayrıca sunucu kaynak kodları ve sunucu deb paketi yayın akışından kaldırılmıştır.

---

## 🚀 Yenilikler ve İyileştirmeler

### ⚡ Anında Açılış & Arka Plan Sunucu Desteği
- **Sunucu Spawning Kaldırıldı:** Electron uygulaması açıldığında yerel olarak Go sunucusu derleme ve çalıştırma süreçleri kaldırıldı. Uygulama artık milisaniyeler içinde anında açılır.
- **Port Sorgulama Modu (Probing):** Uygulama, arka planda çalışan sistem servisini port bazlı TCP ping ile sorgulayarak otomatik olarak bağlanır.

---

# PolyOS Lab v1.5.4 - Sürüm Açıklaması

🎉 **PolyOS Lab v1.5.4**

Bu sürüm; öğretmen paneli arayüzündeki gereksiz "Yardım" ve "Çıkış Yap" düğmelerini kaldırarak daha temiz bir arayüz sunar.

---

## 🚀 Yenilikler ve İyileştirmeler

### 🧹 Arayüz Sadeleştirme
- **"Yardım" Düğmesi Kaldırıldı:** Ana sayfadaki üst bilgi çubuğunda bulunan ve herhangi bir işlevi olmayan "Yardım" (Help) butonu arayüzden tamamen temizlendi.
- **"Çıkış Yap" Düğmesi Kaldırıldı:** Sol yan menünün (sidebar) alt kısmındaki "Çıkış Yap" (Log Out) butonu kaldırılarak arayüzün sadeliği artırıldı.

---

# PolyOS Lab v1.5.3 - Sürüm Açıklaması

🎉 **PolyOS Lab v1.5.3**

Bu sürüm; Electron'un Ağ Servisinin (Network Service) beklenmedik şekilde çökmesi/kapanması hatasını giderir ve otomatik port temizleme sürecini daha güvenli hale getirir.

---

## 🚀 Yenilikler ve İyileştirmeler

### 🌐 Güvenli Port Temizleme ve Network Service Stabilizasyonu
- **Sadece Dinleyici Süreci Hedefleme (TCP LISTEN only):** Port temizleme komutu (`killProcessOnPort`) sadece belirtilen portu dinleyen (`LISTEN` durumundaki) Go sunucu sürecini hedef alacak şekilde güncellendi. Electron'un bu port üzerindeki aktif bağlantı soketlerini (established sockets) yanlışlıkla öldürerek `Network service crashed` hatasına ve uygulamanın kendini sürekli döngüsel olarak yeniden başlatmasına sebep olan problem tamamen çözüldü.

---

# PolyOS Lab v1.5.2 - Sürüm Açıklaması

🎉 **PolyOS Lab v1.5.2**

Bu sürüm; Go sunucu bağlantı noktası çakışmalarını (address already in use) ve arayüzde sunucunun "Pasif" durumda kalması sorununu giderir.

---

## 🚀 Yenilikler ve İyileştirmeler

### 🔌 Go Sunucu Port Çakışma Düzeltmesi
- **Otomatik Port Temizliği (Kill Port on Startup):** Electron uygulaması başlatılırken veya sunucu yeniden başlatılırken, hedef portta (örn. 8080) kalmış olan yetim (orphaned) eski Go sunucu süreçleri algılanır ve otomatik olarak temizlenir. Bu sayede `bind: address already in use` hatası ve sunucunun "Pasif" durumda kilitlenmesi engellenir.

---

# PolyOS Lab v1.5.1 - Sürüm Açıklaması

🎉 **PolyOS Lab v1.5.1**

Bu sürüm; "Ekran İzleme" (Screen Monitoring) sekmesinde çift tıklama ile uzaktan kontrolü başlatma özelliği getirir ve arayüzdeki kart seçimi davranışlarını daha kararlı hale getirir.

---

## 🚀 Yenilikler ve İyileştirmeler

### 🖥️ Ekran İzleme Çift Tıklama Kontrol Desteği
- **Çift Tıklama ile Kontrol (Double Click to Control):** Ekran İzleme sekmesinde öğrenci ekranlarının üzerine çift tıklandığında VNC uzaktan kontrol penceresi otomatik olarak açılacak şekilde güncellendi.
- **Tek Tıklama ile Seçim (Single Click to Select):** Ekran İzleme sekmesinde tek tıklama işlemi, kartın seçilmesini (toplu komutlar için) sağlayarak ana paneldeki İstemci Listesi davranışı ile tamamen tutarlı hale getirildi. Seçilen kartların etrafında yeşil/turkuaz renkli çerçeve vurgusu gösterilir.

---

# PolyOS Lab v1.5.0 - Sürüm Açıklaması

🎉 **PolyOS Lab v1.5.0**

Bu sürüm; öğretmen ekranı yansıtırken (screen sharing) oluşan WebSocket bağlantı yetkilendirme sorununu çözer ve öğretmen panelindeki modal arayüzlerde (Mesaj Gönder, Uzaktan Root Terminali) yaşanan odaklanma/yazamama (keyboard focus) problemlerini tamamen giderir.

