# PolyOS Lab - Hata Düzeltme Raporu (Bugfix Report)

Bu belgede, PolyOS Lab sistemi geliştirilirken tespit edilen 6 kritik hatanın nedenleri, teknik kök neden analizleri (Root Cause) ve uygulanan çözüm adımları detaylandırılmıştır.

---

### 1. Ekran Kilitleme Sonrası Kilit Ekranı Arayüzünün Gelmemesi
* **Hata Tanımı:** Öğretmen panelinden "Kilitle" tuşuna basıldığında istemcinin (Pardus) klavye ve fare girişleri kilitleniyor, ancak ekrana kilit HTML arayüzü gelmiyordu (ekran siyah/boş kalıyordu).
* **Kök Neden:** İstemci uygulaması sistem seviyesinde `root` yetkileri ile (`sudo` veya systemd servisi olarak) çalışmaktadır. `root` kullanıcısı, aktif masaüstü kullanıcısının X11 sunucusuna (`DISPLAY=:0`) doğrudan grafik arayüz çizmeye çalıştığında, X11 güvenlik protokolleri gereği kimlik doğrulama hatası alıyor ve Chromium/Firefox gibi tarayıcıların pencere açmasını engelliyordu.
* **Çözüm:** 
  1. `getLoggedInGUIUser` fonksiyonu ile o an sisteme giriş yapmış olan aktif GUI kullanıcısı tespit edildi.
  2. Bu kullanıcının kimlik doğrulama anahtarını içeren `.Xauthority` dosyasının yolu (`/home/<user>/.Xauthority`, `/var/run/lightdm/root/:0` vb.) dinamik olarak arandı.
  3. `runGUICommand` fonksiyonuna `DISPLAY=:0` parametresinin yanı sıra `XAUTHORITY` ortam değişkeni eklenerek komutun yetkilendirilmiş şekilde başlatılması sağlandı.

---

