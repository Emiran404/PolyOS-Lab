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

