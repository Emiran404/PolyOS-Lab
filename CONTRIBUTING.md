# PolyOS Lab'e Katkıda Bulunma Kılavuzu 🤝

Öncelikle PolyOS Lab projesine katkıda bulunmakla ilgilendiğiniz için çok teşekkür ederiz! Bu ekosistemi birlikte daha kararlı, hızlı ve güvenli hale getirmekten heyecan duyuyoruz.

Aşağıdaki yönergeler, projeye sağlıklı ve uyumlu bir şekilde katkı sağlamanıza yardımcı olmak için hazırlanmıştır.

---

## 📋 İçindekiler
1. [Nasıl Katkı Sağlayabilirim?](#-nasıl-katkı-sağlayabilirim)
2. [Hata Bildirimi Yapma](#-hata-bildirimi-yapma)
3. [Özellik Önerisinde Bulunma](#-özellik-önerisinde-bulunma)
4. [Pull Request (PR) Süreci](#-pull-request-pr-süreci)
5. [Kodlama Standartları](#-kodlama-standartları)

---

## 💡 Nasıl Katkı Sağlayabilirim?

Projeye katkı sağlamanın birçok yolu vardır:
* **Hataları Düzeltmek**: Mevcut kodlardaki açıkları veya hataları gideren düzeltmeler gönderebilirsiniz.
* **Yeni Özellikler Eklemek**: Ekran yansıtma, ses aktarımı veya yeni işletim sistemi entegrasyonları gibi özellikler geliştirebilirsiniz.
* **Dokümantasyon**: Kılavuzları, kurulum adımlarını veya kod içi açıklamaları iyileştirebilirsiniz.
* **Hata Bildirmek**: Sistemin çalışmasını aksatan durumları Issues sekmesinden bize iletebilirsiniz.

---

## 🐛 Hata Bildirimi Yapma

Eğer sistemde bir hata (bug) tespit ettiyseniz, lütfen GitHub üzerinde bir **Issue** oluşturun. Bildiriminizde şu ayrıntıların yer alması sorunu daha hızlı çözmemize yardımcı olacaktır:
* **Kullandığınız İşletim Sistemleri**: (Örn: Pardus 21, macOS Sequoia vb.)
* **Hatanın Gerçekleştiği Bileşen**: (İstemci, Sunucu veya Dashboard)
* **Hatayı Yeniden Tetikleme Adımları**: Adım adım ne yapıldığında bu hatanın oluştuğu.
* **Log Çıktıları ve Ekran Görüntüleri**: Varsa terminal logları ve görsel kanıtlar.

---

## ✨ Özellik Önerisinde Bulunma

Projede olmasını istediğiniz yeni bir fikir varsa, yine bir **Issue** açarak bunu bizimle paylaşabilirsiniz. Önerinizi sunarken şunlara dikkat edebilirsiniz:
* Önerdiğiniz özelliğin **neden** faydalı olacağını açıklayın.
* Özelliğin nasıl çalışabileceğine dair olası bir akış şeması veya tasarım önerisi sunun.

---

## 🔀 Pull Request (PR) Süreci

Projeye doğrudan kod eklemek istiyorsanız lütfen şu adımları izleyin:

1. Projeyi kendi GitHub hesabınıza forklayın (**Fork**).
2. Kendi lokal bilgisayarınızda yeni bir çalışma dalı (branch) oluşturun:
   ```bash
   git checkout -b ozellik/yeni-kontrol-mekanizmasi
   ```
3. Değişikliklerinizi yapın ve kodun derlendiğinden emin olun:
   - Go sunucusu veya istemcisi için: `go build`
   - React paneli için: `npm run build`
4. Değişikliklerinizi anlamlı commit mesajlarıyla kaydedin:
   ```bash
   git commit -m "feat: uzaktan kontrol ekranına ses yayını eklendi"
   ```
5. Dalınızı GitHub'a push edin:
   ```bash
   git push origin ozellik/yeni-kontrol-mekanizmasi
   ```
6. Ana depo (`Emiran404/PolyOS-Lab`) üzerinden bir **Pull Request (PR)** açın.

---

## 🎨 Kodlama Standartları

* **Go Kodları**: `gofmt` standartlarına uygun olmalı ve hata kontrolleri (`err != nil`) titizlikle yapılmalıdır.
* **React & TypeScript**: Temiz bileşen mimarisi ve tip güvenliği (type safety) korunmalı, gereksiz kütüphaneler eklenmemelidir.
* **İşletim Sistemi Uyumluluğu**: İstemci tarafında macOS ve Linux kod bloklarının işletim sistemine göre (`runtime.GOOS`) güvenli bir şekilde ayrıldığından emin olunmalıdır.

---

Laboratuvarları daha verimli kılmak için desteğinizi bekliyoruz! 🚀