### 2. Uzaktan Root Terminalinde "cd" ve Dizin Değiştirme Komutlarının Çalışmaması
* **Hata Tanımı:** Öğretmen panelindeki uzak terminalden `ls` gibi komutlar çalıştırılabiliyor ancak `cd /home` gibi dizin değiştirme komutları çalışmıyor, her komut yine başlangıç dizininde çalışıyordu.
* **Kök Neden:** Her terminal komutu, istemci tarafında birbirinden bağımsız, tek seferlik birer shell alt süreci (subprocess) olarak (`/bin/sh -c "komut"`) çalıştırılıyordu. `cd` komutu çalıştırıldığında o anki alt sürecin dizini değişiyor, süreç sonlandığında ise bu durum sonraki komutlara aktarılmıyordu (stateless execution).
* **Çözüm:**
  1. İstemcide terminal komutlarının yürütüldüğü yere durumlu dizin yönetimi (`terminalCwd` state'i) entegre edildi.
  2. Her komut, sonuna `; echo ''; echo 'POLYOS_CWD:'; pwd` eklenerek çalıştırılmaya başlandı.
  3. Komut bittiğinde çıktıdan `POLYOS_CWD:` satırı yakalanarak istemcinin o an hangi dizine geçtiği tespit edildi ve `terminalCwd` değişkeninde saklandı.
  4. Bir sonraki komut çalıştırılırken `cmd.Dir = currentDir` verilerek dizin sürekliliği sağlandı.

---

### 3. Ekran Paylaşımının Tam Ekran Olmaması ve Kalite Ayarlarının Eklenmesi
* **Hata Tanımı:** İstemcilerde ekran yansıtma açıldığında görüntü tam ekran olmuyor, ekranın ortasında küçük bir pencerede kalıyordu. Ayrıca ekran yansıtma kalitesinin ayarlanması gerekiyordu.
* **Kök Neden:** Python Tkinter ile yazılan ekran yansıtma penceresi (`polyos_share_viewer.py`), X11 pencere yöneticilerinde (Pardus XFCE/Mate vb.) `overrideredirect(True)` (pencere çerçevelerini kaldırma) ile `-fullscreen` modu çakıştığında boyutlandırma hatası veriyor ve ekranı kaplayamıyordu.
* **Çözüm:**
  1. Python betiğinde ekranın genişlik ve yükseklik değerleri dinamik olarak okundu (`winfo_screenwidth()`, `winfo_screenheight()`).
  2. Pencere geometrisi doğrudan bu çözünürlüğe (`wxh+0+0`) zorlanarak tam ekran kaplaması sağlandı. `root.lift()` ve `root.focus_force()` ile odaklanma sorunu giderildi.
  3. Öğretmen ayarlar paneline 15, 30 ve 60 FPS / kalite seviyelerini belirleyen kontrol butonları eklendi.

---

### 4. İnternet Kesildiğinde Clientlerin Hâlâ İnternete Erişebilmesi
* **Hata Tanımı:** "İnterneti Kes" komutu gönderilmesine rağmen Pardus istemcilerde dış dünyaya ve YouTube gibi sitelere erişim devam ediyordu.
* **Kök Neden:** Ağ kartlarını devre dışı bırakmak öğretmen ile olan yerel ağ bağlantısını kestiği için iptal edilmişti. Ancak sonrasında yazılan DNS engelleme kuralları sadece statik listeyi engelliyor, tüm dış dünya internetini bloklamıyordu.
* **Çözüm:**
  1. Pardus istemcilerinde Linux çekirdeği seviyesinde filtreleme yapan `iptables` ve `ip6tables` kuralları yazıldı.
  2. `POLYOS_BLOCK` adında özel bir filtreleme zinciri oluşturuldu.
  3. Bu zincirde yerel IP bloklarına (`127.0.0.1`, `192.168.0.0/16`, `10.0.0.0/8`, `172.16.0.0/12`) izin verilerek öğretmen sunucusuyla olan LAN bağlantısının kopması engellendi.
  4. Yerel ağ dışındaki tüm dış dünya internet trafiği (`REJECT` kuralı ile) engellendi.

---

### 5. İstemci Sürümünün Dashboard'da Eski Gösterilmesi
* **Hata Tanımı:** İstemciler (client) 1.2.7 sürümü ile çalışmasına rağmen öğretmen panelindeki cihaz listesinde sürüm bilgisi `1.2.0` olarak kalmıştı.
* **Kök Neden:** İstemci tarafında sunucuya kayıt (register) sırasında gönderilen sürüm bilgisi `client/main.go` içerisinde `const clientVersion = "1.2.0"` şeklinde statik olarak kodlanmıştı.
* **Çözüm:** `client/main.go` dosyasındaki sürüm sabiti `const clientVersion = "1.2.7"` olarak güncellendi ve yeniden derlendi.

---

### 6. Dosya Transferi Sırasında "Dosya Gönderilirken Hata Oluştu" Hatası
* **Hata Tanımı:** Dosya gönderildiğinde "Dosya Gönderilirken Hata oluştu" uyarısı alınıyordu.
* **Kök Neden:** Sunucunun dosyayı kaydettikten sonra istemcilere gönderdiği indirme bağlantısı `http://localhost:8080/uploads/dosya_adi` şeklinde hardcoded olarak belirlenmişti. İstemci kendi üzerinde `localhost:8080` adresine bağlanmaya çalıştığında böyle bir servis bulamıyor ve indirme başarısız oluyordu.
* **Çözüm:**
  1. Sunucunun `handleUpload` fonksiyonunda indirme URL'si oluşturulurken `localhost` yerine, sunucunun LAN üzerindeki gerçek IP adresi (`getLocalIP()`) kullanıldı.
  2. Port bilgisi gelen isteğin host parametresinden dinamik olarak çözümlendi.
  3. Böylece istemciler dosyayı kendi üzerlerinden değil, öğretmen sunucusunun IP'si üzerinden (`http://<ogretmen_ip>:<port>/uploads/...`) başarıyla indirdi.