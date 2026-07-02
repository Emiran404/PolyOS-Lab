# PolyOS Lab v1.6.5 - Sürüm Açıklaması

🐛 **PolyOS Lab v1.6.5 — Kritik İstemci Kararlılık Düzeltmesi**

Bu sürüm, ekran yansıtma açma/kapama işlemleri sırasında öğrenci bilgisayarlarının (client) tamamen donması ve "Bağlı İstemci Bekleniyor" durumuna düşmesi sorununu çözer.

---

## 🔧 Hata Düzeltmeleri

### 1. 🥶 Ekran Yansıtma Sonrası İstemcinin (Client) Donması / Çökmesi
- **Sorun:** Öğretmen ekran yansıtmayı açtığında veya kapattığında öğrenci bilgisayarları kilitleniyor, VNC akışı donuyor ve yeniden başlatma (reboot) gibi hiçbir komuta yanıt vermiyordu.
- **Çözüm:** Go İstemcisi içerisindeki süreç yönetim (process monitoring) yapısındaki kritik bir çökme (panic) çözüldü. Ekran yansıtma süreçleri başlatılırken zaten arka planda beklenen süreçlere bir kez daha eşzamanlı olarak `Wait()` çağrısı yapıldığı için Go çalışma zamanı "panic: exec: Wait was already called" hatası verip tüm client servisini öldürüyordu. Çakışan bekleme (`Wait()`) çağrıları koddaki `startScreenShareViewer` ve `stopScreenShareViewer` fonksiyonlarından temizlendi. Artık client işlemleri kapatırken çökmeden, sorunsuz şekilde süreçleri temizleyebiliyor.

### 2. 🚦 Öğretmen Panelinin (Sunucunun) İsteklere Yanıt Vermemesi (Kilitlenme)
- **Sorun:** Ekran yansıtma esnasında istemcilerin donduğunu fark edip panelden "Kapat" veya "Yeniden Başlat" tuşlarına basıldığında, öğretmen paneli hiçbir komutu işlemiyor, sunucu arka planda tamamen donuyordu.
- **Çözüm:** Çok ciddi bir *Deadlock (Ölümcül Kilitlenme)* hatası çözüldü! Öğretmen ekran paylaşırken, sunucu her kareyi (frame) tüm istemcilere gönderirken global sunucu kilidini (`mutex.Lock()`) açık tutuyordu. Öğrencilerden biri aniden bağlantıyı koparırsa veya ağ yavaşlarsa o kare gönderilemiyor, bu esnada global kilit serbest kalmadığı için sunucuya gelen **hiçbir HTTP isteği veya mesajı** işlenemiyordu. Artık ağ iletişimi yapılırken (yayın, yansıtma, dosya gönderimi vb.) global kilit açık tutulmuyor. Sunucu donma sorunu tamamen ortadan kaldırıldı.

